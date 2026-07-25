"""平台管理 App — 租户/用户/角色/套餐/配置"""

from django.db import models
from django.contrib.auth.models import User


class Tenant(models.Model):
    """租户（商户）"""
    code = models.CharField(max_length=50, unique=True, verbose_name='租户编码')
    name = models.CharField(max_length=200, verbose_name='租户名称')
    platform_name = models.CharField(max_length=200, blank=True, default='', verbose_name='平台名称')
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
    credits = models.IntegerField(default=0, verbose_name='积分余额')
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


class AgentConfig(models.Model):
    """智能体配置"""
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='agent_configs', verbose_name='所属租户')
    agent_id = models.CharField(max_length=50, verbose_name='智能体ID')
    model_id = models.CharField(max_length=50, blank=True, default='', verbose_name='默认模型ID')
    temperature = models.FloatField(default=0.7, verbose_name='温度')
    max_retry = models.IntegerField(default=3, verbose_name='最大重试次数')
    fallback_model_id = models.CharField(max_length=50, blank=True, default='', verbose_name='备用模型ID')
    human_takeover_threshold = models.FloatField(default=0.6, verbose_name='人工接管阈值')
    custom = models.JSONField(default=dict, blank=True, verbose_name='自定义配置')

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
    ]
    CATEGORY_CHOICES = [
        ('recommend', '推荐'),
        ('platform', '平台运营'),
        ('marketing', '营销跟客'),
        ('flow', '流向管控'),
        ('purchase', '智能采购'),
        ('academic', '学术培训'),
    ]

    prompt_type = models.CharField(max_length=10, choices=TYPE_CHOICES, verbose_name='类型')
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, blank=True, default='recommend',
        verbose_name='分类（仅首页提示词使用）'
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
