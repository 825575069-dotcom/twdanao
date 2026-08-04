"""
apps/wecom/models.py
企微数据层 — 核心模型
对齐《营销跟客模块-架构设计文档 v1.0》第 2.1 节
"""
from django.db import models


class WecomGlobalConfig(models.Model):
    """企微全局配置（singleton — 整个平台只有一条记录）"""
    sdk_url = models.URLField(
        verbose_name='企微SDK地址',
        default='https://manager.qiweapi.com/qiwe/api/qw/doApi',
    )
    sdk_token = models.CharField(max_length=500, verbose_name='SDK Token')
    callback_token = models.CharField(
        max_length=500, blank=True, default='', verbose_name='回调 Token'
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'wecom_global_config'
        verbose_name = '企微全局配置'
        verbose_name_plural = verbose_name

    def __str__(self):
        return '企微全局配置'

    @classmethod
    def get_solo(cls):
        """获取单例配置（不存在时自动创建空记录）"""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class WecomNumber(models.Model):
    """企微号（天网大脑后台创建的企微设备实例）

    管理员在后台创建企微号 → 选择租户 + 省份 + 备注 + 有效期 + 收费标准
    → 调用 QiWe createClient → 保存返回的 guid
    租户在前端用 guid + 备注 + 手机号绑定到 WecomDevice
    """
    STATUS_CHOICES = [
        ('created', '已创建'),       # createClient 成功，等待租户绑定
        ('bound', '已绑定'),         # 租户已绑定 WecomDevice
        ('expired', '已过期'),       # 超出有效期
        ('offline', '已下线'),       # 管理员手动下线
    ]

    guid = models.CharField(max_length=100, unique=True, verbose_name='设备GUID')
    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='wecom_numbers', verbose_name='归属租户'
    )
    province_code = models.CharField(max_length=10, verbose_name='设备归属省代码')
    province_name = models.CharField(max_length=50, blank=True, default='', verbose_name='设备归属省名称')
    remark = models.CharField(max_length=200, blank=True, default='', verbose_name='备注（归属企业）')
    device_name = models.CharField(max_length=200, blank=True, default='', verbose_name='设备名称')
    device_type = models.IntegerField(default=0, verbose_name='设备类型(0=iPad,1=Windows)')
    proxy_url = models.URLField(blank=True, default='', verbose_name='代理URL')
    client_version = models.CharField(max_length=50, blank=True, default='', verbose_name='客户端版本')
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name='有效期')
    price = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name='收费标准(元/月)'
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='created', verbose_name='企微号状态'
    )
    bound_device = models.OneToOneField(
        'WecomDevice', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='wecom_number_link', verbose_name='绑定的设备'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'wecom_number'
        verbose_name = '企微号'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.remark or self.device_name} ({self.guid[:8]}...)'


class WecomDevice(models.Model):
    """企微设备（租户绑定的企微账号实例）"""
    STATUS_CHOICES = [
        ('online', '在线'),
        ('offline', '离线'),
        ('banned', '已封禁'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='wecom_devices', verbose_name='所属租户'
    )
    wecom_number = models.ForeignKey(
        WecomNumber, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='devices', verbose_name='关联企微号'
    )
    guid = models.CharField(max_length=100, unique=True, verbose_name='设备GUID')
    name = models.CharField(max_length=200, verbose_name='设备名称')
    mobile = models.CharField(max_length=20, blank=True, default='', verbose_name='绑定手机号')
    remark = models.CharField(max_length=200, blank=True, default='', verbose_name='绑定备注')
    qw_user_id = models.CharField(max_length=100, blank=True, default='', verbose_name='企微用户ID')
    qw_account = models.CharField(max_length=100, blank=True, default='', verbose_name='企微账号(手机号)')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='offline', verbose_name='设备状态')
    ai_enabled = models.BooleanField(default=True, verbose_name='设备级AI开关')
    callback_url = models.URLField(blank=True, default='', verbose_name='回调地址')
    last_heartbeat = models.DateTimeField(null=True, blank=True, verbose_name='最后心跳时间')
    avatar = models.URLField(blank=True, default='', verbose_name='头像URL')
    qiwe_token = models.CharField(max_length=500, blank=True, default='', verbose_name='QiWe Token（旧字段，保留兼容）')
    province_code = models.CharField(max_length=10, blank=True, default='', verbose_name='设备归属省代码')
    login_status = models.IntegerField(null=True, blank=True, verbose_name='登录状态码')
    bound_at = models.DateTimeField(null=True, blank=True, verbose_name='绑定时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'wecom_device'
        verbose_name = '企微设备'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.guid[:8]}...)'


