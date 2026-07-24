"""租户扩展 Admin"""
from django.contrib import admin
from .models import (
    KnowledgeDoc, MediaAsset, Task, CreditLedger, Skill,
    SaaSConnection, DataConnector
)


@admin.register(KnowledgeDoc)
class KnowledgeDocAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'type', 'folder', 'tenant')
    list_filter = ('tenant', 'type', 'folder')
    search_fields = ('name',)


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'type', 'tenant')
    list_filter = ('tenant', 'type')


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'agent_code', 'schedule', 'enabled', 'status', 'tenant')
    list_filter = ('tenant', 'status', 'enabled')


@admin.register(CreditLedger)
class CreditLedgerAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'amount', 'reason', 'balance_after', 'tenant', 'created_at')
    list_filter = ('tenant',)
    search_fields = ('user__username', 'reason')


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'category', 'installed')
    list_filter = ('category', 'installed')
    search_fields = ('name',)


@admin.register(SaaSConnection)
class SaaSConnectionAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'status', 'two_way', 'tenant')
    list_filter = ('tenant', 'status')


@admin.register(DataConnector)
class DataConnectorAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'type', 'enabled', 'status', 'tenant')
    list_filter = ('tenant', 'type', 'status', 'enabled')
