"""
apps/marketing_follow/models.py
营销跟客业务层 — 7 个模型
对齐《营销跟客模块-架构设计文档 v1.0》第 2.2 节
"""
from django.db import models


class ChatSetting(models.Model):
    """聊天设置（每个企微账号一套）"""
    REPLY_STYLE_CHOICES = [
        ('professional', '专业'),
        ('friendly', '友好'),
        ('lively', '活泼'),
        ('calm', '沉稳'),
    ]
    REPLY_LENGTH_CHOICES = [
        ('short', '简短'),
        ('medium', '适中'),
        ('detailed', '详细'),
    ]
    CUSTOMER_ADDRESS_CHOICES = [
        ('remark', '备注名'),
        ('nickname', '昵称'),
        ('surname_prefix', '姓+称谓'),
    ]
    # ── 单聊：非文本消息回复策略 ──
    NON_TEXT_STRATEGY_CHOICES = [
        ('ignore', '不回复'),
        ('reply_text', '回复指定文字'),
        ('reply_template', '回复话术模板'),
    ]
    # ── 群聊：@回复模式 ──
    GROUP_REPLY_MODE_CHOICES = [
        ('at_only', '仅@我时回复'),
        ('at_and_whitelist', '@我或白名单群回复'),
        ('all', '所有群消息都回复'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='chat_settings', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        'wecom.WecomDevice', on_delete=models.CASCADE,
        related_name='chat_settings', verbose_name='企微设备'
    )
    agent_id = models.CharField(max_length=100, blank=True, default='', verbose_name='绑定智能体agent_id')
    ai_enabled = models.BooleanField(default=True, verbose_name='企业级AI总开关')
    reply_style = models.CharField(max_length=20, choices=REPLY_STYLE_CHOICES, default='friendly', verbose_name='回复风格')
    reply_length = models.CharField(max_length=20, choices=REPLY_LENGTH_CHOICES, default='short', verbose_name='回复长度')
    customer_address = models.CharField(max_length=20, choices=CUSTOMER_ADDRESS_CHOICES, default='remark', verbose_name='客户称呼方式')
    ai_signature = models.BooleanField(default=False, verbose_name='AI回复是否附加签名')
    quick_replies = models.JSONField(default=list, blank=True, verbose_name='话术库(快捷回复模板)')
    forbidden_words = models.JSONField(default=list, blank=True, verbose_name='禁用词列表')
    work_hours_start = models.TimeField(null=True, blank=True, verbose_name='AI工作时间开始')
    work_hours_end = models.TimeField(null=True, blank=True, verbose_name='AI工作时间结束')

    # ════════════════════════════════════════════════════
    #  单聊设置
    # ════════════════════════════════════════════════════
    memory_rounds = models.IntegerField(
        default=10, verbose_name='AI记忆上下文轮数',
        help_text='读取最近N轮对话作为上下文（默认10）'
    )
    reply_delay_min = models.IntegerField(
        default=1, verbose_name='回复延迟最小(秒)',
        help_text='AI回复前随机等待的最小秒数'
    )
    reply_delay_max = models.IntegerField(
        default=3, verbose_name='回复延迟最大(秒)',
        help_text='AI回复前随机等待的最大秒数'
    )
    non_text_reply_strategy = models.CharField(
        max_length=20, choices=NON_TEXT_STRATEGY_CHOICES,
        default='reply_text', verbose_name='非文本/语音消息回复策略'
    )
    non_text_reply_content = models.TextField(
        blank=True, default='', verbose_name='非文本消息回复内容',
        help_text='当策略为reply_text时填入固定回复文字；reply_template时填入话术模板名'
    )
    stop_reply_keywords = models.JSONField(
        default=list, blank=True, verbose_name='AI停止回复关键词',
        help_text='收到包含这些关键词的消息时，AI自动停止回复（转为人工）'
    )

    # ════════════════════════════════════════════════════
    #  群聊设置
    # ════════════════════════════════════════════════════
    group_reply_mode = models.CharField(
        max_length=20, choices=GROUP_REPLY_MODE_CHOICES,
        default='at_only', verbose_name='群聊AI回复模式',
        help_text='控制AI在群聊中何时回复'
    )
    group_no_at_whitelist = models.JSONField(
        default=list, blank=True, verbose_name='群聊无@回复白名单',
        help_text='当模式为at_and_whitelist时，这些群无需@也回复（群ID列表）'
    )
    group_fixed_reply_enabled = models.BooleanField(
        default=False, verbose_name='群聊固定回复开关',
        help_text='开启后在固定时间段内自动回复群消息'
    )
    group_fixed_reply_start = models.TimeField(
        null=True, blank=True, verbose_name='群聊固定回复开始时间'
    )
    group_fixed_reply_end = models.TimeField(
        null=True, blank=True, verbose_name='群聊固定回复结束时间'
    )
    group_fixed_reply_rooms = models.JSONField(
        default=list, blank=True, verbose_name='群聊固定回复群列表',
        help_text='固定回复功能生效的群ID列表'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'mf_chat_setting'
        verbose_name = '聊天设置'
        verbose_name_plural = verbose_name
        unique_together = [('tenant', 'device')]

    def __str__(self):
        return f'{self.device.name} - 聊天设置'


class AiReplyTask(models.Model):
    """AI回复任务"""
    STATUS_CHOICES = [
        ('pending', '待处理'),
        ('processing', '处理中'),
        ('sent', '已发送'),
        ('failed', '失败'),
        ('skipped', '跳过'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='ai_reply_tasks', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        'wecom.WecomDevice', on_delete=models.CASCADE,
        related_name='ai_reply_tasks', verbose_name='企微设备'
    )
    contact = models.ForeignKey(
        'wecom.WecomContact', on_delete=models.CASCADE,
        related_name='ai_reply_tasks', verbose_name='联系人'
    )
    inbound_message = models.ForeignKey(
        'wecom.WecomMessage', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reply_tasks', verbose_name='触发消息'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    ai_content = models.TextField(blank=True, default='', verbose_name='AI生成回复内容')
    ai_segments = models.JSONField(default=list, blank=True, verbose_name='分段发送内容(模仿真人)')
    prompt_snapshot = models.TextField(blank=True, default='', verbose_name='生成时Prompt快照')
    llm_tokens = models.IntegerField(default=0, verbose_name='消耗token数')
    credit_cost = models.IntegerField(default=0, verbose_name='扣减积分数')
    error = models.TextField(blank=True, default='', verbose_name='失败原因')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name='发送时间')

    class Meta:
        db_table = 'mf_ai_reply_task'
        verbose_name = 'AI回复任务'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'AI回复 {self.contact} - {self.status}'


class ProactiveFollowTask(models.Model):
    """主动跟进任务"""
    TRIGGER_TYPE_CHOICES = [
        ('event', '事件触发'),
        ('schedule', '定时触发'),
        ('manual', '手动触发'),
    ]
    STATUS_CHOICES = [
        ('pending', '待发送'),
        ('sent', '已发送'),
        ('failed', '失败'),
        ('skipped', '跳过'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='proactive_follow_tasks', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        'wecom.WecomDevice', on_delete=models.CASCADE,
        related_name='proactive_follow_tasks', verbose_name='企微设备'
    )
    contact = models.ForeignKey(
        'wecom.WecomContact', on_delete=models.CASCADE,
        related_name='proactive_follow_tasks', verbose_name='联系人'
    )
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_TYPE_CHOICES, default='event', verbose_name='触发类型')
    trigger_event = models.JSONField(default=dict, blank=True, verbose_name='触发事件数据')
    agent_id = models.CharField(max_length=100, blank=True, default='', verbose_name='使用的智能体')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    ai_content = models.TextField(blank=True, default='', verbose_name='AI生成开场白')
    error = models.TextField(blank=True, default='', verbose_name='失败原因')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name='发送时间')

    class Meta:
        db_table = 'mf_proactive_follow_task'
        verbose_name = '主动跟进任务'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'主动跟进 {self.contact} - {self.status}'


class BroadcastTask(models.Model):
    """群发任务"""
    MATERIAL_TYPE_CHOICES = [
        ('text', '文本'),
        ('link', '图文链接'),
        ('miniprogram', '小程序卡片'),
    ]
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('pending', '待发送'),
        ('sending', '发送中'),
        ('completed', '已完成'),
        ('paused', '已暂停'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='broadcast_tasks', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        'wecom.WecomDevice', on_delete=models.CASCADE,
        related_name='broadcast_tasks', verbose_name='企微设备'
    )
    name = models.CharField(max_length=200, verbose_name='任务名称')
    material_type = models.CharField(max_length=20, choices=MATERIAL_TYPE_CHOICES, default='text', verbose_name='素材类型')
    material_content = models.JSONField(default=dict, blank=True, verbose_name='素材内容')
    filter_tags = models.JSONField(default=list, blank=True, verbose_name='接收者标签筛选')
    filter_conditions = models.JSONField(default=dict, blank=True, verbose_name='其他筛选条件')
    total_count = models.IntegerField(default=0, verbose_name='计划接收人数')
    sent_count = models.IntegerField(default=0, verbose_name='已发送数')
    failed_count = models.IntegerField(default=0, verbose_name='失败数')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='状态')
    scheduled_at = models.DateTimeField(null=True, blank=True, verbose_name='定时发送时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'mf_broadcast_task'
        verbose_name = '群发任务'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class BroadcastRecipient(models.Model):
    """群发接收者"""
    STATUS_CHOICES = [
        ('pending', '待发送'),
        ('sent', '已发送'),
        ('failed', '失败'),
        ('skipped', '跳过'),
    ]

    task = models.ForeignKey(
        BroadcastTask, on_delete=models.CASCADE,
        related_name='recipients', verbose_name='群发任务'
    )
    contact = models.ForeignKey(
        'wecom.WecomContact', on_delete=models.CASCADE,
        related_name='broadcast_recipients', verbose_name='联系人'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name='发送时间')
    error = models.TextField(blank=True, default='', verbose_name='失败原因')
    monthly_count = models.IntegerField(default=0, verbose_name='该客户本月已收群发数')

    class Meta:
        db_table = 'mf_broadcast_recipient'
        verbose_name = '群发接收者'
        verbose_name_plural = verbose_name
        unique_together = [('task', 'contact')]

    def __str__(self):
        return f'{self.task.name} - {self.contact}'


class MomentsTask(models.Model):
    """朋友圈任务

    支持朋友圈文案编辑、媒体内容（图片/视频/链接）、AI润色、
    选择微信账号、任务执行时间配置，每日循环执行。
    对齐《发朋友圈功能》需求截图。
    """
    STATUS_CHOICES = [
        ('draft', '待执行'),
        ('enabled', '已开启'),
        ('disabled', '已关闭'),
        ('approved', '审核通过'),
        ('rejected', '审核拒绝'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='moments_tasks', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        'wecom.WecomDevice', on_delete=models.CASCADE,
        related_name='moments_tasks', verbose_name='企微设备'
    )
    name = models.CharField(max_length=200, default='', verbose_name='任务名称')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='任务状态')
    created_by = models.CharField(max_length=100, blank=True, default='', verbose_name='创建者')
    started_by = models.CharField(max_length=100, blank=True, default='', verbose_name='开启人')
    is_enabled = models.BooleanField(default=False, verbose_name='是否开启')

    # 每日循环执行
    daily_loop = models.BooleanField(default=False, verbose_name='每日循环执行')

    # 执行统计
    wechat_total = models.IntegerField(default=0, verbose_name='微信总数')
    success_sent = models.IntegerField(default=0, verbose_name='成功发送')
    pending = models.IntegerField(default=0, verbose_name='待执行')
    failed = models.IntegerField(default=0, verbose_name='发送失败')
    network_error = models.IntegerField(default=0, verbose_name='网络异常')

    # 旧字段（保留向后兼容）
    content = models.TextField(blank=True, default='', verbose_name='朋友圈文案(旧)')
    media_files = models.JSONField(default=list, blank=True, verbose_name='图片/视频文件列表(旧)')
    visible_tags = models.JSONField(default=list, blank=True, verbose_name='可见标签(旧)')
    scheduled_at = models.DateTimeField(null=True, blank=True, verbose_name='定时发送时间(旧)')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'mf_moments_task'
        verbose_name = '朋友圈任务'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'朋友圈 - {self.name}'


class MomentsContent(models.Model):
    """朋友圈内容

    包含文案、媒体类型（图片/视频/链接）、AI润色配置。
    一个任务可有多条内容（按顺序发送）。
    """
    MEDIA_TYPE_CHOICES = [
        ('image', '图片'),
        ('video', '视频'),
        ('link', '链接'),
    ]

    task = models.ForeignKey(
        MomentsTask, on_delete=models.CASCADE,
        related_name='contents', verbose_name='关联任务'
    )
    order = models.IntegerField(default=0, verbose_name='排序')

    # 朋友圈文案
    text = models.TextField(blank=True, default='', verbose_name='朋友圈文案')
    random_emoji = models.BooleanField(default=False, verbose_name='随机表情')

    # 媒体内容
    media_type = models.CharField(max_length=20, choices=MEDIA_TYPE_CHOICES, default='image', verbose_name='媒体类型')
    media_urls = models.JSONField(default=list, blank=True, verbose_name='媒体URL列表')

    # 链接类型专用
    link_title = models.CharField(max_length=200, blank=True, default='', verbose_name='链接标题')
    link_desc = models.CharField(max_length=500, blank=True, default='', verbose_name='链接描述')
    link_url = models.URLField(max_length=500, blank=True, default='', verbose_name='链接URL')
    link_pic_url = models.URLField(max_length=500, blank=True, default='', verbose_name='链接封面图')

    # AI润色配置
    ai_polish_enabled = models.BooleanField(default=False, verbose_name='执行发送前润色')
    tone_template = models.CharField(max_length=100, blank=True, default='', verbose_name='调色要求模板')
    prompt_template = models.CharField(max_length=100, blank=True, default='', verbose_name='提示词模板')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'mf_moments_content'
        verbose_name = '朋友圈内容'
        verbose_name_plural = verbose_name
        ordering = ['order']

    def __str__(self):
        return f'{self.task.name} - 内容({self.order})'


class MomentsTarget(models.Model):
    """发送对象配置

    选择要发朋友圈的微信账号。
    一个任务对应一条发送对象配置。
    """
    task = models.OneToOneField(
        MomentsTask, on_delete=models.CASCADE,
        related_name='target', verbose_name='关联任务'
    )
    device_ids = models.JSONField(default=list, blank=True, verbose_name='微信账号ID列表')
    estimated_count = models.IntegerField(default=0, verbose_name='预估微信数')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'mf_moments_target'
        verbose_name = '朋友圈发送对象'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.task.name} - 发送对象'


class MomentsSchedule(models.Model):
    """任务执行时间配置

    支持定时单次执行和每日循环执行。
    一个任务对应一条执行时间配置。
    """
    task = models.OneToOneField(
        MomentsTask, on_delete=models.CASCADE,
        related_name='schedule', verbose_name='关联任务'
    )
    scheduled_at = models.DateTimeField(null=True, blank=True, verbose_name='定时执行时间')
    daily_start_time = models.TimeField(null=True, blank=True, verbose_name='每日开始时间')
    daily_end_time = models.TimeField(null=True, blank=True, verbose_name='每日结束时间')
    daily_interval = models.IntegerField(default=0, verbose_name='每日执行间隔(分钟)', help_text='0表示只执行一次')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'mf_moments_schedule'
        verbose_name = '朋友圈执行时间'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.task.name} - 执行时间'


