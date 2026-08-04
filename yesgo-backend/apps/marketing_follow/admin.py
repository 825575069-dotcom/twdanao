"""
apps/marketing_follow/admin.py
营销跟客 Django Admin 注册
"""
from django.contrib import admin
from .models import (
    ChatSetting, AiReplyTask, ProactiveFollowTask,
    BroadcastTask, BroadcastRecipient, MomentsTask, CustomerProfile,
    MarketingTask, TaskExecution,
)


@admin.register(ChatSetting)
class ChatSettingAdmin(admin.ModelAdmin):
    list_display = ['device', 'ai_enabled', 'reply_style', 'reply_length', 'customer_address', 'updated_at']
    list_filter = ['ai_enabled', 'reply_style', 'reply_length']
    search_fields = ['device__name', 'agent_id']
    filter_horizontal = []


@admin.register(AiReplyTask)
class AiReplyTaskAdmin(admin.ModelAdmin):
    list_display = ['contact', 'device', 'status', 'llm_tokens', 'credit_cost', 'created_at', 'sent_at']
    list_filter = ['status']
    search_fields = ['contact__remark', 'contact__name']
    readonly_fields = ['prompt_snapshot', 'ai_segments', 'created_at', 'sent_at']


@admin.register(ProactiveFollowTask)
class ProactiveFollowTaskAdmin(admin.ModelAdmin):
    list_display = ['contact', 'device', 'trigger_type', 'status', 'created_at', 'sent_at']
    list_filter = ['trigger_type', 'status']
    search_fields = ['contact__remark', 'contact__name']


@admin.register(BroadcastTask)
class BroadcastTaskAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant', 'device', 'material_type', 'status', 'total_count', 'sent_count', 'failed_count', 'scheduled_at', 'created_at']
    list_filter = ['status', 'material_type']
    search_fields = ['name', 'device__name']
    readonly_fields = ['sent_count', 'failed_count', 'created_at']


@admin.register(BroadcastRecipient)
class BroadcastRecipientAdmin(admin.ModelAdmin):
    list_display = ['task', 'contact', 'status', 'monthly_count', 'sent_at']
    list_filter = ['status']


@admin.register(MomentsTask)
class MomentsTaskAdmin(admin.ModelAdmin):
    list_display = ['device', 'content', 'status', 'scheduled_at', 'created_at']
    list_filter = ['status']


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ['contact', 'customer_level', 'total_orders', 'total_amount', 'last_order_at', 'updated_at']
    list_filter = ['customer_level']
    search_fields = ['contact__remark', 'contact__name', 'enterprise_id']


@admin.register(MarketingTask)
class MarketingTaskAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant', 'device', 'trigger_type', 'action_type', 'status', 'valid_from', 'valid_until', 'created_at']
    list_filter = ['status', 'trigger_type', 'action_type']
    search_fields = ['name', 'agent_id']
    filter_horizontal = []


@admin.register(TaskExecution)
class TaskExecutionAdmin(admin.ModelAdmin):
    list_display = ['task', 'target_contact', 'status', 'started_at', 'completed_at', 'created_at']
    list_filter = ['status']
    search_fields = ['task__name', 'target_contact__remark', 'target_contact__name']
    readonly_fields = ['trigger_event', 'result', 'created_at', 'started_at', 'completed_at']
