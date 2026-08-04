"""平台管理 App — 租户/用户/角色/套餐/配置"""

from django.db import models
from django.contrib.auth.models import User


class Tenant(models.Model):
    """租户（商户）"""
    code = models.CharField(max_length=50, unique=True, verbose_name='租户编码')
    name = models.CharField(max_length=200, verbose_name='租户名称')
    platform_name = models.CharField(max_length=200, blank=True, default='', verbose_name='平台名称')
    enterprise_id = models.CharField(
        max_length=50, blank=True, default='',
        verbose_name='企业ID（统一社会信用代码）',
        help_text='用于识别租户第一层的数据底座'
    )
    province = models.CharField(max_length=50, blank=True, default='', verbose_name='所在省份')
    city = models.CharField(max_length=50, blank=True, default='', verbose_name='所在城市')
    address = models.TextField(blank=True, default='', verbose_name='详细地址')
    channel = models.CharField(
        max_length=20, blank=True, default='',
        choices=[('clinic', '诊所'), ('pharmacy', '药店'), ('hospital', '医院')],
        verbose_name='客户渠道',
        help_text='租户客户类型，用于产品可销渠道匹配'
    )
    credits = models.IntegerField(default=0, verbose_name='积分余额')
    status = models.CharField(
        max_length=20, default='active',
        choices=[('active', '已激活'), ('inactive', '已停用'), ('pending', '待审核')],
        verbose_name='状态'
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_tenants', verbose_name='创建人'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_tenant'
        verbose_name = '租户'
        verbose_name_plural = '租户'

    def __str__(self):
        return f'{self.name}({self.code})'


class Role(models.Model):
    """角色"""
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='roles', verbose_name='所属租户')
    name = models.CharField(max_length=100, verbose_name='角色名称')
    code = models.CharField(max_length=50, verbose_name='角色编码')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    permissions = models.JSONField(default=list, verbose_name='权限清单')
    can_manage_members = models.BooleanField(default=False, verbose_name='可管理成员')
    can_assign_credits = models.BooleanField(default=False, verbose_name='可分配积分')
    agents = models.JSONField(default=list, verbose_name='可用智能体列表')
    views = models.JSONField(default=list, verbose_name='可见视图列表')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'platform_role'
        verbose_name = '角色'
        verbose_name_plural = '角色'
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f'{self.name}({self.code})'


class TenantUser(models.Model):
    """租户成员（User → Tenant 关联）"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tenant_memberships', verbose_name='用户')
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='members', verbose_name='所属租户')
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, related_name='members', verbose_name='角色')
    phone = models.CharField(max_length=20, blank=True, default='', verbose_name='手机号')
    credits = models.IntegerField(default=0, verbose_name='积分余额')
    credit_allocation_type = models.CharField(
        max_length=20, default='fixed',
        choices=[
            ('unlimited', '无限'),
            ('monthly', '月用量'),
            ('daily', '日用量'),
            ('fixed', '固定量'),
        ],
        verbose_name='积分分配类型'
    )
    credit_allocation_value = models.IntegerField(default=0, blank=True, verbose_name='积分分配值')
    status = models.CharField(
        max_length=20, default='offline',
        choices=[('online', '在线'), ('offline', '离线')],
        verbose_name='在线状态'
    )
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='加入时间')

    class Meta:
        db_table = 'platform_tenant_user'
        verbose_name = '租户成员'
        verbose_name_plural = '租户成员'
        unique_together = [('user', 'tenant')]

    def __str__(self):
        return f'{self.user.username} @ {self.tenant.name}'


class Package(models.Model):
    """套餐"""
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='package', verbose_name='所属租户')
    name = models.CharField(max_length=100, verbose_name='套餐名称')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'platform_package'
        verbose_name = '套餐'
        verbose_name_plural = '套餐'

    def __str__(self):
        return f'{self.tenant.name} - {self.name}'


class PackageQuota(models.Model):
    """套餐配额"""
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name='quotas', verbose_name='所属套餐')
    agent_code = models.CharField(max_length=50, verbose_name='智能体编码')
    monthly = models.IntegerField(default=0, verbose_name='月度配额')
    used = models.IntegerField(default=0, verbose_name='已使用')

    class Meta:
        db_table = 'platform_package_quota'
        verbose_name = '套餐配额'
        verbose_name_plural = '套餐配额'
        unique_together = [('package', 'agent_code')]

    def __str__(self):
        return f'{self.package.name} - {self.agent_code}: {self.used}/{self.monthly}'


# ═══════════════════════════════════════
# 第二层：平台权限模型（管理总部员工在天网大脑平台的权限）
# 区别于第三层 Role/TenantUser（租户内部权限），这两个模型不绑定 tenant
# ═══════════════════════════════════════

class PlatformRole(models.Model):
    """平台角色（第二层 — 不绑定租户，管理总部员工对管理后台的访问权限）"""
    name = models.CharField(max_length=100, verbose_name='角色名称')
    code = models.CharField(max_length=50, unique=True, verbose_name='角色编码')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    permissions = models.JSONField(default=list, verbose_name='平台权限清单（platform.*）')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_platform_role'
        verbose_name = '平台角色'
        verbose_name_plural = '平台角色'
        ordering = ['id']

    def __str__(self):
        return f'{self.name}({self.code})'


class PlatformUser(models.Model):
    """平台员工（第二层 — 关联 auth.User 与 PlatformRole，记录总部员工身份）"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='platform_profile', verbose_name='用户')
    role = models.ForeignKey(PlatformRole, on_delete=models.SET_NULL, null=True, related_name='staff', verbose_name='平台角色')
    phone = models.CharField(max_length=20, blank=True, default='', verbose_name='手机号')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_platform_user'
        verbose_name = '平台员工'
        verbose_name_plural = '平台员工'

    def __str__(self):
        return f'{self.user.username} ({self.role.name if self.role else "无角色"})'


