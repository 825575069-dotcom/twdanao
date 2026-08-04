"""
apps/wecom/views.py
企微管理 API 视图
包含：设备绑定、联系人同步、消息发送/查询、标签管理、群聊管理
"""
import logging
import os
import re
import uuid
import json
import time
import queue as queue_module
from django.utils import timezone
from django.conf import settings
from django.http import StreamingHttpResponse, HttpResponse
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.platform.utils import api_success, api_error, API_CODE
from apps.platform.models import Tenant
from apps.platform.permissions import require_platform_permission
from .models import (
    WecomDevice, WecomContact, WecomMessage, WecomMediaFile,
    WecomGroupRoom, WecomTag, WecomTagGroup, MessageFavorite,
    WecomGlobalConfig, WecomNumber, WecomDraft,
)
from .serializers import (
    WecomDeviceSerializer, WecomContactSerializer, WecomMessageSerializer,
    WecomMediaFileSerializer, WecomGroupRoomSerializer, WecomTagSerializer,
    WecomTagGroupSerializer, MessageFavoriteSerializer,
    WecomGlobalConfigSerializer, WecomNumberSerializer, WecomDraftSerializer,
)
from .qiwei_client import QiWeiClient, get_qiwei_client, get_global_qiwei_client, QiWeiAPIError
from . import sse as sse_module

logger = logging.getLogger(__name__)


def _get_tenant(request):
    """从请求中获取租户"""
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return None


def _friendly_send_error(e):
    """
    将 QiWeiAPIError 转换为用户友好的错误消息。
    -4014: 该联系人是个人微信好友，企微不支持发送消息
    """
    if e.code == -4014:
        return '该联系人无法通过企微发送消息（可能是个人微信好友，需在微信中沟通）'
    return f'发送失败: {e.message}'


def _build_reply_data(quoted_msg, contact):
    """
    根据被引用的 WecomMessage 构建 QiWe sendText reply 参数。

    QiWe reply 参数结构:
    {
        'type': int (被引用消息类型: 0=文本, 14=图片, 15=文件, 16=语音, 23=视频, 29=表情),
        'msgServerId': int,
        'userId': str (发送者ID),
        'showName': str (显示名),
        'msgUniqueIdentifier': str,
        'msgData': dict (结构依 type 而定),
    }
    """
    # 消息类型映射 WecomMessage.msg_type → QiWe reply type
    MSG_TYPE_TO_REPLY_TYPE = {
        'text': 0,
        'image': 14,
        'file': 15,
        'voice': 16,
        'video': 23,
    }

    reply_type = MSG_TYPE_TO_REPLY_TYPE.get(quoted_msg.msg_type, 0)

    # 确定发送者 ID
    if quoted_msg.direction == 'inbound':
        user_id = quoted_msg.contact.external_userid
        show_name = quoted_msg.contact.remark or quoted_msg.contact.name
    else:
        # outbound 消息的发送者应填设备的 qw_user_id（企微自身的 user_id）
        user_id = quoted_msg.device.qw_user_id or ''
        show_name = quoted_msg.device.name

    # 构建 msgData
    msg_data = {}
    if quoted_msg.msg_type == 'text':
        msg_data = {'content': quoted_msg.content}
    elif quoted_msg.msg_type == 'image':
        media = quoted_msg.media_file
        msg_data = {
            'fileId': media.qiwe_file_id if media else '',
            'fileHttpUrl': media.url if media else '',
        }
    elif quoted_msg.msg_type == 'voice':
        msg_data = {'voiceTime': 0}
    elif quoted_msg.msg_type == 'file':
        media = quoted_msg.media_file
        msg_data = {
            'fileId': media.qiwe_file_id if media else '',
            'filename': '',
        }

    return {
        'type': reply_type,
        'msgServerId': quoted_msg.msg_server_id or 0,
        'userId': user_id,
        'showName': show_name,
        'msgUniqueIdentifier': quoted_msg.msg_unique_identifier or '',
        'msgData': msg_data,
    }


# ============================================================
# 设备管理
# ============================================================

class DeviceListCreateView(APIView):
    """设备列表 + 绑定新设备"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        devices = WecomDevice.objects.filter(tenant=tenant)
        serializer = WecomDeviceSerializer(devices, many=True)
        return api_success(serializer.data)

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        guid = request.data.get('guid', '').strip()
        name = request.data.get('name', '').strip()
        if not guid or not name:
            return api_error(API_CODE.BAD_REQUEST, '缺少 guid 或 name')

        # 检查是否已绑定
        if WecomDevice.objects.filter(guid=guid).exists():
            return api_error(API_CODE.BAD_REQUEST, '该设备GUID已被绑定')

        device = WecomDevice.objects.create(
            tenant=tenant,
            guid=guid,
            name=name,
            qw_user_id=request.data.get('qw_user_id', ''),
            qw_account=request.data.get('qw_account', ''),
            qiwe_token=request.data.get('qiwe_token', ''),
            province_code=request.data.get('province_code', ''),
            callback_url=request.data.get('callback_url', ''),
            ai_enabled=request.data.get('ai_enabled', True),
        )

        # 尝试检查设备实际在线状态
        status_checked = False
        status_error = ''
        try:
            client = get_qiwei_client(device)
            result = client.get_device_status(guid=device.guid)
            # QiWe /login/checkLogin 返回: { userId, nickname, userOnlineStatus, ... }
            # userOnlineStatus: -1=未登录, 0=可免扫码, 1=待确认, 2=登录成功,
            #                    4=取消登录, 10=待6位验证码
            online_status = result.get('userOnlineStatus', -1) if isinstance(result, dict) else -1
            if online_status == 2:
                device.status = 'online'
                device.qw_user_id = result.get('userId', '') or device.qw_user_id
                device.qw_account = result.get('nickname', '') or device.qw_account
                # 通过 batchGetUserinfo 获取个人头像（checkLogin 不返回个人头像）
                qw_uid = result.get('userId', '')
                if qw_uid:
                    try:
                        detail = client.get_contact_detail(user_id_list=[qw_uid], guid=device.guid)
                        contact_list = detail.get('contactList', []) if isinstance(detail, dict) else []
                        if contact_list:
                            avatar_url = contact_list[0].get('avatarUrl', '')
                            if avatar_url:
                                device.avatar = avatar_url.replace('http://', 'https://', 1)
                    except Exception as e:
                        logger.warning(f'获取设备头像失败 device={device.id}: {e}')
            elif online_status in (-1, 0, 1, 4, 10):
                device.status = 'offline'
            device.last_heartbeat = timezone.now()
            device.save(update_fields=['status', 'last_heartbeat', 'qw_user_id', 'qw_account', 'avatar'])
            status_checked = True
        except Exception as e:
            status_error = str(e)
            logger.warning(f'设备状态检查失败 device={device.id}: {e}')

        # 自动配置 Webhook 回调地址（所有设备共用，以 Token 为单位）
        callback_configured = False
        callback_error = ''
        try:
            client.set_callback(
                callback_url='https://twdanaob.88yldh.com/api/v1/wecom/webhook/',
            )
            device.callback_url = 'https://twdanaob.88yldh.com/api/v1/wecom/webhook/'
            device.save(update_fields=['callback_url'])
            callback_configured = True
        except Exception as e:
            callback_error = str(e)
            logger.warning(f'Webhook回调配置失败 device={device.id}: {e}')

        # 自动创建默认 ChatSetting（AI 回复链路依赖此记录）
        chat_setting_created = False
        try:
            from apps.marketing_follow.models import ChatSetting
            ChatSetting.objects.get_or_create(
                tenant=tenant,
                device=device,
                defaults={
                    'ai_enabled': True,
                    'reply_style': 'friendly',
                    'reply_length': 'short',
                    'customer_address': 'remark',
                    'ai_signature': False,
                    'quick_replies': [],
                    'forbidden_words': [],
                },
            )
            chat_setting_created = True
        except Exception as e:
            logger.warning(f'创建 ChatSetting 失败 device={device.id}: {e}')

        serializer = WecomDeviceSerializer(device)
        data = serializer.data
        data['status_checked'] = status_checked
        data['chat_setting_created'] = chat_setting_created
        data['callback_configured'] = callback_configured
        if status_error:
            data['status_error'] = status_error
        if callback_error:
            data['callback_error'] = callback_error
        return api_success(data, '设备绑定成功')


class DeviceDetailView(APIView):
    """设备详情 / 更新 / 删除"""

    def _get_device(self, tenant, device_id):
        try:
            return WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return None

    def get(self, request, device_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        device = self._get_device(tenant, device_id)
        if not device:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')
        serializer = WecomDeviceSerializer(device)
        return api_success(serializer.data)

    def put(self, request, device_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        device = self._get_device(tenant, device_id)
        if not device:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')

        for field in ['name', 'qw_user_id', 'qw_account', 'qiwe_token', 'callback_url', 'ai_enabled']:
            if field in request.data:
                setattr(device, field, request.data[field])
        device.save()
        serializer = WecomDeviceSerializer(device)
        return api_success(serializer.data, '更新成功')

    def delete(self, request, device_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        device = self._get_device(tenant, device_id)
        if not device:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')
        device.delete()
        return api_success(msg='设备已解绑')


class DeviceLogoutView(APIView):
    """设备退出登录 — 更新设备状态为离线"""

    def post(self, request, device_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            device = WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')
        device.status = 'offline'
        device.login_status = None
        device.save()
        return api_success(msg='设备已退出登录')


# ============================================================
# 设备登录流程（多步骤绑定）
# ============================================================

# 省份 areaCode 映射（31 个省/直辖市/自治区）
AREA_CODES = [
    {'code': '110000', 'name': '北京市'},
    {'code': '120000', 'name': '天津市'},
    {'code': '130000', 'name': '河北省'},
    {'code': '140000', 'name': '山西省'},
    {'code': '150000', 'name': '内蒙古自治区'},
    {'code': '210000', 'name': '辽宁省'},
    {'code': '220000', 'name': '吉林省'},
    {'code': '230000', 'name': '黑龙江省'},
    {'code': '310000', 'name': '上海市'},
    {'code': '320000', 'name': '江苏省'},
    {'code': '330000', 'name': '浙江省'},
    {'code': '340000', 'name': '安徽省'},
    {'code': '350000', 'name': '福建省'},
    {'code': '360000', 'name': '江西省'},
    {'code': '370000', 'name': '山东省'},
    {'code': '410000', 'name': '河南省'},
    {'code': '420000', 'name': '湖北省'},
    {'code': '430000', 'name': '湖南省'},
    {'code': '440000', 'name': '广东省'},
    {'code': '450000', 'name': '广西壮族自治区'},
    {'code': '460000', 'name': '海南省'},
    {'code': '500000', 'name': '重庆市'},
    {'code': '510000', 'name': '四川省'},
    {'code': '520000', 'name': '贵州省'},
    {'code': '530000', 'name': '云南省'},
    {'code': '540000', 'name': '西藏自治区'},
    {'code': '610000', 'name': '陕西省'},
    {'code': '620000', 'name': '甘肃省'},
    {'code': '630000', 'name': '青海省'},
    {'code': '640000', 'name': '宁夏回族自治区'},
    {'code': '650000', 'name': '新疆维吾尔自治区'},
]


class AreaCodeListView(APIView):
    """获取省份地区代码列表（设备归属省选择用）"""

    def get(self, request):
        return api_success(AREA_CODES)


class DeviceCreateClientView(APIView):
    """创建设备实例（登录步骤1）— 调用 QiWe createClient 获取 guid"""

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        qiwe_token = request.data.get('qiwe_token', '').strip()
        area_code = request.data.get('area_code', '').strip()

        if not qiwe_token:
            return api_error(API_CODE.BAD_REQUEST, '缺少 qiwe_token')
        if not area_code:
            return api_error(API_CODE.BAD_REQUEST, '缺少 area_code（设备归属省）')

        try:
            client = QiWeiClient(token=qiwe_token)
            result = client.create_client(area_code=int(area_code))
            guid = result.get('guid', '') if isinstance(result, dict) else ''
            if not guid:
                return api_error(API_CODE.INTERNAL_ERROR, '创建设备失败：未返回 guid')
            return api_success({'guid': guid}, '设备实例创建成功')
        except QiWeiAPIError as e:
            logger.error(f'createClient 失败: {e}')
            err_msg = e.message
            # 对常见错误添加友好提示
            if '上限' in err_msg:
                err_msg = f'{err_msg}。请前往 QiWe 平台释放已下线设备的登录名额，或使用新的 Token。'
            elif '不可用' in err_msg:
                err_msg = f'{err_msg}。请检查 Token 是否正确或联系管理员重新获取。'
            return api_error(API_CODE.INTERNAL_ERROR, f'创建设备失败: {err_msg}')
        except Exception as e:
            logger.error(f'createClient 异常: {e}')
            return api_error(API_CODE.INTERNAL_ERROR, f'创建设备异常: {str(e)}')


class DeviceGetQrcodeView(APIView):
    """获取企微登录二维码（登录步骤2）— 新架构使用全局 Token"""

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        guid = request.data.get('guid', '').strip()
        device_id = request.data.get('device_id')

        if not guid:
            return api_error(API_CODE.BAD_REQUEST, '缺少 guid')

        # 尝试获取已绑定的设备
        device = None
        if device_id:
            try:
                device = WecomDevice.objects.get(id=device_id, tenant=tenant)
            except WecomDevice.DoesNotExist:
                pass

        try:
            client = get_qiwei_client(device) if device else get_global_qiwei_client(guid=guid)
            result = client.get_login_qrcode(guid=guid)
            return api_success(result, '获取二维码成功')
        except QiWeiAPIError as e:
            logger.error(f'getLoginQrcode 失败: {e}')
            return api_error(API_CODE.INTERNAL_ERROR, f'获取二维码失败: {e.message}')
        except Exception as e:
            logger.error(f'getLoginQrcode 异常: {e}')
            return api_error(API_CODE.INTERNAL_ERROR, f'获取二维码异常: {str(e)}')


class DeviceCheckLoginView(APIView):
    """检查登录状态（登录步骤3）— 前端轮询调用，使用 checkLoginQrCode"""

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        guid = request.data.get('guid', '').strip()
        device_id = request.data.get('device_id')

        if not guid:
            return api_error(API_CODE.BAD_REQUEST, '缺少 guid')

        device = None
        if device_id:
            try:
                device = WecomDevice.objects.get(id=device_id, tenant=tenant)
            except WecomDevice.DoesNotExist:
                pass

        try:
            client = get_qiwei_client(device) if device else get_global_qiwei_client(guid=guid)
            result = client.check_login_qrcode(guid=guid)

            # 如果登录成功，更新设备信息
            login_status = result.get('loginQrcodeStatus', -1) if isinstance(result, dict) else -1
            if login_status == 2 and device:
                device.status = 'online'
                device.qw_user_id = result.get('userId', '') or device.qw_user_id
                device.qw_account = result.get('nickname', '') or device.qw_account
                device.login_status = 'success'
                device.bound_at = timezone.now()
                avatar_url = result.get('avatarUrl', '')
                if avatar_url:
                    device.avatar = avatar_url.replace('http://', 'https://', 1)
                device.last_heartbeat = timezone.now()
                device.save(update_fields=[
                    'status', 'qw_user_id', 'qw_account', 'login_status',
                    'bound_at', 'avatar', 'last_heartbeat',
                ])

            return api_success(result)
        except QiWeiAPIError as e:
            logger.error(f'checkLogin 失败: {e}')
            return api_error(API_CODE.INTERNAL_ERROR, f'检查登录状态失败: {e.message}')
        except Exception as e:
            logger.error(f'checkLogin 异常: {e}')
            return api_error(API_CODE.INTERNAL_ERROR, f'检查登录状态异常: {str(e)}')


class DeviceVerifyCodeView(APIView):
    """提交6位验证码（登录步骤4）— status=10 时前端调用"""

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        guid = request.data.get('guid', '').strip()
        code = request.data.get('code', '').strip()
        device_id = request.data.get('device_id')

        if not guid:
            return api_error(API_CODE.BAD_REQUEST, '缺少 guid')
        if not code:
            return api_error(API_CODE.BAD_REQUEST, '缺少验证码 code')

        device = None
        if device_id:
            try:
                device = WecomDevice.objects.get(id=device_id, tenant=tenant)
            except WecomDevice.DoesNotExist:
                pass

        try:
            client = get_qiwei_client(device) if device else get_global_qiwei_client(guid=guid)
            result = client.verify_login_qrcode(guid=guid, code=code)
            return api_success(result, '验证码已提交')
        except QiWeiAPIError as e:
            logger.error(f'verifyLoginQrcode 失败: {e}')
            return api_error(API_CODE.INTERNAL_ERROR, f'验证码验证失败: {e.message}')
        except Exception as e:
            logger.error(f'verifyLoginQrcode 异常: {e}')
            return api_error(API_CODE.INTERNAL_ERROR, f'验证码验证异常: {str(e)}')


# ============================================================
# 联系人管理
# ============================================================

class ContactListView(APIView):
    """联系人列表"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        device_id = request.query_params.get('device_id')
        search = request.query_params.get('search', '').strip()
        tag_ids = request.query_params.get('tag_ids', '').strip()
        untagged = request.query_params.get('untagged', '').strip().lower() == 'true'

        # 过滤掉群聊成员（不应出现在单聊列表），保留微信好友（企微添加的外部联系人可正常发送）
        contacts = WecomContact.objects.filter(tenant=tenant).exclude(contact_source='group_chat')
        # 防御：wecom+type=0 且无个人消息记录的可能是群成员被误标，排除
        from django.db.models import Exists, OuterRef
        _personal = WecomMessage.objects.filter(
            conversation_type='personal', contact=OuterRef('pk')
        )
        contacts = contacts.annotate(
            _has_personal_msg=Exists(_personal)
        ).exclude(
            contact_source='wecom',
            qiwe_contact_type=0,
            _has_personal_msg=False,
        )
        if device_id:
            contacts = contacts.filter(device_id=device_id)
        if search:
            from django.db.models import Q
            contacts = contacts.filter(
                Q(name__icontains=search) | Q(remark__icontains=search)
            )
        if untagged:
            contacts = contacts.filter(tags__isnull=True)
        elif tag_ids:
            from django.db.models import Q
            tag_id_list = [int(t) for t in tag_ids.split(',') if t.isdigit()]
            if tag_id_list:
                contacts = contacts.filter(tags__id__in=tag_id_list).distinct()

        # 批量注解最后一条消息（避免 N+1 查询），按 device 隔离防止串号
        from django.db.models import Subquery, OuterRef
        last_msg_qs = WecomMessage.objects.filter(
            contact=OuterRef('pk'),
            device=OuterRef('device')
        ).order_by('-created_at')
        contacts = contacts.annotate(
            last_message=Subquery(last_msg_qs.values('content')[:1]),
            last_message_time=Subquery(last_msg_qs.values('created_at')[:1]),
            last_message_type=Subquery(last_msg_qs.values('msg_type')[:1]),
        )

        # 排序：置顶在前（pinned_at 降序），然后按最后消息时间降序
        contacts = contacts.order_by('-is_pinned', '-pinned_at', '-last_message_time', '-updated_at')

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        total = contacts.count()
        contacts = contacts[(page - 1) * page_size: page * page_size]

        serializer = WecomContactSerializer(contacts, many=True)
        return api_success({
            'list': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
        })