class WecomContact(models.Model):
    """企微联系人（外部微信好友 + 内部企微同事）"""
    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='wecom_contacts', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        WecomDevice, on_delete=models.CASCADE,
        related_name='contacts', verbose_name='所属企微账号'
    )
    external_userid = models.CharField(max_length=200, verbose_name='企微联系人ID')
    name = models.CharField(max_length=200, blank=True, default='', verbose_name='企微昵称')
    remark = models.CharField(max_length=200, blank=True, default='', verbose_name='企微备注名')
    avatar = models.URLField(blank=True, default='', verbose_name='头像URL')
    enterprise_id = models.CharField(max_length=100, blank=True, default='', verbose_name='统一社会信用代码')
    # 联系人来源类型：wechat=外部微信好友, wecom=内部企微同事, group_chat=群聊成员
    CONTACT_SOURCE_CHOICES = [
        ('wechat', '微信好友'),
        ('wecom', '企微同事'),
        ('group_chat', '群聊成员'),
        ('unknown', '未知'),
    ]
    contact_source = models.CharField(
        max_length=20, choices=CONTACT_SOURCE_CHOICES,
        default='unknown', verbose_name='联系人来源',
    )
    # QiWe contactType: 2057=正常外部好友, 2=内部同事, 0=双删, 8=我删客户, 2049=客户删我
    qiwe_contact_type = models.IntegerField(default=0, verbose_name='QiWe联系人类型')
    qiwe_add_time = models.BigIntegerField(default=0, verbose_name='QiWe添加时间')
    gender = models.IntegerField(default=0, verbose_name='性别 0未设置 1男 2女')
    mobile = models.CharField(max_length=50, blank=True, default='', verbose_name='手机号')
    ai_hosted = models.BooleanField(default=True, verbose_name='客户级AI托管开关')
    is_pinned = models.BooleanField(default=False, verbose_name='是否置顶')
    pinned_at = models.DateTimeField(null=True, blank=True, verbose_name='置顶时间')
    last_contacted_at = models.DateTimeField(null=True, blank=True, verbose_name='最后联系时间')
    tags = models.ManyToManyField(
        'WecomTag', blank=True, related_name='contacts', verbose_name='标签'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'wecom_contact'
        verbose_name = '企微联系人'
        verbose_name_plural = verbose_name
        ordering = ['-is_pinned', '-pinned_at', '-updated_at']
        unique_together = (('external_userid', 'device'),)

    def __str__(self):
        return self.remark or self.name or self.external_userid


class WecomMediaFile(models.Model):
    """企微媒体文件"""
    FILE_TYPE_CHOICES = [
        ('image', '图片'),
        ('video', '视频'),
        ('file', '文件'),
        ('voice', '语音'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='wecom_media_files', verbose_name='所属租户'
    )
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES, default='image', verbose_name='文件类型')
    qiwe_file_id = models.CharField(max_length=500, blank=True, default='', verbose_name='QiWe文件ID')
    local_path = models.CharField(max_length=500, blank=True, default='', verbose_name='本地存储路径')
    url = models.URLField(blank=True, default='', verbose_name='可访问URL')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'wecom_media_file'
        verbose_name = '企微媒体文件'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.file_type} - {self.qiwe_file_id[:20] or self.local_path[:20]}'


