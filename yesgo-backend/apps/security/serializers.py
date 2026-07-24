"""安全审计序列化器"""

from rest_framework import serializers
from .models import AuditLog, SecurityConfig, AccessControlRule, SecurityEvent


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True, default='')

    class Meta:
        model = AuditLog
        fields = '__all__'


class SecurityConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityConfig
        fields = '__all__'


class AccessControlRuleSerializer(serializers.ModelSerializer):
    """访问控制规则序列化器 — type 字段对齐前端"""
    type = serializers.CharField(source='rule_type', read_only=True)

    class Meta:
        model = AccessControlRule
        fields = ['id', 'name', 'type', 'rule_type', 'pattern', 'action',
                  'enabled', 'description', 'created_at']


class SecurityEventSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True, default='')
    resolved_by_name = serializers.CharField(source='resolved_by.username', read_only=True, default='')

    class Meta:
        model = SecurityEvent
        fields = '__all__'