class CustomerProfile(models.Model):
    """客户画像"""
    CUSTOMER_LEVEL_CHOICES = [
        ('VIP', 'VIP'),
        ('A', 'A级'),
        ('B', 'B级'),
        ('C', 'C级'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='customer_profiles', verbose_name='所属租户'
    )
    contact = models.ForeignKey(
        'wecom.WecomContact', on_delete=models.CASCADE,
        related_name='profiles', verbose_name='联系人'
    )
    enterprise_id = models.CharField(max_length=100, blank=True, default='', verbose_name='统一社会信用代码')
    customer_level = models.CharField(max_length=20, choices=CUSTOMER_LEVEL_CHOICES, default='C', verbose_name='客户等级')
    total_orders = models.IntegerField(default=0, verbose_name='历史订单数')
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name='历史采购总额')
    last_order_at = models.DateTimeField(null=True, blank=True, verbose_name='最后下单时间')
    browse_products = models.JSONField(default=list, blank=True, verbose_name='常浏览产品列表')
    tags = models.JSONField(default=list, blank=True, verbose_name='自动标签')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='画像更新时间')

    class Meta:
        db_table = 'mf_customer_profile'
        verbose_name = '客户画像'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.contact} - {self.customer_level}'


class MarketingTask(models.Model):
    """营销自动化任务（持久规则）

    一条 Task 是一条持久规则，可以被多次触发。
    对齐设计文档 v1.0 第 7.1 节。
    """
    TRIGGER_TYPE_CHOICES = [
        ('event', '事件触发'),
        ('schedule', '定时触发'),
        ('manual', '手动触发'),
    ]
    ACTION_TYPE_CHOICES = [
        ('proactive_follow', '主动跟进'),
        ('broadcast', '精准群发'),
        ('moments', '朋友圈'),
    ]
    STATUS_CHOICES = [
        ('active', '运行中'),
        ('paused', '已暂停'),
        ('expired', '已过期'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='marketing_tasks', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        'wecom.WecomDevice', on_delete=models.CASCADE,
        related_name='marketing_tasks', verbose_name='企微设备'
    )
    name = models.CharField(max_length=200, verbose_name='任务名称')
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_TYPE_CHOICES, default='event', verbose_name='触发类型')
    trigger_config = models.JSONField(default=dict, blank=True, verbose_name='触发条件配置')
    action_type = models.CharField(max_length=20, choices=ACTION_TYPE_CHOICES, default='proactive_follow', verbose_name='动作类型')
    action_config = models.JSONField(default=dict, blank=True, verbose_name='动作配置')
    agent_id = models.CharField(max_length=100, blank=True, default='', verbose_name='绑定智能体agent_id')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='任务状态')
    valid_from = models.DateTimeField(null=True, blank=True, verbose_name='生效开始时间')
    valid_until = models.DateTimeField(null=True, blank=True, verbose_name='生效结束时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'mf_marketing_task'
        verbose_name = '营销自动化任务'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} [{self.get_status_display()}]'