class ContactDetailView(APIView):
    """联系人详情 + 更新"""

    def get(self, request, contact_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            contact = WecomContact.objects.get(id=contact_id, tenant=tenant)
        except WecomContact.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '联系人不存在')
        serializer = WecomContactSerializer(contact)
        return api_success(serializer.data)

    def put(self, request, contact_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            contact = WecomContact.objects.get(id=contact_id, tenant=tenant)
        except WecomContact.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '联系人不存在')

        for field in ['remark', 'ai_hosted', 'enterprise_id']:
            if field in request.data:
                setattr(contact, field, request.data[field])
        # 置顶/取消置顶
        if 'is_pinned' in request.data:
            new_pinned = bool(request.data['is_pinned'])
            if new_pinned and not contact.is_pinned:
                contact.is_pinned = True
                contact.pinned_at = timezone.now()
            elif not new_pinned and contact.is_pinned:
                contact.is_pinned = False
                contact.pinned_at = None
        contact.save()
        serializer = WecomContactSerializer(contact)
        return api_success(serializer.data, '更新成功')

    def delete(self, request, contact_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            contact = WecomContact.objects.get(id=contact_id, tenant=tenant)
        except WecomContact.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '联系人不存在')
        contact.delete()
        return api_success(msg='联系人已删除')


# ============================================================
# 消息管理
# ============================================================