class Agent(models.Model):
    """平台智能体定义（第二层发布，第三层消费）

    存储平台级的智能体元数据：名称、角色、围巾颜色、能力、默认工作流等。
    租户级覆盖（自定义名称、工作流编辑、绑定知识库/素材）存储在 AgentConfig 中。
    """
    agent_id = models.CharField(max_length=50, unique=True, verbose_name='智能体ID')
    code = models.CharField(max_length=50, blank=True, default='', verbose_name='智能体编码')
    name = models.CharField(max_length=100, verbose_name='名称')
    role = models.CharField(max_length=200, blank=True, default='', verbose_name='角色描述')
    emoji = models.CharField(max_length=10, blank=True, default='', verbose_name='Emoji')
    scarf_color = models.CharField(max_length=50, blank=True, default='', verbose_name='围巾颜色')
    avatar = models.URLField(max_length=500, blank=True, default='', verbose_name='自定义头像URL')
    accent = models.CharField(max_length=20, blank=True, default='', verbose_name='主题色（hex）')
    description = models.TextField(blank=True, default='', verbose_name='详细描述')
    capabilities = models.JSONField(default=list, blank=True, verbose_name='能力标签列表')
    stats = models.JSONField(default=dict, blank=True, verbose_name='统计数据')
    default_workflow = models.JSONField(default=list, blank=True, verbose_name='默认工作流步骤')
    default_workflow_template = models.ForeignKey(
        'WorkflowTemplate', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='agents', verbose_name='默认工作流模板'
    )
    agent_role = models.OneToOneField(
        'AgentRole', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='bound_agent', verbose_name='绑定的智能体角色'
    )
    capability_mode = models.CharField(
        max_length=20, default='builtin',
        choices=[('builtin', '天网大脑AI能力'), ('external', '外部平台AI能力')],
        verbose_name='AI能力模式'
    )
    external_workflow_code = models.CharField(
        max_length=50, blank=True, default='',
        verbose_name='外部平台工作流编码'
    )
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_agent'
        verbose_name = '平台智能体'
        verbose_name_plural = '平台智能体'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.name}({self.agent_id})'


class AgentRole(models.Model):
    """智能体角色（第二层发布）

    定义智能体的角色定位、专业能力，一个角色可绑定一个智能体，
    一个智能体在同一时刻只能绑定一个角色。AI 执行时会读取角色描述
    注入 prompt，以确定专业能力边界。
    """

    CATEGORY_CHOICES = [
        ('purchase', '采购'),
        ('sales', '销售'),
        ('ops', '运营'),
        ('flow', '流向'),
        ('academic', '学术'),
        ('control', '中控'),
        ('other', '其他'),
    ]

    name = models.CharField(max_length=100, verbose_name='角色名称')
    code = models.CharField(max_length=50, unique=True, verbose_name='角色编码')
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, blank=True, default='other',
        verbose_name='分类'
    )
    description = models.TextField(blank=True, default='', verbose_name='角色定位 / 专业能力')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    sort = models.IntegerField(default=0, verbose_name='排序')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_agent_role'
        verbose_name = '智能体角色'
        verbose_name_plural = '智能体角色'
        ordering = ['sort', 'id']

    def __str__(self):
        return f'{self.name}({self.code})'


