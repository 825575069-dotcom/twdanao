"""模型网关增强序列化器"""

from rest_framework import serializers
from .models_ext import ModelKey, TokenUsage, RoutingStrategy, CircuitBreakerState


class ModelKeySerializer(serializers.ModelSerializer):
    """密钥序列化器 — 字段对齐前端 ModelKey 接口（api_key 脱敏返回）"""
    model_id = serializers.IntegerField(source='model.id', read_only=True)
    model_name = serializers.CharField(source='model.name', read_only=True)
    api_key = serializers.SerializerMethodField()

    class Meta:
        model = ModelKey
        fields = ['id', 'model_id', 'model_name', 'key_alias', 'api_key', 'endpoint',
                  'status', 'priority', 'daily_quota', 'daily_used', 'total_used',
                  'last_used', 'last_error', 'error_count', 'created_at']
        read_only_fields = ['daily_used', 'total_used', 'last_used', 'error_count', 'last_error']

    def get_api_key(self, obj):
        if not obj.api_key:
            return ''
        if len(obj.api_key) <= 8:
            return '****'
        return obj.api_key[:4] + '****' + obj.api_key[-4:]


class ModelKeyCreateSerializer(serializers.ModelSerializer):
    """密钥创建序列化器（包含 api_key 明文）"""
    class Meta:
        model = ModelKey
        fields = ['id', 'model', 'key_alias', 'api_key', 'endpoint', 'status',
                  'priority', 'daily_quota']
        extra_kwargs = {'api_key': {'write_only': True}}


class TokenUsageSerializer(serializers.ModelSerializer):
    model_name = serializers.CharField(source='model.name', read_only=True, default='')
    user_name = serializers.CharField(source='user.username', read_only=True, default='')

    class Meta:
        model = TokenUsage
        fields = '__all__'


class RoutingStrategySerializer(serializers.ModelSerializer):
    primary_model_name = serializers.CharField(source='primary_model.name', read_only=True, default='')
    fallback_model_name = serializers.CharField(source='fallback_model.name', read_only=True, default='')

    class Meta:
        model = RoutingStrategy
        fields = '__all__'


class CircuitBreakerStateSerializer(serializers.ModelSerializer):
    model_name = serializers.CharField(source='model.name', read_only=True)

    class Meta:
        model = CircuitBreakerState
        fields = '__all__'
