"""
大模型网关增强 App — 新增模型密钥池/Token用量/路由策略
"""

from django.db import models
from .models import AIModel


class ModelKey(models.Model):
    """模型 API Key 密钥池"""
    model = models.ForeignKey(
        AIModel,
        on_delete=models.CASCADE,
        related_name='keys',
        verbose_name='所属模型'
    )
    key_alias = models.CharField(max_length=100, verbose_name='密钥别名')
    api_key = models.CharField(max_length=500, verbose_name='API Key（加密存储）')
    endpoint = models.URLField(max_length=500, blank=True, default='', verbose_name='API端点')
    status = models.CharField(
        max_length=20,
        default='active',
        choices=[
            ('active', '活跃'),
            ('disabled', '已禁用'),
            ('exhausted', '额度耗尽'),
            ('error', '异常'),
        ],
        verbose_name='状态'
    )
    priority = models.IntegerField(default=0, verbose_name='优先级（数字越小优先级越高）')
    daily_quota = models.IntegerField(default=0, verbose_name='每日配额（0=无限）')
    daily_used = models.IntegerField(default=0, verbose_name='今日已用')
    total_used = models.IntegerField(default=0, verbose_name='累计使用')
    last_used = models.DateTimeField(null=True, blank=True, verbose_name='最后使用时间')
    last_error = models.TextField(blank=True, default='', verbose_name='最后错误信息')
    error_count = models.IntegerField(default=0, verbose_name='连续错误次数')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'model_gateway_key'
        verbose_name = '模型密钥'
        verbose_name_plural = '模型密钥'
        ordering = ['priority', '-created_at']

    def __str__(self):
        return f'{self.model.name} - {self.key_alias} ({self.get_status_display()})'


class TokenUsage(models.Model):
    """Token 用量记录"""
    tenant = models.ForeignKey(
        'platform.Tenant',
        on_delete=models.CASCADE,
        related_name='token_usages',
        verbose_name='所属租户',
        null=True,
        blank=True,
    )
    model = models.ForeignKey(
        AIModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='token_usages',
        verbose_name='使用模型'
    )
    user = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='token_usages',
        verbose_name='用户'
    )
    agent_code = models.CharField(max_length=50, blank=True, default='', verbose_name='智能体编码')
    conversation_id = models.CharField(max_length=100, blank=True, default='', verbose_name='会话ID')
    prompt_tokens = models.IntegerField(default=0, verbose_name='输入Token数')
    completion_tokens = models.IntegerField(default=0, verbose_name='输出Token数')
    total_tokens = models.IntegerField(default=0, verbose_name='总Token数')
    cost = models.FloatField(default=0, verbose_name='费用估算（元）')
    latency_ms = models.IntegerField(default=0, verbose_name='响应耗时(ms)')
    status = models.CharField(
        max_length=20,
        default='success',
        choices=[('success', '成功'), ('failed', '失败'), ('timeout', '超时'), ('circuit_open', '熔断')],
        verbose_name='调用状态'
    )
    error_msg = models.TextField(blank=True, default='', verbose_name='错误信息')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='调用时间')

    class Meta:
        db_table = 'model_gateway_token_usage'
        verbose_name = 'Token用量'
        verbose_name_plural = 'Token用量'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.model.name if self.model else "N/A"} - {self.total_tokens}tokens - {self.created_at}'


class RoutingStrategy(models.Model):
    """模型路由策略"""
    tenant = models.ForeignKey(
        'platform.Tenant',
        on_delete=models.CASCADE,
        related_name='routing_strategies',
        verbose_name='所属租户',
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200, verbose_name='策略名称')
    agent_code = models.CharField(max_length=50, verbose_name='智能体编码')
    primary_model = models.ForeignKey(
        AIModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='primary_routes',
        verbose_name='主模型'
    )
    fallback_model = models.ForeignKey(
        AIModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fallback_routes',
        verbose_name='备用模型'
    )
    strategy_type = models.CharField(
        max_length=30,
        default='priority',
        choices=[
            ('priority', '优先级路由（主模型→备用模型）'),
            ('round_robin', '轮询负载均衡'),
            ('least_cost', '最低成本优先'),
            ('lowest_latency', '最低延迟优先'),
            ('weighted', '权重分配'),
        ],
        verbose_name='路由策略类型'
    )
    weight_config = models.JSONField(default=dict, blank=True, verbose_name='权重配置')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'model_gateway_routing'
        verbose_name = '路由策略'
        verbose_name_plural = '路由策略'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.agent_code} - {self.get_strategy_type_display()}'


class CircuitBreakerState(models.Model):
    """熔断器状态"""
    model = models.OneToOneField(
        AIModel,
        on_delete=models.CASCADE,
        related_name='circuit_state',
        verbose_name='所属模型'
    )
    state = models.CharField(
        max_length=20,
        default='closed',
        choices=[
            ('closed', '关闭（正常）'),
            ('open', '打开（熔断中）'),
            ('half_open', '半开（试探中）'),
        ],
        verbose_name='熔断器状态'
    )
    failure_count = models.IntegerField(default=0, verbose_name='连续失败次数')
    failure_threshold = models.IntegerField(default=5, verbose_name='熔断阈值')
    recovery_timeout = models.IntegerField(default=60, verbose_name='恢复超时(秒)')
    last_failure = models.DateTimeField(null=True, blank=True, verbose_name='最后失败时间')
    last_error = models.TextField(blank=True, default='', verbose_name='最后错误信息')
    last_state_change = models.DateTimeField(null=True, blank=True, verbose_name='最后状态变更时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'model_gateway_circuit'
        verbose_name = '熔断器状态'
        verbose_name_plural = '熔断器状态'

    def __str__(self):
        return f'{self.model.name} - {self.get_state_display()}'
