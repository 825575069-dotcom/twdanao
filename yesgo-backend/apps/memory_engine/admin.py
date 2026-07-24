"""记忆引擎 Admin"""
from django.contrib import admin
from .models import MemoryConfig, MemorySummary, MemoryFact, MemoryRecallLog


@admin.register(MemoryConfig)
class MemoryConfigAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'enabled', 'short_term_window', 'summary_threshold', 'retention_days', 'auto_summary')
    list_filter = ('enabled', 'auto_summary')
    search_fields = ('tenant__name',)


@admin.register(MemorySummary)
class MemorySummaryAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'summary_date', 'title', 'message_count', 'token_count', 'status')
    list_filter = ('status', 'summary_date')
    search_fields = ('title', 'content', 'tenant__name')
    readonly_fields = ('created_at',)
    filter_horizontal = ()


@admin.register(MemoryFact)
class MemoryFactAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'category', 'key', 'confidence', 'times_recalled', 'updated_at')
    list_filter = ('category',)
    search_fields = ('key', 'value', 'tenant__name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(MemoryRecallLog)
class MemoryRecallLogAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'conversation', 'short_term_messages', 'total_tokens', 'recall_strategy', 'created_at')
    list_filter = ('recall_strategy',)
    readonly_fields = ('created_at',)
