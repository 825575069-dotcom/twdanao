"""
apps/wecom/admin.py
企微管理 Django Admin
"""
from django.contrib import admin
from .models import (
    WecomDevice, WecomContact, WecomMessage, WecomMediaFile,
    WecomGroupRoom, WecomTag,
)


@admin.register(WecomDevice)
class WecomDeviceAdmin(admin.ModelAdmin):
    list_display = ['name', 'guid', 'tenant', 'status', 'ai_enabled', 'last_heartbeat']
    list_filter = ['status', 'ai_enabled']
    search_fields = ['name', 'guid', 'qw_account']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(WecomContact)
class WecomContactAdmin(admin.ModelAdmin):
    list_display = ['remark', 'name', 'device', 'ai_hosted', 'last_contacted_at']
    list_filter = ['ai_hosted', 'device']
    search_fields = ['name', 'remark', 'external_userid', 'enterprise_id']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(WecomMessage)
class WecomMessageAdmin(admin.ModelAdmin):
    list_display = ['contact', 'direction', 'msg_type', 'ai_generated', 'created_at']
    list_filter = ['direction', 'msg_type', 'ai_generated']
    search_fields = ['content', 'contact__remark']
    readonly_fields = ['created_at']


@admin.register(WecomMediaFile)
class WecomMediaFileAdmin(admin.ModelAdmin):
    list_display = ['file_type', 'qiwe_file_id', 'created_at']
    list_filter = ['file_type']
    readonly_fields = ['created_at']


@admin.register(WecomGroupRoom)
class WecomGroupRoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'group_id', 'device', 'member_count', 'created_at']
    search_fields = ['name', 'group_id']
    readonly_fields = ['created_at']


@admin.register(WecomTag)
class WecomTagAdmin(admin.ModelAdmin):
    list_display = ['name', 'color', 'tag_id', 'tenant']
    search_fields = ['name', 'tag_id']
    readonly_fields = ['created_at']