class MessageListView(APIView):
    """消息列表（按联系人或群聊）"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        contact_id = request.query_params.get('contact_id')
        device_id = request.query_params.get('device_id')
        room_id = request.query_params.get('room_id')
        if not contact_id and not device_id and not room_id:
            return api_error(API_CODE.BAD_REQUEST, '缺少 contact_id、device_id 或 room_id')

        messages = WecomMessage.objects.filter(tenant=tenant).select_related('contact', 'room', 'device')
        if contact_id:
            messages = messages.filter(contact_id=contact_id)
        if device_id:
            messages = messages.filter(device_id=device_id)
        elif contact_id and not room_id:
            # 单聊消息：如果只传了 contact_id 没传 device_id，尝试从联系人记录获取 device_id
            try:
                contact = WecomContact.objects.get(id=contact_id, tenant=tenant)
                messages = messages.filter(device_id=contact.device_id)
            except WecomContact.DoesNotExist:
                pass
        if room_id:
            # 群聊消息过滤：按 room_id 筛选
            messages = messages.filter(room_id=room_id, conversation_type='group')
        else:
            # 未指定 room_id 时，默认只返回单聊消息（向后兼容）
            if not request.query_params.get('include_group'):
                messages = messages.filter(room__isnull=True)

        # 限制返回最近的消息
        limit = int(request.query_params.get('limit', 100))
        before_id = request.query_params.get('before_id')
        if before_id:
            messages = messages.filter(id__lt=before_id)
        messages = messages.order_by('-created_at')[:limit]

        serializer = WecomMessageSerializer(reversed(list(messages)), many=True)
        return api_success(serializer.data)


class MessageSendView(APIView):
    """手动发送消息（支持文本/图片/文件/语音/小程序，支持单聊和群聊）"""

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        # 兼容 JSON 和 multipart 两种请求
        contact_id = request.data.get('contact_id')
        room_id = request.data.get('room_id')  # 群聊 ID（WecomGroupRoom.id）
        msg_type = request.data.get('msg_type', 'text')
        content = request.data.get('content', '').strip()
        uploaded_file = request.FILES.get('file')
        # 乐观更新：前端生成的 UUID，用于匹配 sending→sent 状态变更
        client_msg_id_str = request.data.get('client_msg_id', '')
        client_msg_id = None
        if client_msg_id_str:
            try:
                client_msg_id = uuid.UUID(client_msg_id_str)
            except (ValueError, AttributeError):
                pass

        if not contact_id and not room_id:
            return api_error(API_CODE.BAD_REQUEST, '缺少 contact_id 或 room_id')
        # 文本消息需要 content；媒体消息需要 file
        if msg_type == 'text' and not content:
            return api_error(API_CODE.BAD_REQUEST, '缺少 content')
        if msg_type in ('image', 'file', 'voice') and not uploaded_file:
            return api_error(API_CODE.BAD_REQUEST, f'发送{msg_type}需要上传 file')

        # === 解析目标：群聊 or 单聊 ===
        contact = None
        room = None
        conversation_type = 'personal'

        if room_id:
            # 群聊消息
            try:
                room = WecomGroupRoom.objects.get(id=room_id, tenant=tenant)
            except WecomGroupRoom.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '群聊不存在')
            device = room.device
            if not device:
                return api_error(API_CODE.BAD_REQUEST, '群聊未关联设备')
            target_id = room.group_id  # QiWei 群消息目标是 group_id（roomId）
            conversation_type = 'group'
            logger.info(f'Sending group message: room={room.name}, group_id={room.group_id}')
        else:
            # 单聊消息（原有逻辑）
            try:
                contact = WecomContact.objects.get(id=contact_id, tenant=tenant)
            except WecomContact.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '联系人不存在')
            device = contact.device
            target_id = contact.external_userid

        client = get_qiwei_client(device)

        # ---- 小程序消息 ----
        if msg_type == 'miniprogram':
            app_id = request.data.get('app_id', '').strip()
            page_path = request.data.get('page_path', '').strip()
            if not app_id or not page_path:
                return api_error(API_CODE.BAD_REQUEST, '发送小程序需要 app_id 和 page_path')

            title = request.data.get('title', '').strip()
            app_name = request.data.get('app_name', '').strip()
            desc = request.data.get('desc', '').strip()
            icon_url = request.data.get('icon_url', '').strip()
            username = request.data.get('username', '').strip()
            thumb_url = request.data.get('thumb_url', '').strip()
            cover_image_id = request.data.get('cover_image_id', '').strip()
            cover_image_aes_key = request.data.get('cover_image_aes_key', '').strip()
            cover_image_md5 = request.data.get('cover_image_md5', '').strip()
            cover_image_size = int(request.data.get('cover_image_size', 0) or 0)

            try:
                # === 统一使用 sendGroupMsg (send_mini_program) ===
                # sendWeapp (/msg/sendWeapp) 接口对个微外部联系人不可靠，
                # sendGroupMsg 的 sendType=0=外部联系人 是 QiWe 推荐的外部消息发送方式。
                #
                # 如果有 thumb_url，先通过 upload_by_url 上传到 QiWe CDN 获取
                # fileId/fileAesKey/fileMd5/fileSize，再作为封面图参数传入。
                if thumb_url and not cover_image_id:
                    try:
                        upload_result = client.upload_by_url(
                            file_url=thumb_url,
                            filename='miniprogram_cover.jpg',
                            file_type=1,  # 1=图片
                            guid=device.guid,
                        )
                        cover_image_id = upload_result.get('fileId', '') or upload_result.get('fileid', '')
                        cover_image_aes_key = upload_result.get('fileAesKey', '') or upload_result.get('fileAeskey', '')
                        cover_image_md5 = upload_result.get('fileMd5', '') or upload_result.get('filemd5', '')
                        cover_image_size = upload_result.get('fileSize', 0) or upload_result.get('filesize', 0)
                        logger.info(f'Mini program cover uploaded: fileId={cover_image_id}, size={cover_image_size}')
                    except Exception as upload_err:
                        logger.warning(f'Failed to upload mini program cover image: {upload_err}, sending without cover')

                response = client.send_mini_program(
                    to_id=target_id,
                    app_id=app_id,
                    page_path=page_path,
                    title=title,
                    app_name=app_name,
                    desc=desc,
                    icon_url=icon_url,
                    username=username,
                    cover_image_id=cover_image_id,
                    cover_image_aes_key=cover_image_aes_key,
                    cover_image_md5=cover_image_md5,
                    cover_image_size=cover_image_size,
                    guid=device.guid,
                )
            except QiWeiAPIError as e:
                logger.error(f'发送小程序失败: {e}')
                return api_error(API_CODE.INTERNAL_ERROR, _friendly_send_error(e))

            msg_server_id = response.get('msgServerId') or response.get('msgserverid')
            msg_unique_id = response.get('msgUniqueIdentifier') or response.get('msguniqueidentifier') or ''
            display_content = title or app_name or '[小程序]'

            msg = WecomMessage.objects.create(
                tenant=tenant, device=device, contact=contact,
                room=room, conversation_type=conversation_type,
                direction='outbound', msg_type='miniprogram',
                content=display_content,
                raw_data={
                    'msgData': {
                        'appId': app_id,
                        'appName': app_name,
                        'title': title,
                        'desc': desc,
                        'iconUrl': icon_url,
                        'pagePath': page_path,
                        'username': username,
                        'thumbUrl': thumb_url,
                        'coverImageId': cover_image_id,
                        'coverImageAesKey': cover_image_aes_key,
                        'coverImageMd5': cover_image_md5,
                        'coverImageSize': cover_image_size,
                    }
                },
                ai_generated=False,
                msg_server_id=msg_server_id,
                msg_unique_identifier=msg_unique_id,
                client_msg_id=client_msg_id,
                status='sent',
            )
            if contact:
                contact.last_contacted_at = timezone.now()
                contact.save(update_fields=['last_contacted_at'])
            serializer = WecomMessageSerializer(msg)
            sse_module.publish_message_event(msg)
            return api_success(serializer.data, '发送成功')

        # ---- 文本消息（含 emoji） ----
        if msg_type == 'text':
            # 处理引用消息
            quoted_message = None
            quoted_message_id = request.data.get('quoted_message_id')
            reply_data = None
            if quoted_message_id:
                try:
                    quoted_message = WecomMessage.objects.get(
                        id=quoted_message_id, tenant=tenant, contact=contact
                    )
                    # 构建 QiWe reply 参数
                    reply_data = _build_reply_data(quoted_message, contact)
                except WecomMessage.DoesNotExist:
                    pass  # 引用消息不存在时静默忽略

            try:
                response = client.send_text(
                    target_id, content, guid=device.guid,
                    reply=reply_data,
                )
            except QiWeiAPIError as e:
                logger.error(f'发送文本失败: {e}')
                return api_error(API_CODE.INTERNAL_ERROR, _friendly_send_error(e))

            # 保存 QiWe 返回的消息标识
            msg_server_id = response.get('msgServerId') or response.get('msgserverid')
            msg_unique_id = response.get('msgUniqueIdentifier') or response.get('msguniqueidentifier') or ''

            msg = WecomMessage.objects.create(
                tenant=tenant, device=device, contact=contact,
                room=room, conversation_type=conversation_type,
                direction='outbound', msg_type='text',
                content=content, ai_generated=False,
                quoted_message=quoted_message,
                msg_server_id=msg_server_id,
                msg_unique_identifier=msg_unique_id,
                client_msg_id=client_msg_id,
                status='sent',
            )
            if contact:
                contact.last_contacted_at = timezone.now()
                contact.save(update_fields=['last_contacted_at'])
            serializer = WecomMessageSerializer(msg)
            sse_module.publish_message_event(msg)
            return api_success(serializer.data, '发送成功')

        # ---- 媒体消息（图片/文件/语音） ----
        # 1) 保存文件到 media/wecom/uploads/
        ext = os.path.splitext(uploaded_file.name)[1] or ''
        safe_name = f'{uuid.uuid4().hex}{ext}'
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'wecom', 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, safe_name)
        with open(file_path, 'wb') as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)

        # 1.5) 语音消息：将 WebM 转换为 AMR + MP3
        # AMR: 供 QiWei API 发送给企微好友（WeChat 标准 8kHz 格式）
        # MP3: 供浏览器/Electron 播放（WebM/Opus 在 Safari 不支持，MP3 通用兼容）
        playable_name = None  # 浏览器可播放的文件名（MP3 优先，WebM 兜底）
        if msg_type == 'voice':
            try:
                import imageio_ffmpeg
                import subprocess
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                amr_name = f'{uuid.uuid4().hex}.amr'
                amr_path = os.path.join(upload_dir, amr_name)
                # 转换为 AMR-NB 8kHz mono（WeChat 标准语音格式）
                # 音频预处理：
                #   afftdn=nr=25:nt=s → FFT 自适应降噪（speech 模式），减少背景噪音
                #   highpass=200,lowpass=3400 → 限制到语音频段，AMR-NB 专为 300-3400Hz 设计
                #   volume=1.5 → 适度增益（3.0 会导致削波→AMR 编码产静电噪声）
                #   afade=t=in:d=0.05 → 50ms 淡入消除浏览器录制起始噪点
                result = subprocess.run(
                    [ffmpeg_exe, '-y', '-i', file_path,
                     '-af', 'afftdn=nr=25:nt=s,highpass=f=200,lowpass=f=3400,volume=1.5,afade=t=in:d=0.05',
                     '-c:a', 'libopencore_amrnb', '-ar', '8000', '-ac', '1', '-ab', '12.2k',
                     amr_path],
                    capture_output=True, timeout=30,
                )
                if result.returncode == 0 and os.path.exists(amr_path) and os.path.getsize(amr_path) > 0:
                    # AMR 转换成功
                    # 额外生成 MP3 供浏览器播放（Safari 不支持 WebM/Opus）
                    mp3_name = f'{uuid.uuid4().hex}.mp3'
                    mp3_path = os.path.join(upload_dir, mp3_name)
                    result_mp3 = subprocess.run(
                        [ffmpeg_exe, '-y', '-i', file_path,
                         '-af', 'afftdn=nr=20:nt=s,highpass=f=80,volume=1.2,afade=t=in:d=0.03',
                         '-c:a', 'libmp3lame', '-ar', '24000', '-ac', '1', '-ab', '32k',
                         mp3_path],
                        capture_output=True, timeout=30,
                    )
                    if result_mp3.returncode == 0 and os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
                        playable_name = mp3_name  # MP3 优先用于浏览器播放
                        os.remove(file_path)  # 删除原始 WebM，节省空间
                        logger.info(f'语音转换成功: WebM→AMR({amr_path}) + MP3({mp3_path})')
                    else:
                        playable_name = safe_name  # MP3 失败，保留 WebM 兜底
                        logger.warning(f'MP3转换失败，使用WebM兜底: {result_mp3.stderr.decode()[-200:]}')
                    safe_name = amr_name   # 后续 QiWei upload/send 使用 AMR
                    file_path = amr_path
                    uploaded_file_name = amr_name
                else:
                    logger.warning(f'AMR转换失败，使用原始文件: {result.stderr.decode()[-200:]}')
                    uploaded_file_name = uploaded_file.name
            except Exception as e:
                logger.warning(f'语音转换异常，使用原始文件: {e}')
                uploaded_file_name = uploaded_file.name
        else:
            uploaded_file_name = uploaded_file.name

        # 2) 构造公开可访问的 URL
        file_url = request.build_absolute_uri(
            f'{settings.MEDIA_URL}wecom/uploads/{safe_name}'
        )

        # 3) fileType 映射: 1=图片, 5=语音/文件（fileType=3是视频缩略图，不适用于语音）
        file_type_map = {'image': 1, 'voice': 5, 'file': 5}
        qiwe_file_type = file_type_map.get(msg_type, 5)

        # 4) 调用 QiWe upload_by_url 获取 fileId
        try:
            upload_result = client.upload_by_url(
                file_url=file_url,
                filename=uploaded_file_name,
                file_type=qiwe_file_type,
                guid=device.guid,
            )
        except QiWeiAPIError as e:
            logger.error(f'QiWe 上传文件失败: {e}')
            # 清理本地文件
            try:
                os.remove(file_path)
            except OSError:
                pass
            return api_error(API_CODE.INTERNAL_ERROR, f'文件上传失败: {e.message}')

        file_id = upload_result.get('fileId', '')
        file_aes_key = upload_result.get('fileAesKey', '')
        file_md5 = upload_result.get('fileMd5', '')
        file_size = upload_result.get('fileSize') or os.path.getsize(file_path)
        cloud_url = upload_result.get('cloudUrl', '')

        if not file_id:
            logger.error(f'QiWe 上传返回无 fileId: {upload_result}')
            return api_error(API_CODE.INTERNAL_ERROR, '文件上传失败: 未获取到 fileId')

        # 5) 调用对应的发送接口，并捕获 msgServerId 供后续撤回使用
        send_response = {}
        try:
            if msg_type == 'image':
                send_response = client.send_image(
                    to_id=target_id,
                    file_aes_key=file_aes_key,
                    file_id=file_id,
                    file_md5=file_md5,
                    file_size=file_size,
                    filename=uploaded_file.name,
                    guid=device.guid,
                )
            elif msg_type == 'file':
                send_response = client.send_file(
                    to_id=target_id,
                    file_aes_key=file_aes_key,
                    file_id=file_id,
                    file_size=file_size,
                    filename=uploaded_file.name,
                    guid=device.guid,
                )
            elif msg_type == 'voice':
                # voice_time 从前端传入（秒），默认 0
                voice_time = int(request.data.get('voice_time', 0))
                send_response = client.send_voice(
                    to_id=target_id,
                    file_aes_key=file_aes_key,
                    file_id=file_id,
                    file_size=file_size,
                    voice_time=voice_time,
                    guid=device.guid,
                )
        except QiWeiAPIError as e:
            logger.error(f'QiWe 发送{msg_type}失败: {e}')
            return api_error(API_CODE.INTERNAL_ERROR, _friendly_send_error(e))

        # 提取 QiWe 返回的消息标识（供撤回使用）
        msg_server_id = send_response.get('msgServerId') or send_response.get('msgserverid')
        msg_unique_identifier = send_response.get('msgUniqueIdentifier') or send_response.get('msguniqueidentifier') or ''

        # 6) 创建 WecomMediaFile 记录
        # 语音消息：使用 MP3（或 WebM 兜底）供浏览器播放
        # 使用 SITE_BASE_URL 构造绝对 URL（与 webhook_handler 一致），确保 HTTPS
        if msg_type == 'voice' and playable_name:
            base_url = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
            if base_url:
                browser_url = f'{base_url}{settings.MEDIA_URL}wecom/uploads/{playable_name}'
            else:
                browser_url = request.build_absolute_uri(
                    f'{settings.MEDIA_URL}wecom/uploads/{playable_name}'
                )
            logger.info(f'语音消息 browser_url: {browser_url}')
            media_file = WecomMediaFile.objects.create(
                tenant=tenant,
                file_type=msg_type,
                qiwe_file_id=file_id,
                local_path=f'wecom/uploads/{playable_name}',
                url=browser_url,
            )
        else:
            media_file = WecomMediaFile.objects.create(
                tenant=tenant,
                file_type=msg_type,
                qiwe_file_id=file_id,
                local_path=f'wecom/uploads/{safe_name}',
                url=cloud_url or file_url,
            )

        # 7) 创建 WecomMessage 记录（保存 msg_server_id 供撤回使用）
        if msg_type == 'voice':
            voice_time = int(request.data.get('voice_time', 0))
            display_content = f'[语音] {voice_time}秒' if voice_time else '[语音]'
        else:
            display_content = {
                'image': '[图片]',
                'file': uploaded_file.name,
            }.get(msg_type, '')

        msg = WecomMessage.objects.create(
            tenant=tenant, device=device, contact=contact,
            room=room, conversation_type=conversation_type,
            direction='outbound', msg_type=msg_type,
            content=display_content, media_file=media_file,
            ai_generated=False,
            msg_server_id=msg_server_id,
            msg_unique_identifier=msg_unique_identifier,
            client_msg_id=client_msg_id,
            status='sent',
        )
        if contact:
            contact.last_contacted_at = timezone.now()
            contact.save(update_fields=['last_contacted_at'])

        serializer = WecomMessageSerializer(msg)
        sse_module.publish_message_event(msg)
        return api_success(serializer.data, '发送成功')


# ============================================================
# 标签管理（含标签分组）
# ============================================================

class TagGroupListCreateView(APIView):
    """标签分组列表 + 创建"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        device_id = request.query_params.get('device_id')
        groups = WecomTagGroup.objects.filter(tenant=tenant)
        if device_id:
            groups = groups.filter(device_id=device_id)
        serializer = WecomTagGroupSerializer(groups, many=True)
        return api_success(serializer.data)

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        name = request.data.get('name', '').strip()
        if not name:
            return api_error(API_CODE.BAD_REQUEST, '缺少分组名称')

        device_id = request.data.get('device_id')
        device = None
        if device_id:
            try:
                device = WecomDevice.objects.get(id=device_id, tenant=tenant)
            except WecomDevice.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '设备不存在')

        group = WecomTagGroup.objects.create(
            tenant=tenant,
            device=device,
            group_id=request.data.get('group_id', ''),
            name=name,
            order=request.data.get('order', 0),
            is_customer_level=bool(request.data.get('is_customer_level', False)),
        )
        serializer = WecomTagGroupSerializer(group)
        return api_success(serializer.data, '标签分组创建成功')


