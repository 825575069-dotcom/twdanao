"""模型网关序列化器"""

from rest_framework import serializers
from .models import AIModel


class AIModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIModel
        fields = ['id', 'name', 'vendor', 'type', 'context_k', 'status',
                  'description', 'endpoint', 'config', 'created_at']
        read_only_fields = ['id', 'created_at']


class ModelTestSerializer(serializers.Serializer):
    model_id = serializers.CharField()


class ModelDeploySerializer(serializers.Serializer):
    model_id = serializers.CharField()


class ModelConfigSerializer(serializers.Serializer):
    model_id = serializers.CharField()
    temperature = serializers.FloatField(required=False)
    max_tokens = serializers.IntegerField(required=False)