class WorkflowTemplate(models.Model):
    """工作流模板（第二层发布，第三层消费）

    预置的工作流模板，可用于智能体工作流编排参考或直接应用。
    """
    name = models.CharField(max_length=200, verbose_name='模板名称')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    category = models.CharField(max_length=50, blank=True, default='', verbose_name='分类')
    tags = models.JSONField(default=list, blank=True, verbose_name='标签')
    steps = models.JSONField(default=list, blank=True, verbose_name='步骤列表')
    edges = models.JSONField(default=list, blank=True, verbose_name='连线列表')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_workflow_template'
        verbose_name = '工作流模板'
        verbose_name_plural = '工作流模板'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.name


class AgentConfig(models.Model):
    """智能体配置（租户级，含对平台 Agent 的覆盖）

    platform Agent 定义智能体的默认属性（名称、角色、工作流等），
    AgentConfig 存储租户级的模型/温度配置，以及自定义覆盖：
    custom_name / custom_role / custom_description / custom_workflow / custom_scarf_color
    和绑定的数据底座 / 知识文档 / 营销素材。
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='agent_configs', verbose_name='所属租户')
    agent_id = models.CharField(max_length=50, verbose_name='智能体ID')
    model_id = models.CharField(max_length=50, blank=True, default='', verbose_name='默认模型ID')
    temperature = models.FloatField(default=0.7, verbose_name='温度')
    max_retry = models.IntegerField(default=3, verbose_name='最大重试次数')
    fallback_model_id = models.CharField(max_length=50, blank=True, default='', verbose_name='备用模型ID')
    human_takeover_threshold = models.FloatField(default=0.6, verbose_name='人工接管阈值')
    custom = models.JSONField(default=dict, blank=True, verbose_name='自定义配置')
    # ── 租户覆盖字段（第三层编辑 → 写回第二层） ──
    custom_name = models.CharField(max_length=100, blank=True, default='', verbose_name='自定义名称')
    custom_role = models.CharField(max_length=200, blank=True, default='', verbose_name='自定义角色描述')
    custom_description = models.TextField(blank=True, default='', verbose_name='自定义描述')
    custom_workflow = models.JSONField(default=list, blank=True, verbose_name='自定义工作流步骤')
    custom_scarf_color = models.CharField(max_length=50, blank=True, default='', verbose_name='自定义围巾颜色')
    custom_avatar = models.URLField(max_length=500, blank=True, default='', verbose_name='自定义头像URL')
    bound_data_bases = models.JSONField(default=list, blank=True, verbose_name='绑定的数据底座ID列表')
    bound_docs = models.JSONField(default=list, blank=True, verbose_name='绑定的知识文档ID列表')
    bound_images = models.JSONField(default=list, blank=True, verbose_name='绑定的营销素材ID列表')
    custom_workflow_template = models.ForeignKey(
        'WorkflowTemplate', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='agent_configs', verbose_name='自定义工作流模板'
    )

    class Meta:
        db_table = 'platform_agent_config'
        verbose_name = '智能体配置'
        verbose_name_plural = '智能体配置'
        unique_together = [('tenant', 'agent_id')]

    def __str__(self):
        return f'{self.tenant.name} - {self.agent_id}'


class DifyConfig(models.Model):
    """Dify 工作流配置"""
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='dify_config', verbose_name='所属租户')
    configured = models.BooleanField(default=False, verbose_name='是否已配置')
    connection_status = models.CharField(
        max_length=20, default='disconnected',
        choices=[('connected', '已连接'), ('disconnected', '未连接'), ('error', '连接错误')],
        verbose_name='连接状态'
    )
    last_test = models.DateTimeField(null=True, blank=True, verbose_name='最后测试时间')
    error = models.TextField(blank=True, default='', verbose_name='错误信息')

    class Meta:
        db_table = 'platform_dify_config'
        verbose_name = 'Dify配置'
        verbose_name_plural = 'Dify配置'

    def __str__(self):
        return f'{self.tenant.name} Dify配置'


class DifyWorkflow(models.Model):
    """Dify 工作流"""
    dify_config = models.ForeignKey(DifyConfig, on_delete=models.CASCADE, related_name='workflows', verbose_name='所属配置')
    code = models.CharField(max_length=50, verbose_name='工作流编码')
    agent_code = models.CharField(max_length=50, verbose_name='绑定智能体编码')
    api_key = models.CharField(max_length=200, blank=True, default='', verbose_name='API Key')
    base_url = models.CharField(max_length=300, blank=True, default='', verbose_name='Base URL')

    class Meta:
        db_table = 'platform_dify_workflow'
        verbose_name = 'Dify工作流'
        verbose_name_plural = 'Dify工作流'
        unique_together = [('dify_config', 'code')]

    def __str__(self):
        return f'{self.dify_config.tenant.name} - {self.code}'


class Prompt(models.Model):
    """提示词（首页提示词 / 普通提示词），由第二层管理后台编辑发布"""

    TYPE_CHOICES = [
        ('home', '首页提示词'),
        ('chat', '普通提示词'),
        ('purchase_chat', '采购对话提示词'),
        ('purchase_home', '采购兔首页提示词'),
    ]

    prompt_type = models.CharField(max_length=20, choices=TYPE_CHOICES, verbose_name='类型')
    category = models.CharField(
        max_length=50, blank=True, default='recommend',
        verbose_name='分类（首页提示词/采购对话快捷输入使用，支持自定义自由输入）'
    )
    title = models.CharField(max_length=100, blank=True, default='', verbose_name='标题')
    icon = models.CharField(
        max_length=50, blank=True, default='',
        verbose_name='图标（前端图标注册表 key，仅首页提示词使用）'
    )
    content = models.TextField(verbose_name='提示词内容')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    sort = models.IntegerField(default=0, verbose_name='排序')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_prompt'
        verbose_name = '提示词'
        verbose_name_plural = '提示词'
        ordering = ['sort', 'id']

    def __str__(self):
        return f'[{self.get_prompt_type_display()}] {self.title or self.content[:20]}'


# ═══════════════════════════════════════
# 平台数据库（第一层 SaaS 平台对接）
# ═══════════════════════════════════════

class PlatformDatabase(models.Model):
    """平台级 SaaS 平台配置（ERP / B2B / B2C）

    全局配置，记录第一层 SaaS 平台的同步 API 地址和 Token。
    天网大脑通过标准同步协议从各 SaaS 平台拉取企业列表及数据库连接信息，
    缓存在 PlatformEnterprise 表中，按统一社会信用代码匹配 Tenant。
    """
    TYPE_CHOICES = [
        ('erp', 'ERP'),
        ('b2b', 'B2B'),
        ('b2c', 'B2C'),
        ('third_party', '第三方'),
    ]

    code = models.CharField(max_length=50, unique=True, verbose_name='平台编码')
    name = models.CharField(max_length=200, verbose_name='平台名称')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, verbose_name='平台类型')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    icon_name = models.CharField(max_length=50, default='Database', verbose_name='图标名称')
    api_base_url = models.CharField(max_length=500, blank=True, default='', verbose_name='同步API地址')
    api_token = models.CharField(max_length=500, blank=True, default='', verbose_name='API Token（Bearer）')
    sync_enabled = models.BooleanField(default=True, verbose_name='是否启用同步')
    last_synced_at = models.DateTimeField(null=True, blank=True, verbose_name='最后同步时间')
    last_sync_status = models.CharField(max_length=20, blank=True, default='', verbose_name='最后同步状态')
    last_sync_error = models.TextField(blank=True, default='', verbose_name='最后同步错误')
    total_enterprises = models.IntegerField(default=0, verbose_name='同步企业总数')
    linked_tenant_count = models.IntegerField(default=0, verbose_name='已匹配租户数')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_database'
        verbose_name = '平台数据库'
        verbose_name_plural = '平台数据库'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.name}({self.code})'


class PlatformEnterprise(models.Model):
    """同步缓存 — 从 SaaS 平台同步的企业列表

    每条记录代表一个 SaaS 平台上的企业，包含该企业的数据库连接信息。
    按 enterprise_id（统一社会信用代码）与 Tenant 匹配，
    匹配成功后可创建 DataConnector 供租户智能体绑定。
    """
    DB_TYPE_CHOICES = [
        ('mysql', 'MySQL 直连'),
        ('api', 'HTTP API'),
    ]

    platform_database = models.ForeignKey(
        PlatformDatabase, on_delete=models.CASCADE,
        related_name='enterprises', verbose_name='所属平台'
    )
    enterprise_id = models.CharField(max_length=100, verbose_name='企业ID（统一社会信用代码）')
    enterprise_name = models.CharField(max_length=200, blank=True, default='', verbose_name='企业名称')
    db_type = models.CharField(
        max_length=10, choices=DB_TYPE_CHOICES, default='mysql',
        verbose_name='数据库类型'
    )
    db_config = models.JSONField(default=dict, blank=True, verbose_name='数据库连接配置')
    matched_tenant = models.ForeignKey(
        Tenant, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='platform_enterprises', verbose_name='匹配的租户'
    )
    last_synced_at = models.DateTimeField(auto_now=True, verbose_name='最后同步时间')

    class Meta:
        db_table = 'platform_enterprise'
        verbose_name = '平台企业'
        verbose_name_plural = '平台企业'
        unique_together = [('platform_database', 'enterprise_id')]

    def __str__(self):
        return f'{self.enterprise_name}({self.enterprise_id})'


# ═══════════════════════════════════════
# 积分管理（平台级配置 + 租户购买 + 智能体消耗规则）
# ═══════════════════════════════════════

class CreditConfig(models.Model):
    """积分基础配置（全局单例，id=1）"""
    tokens_per_credit = models.FloatField(default=1000, verbose_name='1积分兑换Token数')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.10, verbose_name='积分单价（元/积分）')
    free_credits_on_register = models.IntegerField(default=1000, verbose_name='注册赠送积分')
    min_purchase_credits = models.IntegerField(default=100, verbose_name='最小购买积分')
    enable_online_pay = models.BooleanField(default=False, verbose_name='是否启用在线支付')
    enable_offline_pay = models.BooleanField(default=True, verbose_name='是否启用公对公转账')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_credit_config'
        verbose_name = '积分配置'
        verbose_name_plural = '积分配置'

    @classmethod
    def get_config(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    def __str__(self):
        return f'1积分={self.tokens_per_credit}Token, ¥{self.unit_price}/积分'


class CreditPackage(models.Model):
    """积分套餐包"""
    name = models.CharField(max_length=100, verbose_name='套餐名称')
    credits = models.IntegerField(verbose_name='积分数量')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='价格（元）')
    bonus_credits = models.IntegerField(default=0, verbose_name='赠送积分')
    is_popular = models.BooleanField(default=False, verbose_name='是否热门')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_credit_package'
        verbose_name = '积分套餐'
        verbose_name_plural = '积分套餐'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.name}({self.credits}积分/¥{self.price})'


class AgentCreditRule(models.Model):
    """智能体积分消耗规则"""
    agent_code = models.CharField(max_length=50, unique=True, verbose_name='智能体编码')
    agent_name = models.CharField(max_length=100, blank=True, default='', verbose_name='智能体名称')
    coefficient = models.FloatField(default=1.0, verbose_name='消耗系数（1.0=标准）')
    free_deduction = models.BooleanField(default=False, verbose_name='是否免扣积分')
    description = models.TextField(blank=True, default='', verbose_name='说明')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_agent_credit_rule'
        verbose_name = '智能体积分规则'
        verbose_name_plural = '智能体积分规则'
        ordering = ['id']

    def __str__(self):
        tag = '免扣' if self.free_deduction else f'x{self.coefficient}'
        return f'{self.agent_name or self.agent_code}({tag})'


class CreditOrder(models.Model):
    """积分购买订单"""
    STATUS_CHOICES = [
        ('pending', '待支付'),
        ('paid', '已支付'),
        ('confirmed', '已确认到账'),
        ('cancelled', '已取消'),
        ('failed', '失败'),
    ]

    PAYMENT_CHOICES = [
        ('offline', '公对公转账'),
        ('online', '在线支付'),
        ('manual', '管理员充值'),
    ]

    order_no = models.CharField(max_length=50, unique=True, verbose_name='订单号')
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='credit_orders', verbose_name='租户')
    package = models.ForeignKey(CreditPackage, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='套餐')
    credits = models.IntegerField(verbose_name='购买积分')
    bonus_credits = models.IntegerField(default=0, verbose_name='赠送积分')
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='金额（元）')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default='offline', verbose_name='支付方式')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    proof_file = models.CharField(max_length=500, blank=True, default='', verbose_name='付款凭证URL')
    remark = models.TextField(blank=True, default='', verbose_name='备注')
    confirmed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='confirmed_credit_orders', verbose_name='确认人'
    )
    confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name='确认时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'platform_credit_order'
        verbose_name = '积分订单'
        verbose_name_plural = '积分订单'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.order_no}({self.tenant.name},{self.credits}积分)'

    @property
    def total_credits(self):
        return self.credits + self.bonus_credits