class TagGroupDetailView(APIView):
    """标签分组详情 / 更新 / 删除"""

    def put(self, request, group_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            group = WecomTagGroup.objects.get(id=group_id, tenant=tenant)
        except WecomTagGroup.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '标签分组不存在')

        for field in ['name', 'order', 'is_customer_level', 'group_id']:
            if field in request.data:
                setattr(group, field, request.data[field])
        group.save()
        serializer = WecomTagGroupSerializer(group)
        return api_success(serializer.data, '更新成功')

    def delete(self, request, group_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            group = WecomTagGroup.objects.get(id=group_id, tenant=tenant)
        except WecomTagGroup.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '标签分组不存在')
        group.delete()
        return api_success(msg='标签分组已删除')


class TagListCreateView(APIView):
    """标签列表 + 创建"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        device_id = request.query_params.get('device_id')
        group_id = request.query_params.get('group_id')
        tags = WecomTag.objects.filter(tenant=tenant)
        if device_id:
            tags = tags.filter(device_id=device_id)
        if group_id:
            tags = tags.filter(group_id=group_id)
        serializer = WecomTagSerializer(tags, many=True)
        return api_success(serializer.data)

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        name = request.data.get('name', '').strip()
        if not name:
            return api_error(API_CODE.BAD_REQUEST, '缺少标签名称')

        device_id = request.data.get('device_id')
        device = None
        if device_id:
            try:
                device = WecomDevice.objects.get(id=device_id, tenant=tenant)
            except WecomDevice.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '设备不存在')

        group = None
        group_id = request.data.get('group_id')
        if group_id:
            try:
                group = WecomTagGroup.objects.get(id=group_id, tenant=tenant)
                if device and group.device and group.device_id != device.id:
                    return api_error(API_CODE.BAD_REQUEST, '标签分组不属于该设备')
            except WecomTagGroup.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '标签分组不存在')

        tag = WecomTag.objects.create(
            tenant=tenant,
            device=device,
            group=group,
            tag_id=request.data.get('tag_id', ''),
            name=name,
            color=request.data.get('color', '#1890ff'),
            order=request.data.get('order', 0),
            is_customer_level=bool(request.data.get('is_customer_level', False)),
        )
        serializer = WecomTagSerializer(tag)
        return api_success(serializer.data, '标签创建成功')


class TagDetailView(APIView):
    """标签详情 / 更新 / 删除"""

    def get(self, request, tag_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            tag = WecomTag.objects.get(id=tag_id, tenant=tenant)
        except WecomTag.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '标签不存在')
        serializer = WecomTagSerializer(tag)
        return api_success(serializer.data)

    def put(self, request, tag_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            tag = WecomTag.objects.get(id=tag_id, tenant=tenant)
        except WecomTag.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '标签不存在')

        for field in ['name', 'color', 'tag_id', 'order', 'is_customer_level']:
            if field in request.data:
                setattr(tag, field, request.data[field])
        if 'group_id' in request.data:
            group_id = request.data['group_id']
            if group_id:
                try:
                    group = WecomTagGroup.objects.get(id=group_id, tenant=tenant)
                    tag.group = group
                except WecomTagGroup.DoesNotExist:
                    return api_error(API_CODE.NOT_FOUND, '标签分组不存在')
            else:
                tag.group = None
        tag.save()
        serializer = WecomTagSerializer(tag)
        return api_success(serializer.data, '更新成功')

    def delete(self, request, tag_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            tag = WecomTag.objects.get(id=tag_id, tenant=tenant)
        except WecomTag.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '标签不存在')
        tag.delete()
        return api_success(msg='标签已删除')


class ContactTagsUpdateView(APIView):
    """批量更新联系人标签"""

    def put(self, request, contact_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            contact = WecomContact.objects.get(id=contact_id, tenant=tenant)
        except WecomContact.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '联系人不存在')

        tag_ids = request.data.get('tag_ids', [])
        if not isinstance(tag_ids, list):
            return api_error(API_CODE.BAD_REQUEST, 'tag_ids 应为数组')

        valid_tags = WecomTag.objects.filter(id__in=tag_ids, tenant=tenant)
        contact.tags.set(valid_tags)
        contact.save()

        serializer = WecomContactSerializer(contact)
        return api_success(serializer.data, '标签更新成功')


class GroupRoomTagsUpdateView(APIView):
    """批量更新群聊标签"""

    def put(self, request, group_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            group = WecomGroupRoom.objects.get(id=group_id, tenant=tenant)
        except WecomGroupRoom.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '群聊不存在')

        tag_ids = request.data.get('tag_ids', [])
        if not isinstance(tag_ids, list):
            return api_error(API_CODE.BAD_REQUEST, 'tag_ids 应为数组')

        valid_tags = WecomTag.objects.filter(id__in=tag_ids, tenant=tenant)
        group.tags.set(valid_tags)
        group.save()

        serializer = WecomGroupRoomSerializer(group)
        return api_success(serializer.data, '标签更新成功')


# ============================================================
# 群聊管理
# ============================================================

class GroupRoomListView(APIView):
    """群聊列表"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        device_id = request.query_params.get('device_id')
        search = request.query_params.get('search', '').strip()
        tag_ids = request.query_params.get('tag_ids', '').strip()
        untagged = request.query_params.get('untagged', '').strip().lower() == 'true'

        groups = WecomGroupRoom.objects.filter(tenant=tenant)
        if device_id:
            groups = groups.filter(device_id=device_id)
        if search:
            groups = groups.filter(name__icontains=search)
        if untagged:
            groups = groups.filter(tags__isnull=True)
        elif tag_ids:
            tag_id_list = [int(t) for t in tag_ids.split(',') if t.isdigit()]
            if tag_id_list:
                groups = groups.filter(tags__id__in=tag_id_list).distinct()

        # 批量注解最后一条消息（避免 N+1 查询），按 device 隔离防止串号
        from django.db.models import Subquery, OuterRef
        last_msg_qs = WecomMessage.objects.filter(
            room_id=OuterRef('id'),
            tenant=tenant,
        ).order_by('-created_at')
        groups = groups.annotate(
            last_message=Subquery(last_msg_qs.values('content')[:1]),
            last_message_time=Subquery(last_msg_qs.values('created_at')[:1]),
            last_message_type=Subquery(last_msg_qs.values('msg_type')[:1]),
        )

        serializer = WecomGroupRoomSerializer(groups, many=True)
        return api_success(serializer.data)


class GroupRoomMembersView(APIView):
    """获取群成员详情列表

    返回群内所有成员的联系人信息（不按 contact_source 过滤，包括 wechat 微信好友、
    wecom 企微同事、group_chat 群聊成员、unknown 未知），用于前端展示真实姓名和头像。
    """

    def get(self, request, room_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        try:
            room = WecomGroupRoom.objects.get(id=room_id, tenant=tenant)
        except WecomGroupRoom.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '群聊不存在')

        member_ids = room.member_user_ids or []
        if not member_ids:
            return api_success({
                'room_id': room.id,
                'group_id': room.group_id,
                'name': room.name,
                'owner_id': room.owner_id,
                'member_count': room.member_count,
                'members': [],
            })

        # 一次查询取出所有成员的联系人记录（按 device 隔离 + 排除当前群聊占位的同 device 同 id 重复）
        contacts = WecomContact.objects.filter(
            tenant=tenant,
            device=room.device,
            external_userid__in=member_ids,
        )
        # 按 external_userid 建索引，便于排序时回填
        contact_map = {c.external_userid: c for c in contacts}

        members = []
        for uid in member_ids:
            c = contact_map.get(uid)
            if c:
                members.append({
                    'external_userid': uid,
                    'contact_id': c.id,
                    'name': c.remark or c.name or f'用户{uid[-6:]}',
                    'avatar': c.avatar or '',
                    'contact_source': c.contact_source,
                    'is_external': c.contact_source in ('wechat', 'group_chat', 'unknown'),
                    'is_owner': (uid == room.owner_id),
                })
            else:
                # 本地没有联系人记录（极少见，群成员未触发过任何消息）
                members.append({
                    'external_userid': uid,
                    'contact_id': None,
                    'name': f'用户{uid[-6:]}',
                    'avatar': '',
                    'contact_source': 'unknown',
                    'is_external': True,
                    'is_owner': (uid == room.owner_id),
                })

        return api_success({
            'room_id': room.id,
            'group_id': room.group_id,
            'name': room.name,
            'owner_id': room.owner_id,
            'member_count': room.member_count,
            'members': members,
        })


# ============================================================
# 同步操作
# ============================================================

