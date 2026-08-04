"""
apps/wecom/qiwei_client.py
QiWe 网关客户端 — 封装所有企微 API 调用

统一端点: POST /qiwe/api/qw/doApi
认证: Header X-QIWEI-TOKEN
分发: Body method 字段指定具体 API，参数嵌套在 params 对象中
"""
import logging
import time
import random
import requests
from typing import Optional

logger = logging.getLogger(__name__)

# QiWe 网关基础配置
QIWEI_BASE_URL = 'https://manager.qiweapi.com/qiwe/api/qw/doApi'
QIWEI_DEFAULT_TOKEN = ''  # 默认空 — 使用设备绑定的 Token
QIWEI_DEFAULT_GUID = ''

# 请求超时（秒）
REQUEST_TIMEOUT = 30
# 最大重试次数
MAX_RETRIES = 3
# 重试基础间隔（秒，指数退避）
RETRY_BASE_DELAY = 2


class QiWeiAPIError(Exception):
    """QiWe API 调用异常"""
    def __init__(self, code: int, message: str, raw: dict = None):
        self.code = code
        self.message = message
        self.raw = raw or {}
        super().__init__(f'QiWe API Error [{code}]: {message}')


class QiWeiClient:
    """
    QiWe 网关客户端
    所有企微操作通过此客户端调用，自动处理 Token 认证、method 分发、重试和错误处理。

    API 规范（与 QiWe 开放平台一致）：
    - 统一端点 POST /qiwe/api/qw/doApi
    - 请求体: { "method": "/xxx/yyy", "params": { ... } }
    - 响应体: { "code": 0, "msg": "ok", "data": { ... } }
    - 成功码: 0 或 200
    """

    def __init__(self, token: str = '', guid: str = '', base_url: str = ''):
        self.token = token or QIWEI_DEFAULT_TOKEN
        self.guid = guid or QIWEI_DEFAULT_GUID
        self.base_url = base_url or QIWEI_BASE_URL

    def _call(self, method: str, params: dict = None) -> dict:
        """
        调用 QiWe API（内部方法）

        Args:
            method: QiWe API method（如 '/contact/getWxContactList'）
            params: API 参数（会嵌套在 body.params 中）

        Returns:
            QiWe 返回的 data 字段

        Raises:
            QiWeiAPIError: API 调用失败
        """
        headers = {
            'Content-Type': 'application/json',
            'X-QIWEI-TOKEN': self.token,
        }
        payload = {
            'method': method,
            'params': params or {},
        }

        # 自动注入 guid（如果 params 未提供）
        if self.guid and 'guid' not in payload['params']:
            payload['params']['guid'] = self.guid

        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                resp = requests.post(
                    self.base_url,
                    json=payload,
                    headers=headers,
                    timeout=REQUEST_TIMEOUT,
                )
                resp.raise_for_status()
                data = resp.json()

                # QiWe 统一返回格式: { code: 0|200, msg: '...', data: {...} }
                code = data.get('code', -1)
                if code == 0 or code == 200:
                    return data.get('data', {}) or {}

                error_msg = data.get('message') or data.get('msg') or 'Unknown error'
                last_error = QiWeiAPIError(code, error_msg, data)
                logger.warning(
                    f'QiWe API {method} failed (attempt {attempt+1}/{MAX_RETRIES}): '
                    f'code={code}, message={error_msg}'
                )

                # Token 过期 / 不可用 / 账户上限等不可恢复错误，不重试
                NON_RETRYABLE_KEYWORDS = ('不可用', '上限', '参数错误', '未授权', '已过期', '权限不足')
                if code == 500 and any(kw in error_msg for kw in NON_RETRYABLE_KEYWORDS):
                    break

                # 指数退避重试（仅对服务端错误）
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(delay)

            except requests.RequestException as e:
                last_error = e
                logger.warning(
                    f'QiWe API {method} request error (attempt {attempt+1}/{MAX_RETRIES}): {e}'
                )
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(delay)

        # 所有重试失败
        if isinstance(last_error, QiWeiAPIError):
            raise last_error
        raise QiWeiAPIError(-1, f'Request failed after {MAX_RETRIES} retries: {last_error}')

    # ============================================================
    # 消息发送
    # ============================================================

    def send_text(self, to_id: str, content: str, guid: str = '',
                  is_no_need_read: bool = False,
                  reply: dict = None) -> dict:
        """
        发送文本消息

        Args:
            to_id: 接收者 ID（联系人 userId 或群 roomId）
            content: 文本内容
            guid: 设备 GUID（覆盖默认值）
            is_no_need_read: 是否无需已读回执（默认 False=需要回执）
            reply: 引用回复参数，结构:
                {
                    'type': int (消息类型，0=文本, 14=图片, 15=文件, 16=语音, 23=视频, 29=表情),
                    'msgServerId': int (被引用消息的服务器ID),
                    'userId': str (被引用消息发送者ID),
                    'showName': str (被引用消息发送者显示名),
                    'msgUniqueIdentifier': str (被引用消息唯一标识),
                    'msgData': dict (被引用消息数据，结构依 type 而定),
                }
        """
        params = {
            'guid': guid or self.guid,
            'toId': to_id,
            'content': content,
            'isNoNeedRead': bool(is_no_need_read),
        }
        if reply:
            params['reply'] = reply
        return self._call('/msg/sendText', params)

    def recall_message(self, chat_id: str, msg_server_id: int,
                       guid: str = '') -> dict:
        """
        撤回消息（调用 QiWe /msg/revokeMsg API）

        Args:
            chat_id: 会话 ID（即原始发送目标的 toId/contact external_userid）
            msg_server_id: 消息服务器 ID（来自 sendText 响应的 msgServerId）
            guid: 设备 GUID

        Returns:
            QiWe 响应: {code: 0, data: [{}], msg: 'string'}

        Note:
            撤回有时间窗口限制，超时后 QiWe 返回错误码。
        """
        return self._call('/msg/revokeMsg', {
            'guid': guid or self.guid,
            'chatId': chat_id,
            'msgServerId': msg_server_id,
        })

    def send_image(self, to_id: str, file_aes_key: str, file_id: str,
                   file_md5: str, file_size: int, filename: str,
                   guid: str = '') -> dict:
        """
        发送图片消息

        Args:
            to_id: 接收者 ID
            file_aes_key: 文件 AES Key（fileId 含 * 时可空）
            file_id: 文件 ID
            file_md5: 文件 MD5
            file_size: 文件大小
            filename: 文件名
            guid: 设备 GUID
        """
        return self._call('/msg/sendImage', {
            'guid': guid or self.guid,
            'toId': to_id,
            'fileAesKey': file_aes_key,
            'fileId': file_id,
            'fileMd5': file_md5,
            'fileSize': file_size,
            'filename': filename,
        })

    def send_link(self, to_id: str, title: str, icon_url: str,
                  link_url: str, desc: str, guid: str = '') -> dict:
        """
        发送图文链接消息

        Args:
            to_id: 接收者 ID
            title: 标题
            icon_url: 图标链接
            link_url: 跳转链接
            desc: 描述
            guid: 设备 GUID
        """
        return self._call('/msg/sendLink', {
            'guid': guid or self.guid,
            'toId': to_id,
            'title': title,
            'iconUrl': icon_url,
            'linkUrl': link_url,
            'desc': desc,
        })

    def send_file(self, to_id: str, file_aes_key: str, file_id: str,
                  file_size: int, filename: str, guid: str = '') -> dict:
        """
        发送文件消息

        Args:
            to_id: 接收者 ID
            file_aes_key: 文件 AES Key（大文件时可空）
            file_id: 文件 ID
            file_size: 文件大小
            filename: 文件名
            guid: 设备 GUID
        """
        return self._call('/msg/sendFile', {
            'guid': guid or self.guid,
            'toId': to_id,
            'fileAesKey': file_aes_key,
            'fileId': file_id,
            'fileSize': file_size,
            'filename': filename,
        })

    def send_video(self, to_id: str, file_aes_key: str, file_id: str,
                   file_md5: str, file_size: int, filename: str,
                   duration: int, cover_image_size: int = 0,
                   preview_img_url: str = '', guid: str = '') -> dict:
        """
        发送视频消息

        Args:
            to_id: 接收者 ID
            file_aes_key: 文件 AES Key（fileId 含 * 时可空）
            file_id: 文件 ID
            file_md5: 文件 MD5
            file_size: 文件大小
            filename: 文件名
            duration: 视频时长（秒）
            cover_image_size: 封面图大小
            preview_img_url: 预览图 URL（fileId 含 * 时必填）
            guid: 设备 GUID
        """
        return self._call('/msg/sendVideo', {
            'guid': guid or self.guid,
            'toId': to_id,
            'fileAesKey': file_aes_key,
            'fileId': file_id,
            'fileMd5': file_md5,
            'fileSize': file_size,
            'filename': filename,
            'duration': duration,
            'coverImageSize': cover_image_size,
            'previewImgUrl': preview_img_url,
        })

    def send_mini_program(self, to_id: str, app_id: str, page_path: str,
                          title: str = '', app_name: str = '', desc: str = '',
                          icon_url: str = '', username: str = '',
                          cover_image_id: str = '', cover_image_aes_key: str = '',
                          cover_image_md5: str = '', cover_image_size: int = 0,
                          guid: str = '') -> dict:
        """
        发送小程序卡片消息（通过群发助手接口发送 type=78 消息）

        Args:
            to_id: 接收者 ID（联系人 userId 或群 roomId）
            app_id: 小程序 appId
            page_path: 小程序页面路径
            title: 小程序卡片标题
            app_name: 小程序名称
            desc: 小程序描述
            icon_url: 小程序图标 URL（HTTP 地址）
            username: 小程序原始 ID
            cover_image_id: 封面图 fileId（如有）
            cover_image_aes_key: 封面图 AES Key（如有）
            cover_image_md5: 封面图 MD5（如有）
            cover_image_size: 封面图大小（字节）
            guid: 设备 GUID

        Returns:
            QiWe 响应
        """
        msg_data = {
            'appId': app_id,
            'pagePath': page_path,
        }
        if title:
            msg_data['title'] = title
        if app_name:
            msg_data['appName'] = app_name
        if desc:
            msg_data['desc'] = desc
        if icon_url:
            msg_data['iconUrl'] = icon_url
        if username:
            msg_data['username'] = username
        if cover_image_id:
            msg_data['coverImageId'] = cover_image_id
        if cover_image_aes_key:
            msg_data['coverImageAesKey'] = cover_image_aes_key
        if cover_image_md5:
            msg_data['coverImageMd5'] = cover_image_md5
        if cover_image_size:
            msg_data['coverImageSize'] = cover_image_size

        return self._call('/msg/sendGroupMsg', {
            'guid': guid or self.guid,
            'toIdList': [to_id],
            'msgList': [{'type': 78, 'msgData': msg_data}],
            'sendType': 0,
        })

    def send_weapp(self, to_id: str, app_id: str, page_path: str,
                   title: str = '', app_name: str = '', desc: str = '',
                   icon_url: str = '', username: str = '', thumb_url: str = '',
                   guid: str = '') -> dict:
        """
        发送小程序卡片消息（通过 /msg/sendWeapp 接口）。

        与 send_mini_program 不同，此接口支持 thumbUrl（封面图 HTTP URL），
        转发接收到的小程序卡片时，好友端能正常显示封面图。

        Args:
            to_id: 接收者 ID（联系人 userId 或群 roomId）
            app_id: 小程序 appId
            page_path: 小程序页面路径
            title: 小程序卡片标题
            app_name: 小程序名称
            desc: 小程序描述
            icon_url: 小程序图标 URL（HTTP 地址）
            username: 小程序原始 ID
            thumb_url: 封面图 URL（HTTP 地址）
            guid: 设备 GUID

        Returns:
            QiWe 响应
        """
        params = {
            'guid': guid or self.guid,
            'toId': to_id,
            'appId': app_id,
            'pagePath': page_path,
        }
        if title:
            params['title'] = title
        if app_name:
            params['appName'] = app_name
        if desc:
            params['desc'] = desc
        if icon_url:
            params['iconUrl'] = icon_url
        if username:
            params['username'] = username
        if thumb_url:
            params['thumbUrl'] = thumb_url
        return self._call('/msg/sendWeapp', params)

    # ============================================================
    # 群发消息
    # ============================================================

    def send_group_msg(self, to_id_list: list, msg_list: list,
                       send_type: int = 0, guid: str = '') -> dict:
        """
        群发助手发送

        Args:
            to_id_list: 接收者 ID 列表
            msg_list: 消息列表，每项 {msgData: {...}, type: 0}
                      type: 0=文本, 13=链接, 14=图片, 15=文件, 23=视频, 78=小程序
            send_type: 0=外部联系人, 1=外部群
            guid: 设备 GUID
        """
        return self._call('/msg/sendGroupMsg', {
            'guid': guid or self.guid,
            'toIdList': to_id_list,
            'msgList': msg_list,
            'sendType': send_type,
        })

    # ============================================================
    # 朋友圈
    # ============================================================

    def post_moments(self, content: str, post_type: int = 0,
                     media_list: list = None, link_info: dict = None,
                     visible_user_id_list: list = None,
                     guid: str = '') -> dict:
        """
        发朋友圈

        Args:
            content: 文案内容
            post_type: 0=图片/视频, 1=链接/视频号
            media_list: 媒体列表 [{fileType, fileSize, fileId, videoLength, fileWidth, fileHeight}]
            link_info: 链接信息 {title, contentUrl, wxFinderInfo}
            visible_user_id_list: 可见好友 userId 列表（空/None=全部可见）
            guid: 设备 GUID
        """
        params = {
            'guid': guid or self.guid,
            'postType': post_type,
            'content': content,
            'visibleUserIdList': visible_user_id_list or [],
            'mediaList': media_list or [],
        }
        if link_info:
            params['linkInfo'] = link_info
        return self._call('/sns/postSns', params)

    # ============================================================
    # 联系人管理
    # ============================================================

    def get_contact_list(self, current_seq: int = 0, limit: int = 500,
                         biz_type: int = 1, guid: str = '') -> dict:
        """
        获取外部联系人列表（分页 — 增量同步接口）

        Args:
            current_seq: 分页游标，首次传 0；下次传返回值 currentSeq
            limit: 每页数量
            biz_type: 1=外部联系人信息变动数据，2=好友申请通知
            guid: 设备 GUID

        Returns:
            {currentSeq, contactCount, hasMore, contactList: [{userId, nickname, remark, avatarUrl, contactType, ...}]}
        """
        return self._call('/contact/getWxContactList', {
            'guid': guid or self.guid,
            'currentSeq': current_seq,
            'limit': limit,
            'bizType': biz_type,
        })

    def get_internal_contact_list(self, current_version: str = '',
                                  client_version: str = '',
                                  limit: int = 1000, guid: str = '') -> dict:
        """
        获取内部联系人（同事）列表

        内部联系人接口 /contact/getWxWorkContactList 分页使用 currentVersion 游标，
        首次传空字符串，之后传上一次返回的 currentVersion。

        Returns:
            {contactCount, contactList: [{userId, partyId}], currentVersion, hasMore}
        """
        return self._call('/contact/getWxWorkContactList', {
            'guid': guid or self.guid,
            'clientVersion': client_version,
            'limit': limit,
            'currentVersion': current_version,
        })

    def get_session_list(self, current_seq: int = 0, guid: str = '') -> dict:
        """
        获取会话列表（好友 + 群聊 + 系统）

        这是获取用户实际有聊天记录的全部对象的最完整接口：
        - sessionType=0: 好友（sessionId = userId）
        - sessionType=1: 群聊（sessionId = roomId）
        - sessionType=3: 系统会话

        Returns:
            {currentSeq, hasMore, sessionCount, sessionList: [{sessionId, sessionType}]}
        """
        return self._call('/session/getSessionPage', {
            'guid': guid or self.guid,
            'currentSeq': current_seq,
        })

    def get_contact_detail(self, user_id_list: list, guid: str = '') -> dict:
        """
        批量获取联系人详情

        Args:
            user_id_list: 联系人 userId 列表
            guid: 设备 GUID
        """
        return self._call('/contact/batchGetUserinfo', {
            'guid': guid or self.guid,
            'userIdList': user_id_list,
        })

    def add_tag_to_contact(self, user_id: str, label_id_list: list,
                           label_super_id_list: list,
                           label_owner_list: list,
                           guid: str = '') -> dict:
        """
        给联系人打标签（增加客户标签）

        Args:
            user_id: 联系人 userId
            label_id_list: 标签 ID 列表
            label_super_id_list: 标签分组 ID 列表（与 label_id_list 一一对应）
            label_owner_list: 标签所有者列表（个人标签=创建人userId，企业标签=corpId）
            guid: 设备 GUID
        """
        return self._call('/label/contactEditLabel', {
            'guid': guid or self.guid,
            'opType': 1,
            'paramList': [{
                'userId': user_id,
                'labelIdList': label_id_list,
                'labelSuperIdList': label_super_id_list,
                'labelOwnerList': label_owner_list,
            }],
        })

    def remove_tag_from_contact(self, user_id: str, label_id_list: list,
                                label_super_id_list: list,
                                label_owner_list: list,
                                guid: str = '') -> dict:
        """
        移除联系人标签（删除客户标签）

        Args:
            user_id: 联系人 userId
            label_id_list: 标签 ID 列表
            label_super_id_list: 标签分组 ID 列表
            label_owner_list: 标签所有者列表
            guid: 设备 GUID
        """
        return self._call('/label/contactEditLabel', {
            'guid': guid or self.guid,
            'opType': 2,
            'paramList': [{
                'userId': user_id,
                'labelIdList': label_id_list,
                'labelSuperIdList': label_super_id_list,
                'labelOwnerList': label_owner_list,
            }],
        })

    # ============================================================
    # 群聊管理
    # ============================================================

    def get_group_list(self, next_start_index: int = 0, guid: str = '') -> dict:
        """
        获取群聊列表（分页）

        Args:
            next_start_index: 分页游标，首次传 0
            guid: 设备 GUID

        Returns:
            {hasMore, nextStartIndex, roomCount, roomList: [{roomId, roomName, roomOwnerId, ...}]}
        """
        return self._call('/room/getRoomList', {
            'guid': guid or self.guid,
            'nextStartIndex': next_start_index,
        })

    def get_group_members(self, room_id_list: list, guid: str = '') -> dict:
        """
        批量获取群详情（含成员列表）

        Args:
            room_id_list: 群 ID 列表
            guid: 设备 GUID

        Returns:
            {roomList: [{roomId, memberList: [{userId, name, isAdmin, ...}], ...}]}
        """
        return self._call('/room/batchGetRoomDetail', {
            'guid': guid or self.guid,
            'roomIdList': room_id_list,
        })

    # ============================================================
    # 标签管理
    # ============================================================

    def get_tag_list(self, current_seq: int = 0, label_type: int = 2,
                     guid: str = '') -> dict:
        """
        获取标签列表（分页）

        Args:
            current_seq: 分页游标，首次传 0
            label_type: 1=企业标签, 2=个人标签
            guid: 设备 GUID

        Returns:
            {currentSeq, hasMore, labelCount, labelList: [{labelId, name, labelType, ...}]}
        """
        return self._call('/label/syncLabelList', {
            'guid': guid or self.guid,
            'currentSeq': current_seq,
            'labelType': label_type,
        })

    def create_tag(self, label_name: str, label_super_id: str = '0',
                   guid: str = '') -> dict:
        """
        创建个人标签

        Args:
            label_name: 标签名称
            label_super_id: 标签分组 ID（默认 '0' 表示根分组）
            guid: 设备 GUID
        """
        return self._call('/label/editLabel', {
            'guid': guid or self.guid,
            'opType': 1,  # 1=新建
            'paramList': [{
                'labelId': '',
                'labelSuperId': label_super_id,
                'labelName': label_name,
            }],
        })

    def delete_tag(self, label_id: str, guid: str = '') -> dict:
        """
        删除个人标签

        Args:
            label_id: 标签 ID
            guid: 设备 GUID
        """
        return self._call('/label/editLabel', {
            'guid': guid or self.guid,
            'opType': 2,  # 2=删除
            'paramList': [{
                'labelId': label_id,
                'labelSuperId': '',
                'labelName': '',
            }],
        })

    # ============================================================
    # 设备管理
    # ============================================================

    def get_device_status(self, guid: str = '') -> dict:
        """
        获取设备登录状态

        Args:
            guid: 设备 GUID

        Returns:
            {userId, nickname, userOnlineStatus, lastActiveTime, corpName, ...}
            userOnlineStatus: -1=未登录需扫码, 0=未登录可免扫码, 1=已扫码待确认,
                              2=登录成功, 4=用户取消, 10=待6位验证码
        """
        return self._call('/login/checkLogin', {
            'guid': guid or self.guid,
        })

    def get_device_info(self, guid: str = '') -> dict:
        """
        获取设备信息（等同于 get_device_status）
        保留此方法以兼容旧接口
        """
        return self.get_device_status(guid=guid)

    def set_callback(self, callback_url: str,
                     auth_type: str = '', auth_secret: str = '') -> dict:
        """
        设置 Webhook 回调地址

        QiWe 网关在收到消息时会向此 URL POST webhook 事件。
        回调地址须为公网可访问的 HTTPS URL。
        配置作用于整个 Token，所有设备共用同一个回调地址。
        注意：setCallback 是 Token 级别操作，不应传入 guid 参数。

        Args:
            callback_url: 公网可访问的 HTTPS 回调 URL
            auth_type: 鉴权类型，默认空字符串（不鉴权）
            auth_secret: 鉴权密钥，默认空字符串

        Returns:
            API 响应数据
        """
        # 保存原始 guid，临时清除避免 _call 自动注入
        saved_guid = self.guid
        self.guid = ''
        try:
            return self._call('/client/setCallback', {
                'callbackUrl': callback_url,
                'authType': auth_type,
                'authSecret': auth_secret,
            })
        finally:
            self.guid = saved_guid

    # ============================================================
    # 设备创建与登录
    # ============================================================

    def create_client(self, area_code: int = 0, proxy_url: str = '',
                      device_name: str = '', device_type: int = 0,
                      client_version: str = '') -> dict:
        """
        创建设备实例（登录步骤1）

        重要：创建/恢复设备后 5 分钟内未完成登录，该实例将自动清理。
        代理地区务必与企微手机登录所在地一致，严禁异省，否则可能导致登录失败。

        注意：createClient 是 Token 级别操作，不应传入 guid 参数。

        Args:
            area_code: 代理地区代码（省份 areaCode，如 440000=广东）
            proxy_url: 代理 URL（与 areaCode 二选一，优先使用 areaCode）
            device_name: 设备名称
            device_type: 设备类型（0=iPad 推荐，1=Windows）
            client_version: 客户端版本

        Returns:
            {guid: str} — 新创建的设备 GUID
        """
        saved_guid = self.guid
        self.guid = ''
        try:
            params = {}
            if area_code:
                params['areaCode'] = area_code
            if proxy_url:
                params['proxyUrl'] = proxy_url
            if device_name:
                params['deviceName'] = device_name
            if device_type is not None:
                params['deviceType'] = device_type
            if client_version:
                params['clientVersion'] = client_version
            return self._call('/client/createClient', params)
        finally:
            self.guid = saved_guid

    def get_login_qrcode(self, guid: str = '', use_cache: bool = True) -> dict:
        """
        获取企微登录二维码（登录步骤2）

        Args:
            guid: 设备 GUID
            use_cache: 是否使用缓存二维码（默认 True）

        Returns:
            {loginQrcodeBase64Data: str, loginQrcodeKey: str}
            loginQrcodeBase64Data 是 base64 编码的二维码图片（含 data:image 前缀）
        """
        return self._call('/login/getLoginQrcode', {
            'guid': guid or self.guid,
            'useCache': use_cache,
        })

    def verify_login_qrcode(self, guid: str = '', code: str = '') -> dict:
        """
        提交 6 位验证码校验（登录步骤4）

        收到 6 位数验证码后执行此接口验证。
        验证码校验成功后，必须再次调用 checkLogin（get_device_status），
        此时状态码将变为 2，代表正式登录成功。

        Args:
            guid: 设备 GUID
            code: 6 位验证码

        Returns:
            API 响应数据
        """
        return self._call('/login/verifyLoginQrcode', {
            'guid': guid or self.guid,
            'code': code,
        })

    def check_login_qrcode(self, guid: str = '') -> dict:
        """
        检查扫码登录状态（登录步骤3 — 使用 checkLoginQrCode 接口）

        与 get_device_status（checkLogin）不同，此接口返回 loginQrcodeStatus 字段，
        状态码含义：
          -1=未登录需扫码, 0=未登录可免扫码, 1=已扫码待确认,
           2=登录成功, 3=登录失败, 4=用户取消,
          10=已扫码确认待检测6位验证码

        Args:
            guid: 设备 GUID

        Returns:
            {loginQrcodeStatus, loginQrcodeKey, nickname, userId,
             corpId, corpLogo, avatarUrl}
        """
        return self._call('/login/checkLoginQrCode', {
            'guid': guid or self.guid,
        })

    # ============================================================
    # 媒体文件
    # ============================================================

    def upload_media(self, file_path: str, guid: str = '') -> dict:
        """
        上传媒体文件（本地路径）

        Args:
            file_path: 本地文件路径
            guid: 设备 GUID

        Note:
            QiWe 提供多种上传方式（企微文件异步上传、本地文件上传、文件上传-URL 等）
            当前使用本地文件上传 (/media/uploadLocalFile)
        """
        return self._call('/media/uploadLocalFile', {
            'guid': guid or self.guid,
            'filePath': file_path,
        })

    def upload_by_url(self, file_url: str, filename: str, file_type: int,
                      guid: str = '') -> dict:
        """
        通过 URL 上传文件到 QiWe CDN（适用于服务器端已有可访问 URL 的场景）

        QiWe 会从 fileUrl 下载文件并返回 fileId 等参数，
        后续用这些参数调用 sendImage / sendFile / sendVoice。

        Args:
            file_url: 文件的可公开访问 URL（需 QiWe 服务器可下载）
            filename: 文件名（含扩展名）
            file_type: 文件类型代码 — 1=图片, 2=视频, 5=语音/文件（fileType=3是视频缩略图，不适用于语音）
            guid: 设备 GUID

        Returns:
            {fileAesKey, fileId, fileKey, fileMd5, fileSize, fileThumbSize, filename, cloudUrl}
        """
        return self._call('/cloud/cdnBigUploadByUrl', {
            'guid': guid or self.guid,
            'fileUrl': file_url,
            'filename': filename,
            'fileType': file_type,
        })

    def send_voice(self, to_id: str, file_aes_key: str, file_id: str,
                   file_size: int, voice_time: int, guid: str = '') -> dict:
        """
        发送语音消息

        Args:
            to_id: 接收者 ID
            file_aes_key: 文件 AES Key
            file_id: 文件 ID（来自 upload_by_url 返回值）
            file_size: 文件大小（字节）
            voice_time: 语音时长（秒）
            guid: 设备 GUID
        """
        return self._call('/msg/sendVoice', {
            'guid': guid or self.guid,
            'toId': to_id,
            'fileAesKey': file_aes_key,
            'fileId': file_id,
            'fileSize': file_size,
            'voiceTime': voice_time,
        })

    def download_media(self, file_id: str, file_aes_key: str = '', file_md5: str = '', guid: str = '') -> dict:
        """
        通过 fileId 获取媒体文件下载 URL（CDN 转链接）

        使用 /cloud/cdnWxDownload 接口，返回官方 CDN 地址。
        响应格式: {fileUrl, coverUrl, fileMd5}

        注意：此接口仅适用于图片文件，对于语音文件返回空 URL。
        语音文件请使用 download_media_file() 方法。

        Args:
            file_id: 文件 ID（来自 webhook msgData.fileId）
            file_aes_key: 文件 AES Key（来自 webhook msgData.fileAesKey）
            file_md5: 文件 MD5（来自 webhook msgData.fileMd5）
            guid: 设备 GUID
        """
        return self._call('/cloud/cdnWxDownload', {
            'guid': guid or self.guid,
            'fileId': file_id,
            'fileAeskey': file_aes_key,
            'fileMd5': file_md5,
        })

    def download_media_file(self, file_id: str, file_aes_key: str = '',
                            file_md5: str = '', file_size: int = 0,
                            file_type: int = 5, guid: str = '') -> dict:
        """
        下载媒体文件到阿里云 OSS，返回可访问的 cloudUrl

        使用 /cloud/wxWorkDownload 接口，实际下载文件并返回 OSS URL。
        适用于语音文件（SILK 格式）和其他 cdnWxDownload 无法处理的文件。

        Args:
            file_id: 文件 ID（来自 webhook msgData.fileId）
            file_aes_key: 文件 AES Key（来自 webhook msgData.fileAesKey）
            file_md5: 文件 MD5（来自 webhook msgData.fileMd5）
            file_size: 文件大小（字节，来自 webhook msgData.fileSize）
            file_type: 文件类型代码 — 5=语音/文件（默认）
            guid: 设备 GUID

        Returns:
            {cloudUrl, fileMd5, ...} — cloudUrl 为阿里云 OSS 可下载地址
        """
        return self._call('/cloud/wxWorkDownload', {
            'guid': guid or self.guid,
            'fileId': file_id,
            'fileAeskey': file_aes_key,
            'fileMd5': file_md5,
            'fileSize': file_size,
            'fileType': file_type,
        })


