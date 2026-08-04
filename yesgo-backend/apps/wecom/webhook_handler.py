"""
apps/wecom/webhook_handler.py
QiWe Webhook 异步处理器

流程：QiWe 回调 → 持久化 → 立即返回200 → ThreadPoolExecutor 异步处理
分发器：cmd 15000=文本 / 20000=图片 / 11016=联系人变更 / 15500=设备状态变更

真实 QiWe 数据格式（2026-08-01 确认）：
    单个事件 = {
        "cmd": 15000, "guid": "...", "msgType": int,
        "senderId": "...",      # 真实发送者（联系人）
        "receiverId": "...",    # 接收者（当前登录的企微账号/设备）
        "userId": "...",        # 与 receiverId 一致（兼容字段）
        "msgData": {...}, "timestamp": int, ...
    }
"""
import logging
import json
import base64
import re
from django.utils import timezone
from django.db import connection

from .models import (
    WecomDevice, WecomContact, WecomMessage, WecomMediaFile,
    WecomGroupRoom,
)

logger = logging.getLogger(__name__)

# QiWe 回调 cmd 映射
CMD_TEXT_MESSAGE = '15000'
CMD_IMAGE_MESSAGE = '20000'
CMD_CONTACT_CHANGE = '11016'
CMD_DEVICE_STATUS = '15500'


def _decode_base64_content(b64_str: str) -> str:
    """解码 QiWe base64RawData 为文本内容"""
    if not b64_str:
        return ''
    try:
        decoded = base64.b64decode(b64_str).decode('utf-8', errors='replace')
        return decoded
    except Exception as e:
        logger.warning(f'Failed to decode base64 content: {e}')
        return ''


def _decode_varint(data: bytes, pos: int):
    """Protobuf varint 解码"""
    result = 0
    shift = 0
    while pos < len(data):
        b = data[pos]
        pos += 1
        result |= (b & 0x7f) << shift
        shift += 7
        if not (b & 0x80):
            break
    return result, pos


def _extract_miniprogram_thumb_url(raw_data: dict) -> str:
    """
    从 base64RawData 中提取小程序封面图 URL。

    QiWe 网关推送的小程序消息中，封面图 URL 不在 msgData 的 coverImageId
    等字段里，而是编码在 base64RawData 的内层 protobuf 的 field 6 中。
    此处使用无依赖的轻量 protobuf 解析器，仅提取 thumbUrl。
    """
    b64 = raw_data.get('base64RawData', '') if isinstance(raw_data, dict) else ''
    if not b64:
        return ''
    try:
        decoded = base64.b64decode(b64)
    except Exception as e:
        logger.warning(f'Failed to decode miniprogram base64RawData: {e}')
        return ''

    # 外层通常只有一个高编号字段（如 field 107）包装内层 protobuf
    if len(decoded) < 2:
        return ''

    def _read_length_delimited(data: bytes, pos: int):
        length, pos = _decode_varint(data, pos)
        end = pos + length
        if end > len(data):
            return None, pos
        return data[pos:end], end

    def _parse_string_fields(data: bytes):
        """解析所有 length-delimited 字符串字段，返回 {field_number: string}。"""
        pos = 0
        fields = {}
        while pos < len(data):
            tag, pos = _decode_varint(data, pos)
            field = tag >> 3
            wire = tag & 0x07
            if wire == 2:  # length-delimited
                val, pos = _read_length_delimited(data, pos)
                if val is None:
                    break
                try:
                    fields[field] = val.decode('utf-8')
                except UnicodeDecodeError:
                    pass
            elif wire == 0:
                _, pos = _decode_varint(data, pos)
            elif wire == 5:
                pos += 4
            elif wire == 1:
                pos += 8
            else:
                break
        return fields

    # 先尝试把整个 decoded 当 protobuf 解析；如果失败，尝试把第一个字段的值当嵌套 protobuf
    fields = _parse_string_fields(decoded)
    if 6 in fields and fields[6].startswith('http'):
        return fields[6]

    # 尝试解析外层第一个 length-delimited 字段作为内层 protobuf
    pos = 0
    while pos < len(decoded):
        tag, pos = _decode_varint(decoded, pos)
        wire = tag & 0x07
        if wire == 2:
            inner, pos = _read_length_delimited(decoded, pos)
            if inner:
                inner_fields = _parse_string_fields(inner)
                if 6 in inner_fields and inner_fields[6].startswith('http'):
                    return inner_fields[6]
            break
        elif wire == 0:
            _, pos = _decode_varint(decoded, pos)
        elif wire == 5:
            pos += 4
        elif wire == 1:
            pos += 8
        else:
            break
    return ''


def process_webhook_async(event_data: dict):
    """
    Webhook 异步处理入口（在 ThreadPoolExecutor 中调用）

    兼容两种格式：
    - 真实 QiWe 格式：event_data 就是事件项本身（cmd/guid/userId 在顶层）
    - 旧测试格式：event_data 可能嵌套了 data 子字段

    Args:
        event_data: 单个 QiWe 回调事件
    """
    try:
        cmd = str(event_data.get('cmd', ''))

        # 兼容旧测试格式：如果 event_data 有嵌套的 'data' 子字段，提取出来
        inner_data = event_data.get('data', None)
        if isinstance(inner_data, dict) and 'guid' in inner_data:
            # 旧格式：{"cmd": "15000", "data": {"guid": "...", "fromId": "..."}}
            data = inner_data
        else:
            # 真实 QiWe 格式：cmd/guid/userId 都在 event_data 顶层
            data = event_data

        logger.info(f'Webhook async processing: cmd={cmd} guid={data.get("guid","")[:20]}')

        if cmd == CMD_TEXT_MESSAGE:
            _handle_text_message(data)
        elif cmd == CMD_IMAGE_MESSAGE:
            _handle_image_message(data)
        elif cmd == CMD_CONTACT_CHANGE:
            _handle_contact_change(data)
        elif cmd == CMD_DEVICE_STATUS:
            _handle_device_status(data)
        else:
            logger.info(f'Unhandled webhook cmd={cmd} msgType={event_data.get("msgType","")}')

    except Exception as e:
        logger.exception(f'Webhook async processing error: {e}')
    finally:
        # 线程中必须关闭数据库连接，防止连接泄漏
        connection.close()


# ============================================================
# 消息处理
# ============================================================

def _resolve_device_and_contact(data: dict):
    """
    从回调数据中解析设备、联系人和群聊

    真实 QiWe 格式字段（2026-08-01 确认）：
    - guid: 设备 GUID
    - senderId: 真实发送者 external_userid（消息来自谁）
    - receiverId / userId: 接收者，即当前登录的企微账号（设备本身）
    - roomId: 群聊 ID（群消息时有值，单聊消息时为空）
    - 兼容旧字段：fromId / externalUserId / fromUserId

    Returns:
        (device, contact, room, conversation_type) 元组
        - device: WecomDevice，为 None 则中止处理
        - contact: WecomContact，为 None 则中止处理
        - room: WecomGroupRoom 或 None（单聊消息）
        - conversation_type: 'group' 或 'personal'
    """
    guid = data.get('guid', '')

    # 群聊 ID（群消息时存在）
    # 依次检查：顶层各字段名 → msgData 嵌套字段
    # 兼容多种 QiWe 字段名：fromRoomId（最常见，企微真实推送） / roomId / room_id / groupId / group_id
    msg_data_raw = data.get('msgData', {}) or {}
    if not isinstance(msg_data_raw, dict):
        msg_data_raw = {}
    room_id = (
        str(data.get('fromRoomId', '') or '').strip() or
        str(data.get('from_room_id', '') or '').strip() or
        str(data.get('roomId', '') or '').strip() or
        str(data.get('room_id', '') or '').strip() or
        str(data.get('groupId', '') or '').strip() or
        str(data.get('group_id', '') or '').strip() or
        str(msg_data_raw.get('fromRoomId', '') or '').strip() or
        str(msg_data_raw.get('from_room_id', '') or '').strip() or
        str(msg_data_raw.get('roomId', '') or '').strip() or
        str(msg_data_raw.get('room_id', '') or '').strip() or
        str(msg_data_raw.get('groupId', '') or '').strip() or
        str(msg_data_raw.get('group_id', '') or '').strip() or
        ''
    )
    if room_id:
        logger.info(f'Webhook roomId resolved: {room_id} (source data keys: {list(data.keys())})')

    # 消息发送者：优先 senderId，旧格式回退到 userId/fromId
    external_userid = (
        data.get('senderId', '') or
        data.get('fromId', '') or
        data.get('externalUserId', '') or
        data.get('fromUserId', '') or
        data.get('userId', '')
    )

    # 接收者（当前设备登录的企微账号）
    receiver_id = data.get('receiverId', '') or data.get('userId', '')

    if not guid:
        logger.warning('Webhook data missing guid')
        return None, None, None, 'personal'

    # 通过 GUID 反查设备 → 租户
    try:
        device = WecomDevice.objects.select_related('tenant').get(guid=guid)
    except WecomDevice.DoesNotExist:
        logger.warning(f'Device not found for guid={guid}')
        return None, None, None, 'personal'

    # 自动记录设备登录的企微 userId（用于后续校验）
    if receiver_id and device.qw_user_id != receiver_id:
        device.qw_user_id = receiver_id
        device.save(update_fields=['qw_user_id', 'updated_at'])
        logger.info(f'Device {device.name} qw_user_id updated: {receiver_id}')

    if not external_userid:
        logger.warning(f'Webhook data missing external_userid (guid={guid})')
        return device, None, None, 'personal'

    # 安全校验：如果接收者明确不是当前设备，则跳过（防止串设备）
    if receiver_id and device.qw_user_id and receiver_id != device.qw_user_id:
        logger.warning(
            f'Webhook receiver mismatch: receiverId={receiver_id} != device.qw_user_id={device.qw_user_id}'
        )
        return device, None, None, 'personal'

    # 查找或创建联系人（按 external_userid + device 联合查找，避免跨设备串号）
    raw_name = data.get('fromName', '') or data.get('nickname', '') or data.get('name', '') or external_userid
    remark_from_data = data.get('remark', '')
    # 智能降级：name 是纯数字（手机号/external_userid）时使用备注
    if re.match(r'^\d{6,}$', str(raw_name)):
        display_name = remark_from_data or f'用户{str(external_userid)[-6:]}'
    else:
        display_name = raw_name
    # 群聊消息的发送者是群成员，不是真正的单聊联系人，标记来源以便前端过滤
    contact_source = 'group_chat' if room_id else 'unknown'
    contact, created = WecomContact.objects.get_or_create(
        external_userid=external_userid,
        device=device,
        defaults={
            'tenant': device.tenant,
            'device': device,
            'name': display_name,
            'remark': remark_from_data,
            'contact_source': contact_source,
        }
    )
    if created:
        logger.info(f'New contact created: {contact}')
        # 异步从 QiWe API 获取真实联系人信息（昵称/备注/头像）
        _fetch_contact_detail(contact, device)

    # === 群聊解析 ===
    room = None
    conversation_type = 'personal'

    if room_id:
        conversation_type = 'group'
        # 群聊名称优先使用回调数据中的 roomName/groupName，否则用 roomId
        group_name = (
            data.get('roomName', '') or
            data.get('groupName', '') or
            data.get('group_name', '') or
            msg_data_raw.get('roomName', '') or
            msg_data_raw.get('groupName', '') or
            msg_data_raw.get('group_name', '') or
            room_id
        )
        room, room_created = WecomGroupRoom.objects.get_or_create(
            group_id=room_id,
            defaults={
                'tenant': device.tenant,
                'device': device,
                'name': group_name,
                'owner_id': data.get('roomOwner', '') or data.get('groupOwner', ''),
                'member_count': data.get('memberCount', 0) or data.get('member_count', 0),
            }
        )
        if room_created:
            logger.info(f'New group room created: group_id={room_id}, name={group_name}')
        else:
            # 更新群名（可能已变更）
            if group_name and group_name != room.name:
                room.name = group_name
                room.save(update_fields=['name'])

    return device, contact, room, conversation_type