class WecomGroupRoom(models.Model):
    """企微群聊"""
    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='wecom_group_rooms', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        WecomDevice, on_delete=models.CASCADE,
        related_name='group_rooms', verbose_name='所属设备'
    )
    group_id = models.CharField(max_length=200, verbose_name='群ID')
    name = models.CharField(max_length=200, blank=True, default='', verbose_name='群名')
    owner_id = models.CharField(max_length=200, blank=True, default='', verbose_name='群主ID')
    member_count = models.IntegerField(default=0, verbose_name='成员数')
    member_user_ids = models.JSONField(default=list, blank=True, verbose_name='群成员userId列表')
    tags = models.ManyToManyField(
        'WecomTag', blank=True, related_name='group_rooms', verbose_name='标签'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'wecom_group_room'
        verbose_name = '企微群聊'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        unique_together = (('group_id', 'device'),)

    def __str__(self):
        return self.name or self.group_id


class WecomMessage(models.Model):
    """企微消息"""
    DIRECTION_CHOICES = [
        ('inbound', '收到'),
        ('outbound', '发出'),
    ]
    MSG_TYPE_CHOICES = [
        ('text', '文本'),
        ('image', '图片'),
        ('file', '文件'),
        ('link', '链接'),
        ('video', '视频'),
        ('voice', '语音'),
        ('miniprogram', '小程序'),
    ]
    CONVERSATION_TYPE_CHOICES = [
        ('personal', '个人'),
        ('group', '群聊'),
    ]
    STATUS_CHOICES = [
        ('sending', '发送中'),
        ('sent', '已发送'),
        ('delivered', '已送达'),
        ('read', '已读'),
        ('failed', '发送失败'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='wecom_messages', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        WecomDevice, on_delete=models.CASCADE,
        related_name='messages', verbose_name='所属设备'
    )
    contact = models.ForeignKey(
        WecomContact, on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='messages', verbose_name='关联联系人'
    )
    room = models.ForeignKey(
        WecomGroupRoom, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='messages', verbose_name='所属群聊'
    )
    conversation_type = models.CharField(
        max_length=20, choices=CONVERSATION_TYPE_CHOICES,
        default='personal', verbose_name='会话类型'
    )
    direction = models.CharField(max_length=20, choices=DIRECTION_CHOICES, verbose_name='消息方向')
    msg_type = models.CharField(max_length=20, choices=MSG_TYPE_CHOICES, default='text', verbose_name='消息类型')
    content = models.TextField(blank=True, default='', verbose_name='消息内容')
    media_file = models.ForeignKey(
        WecomMediaFile, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='messages', verbose_name='媒体附件'
    )
    raw_data = models.JSONField(default=dict, blank=True, verbose_name='QiWe原始回调数据')
    ai_generated = models.BooleanField(default=False, verbose_name='是否AI生成')
    is_recalled = models.BooleanField(default=False, verbose_name='是否已撤回')
    quoted_message = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='quotes', verbose_name='引用的消息'
    )
    msg_server_id = models.BigIntegerField(null=True, blank=True, verbose_name='QiWe消息服务器ID')
    msg_unique_identifier = models.CharField(max_length=200, blank=True, default='', verbose_name='QiWe消息唯一标识')
    # 乐观更新：前端生成的 UUID，用于匹配发送中→已发送的状态变更
    client_msg_id = models.UUIDField(null=True, blank=True, db_index=True, verbose_name='客户端消息ID（乐观更新）')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='sent', verbose_name='消息状态'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='消息时间')

    class Meta:
        db_table = 'wecom_message'
        verbose_name = '企微消息'
        verbose_name_plural = verbose_name
        ordering = ['created_at']

    def __str__(self):
        return f'{self.direction}: {self.content[:50]}'


