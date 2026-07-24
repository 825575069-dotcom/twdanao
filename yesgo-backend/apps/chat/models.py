"""智能体对话 App — 会话/消息"""

from django.db import models
from django.contrib.auth.models import User


class Conversation(models.Model):
    """对话会话"""
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='conversations', verbose_name='所属租户')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations', verbose_name='用户')
    title = models.CharField(max_length=200, verbose_name='会话标题')
    agent_code = models.CharField(max_length=50, blank=True, default='', verbose_name='智能体编码')
    message_count = models.IntegerField(default=0, verbose_name='消息数')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'chat_conversation'
        verbose_name = '对话会话'
        verbose_name_plural = '对话会话'

    def __str__(self):
        return f'{self.title} ({self.user.username})'


class Message(models.Model):
    """对话消息"""
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages', verbose_name='所属会话')
    role = models.CharField(
        max_length=20,
        choices=[('user', '用户'), ('assistant', '智能体')],
        verbose_name='角色'
    )
    content = models.TextField(verbose_name='消息内容')
    agent_code = models.CharField(max_length=50, blank=True, default='', verbose_name='智能体编码')
    agent_name = models.CharField(max_length=100, blank=True, default='', verbose_name='智能体名称')
    metadata = models.JSONField(default=dict, blank=True, verbose_name='元数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='发送时间')

    class Meta:
        db_table = 'chat_message'
        verbose_name = '对话消息'
        verbose_name_plural = '对话消息'
        ordering = ['created_at']

    def __str__(self):
        return f'{self.role}: {self.content[:50]}...'
