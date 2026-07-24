"""租户扩展序列化器"""

from rest_framework import serializers
from .models import (
    KnowledgeDoc, MediaAsset, Task, CreditLedger, Skill,
    SaaSConnection, DataConnector
)


class KnowledgeDocSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeDoc
        fields = ['id', 'name', 'type', 'size', 'folder', 'bound_agents',
                  'uploaded_by', 'created_at']
        read_only_fields = ['id', 'created_at']


class MediaAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaAsset
        fields = ['id', 'name', 'type', 'size', 'uploaded_by', 'created_at']
        read_only_fields = ['id', 'created_at']


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ['id', 'name', 'agent_code', 'schedule', 'enabled',
                  'last_run', 'last_result', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']


class CreditLedgerSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = CreditLedger
        fields = ['id', 'user_id', 'user_name', 'agent_code', 'agent_name',
                  'amount', 'reason', 'balance_after', 'created_at']
        read_only_fields = ['id', 'created_at']


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ['id', 'name', 'description', 'category', 'installed']


class SaaSConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaaSConnection
        fields = ['id', 'name', 'description', 'status', 'two_way',
                  'last_sync', 'created_at']
        read_only_fields = ['id', 'created_at']


class DataConnectorSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataConnector
        fields = ['id', 'name', 'type', 'description', 'icon_name',
                  'enabled', 'status', 'config', 'last_sync', 'created_at']
        read_only_fields = ['id', 'created_at']


class CreditRechargeSerializer(serializers.Serializer):
    amount = serializers.IntegerField(min_value=1)
