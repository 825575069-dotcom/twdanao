"""
apps/marketing_follow/serializers.py
营销跟客序列化器
"""
from rest_framework import serializers
from .models import (
    ChatSetting, AiReplyTask, ProactiveFollowTask,
    BroadcastTask, BroadcastRecipient, MomentsTask, CustomerProfile,
    MarketingTask, TaskExecution, AutoTagRule,
    MassSendTask, MassSendMaterial, MassSendTarget, MassSendSchedule,
    MomentsContent, MomentsTarget, MomentsSchedule,
)


class ChatSettingSerializer(serializers.ModelSerializer):
    """聊天设置序列化器"""
    device_name = serializers.CharField(source='device.name', read_only=True)
    agent_name = serializers.SerializerMethodField()

    class Meta:
        model = ChatSetting
        fields = [
            'id', 'tenant', 'device', 'device_name',
            'agent_id', 'agent_name',
            'ai_enabled', 'reply_style', 'reply_length',
            'customer_address', 'ai_signature',
            'quick_replies', 'forbidden_words',
            'work_hours_start', 'work_hours_end',
            # 单聊设置
            'memory_rounds', 'reply_delay_min', 'reply_delay_max',
            'non_text_reply_strategy', 'non_text_reply_content',
            'stop_reply_keywords',
            # 群聊设置
            'group_reply_mode', 'group_no_at_whitelist',
            'group_fixed_reply_enabled', 'group_fixed_reply_start',
            'group_fixed_reply_end', 'group_fixed_reply_rooms',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['tenant', 'created_at']

    def get_agent_name(self, obj):
        if not obj.agent_id:
            return ''
        try:
            from apps.platform.models import Agent
            agent = Agent.objects.filter(agent_id=obj.agent_id).first()
            if not agent:
                agent = Agent.objects.filter(code=obj.agent_id).first()
            return agent.name if agent else obj.agent_id
        except Exception:
            return obj.agent_id


class AiReplyTaskSerializer(serializers.ModelSerializer):
    """AI回复任务序列化器"""
    contact_name = serializers.CharField(source='contact.remark', read_only=True)
    contact_avatar = serializers.CharField(source='contact.avatar', read_only=True)
    device_name = serializers.CharField(source='device.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AiReplyTask
        fields = '__all__'


class ProactiveFollowTaskSerializer(serializers.ModelSerializer):
    """主动跟进任务序列化器"""
    contact_name = serializers.CharField(source='contact.remark', read_only=True)
    device_name = serializers.CharField(source='device.name', read_only=True)
    trigger_type_display = serializers.CharField(source='get_trigger_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ProactiveFollowTask
        fields = '__all__'


class BroadcastTaskSerializer(serializers.ModelSerializer):
    """群发任务序列化器"""
    device_name = serializers.CharField(source='device.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    material_type_display = serializers.CharField(source='get_material_type_display', read_only=True)
    recipient_count = serializers.SerializerMethodField()

    class Meta:
        model = BroadcastTask
        fields = '__all__'

    def get_recipient_count(self, obj):
        return obj.recipients.count()


class BroadcastRecipientSerializer(serializers.ModelSerializer):
    """群发接收者序列化器"""
    contact_name = serializers.CharField(source='contact.remark', read_only=True)
    contact_avatar = serializers.CharField(source='contact.avatar', read_only=True)
    contact_external_userid = serializers.CharField(source='contact.external_userid', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    task_name = serializers.CharField(source='task.name', read_only=True)

    class Meta:
        model = BroadcastRecipient
        fields = '__all__'


class MomentsContentSerializer(serializers.ModelSerializer):
    """朋友圈内容序列化器"""
    media_type_display = serializers.CharField(source='get_media_type_display', read_only=True)

    class Meta:
        model = MomentsContent
        fields = [
            'id', 'task', 'order',
            'text', 'random_emoji',
            'media_type', 'media_type_display', 'media_urls',
            'link_title', 'link_desc', 'link_url', 'link_pic_url',
            'ai_polish_enabled', 'tone_template', 'prompt_template',
            'created_at',
        ]
        read_only_fields = ['created_at']


class MomentsTargetSerializer(serializers.ModelSerializer):
    """朋友圈发送对象序列化器"""

    class Meta:
        model = MomentsTarget
        fields = ['id', 'task', 'device_ids', 'estimated_count', 'created_at']
        read_only_fields = ['created_at']


class MomentsScheduleSerializer(serializers.ModelSerializer):
    """朋友圈执行时间序列化器"""

    class Meta:
        model = MomentsSchedule
        fields = ['id', 'task', 'scheduled_at',
                  'daily_start_time', 'daily_end_time', 'daily_interval', 'created_at']
        read_only_fields = ['created_at']


class MomentsTaskSerializer(serializers.ModelSerializer):
    """朋友圈任务序列化器"""
    device_name = serializers.CharField(source='device.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    contents = MomentsContentSerializer(many=True, read_only=True)
    target = MomentsTargetSerializer(read_only=True)
    schedule = MomentsScheduleSerializer(read_only=True)

    class Meta:
        model = MomentsTask
        fields = [
            'id', 'tenant', 'device', 'device_name',
            'name', 'status', 'status_display',
            'created_by', 'started_by', 'is_enabled',
            'daily_loop',
            # 统计
            'wechat_total', 'success_sent', 'pending',
            'failed', 'network_error',
            # 嵌套
            'contents', 'target', 'schedule',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['tenant', 'created_at', 'updated_at',
                            'wechat_total', 'success_sent', 'pending',
                            'failed', 'network_error']


class CustomerProfileSerializer(serializers.ModelSerializer):
    """客户画像序列化器"""
    contact_name = serializers.CharField(source='contact.remark', read_only=True)

    class Meta:
        model = CustomerProfile
        fields = '__all__'


class MarketingTaskSerializer(serializers.ModelSerializer):
    """营销自动化任务序列化器"""
    device_name = serializers.CharField(source='device.name', read_only=True)
    trigger_type_display = serializers.CharField(source='get_trigger_type_display', read_only=True)
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    agent_name = serializers.SerializerMethodField()
    execution_count = serializers.SerializerMethodField()

    class Meta:
        model = MarketingTask
        fields = [
            'id', 'tenant', 'device', 'device_name',
            'name', 'trigger_type', 'trigger_type_display',
            'trigger_config', 'action_type', 'action_type_display',
            'action_config', 'agent_id', 'agent_name',
            'status', 'status_display',
            'valid_from', 'valid_until',
            'created_at', 'updated_at',
            'execution_count',
        ]
        read_only_fields = ['tenant', 'created_at', 'updated_at']

    def get_agent_name(self, obj):
        if not obj.agent_id:
            return ''
        try:
            from apps.platform.models import Agent
            agent = Agent.objects.filter(agent_id=obj.agent_id).first()
            if not agent:
                agent = Agent.objects.filter(code=obj.agent_id).first()
            return agent.name if agent else obj.agent_id
        except Exception:
            return obj.agent_id

    def get_execution_count(self, obj):
        return obj.executions.count()


class TaskExecutionSerializer(serializers.ModelSerializer):
    """任务执行记录序列化器"""
    task_name = serializers.CharField(source='task.name', read_only=True)
    contact_name = serializers.CharField(source='target_contact.remark', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = TaskExecution
        fields = '__all__'


class AutoTagRuleSerializer(serializers.ModelSerializer):
    """自动贴标签规则序列化器"""
    device_name = serializers.CharField(source='device.name', read_only=True)
    target_tag_name = serializers.CharField(source='target_tag.name', read_only=True)
    target_tag_color = serializers.CharField(source='target_tag.color', read_only=True)
    match_mode_display = serializers.CharField(source='get_match_mode_display', read_only=True)
    scope_display = serializers.CharField(source='get_scope_display', read_only=True)

    class Meta:
        model = AutoTagRule
        fields = [
            'id', 'tenant', 'device', 'device_name',
            'name', 'keywords', 'match_mode', 'match_mode_display',
            'scope', 'scope_display',
            'target_tag', 'target_tag_name', 'target_tag_color',
            'is_enabled', 'hit_count', 'last_run_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['tenant', 'created_at', 'updated_at', 'hit_count', 'last_run_at']


class MassSendMaterialSerializer(serializers.ModelSerializer):
    """群发素材序列化器"""
    msg_type_display = serializers.CharField(source='get_msg_type_display', read_only=True)

    class Meta:
        model = MassSendMaterial
        fields = ['id', 'task', 'order', 'msg_type', 'msg_type_display', 'content', 'created_at']
        read_only_fields = ['created_at']


class MassSendTargetSerializer(serializers.ModelSerializer):
    """发送对象序列化器"""
    target_type_display = serializers.CharField(source='get_target_type_display', read_only=True)

    class Meta:
        model = MassSendTarget
        fields = ['id', 'task', 'target_type', 'target_type_display',
                  'tag_ids', 'contact_ids', 'group_ids',
                  'filter_conditions', 'estimated_count', 'created_at']
        read_only_fields = ['created_at']


class MassSendScheduleSerializer(serializers.ModelSerializer):
    """执行时间序列化器"""

    class Meta:
        model = MassSendSchedule
        fields = ['id', 'task', 'scheduled_at',
                  'daily_start_time', 'daily_end_time', 'daily_interval', 'created_at']
        read_only_fields = ['created_at']


class MassSendTaskSerializer(serializers.ModelSerializer):
    """精准群发任务序列化器"""
    device_name = serializers.CharField(source='device.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    materials = MassSendMaterialSerializer(many=True, read_only=True)
    target = MassSendTargetSerializer(read_only=True)
    schedule = MassSendScheduleSerializer(read_only=True)

    class Meta:
        model = MassSendTask
        fields = [
            'id', 'tenant', 'device', 'device_name',
            'name', 'status', 'status_display',
            'created_by', 'started_by', 'is_enabled',
            'daily_loop',
            # 统计
            'planned_total', 'planned_success', 'planned_pending',
            'planned_failed', 'planned_network_error',
            'disabled_count', 'reply_rate',
            # 嵌套
            'materials', 'target', 'schedule',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['tenant', 'created_at', 'updated_at',
                            'planned_total', 'planned_success', 'planned_pending',
                            'planned_failed', 'planned_network_error',
                            'disabled_count', 'reply_rate']
