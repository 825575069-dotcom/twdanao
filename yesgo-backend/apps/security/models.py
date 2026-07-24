"""
安全审计 App — 操作日志 / 数据脱敏 / 安全配置 / 访问控制
"""

from django.db import models
from django.contrib.auth.models import User


class AuditLog(models.Model):
    """操作审计日志"""
    tenant = models.ForeignKey(
        'platform.Tenant',
        on_delete=models.CASCADE,
        related_name='audit_logs',
        verbose_name='所属租户'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        verbose_name='操作用户'
    )
    action = models.CharField(
        max_length=50,
        choices=[
            ('login', '登录'),
            ('logout', '登出'),
            ('create', '创建'),
            ('update', '更新'),
            ('delete', '删除'),
            ('query', '查询'),
            ('export', '导出'),
            ('upload', '上传'),
            ('download', '下载'),
            ('config_change', '配置变更'),
            ('permission_change', '权限变更'),
            ('data_access', '数据访问'),
            ('api_call', 'API调用'),
            ('security_event', '安全事件'),
        ],
        verbose_name='操作类型'
    )
    resource_type = models.CharField(max_length=100, blank=True, default='', verbose_name='资源类型')
    resource_id = models.CharField(max_length=100, blank=True, default='', verbose_name='资源ID')
    description = models.TextField(verbose_name='操作描述')
    method = models.CharField(max_length=10, blank=True, default='', verbose_name='HTTP方法')
    path = models.CharField(max_length=500, blank=True, default='', verbose_name='请求路径')
    ip_address = models.CharField(max_length=50, blank=True, default='', verbose_name='IP地址')
    user_agent = models.CharField(max_length=500, blank=True, default='', verbose_name='User-Agent')
    request_body = models.JSONField(default=dict, blank=True, verbose_name='请求参数（脱敏后）')
    response_status = models.IntegerField(default=200, verbose_name='响应状态码')
    duration_ms = models.IntegerField(default=0, verbose_name='耗时(ms)')
    risk_level = models.CharField(
        max_length=20,
        default='low',
        choices=[
            ('low', '低'),
            ('medium', '中'),
            ('high', '高'),
            ('critical', '严重'),
        ],
        verbose_name='风险等级'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='操作时间')

    class Meta:
        db_table = 'security_audit_log'
        verbose_name = '审计日志'
        verbose_name_plural = '审计日志'
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.created_at}] {self.user} - {self.get_action_display()} - {self.description[:50]}'


class SecurityConfig(models.Model):
    """安全配置（每租户一份）"""
    tenant = models.OneToOneField(
        'platform.Tenant',
        on_delete=models.CASCADE,
        related_name='security_config',
        verbose_name='所属租户'
    )
    audit_enabled = models.BooleanField(default=True, verbose_name='操作审计')
    data_isolation = models.BooleanField(default=True, verbose_name='数据隔离')
    mask_phone = models.BooleanField(default=True, verbose_name='手机号脱敏')
    mask_id_card = models.BooleanField(default=True, verbose_name='身份证脱敏')
    mask_bank_card = models.BooleanField(default=True, verbose_name='银行卡脱敏')
    mask_email = models.BooleanField(default=False, verbose_name='邮箱脱敏')
    mask_name = models.BooleanField(default=False, verbose_name='姓名脱敏')
    request_sign_enabled = models.BooleanField(default=False, verbose_name='请求签名验证')
    sign_secret = models.CharField(max_length=200, blank=True, default='', verbose_name='签名密钥')
    rate_limit_enabled = models.BooleanField(default=True, verbose_name='API限流')
    rate_limit_per_minute = models.IntegerField(default=60, verbose_name='每分钟请求上限')
    sensitive_keywords = models.JSONField(default=list, blank=True, verbose_name='敏感词列表')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'security_config'
        verbose_name = '安全配置'
        verbose_name_plural = '安全配置'

    def __str__(self):
        return f'{self.tenant.name} 安全配置'


class AccessControlRule(models.Model):
    """访问控制规则"""
    tenant = models.ForeignKey(
        'platform.Tenant',
        on_delete=models.CASCADE,
        related_name='access_rules',
        verbose_name='所属租户'
    )
    name = models.CharField(max_length=200, verbose_name='规则名称')
    rule_type = models.CharField(
        max_length=30,
        choices=[
            ('ip_whitelist', 'IP白名单'),
            ('ip_blacklist', 'IP黑名单'),
            ('time_restriction', '时间限制'),
            ('api_restriction', 'API限制'),
            ('data_restriction', '数据限制'),
        ],
        verbose_name='规则类型'
    )
    pattern = models.CharField(max_length=500, verbose_name='匹配模式')
    action = models.CharField(
        max_length=20,
        default='allow',
        choices=[('allow', '允许'), ('deny', '拒绝'), ('warn', '警告')],
        verbose_name='动作'
    )
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'security_access_rule'
        verbose_name = '访问控制规则'
        verbose_name_plural = '访问控制规则'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.tenant.name} - {self.name} ({self.get_rule_type_display()})'


class SecurityEvent(models.Model):
    """安全事件（异常行为告警）"""
    tenant = models.ForeignKey(
        'platform.Tenant',
        on_delete=models.CASCADE,
        related_name='security_events',
        verbose_name='所属租户'
    )
    event_type = models.CharField(
        max_length=50,
        choices=[
            ('brute_force', '暴力破解'),
            ('rate_limit_exceeded', '限流触发'),
            ('unauthorized_access', '越权访问'),
            ('sensitive_data', '敏感数据访问'),
            ('abnormal_export', '异常导出'),
            ('injection_attempt', '注入攻击'),
            ('signature_invalid', '签名验证失败'),
        ],
        verbose_name='事件类型'
    )
    severity = models.CharField(
        max_length=20,
        default='medium',
        choices=[
            ('low', '低'),
            ('medium', '中'),
            ('high', '高'),
            ('critical', '严重'),
        ],
        verbose_name='严重程度'
    )
    description = models.TextField(verbose_name='事件描述')
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='关联用户'
    )
    ip_address = models.CharField(max_length=50, blank=True, default='', verbose_name='IP地址')
    metadata = models.JSONField(default=dict, blank=True, verbose_name='元数据')
    resolved = models.BooleanField(default=False, verbose_name='是否已处理')
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_events',
        verbose_name='处理人'
    )
    resolved_at = models.DateTimeField(null=True, blank=True, verbose_name='处理时间')
    resolve_note = models.TextField(blank=True, default='', verbose_name='处理备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='发生时间')

    class Meta:
        db_table = 'security_event'
        verbose_name = '安全事件'
        verbose_name_plural = '安全事件'
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.severity}] {self.get_event_type_display()} - {self.description[:50]}'