def get_qiwei_client(device=None) -> QiWeiClient:
    """
    工厂函数：根据设备获取 QiWeiClient

    优先级：
      1. 设备绑定的 qiwe_token（旧模式兼容）
      2. 全局 Token（WecomGlobalConfig → settings.QIWEI_GLOBAL_TOKEN）

    Args:
        device: WecomDevice 实例（None 时用全局配置）

    Returns:
        QiWeiClient 实例
    """
    if device and device.qiwe_token:
        return QiWeiClient(token=device.qiwe_token, guid=device.guid)
    # 使用全局 Token
    return get_global_qiwei_client(guid=device.guid if device else '')


def get_global_qiwei_client(guid: str = '') -> QiWeiClient:
    """
    工厂函数：使用全局 Token 创建 QiWeiClient

    Token 来源优先级：
      1. WecomGlobalConfig 数据库记录（管理后台配置）
      2. settings.QIWEI_GLOBAL_TOKEN（.env 环境变量）
      3. QIWEI_DEFAULT_TOKEN（模块级默认值，通常为空）

    Args:
        guid: 设备 GUID（createClient 等操作时传空）

    Returns:
        QiWeiClient 实例
    """
    token = ''
    base_url = ''

    # 优先从数据库获取全局配置
    try:
        from .models import WecomGlobalConfig
        config = WecomGlobalConfig.get_solo()
        if config.sdk_token:
            token = config.sdk_token
        if config.sdk_url:
            base_url = _normalize_qiwei_base_url(config.sdk_url)
    except Exception:
        pass

    # 降级到 settings 环境变量
    if not token:
        from django.conf import settings
        token = getattr(settings, 'QIWEI_GLOBAL_TOKEN', '') or QIWEI_DEFAULT_TOKEN
    if not base_url:
        from django.conf import settings
        raw_url = getattr(settings, 'QIWEI_GLOBAL_BASE_URL', '') or QIWEI_BASE_URL
        base_url = _normalize_qiwei_base_url(raw_url)

    return QiWeiClient(token=token, guid=guid, base_url=base_url)