def _fetch_contact_detail(contact, device):
    """从 QiWe API 获取联系人真实信息（昵称/备注/头像）"""
    try:
        from .qiwei_client import get_qiwei_client
        client = get_qiwei_client(device)
        result = client.get_contact_detail([contact.external_userid], guid=device.guid)
        contact_list = result.get('contactList', []) or []
        if contact_list:
            detail = contact_list[0]
            name = detail.get('nickname', '') or detail.get('remark', '') or contact.name
            remark = detail.get('remark', '') or contact.remark
            avatar = detail.get('avatarUrl', '') or contact.avatar
            if name != contact.name or remark != contact.remark or avatar != contact.avatar:
                contact.name = name
                contact.remark = remark
                contact.avatar = avatar
                contact.save(update_fields=['name', 'remark', 'avatar', 'updated_at'])
                logger.info(f'Contact detail updated: {contact.external_userid} -> {name}')
            else:
                logger.debug(f'Contact detail unchanged for {contact.external_userid}')
    except Exception as e:
        logger.warning(f'Failed to fetch contact detail for {contact.external_userid}: {e}')


def _parse_timestamp(data: dict):
    """解析时间戳：优先 Unix timestamp(整数)，回退 toTime/字符串"""
    ts = data.get('timestamp', 0)
    if isinstance(ts, (int, float)) and ts > 1000000000:
        # Unix timestamp（秒级）
        from datetime import datetime, timezone as dt_timezone
        return datetime.fromtimestamp(ts, tz=dt_timezone.utc)
    # 尝试其他字段
    to_time = data.get('toTime', '')
    if to_time:
        try:
            from datetime import datetime, timezone as dt_timezone
            return datetime.fromtimestamp(int(to_time), tz=dt_timezone.utc)
        except (ValueError, TypeError):
            pass
    return timezone.now()


def _handle_text_message(data: dict):
    """
    处理 cmd=15000 消息（文本/表情/语音/视频/图片/文件）

    QiWe msgType 映射：
    - 2: 文本消息
    - 7/14/101: 图片消息（101 为个微图片）
    - 15/20/102: 文件消息（102 为个微文件）
    - 29/104/47/50: 表情（29=GIF表情, 104=企微表情, 47/50=动画表情）
    - 16/34: 语音消息（QiWe 实际使用 msgType=16 发送语音）
    - 43/22/23/103: 视频消息（103 为个微视频，22/23 为大视频/视频变体）
    - 78: 小程序消息
    - 2001/2005: 已读/未读通知（静默忽略）
    - 2063: 撤回消息（好友在微信端撤回消息）
    - 其他: 未知类型（不解码 base64RawData）
    """
    device, contact, room, conversation_type = _resolve_device_and_contact(data)
    if not device or not contact:
        return

    msg_type = data.get('msgType', 2)
    msg_data = data.get('msgData', {}) or {}

    # === 非文本消息：按 msgType 路由 ===
    # 已读/未读通知：处理已读回执
    if msg_type in (2001, 2005):
        _handle_read_receipt(data, device, contact, room, conversation_type)
        return

    if msg_type in (7, 14, 101):
        # 图片消息（7=企微图片, 14=图片变体, 101=个微图片）
        _handle_image_message_v2(data, msg_data, device, contact, room, conversation_type)
        return
    elif msg_type in (15, 20, 102):
        # 文件消息（15=企微文件, 20=文件变体, 102=个微文件）
        _handle_file_message(data, msg_data, device, contact, room, conversation_type)
        return
    elif msg_type == 29 or msg_type == 104 or msg_type in (47, 50):
        _handle_emoji_message(data, msg_data, device, contact, room, conversation_type)
        return
    elif msg_type == 34 or msg_type == 16:
        _handle_voice_message(data, msg_data, device, contact, room, conversation_type)
        return
    elif msg_type == 78:
        # 小程序消息
        _handle_miniprogram_message(data, msg_data, device, contact, room, conversation_type)
        return
    elif msg_type == 43 or msg_type in (22, 23, 103):
        # 视频消息（43 企微视频；22/23 大视频；103 个微视频）
        _handle_video_message(data, msg_data=msg_data, device=device, contact=contact, room=room, conversation_type=conversation_type)
        return
    elif msg_type == 2063:
        # 撤回消息：标记原始消息 is_recalled=True
        _handle_recall_message(data, msg_data, device, contact, room)
        return
    elif msg_type == 1011 or msg_type == 6:
        # 系统通知消息（1011=WeWork 系统提示，如"我通过了你的朋友验证请求"；6=系统文本）
        # 静默忽略，不入库不触发 AI
        logger.info(f'Ignoring system notification (msgType={msg_type})')
        return
    elif msg_type not in (2, 0, None, ''):
        # 未知消息类型：保存原始数据但不解 base64
        _handle_unknown_message(data, msg_data, device, contact, msg_type, room, conversation_type)
        return

    # === msgType=2 文本消息（原有逻辑）===
    content = ''
    if isinstance(msg_data, dict):
        content = msg_data.get('content', '')
        if not content:
            b64 = msg_data.get('base64RawData', '')
            if b64:
                content = _decode_base64_content(b64)

    # 兼容：顶层 base64RawData（某些旧事件格式）
    if not content:
        b64 = data.get('base64RawData', '')
        if b64:
            content = _decode_base64_content(b64)

    # 兼容旧格式：直接的 content/text 字段
    if not content:
        content = data.get('content', '') or data.get('text', '')

    if not content:
        logger.warning(f'Text message has empty content (guid={data.get("guid","")})')
        return

    msg_timestamp = _parse_timestamp(data)

    # 处理引用回复（reply 字段）—— 同时检查 data 顶层和 msgData 内部
    quoted_message = _resolve_quoted_message(data, msg_data, device, contact, room)

    # 提取入站消息的 msgServerId 和 msgUniqueIdentifier，用于后续被人引用时匹配
    inbound_msg_server_id = data.get('msgServerId') or msg_data.get('msgServerId') if isinstance(msg_data, dict) else None
    inbound_msg_unique_id = data.get('msgUniqueIdentifier') or msg_data.get('msgUniqueIdentifier', '') if isinstance(msg_data, dict) else ''

    # 持久化收到的消息
    msg = WecomMessage.objects.create(
        tenant=device.tenant,
        device=device,
        contact=contact,
        room=room,
        conversation_type=conversation_type,
        direction='inbound',
        msg_type='text',
        content=content,
        raw_data=data,
        ai_generated=False,
        quoted_message=quoted_message,
        msg_server_id=inbound_msg_server_id,
        msg_unique_identifier=inbound_msg_unique_id or '',
    )
    # 显式设置时间（如果模型支持 sent_at 字段）
    try:
        msg.sent_at = msg_timestamp
        msg.save(update_fields=['sent_at'])
    except Exception:
        pass

    logger.info(f'Inbound text message saved: id={msg.id}, contact={contact}, content={content[:50]}')

    # 触发 AI 回复
    _trigger_ai_reply(msg)
    _publish_sse_message(msg)

    # 分发营销事件
    _dispatch_marketing_event(
        'message_received',
        tenant_id=device.tenant_id,
        contact_id=contact.id,
        device_id=device.id,
        event_data={'content': content, 'message_id': msg.id, 'msg_type': 'text'},
    )


