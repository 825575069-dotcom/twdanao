"""租户扩展 App — 知识库/素材/任务/积分/SaaS/连接器"""

from django.db import models
from django.contrib.auth.models import User


class KnowledgeDoc(models.Model):
    """知识文档"""
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='knowledge_docs', verbose_name='所属租户')
    name = models.CharField(max_length=200, verbose_name='文档名称')
    type = models.CharField(
        max_length=10,
        choices=[('PDF', 'PDF'), ('DOC', 'Word'), ('XLS', 'Excel'), ('MD', 'Markdown'), ('PPT', 'PPT')],
        verbose_name='文档类型'
    )
    size = models.CharField(max_length=20, verbose_name='文件大小')
    folder = models.CharField(max_length=100, default='未分类', verbose_name='所属文件夹')
    bound_agents = models.JSONField(default=list, blank=True, verbose_name='绑定智能体')
    content_text = models.TextField(blank=True, default='', verbose_name='提取的文本内容（用于 RAG 检索）')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name='上传者')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='上传时间')

    class Meta:
        db_table = 'tenant_knowledge'
        verbose_name = '知识文档'
        verbose_name_plural = '知识文档'

    def __str__(self):
        return f'{self.name} ({self.type})'


class MediaAsset(models.Model):
    """媒体素材（营销素材）"""
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='media_assets', verbose_name='所属租户')
    name = models.CharField(max_length=200, verbose_name='素材名称')
    type = models.CharField(max_length=20, default='image', verbose_name='素材类型')
    size = models.CharField(max_length=20, verbose_name='文件大小')
    file = models.FileField(upload_to='media_assets/', null=True, blank=True, verbose_name='文件')
    file_url = models.CharField(max_length=500, blank=True, default='', verbose_name='文件URL')
    url = models.URLField(blank=True, default='', verbose_name='外部链接')
    folder = models.CharField(max_length=100, default='全部', verbose_name='所属文件夹')
    description = models.TextField(blank=True, default='', verbose_name='素材描述')
    bound_agents = models.JSONField(default=list, blank=True, verbose_name='绑定智能体ID列表')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name='上传者')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='上传时间')

    class Meta:
        db_table = 'tenant_media'
        verbose_name = '媒体素材'
        verbose_name_plural = '媒体素材'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Task(models.Model):
    """定时任务"""
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='tasks', verbose_name='所属租户')
    name = models.CharField(max_length=200, verbose_name='任务名称')
    agent_code = models.CharField(max_length=50, verbose_name='执行智能体')
    schedule = models.CharField(max_length=100, verbose_name='调度规则')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    last_run = models.DateTimeField(null=True, blank=True, verbose_name='上次运行')
    last_result = models.CharField(max_length=50, blank=True, default='', verbose_name='上次结果')
    status = models.CharField(
        max_length=20, default='pending',
        choices=[('success', '成功'), ('pending', '待执行'), ('failed', '失败')],
        verbose_name='执行状态'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'tenant_task'
        verbose_name = '定时任务'
        verbose_name_plural = '定时任务'

    def __str__(self):
        return self.name


class CreditLedger(models.Model):
    """积分账本"""
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='credit_ledger', verbose_name='所属租户')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='credit_ledger', verbose_name='用户')
    agent_code = models.CharField(max_length=50, blank=True, default='', verbose_name='关联智能体')
    agent_name = models.CharField(max_length=100, blank=True, default='', verbose_name='智能体名称')
    amount = models.IntegerField(verbose_name='变动金额（正=消费，负=充值）')
    reason = models.CharField(max_length=200, verbose_name='变动原因')
    balance_after = models.IntegerField(verbose_name='变动后余额')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='交易时间')

    class Meta:
        db_table = 'tenant_credit_ledger'
        verbose_name = '积分账本'
        verbose_name_plural = '积分账本'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username}: {self.amount} ({self.reason})'


class Skill(models.Model):
    """技能"""
    name = models.CharField(max_length=100, unique=True, verbose_name='技能名称')
    description = models.TextField(blank=True, default='', verbose_name='技能描述')
    category = models.CharField(max_length=50, verbose_name='技能分类')
    installed = models.BooleanField(default=False, verbose_name='是否已安装')

    class Meta:
        db_table = 'tenant_skill'
        verbose_name = '技能'
        verbose_name_plural = '技能'

    def __str__(self):
        return self.name


class SaaSConnection(models.Model):
    """SaaS 连接"""
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='saas_connections', verbose_name='所属租户')
    name = models.CharField(max_length=200, verbose_name='连接名称')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    status = models.CharField(
        max_length=20, default='pending',
        choices=[('connected', '已连接'), ('pending', '连接中'), ('disconnected', '未连接')],
        verbose_name='状态'
    )
    two_way = models.BooleanField(default=False, verbose_name='是否双向')
    last_sync = models.DateTimeField(null=True, blank=True, verbose_name='上次同步')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'tenant_saas'
        verbose_name = 'SaaS连接'
        verbose_name_plural = 'SaaS连接'

    def __str__(self):
        return self.name


class DataConnector(models.Model):
    """数据底座连接器

    当 platform_enterprise 不为空时，表示该连接器由平台同步自动创建，
    数据库连接信息（db_type / db_config）从 PlatformEnterprise 复制而来。
    也可手动创建（platform_enterprise 为空），config 存自定义连接信息。
    """
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='data_connectors', verbose_name='所属租户')
    name = models.CharField(max_length=200, verbose_name='连接器名称')
    type = models.CharField(
        max_length=20,
        choices=[('erp', 'ERP'), ('b2b', 'B2B'), ('b2c', 'B2C'), ('third-party', '第三方')],
        verbose_name='连接器类型'
    )
    description = models.TextField(blank=True, default='', verbose_name='描述')
    icon_name = models.CharField(max_length=50, default='Boxes', verbose_name='图标名称')
    enabled = models.BooleanField(default=False, verbose_name='是否启用')
    status = models.CharField(
        max_length=20, default='disconnected',
        choices=[('connected', '已连接'), ('pending', '连接中'), ('disconnected', '未连接')],
        verbose_name='连接状态'
    )
    config = models.JSONField(default=dict, blank=True, verbose_name='连接配置')
    # ── 平台同步关联字段 ──
    platform_enterprise = models.ForeignKey(
        'platform.PlatformEnterprise', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='data_connectors',
        verbose_name='关联的平台企业'
    )
    enterprise_id = models.CharField(max_length=100, blank=True, default='', verbose_name='企业ID（统一社会信用代码）')
    db_type = models.CharField(max_length=10, blank=True, default='', verbose_name='数据库类型（mysql/api）')
    db_config = models.JSONField(default=dict, blank=True, verbose_name='数据库连接配置')
    last_sync = models.DateTimeField(null=True, blank=True, verbose_name='上次同步')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'tenant_data_connector'
        verbose_name = '数据连接器'
        verbose_name_plural = '数据连接器'

    def __str__(self):
        return f'{self.name} ({self.get_type_display()})'