def _normalize_qiwei_base_url(raw_url: str) -> str:
    """归一化 QiWe API base URL

    用户在 WecomGlobalConfig 可能填写各种形式的 URL，自动补全路径后缀并强制 https：
    - 完整:    https://manager.qiweapi.com/qiwe/api/qw/doApi → 保持不变
    - 前缀:    http://manager.qiweapi.com/qiwe/              → https://manager.qiweapi.com/qiwe/api/qw/doApi
    - 域名:    https://manager.qiweapi.com                    → https://manager.qiweapi.com/qiwe/api/qw/doApi
    - 域名:    manager.qiweapi.com                            → https://manager.qiweapi.com/qiwe/api/qw/doApi
    """
    if not raw_url:
        return QIWEI_BASE_URL

    url = raw_url.strip().rstrip('/')

    # 自动补 https
    if url.startswith('http://'):
        url = 'https://' + url[len('http://'):]
    elif not url.startswith('https://') and not url.startswith('http://'):
        # 没有协议头，视为裸域名
        url = 'https://' + url

    # 已含完整端点路径，直接返回
    if url.endswith('/doApi'):
        return url

    # 自动补全 QiWe 网关 API 路径
    # 标准路径: {base}/api/qw/doApi
    # 用户可能填写到 /qiwe 或 /qiwe/，需补全 api/qw/doApi
    if url.endswith('/qiwe'):
        return url + '/api/qw/doApi'

    # 默认追加完整路径
    return url + '/qiwe/api/qw/doApi'