class SyncContactsView(APIView):
    """从 QiWe 同步好友/同事/群聊（基于会话接口重建）"""

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        device_id = request.data.get('device_id')
        if not device_id:
            return api_error(API_CODE.BAD_REQUEST, '缺少 device_id')

        try:
            device = WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')

        client = get_qiwei_client(device)

        # 设备所属企业 corpId（用于判定 contact 是内部同事 vs 外部客户）
        # 之前未定义（隐藏 NameError），统一从 device.qw_user_id 的联系人详情中拉取
        device_corp_id = ''
        try:
            if device.qw_user_id:
                _me_detail = client.get_contact_detail(
                    user_id_list=[device.qw_user_id], guid=device.guid,
                )
                _me_list = _me_detail.get('contactList', []) if isinstance(_me_detail, dict) else []
                if _me_list:
                    device_corp_id = str(_me_list[0].get('corpId', '') or '').strip()
                    logger.info(f'Got device_corp_id={device_corp_id} from self detail')
        except Exception as e:
            logger.warning(f'Failed to fetch device_corp_id, fallback to empty: {e}')

        # === 1. 双路拉取联系人源（严格按 QiWe API 语义） ===
        # 1a. /contact/getWxContactList bizType=1 — 我的客户（外部联系人）← 唯一微信好友来源
        # 1b. /contact/getWxContactList bizType=2 — 内部企微同事
        # 重要：bizType=1 不是"会话中所有微信用户"，而是真正的"我的客户"列表
        # 之前错误地从 /session/getSessionPage sessionType=0 同步联系人，
        # 导致大量"非客户但聊过天的人"被污染进 wechat 列表（contact_type=0）
        # 修复后：只同步 bizType=1/2 两个权威来源，sessionType=0 仅用于消息加载

        # 1a. 我的客户（bizType=1）
        wechat_friend_list = []  # [{userId, nickname, contactType, ...}]
        try:
            result = client._call('/contact/getWxContactList', {
                'guid': device.guid, 'bizType': 1, 'limit': 1000, 'seq': 0,
            })
            wechat_friend_list = result.get('contactList', []) if isinstance(result, dict) else []
        except QiWeiAPIError as e:
            logger.warning(f'getWxContactList bizType=1 failed: {e}')

        # 1c. bizType=2 — 内部企微同事
        internal_colleague_list = []
        try:
            result = client._call('/contact/getWxContactList', {
                'guid': device.guid, 'bizType': 2, 'limit': 1000, 'seq': 0,
            })
            internal_colleague_list = result.get('contactList', []) if isinstance(result, dict) else []
        except QiWeiAPIError as e:
            logger.warning(f'getWxContactList bizType=2 failed: {e}')

        logger.info(
            f'Sync sources: device={device.id}, '
            f'wechat_customers={len(wechat_friend_list)}, internal_colleagues={len(internal_colleague_list)}'
        )

        # === 2. 直接同步客户/同事（不再用 batchGetUserinfo） ===
        # 根因修复：bizType=1 (我的客户) 和 bizType=2 (内部同事) 已经包含完整字段
        # (userId, nickname, avatar, contactType)，直接 update_or_create 即可
        # 旧版错误地依赖 batchGetUserinfo 二次拉详情，但该接口不返回 contactType，
        # 导致无法区分客户 vs 同事，最终全部被标为 wechat
        # 进一步修复：不再从 sessionType=0 同步联系人，避免"非客户但聊过天的人"被污染
        contacts_created = 0
        contacts_updated = 0
        processed_uids_2a = set()  # 记录 2a 处理过的 userId，防止 2b 覆盖

        # 2a. 同步我的客户（bizType=1 → contact_source='wechat'）
        for c in wechat_friend_list:
            uid = str(c.get('userId', ''))
            if not uid or uid == '0':
                continue
            processed_uids_2a.add(uid)
            nickname = (c.get('nickname', '') or '').strip()
            remark = (c.get('remark', '') or '').strip()
            avatar = (c.get('avatarUrl', '') or '').replace('http://', 'https://', 1)
            contact_type = int(c.get('contactType', 0) or 0)
            # bizType=1 返回的都是我的客户（外部联系人），contactType 通常是 2057
            display_name = nickname or remark or f'用户{uid[-6:]}'
            obj, was_created = WecomContact.objects.update_or_create(
                external_userid=uid,
                device=device,
                defaults={
                    'tenant': tenant,
                    'name': display_name,
                    'remark': remark,
                    'avatar': avatar,
                    'enterprise_id': '',
                    'contact_source': 'wechat',
                    'qiwe_contact_type': contact_type,
                },
            )
            if was_created:
                contacts_created += 1
            else:
                contacts_updated += 1

        # 2b. 同步内部同事（bizType=2 → contact_source='wecom'）
        # 注意：bizType=2 与 bizType=1 有 userId 重叠，Step 2a 已处理过的不要覆盖
        for c in internal_colleague_list:
            uid = str(c.get('userId', ''))
            if not uid or uid == '0':
                continue
            if uid in processed_uids_2a:
                continue  # 跳过 2a 已处理的，避免 wechat → wecom 覆盖
            # bizType=2 接口的字段可能跟 bizType=1 不同
            nickname = (c.get('nickname', '') or c.get('name', '') or '').strip()
            remark = (c.get('remark', '') or '').strip()
            avatar = (c.get('avatarUrl', '') or '').replace('http://', 'https://', 1)
            display_name = nickname or remark or f'同事{uid[-6:]}'
            obj, was_created = WecomContact.objects.update_or_create(
                external_userid=uid,
                device=device,
                defaults={
                    'tenant': tenant,
                    'name': display_name,
                    'remark': remark,
                    'avatar': avatar,
                    'enterprise_id': '',
                    'contact_source': 'wecom',
                    'qiwe_contact_type': 0,
                },
            )
            if was_created:
                contacts_created += 1
            else:
                contacts_updated += 1

        logger.info(
            f'Sync contacts done: device={device.id}, '
            f'created={contacts_created}, updated={contacts_updated}'
        )

        # === 3. 拉取群聊列表（独立调用，仅用于群同步） ===
        # 联系人同步只用 bizType=1/2（见 Step 2），这里只需要 sessionType=1 的 roomIds
        session_room_ids = []
        current_seq = 0
        while True:
            try:
                result = client.get_session_list(
                    current_seq=current_seq, guid=device.guid,
                )
            except QiWeiAPIError as e:
                logger.warning(f'get_session_list (for groups) failed device={device.id}: {e}')
                break
            sessions = result.get('sessionList', []) if isinstance(result, dict) else []
            if not sessions:
                break
            for s in sessions:
                sid = str(s.get('sessionId', ''))
                stype = s.get('sessionType', -1)
                if stype == 1 and sid:  # 群聊会话
                    session_room_ids.append(sid)
            has_more = result.get('hasMore', 0) if isinstance(result, dict) else 0
            next_seq = result.get('currentSeq', 0) if isinstance(result, dict) else 0
            if not has_more or next_seq <= current_seq:
                break
            current_seq = next_seq
        session_room_ids = list(set(session_room_ids))
        logger.info(f'Sync groups: {len(session_room_ids)} rooms from sessions')

        # === 4. 批量获取群详情（群名/成员列表） ===
        groups_created = 0
        groups_updated = 0
        all_group_member_ids = []  # 全部群的成员 userId 集合

        if session_room_ids:
            BATCH = 50
            for i in range(0, len(session_room_ids), BATCH):
                batch_ids = session_room_ids[i:i+BATCH]
                try:
                    detail = client.get_group_members(
                        room_id_list=batch_ids, guid=device.guid,
                    )
                except QiWeiAPIError as e:
                    logger.warning(f'batchGetRoomDetail failed batch={i}: {e}')
                    continue

                room_list = detail.get('roomList', []) if isinstance(detail, dict) else []
                returned_room_ids = set()
                for item in room_list:
                    room_id = str(item.get('roomId', ''))
                    if not room_id:
                        continue
                    returned_room_ids.add(room_id)

                    name = (item.get('roomName', '') or '').strip()
                    owner_id = (item.get('roomCreateUserId', '') or
                                item.get('roomOwnerId', '') or '').strip()
                    member_list = item.get('memberList', []) or []
                    member_count = len(member_list)
                    member_ids = [
                        str(m.get('userId', '')) for m in member_list
                        if m.get('userId')
                    ]

                    # 群名为空时使用本群昵称拼接或 fallback roomId
                    if not name and member_list:
                        # 群名 base64 编码时无法解码就用 roomId 兜底
                        name = f'群聊{room_id[-6:]}'

                    obj, created = WecomGroupRoom.objects.update_or_create(
                        group_id=room_id,
                        device=device,
                        defaults={
                            'tenant': tenant,
                            'name': name,
                            'owner_id': owner_id,
                            'member_count': member_count,
                            'member_user_ids': member_ids,
                        },
                    )
                    if created:
                        groups_created += 1
                    else:
                        groups_updated += 1

                    all_group_member_ids.extend(member_ids)

                # 为未返回详情的 roomId 创建占位记录
                for rid in batch_ids:
                    if rid in returned_room_ids:
                        continue
                    obj, created = WecomGroupRoom.objects.update_or_create(
                        group_id=rid,
                        device=device,
                        defaults={
                            'tenant': tenant,
                            'name': f'群聊{rid[-6:]}',
                            'owner_id': '',
                            'member_count': 0,
                            'member_user_ids': [],
                        },
                    )
                    if created:
                        groups_created += 1

        # 去重全部群成员 userId
        all_group_member_ids = list(set(all_group_member_ids))

        # === 3.5 补全群成员信息（昵称/头像/备注）===
        # 根因修复（提了 4 次的 bug）：
        # 之前只补全"已在 WecomContact 中存在 + 昵称为'用户XXXXXX'占位"的成员。
        # 但外部群的群友绝大多数从未在 bizType=1/2 同步过，WecomContact 里压根没记录，
        # 永远进不来补全流程，导致群成员面板里 188 个群友都显示为"用户XXXXXX"。
        # 改为：对所有 member_user_ids 都调 batchGetUserinfo + update_or_create。
        group_member_created = 0
        group_member_filled = 0
        if all_group_member_ids:
            # 排除已在 bizType=1/2 同步过的（这些已有真名，避免无谓的 API 调用）
            real_ids = {str(c.get('userId', '')) for c in wechat_friend_list if c.get('userId')}
            real_ids |= {str(c.get('userId', '')) for c in internal_colleague_list if c.get('userId')}
            need_detail = [
                uid for uid in all_group_member_ids
                if uid and uid != '0' and uid not in real_ids
            ]
            logger.info(
                f'Group members to backfill: total={len(all_group_member_ids)} '
                f'need_detail={len(need_detail)} already_real={len(real_ids)}'
            )
            if need_detail:
                BATCH = 100
                for i in range(0, len(need_detail), BATCH):
                    batch_ids = need_detail[i:i+BATCH]
                    try:
                        detail = client.get_contact_detail(
                            user_id_list=batch_ids, guid=device.guid,
                        )
                    except QiWeiAPIError as e:
                        logger.warning(f'group member batchGetUserinfo failed batch={i}: {e}')
                        continue

                    for item in (detail.get('contactList', []) or []):
                        uid = str(item.get('userId', ''))
                        if not uid or uid == '0':
                            continue
                        nickname = (item.get('nickname', '') or '').strip()
                        remark = (item.get('remark', '') or '').strip()
                        avatar = (item.get('avatarUrl', '') or '').replace('http://', 'https://', 1)
                        contact_type = int(item.get('contactType', 0) or 0)
                        contact_corp_id = str(item.get('corpId', '') or '').strip()

                        display_name = nickname
                        if not display_name or re.match(r'^\d{6,}$', display_name):
                            display_name = remark or f'用户{uid[-6:]}'

                        # 来源判断（与第 2 步一致）
                        if device_corp_id and contact_corp_id == device_corp_id:
                            cs = 'wecom'
                        elif contact_type == 2:
                            cs = 'wecom'
                        else:
                            cs = 'wechat'

                        # 关键修复：update_or_create（不是 .update()），
                        # 因为群里绝大多数群友的 WecomContact 记录根本不存在。
                        obj, was_created = WecomContact.objects.update_or_create(
                            external_userid=uid, device=device,
                            defaults={
                                'tenant': tenant,
                                'name': display_name,
                                'remark': remark,
                                'avatar': avatar,
                                'enterprise_id': contact_corp_id,
                                'contact_source': cs,
                                'qiwe_contact_type': contact_type,
                            },
                        )
                        if was_created:
                            group_member_created += 1
                        else:
                            group_member_filled += 1

        # === 4. 补全群成员中占位记录的真实姓名（群成员补全） ===
        # 群聊 sync 时会创建占位联系人（name='用户XXXXXX'），这里用 batchGetUserinfo 补全
        # 关键修复：只补全**真实存在**的占位，不再从 sessionType=0 创建新联系人
        internal_count = 0
        try:
            # 仅补全 DB 中已存在但昵称为 "用户XXXXXX" 的占位
            placeholders = WecomContact.objects.filter(
                device=device, name__startswith='用户', contact_source__in=('unknown', 'wechat'),
            ).values_list('external_userid', flat=True)
            placeholder_ids = [uid for uid in placeholders if uid and uid != '0']
            # 过滤掉已经在 bizType=1/2 中同步过的（这些已经有真名）
            real_ids = {str(c.get('userId', '')) for c in wechat_friend_list if c.get('userId')}
            real_ids |= {str(c.get('userId', '')) for c in internal_colleague_list if c.get('userId')}
            need_detail = [uid for uid in placeholder_ids if uid not in real_ids]

            if need_detail:
                BATCH = 100
                for i in range(0, len(need_detail), BATCH):
                    batch_ids = need_detail[i:i+BATCH]
                    try:
                        detail = client.get_contact_detail(
                            user_id_list=batch_ids, guid=device.guid,
                        )
                    except QiWeiAPIError:
                        continue

                    for item in (detail.get('contactList', []) or []):
                        uid = str(item.get('userId', ''))
                        if not uid:
                            continue
                        nickname = (item.get('nickname', '') or '').strip()
                        remark = (item.get('remark', '') or '').strip()
                        avatar = (item.get('avatarUrl', '') or '').replace(
                            'http://', 'https://', 1,
                        )
                        display_name = nickname
                        if not display_name or re.match(r'^\d{6,}$', display_name):
                            display_name = remark or f'用户{uid[-6:]}'

                        WecomContact.objects.filter(
                            external_userid=uid, device=device,
                        ).update(
                            name=display_name,
                            remark=remark,
                            avatar=avatar,
                            enterprise_id=item.get('corpId', '') or '',
                        )
                        internal_count += 1
        except QiWeiAPIError as e:
            logger.warning(f'Group member detail fill failed device={device.id}: {e}')
        except Exception as e:
            logger.warning(f'Group member detail fill error device={device.id}: {e}')

        # === 5. 顺便刷新设备头像和在线状态 ===
        try:
            status_result = client.get_device_status(guid=device.guid)
            if isinstance(status_result, dict):
                online_status = status_result.get('userOnlineStatus', -1)
                if online_status == 2:
                    device.status = 'online'
                    qw_uid = status_result.get('userId', '') or device.qw_user_id
                    if qw_uid:
                        try:
                            detail = client.get_contact_detail(
                                user_id_list=[qw_uid], guid=device.guid,
                            )
                            contact_list = detail.get('contactList', []) if isinstance(detail, dict) else []
                            if contact_list:
                                avatar_url = contact_list[0].get('avatarUrl', '')
                                if avatar_url:
                                    device.avatar = avatar_url.replace('http://', 'https://', 1)
                        except Exception as e:
                            logger.warning(f'同步时获取设备头像失败 device={device.id}: {e}')
                device.last_heartbeat = timezone.now()
                device.save(update_fields=['status', 'avatar', 'last_heartbeat'])
        except Exception as e:
            logger.warning(f'同步时刷新设备状态失败 device={device.id}: {e}')

        # === 6. 统计微信好友和企微同事数量 ===
        wechat_count = WecomContact.objects.filter(device=device, contact_source='wechat').count()
        wecom_count = WecomContact.objects.filter(device=device, contact_source='wecom').count()

        return api_success({
            'friends': len(session_user_ids),
            'groups': len(session_room_ids),
            'group_members': len(all_group_member_ids),
            'contacts_created': contacts_created,
            'contacts_updated': contacts_updated,
            'groups_created': groups_created,
            'groups_updated': groups_updated,
            'wechat_friends_total': wechat_count,
            'wecom_colleagues_total': wecom_count,
            'internal_contacts_updated': internal_count,
            'group_members_updated': group_member_filled,
        }, '同步完成')