class WecomTagGroup(models.Model):
    """企微标签分组"""
    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='wecom_tag_groups', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        WecomDevice, on_delete=models.CASCADE,
        related_name='tag_groups', verbose_name='所属企微账号'
    )
    group_id = models.CharField(max_length=100, blank=True, default='', verbose_name='QiWe分组ID')
    name = models.CharField(max_length=100, verbose_name='分组名称')
    order = models.IntegerField(default=0, verbose_name='排序')
    is_customer_level = models.BooleanField(default=False, verbose_name='是否客户等级分组')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'wecom_tag_group'
        verbose_name = '企微标签分组'
        verbose_name_plural = verbose_name
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class WecomTag(models.Model):
    """企微标签"""
    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='wecom_tags', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        WecomDevice, on_delete=models.CASCADE,
        related_name='tags', verbose_name='所属企微账号', null=True, blank=True
    )
    group = models.ForeignKey(
        WecomTagGroup, on_delete=models.SET_NULL,
        related_name='tags', verbose_name='所属分组', null=True, blank=True
    )
    tag_id = models.CharField(max_length=100, blank=True, default='', verbose_name='QiWe标签ID')
    name = models.CharField(max_length=100, verbose_name='标签名称')
    color = models.CharField(max_length=20, blank=True, default='#1890ff', verbose_name='标签颜色')
    order = models.IntegerField(default=0, verbose_name='排序')
    is_customer_level = models.BooleanField(default=False, verbose_name='是否客户等级')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'wecom_tag'
        verbose_name = '企微标签'
        verbose_name_plural = verbose_name
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class MessageFavorite(models.Model):
    """消息收藏（支持文案/表情/图片/文件/语音/小程序）"""
    MSG_TYPE_CHOICES = [
        ('text', '文本'),
        ('emoji', '表情'),
        ('image', '图片'),
        ('file', '文件'),
        ('voice', '语音'),
        ('miniprogram', '小程序'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='message_favorites', verbose_name='所属租户'
    )
    msg_type = models.CharField(max_length=20, choices=MSG_TYPE_CHOICES, default='text', verbose_name='收藏类型')
    content = models.TextField(blank=True, default='', verbose_name='文本内容/显示文字')
    media_file_url = models.URLField(blank=True, default='', verbose_name='媒体文件URL')
    media_file_name = models.CharField(max_length=500, blank=True, default='', verbose_name='媒体文件名')
    raw_data = models.JSONField(default=dict, blank=True, verbose_name='原始消息数据（小程序等需要）')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='收藏时间')

    class Meta:
        db_table = 'wecom_message_favorite'
        verbose_name = '消息收藏'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.msg_type}: {self.content[:30] or self.media_file_name[:30]}'


class WecomDraft(models.Model):
    """企微聊天草稿（按会话隔离，后端持久化）"""
    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='wecom_drafts', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        WecomDevice, on_delete=models.CASCADE,
        related_name='drafts', verbose_name='所属设备'
    )
    conversation_type = models.CharField(
        max_length=20, choices=WecomMessage.CONVERSATION_TYPE_CHOICES,
        default='personal', verbose_name='会话类型'
    )
    conversation_id = models.IntegerField(verbose_name='会话ID（contact_id 或 room_id）')
    content = models.TextField(blank=True, default='', verbose_name='草稿文本内容')
    media_url = models.URLField(blank=True, default='', verbose_name='媒体URL')
    media_type = models.CharField(max_length=20, blank=True, default='', verbose_name='媒体类型')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'wecom_draft'
        verbose_name = '企微草稿'
        verbose_name_plural = verbose_name
        unique_together = (('tenant', 'device', 'conversation_type', 'conversation_id'),)
        ordering = ['-updated_at']

    def __str__(self):
        return f'Draft({self.conversation_type}:{self.conversation_id}): {self.content[:30]}'
