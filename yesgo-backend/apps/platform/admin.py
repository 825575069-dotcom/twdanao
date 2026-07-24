"""平台管理 Admin — 租户/用户/角色/套餐/配置"""
from django.contrib import admin
from .models import (
    Tenant, Role, TenantUser, Package, PackageQuota,
    AgentConfig, DifyConfig, DifyWorkflow
)


class RoleInline(admin.TabularInline):
    model = Role
    extra = 0


class TenantUserInline(admin.TabularInline):
    model = TenantUser
    extra = 0
    raw_id_fields = ('user',)


class PackageQuotaInline(admin.TabularInline):
    model = PackageQuota
    extra = 0


class DifyWorkflowInline(admin.TabularInline):
    model = DifyWorkflow
    extra = 0


class AgentConfigInline(admin.TabularInline):
    model = AgentConfig
    extra = 0


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ('id', 'code', 'name', 'platform_name', 'status', 'member_count', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('name', 'code', 'platform_name')
    ordering = ('-created_at',)
    inlines = [RoleInline, TenantUserInline, AgentConfigInline]

    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = '成员数'


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'code', 'tenant', 'can_manage_members', 'can_assign_credits')
    list_filter = ('tenant',)
    search_fields = ('name', 'code')


@admin.register(TenantUser)
class TenantUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'tenant', 'role', 'credits', 'status', 'enabled')
    list_filter = ('tenant', 'status', 'enabled')
    search_fields = ('user__username',)
    raw_id_fields = ('user',)


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ('id', 'tenant', 'name')
    inlines = [PackageQuotaInline]


@admin.register(DifyConfig)
class DifyConfigAdmin(admin.ModelAdmin):
    list_display = ('id', 'tenant', 'configured', 'connection_status')
    inlines = [DifyWorkflowInline]