def _handle_emoji_message(data: dict, msg_data: dict, device, contact, room=None, conversation_type='personal'):
    """
    处理动画表情消息（msgType=104/47/50）

    msgData 包含：filename, fileHttpUrl, fileMd5, width, height
    """
    emoji_url = msg_data.get('fileHttpUrl', '') or data.get('fileHttpUrl', '')
    filename = msg_data.get('filename', '') or '动画表情'

    # 如果有 URL，创建媒体文件记录
    media_file = None
    if emoji_url:
        media_file = WecomMediaFile.objects.create(
            tenant=device.tenant,
            file_type='image',
            url=emoji_url,
        )

    msg = WecomMessage.objects.create(
        tenant=device.tenant,
        device=device,
        contact=contact,
        room=room,
        conversation_type=conversation_type,
        direction='inbound',
        msg_type='image',
        content=f'[{filename}]',
        media_file=media_file,
        raw_data=data,
        ai_generated=False,
    )
    logger.info(f'Inbound emoji saved: id={msg.id}, contact={contact}, file={emoji_url[:60]}')

    # 表情消息也触发 AI（AI 知道客户发了表情，可以礼貌回复）
    _trigger_ai_reply(msg)
    _publish_sse_message(msg)

    _dispatch_marketing_event(
        'message_received',
        tenant_id=device.tenant_id,
        contact_id=contact.id,
        device_id=device.id,
        event_data={'content': f'[{filename}]', 'message_id': msg.id, 'msg_type': 'image'},
    )


def _handle_voice_message(data: dict, msg_data: dict, device, contact, room=None, conversation_type='personal'):
    """
    处理语音消息（msgType=16 或 34）

    1. 从 msgData 提取 fileId / fileAesKey / fileMd5 / fileSize / voiceTime
    2. 调用 QiWei wxWorkDownload 下载语音文件（SILK V3 格式）
    3. 用 pilk 库将 SILK 解码为 PCM，再用 ffmpeg 转换为 MP3（浏览器可播放）
    4. 创建 WecomMediaFile + WecomMessage
    """
    import os
    import uuid
    import urllib.request
    from django.conf import settings

    file_id = ''
    file_aes_key = ''
    file_md5 = ''
    file_size = 0
    voice_time = 0
    if isinstance(msg_data, dict):
        file_id = msg_data.get('fileId', '') or msg_data.get('fileid', '')
        file_aes_key = msg_data.get('fileAesKey', '') or msg_data.get('fileAeskey', '')
        file_md5 = msg_data.get('fileMd5', '') or msg_data.get('filemd5', '')
        file_size = msg_data.get('fileSize', 0) or msg_data.get('filesize', 0)
        voice_time = msg_data.get('voiceTime', 0) or msg_data.get('voice_time', 0)

    media_file = None

    if file_id:
        try:
            from .qiwei_client import get_qiwei_client
            client = get_qiwei_client(device)

            # 使用 wxWorkDownload（实际下载文件到 OSS），而非 cdnWxDownload（仅转链接，语音返回空 URL）
            download_result = client.download_media_file(
                file_id, file_aes_key=file_aes_key, file_md5=file_md5,
                file_size=file_size, file_type=5, guid=device.guid,
            )

            cloud_url = download_result.get('cloudUrl', '')

            if cloud_url:
                # 下载 SILK 文件到本地
                upload_dir = os.path.join(settings.MEDIA_ROOT, 'wecom', 'uploads')
                os.makedirs(upload_dir, exist_ok=True)

                silk_name = f'{uuid.uuid4().hex}.silk'
                silk_path = os.path.join(upload_dir, silk_name)

                try:
                    urllib.request.urlretrieve(cloud_url, silk_path)
                    logger.info(f'Voice SILK file downloaded: {silk_path} ({os.path.getsize(silk_path)} bytes)')

                    # 检查文件头确认 SILK 格式
                    is_silk = False
                    with open(silk_path, 'rb') as f:
                        header = f.read(10)
                        if header.startswith(b'\x02#!SILK_V3') or header.startswith(b'#!SILK_V3'):
                            is_silk = True
                            logger.info('Voice file confirmed as SILK V3 format')

                    playable_name = silk_name
                    playable_path = silk_path

                    if is_silk:
                        # SILK → PCM → MP3 转换链
                        # Step 1: SILK → PCM (using pilk library)
                        pcm_converted = False
                        try:
                            import pilk
                            pcm_name = f'{uuid.uuid4().hex}.pcm'
                            pcm_path = os.path.join(upload_dir, pcm_name)

                            # pilk 版本兼容性：新版支持 sample_rate 参数，生产 0.2.4 不支持
                            pcm_sample_rate = 16000
                            try:
                                duration = pilk.decode(silk_path, pcm_path, sample_rate=pcm_sample_rate)
                                logger.info(f'SILK→PCM decoded: {pcm_path} (duration={duration}ms, sr={pcm_sample_rate})')
                            except TypeError as _pilkv0_err:
                                # pilk 0.2.4 默认输出 24kHz PCM
                                duration = pilk.decode(silk_path, pcm_path)
                                pcm_sample_rate = 24000
                                # 根据 PCM 大小反推实际采样率（duration 为秒）
                                if duration and os.path.exists(pcm_path) and os.path.getsize(pcm_path) > 0:
                                    inferred_sr = int(os.path.getsize(pcm_path) / (2 * max(duration, 1)))
                                    if 22000 <= inferred_sr <= 26000:
                                        pcm_sample_rate = 24000
                                logger.info(f'SILK→PCM decoded (pilk v0.2.4): {pcm_path} (duration={duration}s, sr={pcm_sample_rate})')

                            # Step 2: PCM → MP3 (using ffmpeg)
                            try:
                                import imageio_ffmpeg
                                import subprocess
                                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                                mp3_name = f'{uuid.uuid4().hex}.mp3'
                                mp3_path = os.path.join(upload_dir, mp3_name)
                                # PCM 16-bit mono → MP3（输入采样率与 pilk 输出一致）
                                result = subprocess.run(
                                    [ffmpeg_exe, '-y', '-f', 's16le', '-ar', str(pcm_sample_rate), '-ac', '1',
                                     '-i', pcm_path, '-af', 'volume=3.0',
                                     '-ar', str(pcm_sample_rate), '-ac', '1', mp3_path],
                                    capture_output=True, timeout=30,
                                )
                                if result.returncode == 0 and os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
                                    playable_name = mp3_name
                                    playable_path = mp3_path
                                    pcm_converted = True
                                    logger.info(f'PCM→MP3 converted: {mp3_path}')
                                    # 清理中间文件
                                    os.remove(pcm_path)
                                    os.remove(silk_path)
                                else:
                                    logger.warning(f'PCM→MP3 conversion failed: {result.stderr.decode()[-200:]}')
                            except Exception as mp3_err:
                                logger.warning(f'PCM→MP3 conversion exception: {mp3_err}')
                        except ImportError:
                            logger.warning('pilk library not installed, cannot decode SILK. Install with: pip install pilk')
                        except Exception as silk_err:
                            logger.warning(f'SILK→PCM decode failed: {silk_err}')

                        if not pcm_converted:
                            # pilk 解码失败，尝试直接用 ffmpeg（可能服务器 ffmpeg 支持 SILK）
                            try:
                                import imageio_ffmpeg
                                import subprocess
                                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                                mp3_name = f'{uuid.uuid4().hex}.mp3'
                                mp3_path = os.path.join(upload_dir, mp3_name)
                                result = subprocess.run(
                                    [ffmpeg_exe, '-y', '-i', silk_path, '-af', 'volume=3.0',
                                     '-ar', '16000', '-ac', '1', mp3_path],
                                    capture_output=True, timeout=30,
                                )
                                if result.returncode == 0 and os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
                                    playable_name = mp3_name
                                    playable_path = mp3_path
                                    os.remove(silk_path)
                                    logger.info(f'SILK→MP3 direct conversion: {mp3_path}')
                                else:
                                    logger.warning(f'SILK→MP3 direct failed (expected): {result.stderr.decode()[-200:]}')
                            except Exception as direct_err:
                                logger.warning(f'SILK→MP3 direct exception: {direct_err}')
                    else:
                        # 非 SILK 格式，尝试直接用 ffmpeg 转换（可能是 AMR 等其他格式）
                        logger.info(f'Voice file is not SILK (header: {header[:10]}), trying direct ffmpeg conversion')
                        try:
                            import imageio_ffmpeg
                            import subprocess
                            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                            mp3_name = f'{uuid.uuid4().hex}.mp3'
                            mp3_path = os.path.join(upload_dir, mp3_name)
                            result = subprocess.run(
                                [ffmpeg_exe, '-y', '-i', silk_path, '-af', 'volume=3.0',
                                 '-ar', '16000', '-ac', '1', mp3_path],
                                capture_output=True, timeout=30,
                            )
                            if result.returncode == 0 and os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
                                playable_name = mp3_name
                                playable_path = mp3_path
                                os.remove(silk_path)
                                logger.info(f'Voice→MP3 direct conversion: {mp3_path}')
                            else:
                                logger.warning(f'Voice→MP3 direct failed: {result.stderr.decode()[-200:]}')
                        except Exception as direct_err:
                            logger.warning(f'Voice→MP3 direct exception: {direct_err}')

                    # 构造浏览器可访问的 URL
                    base_url = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
                    playable_url = f'{base_url}{settings.MEDIA_URL}wecom/uploads/{playable_name}'

                    media_file = WecomMediaFile.objects.create(
                        tenant=device.tenant,
                        file_type='voice',
                        qiwe_file_id=file_id,
                        local_path=f'wecom/uploads/{playable_name}',
                        url=playable_url,
                    )
                except Exception as dl_err:
                    logger.warning(f'Failed to download voice file: {dl_err}')
            else:
                logger.warning(f'wxWorkDownload returned no cloudUrl for fileId={file_id}: {download_result}')

        except Exception as e:
            logger.warning(f'Failed to download/process voice media: {e}')

    content = f'[语音] {voice_time}秒' if voice_time else '[语音]'

    msg = WecomMessage.objects.create(
        tenant=device.tenant,
        device=device,
        contact=contact,
        room=room,
        conversation_type=conversation_type,
        direction='inbound',
        msg_type='voice',
        content=content,
        media_file=media_file,
        raw_data=data,
        ai_generated=False,
    )
    logger.info(f'Inbound voice saved: id={msg.id}, contact={contact}, voice_time={voice_time}, has_media={media_file is not None}')

    # 语音消息也触发 AI（AI 知道客户发了语音，可以回复）
    _trigger_ai_reply(msg)
    _publish_sse_message(msg)

    _dispatch_marketing_event(
        'message_received',
        tenant_id=device.tenant_id,
        contact_id=contact.id,
        device_id=device.id,
        event_data={'content': content, 'message_id': msg.id, 'msg_type': 'voice'},
    )


