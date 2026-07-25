"""平台管理序列化器"""

from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import (
    Tenant, Role, TenantUser, Package, PackageQuota,
    AgentConfig, DifyConfig, DifyWorkflow
)


# ── 认证 ────────────────────────────

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs['username'], password=attrs['password'])
        if not user:
            raise serializers.ValidationError('用户名或密码错误')
        attrs['user'] = user
        return attrs


# ── 租户 ────────────────────────────

class TenantSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = ['id', 'code', 'name', 'platform_name', 'status', 'member_count', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def get_member_count(self, obj):
        return obj.members.count()

    def get_created_by(self, obj):
        return obj.created_by.username if obj.created_by else '系统'


# ── 角色 ────────────────────────────

class RoleSerializer(serializers.ModelSerializer):
    """角色序列化器 — 字段对齐前端 Role 接口（camelCase 别名）"""
    desc = serializers.CharField(source='description', read_only=True)
    canManageMembers = serializers.BooleanField(source='can_manage_members', read_only=True)
    canAssignCredits = serializers.BooleanField(source='can_assign_credits', read_only=True)

    class Meta:
        model = Role
        fields = ['id', 'name', 'code', 'desc', 'description', 'can_manage_members',
                  'can_assign_credits', 'canManageMembers', 'canAssignCredits',
                  'agents', 'views', 'created_at']
        read_only_fields = ['id', 'created_at']


# ── 成员 ────────────────────────────

class TenantUserSerializer(serializers.ModelSerializer):
    """成员序列化器 — 字段对齐前端 TenantMember 接口（camelCase 别名）"""
    username = serializers.CharField(source='user.username', read_only=True)
    name = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    role_code = serializers.CharField(source='role.code', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    roleId = serializers.CharField(source='role.code', read_only=True)
    roleName = serializers.CharField(source='role.name', read_only=True)
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all(), write_only=True, required=False)

    class Meta:
        model = TenantUser
        fields = ['id', 'username', 'name', 'email', 'role', 'role_code', 'role_name',
                  'roleId', 'roleName',
                  'credits', 'status', 'enabled', 'created_at']
        read_only_fields = ['id', 'username', 'name', 'email', 'role_code', 'role_name',
                           'roleId', 'roleName', 'created_at']


class MemberCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    name = serializers.CharField(required=False)
    role_id = serializers.IntegerField()


# ── 套餐 ────────────────────────────

class PackageQuotaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PackageQuota
        fields = ['id', 'agent_code', 'monthly', 'used']


class PackageSerializer(serializers.ModelSerializer):
    quotas = PackageQuotaSerializer(many=True, read_only=True)

    class Meta:
        model = Package
        fields = ['id', 'name', 'quotas', 'created_at']
        read_only_fields = ['id', 'created_at']


# ── 智能体配置 ────────────────────────────

class AgentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentConfig
        fields = ['id', 'agent_id', 'model_id', 'temperature', 'max_retry',
                  'fallback_model_id', 'human_takeover_threshold', 'custom']


# ── Dify 配置 ────────────────────────────

class DifyWorkflowSerializer(serializers.ModelSerializer):
    class Meta:
        model = DifyWorkflow
        fields = ['id', 'code', 'agent_code', 'api_key', 'base_url']


class DifyConfigSerializer(serializers.ModelSerializer):
    workflows = DifyWorkflowSerializer(many=True, read_only=True)

    class Meta:
        model = DifyConfig
        fields = ['id', 'configured', 'connection_status', 'last_test', 'error', 'workflows']
