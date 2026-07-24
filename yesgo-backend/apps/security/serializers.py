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
    class Meta:
        model = AccessControlRule
        fields = '__all__'


class SecurityEventSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True, default='')
    resolved_by_name = serializers.CharField(source='resolved_by.username', read_only=True, default='')

    class Meta:
        model = SecurityEvent
        fields = '__all__'
