"""大模型网关 App — 模型管理"""

from django.db import models


class AIModel(models.Model):
    """AI 模型"""
    name = models.CharField(max_length=100, verbose_name='模型��称')
    vendor = models.CharField(max_length=100, verbose_name='厂商')
    type = models.CharField(
        max_length=20, default='commercial',
        choices=[('commercial', '商业模型'), ('open', '开源模型')],
        verbose_name='模型类型'
    )
    context_k = models.IntegerField(default=32, verbose_name='上下文长度(K)')
    status = models.CharField(
        max_length=20, default='ready',
        choices=[('ready', '就绪'), ('deploying', '部署中'), ('offline', '已下线')],
        verbose_name='状态'
    )
    description = models.TextField(blank=True, default='', verbose_name='描述')
    api_key = models.CharField(max_length=200, blank=True, default='', verbose_name='API Key（加密存储）')
    endpoint = models.URLField(max_length=500, blank=True, default='', verbose_name='API 端点')
    config = models.JSONField(default=dict, blank=True, verbose_name='扩展配置')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'model_gateway_model'
        verbose_name = 'AI模型'
        verbose_name_plural = 'AI模型'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.vendor})'