def _handle_video_message(data: dict, msg_data=None, device=None, contact=None, room=None, conversation_type='personal'):
    """
    处理视频消息

    两条调用路径：
    1. cmd=20000 且检测到视频字段 → _handle_image_message 路由进来（msg_data=None）
    2. cmd=15000 msgType=43 → _handle_text_message 路由进来（msg_data 有值）

    1. 提取 fileId / fileAesKey / fileMd5 / fileSize / playLength
    2. 调用 QiWei wxWorkDownload 下载视频文件（MP4 格式）
    3. 保存到本地 wecom/uploads/ 目录
    4. 创建 WecomMediaFile(file_type='video') + WecomMessage(msg_type='video')
    """
    import os
    import uuid
    import urllib.request
    from django.conf import settings

    # 解析 device/contact（如果调用方未提供）
    if device is None or contact is None:
        device, contact, room, conversation_type = _resolve_device_and_contact(data)
    if not device or not contact:
        return

    # 提取文件信息（兼容 cmd=20000 顶层 和 cmd=15000 msgData 两种格式）
    file_id = ''
    file_aes_key = ''
    file_md5 = ''
    file_size = 0
    play_length = 0

    # 优先从 msgData 提取（cmd=15000 路径）
    if isinstance(msg_data, dict):
        file_id = msg_data.get('fileId', '') or msg_data.get('fileid', '')
        file_aes_key = msg_data.get('fileAesKey', '') or msg_data.get('fileAeskey', '')
        file_md5 = msg_data.get('fileMd5', '') or msg_data.get('filemd5', '')
        file_size = msg_data.get('fileSize', 0) or msg_data.get('filesize', 0)
        play_length = msg_data.get('playLength', 0) or msg_data.get('play_length', 0) or msg_data.get('duration', 0)

    # fallback：从顶层 data 提取（cmd=20000 路径）
    if not file_id:
        file_id = data.get('fileId', '') or data.get('aeskey', '')
    if not file_aes_key:
        file_aes_key = data.get('fileAesKey', '') or data.get('aeskey', '')
    if not file_md5:
        file_md5 = data.get('fileMd5', '')
    if not file_size:
        file_size = data.get('fileSize', 0) or data.get('videoSize', 0)
    if not play_length:
        play_length = data.get('playLength', 0) or data.get('duration', 0)

    # 可能直接有 videoUrl / fileHttpUrl
    video_url = data.get('videoUrl', '') or data.get('fileUrl', '')
    if isinstance(msg_data, dict) and not video_url:
        video_url = msg_data.get('videoUrl', '') or msg_data.get('fileUrl', '')

    # msgType=103（个微视频）使用 fileHttpUrl 直接 HTTPS 下载，不走 fileId/wxWorkDownload
    file_http_url = ''
    if isinstance(msg_data, dict):
        file_http_url = msg_data.get('fileHttpUrl', '') or ''
    if not file_http_url:
        file_http_url = data.get('fileHttpUrl', '')

    # 视频封面图（msgType=103 有 coverImageHttpUrl）
    cover_http_url = ''
    if isinstance(msg_data, dict):
        cover_http_url = msg_data.get('coverImageHttpUrl', '') or ''
    if not cover_http_url:
        cover_http_url = data.get('coverImageHttpUrl', '')

    media_file = None

    # 路径 A：通过 fileId 调用 QiWei wxWorkDownload 下载（msgType=43 等）
    if file_id:
        try:
            from .qiwei_client import get_qiwei_client
            client = get_qiwei_client(device)

            download_result = client.download_media_file(
                file_id, file_aes_key=file_aes_key, file_md5=file_md5,
                file_size=file_size, file_type=5, guid=device.guid,
            )

            cloud_url = download_result.get('cloudUrl', '') or video_url

            if cloud_url:
                upload_dir = os.path.join(settings.MEDIA_ROOT, 'wecom', 'uploads')
                os.makedirs(upload_dir, exist_ok=True)

                mp4_name = f'{uuid.uuid4().hex}.mp4'
                mp4_path = os.path.join(upload_dir, mp4_name)

                try:
                    urllib.request.urlretrieve(cloud_url, mp4_path)
                    file_size_actual = os.path.getsize(mp4_path)
                    logger.info(f'Video file downloaded: {mp4_path} ({file_size_actual} bytes)')

                    base_url = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
                    playable_url = f'{base_url}{settings.MEDIA_URL}wecom/uploads/{mp4_name}'

                    media_file = WecomMediaFile.objects.create(
                        tenant=device.tenant,
                        file_type='video',
                        qiwe_file_id=file_id,
                        local_path=f'wecom/uploads/{mp4_name}',
                        url=playable_url,
                    )
                except Exception as dl_err:
                    logger.warning(f'Failed to download video file: {dl_err}')
            else:
                logger.warning(f'wxWorkDownload returned no cloudUrl for video fileId={file_id}: {download_result}')

        except Exception as e:
            logger.warning(f'Failed to download/process video media: {e}')

    # 路径 B：通过 fileHttpUrl 直接 HTTPS 下载（msgType=103 个微视频）
    elif file_http_url:
        try:
            upload_dir = os.path.join(settings.MEDIA_ROOT, 'wecom', 'uploads')
            os.makedirs(upload_dir, exist_ok=True)

            mp4_name = f'{uuid.uuid4().hex}.mp4'
            mp4_path = os.path.join(upload_dir, mp4_name)

            # 创建带 User-Agent 的 opener（部分微信 CDN 需要）
            req = urllib.request.Request(file_http_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            with urllib.request.urlopen(req, timeout=60) as resp:
                with open(mp4_path, 'wb') as f:
                    f.write(resp.read())

            file_size_actual = os.path.getsize(mp4_path)
            logger.info(f'Video file downloaded via fileHttpUrl: {mp4_path} ({file_size_actual} bytes)')

            base_url = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
            playable_url = f'{base_url}{settings.MEDIA_URL}wecom/uploads/{mp4_name}'

            media_file = WecomMediaFile.objects.create(
                tenant=device.tenant,
                file_type='video',
                qiwe_file_id=file_http_url[-32:] if len(file_http_url) > 32 else file_http_url,
                local_path=f'wecom/uploads/{mp4_name}',
                url=playable_url,
            )
        except Exception as e:
            logger.warning(f'Failed to download video via fileHttpUrl: {e}')

    # 路径 C：仅有 videoUrl（降级直接下载）
    elif video_url:
        try:
            upload_dir = os.path.join(settings.MEDIA_ROOT, 'wecom', 'uploads')
            os.makedirs(upload_dir, exist_ok=True)

            mp4_name = f'{uuid.uuid4().hex}.mp4'
            mp4_path = os.path.join(upload_dir, mp4_name)

            urllib.request.urlretrieve(video_url, mp4_path)
            file_size_actual = os.path.getsize(mp4_path)
            logger.info(f'Video file downloaded via videoUrl: {mp4_path} ({file_size_actual} bytes)')

            base_url = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
            playable_url = f'{base_url}{settings.MEDIA_URL}wecom/uploads/{mp4_name}'

            media_file = WecomMediaFile.objects.create(
                tenant=device.tenant,
                file_type='video',
                qiwe_file_id='',
                local_path=f'wecom/uploads/{mp4_name}',
                url=playable_url,
            )
        except Exception as e:
            logger.warning(f'Failed to download video via videoUrl: {e}')

    content = f'[视频] {play_length}秒' if play_length else '[视频]'

    msg = WecomMessage.objects.create(
        tenant=device.tenant,
        device=device,
        contact=contact,
        room=room,
        conversation_type=conversation_type,
        direction='inbound',
        msg_type='video',
        content=content,
        media_file=media_file,
        raw_data=data,
        ai_generated=False,
    )
    logger.info(f'Inbound video saved: id={msg.id}, contact={contact}, play_length={play_length}, has_media={media_file is not None}')

    _trigger_ai_reply(msg)
    _publish_sse_message(msg)

    _dispatch_marketing_event(
        'message_received',
        tenant_id=device.tenant_id,
        contact_id=contact.id,
        device_id=device.id,
        event_data={'content': '', 'message_id': msg.id, 'msg_type': 'video'},
    )


def _handle_image_message_v2(data: dict, msg_data: dict, device, contact, room=None, conversation_type='personal'):
    """
    处理 cmd=15000 图片消息（msgType 7/14/101）

    图片来源：
    - msgType 7/14: 企微图片，通过 fileId + wxWorkDownload 下载到 OSS
    - msgType 101: 个微图片，通过 fileHttpUrl 直接 HTTPS 下载

    流程：
    1. 提取 fileId / fileAesKey / fileMd5 / fileSize / fileHttpUrl
    2. 下载图片到本地 media/wecom/uploads/
    3. 创建 WecomMediaFile(file_type='image') + WecomMessage(msg_type='image')
    4. 触发 AI 回复
    """
    import os
    import uuid
    import urllib.request
    from django.conf import settings

    # 提取文件信息
    file_id = ''
    file_aes_key = ''
    file_md5 = ''
    file_size = 0
    file_http_url = ''

    if isinstance(msg_data, dict):
        file_id = msg_data.get('fileId', '') or msg_data.get('fileid', '')
        file_aes_key = msg_data.get('fileAesKey', '') or msg_data.get('fileAeskey', '')
        file_md5 = msg_data.get('fileMd5', '') or msg_data.get('filemd5', '')
        file_size = msg_data.get('fileSize', 0) or msg_data.get('filesize', 0)
        file_http_url = msg_data.get('fileHttpUrl', '') or ''

    # fallback：从顶层 data 提取
    if not file_id:
        file_id = data.get('fileId', '') or data.get('aeskey', '')
    if not file_aes_key:
        file_aes_key = data.get('fileAesKey', '') or data.get('aeskey', '')
    if not file_md5:
        file_md5 = data.get('fileMd5', '')
    if not file_size:
        file_size = data.get('fileSize', 0)
    if not file_http_url:
        file_http_url = data.get('fileHttpUrl', '')

    # 也可能有 imageUrl 字段
    image_url = data.get('imageUrl', '') or msg_data.get('imageUrl', '')

    media_file = None
    msg_type = data.get('msgType', 0)

    # 路径 A：通过 fileHttpUrl 直接下载（msgType=101 个微图片，首选）
    if file_http_url:
        try:
            upload_dir = os.path.join(settings.MEDIA_ROOT, 'wecom', 'uploads')
            os.makedirs(upload_dir, exist_ok=True)

            # 尝试从 URL 判断扩展名
            ext = '.jpg'
            path_lower = file_http_url.lower()
            if '.png' in path_lower:
                ext = '.png'
            elif '.gif' in path_lower:
                ext = '.gif'
            elif '.webp' in path_lower:
                ext = '.webp'

            img_name = f'{uuid.uuid4().hex}{ext}'
            img_path = os.path.join(upload_dir, img_name)

            # 部分微信 CDN 需要 User-Agent
            req = urllib.request.Request(file_http_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            with urllib.request.urlopen(req, timeout=30) as resp:
                with open(img_path, 'wb') as f:
                    f.write(resp.read())

            file_size_actual = os.path.getsize(img_path)
            logger.info(f'Image downloaded via fileHttpUrl: {img_path} ({file_size_actual} bytes)')

            base_url = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
            accessible_url = f'{base_url}{settings.MEDIA_URL}wecom/uploads/{img_name}'

            media_file = WecomMediaFile.objects.create(
                tenant=device.tenant,
                file_type='image',
                qiwe_file_id=file_http_url[-32:] if len(file_http_url) > 32 else file_http_url,
                local_path=f'wecom/uploads/{img_name}',
                url=accessible_url,
            )
        except Exception as e:
            logger.warning(f'Failed to download image via fileHttpUrl: {e}')

    # 路径 B：通过 imageUrl 保存外链（不做本地下载）
    if not media_file and image_url:
        media_file = WecomMediaFile.objects.create(
            tenant=device.tenant,
            file_type='image',
            qiwe_file_id=file_id or '',
            url=image_url,
        )

    # 路径 C：通过 fileId 调用 wxWorkDownload 下载
    if not media_file and file_id:
        try:
            from .qiwei_client import get_qiwei_client
            client = get_qiwei_client(device)

            download_result = client.download_media_file(
                file_id, file_aes_key=file_aes_key, file_md5=file_md5,
                file_size=file_size, file_type=1, guid=device.guid,
            )

            cloud_url = download_result.get('cloudUrl', '') or image_url

            if cloud_url:
                upload_dir = os.path.join(settings.MEDIA_ROOT, 'wecom', 'uploads')
                os.makedirs(upload_dir, exist_ok=True)

                # 从 cloudUrl 判断扩展名
                ext = '.jpg'
                if '.png' in cloud_url.lower():
                    ext = '.png'
                elif '.gif' in cloud_url.lower():
                    ext = '.gif'

                img_name = f'{uuid.uuid4().hex}{ext}'
                img_path = os.path.join(upload_dir, img_name)

                try:
                    urllib.request.urlretrieve(cloud_url, img_path)
                    file_size_actual = os.path.getsize(img_path)
                    logger.info(f'Image downloaded via wxWorkDownload: {img_path} ({file_size_actual} bytes)')

                    base_url = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
                    accessible_url = f'{base_url}{settings.MEDIA_URL}wecom/uploads/{img_name}'

                    media_file = WecomMediaFile.objects.create(
                        tenant=device.tenant,
                        file_type='image',
                        qiwe_file_id=file_id,
                        local_path=f'wecom/uploads/{img_name}',
                        url=accessible_url,
                    )
                except Exception as dl_err:
                    logger.warning(f'Failed to download image from cloudUrl: {dl_err}')
            else:
                logger.warning(f'wxWorkDownload returned no cloudUrl for image fileId={file_id}')
                # 降级：仅保存引用
                media_file = WecomMediaFile.objects.create(
                    tenant=device.tenant,
                    file_type='image',
                    qiwe_file_id=file_id,
                    url=image_url or '',
                )

        except Exception as e:
            logger.warning(f'Failed to download/process image media: {e}')
            # 降级：仅保存 fileId 引用
            if not media_file:
                media_file = WecomMediaFile.objects.create(
                    tenant=device.tenant,
                    file_type='image',
                    qiwe_file_id=file_id,
                    url=image_url or '',
                )

    # 如果完全没有媒体，至少创建一个引用记录
    if not media_file and (file_id or image_url or file_http_url):
        media_file = WecomMediaFile.objects.create(
            tenant=device.tenant,
            file_type='image',
            qiwe_file_id=file_id or '',
            url=image_url or file_http_url or '',
        )

    content = '[图片]'
    if media_file and media_file.url:
        content = f'[图片] {media_file.url}'

    msg = WecomMessage.objects.create(
        tenant=device.tenant,
        device=device,
        contact=contact,
        room=room,
        conversation_type=conversation_type,
        direction='inbound',
        msg_type='image',
        content=content,
        media_file=media_file,
        raw_data=data,
        ai_generated=False,
    )
    logger.info(f'Inbound image saved (msgType={msg_type}): id={msg.id}, contact={contact}, has_media={media_file is not None}')

    # 图片消息也触发 AI 回复
    _trigger_ai_reply(msg)
    _publish_sse_message(msg)

    _dispatch_marketing_event(
        'message_received',
        tenant_id=device.tenant_id,
        contact_id=contact.id,
        device_id=device.id,
        event_data={'content': '', 'message_id': msg.id, 'msg_type': 'image'},
    )


def _handle_file_message(data: dict, msg_data: dict, device, contact, room=None, conversation_type='personal'):
    """
    处理 cmd=15000 文件消息（msgType 15/20/102）

    支持：
    - msgType 15/20: 企微文件，通过 fileId + wxWorkDownload 下载
    - msgType 102: 个微文件，通过 fileHttpUrl 直接下载

    流程：
    1. 提取 fileId / fileAesKey / fileMd5 / fileSize / filename / fileHttpUrl
    2. 下载文件到本地 media/wecom/uploads/（保留原始文件名）
    3. 创建 WecomMediaFile(file_type='file') + WecomMessage(msg_type='file')
    4. 触发 AI 回复
    """
    import os
    import uuid
    import urllib.request
    from django.conf import settings

    # 提取文件信息
    file_id = ''
    file_aes_key = ''
    file_md5 = ''
    file_size = 0
    filename = ''
    file_http_url = ''

    if isinstance(msg_data, dict):
        file_id = msg_data.get('fileId', '') or msg_data.get('fileid', '')
        file_aes_key = msg_data.get('fileAesKey', '') or msg_data.get('fileAeskey', '')
        file_md5 = msg_data.get('fileMd5', '') or msg_data.get('filemd5', '')
        file_size = msg_data.get('fileSize', 0) or msg_data.get('filesize', 0)
        filename = msg_data.get('filename', '') or msg_data.get('fileName', '') or msg_data.get('name', '')
        file_http_url = msg_data.get('fileHttpUrl', '') or ''

    # fallback：从顶层 data 提取
    if not file_id:
        file_id = data.get('fileId', '') or data.get('aeskey', '')
    if not file_aes_key:
        file_aes_key = data.get('fileAesKey', '') or data.get('aeskey', '')
    if not file_md5:
        file_md5 = data.get('fileMd5', '')
    if not file_size:
        file_size = data.get('fileSize', 0)
    if not filename:
        filename = data.get('filename', '') or data.get('fileName', '')
    if not file_http_url:
        file_http_url = data.get('fileHttpUrl', '')

    media_file = None
    msg_type = data.get('msgType', 0)
    display_name = filename or '未知文件'

    # 路径 A：通过 fileHttpUrl 直接下载（msgType=102 个微文件，首选）
    if file_http_url:
        try:
            upload_dir = os.path.join(settings.MEDIA_ROOT, 'wecom', 'uploads')
            os.makedirs(upload_dir, exist_ok=True)

            # 保留原始文件名，添加 UUID 前缀避免重名
            safe_filename = filename if filename else 'file'
            safe_filename = ''.join(c for c in safe_filename if c.isalnum() or c in '._- ')
            if not safe_filename.strip():
                safe_filename = 'file'
            local_filename = f'{uuid.uuid4().hex}_{safe_filename}'
            local_path = os.path.join(upload_dir, local_filename)

            req = urllib.request.Request(file_http_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            with urllib.request.urlopen(req, timeout=120) as resp:
                with open(local_path, 'wb') as f:
                    f.write(resp.read())

            file_size_actual = os.path.getsize(local_path)
            logger.info(f'File downloaded via fileHttpUrl: {local_path} ({file_size_actual} bytes, name={display_name})')

            base_url = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
            accessible_url = f'{base_url}{settings.MEDIA_URL}wecom/uploads/{local_filename}'

            media_file = WecomMediaFile.objects.create(
                tenant=device.tenant,
                file_type='file',
                qiwe_file_id=file_http_url[-32:] if len(file_http_url) > 32 else file_http_url,
                local_path=f'wecom/uploads/{local_filename}',
                url=accessible_url,
            )
        except Exception as e:
            logger.warning(f'Failed to download file via fileHttpUrl: {e}')

    # 路径 B：通过 fileId 调用 wxWorkDownload 下载
    if not media_file and file_id:
        try:
            from .qiwei_client import get_qiwei_client
            client = get_qiwei_client(device)

            download_result = client.download_media_file(
                file_id, file_aes_key=file_aes_key, file_md5=file_md5,
                file_size=file_size, file_type=5, guid=device.guid,
            )

            cloud_url = download_result.get('cloudUrl', '')

            if cloud_url:
                upload_dir = os.path.join(settings.MEDIA_ROOT, 'wecom', 'uploads')
                os.makedirs(upload_dir, exist_ok=True)

                safe_filename = filename if filename else 'file'
                safe_filename = ''.join(c for c in safe_filename if c.isalnum() or c in '._- ')
                if not safe_filename.strip():
                    safe_filename = 'file'
                local_filename = f'{uuid.uuid4().hex}_{safe_filename}'
                local_path = os.path.join(upload_dir, local_filename)

                try:
                    urllib.request.urlretrieve(cloud_url, local_path)
                    file_size_actual = os.path.getsize(local_path)
                    logger.info(f'File downloaded via wxWorkDownload: {local_path} ({file_size_actual} bytes, name={display_name})')

                    base_url = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
                    accessible_url = f'{base_url}{settings.MEDIA_URL}wecom/uploads/{local_filename}'

                    media_file = WecomMediaFile.objects.create(
                        tenant=device.tenant,
                        file_type='file',
                        qiwe_file_id=file_id,
                        local_path=f'wecom/uploads/{local_filename}',
                        url=accessible_url,
                    )
                except Exception as dl_err:
                    logger.warning(f'Failed to download file from cloudUrl: {dl_err}')
            else:
                logger.warning(f'wxWorkDownload returned no cloudUrl for file fileId={file_id}')

        except Exception as e:
            logger.warning(f'Failed to download/process file media: {e}')

    # 降级：至少记录文件信息
    if not media_file:
        media_file = WecomMediaFile.objects.create(
            tenant=device.tenant,
            file_type='file',
            qiwe_file_id=file_id or '',
            url=file_http_url or '',
        )

    content = f'[文件] {display_name}' if filename else '[文件]'

    msg = WecomMessage.objects.create(
        tenant=device.tenant,
        device=device,
        contact=contact,
        room=room,
        conversation_type=conversation_type,
        direction='inbound',
        msg_type='file',
        content=content,
        media_file=media_file,
        raw_data=data,
        ai_generated=False,
    )
    logger.info(f'Inbound file saved (msgType={msg_type}): id={msg.id}, contact={contact}, filename={display_name}, has_media={media_file is not None}')

    _trigger_ai_reply(msg)
    _publish_sse_message(msg)

    _dispatch_marketing_event(
        'message_received',
        tenant_id=device.tenant_id,
        contact_id=contact.id,
        device_id=device.id,
        event_data={'content': display_name, 'message_id': msg.id, 'msg_type': 'file'},
    )


def _handle_recall_message(data: dict, msg_data: dict, device, contact, room=None):
    """
    处理撤回消息（msgType=2063）

    QiWe 撤回回调：好友在微信端撤回了一条消息。
    msgData 中通常包含 newMsgId（被撤回消息的 msgSvrId），
    我们需要找到原始消息并标记 is_recalled=True，而非创建新的"未知消息"。

    查找策略（按优先级）：
    1. 通过 msgData.newMsgId 匹配 raw_data 中的 msgSvrId
    2. fallback：找同一联系人+设备最近一条未撤回的入站消息
    """
    # 从 msgData 提取被撤回消息的 ID
    recalled_id = ''
    if isinstance(msg_data, dict):
        recalled_id = (
            msg_data.get('newMsgId', '')
            or msg_data.get('oldMsgId', '')
            or msg_data.get('msgSvrId', '')
            or ''
        )

    original_msg = None

    # 构建基础查询过滤器
    def _recall_base_filter(**extra):
        qs = WecomMessage.objects.filter(
            device=device,
            contact=contact,
            direction='inbound',
            is_recalled=False,
            **extra,
        )
        # 群聊消息仅在同群内匹配
        if room:
            qs = qs.filter(room=room)
        else:
            qs = qs.filter(room__isnull=True)
        return qs

    # 策略1：通过 raw_data.msgSvrId 或 msg_server_id 精确匹配
    if recalled_id:
        try:
            original_msg = _recall_base_filter(raw_data__msgSvrId=recalled_id).get()
        except WecomMessage.DoesNotExist:
            try:
                recalled_id_int = int(recalled_id)
                original_msg = _recall_base_filter(msg_server_id=recalled_id_int).get()
            except (ValueError, WecomMessage.DoesNotExist):
                pass
        except WecomMessage.MultipleObjectsReturned:
            original_msg = _recall_base_filter(
                raw_data__msgSvrId=recalled_id,
            ).order_by('-created_at').first()
        except Exception as e:
            logger.debug(f'raw_data__msgSvrId lookup failed: {e}')
            try:
                recalled_id_int = int(recalled_id)
                original_msg = _recall_base_filter(
                    msg_server_id=recalled_id_int,
                ).order_by('-created_at').first()
            except ValueError:
                pass

    # 策略2：fallback — 找同一联系人最近一条未撤回的入站消息（5分钟窗口）
    if not original_msg:
        from datetime import timedelta
        cutoff = timezone.now() - timedelta(minutes=5)
        original_msg = _recall_base_filter(
            created_at__gte=cutoff,
        ).order_by('-created_at').first()

    if original_msg:
        original_msg.is_recalled = True
        original_msg.save(update_fields=['is_recalled'])
        logger.info(
            f'Recall: marked message id={original_msg.id} as recalled, '
            f'contact={contact}, content={original_msg.content[:50]}'
        )
    else:
        logger.warning(
            f'Recall: no matching original message found for contact={contact}, '
            f'recalled_id={recalled_id}'
        )


def _resolve_quoted_message(data: dict, msg_data: dict, device, contact, room=None):
    """
    从 webhook 回调数据中解析引用消息关系（inbound 消息引用）

    QiWe 回调中引用消息格式（reply 字段）:
    {
        'type': int,           # 被引用消息类型
        'msgServerId': int,    # 被引用消息的服务器 ID
        'userId': str,         # 发送者 ID
        'showName': str,       # 发送者显示名
        'timeStamp': int,      # 引用消息时间戳
        'msgUniqueIdentifier': str,  # 唯一标识
        'msgData': {...},      # 被引用消息内容
    }

    注意：QiWe webhook 中 'reply' 字段可能位于 data 顶层，也可能嵌套在 msgData 内部。
    同时兼容 'quotedMessageId' 字段名。

    查找策略（按优先级）：
    1. 通过 reply.msgServerId 或 quotedMessageId 匹配 WecomMessage.msg_server_id
    2. fallback：通过 msgUniqueIdentifier 匹配
    3. fallback：通过 reply.msgData.content 内容匹配
    """
    # 同时从 data 顶层和 msgData 内部查找 reply 字段
    reply = data.get('reply', None)
    if (not reply or not isinstance(reply, dict)) and isinstance(msg_data, dict):
        reply = msg_data.get('reply', None)

    # 兼容：某些 QiWe 版本使用 quotedMessageId 字段
    quoted_msg_id = None
    if not reply or not isinstance(reply, dict) or not reply.get('msgServerId'):
        quoted_msg_id = data.get('quotedMessageId') or (msg_data.get('quotedMessageId') if isinstance(msg_data, dict) else None)

    if not reply and not quoted_msg_id:
        return None

    msg_server_id = reply.get('msgServerId', 0) if isinstance(reply, dict) else 0
    if not msg_server_id and quoted_msg_id:
        msg_server_id = int(quoted_msg_id)

    if not msg_server_id:
        return None

    # 构建基础查询——群聊消息仅在同群内匹配引用
    def _quote_base_filter(**extra):
        qs = WecomMessage.objects.filter(
            device=device,
            contact=contact,
            **extra,
        )
        if room:
            qs = qs.filter(room=room)
        else:
            qs = qs.filter(room__isnull=True)
        return qs

    # 策略1：通过 msg_server_id 精确匹配
    try:
        quoted = _quote_base_filter(msg_server_id=msg_server_id).get()
        logger.info(f'Inbound quote resolved: msg_server_id={msg_server_id} -> message id={quoted.id}')
        return quoted
    except WecomMessage.DoesNotExist:
        pass
    except WecomMessage.MultipleObjectsReturned:
        quoted = _quote_base_filter(
            msg_server_id=msg_server_id,
        ).order_by('-created_at').first()
        if quoted:
            logger.info(f'Inbound quote resolved (multiple): msg_server_id={msg_server_id} -> message id={quoted.id}')
            return quoted

    # 策略2：fallback — 通过 msgUniqueIdentifier 匹配
    msg_unique_id = reply.get('msgUniqueIdentifier', '') if isinstance(reply, dict) else ''
    if msg_unique_id:
        try:
            quoted = _quote_base_filter(msg_unique_identifier=msg_unique_id).get()
            logger.info(f'Inbound quote resolved by uniqueId: {msg_unique_id} -> message id={quoted.id}')
            return quoted
        except WecomMessage.DoesNotExist:
            pass

    # 策略3：fallback — 通过引用内容匹配（reply.msgData.content）
    if isinstance(reply, dict):
        quoted_content = (reply.get('msgData') or {}).get('content', '') if isinstance(reply.get('msgData'), dict) else ''
        if quoted_content:
            try:
                quoted = _quote_base_filter(content=quoted_content).order_by('-created_at').first()
                if quoted:
                    logger.info(f'Inbound quote resolved by content match: -> message id={quoted.id}')
                    return quoted
            except Exception:
                pass

    logger.debug(
        f'Inbound quote: no matching message found for msgServerId={msg_server_id}, '
        f'contact={contact}'
    )
    return None


def _handle_miniprogram_message(data: dict, msg_data: dict, device, contact, room=None, conversation_type='personal'):
    """
    处理小程序消息（msgType=78）

    msgData 包含：appId, appName, title, desc, iconUrl, pagePath, username,
                  coverImageId/coverImageAesKey/coverImageMd5/coverImageSize 等。
    但封面图 URL 实际藏在 base64RawData 的 protobuf 中，需要额外提取并保存到
    raw_data['msgData']['thumbUrl']，供后续转发使用。
    """
    title = msg_data.get('title', '') or msg_data.get('appName', '') if isinstance(msg_data, dict) else ''
    app_name = msg_data.get('appName', '') if isinstance(msg_data, dict) else ''
    desc = msg_data.get('desc', '') if isinstance(msg_data, dict) else ''
    icon_url = msg_data.get('iconUrl', '') if isinstance(msg_data, dict) else ''
    page_path = msg_data.get('pagePath', '') if isinstance(msg_data, dict) else ''
    app_id = msg_data.get('appId', '') if isinstance(msg_data, dict) else ''

    # 从 base64RawData 提取封面图 URL
    thumb_url = _extract_miniprogram_thumb_url(data)
    if thumb_url:
        # 保存到 msgData，方便前端转发时直接读取
        if isinstance(data, dict):
            data = data.copy()
            msg_data_copy = msg_data.copy() if isinstance(msg_data, dict) else {}
            msg_data_copy['thumbUrl'] = thumb_url
            data['msgData'] = msg_data_copy

    content = title or app_name or '[小程序]'

    # 小程序图标作为媒体附件，方便前端直接展示
    media_file = None
    if icon_url:
        media_file = WecomMediaFile.objects.create(
            tenant=device.tenant,
            file_type='image',
            url=icon_url,
        )

    msg = WecomMessage.objects.create(
        tenant=device.tenant,
        device=device,
        contact=contact,
        room=room,
        conversation_type=conversation_type,
        direction='inbound',
        msg_type='miniprogram',
        content=content,
        media_file=media_file,
        raw_data=data,
        ai_generated=False,
    )
    logger.info(f'Inbound miniprogram saved: id={msg.id}, contact={contact}, title={title[:40]}, app={app_name[:40]}')

    # 触发 AI（告知客户发了小程序卡片）
    _trigger_ai_reply(msg)
    _publish_sse_message(msg)

    _dispatch_marketing_event(
        'message_received',
        tenant_id=device.tenant_id,
        contact_id=contact.id,
        device_id=device.id,
        event_data={'content': content, 'message_id': msg.id, 'msg_type': 'miniprogram'},
    )


def _handle_unknown_message(data: dict, msg_data: dict, device, contact, msg_type: int, room=None, conversation_type='personal'):
    """
    处理未知消息类型——保存原始数据但不解码 base64RawData 为文本
    """
    filename = msg_data.get('filename', '') if isinstance(msg_data, dict) else ''
    label = filename or f'未知消息(type={msg_type})'

    # === 智能降级：检测是否实际是表情/图片（有 fileHttpUrl 但 msgType 不在已知列表）===
    file_url = ''
    if isinstance(msg_data, dict):
        file_url = msg_data.get('fileHttpUrl', '') or msg_data.get('cdnUrl', '') or msg_data.get('cdnBigImgUrl', '')

    media_file = None
    if file_url:
        # 有图片 URL → 当作 emoji/图片 处理（更友好）
        media_file = WecomMediaFile.objects.create(
            tenant=device.tenant,
            file_type='image',
            url=file_url,
        )
        msg = WecomMessage.objects.create(
            tenant=device.tenant,
            device=device,
            contact=contact,
            room=room,
            conversation_type=conversation_type,
            direction='inbound',
            msg_type='image',
            content=f'[{label}]',
            media_file=media_file,
            raw_data=data,
            ai_generated=False,
        )
        logger.info(f'Unknown msgType={msg_type} routed to image (has fileHttpUrl): id={msg.id}, contact={contact}')
        _trigger_ai_reply(msg)
        _publish_sse_message(msg)
        return

    # 没有图片 URL → 保存为 unknown 类型（前端可显示为灰色提示）
    msg = WecomMessage.objects.create(
        tenant=device.tenant,
        device=device,
        contact=contact,
        room=room,
        conversation_type=conversation_type,
        direction='inbound',
        msg_type='unknown',
        content=f'[{label}]',
        raw_data=data,
        ai_generated=False,
    )
    logger.info(f'Unknown msgType={msg_type} saved: id={msg.id}, contact={contact}, label={label}, data={json.dumps(data, ensure_ascii=False)[:300]}')
    _publish_sse_message(msg)


def _handle_image_message(data: dict):
    """
    处理图片消息（cmd=20000）

    1. 下载/记录媒体文件
    2. 持久化 WecomMessage(direction=inbound, msg_type=image)
    3. 触发 AI 回复（图片场景 AI 回复"收到，请问有什么可以帮您？"类话术）
    """
    device, contact, room, conversation_type = _resolve_device_and_contact(data)
    if not device or not contact:
        return

    # === 视频消息检测 ===
    # QiWe cmd=20000 同时承载图片和视频消息，需区分：
    # - 图片：有 imageUrl 字段
    # - 视频：有 videoUrl / playLength / duration / videoSize 字段，或无 imageUrl 但有 fileId
    msg_type_val = data.get('msgType', 0)
    has_image_url = bool(data.get('imageUrl', '') or data.get('url', ''))
    has_video_url = bool(data.get('videoUrl', '') or data.get('fileUrl', ''))
    has_video_indicator = bool(
        data.get('playLength', 0) or data.get('duration', 0) or data.get('videoSize', 0)
    )

    is_video = (
        msg_type_val == 43
        or has_video_url
        or (has_video_indicator and not has_image_url)
        or (not has_image_url and bool(data.get('fileId', '') or data.get('aeskey', '')) and has_video_indicator)
    )

    if is_video:
        logger.info(f'cmd=20000 detected as video (msgType={msg_type_val}, hasVideoUrl={has_video_url}, hasIndicator={has_video_indicator}), routing to _handle_video_message')
        _handle_video_message(data, msg_data=None, device=device, contact=contact, room=room, conversation_type=conversation_type)
        return

    # 媒体文件信息
    file_id = data.get('fileId', '') or data.get('aeskey', '')
    image_url = data.get('imageUrl', '') or data.get('url', '')

    media_file = None
    if file_id or image_url:
        media_file = WecomMediaFile.objects.create(
            tenant=device.tenant,
            file_type='image',
            qiwe_file_id=file_id,
            url=image_url,
        )

    # 持久化消息
    msg = WecomMessage.objects.create(
        tenant=device.tenant,
        device=device,
        contact=contact,
        room=room,
        conversation_type=conversation_type,
        direction='inbound',
        msg_type='image',
        content=f'[图片] {image_url or file_id}',
        media_file=media_file,
        raw_data=data,
        ai_generated=False,
    )
    logger.info(f'Inbound image message saved: id={msg.id}, contact={contact}')

    # 图片消息也触发 AI（让 AI 知道客户发了图片，可以回复"好的，图片已收到"）
    _trigger_ai_reply(msg)
    _publish_sse_message(msg)

    # 分发营销事件
    _dispatch_marketing_event(
        'message_received',
        tenant_id=device.tenant_id,
        contact_id=contact.id,
        device_id=device.id,
        event_data={'content': '', 'message_id': msg.id, 'msg_type': 'image'},
    )


def _handle_contact_change(data: dict):
    """
    处理联系人变更（cmd=11016）

    更新 WecomContact（新增/修改/删除）

    真实 QiWe 格式字段：
    - guid: 设备 GUID
    - userId / externalUserId / external_userid: 变更的联系人 external_userid
    - changeType/type: delete/add/update
    """
    guid = data.get('guid', '')
    external_userid = (
        data.get('userId', '') or
        data.get('externalUserId', '') or
        data.get('external_userid', '') or
        data.get('fromId', '')
    )

    if not guid or not external_userid:
        logger.warning('Contact change event missing guid or external_userid')
        return

    try:
        device = WecomDevice.objects.get(guid=guid)
    except WecomDevice.DoesNotExist:
        logger.warning(f'Device not found for guid={guid}')
        return

    change_type = data.get('changeType', '') or data.get('type', '')

    if change_type == 'delete':
        WecomContact.objects.filter(
            external_userid=external_userid,
            device=device,
            tenant=device.tenant,
        ).delete()
        logger.info(f'Contact deleted: {external_userid} (device={device.id})')
        return

    # 新增或更新（按 external_userid + device 联合查找）
    raw_name = data.get('name', '') or data.get('nickname', '')
    remark_from_data = data.get('remark', '')
    if not raw_name or re.match(r'^\d{6,}$', str(raw_name)):
        raw_name = remark_from_data or f'用户{str(external_userid)[-6:]}'
    contact, created = WecomContact.objects.update_or_create(
        external_userid=external_userid,
        device=device,
        defaults={
            'tenant': device.tenant,
            'name': raw_name,
            'remark': remark_from_data,
            'avatar': data.get('avatar', ''),
            'enterprise_id': data.get('enterpriseId', '') or data.get('enterprise_id', ''),
        }
    )
    logger.info(f'Contact upserted: {external_userid} (created={created})')

    # 新联系人添加时分发事件
    if created:
        _dispatch_marketing_event(
            'contact_added',
            tenant_id=device.tenant_id,
            contact_id=contact.id,
            device_id=device.id,
            event_data={'name': contact.name, 'remark': contact.remark},
        )


def _handle_read_receipt(data: dict, device, contact, room, conversation_type: str):
    """
    处理已读回执通知（msgType=2001/2005）

    QiWe 在好友已读消息后回调此事件。
    将该会话中已发送但未读的 outbound 消息标记为 'read'，
    并通过 SSE 推送已读回执事件到前端。
    """
    if not device:
        return

    try:
        queryset = WecomMessage.objects.filter(
            tenant=device.tenant,
            device=device,
            direction='outbound',
            status__in=['sent', 'delivered'],
        )
        if room:
            queryset = queryset.filter(room=room)
        elif contact:
            queryset = queryset.filter(contact=contact)
        else:
            return

        updated = queryset.update(status='read')
        logger.info(f'Read receipt processed: msgType={data.get("msgType")}, updated={updated}, contact={contact}, room={room}')

        # Publish read receipt via SSE
        try:
            from . import sse as sse_module
            sse_module.publish_read_receipt(
                tenant_id=device.tenant_id,
                device_id=device.id,
                contact_id=contact.id if contact else None,
                room_id=room.id if room else None,
                conversation_type=conversation_type,
            )
        except Exception as e:
            logger.debug(f'SSE read receipt publish failed (non-critical): {e}')

    except Exception as e:
        logger.exception(f'Handle read receipt error: {e}')


def _handle_device_status(data: dict):
    """
    处理设备状态变更（cmd=15500）

    更新 WecomDevice.status（online/offline/banned）
    被封禁时暂停该设备下所有 AI 任务
    """
    guid = data.get('guid', '')
    if not guid:
        return

    try:
        device = WecomDevice.objects.get(guid=guid)
    except WecomDevice.DoesNotExist:
        logger.warning(f'Device not found for guid={guid}')
        return

    status_raw = str(data.get('status', '')).lower()
    status_map = {
        'online': 'online',
        'offline': 'offline',
        'banned': 'banned',
        '封禁': 'banned',
        '离线': 'offline',
        '在线': 'online',
    }
    new_status = status_map.get(status_raw, '')
    if not new_status:
        logger.warning(f'Unknown device status: {status_raw}')
        return

    old_status = device.status
    device.status = new_status
    device.last_heartbeat = timezone.now()

    # 被封禁时关闭设备级 AI
    if new_status == 'banned':
        device.ai_enabled = False
        logger.warning(f'Device {device.name} ({guid}) BANNED — AI disabled')

    device.save(update_fields=['status', 'last_heartbeat', 'ai_enabled', 'updated_at'])
    logger.info(f'Device status changed: {device.name} {old_status} -> {new_status}')


# ============================================================
# SSE 事件发布
# ============================================================

def _publish_sse_message(msg: WecomMessage):
    """
    通过 SSE 推送新消息事件到前端。
    非阻塞，失败时仅记录日志不影响主流程。
    """
    try:
        from . import sse as sse_module
        sse_module.publish_message_event(msg)
    except Exception as e:
        logger.debug(f'SSE message publish failed (non-critical): {e}')


# ============================================================
# AI 回复触发
# ============================================================

def _trigger_ai_reply(message: WecomMessage):
    """
    触发 AI 回复链路

    延迟导入避免循环依赖：wecom.webhook_handler → marketing_follow.ai_reply → wecom.models
    在 AI 回复生成前，通过 SSE 发布 typing 事件，前端显示"AI正在输入..."动画。
    """
    # Publish typing event via SSE before AI starts generating reply
    try:
        from . import sse as sse_module
        sse_module.publish_typing_event(
            tenant_id=message.tenant_id,
            device_id=message.device_id,
            contact_id=message.contact_id,
            room_id=message.room_id,
            conversation_type=message.conversation_type,
        )
    except Exception as e:
        logger.debug(f'SSE typing publish failed (non-critical): {e}')

    try:
        from apps.marketing_follow.ai_reply import generate_ai_reply
        generate_ai_reply(message.id)
    except ImportError as e:
        logger.error(f'Cannot import ai_reply module: {e}')
    except Exception as e:
        logger.exception(f'AI reply trigger failed for message {message.id}: {e}')


# ============================================================
# 营销事件分发
# ============================================================

def _dispatch_marketing_event(event_type: str, tenant_id: int, contact_id: int,
                              device_id: int = None, event_data: dict = None):
    """
    分发营销自动化事件到 EventDispatcher。

    延迟导入避免循环依赖：wecom.webhook_handler → marketing_follow.event_dispatcher → marketing_follow.models
    事件分发只创建 TaskExecution 记录，实际执行由 run_task_runner 轮询处理。
    """
    try:
        from apps.marketing_follow.event_dispatcher import dispatch_event
        count = dispatch_event(
            event_type=event_type,
            tenant_id=tenant_id,
            contact_id=contact_id,
            event_data=event_data,
            device_id=device_id,
        )
        if count:
            logger.info(f'Marketing event dispatched: type={event_type} tenant={tenant_id} tasks_created={count}')
    except ImportError:
        logger.debug('marketing_follow.event_dispatcher not available, skipping event dispatch')
    except Exception as e:
        logger.exception(f'Marketing event dispatch failed: {e}')