class TaskExecution(models.Model):
    """任务执行记录

    每次任务被触发后产生一条执行记录。
    对齐设计文档 v1.0 第 7.2 节。
    """
    STATUS_CHOICES = [
        ('pending', '待执行'),
        ('running', '执行中'),
        ('success', '成功'),
        ('failed', '失败'),
        ('skipped', '跳过'),
    ]

    task = models.ForeignKey(
        MarketingTask, on_delete=models.CASCADE,
        related_name='executions', verbose_name='关联任务'
    )
    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='task_executions', verbose_name='所属租户'
    )
    target_contact = models.ForeignKey(
        'wecom.WecomContact', on_delete=models.CASCADE,
        related_name='task_executions', verbose_name='目标联系人'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='执行状态')
    trigger_event = models.JSONField(default=dict, blank=True, verbose_name='触发事件数据')
    result = models.JSONField(default=dict, blank=True, verbose_name='执行结果')
    error = models.TextField(blank=True, default='', verbose_name='失败原因')
    started_at = models.DateTimeField(null=True, blank=True, verbose_name='开始执行时间')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='完成时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'mf_task_execution'
        verbose_name = '任务执行记录'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.task.name} - {self.target_contact} - {self.status}'


class AutoTagRule(models.Model):
    """自动贴标签规则

    根据好友消息中的关键词，自动给该好友打上指定标签。
    规则按设备隔离，每个设备可有多条规则。
    对齐《标签分组-自动贴标签规则》需求。
    """
    MATCH_MODE_CHOICES = [
        ('any', '任一关键词命中'),
        ('all', '全部关键词命中'),
    ]
    SCOPE_CHOICES = [
        ('personal', '仅个人消息'),
        ('group', '仅群消息'),
        ('both', '个人+群消息'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='auto_tag_rules', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        'wecom.WecomDevice', on_delete=models.CASCADE,
        related_name='auto_tag_rules', verbose_name='所属企微账号'
    )
    name = models.CharField(max_length=100, blank=True, default='', verbose_name='规则备注')
    keywords = models.JSONField(default=list, verbose_name='关键词列表', help_text='JSON 数组，例如 ["代理", "价格"]')
    match_mode = models.CharField(max_length=10, choices=MATCH_MODE_CHOICES, default='any', verbose_name='匹配模式')
    scope = models.CharField(max_length=10, choices=SCOPE_CHOICES, default='personal', verbose_name='应用范围')
    target_tag = models.ForeignKey(
        'wecom.WecomTag', on_delete=models.CASCADE,
        related_name='auto_tag_rules', verbose_name='命中的目标标签'
    )
    is_enabled = models.BooleanField(default=True, verbose_name='是否启用')
    hit_count = models.IntegerField(default=0, verbose_name='历史命中次数')
    last_run_at = models.DateTimeField(null=True, blank=True, verbose_name='最后命中时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'mf_auto_tag_rule'
        verbose_name = '自动贴标签规则'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name or "规则"}: {",".join(self.keywords) if isinstance(self.keywords, list) else self.keywords}'


class MassSendTask(models.Model):
    """精准群发任务

    支持多种消息类型（文本/图片/视频/语音/文件/链接/小程序/视频号），
    三步执行准备（群发素材/发送对象/任务执行时间），
    每日循环执行，详细执行统计。
    对齐《精准群发功能》需求截图。
    """
    STATUS_CHOICES = [
        ('draft', '待执行'),
        ('enabled', '已开启'),
        ('disabled', '已关闭'),
        ('approved', '审核通过'),
        ('rejected', '审核拒绝'),
    ]

    tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='mass_send_tasks', verbose_name='所属租户'
    )
    device = models.ForeignKey(
        'wecom.WecomDevice', on_delete=models.CASCADE,
        related_name='mass_send_tasks', verbose_name='企微设备'
    )
    name = models.CharField(max_length=200, verbose_name='任务名称')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='任务状态')
    created_by = models.CharField(max_length=100, blank=True, default='', verbose_name='创建者')
    started_by = models.CharField(max_length=100, blank=True, default='', verbose_name='开启人')
    is_enabled = models.BooleanField(default=False, verbose_name='是否开启')

    # 每日循环执行
    daily_loop = models.BooleanField(default=False, verbose_name='每日循环执行')

    # 执行统计
    planned_total = models.IntegerField(default=0, verbose_name='计划总人数')
    planned_success = models.IntegerField(default=0, verbose_name='计划成功数')
    planned_pending = models.IntegerField(default=0, verbose_name='计划待执行数')
    planned_failed = models.IntegerField(default=0, verbose_name='计划失败数')
    planned_network_error = models.IntegerField(default=0, verbose_name='计划网络异常数')
    disabled_count = models.IntegerField(default=0, verbose_name='已禁用数')
    reply_rate = models.FloatField(default=0.0, verbose_name='好友回复率')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'mf_mass_send_task'
        verbose_name = '精准群发任务'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class MassSendMaterial(models.Model):
    """群发素材

    支持八种消息类型：文本/图片/视频/语音/文件/链接/小程序/视频号。
    一个任务可有多条素材（按顺序发送）。
    """
    MSG_TYPE_CHOICES = [
        ('text', '文本'),
        ('image', '图片'),
        ('video', '视频'),
        ('audio', '语音'),
        ('file', '文件'),
        ('link', '链接'),
        ('miniprogram', '小程序'),
        ('channel', '视频号'),
    ]

    task = models.ForeignKey(
        MassSendTask, on_delete=models.CASCADE,
        related_name='materials', verbose_name='关联任务'
    )
    order = models.IntegerField(default=0, verbose_name='排序')
    msg_type = models.CharField(max_length=20, choices=MSG_TYPE_CHOICES, default='text', verbose_name='消息类型')
    content = models.JSONField(default=dict, blank=True, verbose_name='消息内容', help_text='按类型存储不同结构的数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'mf_mass_send_material'
        verbose_name = '群发素材'
        verbose_name_plural = verbose_name
        ordering = ['order']

    def __str__(self):
        return f'{self.task.name} - {self.get_msg_type_display()} ({self.order})'


class MassSendTarget(models.Model):
    """发送对象配置

    支持按标签筛选、指定联系人/群聊、按条件筛选。
    一个任务对应一条发送对象配置。
    """
    TARGET_TYPE_CHOICES = [
        ('contact', '好友'),
        ('group', '群聊'),
        ('all', '全部好友'),
    ]

    task = models.OneToOneField(
        MassSendTask, on_delete=models.CASCADE,
        related_name='target', verbose_name='关联任务'
    )
    target_type = models.CharField(max_length=20, choices=TARGET_TYPE_CHOICES, default='contact', verbose_name='目标类型')
    tag_ids = models.JSONField(default=list, blank=True, verbose_name='标签筛选ID列表')
    contact_ids = models.JSONField(default=list, blank=True, verbose_name='指定联系人ID列表')
    group_ids = models.JSONField(default=list, blank=True, verbose_name='指定群聊ID列表')
    filter_conditions = models.JSONField(default=dict, blank=True, verbose_name='高级筛选条件', help_text='如性别、地区、添加时间等')
    estimated_count = models.IntegerField(default=0, verbose_name='预估发送人数')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'mf_mass_send_target'
        verbose_name = '发送对象'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.task.name} - {self.get_target_type_display()}'


class MassSendSchedule(models.Model):
    """任务执行时间配置

    支持定时单次执行和每日循环执行。
    一个任务对应一条执行时间配置。
    """
    task = models.OneToOneField(
        MassSendTask, on_delete=models.CASCADE,
        related_name='schedule', verbose_name='关联任务'
    )
    scheduled_at = models.DateTimeField(null=True, blank=True, verbose_name='定时执行时间')
    daily_start_time = models.TimeField(null=True, blank=True, verbose_name='每日开始时间')
    daily_end_time = models.TimeField(null=True, blank=True, verbose_name='每日结束时间')
    daily_interval = models.IntegerField(default=0, verbose_name='每日执行间隔(分钟)', help_text='0表示只执行一次')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'mf_mass_send_schedule'
        verbose_name = '执行时间'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.task.name} - 执行时间'
