"""平台管理序列化器"""

from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import (
    Tenant, Role, TenantUser, Package, PackageQuota,
    Agent, AgentConfig, WorkflowTemplate,
    DifyConfig, DifyWorkflow, Prompt, AgentRole,
    PlatformDatabase, PlatformEnterprise,
    CreditConfig, CreditPackage, AgentCreditRule, CreditOrder,
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
    agent_count = serializers.SerializerMethodField()
    agent_codes = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)

    class Meta:
        model = Tenant
        fields = ['id', 'code', 'name', 'platform_name', 'enterprise_id', 'status',
                  'province', 'city', 'address', 'channel', 'channel_display',
                  'credits', 'member_count', 'agent_count', 'agent_codes',
                  'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def get_member_count(self, obj):
        return obj.members.count()

    def get_agent_count(self, obj):
        return obj.agent_configs.count()

    def get_agent_codes(self, obj):
        return list(obj.agent_configs.values_list('agent_id', flat=True))

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
        fields = ['id', 'name', 'code', 'desc', 'description', 'permissions',
                  'can_manage_members', 'can_assign_credits', 'canManageMembers', 'canAssignCredits',
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
    phone = serializers.CharField(required=False, allow_blank=True)
    creditAllocationType = serializers.CharField(source='credit_allocation_type', read_only=True)
    creditAllocationValue = serializers.IntegerField(source='credit_allocation_value', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = TenantUser
        fields = ['id', 'username', 'name', 'phone', 'email', 'role', 'role_code', 'role_name',
                  'roleId', 'roleName',
                  'credits', 'credit_allocation_type', 'credit_allocation_value',
                  'creditAllocationType', 'creditAllocationValue',
                  'status', 'enabled', 'created_at', 'createdAt']
        read_only_fields = ['id', 'username', 'name', 'email', 'role_code', 'role_name',
                           'roleId', 'roleName', 'creditAllocationType', 'creditAllocationValue',
                           'createdAt', 'created_at']


class MemberCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    name = serializers.CharField(required=False)
    phone = serializers.CharField(required=False, allow_blank=True)
    role_id = serializers.IntegerField()
    credits = serializers.IntegerField(required=False, default=500)
    credit_allocation_type = serializers.ChoiceField(
        choices=['unlimited', 'monthly', 'daily', 'fixed'],
        default='fixed', required=False
    )
    credit_allocation_value = serializers.IntegerField(required=False, default=0)


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
    custom_workflow_template_id = serializers.PrimaryKeyRelatedField(
        source='custom_workflow_template', queryset=WorkflowTemplate.objects.all(),
        allow_null=True, required=False
    )
    custom_workflow_template_name = serializers.CharField(
        source='custom_workflow_template.name', read_only=True
    )

    class Meta:
        model = AgentConfig
        fields = ['id', 'agent_id', 'model_id', 'temperature', 'max_retry',
                  'fallback_model_id', 'human_takeover_threshold', 'custom',
                  'custom_name', 'custom_role', 'custom_description',
                  'custom_workflow', 'custom_scarf_color', 'custom_avatar',
                  'bound_data_bases', 'bound_docs', 'bound_images',
                  'custom_workflow_template_id', 'custom_workflow_template_name']

    def validate_custom_workflow(self, value):
        """规范化自定义工作流步骤"""
        from .workflow_schema import normalize_workflow_steps
        return normalize_workflow_steps(value)


# ── 平台智能体 ────────────────────────────

class AgentSerializer(serializers.ModelSerializer):
    default_workflow_template_id = serializers.PrimaryKeyRelatedField(
        source='default_workflow_template', queryset=WorkflowTemplate.objects.all(),
        allow_null=True, required=False
    )
    default_workflow_template_name = serializers.CharField(
        source='default_workflow_template.name', read_only=True
    )
    agent_role_id = serializers.PrimaryKeyRelatedField(
        source='agent_role', queryset=AgentRole.objects.all(),
        allow_null=True, required=False
    )
    agent_role_name = serializers.CharField(
        source='agent_role.name', read_only=True
    )
    tenant_count = serializers.SerializerMethodField(read_only=True)

    external_workflow_code_display = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Agent
        fields = ['id', 'agent_id', 'code', 'name', 'role', 'emoji',
                  'scarf_color', 'avatar', 'accent', 'description', 'capabilities',
                  'stats', 'default_workflow', 'sort_order', 'enabled',
                  'capability_mode', 'external_workflow_code',
                  'external_workflow_code_display',
                  'default_workflow_template_id', 'default_workflow_template_name',
                  'agent_role_id', 'agent_role_name', 'tenant_count']

    def get_tenant_count(self, obj):
        return AgentConfig.objects.filter(agent_id=obj.agent_id).count()

    def get_external_workflow_code_display(self, obj):
        """返回外部工作流编码的中文显示名"""
        if not obj.external_workflow_code:
            return ''
        mapping = {
            'academic': '学术',
            'distribution': '流通',
            'marketing': '营销',
            'operations': '运营',
            'procurement': '采购',
        }
        return mapping.get(obj.external_workflow_code, obj.external_workflow_code)

    def validate_default_workflow(self, value):
        """规范化默认工作流步骤"""
        from .workflow_schema import normalize_workflow_steps
        return normalize_workflow_steps(value)


# ── 工作流模板 ────────────────────────────

class WorkflowTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowTemplate
        fields = ['id', 'name', 'description', 'category', 'tags',
                  'steps', 'edges', 'enabled', 'sort_order']

    def validate_steps(self, value):
        """保存前规范化 steps：纯文字 config 自动包装成结构化 dict"""
        from .workflow_schema import normalize_workflow_steps
        return normalize_workflow_steps(value)

    def validate_edges(self, value):
        """保存前规范化 edges"""
        from .workflow_schema import normalize_edges
        return normalize_edges(value)


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


# ── 提示词 ──────────────────────────────

class PromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prompt
        fields = ['id', 'prompt_type', 'category', 'title', 'icon', 'content', 'enabled', 'sort']


# ── 智能体角色 ──────────────────────────────

class AgentRoleSerializer(serializers.ModelSerializer):
    agent_code = serializers.CharField(source='bound_agent.agent_id', read_only=True)
    agent_name = serializers.CharField(source='bound_agent.name', read_only=True)
    agent_id = serializers.IntegerField(source='bound_agent.id', read_only=True)

    class Meta:
        model = AgentRole
        fields = ['id', 'name', 'code', 'category', 'description', 'enabled', 'sort',
                  'agent_id', 'agent_code', 'agent_name', 'created_at', 'updated_at']


# ── 平台数据库 / 平台企业 ────────────────────────────

class PlatformEnterpriseSerializer(serializers.ModelSerializer):
    """平台企业（同步缓存）序列化器"""
    matched_tenant_name = serializers.CharField(
        source='matched_tenant.name', read_only=True, default=''
    )
    matched_tenant_code = serializers.CharField(
        source='matched_tenant.code', read_only=True, default=''
    )
    platform_database_name = serializers.CharField(
        source='platform_database.name', read_only=True, default=''
    )
    db_type_display = serializers.CharField(
        source='get_db_type_display', read_only=True
    )

    class Meta:
        model = PlatformEnterprise
        fields = ['id', 'platform_database', 'platform_database_name',
                  'enterprise_id', 'enterprise_name',
                  'db_type', 'db_type_display', 'db_config',
                  'matched_tenant', 'matched_tenant_name', 'matched_tenant_code',
                  'last_synced_at']


class PlatformDatabaseSerializer(serializers.ModelSerializer):
    """平台数据库（SaaS 平台配置）序列化器"""
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    enterprise_count = serializers.SerializerMethodField()
    enterprises = PlatformEnterpriseSerializer(many=True, read_only=True)

    class Meta:
        model = PlatformDatabase
        fields = ['id', 'code', 'name', 'type', 'type_display',
                  'description', 'icon_name',
                  'api_base_url', 'api_token',
                  'sync_enabled', 'last_synced_at',
                  'last_sync_status', 'last_sync_error',
                  'total_enterprises', 'linked_tenant_count',
                  'enterprise_count', 'enterprises',
                  'enabled', 'sort_order',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at',
                           'last_synced_at', 'last_sync_status', 'last_sync_error',
                           'total_enterprises', 'linked_tenant_count',
                           'enterprise_count', 'enterprises']

    def get_enterprise_count(self, obj):
        return obj.enterprises.count()


# ── 积分管理 ────────────────────────────

class CreditConfigSerializer(serializers.ModelSerializer):
    """积分基础配置"""
    class Meta:
        model = CreditConfig
        fields = ['id', 'tokens_per_credit', 'unit_price', 'free_credits_on_register',
                  'min_purchase_credits', 'enable_online_pay', 'enable_offline_pay',
                  'updated_at']
        read_only_fields = ['id', 'updated_at']


class CreditPackageSerializer(serializers.ModelSerializer):
    """积分套餐"""
    class Meta:
        model = CreditPackage
        fields = ['id', 'name', 'credits', 'price', 'bonus_credits',
                  'is_popular', 'enabled', 'sort_order', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AgentCreditRuleSerializer(serializers.ModelSerializer):
    """智能体积分消耗规则"""
    class Meta:
        model = AgentCreditRule
        fields = ['id', 'agent_code', 'agent_name', 'coefficient',
                  'free_deduction', 'description', 'enabled',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CreditOrderSerializer(serializers.ModelSerializer):
    """积分购买订单"""
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    tenant_code = serializers.CharField(source='tenant.code', read_only=True)
    package_name = serializers.CharField(source='package.name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    confirmed_by_name = serializers.CharField(source='confirmed_by.username', read_only=True, default='')
    total_credits = serializers.IntegerField(read_only=True)

    class Meta:
        model = CreditOrder
        fields = ['id', 'order_no', 'tenant', 'tenant_name', 'tenant_code',
                  'package', 'package_name', 'credits', 'bonus_credits', 'total_credits',
                  'amount', 'payment_method', 'payment_method_display',
                  'status', 'status_display', 'proof_file', 'remark',
                  'confirmed_by', 'confirmed_by_name', 'confirmed_at',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'order_no', 'confirmed_by', 'confirmed_at',
                           'created_at', 'updated_at', 'total_credits']
