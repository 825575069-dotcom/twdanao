"""对话 Admin"""
from django.contrib import admin
from .models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ('role', 'content', 'created_at')
    can_delete = False


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'user', 'agent_code', 'message_count', 'tenant', 'created_at')
    list_filter = ('tenant', 'agent_code')
    search_fields = ('title', 'user__username')
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'conversation', 'role', 'content_preview', 'created_at')
    list_filter = ('role',)
    readonly_fields = ('role', 'content', 'metadata')

    def content_preview(self, obj):
        return obj.content[:60] + ('...' if len(obj.content) > 60 else '')
    content_preview.short_description = '内容预览'
