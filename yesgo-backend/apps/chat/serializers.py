"""对话序列化器"""

from rest_framework import serializers
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'role', 'content', 'agent_code', 'agent_name',
                  'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = ['id', 'title', 'agent_code', 'message_count',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ChatSendSerializer(serializers.Serializer):
    message = serializers.CharField()
    session_id = serializers.CharField(required=False, allow_blank=True)