class SyncGroupsView(APIView):
    """从 QiWe 同步群聊列表（基于会话接口 + 群详情批量）"""

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        device_id = request.data.get('device_id')
        if not device_id:
            return api_error(API_CODE.BAD_REQUEST, '缺少 device_id')

        try:
            device = WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')

        client = get_qiwei_client(device)

        # 关键设计：/room/getRoomList 只返回「我创建的群」，
        # 必须从 /session/getSessionPage 的 sessionType=1 获取全部参与的群聊
        session_room_ids = []
        current_seq = 0
        while True:
            try:
                result = client.get_session_list(
                    current_seq=current_seq, guid=device.guid,
                )
            except QiWeiAPIError as e:
                logger.warning(f'get_session_list failed device={device.id}: {e}')
                return api_error(API_CODE.INTERNAL_ERROR, f'获取会话失败: {e.message}')

            sessions = result.get('sessionList', []) if isinstance(result, dict) else []
            if not sessions:
                break

            for s in sessions:
                if s.get('sessionType') == 1:
                    sid = str(s.get('sessionId', ''))
                    if sid:
                        session_room_ids.append(sid)

            has_more = result.get('hasMore', 0) if isinstance(result, dict) else 0
            next_seq = result.get('currentSeq', 0) if isinstance(result, dict) else 0
            if not has_more or next_seq <= current_seq:
                break
            current_seq = next_seq

        session_room_ids = list(set(session_room_ids))
        logger.info(f'Group sync sessions: device={device.id}, count={len(session_room_ids)}')

        # 批量获取群详情（成员列表 + 群名）
        created_count = 0
        updated_count = 0

        if session_room_ids:
            BATCH = 50
            for i in range(0, len(session_room_ids), BATCH):
                batch_ids = session_room_ids[i:i+BATCH]
                try:
                    detail = client.get_group_members(
                        room_id_list=batch_ids, guid=device.guid,
                    )
                except QiWeiAPIError as e:
                    logger.warning(f'batchGetRoomDetail failed batch={i}: {e}')
                    continue

                room_list = detail.get('roomList', []) if isinstance(detail, dict) else []
                returned_room_ids = set()
                for item in room_list:
                    room_id = str(item.get('roomId', ''))
                    if not room_id:
                        continue
                    returned_room_ids.add(room_id)

                    name = (item.get('roomName', '') or '').strip()
                    owner_id = (item.get('roomCreateUserId', '') or
                                item.get('roomOwnerId', '') or '').strip()
                    member_list = item.get('memberList', []) or []
                    member_count = len(member_list)
                    member_ids = [
                        str(m.get('userId', '')) for m in member_list
                        if m.get('userId')
                    ]
                    if not name:
                        name = f'群聊{room_id[-6:]}'

                    obj, created = WecomGroupRoom.objects.update_or_create(
                        group_id=room_id,
                        device=device,
                        defaults={
                            'tenant': tenant,
                            'name': name,
                            'owner_id': owner_id,
                            'member_count': member_count,
                            'member_user_ids': member_ids,
                        },
                    )
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

                # 为未返回详情的 roomId 创建占位
                for rid in batch_ids:
                    if rid in returned_room_ids:
                        continue
                    obj, created = WecomGroupRoom.objects.update_or_create(
                        group_id=rid,
                        device=device,
                        defaults={
                            'tenant': tenant,
                            'name': f'群聊{rid[-6:]}',
                            'owner_id': '',
                            'member_count': 0,
                            'member_user_ids': [],
                        },
                    )
                    if created:
                        created_count += 1

        return api_success({
            'total': len(session_room_ids),
            'created': created_count,
            'updated': updated_count,
        }, '群聊同步完成')


