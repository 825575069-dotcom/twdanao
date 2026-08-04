"""
apps/wecom/serializers.py
企微数据序列化器
"""
from rest_framework import serializers
from .models import (
    WecomGlobalConfig, WecomNumber, WecomDevice, WecomContact, WecomMessage,
    WecomMediaFile, WecomGroupRoom, WecomTag, WecomTagGroup, MessageFavorite,
    WecomDraft,
)


class WecomGlobalConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = WecomGlobalConfig
        fields = ['id', 'sdk_url', 'sdk_token', 'callback_token', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class WecomNumberSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    bound_device_name = serializers.CharField(source='bound_device.name', read_only=True)

    class Meta:
        model = WecomNumber
        fields = [
            'id', 'guid', 'tenant', 'tenant_name', 'province_code', 'province_name',
            'remark', 'device_name', 'device_type', 'proxy_url', 'client_version',
            'expires_at', 'price', 'status', 'status_display',
            'bound_device', 'bound_device_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'guid', 'created_at', 'updated_at']


class WecomDeviceSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    wecom_number_id = serializers.IntegerField(source='wecom_number.id', read_only=True)

    class Meta:
        model = WecomDevice
        fields = [
            'id', 'tenant', 'tenant_name', 'wecom_number', 'wecom_number_id',
            'guid', 'name', 'mobile', 'remark',
            'qw_user_id', 'qw_account', 'status', 'ai_enabled', 'callback_url',
            'last_heartbeat', 'qiwe_token', 'avatar', 'province_code',
            'login_status', 'bound_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_heartbeat']


class WecomContactSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)
    tags = serializers.PrimaryKeyRelatedField(many=True, queryset=WecomTag.objects.all())
    tags_display = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    last_message_time = serializers.SerializerMethodField()
    last_message_type = serializers.SerializerMethodField()

    class Meta:
        model = WecomContact
        fields = [
            'id', 'tenant', 'device', 'device_name', 'external_userid',
            'name', 'remark', 'avatar', 'enterprise_id',
            'contact_source', 'qiwe_contact_type', 'qiwe_add_time',
            'gender', 'mobile',
            'ai_hosted', 'is_pinned', 'pinned_at',
            'last_contacted_at', 'tags', 'tags_display', 'created_at', 'updated_at',
            'last_message', 'last_message_time', 'last_message_type',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_tags_display(self, obj):
        return [{'id': t.id, 'name': t.name, 'color': t.color} for t in obj.tags.all()]

    def get_last_message(self, obj):
        """从注解字段获取最后消息内容（无注解时返回空串）"""
        return getattr(obj, 'last_message', '') or ''

    def get_last_message_time(self, obj):
        """从注解字段获取最后消息时间（无注解时返回 None）"""
        return getattr(obj, 'last_message_time', None)

    def get_last_message_type(self, obj):
        """从注解字段获取最后消息类型（无注解时返回空串）"""
        return getattr(obj, 'last_message_type', '') or ''


class WecomMessageSerializer(serializers.ModelSerializer):
    contact_name = serializers.SerializerMethodField()
    contact_avatar = serializers.SerializerMethodField()
    device_name = serializers.CharField(source='device.name', read_only=True)
    direction_display = serializers.CharField(source='get_direction_display', read_only=True)
    msg_type_display = serializers.CharField(source='get_msg_type_display', read_only=True)
    conversation_type_display = serializers.CharField(source='get_conversation_type_display', read_only=True)
    room_name = serializers.CharField(source='room.name', read_only=True)
    media_file_url = serializers.SerializerMethodField()
    quoted_message_content = serializers.SerializerMethodField()
    quoted_message_contact_name = serializers.SerializerMethodField()
    quoted_message_direction = serializers.SerializerMethodField()
    quoted_message_created_at = serializers.SerializerMethodField()

    class Meta:
        model = WecomMessage
        fields = [
            'id', 'tenant', 'device', 'device_name', 'contact', 'contact_name',
            'contact_avatar', 'direction', 'direction_display', 'msg_type',
            'msg_type_display', 'content', 'media_file', 'media_file_url', 'raw_data',
            'ai_generated', 'is_recalled', 'quoted_message',
            'quoted_message_content', 'quoted_message_contact_name',
            'quoted_message_direction', 'quoted_message_created_at', 'created_at',
            'msg_server_id', 'msg_unique_identifier',
            'room', 'room_name', 'conversation_type', 'conversation_type_display',
            'client_msg_id', 'status',
        ]
        read_only_fields = ['id', 'created_at']

    def get_media_file_url(self, obj):
        return obj.media_file.url if obj.media_file else None

    def get_contact_name(self, obj):
        """返回发送者名称：remark > name > external_userid"""
        if obj.contact:
            return obj.contact.remark or obj.contact.name or obj.contact.external_userid or ''
        return ''

    def get_contact_avatar(self, obj):
        """返回发送者头像 URL"""
        if obj.contact:
            return obj.contact.avatar or ''
        return ''

    def get_quoted_message_content(self, obj):
        if obj.quoted_message:
            return obj.quoted_message.content
        return None

    def get_quoted_message_contact_name(self, obj):
        if obj.quoted_message:
            if obj.quoted_message.direction == 'outbound':
                return '你'
            return obj.quoted_message.contact.remark or obj.quoted_message.contact.name
        return None

    def get_quoted_message_direction(self, obj):
        if obj.quoted_message:
            return obj.quoted_message.direction
        return None

    def get_quoted_message_created_at(self, obj):
        if obj.quoted_message:
            return obj.quoted_message.created_at
        return None


class WecomMediaFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = WecomMediaFile
        fields = [
            'id', 'tenant', 'file_type', 'qiwe_file_id', 'local_path',
            'url', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class WecomGroupRoomSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)
    tags = serializers.PrimaryKeyRelatedField(many=True, queryset=WecomTag.objects.all())
    tags_display = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    last_message_time = serializers.SerializerMethodField()
    last_message_type = serializers.SerializerMethodField()

    class Meta:
        model = WecomGroupRoom
        fields = [
            'id', 'tenant', 'device', 'device_name', 'group_id', 'name',
            'owner_id', 'member_count', 'member_user_ids',
            'tags', 'tags_display', 'created_at',
            'last_message', 'last_message_time', 'last_message_type',
        ]
        read_only_fields = ['id', 'created_at']

    def get_tags_display(self, obj):
        return [{'id': t.id, 'name': t.name, 'color': t.color} for t in obj.tags.all()]

    def get_last_message(self, obj):
        return getattr(obj, 'last_message', '') or ''

    def get_last_message_time(self, obj):
        return getattr(obj, 'last_message_time', None)

    def get_last_message_type(self, obj):
        return getattr(obj, 'last_message_type', '') or ''


class WecomTagGroupSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)
    tag_count = serializers.SerializerMethodField()

    class Meta:
        model = WecomTagGroup
        fields = [
            'id', 'tenant', 'device', 'device_name', 'group_id', 'name',
            'order', 'is_customer_level', 'tag_count', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_tag_count(self, obj):
        return obj.tags.count()


class WecomTagSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    contact_count = serializers.SerializerMethodField()
    group_room_count = serializers.SerializerMethodField()

    class Meta:
        model = WecomTag
        fields = [
            'id', 'tenant', 'device', 'device_name', 'tag_id', 'group',
            'group_name', 'name', 'color', 'order', 'is_customer_level',
            'contact_count', 'group_room_count', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_contact_count(self, obj):
        return obj.contacts.count()

    def get_group_room_count(self, obj):
        return obj.group_rooms.count()


class MessageFavoriteSerializer(serializers.ModelSerializer):
    msg_type_display = serializers.CharField(source='get_msg_type_display', read_only=True)

    class Meta:
        model = MessageFavorite
        fields = [
            'id', 'tenant', 'msg_type', 'msg_type_display',
            'content', 'media_file_url', 'media_file_name', 'raw_data', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class WecomDraftSerializer(serializers.ModelSerializer):
    conversation_type_display = serializers.CharField(source='get_conversation_type_display', read_only=True)

    class Meta:
        model = WecomDraft
        fields = [
            'id', 'tenant', 'device', 'conversation_type', 'conversation_type_display',
            'conversation_id', 'content', 'media_url', 'media_type',
            'updated_at', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
