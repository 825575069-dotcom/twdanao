"""模型网关 Admin"""
from django.contrib import admin
from .models import AIModel
from .models_ext import ModelKey, TokenUsage, RoutingStrategy, CircuitBreakerState


@admin.register(AIModel)
class AIModelAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'vendor', 'type', 'context_k', 'status')
    list_filter = ('type', 'status', 'vendor')
    search_fields = ('name', 'vendor', 'description')
    actions = ['activate_models', 'deactivate_models']

    def activate_models(self, request, queryset):
        queryset.update(status='ready')
    activate_models.short_description = '激活所选模型'

    def deactivate_models(self, request, queryset):
        queryset.update(status='offline')
    deactivate_models.short_description = '下线所选模型'


@admin.register(ModelKey)
class ModelKeyAdmin(admin.ModelAdmin):
    list_display = ('model', 'key_alias', 'status', 'priority', 'daily_used', 'daily_quota', 'total_used', 'error_count')
    list_filter = ('status', 'priority')
    search_fields = ('key_alias', 'model__name')


@admin.register(TokenUsage)
class TokenUsageAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'model', 'user', 'agent_code', 'total_tokens', 'cost', 'latency_ms', 'status')
    list_filter = ('status', 'agent_code')
    search_fields = ('model__name', 'user__username', 'conversation_id')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at',)


@admin.register(RoutingStrategy)
class RoutingStrategyAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant', 'agent_code', 'primary_model', 'fallback_model', 'strategy_type', 'enabled')
    list_filter = ('strategy_type', 'enabled')
    search_fields = ('name', 'agent_code', 'tenant__name')


@admin.register(CircuitBreakerState)
class CircuitBreakerStateAdmin(admin.ModelAdmin):
    list_display = ('model', 'state', 'failure_count', 'failure_threshold', 'last_failure')
    list_filter = ('state',)
    readonly_fields = ('created_at', 'updated_at')