class SyncTagsView(APIView):
    """从 QiWe 同步标签"""

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        device_id = request.data.get('device_id')
        if not device_id:
            return api_error(API_CODE.BAD_REQUEST, '缺少 device_id')

        try:
            device = WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')

        client = get_qiwei_client(device)
        try:
            result = client.get_tag_list(guid=device.guid)
        except QiWeiAPIError as e:
            return api_error(API_CODE.INTERNAL_ERROR, f'同步失败: {e.message}')

        tags_data = result.get('labelList', []) if isinstance(result, dict) else []
        created_count = 0
        updated_count = 0

        for item in tags_data:
            # QiWe /label/syncLabelList 返回: { labelId, name, labelType, groupId, ... }
            label_id = item.get('labelId', '')
            name = item.get('name', '')
            if not name:
                continue

            obj, created = WecomTag.objects.update_or_create(
                tenant=tenant,
                tag_id=label_id,
                defaults={'name': name}
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        return api_success({
            'total': len(tags_data),
            'created': created_count,
            'updated': updated_count,
        }, '标签同步完成')


# ============================================================
# Webhook 接收（不需要认证）
# ============================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def wecom_webhook(request):
    """
    QiWe 回调入口
    3 秒内返回 200，异步处理消息

    真实 QiWe 格式（2026-08-01 确认）：
        {"code": 0, "msg": "成功", "data": [
            {"cmd": 15000, "guid": "...", "userId": "...", "msgType": ..., "msgData": {"base64RawData": "..."}, ...}
        ]}

    兼容旧测试格式：
        {"cmd": "15000", "data": {"guid": "...", "fromId": "..."}}

    分发逻辑：
    - cmd 15000: 文本消息 → 持久化 → 触发 AI 回复
    - cmd 20000: 图片消息 → 下载媒体 → 持久化 → 触发 AI
    - cmd 11016: 联系人变更 → 更新 WecomContact
    - cmd 15500: 设备状态变更 → 更新 WecomDevice.status
    """
    import threading
    from .webhook_handler import process_webhook_async

    raw_data = request.data
    if isinstance(raw_data, str):
        import json
        raw_data = json.loads(raw_data)

    import json as _json
    data_snippet = _json.dumps(raw_data, ensure_ascii=False)[:800]
    logger.error(f'QiWe webhook RAW: keys={list(raw_data.keys())} data={data_snippet}')

    # --- 格式兼容：真实 QiWe 格式 vs 测试格式 ---
    events = raw_data.get('data', None)

    if isinstance(events, list) and len(events) > 0:
        # 真实 QiWe 格式：data 是事件数组，每个元素含 cmd(整数)/guid/userId/msgType/msgData
        for event_item in events:
            cmd = str(event_item.get('cmd', ''))
            if not cmd:
                logger.warning(f'Webhook event missing cmd: {event_item}')
                continue
            try:
                t = threading.Thread(target=process_webhook_async, args=(event_item,), daemon=True)
                t.start()
            except Exception as e:
                logger.error(f'Failed to start async webhook for cmd={cmd}: {e}')
        return api_success({'event_count': len(events)}, 'ok')

    elif isinstance(events, dict):
        # 旧测试格式：{"cmd": "15000", "data": {"guid": "...", "fromId": "..."}}
        # 将 data dict 作为事件数据，cmd 字段提升到顶层
        test_event = dict(events)
        test_event['cmd'] = raw_data.get('cmd', test_event.get('cmd', ''))
        try:
            t = threading.Thread(target=process_webhook_async, args=(test_event,), daemon=True)
            t.start()
        except Exception as e:
            logger.error(f'Failed to start async webhook: {e}')
        return api_success({'cmd': str(test_event.get('cmd', ''))}, 'ok')

    else:
        # 未知格式：尝试按顶层 cmd 分发
        cmd = str(raw_data.get('cmd', ''))
        if cmd:
            try:
                t = threading.Thread(target=process_webhook_async, args=(raw_data,), daemon=True)
                t.start()
            except Exception as e:
                logger.error(f'Failed to start async webhook: {e}')
        else:
            logger.warning(f'Unknown webhook format, no cmd found: {data_snippet}')
        return api_success({'cmd': cmd}, 'ok')


# ============================================================
# 消息收藏管理
# ============================================================

class FavoriteListCreateView(APIView):
    """收藏列表 + 从消息创建收藏"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        favorites = MessageFavorite.objects.filter(tenant=tenant)
        serializer = MessageFavoriteSerializer(favorites, many=True)
        return api_success(serializer.data)

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        # 支持两种创建方式：
        # 1) 从消息 ID 收藏：{ message_id: 123 }
        # 2) 直接指定内容：{ msg_type, content, media_file_url, media_file_name, raw_data }
        message_id = request.data.get('message_id')
        if message_id:
            try:
                msg = WecomMessage.objects.get(id=message_id, tenant=tenant)
            except WecomMessage.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '消息不存在')

            # 判断收藏类型
            msg_type = msg.msg_type
            if msg_type == 'text':
                # 检查是否纯表情（内容为单个 emoji）
                content = msg.content or ''
                favorite = MessageFavorite.objects.create(
                    tenant=tenant,
                    msg_type='text',
                    content=content,
                )
            elif msg_type == 'miniprogram':
                # 小程序收藏：保留原始 msgData 供后续转发
                raw_data = msg.raw_data or {}
                msg_data = raw_data.get('msgData', {}) if isinstance(raw_data, dict) else {}
                title = msg_data.get('title', '') or msg_data.get('appName', '') or msg.content or '[小程序]'
                app_name = msg_data.get('appName', '')
                icon_url = msg.media_file.url if msg.media_file else (msg_data.get('iconUrl', '') or '')
                favorite = MessageFavorite.objects.create(
                    tenant=tenant,
                    msg_type='miniprogram',
                    content=title,
                    media_file_url=icon_url,
                    media_file_name=app_name or title,
                    raw_data=raw_data,
                )
            else:
                media_url = msg.media_file.url if msg.media_file else ''
                media_name = msg.content or ''
                if msg_type == 'image':
                    media_name = '图片'
                elif msg_type == 'voice':
                    media_name = msg.content or '[语音]'
                favorite = MessageFavorite.objects.create(
                    tenant=tenant,
                    msg_type=msg_type,
                    content=msg.content or '',
                    media_file_url=media_url,
                    media_file_name=media_name,
                )
            serializer = MessageFavoriteSerializer(favorite)
            return api_success(serializer.data, '收藏成功')

        # 直接指定内容创建
        msg_type = request.data.get('msg_type', 'text')
        content = request.data.get('content', '')
        media_file_url = request.data.get('media_file_url', '')
        media_file_name = request.data.get('media_file_name', '')
        raw_data = request.data.get('raw_data', {})

        if msg_type == 'text' and not content:
            return api_error(API_CODE.BAD_REQUEST, '文本收藏需要 content')
        if msg_type in ('image', 'file', 'voice') and not media_file_url:
            return api_error(API_CODE.BAD_REQUEST, '媒体收藏需要 media_file_url')
        if msg_type == 'miniprogram' and not raw_data:
            return api_error(API_CODE.BAD_REQUEST, '小程序收藏需要 raw_data')

        favorite = MessageFavorite.objects.create(
            tenant=tenant,
            msg_type=msg_type,
            content=content,
            media_file_url=media_file_url,
            media_file_name=media_file_name,
            raw_data=raw_data or {},
        )
        serializer = MessageFavoriteSerializer(favorite)
        return api_success(serializer.data, '收藏成功')


class FavoriteDetailView(APIView):
    """收藏详情 / 删除"""

    def delete(self, request, favorite_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            fav = MessageFavorite.objects.get(id=favorite_id, tenant=tenant)
        except MessageFavorite.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '收藏不存在')
        fav.delete()
        return api_success(msg='收藏已删除')


# ============================================================
# 消息删除
# ============================================================

class MessageDetailView(APIView):
    """消息详情 / 删除 / 撤回"""

    def delete(self, request, message_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            msg = WecomMessage.objects.get(id=message_id, tenant=tenant)
        except WecomMessage.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '消息不存在')
        msg.delete()
        return api_success(msg='消息已删除')

    def patch(self, request, message_id):
        """撤回消息（调用 QiWe revokeMsg API 真正撤回）"""
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            msg = WecomMessage.objects.get(id=message_id, tenant=tenant)
        except WecomMessage.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '消息不存在')

        # 只能撤回自己发出的消息
        if msg.direction != 'outbound':
            return api_error(API_CODE.BAD_REQUEST, '只能撤回自己发送的消息')

        # 只允许撤回常见的消息类型（文本、语音、图片、视频、文件、链接、表情等）
        RECALLABLE_MSG_TYPES = {'text', 'voice', 'image', 'video', 'file', 'link', 'emoji'}
        if msg.msg_type not in RECALLABLE_MSG_TYPES:
            return api_error(API_CODE.BAD_REQUEST, '该类型消息暂不支持撤回')

        # 已被撤回的，幂等返回成功（避免前端重试/网络抖动时报错）
        if msg.is_recalled:
            serializer = WecomMessageSerializer(msg)
            return api_success(serializer.data, '消息已撤回')

        # 调用 QiWe 网关撤回消息（需要 msg_server_id）
        if msg.msg_server_id:
            try:
                device = msg.device
                client = get_qiwei_client(device)
                client.recall_message(
                    chat_id=msg.contact.external_userid,
                    msg_server_id=msg.msg_server_id,
                    guid=device.guid,
                )
                logger.info(f'QiWe recall successful: msg_id={msg.id}, msg_server_id={msg.msg_server_id}')
            except QiWeiAPIError as e:
                logger.error(f'QiWe recall failed: msg_id={msg.id}, error={e}')
                return api_error(API_CODE.INTERNAL_ERROR, f'撤回失败（企微接口错误）: {e.message}')
            except Exception as e:
                logger.exception(f'QiWe recall exception: msg_id={msg.id}, error={e}')
                return api_error(API_CODE.INTERNAL_ERROR, f'撤回失败: {str(e)}')
        else:
            logger.warning(
                f'Recall: message id={msg.id} has no msg_server_id, '
                f'marking recalled locally only (may not take effect on WeChat)'
            )

        msg.is_recalled = True
        msg.save(update_fields=['is_recalled'])
        serializer = WecomMessageSerializer(msg)
        return api_success(serializer.data, '消息已撤回')


# ============================================================
# 企微设备绑定流程（新架构 — 租户用 GUID 绑定）
# ============================================================

class DeviceBindView(APIView):
    """租户端：用 GUID + 备注 + 手机号绑定设备

    新架构：管理后台已通过 createClient 创建 WecomNumber（含 guid），
    租户在前端输入 guid + 备注 + 手机号，后端查找 WecomNumber → 创建 WecomDevice
    → 更新 WecomNumber.status='bound' + 关联 bound_device。
    """

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        guid = request.data.get('guid', '').strip()
        mobile = request.data.get('mobile', '').strip()
        remark = request.data.get('remark', '').strip()

        if not guid:
            return api_error(API_CODE.BAD_REQUEST, '请输入 GUID 号')
        if not mobile:
            return api_error(API_CODE.BAD_REQUEST, '请输入手机号')

        # 查找 WecomNumber
        try:
            wecom_number = WecomNumber.objects.get(guid=guid)
        except WecomNumber.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, 'GUID 号不存在，请确认后重试')

        if wecom_number.status == 'bound':
            return api_error(API_CODE.BAD_REQUEST, '该企微号已被绑定')
        if wecom_number.status == 'expired':
            return api_error(API_CODE.BAD_REQUEST, '该企微号已过期')
        if wecom_number.status == 'offline':
            return api_error(API_CODE.BAD_REQUEST, '该企微号已下线')

        # 检查 GUID 是否已存在 WecomDevice
        if WecomDevice.objects.filter(guid=guid).exists():
            return api_error(API_CODE.BAD_REQUEST, '该 GUID 已有关联设备')

        # 创建 WecomDevice
        device_name = f'{tenant.name}-{remark}' if remark else tenant.name
        device = WecomDevice.objects.create(
            tenant=tenant,
            guid=guid,
            name=device_name,
            mobile=mobile,
            remark=remark,
            wecom_number=wecom_number,
            province_code=wecom_number.province_code,
            ai_enabled=True,
        )

        # 更新 WecomNumber
        wecom_number.tenant = tenant
        wecom_number.bound_device = device
        wecom_number.status = 'bound'
        wecom_number.save(update_fields=['tenant', 'bound_device', 'status', 'updated_at'])

        # 自动配置 Webhook 回调（全局 Token 级操作）
        callback_configured = False
        callback_error = ''
        try:
            client = get_global_qiwei_client()
            client.set_callback(
                callback_url='https://twdanaob.88yldh.com/api/v1/wecom/webhook/',
            )
            device.callback_url = 'https://twdanaob.88yldh.com/api/v1/wecom/webhook/'
            device.save(update_fields=['callback_url'])
            callback_configured = True
        except Exception as e:
            callback_error = str(e)
            logger.warning(f'Webhook 回调配置失败 device={device.id}: {e}')

        # 自动创建默认 ChatSetting
        chat_setting_created = False
        try:
            from apps.marketing_follow.models import ChatSetting
            ChatSetting.objects.get_or_create(
                tenant=tenant,
                device=device,
                defaults={
                    'ai_enabled': True,
                    'reply_style': 'friendly',
                    'reply_length': 'short',
                    'customer_address': 'remark',
                    'ai_signature': False,
                    'quick_replies': [],
                    'forbidden_words': [],
                },
            )
            chat_setting_created = True
        except Exception as e:
            logger.warning(f'创建 ChatSetting 失败 device={device.id}: {e}')

        serializer = WecomDeviceSerializer(device)
        data = serializer.data
        data['callback_configured'] = callback_configured
        data['chat_setting_created'] = chat_setting_created
        if callback_error:
            data['callback_error'] = callback_error
        return api_success(data, '设备绑定成功')


# ============================================================
# Admin API — 天网大脑管理后台企微管理
# ============================================================

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.wecom.manage')
def admin_wecom_config(request):
    """GET/PUT /api/v1/admin/wecom/config/ — 企微全局配置"""
    config = WecomGlobalConfig.get_solo()

    if request.method == 'GET':
        serializer = WecomGlobalConfigSerializer(config)
        return api_success(serializer.data)

    # PUT — 更新配置
    sdk_url = request.data.get('sdk_url', '').strip()
    sdk_token = request.data.get('sdk_token', '').strip()
    callback_token = request.data.get('callback_token', '').strip()

    if sdk_url:
        config.sdk_url = sdk_url
    if sdk_token:
        config.sdk_token = sdk_token
    if callback_token is not None:
        config.callback_token = callback_token
    config.save()

    serializer = WecomGlobalConfigSerializer(config)
    return api_success(serializer.data, '配置已保存')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.wecom.manage')
def admin_wecom_area_codes(request):
    """GET /api/v1/admin/wecom/area-codes/ — 省份列表"""
    return api_success(AREA_CODES)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.wecom.manage')
def admin_wecom_numbers(request):
    """GET/POST /api/v1/admin/wecom/numbers/ — 企微号列表 + 创建

    POST 参数：
        tenant_id: int — 归属租户 ID
        province_code: str — 设备归属省代码
        province_name: str — 设备归属省名称
        remark: str — 备注（归属企业）
        expires_at: str — 有效期（ISO 8601 格式，可选）
        price: str — 收费标准（元/月，可选）
        device_name: str — 设备名称（可选，默认自动生成）
        device_type: int — 设备类型（0=iPad, 1=Windows，默认 0）
        proxy_url: str — 代理 URL（可选）
        client_version: str — 客户端版本（可选）

    创建流程：参数校验 → 调用 QiWe createClient（全局 Token）→ 保存 guid 到 WecomNumber
    """
    if request.method == 'GET':
        # 支持按 tenant_id / status 筛选
        qs = WecomNumber.objects.select_related('tenant', 'bound_device').all()
        tenant_id = request.GET.get('tenant_id')
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        status = request.GET.get('status')
        if status:
            qs = qs.filter(status=status)
        qs = qs.order_by('-created_at')
        serializer = WecomNumberSerializer(qs, many=True)
        return api_success(serializer.data)

    # POST — 创建企微号
    tenant_id = request.data.get('tenant_id')
    province_code = request.data.get('province_code', '').strip()
    province_name = request.data.get('province_name', '').strip()
    remark = request.data.get('remark', '').strip()
    expires_at = request.data.get('expires_at', '').strip()
    price = request.data.get('price', '0')
    device_name = request.data.get('device_name', '').strip()
    device_type = request.data.get('device_type', 0)
    proxy_url = request.data.get('proxy_url', '').strip()
    client_version = request.data.get('client_version', '').strip()

    # 参数校验
    if not province_code:
        return api_error(API_CODE.BAD_REQUEST, '请选择设备归属省')
    if not province_name:
        # 尝试从 AREA_CODES 中查找名称
        for item in AREA_CODES:
            if item['code'] == province_code:
                province_name = item['name']
                break

    # 查找租户
    tenant = None
    if tenant_id:
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return api_error(API_CODE.BAD_REQUEST, '选择的租户不存在')

    # 调用 QiWe createClient（全局 Token）
    try:
        client = get_global_qiwei_client()
        result = client.create_client(
            area_code=int(province_code),
            device_name=device_name or f'{province_name}-企微号',
            device_type=int(device_type),
            proxy_url=proxy_url,
            client_version=client_version,
        )
        guid = result.get('guid', '') if isinstance(result, dict) else ''
        if not guid:
            return api_error(API_CODE.INTERNAL_ERROR, '创建设备失败：QiWe 未返回 guid')
    except QiWeiAPIError as e:
        logger.error(f'Admin createClient 失败: {e}')
        err_msg = e.message
        if '上限' in err_msg:
            err_msg = f'{err_msg}。请前往 QiWe 平台释放已下线设备名额，或使用新的 Token。'
        elif '不可用' in err_msg:
            err_msg = f'{err_msg}。请检查 SDK Token 配置是否正确。'
        return api_error(API_CODE.INTERNAL_ERROR, f'创建企微号失败: {err_msg}')
    except Exception as e:
        logger.error(f'Admin createClient 异常: {e}')
        return api_error(API_CODE.INTERNAL_ERROR, f'创建企微号异常: {str(e)}')

    # 解析有效期
    expires_dt = None
    if expires_at:
        try:
            from datetime import datetime as _dt
            # 兼容多种日期格式
            for fmt in ('%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S'):
                try:
                    expires_dt = _dt.strptime(expires_at[:19], fmt)
                    break
                except ValueError:
                    continue
            if expires_dt is None:
                # ISO 8601
                expires_dt = _dt.fromisoformat(expires_at.replace('Z', '+00:00'))
        except Exception:
            pass

    # 解析收费标准
    try:
        price_decimal = float(price)
    except (ValueError, TypeError):
        price_decimal = 0

    # 保存到 WecomNumber
    wecom_number = WecomNumber.objects.create(
        guid=guid,
        tenant=tenant,
        province_code=province_code,
        province_name=province_name,
        remark=remark,
        device_name=device_name or f'{province_name}-企微号',
        device_type=int(device_type),
        proxy_url=proxy_url,
        client_version=client_version,
        expires_at=expires_dt,
        price=price_decimal,
        status='created',
    )

    serializer = WecomNumberSerializer(wecom_number)
    return api_success(serializer.data, f'企微号创建成功，GUID: {guid}')


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.wecom.manage')
def admin_wecom_number_detail(request, number_id):
    """GET/PATCH/DELETE /api/v1/admin/wecom/numbers/<id>/ — 企微号详情/更新/删除"""
    try:
        wecom_number = WecomNumber.objects.select_related('tenant', 'bound_device').get(id=number_id)
    except WecomNumber.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '企微号不存在')

    if request.method == 'GET':
        serializer = WecomNumberSerializer(wecom_number)
        return api_success(serializer.data)

    if request.method == 'PATCH':
        for field in ['remark', 'device_name', 'device_type', 'proxy_url',
                       'client_version', 'province_code', 'province_name', 'status', 'price']:
            if field in request.data:
                setattr(wecom_number, field, request.data[field])
        if 'tenant_id' in request.data:
            tid = request.data['tenant_id']
            if tid:
                try:
                    wecom_number.tenant = Tenant.objects.get(id=tid)
                except Tenant.DoesNotExist:
                    return api_error(API_CODE.BAD_REQUEST, '租户不存在')
            else:
                wecom_number.tenant = None
        if 'expires_at' in request.data:
            expires_at = request.data['expires_at']
            if expires_at:
                try:
                    from datetime import datetime as _dt
                    for fmt in ('%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S'):
                        try:
                            wecom_number.expires_at = _dt.strptime(expires_at[:19], fmt)
                            break
                        except ValueError:
                            continue
                except Exception:
                    pass
            else:
                wecom_number.expires_at = None
        wecom_number.save()
        serializer = WecomNumberSerializer(wecom_number)
        return api_success(serializer.data, '更新成功')

    # DELETE
    if wecom_number.bound_device:
        return api_error(API_CODE.BAD_REQUEST, '该企微号已绑定设备，请先解绑再删除')
    wecom_number.delete()
    return api_success(msg='企微号已删除')


# ============================================================
# 草稿管理（按会话隔离，后端持久化）
# ============================================================

class DraftView(APIView):
    """聊天草稿 CRUD — GET/PUT/DELETE by conversation"""

    def _resolve_conversation(self, request):
        """从请求参数解析会话类型和 ID + 获取设备"""
        tenant = _get_tenant(request)
        if not tenant:
            return None, None, None, None

        contact_id = request.query_params.get('contact_id') or request.data.get('contact_id')
        room_id = request.query_params.get('room_id') or request.data.get('room_id')

        if contact_id:
            try:
                contact = WecomContact.objects.get(id=contact_id, tenant=tenant)
                return tenant, contact.device, 'personal', contact.id
            except WecomContact.DoesNotExist:
                return tenant, None, 'personal', int(contact_id)
        elif room_id:
            try:
                room = WecomGroupRoom.objects.get(id=room_id, tenant=tenant)
                return tenant, room.device, 'group', room.id
            except WecomGroupRoom.DoesNotExist:
                return tenant, None, 'group', int(room_id)

        return tenant, None, None, None

    def get(self, request):
        """获取草稿"""
        tenant, device, conv_type, conv_id = self._resolve_conversation(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        if not conv_type:
            return api_error(API_CODE.BAD_REQUEST, '缺少 contact_id 或 room_id')

        try:
            draft = WecomDraft.objects.get(
                tenant=tenant, device=device,
                conversation_type=conv_type, conversation_id=conv_id
            )
            serializer = WecomDraftSerializer(draft)
            return api_success(serializer.data)
        except WecomDraft.DoesNotExist:
            return api_success(None)

    def put(self, request):
        """保存/更新草稿（upsert）"""
        tenant, device, conv_type, conv_id = self._resolve_conversation(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        if not conv_type:
            return api_error(API_CODE.BAD_REQUEST, '缺少 contact_id 或 room_id')
        if not device:
            return api_error(API_CODE.BAD_REQUEST, '设备不存在')

        content = request.data.get('content', '')
        media_url = request.data.get('media_url', '')
        media_type = request.data.get('media_type', '')

        draft, created = WecomDraft.objects.update_or_create(
            tenant=tenant, device=device,
            conversation_type=conv_type, conversation_id=conv_id,
            defaults={
                'content': content,
                'media_url': media_url,
                'media_type': media_type,
            }
        )
        serializer = WecomDraftSerializer(draft)
        return api_success(serializer.data, '草稿已保存' if created else '草稿已更新')

    def delete(self, request):
        """清除草稿"""
        tenant, device, conv_type, conv_id = self._resolve_conversation(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        if not conv_type:
            return api_error(API_CODE.BAD_REQUEST, '缺少 contact_id 或 room_id')

        deleted, _ = WecomDraft.objects.filter(
            tenant=tenant, device=device,
            conversation_type=conv_type, conversation_id=conv_id
        ).delete()
        return api_success(msg='草稿已清除' if deleted else '无草稿可清除')


class SSEView(APIView):
    """
    SSE (Server-Sent Events) 端点 — 实时消息推送

    前端通过 EventSource 连接此端点，替代 5 秒轮询。
    后端使用 in-memory pub/sub（sse.py）实现实时推送。

    GET /api/v1/wecom/sse/?device_id=<id>&token=<jwt>
    响应：text/event-stream

    注意：EventSource 不支持自定义请求头，因此通过 query 参数传递 JWT token。
    """
    permission_classes = [AllowAny]

    def get(self, request):
        # EventSource 不支持 Authorization 头，通过 query 参数认证
        token = request.query_params.get('token', '')
        if not token:
            # 也尝试从 Authorization 头获取（兼容非 EventSource 客户端）
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]

        if not token:
            return api_error(API_CODE.UNAUTHORIZED, '缺少 token')

        # 手动验证 JWT token 并提取 tenant_id
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from apps.platform.models import TenantUser
            decoded = AccessToken(token)
            user_id = decoded.get('user_id')
            if not user_id:
                return api_error(API_CODE.UNAUTHORIZED, '无效的 token')
            membership = TenantUser.objects.filter(user_id=user_id).select_related('tenant').first()
            if not membership:
                return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
            tenant = membership.tenant
        except Exception as e:
            logger.warning(f'SSE auth failed: {e}')
            return api_error(API_CODE.UNAUTHORIZED, 'token 验证失败')

        device_id = request.query_params.get('device_id')
        if not device_id:
            return api_error(API_CODE.BAD_REQUEST, '缺少 device_id')

        try:
            device = WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')

        tenant_id = tenant.id
        dev_id = device.id

        # Subscribe to pub/sub
        q = sse_module.subscribe(tenant_id, dev_id)

        def event_stream():
            try:
                # Send initial connection confirmation
                yield 'event: connected\ndata: {}\n\n'

                keepalive_interval = 15  # seconds
                last_keepalive = time.monotonic()

                while True:
                    try:
                        event = q.get(timeout=keepalive_interval)
                        event_type = event.get('type', 'message')
                        event_data = json.dumps(event.get('data', {}), ensure_ascii=False, default=str)
                        yield f'event: {event_type}\ndata: {event_data}\n\n'
                    except queue_module.Empty:
                        # No events — send keepalive ping
                        now = time.monotonic()
                        if now - last_keepalive >= keepalive_interval:
                            yield ': keepalive\n\n'
                            last_keepalive = now
            except GeneratorExit:
                pass
            except Exception as e:
                logger.exception(f'SSE stream error: {e}')
            finally:
                sse_module.unsubscribe(tenant_id, dev_id, q)
                logger.debug(f'SSE stream closed: tenant={tenant_id} device={dev_id}')

        response = StreamingHttpResponse(
            event_stream(),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'  # Disable Nginx buffering
        response['Connection'] = 'keep-alive'
        return response


class MarkAsReadView(APIView):
    """
    标记会话消息为已读

    POST /api/v1/wecom/messages/mark-read/
    Body: { "contact_id": <id> } 或 { "room_id": <id> }

    将该会话中当前用户发送的 outbound 消息状态更新为 'read'。
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        contact_id = request.data.get('contact_id')
        room_id = request.data.get('room_id')

        if not contact_id and not room_id:
            return api_error(API_CODE.BAD_REQUEST, '缺少 contact_id 或 room_id')

        device = None
        conversation_type = 'personal'
        queryset = WecomMessage.objects.filter(tenant=tenant, direction='outbound', status__in=['sent', 'delivered'])

        if room_id:
            try:
                room = WecomGroupRoom.objects.get(id=room_id, tenant=tenant)
                device = room.device
                queryset = queryset.filter(room=room)
                conversation_type = 'group'
            except WecomGroupRoom.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '群聊不存在')
        else:
            try:
                contact = WecomContact.objects.get(id=contact_id, tenant=tenant)
                device = contact.device
                queryset = queryset.filter(contact=contact)
            except WecomContact.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '联系人不存在')

        updated = queryset.update(status='read')

        # Publish read receipt event via SSE
        if device:
            sse_module.publish_read_receipt(
                tenant_id=tenant.id,
                device_id=device.id,
                contact_id=contact_id,
                room_id=room_id,
                conversation_type=conversation_type,
            )

        return api_success({'updated': updated}, f'已标记 {updated} 条消息为已读')
