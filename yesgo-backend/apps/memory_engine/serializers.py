"""记忆引擎序列化器"""

from rest_framework import serializers
from .models import MemoryConfig, MemorySummary, MemoryFact, MemoryRecallLog


class MemoryConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemoryConfig
        fields = '__all__'


class MemorySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = MemorySummary
        fields = '__all__'


class MemoryFactSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemoryFact
        fields = '__all__'


class MemoryRecallLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemoryRecallLog
        fields = '__all__'
