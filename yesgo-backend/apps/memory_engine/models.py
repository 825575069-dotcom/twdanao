"""
记忆引擎 App — 双层持久记忆 + 异步摘要
第一层：短期记忆（最近N条消息上下文窗口）
第二层：长期记忆（每日对话摘要 + 关键事实提取）
"""

from django.db import models
from django.contrib.auth.models import User


class MemoryConfig(models.Model):
    """记忆配置（每租户一份）"""
    tenant = models.OneToOneField(
        'platform.Tenant',
        on_delete=models.CASCADE,
        related_name='memory_config',
        verbose_name='所属租户'
    )
    enabled = models.BooleanField(default=True, verbose_name='是否启用记忆引擎')
    short_term_window = models.IntegerField(default=20, verbose_name='短期记忆窗口（最近N条消息）')
    summary_threshold = models.IntegerField(default=30, verbose_name='摘要触发阈值（消息数达到N条时生成摘要）')
    retention_days = models.IntegerField(default=180, verbose_name='记忆保留天数')
    max_summaries = models.IntegerField(default=100, verbose_name='最大摘要数量')
    auto_summary = models.BooleanField(default=True, verbose_name='自动生成每日摘要')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'memory_config'
        verbose_name = '记忆配置'
        verbose_name_plural = '记忆配置'

    def __str__(self):
        return f'{self.tenant.name} 记忆配置'


class MemorySummary(models.Model):
    """对话摘要（长期记忆）"""
    tenant = models.ForeignKey(
        'platform.Tenant',
        on_delete=models.CASCADE,
        related_name='memory_summaries',
        verbose_name='所属租户'
    )
    conversation = models.ForeignKey(
        'chat.Conversation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='summaries',
        verbose_name='关联会话'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='memory_summaries',
        verbose_name='用户'
    )
    summary_date = models.DateField(verbose_name='摘要日期')
    title = models.CharField(max_length=300, verbose_name='摘要标题')
    content = models.TextField(verbose_name='摘要内容')
    keywords = models.JSONField(default=list, blank=True, verbose_name='关键词条目')
    key_facts = models.JSONField(default=list, blank=True, verbose_name='关键事实')
    agent_codes = models.JSONField(default=list, blank=True, verbose_name='涉及智能体')
    message_count = models.IntegerField(default=0, verbose_name='覆盖消息数')
    token_count = models.IntegerField(default=0, verbose_name='估算Token数')
    status = models.CharField(
        max_length=20,
        default='active',
        choices=[
            ('active', '活跃'),
            ('archived', '已归档'),
            ('expired', '已过期'),
        ],
        verbose_name='状态'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'memory_summary'
        verbose_name = '对话摘要'
        verbose_name_plural = '对话摘要'
        ordering = ['-summary_date', '-created_at']

    def __str__(self):
        return f'{self.tenant.name} - {self.summary_date} - {self.title[:30]}'


class MemoryFact(models.Model):
    """关键事实（从对话中提取的结构化记忆）"""
    tenant = models.ForeignKey(
        'platform.Tenant',
        on_delete=models.CASCADE,
        related_name='memory_facts',
        verbose_name='所属租户'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='memory_facts',
        verbose_name='用户'
    )
    category = models.CharField(
        max_length=50,
        default='general',
        choices=[
            ('preference', '用户偏好'),
            ('business', '业务事实'),
            ('entity', '实体信息'),
            ('decision', '历史决策'),
            ('general', '通用'),
        ],
        verbose_name='事实类别'
    )
    key = models.CharField(max_length=200, verbose_name='事实键')
    value = models.TextField(verbose_name='事实值')
    confidence = models.FloatField(default=0.8, verbose_name='置信度')
    source_conversation = models.ForeignKey(
        'chat.Conversation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='来源会话'
    )
    times_recalled = models.IntegerField(default=0, verbose_name='被召回次数')
    last_recalled = models.DateTimeField(null=True, blank=True, verbose_name='最后召回时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'memory_fact'
        verbose_name = '关键事实'
        verbose_name_plural = '关键事实'
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.tenant.name} - [{self.category}] {self.key}'


class MemoryRecallLog(models.Model):
    """记忆召回日志（记录每次对话使用了哪些记忆）"""
    tenant = models.ForeignKey(
        'platform.Tenant',
        on_delete=models.CASCADE,
        related_name='memory_recall_logs',
        verbose_name='所属租户'
    )
    conversation = models.ForeignKey(
        'chat.Conversation',
        on_delete=models.CASCADE,
        related_name='recall_logs',
        verbose_name='关联会话'
    )
    message = models.ForeignKey(
        'chat.Message',
        on_delete=models.CASCADE,
        related_name='recall_logs',
        null=True,
        blank=True,
        verbose_name='关联消息'
    )
    recalled_summaries = models.JSONField(default=list, blank=True, verbose_name='召回的摘要ID列表')
    recalled_facts = models.JSONField(default=list, blank=True, verbose_name='召回的事实ID列表')
    short_term_messages = models.IntegerField(default=0, verbose_name='短期记忆消息数')
    total_tokens = models.IntegerField(default=0, verbose_name='记忆上下文Token数')
    recall_strategy = models.CharField(
        max_length=30,
        default='hybrid',
        choices=[
            ('short_term', '仅短期记忆'),
            ('summary', '仅摘要召回'),
            ('fact', '仅事实召回'),
            ('hybrid', '混合召回'),
        ],
        verbose_name='召回策略'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'memory_recall_log'
        verbose_name = '记忆召回日志'
        verbose_name_plural = '记忆召回日志'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.conversation.title} - 召回{len(self.recalled_summaries)}摘要/{len(self.recalled_facts)}事实'
