"""安全审计 Admin"""
from django.contrib import admin
from .models import AuditLog, SecurityConfig, AccessControlRule, SecurityEvent


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'user', 'action', 'method', 'path', 'risk_level', 'response_status', 'duration_ms')
    list_filter = ('action', 'risk_level', 'response_status', 'method')
    search_fields = ('path', 'description', 'ip_address', 'user__username')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'


@admin.register(SecurityConfig)
class SecurityConfigAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'audit_enabled', 'data_isolation', 'rate_limit_enabled', 'rate_limit_per_minute', 'request_sign_enabled')
    list_filter = ('audit_enabled', 'data_isolation', 'rate_limit_enabled')


@admin.register(AccessControlRule)
class AccessControlRuleAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'name', 'rule_type', 'action', 'enabled', 'created_at')
    list_filter = ('rule_type', 'action', 'enabled')
    search_fields = ('name', 'pattern', 'tenant__name')


@admin.register(SecurityEvent)
class SecurityEventAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'event_type', 'severity', 'resolved', 'user', 'ip_address')
    list_filter = ('event_type', 'severity', 'resolved')
    search_fields = ('description', 'ip_address', 'tenant__name')
    readonly_fields = ('created_at', 'resolved_at')
    actions = ['mark_resolved']

    def mark_resolved(self, request, queryset):
        from django.utils import timezone
        updated = queryset.update(resolved=True, resolved_at=timezone.now())
        self.message_user(request, f'已处理 {updated} 个安全事件')
    mark_resolved.short_description = '标记为已处理'
