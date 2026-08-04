"""
apps/marketing_follow/views.py
营销跟客 API 视图

包含：聊天设置 CRUD、AI回复任务查询、客户画像、数据看板
"""
import logging
from django.utils import timezone
from django.db.models import Sum
from rest_framework.views import APIView

from apps.platform.utils import api_success, api_error, API_CODE
from apps.platform.models import Tenant
from apps.wecom.models import WecomDevice, WecomContact, WecomMessage, WecomGroupRoom
from .models import (
    ChatSetting, AiReplyTask, ProactiveFollowTask,
    BroadcastTask, BroadcastRecipient, MomentsTask, CustomerProfile,
    MarketingTask, TaskExecution, AutoTagRule,
    MassSendTask, MassSendMaterial, MassSendTarget, MassSendSchedule,
    MomentsContent, MomentsTarget, MomentsSchedule,
)
from .serializers import (
    ChatSettingSerializer, AiReplyTaskSerializer,
    ProactiveFollowTaskSerializer, BroadcastTaskSerializer,
    BroadcastRecipientSerializer,
    MomentsTaskSerializer, CustomerProfileSerializer,
    MarketingTaskSerializer, TaskExecutionSerializer,
    AutoTagRuleSerializer,
    MassSendTaskSerializer, MassSendMaterialSerializer,
    MassSendTargetSerializer, MassSendScheduleSerializer,
    MomentsContentSerializer, MomentsTargetSerializer, MomentsScheduleSerializer,
)
from apps.wecom.models import WecomTag

logger = logging.getLogger(__name__)


def _get_tenant(request):
    """从请求中获取租户"""
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return None


# ============================================================
# 聊天设置
# ============================================================

class ChatSettingListView(APIView):
    """聊天设置列表"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        settings = ChatSetting.objects.filter(tenant=tenant).select_related('device')
        serializer = ChatSettingSerializer(settings, many=True)
        return api_success(serializer.data)


class ChatSettingDetailView(APIView):
    """聊天设置详情 / 创建 / 更新（按 device_id）"""

    def get(self, request, device_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            setting = ChatSetting.objects.get(tenant=tenant, device_id=device_id)
        except ChatSetting.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '未配置聊天设置')
        serializer = ChatSettingSerializer(setting)
        return api_success(serializer.data)

    def post(self, request, device_id):
        """创建或更新聊天设置（upsert）"""
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        try:
            device = WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')

        setting, created = ChatSetting.objects.get_or_create(
            tenant=tenant,
            device=device,
            defaults={
                'agent_id': request.data.get('agent_id', ''),
                'ai_enabled': request.data.get('ai_enabled', True),
                'reply_style': request.data.get('reply_style', 'friendly'),
                'reply_length': request.data.get('reply_length', 'short'),
                'customer_address': request.data.get('customer_address', 'remark'),
                'ai_signature': request.data.get('ai_signature', False),
                'quick_replies': request.data.get('quick_replies', []),
                'forbidden_words': request.data.get('forbidden_words', []),
                'work_hours_start': request.data.get('work_hours_start'),
                'work_hours_end': request.data.get('work_hours_end'),
            }
        )

        if not created:
            # 更新已有设置
            for field in [
                'agent_id', 'ai_enabled', 'reply_style', 'reply_length',
                'customer_address', 'ai_signature', 'quick_replies',
                'forbidden_words', 'work_hours_start', 'work_hours_end',
            ]:
                if field in request.data:
                    setattr(setting, field, request.data[field])
            setting.save()

        serializer = ChatSettingSerializer(setting)
        msg = '聊天设置已创建' if created else '聊天设置已更新'
        return api_success(serializer.data, msg)


# ============================================================
# AI 回复任务
# ============================================================

class AiReplyTaskListView(APIView):
    """AI回复任务列表"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        tasks = AiReplyTask.objects.filter(tenant=tenant).select_related(
            'contact', 'device', 'inbound_message'
        )

        # 筛选
        device_id = request.query_params.get('device_id')
        contact_id = request.query_params.get('contact_id')
        status = request.query_params.get('status')

        if device_id:
            tasks = tasks.filter(device_id=device_id)
        if contact_id:
            tasks = tasks.filter(contact_id=contact_id)
        if status:
            tasks = tasks.filter(status=status)

        # 分页
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        total = tasks.count()
        tasks = tasks[(page - 1) * page_size: page * page_size]

        serializer = AiReplyTaskSerializer(tasks, many=True)
        return api_success({
            'list': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
        })


# ============================================================
# 主动跟进任务
# ============================================================

class ProactiveFollowTaskListView(APIView):
    """主动跟进任务列表"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        tasks = ProactiveFollowTask.objects.filter(tenant=tenant).select_related(
            'contact', 'device'
        )

        status = request.query_params.get('status')
        if status:
            tasks = tasks.filter(status=status)

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        total = tasks.count()
        tasks = tasks[(page - 1) * page_size: page * page_size]

        serializer = ProactiveFollowTaskSerializer(tasks, many=True)
        return api_success({
            'list': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
        })


# ============================================================
# 群发任务
# ============================================================

class BroadcastTaskListView(APIView):
    """群发任务列表"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        tasks = BroadcastTask.objects.filter(tenant=tenant).select_related('device')

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        total = tasks.count()
        tasks = tasks[(page - 1) * page_size: page * page_size]

        serializer = BroadcastTaskSerializer(tasks, many=True)
        return api_success({
            'list': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
        })


class BroadcastTaskCreateView(APIView):
    """创建群发任务

    POST 参数：
      - device_id: 设备 ID (必填)
      - name: 任务名称 (必填)
      - material_type: 素材类型 text/link/miniprogram (默认 text)
      - material_content: 素材内容 dict
        - text: {"text": "消息内容"}
        - link: {"title": "...", "desc": "...", "url": "...", "pic_url": "..."}
        - miniprogram: {"title": "...", "desc": "...", "url": "...", "pic_url": "..."}
      - filter_tags: 标签筛选 list (可选)
      - filter_conditions: 条件筛选 dict (可选)
        - customer_levels: ["VIP", "A"]
        - min_orders: 5
        - min_amount: 1000
      - scheduled_at: 定时发送时间 (可选，不填则立即发送)
      - preview_only: true 时只返回预览接收者，不创建任务
    """

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        device_id = request.data.get('device_id')
        if not device_id:
            return api_error(API_CODE.BAD_REQUEST, 'device_id 必填')
        try:
            device = WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')

        name = request.data.get('name', '').strip()
        if not name:
            return api_error(API_CODE.BAD_REQUEST, 'name 必填')

        material_type = request.data.get('material_type', 'text')
        material_content = request.data.get('material_content', {})
        filter_tags = request.data.get('filter_tags', [])
        filter_conditions = request.data.get('filter_conditions', {})
        scheduled_at = request.data.get('scheduled_at')

        # 预览模式
        if request.data.get('preview_only'):
            from .broadcast_executor import preview_recipients
            recipients = preview_recipients(device, tenant, filter_tags, filter_conditions)
            return api_success({
                'recipients': recipients,
                'count': len(recipients),
            }, '预览成功')

        # 校验素材内容
        if material_type == 'text' and not material_content.get('text'):
            return api_error(API_CODE.BAD_REQUEST, 'material_content.text 必填')
        if material_type in ('link', 'miniprogram') and not material_content.get('url'):
            return api_error(API_CODE.BAD_REQUEST, f'material_content.url 必填（{material_type}类型）')

        # 创建 BroadcastTask
        broadcast_task = BroadcastTask.objects.create(
            tenant=tenant,
            device=device,
            name=name,
            material_type=material_type,
            material_content=material_content,
            filter_tags=filter_tags,
            filter_conditions=filter_conditions,
            status='pending' if scheduled_at else 'draft',
            scheduled_at=scheduled_at,
        )

        # 筛选接收者并创建 BroadcastRecipient
        from .broadcast_executor import _filter_recipients_by_params
        contacts = _filter_recipients_by_params(device, tenant, filter_tags, filter_conditions)
        recipients_to_create = [
            BroadcastRecipient(task=broadcast_task, contact=c, status='pending')
            for c in contacts
        ]
        if recipients_to_create:
            BroadcastRecipient.objects.bulk_create(recipients_to_create, ignore_conflicts=True)

        broadcast_task.total_count = len(recipients_to_create)
        broadcast_task.save(update_fields=['total_count'])

        # 如果是立即发送（无 scheduled_at），创建 TaskExecution
        from .models import MarketingTask
        if not scheduled_at:
            # 查找或创建一个 manual 触发的 MarketingTask 作为载体
            mt, created = MarketingTask.objects.get_or_create(
                tenant=tenant,
                device=device,
                name=f'_broadcast_{broadcast_task.id}',
                defaults={
                    'trigger_type': 'manual',
                    'action_type': 'broadcast',
                    'action_config': {
                        'material_type': material_type,
                        'material_content': material_content,
                        'filter_tags': filter_tags,
                        'filter_conditions': filter_conditions,
                    },
                    'status': 'active',
                },
            )

            # 为每个待发送的接收者创建 TaskExecution
            from .models import TaskExecution
            exec_count = 0
            for recipient in broadcast_task.recipients.filter(status='pending'):
                TaskExecution.objects.create(
                    task=mt,
                    tenant=tenant,
                    target_contact=recipient.contact,
                    status='pending',
                    trigger_event={
                        'broadcast_task_id': broadcast_task.id,
                        'manual_trigger': True,
                    },
                )
                exec_count += 1

            broadcast_task.status = 'sending'
            broadcast_task.save(update_fields=['status'])

            serializer = BroadcastTaskSerializer(broadcast_task)
            return api_success(serializer.data, f'群发任务已创建并开始发送，共 {exec_count} 位接收者')
        else:
            serializer = BroadcastTaskSerializer(broadcast_task)
            return api_success(serializer.data, f'群发任务已创建，将于 {scheduled_at} 定时发送')


class BroadcastTaskDetailView(APIView):
    """群发任务详情 / 删除"""

    def _get_object(self, tenant, task_id):
        try:
            return BroadcastTask.objects.get(id=task_id, tenant=tenant)
        except BroadcastTask.DoesNotExist:
            return None

    def get(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        task = self._get_object(tenant, task_id)
        if not task:
            return api_error(API_CODE.NOT_FOUND, '群发任务不存在')
        serializer = BroadcastTaskSerializer(task)
        return api_success(serializer.data)

    def delete(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        task = self._get_object(tenant, task_id)
        if not task:
            return api_error(API_CODE.NOT_FOUND, '群发任务不存在')
        if task.status in ('sending', 'completed'):
            return api_error(API_CODE.BAD_REQUEST, f'任务状态为 {task.status}，不可删除')
        task.delete()
        return api_success({}, '群发任务已删除')


class BroadcastTaskToggleView(APIView):
    """群发任务暂停 / 恢复

    POST 参数: action=pause / resume
    """

    def post(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            task = BroadcastTask.objects.get(id=task_id, tenant=tenant)
        except BroadcastTask.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '群发任务不存在')

        action = request.data.get('action', 'pause')
        if action == 'pause':
            if task.status not in ('pending', 'sending'):
                return api_error(API_CODE.BAD_REQUEST, f'当前状态 {task.status} 不可暂停')
            task.status = 'paused'
            task.save(update_fields=['status'])
            return api_success(BroadcastTaskSerializer(task).data, '群发任务已暂停')
        elif action == 'resume':
            if task.status != 'paused':
                return api_error(API_CODE.BAD_REQUEST, f'当前状态 {task.status} 不可恢复')
            # 恢复时创建新的 TaskExecution
            task.status = 'sending'
            task.save(update_fields=['status'])

            # 查找载体 MarketingTask
            mt = MarketingTask.objects.filter(
                tenant=tenant,
                device=task.device,
                name=f'_broadcast_{task.id}',
            ).first()
            if mt:
                pending_recipients = task.recipients.filter(status='pending')
                for recipient in pending_recipients:
                    TaskExecution.objects.create(
                        task=mt,
                        tenant=tenant,
                        target_contact=recipient.contact,
                        status='pending',
                        trigger_event={
                            'broadcast_task_id': task.id,
                            'resume_trigger': True,
                        },
                    )

            return api_success(BroadcastTaskSerializer(task).data, '群发任务已恢复')
        else:
            return api_error(API_CODE.BAD_REQUEST, 'action 必须是 pause 或 resume')


class BroadcastTaskRecipientsView(APIView):
    """查看群发任务的接收者列表"""

    def get(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            task = BroadcastTask.objects.get(id=task_id, tenant=tenant)
        except BroadcastTask.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '群发任务不存在')

        recipients = task.recipients.select_related('contact')

        status = request.query_params.get('status')
        if status:
            recipients = recipients.filter(status=status)

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        total = recipients.count()
        recipients = recipients[(page - 1) * page_size: page * page_size]

        serializer = BroadcastRecipientSerializer(recipients, many=True)
        return api_success({
            'list': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
        })


# ============================================================
# 朋友圈任务
# ============================================================

class MomentsTaskListView(APIView):
    """朋友圈任务列表 + 创建"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        tasks = MomentsTask.objects.filter(tenant=tenant).select_related('device')

        # 搜索：任务名称
        search = request.query_params.get('search', '').strip()
        if search:
            tasks = tasks.filter(name__icontains=search)

        # 筛选：任务状态
        status = request.query_params.get('status', '').strip()
        if status:
            tasks = tasks.filter(status=status)

        # 筛选：创建者
        created_by = request.query_params.get('created_by', '').strip()
        if created_by:
            tasks = tasks.filter(created_by__icontains=created_by)

        # 筛选：创建时间范围
        start_date = request.query_params.get('start_date', '').strip()
        end_date = request.query_params.get('end_date', '').strip()
        if start_date:
            tasks = tasks.filter(created_at__date__gte=start_date)
        if end_date:
            tasks = tasks.filter(created_at__date__lte=end_date)

        tasks = tasks.order_by('-created_at')

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        total = tasks.count()
        tasks = tasks[(page - 1) * page_size: page * page_size]

        serializer = MomentsTaskSerializer(tasks, many=True)
        return api_success({
            'list': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
        })

    def post(self, request):
        """创建朋友圈任务（含内容/发送对象/执行时间）"""
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        device_id = request.data.get('device_id')
        if not device_id:
            return api_error(API_CODE.BAD_REQUEST, 'device_id 必填')
        try:
            device = WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')

        name = request.data.get('name', '').strip()
        if not name:
            return api_error(API_CODE.BAD_REQUEST, '任务名称必填')

        created_by = request.data.get('created_by', '')
        daily_loop = bool(request.data.get('daily_loop', False))

        task = MomentsTask.objects.create(
            tenant=tenant,
            device=device,
            name=name,
            status='draft',
            created_by=created_by,
            daily_loop=daily_loop,
        )

        # 创建内容
        contents_data = request.data.get('contents', [])
        for idx, ct in enumerate(contents_data):
            MomentsContent.objects.create(
                task=task,
                order=idx,
                text=ct.get('text', ''),
                random_emoji=bool(ct.get('random_emoji', False)),
                media_type=ct.get('media_type', 'image'),
                media_urls=ct.get('media_urls', []),
                link_title=ct.get('link_title', ''),
                link_desc=ct.get('link_desc', ''),
                link_url=ct.get('link_url', ''),
                link_pic_url=ct.get('link_pic_url', ''),
                ai_polish_enabled=bool(ct.get('ai_polish_enabled', False)),
                tone_template=ct.get('tone_template', ''),
                prompt_template=ct.get('prompt_template', ''),
            )

        # 创建发送对象
        target_data = request.data.get('target')
        if target_data:
            MomentsTarget.objects.create(
                task=task,
                device_ids=target_data.get('device_ids', []),
                estimated_count=target_data.get('estimated_count', 0),
            )

        # 创建执行时间
        schedule_data = request.data.get('schedule')
        if schedule_data:
            MomentsSchedule.objects.create(
                task=task,
                scheduled_at=schedule_data.get('scheduled_at'),
                daily_start_time=schedule_data.get('daily_start_time'),
                daily_end_time=schedule_data.get('daily_end_time'),
                daily_interval=schedule_data.get('daily_interval', 0),
            )

        serializer = MomentsTaskSerializer(task)
        return api_success(serializer.data, '任务创建成功')


class MomentsTaskDetailView(APIView):
    """朋友圈任务详情 / 更新 / 删除"""

    def _get_object(self, tenant, task_id):
        try:
            return MomentsTask.objects.get(id=task_id, tenant=tenant)
        except MomentsTask.DoesNotExist:
            return None

    def get(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        task = self._get_object(tenant, task_id)
        if not task:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')
        serializer = MomentsTaskSerializer(task)
        return api_success(serializer.data)

    def put(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        task = self._get_object(tenant, task_id)
        if not task:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')

        # 更新基础字段
        for field in ['name', 'status', 'created_by', 'started_by',
                       'is_enabled', 'daily_loop']:
            if field in request.data:
                setattr(task, field, request.data[field])
        if 'device_id' in request.data:
            try:
                task.device = WecomDevice.objects.get(
                    id=request.data['device_id'], tenant=tenant)
            except WecomDevice.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '设备不存在')
        task.save()

        # 更新内容（先删后建）
        if 'contents' in request.data:
            task.contents.all().delete()
            for idx, ct in enumerate(request.data['contents']):
                MomentsContent.objects.create(
                    task=task,
                    order=idx,
                    text=ct.get('text', ''),
                    random_emoji=bool(ct.get('random_emoji', False)),
                    media_type=ct.get('media_type', 'image'),
                    media_urls=ct.get('media_urls', []),
                    link_title=ct.get('link_title', ''),
                    link_desc=ct.get('link_desc', ''),
                    link_url=ct.get('link_url', ''),
                    link_pic_url=ct.get('link_pic_url', ''),
                    ai_polish_enabled=bool(ct.get('ai_polish_enabled', False)),
                    tone_template=ct.get('tone_template', ''),
                    prompt_template=ct.get('prompt_template', ''),
                )

        # 更新发送对象
        if 'target' in request.data:
            target_data = request.data['target']
            target, _ = MomentsTarget.objects.get_or_create(task=task)
            target.device_ids = target_data.get('device_ids', target.device_ids)
            target.estimated_count = target_data.get('estimated_count', target.estimated_count)
            target.save()

        # 更新执行时间
        if 'schedule' in request.data:
            schedule_data = request.data['schedule']
            schedule, _ = MomentsSchedule.objects.get_or_create(task=task)
            schedule.scheduled_at = schedule_data.get('scheduled_at', schedule.scheduled_at)
            schedule.daily_start_time = schedule_data.get('daily_start_time', schedule.daily_start_time)
            schedule.daily_end_time = schedule_data.get('daily_end_time', schedule.daily_end_time)
            schedule.daily_interval = schedule_data.get('daily_interval', schedule.daily_interval)
            schedule.save()

        serializer = MomentsTaskSerializer(task)
        return api_success(serializer.data, '任务更新成功')

    def delete(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        task = self._get_object(tenant, task_id)
        if not task:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')
        task.delete()
        return api_success(msg='任务已删除')


class MomentsTaskBatchDeleteView(APIView):
    """批量删除朋友圈任务"""

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        ids = request.data.get('ids', [])
        if not ids or not isinstance(ids, list):
            return api_error(API_CODE.BAD_REQUEST, 'ids 应为非空数组')
        deleted, _ = MomentsTask.objects.filter(
            id__in=ids, tenant=tenant).delete()
        return api_success({'deleted': deleted}, f'已删除 {deleted} 个任务')


class MomentsTaskToggleView(APIView):
    """开启/关闭朋友圈任务"""

    def post(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            task = MomentsTask.objects.get(id=task_id, tenant=tenant)
        except MomentsTask.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')

        action = request.data.get('action', 'enable')
        started_by = request.data.get('started_by', '')

        if action == 'enable':
            task.is_enabled = True
            task.status = 'enabled'
            if started_by:
                task.started_by = started_by
        elif action == 'disable':
            task.is_enabled = False
            task.status = 'disabled'
        else:
            return api_error(API_CODE.BAD_REQUEST, 'action 必须是 enable 或 disable')
        task.save()

        serializer = MomentsTaskSerializer(task)
        return api_success(serializer.data, f'任务已{task.get_status_display()}')


# ============================================================
# 客户画像
# ============================================================

class CustomerProfileListView(APIView):
    """客户画像列表"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        profiles = CustomerProfile.objects.filter(tenant=tenant).select_related('contact')

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        total = profiles.count()
        profiles = profiles[(page - 1) * page_size: page * page_size]

        serializer = CustomerProfileSerializer(profiles, many=True)
        return api_success({
            'list': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
        })


# ============================================================
# 数据看板
# ============================================================

class DashboardView(APIView):
    """营销跟客数据看板 — 4 区块 + 时间范围筛选 + 趋势数据

    查询参数:
      range=last_1_day|last_3_days|last_7_days|custom
      start_date=YYYY-MM-DD  (range=custom 时必填)
      end_date=YYYY-MM-DD    (range=custom 时必填)

    返回 4 个区块:
      exposure  — AI 曝光数据 (6 指标)
      reply     — AI 激活回复数据 (4 指标)
      customer  — 客户数据 (6 指标)
      message   — 沟通消息数据 (3 指标 + 饼图)
    每个区块含 trend: [{date, value}, ...] 每日趋势
    """

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        # ── 解析时间范围 ──
        now = timezone.now()
        range_type = request.query_params.get('range', 'last_7_days')

        if range_type == 'last_1_day':
            # "昨日" — 昨天全天
            yesterday = now - timezone.timedelta(days=1)
            start_date = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = yesterday.replace(hour=23, minute=59, second=59, microsecond=0)
        elif range_type == 'last_3_days':
            end_date = now.replace(hour=23, minute=59, second=59, microsecond=0)
            start_date = (end_date - timezone.timedelta(days=2)).replace(
                hour=0, minute=0, second=0, microsecond=0)
        elif range_type == 'last_7_days':
            end_date = now.replace(hour=23, minute=59, second=59, microsecond=0)
            start_date = (end_date - timezone.timedelta(days=6)).replace(
                hour=0, minute=0, second=0, microsecond=0)
        elif range_type == 'custom':
            start_str = request.query_params.get('start_date', '')
            end_str = request.query_params.get('end_date', '')
            if not start_str or not end_str:
                return api_error(API_CODE.BAD_REQUEST, '自定义范围需要 start_date 和 end_date')
            try:
                from datetime import datetime as dt
                start_date = dt.strptime(start_str, '%Y-%m-%d').replace(tzinfo=now.tzinfo)
                end_date = dt.strptime(end_str, '%Y-%m-%d').replace(
                    hour=23, minute=59, second=59, tzinfo=now.tzinfo)
                if start_date > end_date:
                    start_date, end_date = end_date, start_date
            except ValueError:
                return api_error(API_CODE.BAD_REQUEST, '日期格式错误，需要 YYYY-MM-DD')
        else:
            range_type = 'last_7_days'
            end_date = now.replace(hour=23, minute=59, second=59, microsecond=0)
            start_date = (end_date - timezone.timedelta(days=6)).replace(
                hour=0, minute=0, second=0, microsecond=0)

        # 生成日期列表（用于趋势）
        date_list = []
        d = start_date
        while d <= end_date:
            date_list.append(d.strftime('%Y-%m-%d'))
            d += timezone.timedelta(days=1)

        # ── 区块 1: AI 曝光数据 ──
        # 6 指标：累计曝光次数、AI自动打招呼次数、AI新客培育次数、AI精准群发次数、AI发朋友圈次数、AI追踪激活人数

        # AI 自动打招呼 = AI 回复任务 sent 数（被动回复即打招呼）
        ai_reply_qs = AiReplyTask.objects.filter(tenant=tenant)
        ai_reply_total = ai_reply_qs.count()
        ai_reply_in_range = ai_reply_qs.filter(
            created_at__gte=start_date, created_at__lte=end_date).count()

        # AI 新客培育 = 主动跟进任务 sent 数
        proactive_qs = ProactiveFollowTask.objects.filter(tenant=tenant)
        proactive_total = proactive_qs.filter(status='sent').count()
        proactive_in_range = proactive_qs.filter(
            status='sent', sent_at__gte=start_date, sent_at__lte=end_date).count()

        # AI 精准群发 = MassSendTask 的 planned_success 总数
        mass_send_qs = MassSendTask.objects.filter(tenant=tenant)
        mass_send_total = mass_send_qs.aggregate(
            total=Sum('planned_success'))['total'] or 0
        mass_send_in_range = mass_send_qs.filter(
            created_at__gte=start_date, created_at__lte=end_date).aggregate(
            total=Sum('planned_success'))['total'] or 0

        # AI 发朋友圈 = MomentsTask 的 success_sent 总数
        moments_qs = MomentsTask.objects.filter(tenant=tenant)
        moments_total = moments_qs.aggregate(
            total=Sum('success_sent'))['total'] or 0
        moments_in_range = moments_qs.filter(
            created_at__gte=start_date, created_at__lte=end_date).aggregate(
            total=Sum('success_sent'))['total'] or 0

        # AI 追踪激活人数 = 主动跟进 + 精准群发触达的去重联系人数
        # 简化：用 proactive + mass_send planned_success 之和
        tracking_total = proactive_total + mass_send_total
        tracking_in_range = proactive_in_range + mass_send_in_range

        # 累计曝光 = 所有 AI 动作总和
        exposure_total = ai_reply_total + proactive_total + mass_send_total + moments_total + tracking_total

        exposure = {
            'total_exposure': exposure_total,
            'ai_greeting': ai_reply_total,
            'ai_nurturing': proactive_total,
            'ai_mass_send': mass_send_total,
            'ai_moments': moments_total,
            'ai_tracking': tracking_total,
        }

        # 曝光趋势（按 AI 回复任务数每日统计）
        exposure_trend = []
        for date_str in date_list:
            day_start = timezone.datetime.strptime(date_str, '%Y-%m-%d').replace(tzinfo=now.tzinfo)
            day_end = day_start + timezone.timedelta(days=1)
            count = AiReplyTask.objects.filter(
                tenant=tenant,
                created_at__gte=day_start,
                created_at__lt=day_end
            ).count()
            exposure_trend.append({'date': date_str, 'value': count})

        # ── 区块 2: AI 激活回复数据 ──
        # 4 指标：累计激活回复、AI新客培育回复、AI精准群发回复、AI跟踪激活回复

        # AI 新客培育回复 = 收到来自主动跟进联系人的入站消息
        proactive_contact_ids = set(
            proactive_qs.values_list('contact_id', flat=True))
        nurturing_reply_total = WecomMessage.objects.filter(
            tenant=tenant, direction='inbound',
            contact_id__in=proactive_contact_ids
        ).count() if proactive_contact_ids else 0
        nurturing_reply_in_range = WecomMessage.objects.filter(
            tenant=tenant, direction='inbound',
            contact_id__in=proactive_contact_ids,
            created_at__gte=start_date, created_at__lte=end_date
        ).count() if proactive_contact_ids else 0

        # AI 精准群发回复 = 收到来自群发目标联系人的入站消息
        # MassSendTarget.contact_ids 是 JSONField(list)，需遍历提取
        mass_send_contact_ids = set()
        for target in MassSendTarget.objects.filter(task__tenant=tenant):
            for cid in (target.contact_ids or []):
                mass_send_contact_ids.add(cid)
        mass_send_reply_total = WecomMessage.objects.filter(
            tenant=tenant, direction='inbound',
            contact_id__in=mass_send_contact_ids
        ).count() if mass_send_contact_ids else 0
        mass_send_reply_in_range = WecomMessage.objects.filter(
            tenant=tenant, direction='inbound',
            contact_id__in=mass_send_contact_ids,
            created_at__gte=start_date, created_at__lte=end_date
        ).count() if mass_send_contact_ids else 0

        # AI 跟踪激活回复 = 两者之和
        tracking_reply_total = nurturing_reply_total + mass_send_reply_total
        tracking_reply_in_range = nurturing_reply_in_range + mass_send_reply_in_range

        # 累计激活回复 = 所有回复之和
        reply_total = nurturing_reply_total + mass_send_reply_total + tracking_reply_total

        reply = {
            'total_reply': reply_total,
            'nurturing_reply': nurturing_reply_total,
            'mass_send_reply': mass_send_reply_total,
            'tracking_reply': tracking_reply_total,
        }

        # 回复趋势（按入站消息每日统计）
        reply_trend = []
        for date_str in date_list:
            day_start = timezone.datetime.strptime(date_str, '%Y-%m-%d').replace(tzinfo=now.tzinfo)
            day_end = day_start + timezone.timedelta(days=1)
            count = WecomMessage.objects.filter(
                tenant=tenant, direction='inbound',
                contact_id__in=proactive_contact_ids | mass_send_contact_ids,
                created_at__gte=day_start,
                created_at__lt=day_end
            ).count() if (proactive_contact_ids or mass_send_contact_ids) else 0
            reply_trend.append({'date': date_str, 'value': count})

        # ── 区块 3: 客户数据 ──
        # 6 指标：累计客户人数、高意向、中意向、累计客户群总数、新增客户群、新增客户人数

        contact_qs = WecomContact.objects.filter(tenant=tenant)
        total_contacts = contact_qs.count()

        # 高意向 = 有标签且标签名含"高"的客户（简化：用 tags 过滤）
        high_intent = contact_qs.filter(
            tags__name__icontains='高').distinct().count()
        # 中意向 = 有标签且标签名含"中"的客户
        medium_intent = contact_qs.filter(
            tags__name__icontains='中').distinct().count()

        group_qs = WecomGroupRoom.objects.filter(tenant=tenant)
        total_groups = group_qs.count()

        # 新增客户群（时间范围内）
        new_groups = group_qs.filter(
            created_at__gte=start_date, created_at__lte=end_date).count()

        # 新增客户人数（时间范围内）
        new_contacts = contact_qs.filter(
            created_at__gte=start_date, created_at__lte=end_date).count()

        customer = {
            'total_contacts': total_contacts,
            'high_intent': high_intent,
            'medium_intent': medium_intent,
            'total_groups': total_groups,
            'new_groups': new_groups,
            'new_contacts': new_contacts,
        }

        # 客户趋势（按新增客户数每日统计）
        customer_trend = []
        for date_str in date_list:
            day_start = timezone.datetime.strptime(date_str, '%Y-%m-%d').replace(tzinfo=now.tzinfo)
            day_end = day_start + timezone.timedelta(days=1)
            count = contact_qs.filter(
                created_at__gte=day_start,
                created_at__lt=day_end
            ).count()
            customer_trend.append({'date': date_str, 'value': count})

        # ── 区块 4: 沟通消息数据 ──
        # 3 指标：累计消息数、发送消息数、接收消息数 + 饼图

        msg_qs = WecomMessage.objects.filter(tenant=tenant)
        total_messages = msg_qs.count()
        sent_messages = msg_qs.filter(direction='outbound').count()
        received_messages = msg_qs.filter(direction='inbound').count()

        message = {
            'total_messages': total_messages,
            'sent_messages': sent_messages,
            'received_messages': received_messages,
        }

        # 消息趋势（按每日消息总数统计）
        message_trend = []
        for date_str in date_list:
            day_start = timezone.datetime.strptime(date_str, '%Y-%m-%d').replace(tzinfo=now.tzinfo)
            day_end = day_start + timezone.timedelta(days=1)
            count = msg_qs.filter(
                created_at__gte=day_start,
                created_at__lt=day_end
            ).count()
            message_trend.append({'date': date_str, 'value': count})

        # ── 返回完整数据 ──
        return api_success({
            'range': range_type,
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'updated_at': now.isoformat(),
            'exposure': {
                **exposure,
                'trend': exposure_trend,
            },
            'reply': {
                **reply,
                'trend': reply_trend,
            },
            'customer': {
                **customer,
                'trend': customer_trend,
            },
            'message': {
                **message,
                'trend': message_trend,
            },
        })


# ============================================================
# 营销自动化任务（MarketingTask）
# ============================================================

class MarketingTaskListView(APIView):
    """营销自动化任务列表 + 创建"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        tasks = MarketingTask.objects.filter(tenant=tenant).select_related('device')

        status = request.query_params.get('status')
        action_type = request.query_params.get('action_type')
        if status:
            tasks = tasks.filter(status=status)
        if action_type:
            tasks = tasks.filter(action_type=action_type)

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        total = tasks.count()
        tasks = tasks[(page - 1) * page_size: page * page_size]

        serializer = MarketingTaskSerializer(tasks, many=True)
        return api_success({
            'list': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
        })

    def post(self, request):
        """创建营销自动化任务"""
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        device_id = request.data.get('device_id')
        try:
            device = WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')

        task = MarketingTask.objects.create(
            tenant=tenant,
            device=device,
            name=request.data.get('name', ''),
            trigger_type=request.data.get('trigger_type', 'event'),
            trigger_config=request.data.get('trigger_config', {}),
            action_type=request.data.get('action_type', 'proactive_follow'),
            action_config=request.data.get('action_config', {}),
            agent_id=request.data.get('agent_id', ''),
            status=request.data.get('status', 'active'),
            valid_from=request.data.get('valid_from'),
            valid_until=request.data.get('valid_until'),
        )
        serializer = MarketingTaskSerializer(task)
        return api_success(serializer.data, '任务创建成功')


class MarketingTaskDetailView(APIView):
    """营销自动化任务详情 / 更新 / 删除"""

    def _get_object(self, tenant, task_id):
        try:
            return MarketingTask.objects.get(id=task_id, tenant=tenant)
        except MarketingTask.DoesNotExist:
            return None

    def get(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        task = self._get_object(tenant, task_id)
        if not task:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')
        serializer = MarketingTaskSerializer(task)
        return api_success(serializer.data)

    def put(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        task = self._get_object(tenant, task_id)
        if not task:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')

        for field in ['name', 'trigger_type', 'trigger_config', 'action_type',
                       'action_config', 'agent_id', 'status', 'valid_from', 'valid_until']:
            if field in request.data:
                setattr(task, field, request.data[field])
        task.save()
        serializer = MarketingTaskSerializer(task)
        return api_success(serializer.data, '任务更新成功')

    def delete(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        task = self._get_object(tenant, task_id)
        if not task:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')
        task.delete()
        return api_success({}, '任务已删除')


class MarketingTaskToggleView(APIView):
    """启停营销自动化任务"""

    def post(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            task = MarketingTask.objects.get(id=task_id, tenant=tenant)
        except MarketingTask.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')

        action = request.data.get('action', 'pause')
        if action == 'activate':
            task.status = 'active'
        elif action == 'pause':
            task.status = 'paused'
        else:
            return api_error(API_CODE.BAD_REQUEST, 'action 必须是 activate 或 pause')
        task.save()
        serializer = MarketingTaskSerializer(task)
        return api_success(serializer.data, f'任务已{task.get_status_display()}')


class MarketingTaskExecutionsView(APIView):
    """查看某个任务的执行记录"""

    def get(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        executions = TaskExecution.objects.filter(
            tenant=tenant, task_id=task_id,
        ).select_related('task', 'target_contact')

        status = request.query_params.get('status')
        if status:
            executions = executions.filter(status=status)

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        total = executions.count()
        executions = executions[(page - 1) * page_size: page * page_size]

        serializer = TaskExecutionSerializer(executions, many=True)
        return api_success({
            'list': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
        })


# ============================================================
# 自动贴标签规则
# ============================================================

class AutoTagRuleListCreateView(APIView):
    """自动贴标签规则列表 + 创建"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        device_id = request.query_params.get('device_id')
        rules = AutoTagRule.objects.filter(tenant=tenant)
        if device_id:
            rules = rules.filter(device_id=device_id)
        rules = rules.order_by('-created_at')
        serializer = AutoTagRuleSerializer(rules, many=True)
        return api_success(serializer.data)

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        device_id = request.data.get('device')
        keywords = request.data.get('keywords', [])
        target_tag_id = request.data.get('target_tag')

        if not device_id:
            return api_error(API_CODE.BAD_REQUEST, '缺少 device (企微账号)')
        if not keywords or not isinstance(keywords, list):
            return api_error(API_CODE.BAD_REQUEST, 'keywords 应为非空数组')
        if not target_tag_id:
            return api_error(API_CODE.BAD_REQUEST, '缺少 target_tag (目标标签)')

        try:
            device = WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')

        try:
            target_tag = WecomTag.objects.get(id=target_tag_id, tenant=tenant)
        except WecomTag.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '目标标签不存在')

        rule = AutoTagRule.objects.create(
            tenant=tenant,
            device=device,
            name=request.data.get('name', ''),
            keywords=keywords,
            match_mode=request.data.get('match_mode', 'any'),
            scope=request.data.get('scope', 'personal'),
            target_tag=target_tag,
            is_enabled=bool(request.data.get('is_enabled', True)),
        )
        serializer = AutoTagRuleSerializer(rule)
        return api_success(serializer.data, '规则创建成功')


class AutoTagRuleDetailView(APIView):
    """自动贴标签规则详情 / 更新 / 删除"""

    def get(self, request, rule_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            rule = AutoTagRule.objects.get(id=rule_id, tenant=tenant)
        except AutoTagRule.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '规则不存在')
        serializer = AutoTagRuleSerializer(rule)
        return api_success(serializer.data)

    def put(self, request, rule_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            rule = AutoTagRule.objects.get(id=rule_id, tenant=tenant)
        except AutoTagRule.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '规则不存在')

        for field in ['name', 'keywords', 'match_mode', 'scope', 'is_enabled']:
            if field in request.data:
                setattr(rule, field, request.data[field])
        if 'target_tag' in request.data:
            try:
                rule.target_tag = WecomTag.objects.get(id=request.data['target_tag'], tenant=tenant)
            except WecomTag.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '目标标签不存在')
        if 'device' in request.data:
            try:
                rule.device = WecomDevice.objects.get(id=request.data['device'], tenant=tenant)
            except WecomDevice.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '设备不存在')

        rule.save()
        serializer = AutoTagRuleSerializer(rule)
        return api_success(serializer.data, '更新成功')

    def patch(self, request, rule_id):
        """局部更新（如开关）"""
        return self.put(request, rule_id)

    def delete(self, request, rule_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            rule = AutoTagRule.objects.get(id=rule_id, tenant=tenant)
        except AutoTagRule.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '规则不存在')
        rule.delete()
        return api_success(msg='规则已删除')


class AutoTagRuleRunView(APIView):
    """手动触发自动贴标签：扫描该设备历史消息，按启用规则自动打标签"""

    def post(self, request, rule_id):
        from django.db.models import Q
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            rule = AutoTagRule.objects.get(id=rule_id, tenant=tenant, is_enabled=True)
        except AutoTagRule.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '规则不存在或未启用')

        device = rule.device
        target_tag = rule.target_tag
        keywords = rule.keywords or []
        if not keywords:
            return api_error(API_CODE.BAD_REQUEST, '规则未配置关键词')

        # 查询符合范围的消息
        msgs = WecomMessage.objects.filter(
            tenant=tenant, device=device,
            msg_type='text', direction='inbound',
        )
        if rule.scope == 'personal':
            msgs = msgs.filter(contact__isnull=False)
        elif rule.scope == 'group':
            msgs = msgs.filter(room__isnull=False)
        # both: 不加范围过滤

        # 构造关键词 Q
        if rule.match_mode == 'all':
            q = Q(content__icontains=keywords[0])
            for kw in keywords[1:]:
                q &= Q(content__icontains=kw)
        else:
            q = Q()
            for kw in keywords:
                q |= Q(content__icontains=kw)
        msgs = msgs.filter(q)

        # 收集需要打标签的联系人
        contacts_to_tag = set()
        for msg in msgs:
            if msg.contact_id:
                contacts_to_tag.add(msg.contact_id)

        # 批量打标签
        from apps.wecom.models import WecomContact
        contacts = WecomContact.objects.filter(id__in=contacts_to_tag, tenant=tenant)
        tagged_count = 0
        for contact in contacts:
            if target_tag not in contact.tags.all():
                contact.tags.add(target_tag)
                tagged_count += 1

        # 更新规则统计
        rule.hit_count += len(contacts_to_tag)
        rule.last_run_at = timezone.now()
        rule.save(update_fields=['hit_count', 'last_run_at'])

        return api_success({
            'matched_messages': msgs.count(),
            'tagged_contacts': tagged_count,
            'hit_count': rule.hit_count,
        }, f'已为 {tagged_count} 个联系人贴上「{target_tag.name}」标签')


# ============================================================
# 精准群发任务（MassSendTask）
# ============================================================

class MassSendTaskListView(APIView):
    """精准群发任务列表 + 创建"""

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        tasks = MassSendTask.objects.filter(tenant=tenant).select_related('device')

        # 搜索：任务名称
        search = request.query_params.get('search', '').strip()
        if search:
            tasks = tasks.filter(name__icontains=search)

        # 筛选：任务状态
        status = request.query_params.get('status', '').strip()
        if status:
            tasks = tasks.filter(status=status)

        # 筛选：创建者
        created_by = request.query_params.get('created_by', '').strip()
        if created_by:
            tasks = tasks.filter(created_by__icontains=created_by)

        # 筛选：创建时间范围
        start_date = request.query_params.get('start_date', '').strip()
        end_date = request.query_params.get('end_date', '').strip()
        if start_date:
            tasks = tasks.filter(created_at__date__gte=start_date)
        if end_date:
            tasks = tasks.filter(created_at__date__lte=end_date)

        tasks = tasks.order_by('-created_at')

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        total = tasks.count()
        tasks = tasks[(page - 1) * page_size: page * page_size]

        serializer = MassSendTaskSerializer(tasks, many=True)
        return api_success({
            'list': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
        })

    def post(self, request):
        """创建精准群发任务（含素材/发送对象/执行时间）"""
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')

        device_id = request.data.get('device_id')
        if not device_id:
            return api_error(API_CODE.BAD_REQUEST, 'device_id 必填')
        try:
            device = WecomDevice.objects.get(id=device_id, tenant=tenant)
        except WecomDevice.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '设备不存在')

        name = request.data.get('name', '').strip()
        if not name:
            return api_error(API_CODE.BAD_REQUEST, '任务名称必填')

        created_by = request.data.get('created_by', '')
        daily_loop = bool(request.data.get('daily_loop', False))

        task = MassSendTask.objects.create(
            tenant=tenant,
            device=device,
            name=name,
            status='draft',
            created_by=created_by,
            daily_loop=daily_loop,
        )

        # 创建素材
        materials_data = request.data.get('materials', [])
        for idx, mat in enumerate(materials_data):
            MassSendMaterial.objects.create(
                task=task,
                order=idx,
                msg_type=mat.get('msg_type', 'text'),
                content=mat.get('content', {}),
            )

        # 创建发送对象
        target_data = request.data.get('target')
        if target_data:
            MassSendTarget.objects.create(
                task=task,
                target_type=target_data.get('target_type', 'contact'),
                tag_ids=target_data.get('tag_ids', []),
                contact_ids=target_data.get('contact_ids', []),
                group_ids=target_data.get('group_ids', []),
                filter_conditions=target_data.get('filter_conditions', {}),
                estimated_count=target_data.get('estimated_count', 0),
            )

        # 创建执行时间
        schedule_data = request.data.get('schedule')
        if schedule_data:
            MassSendSchedule.objects.create(
                task=task,
                scheduled_at=schedule_data.get('scheduled_at'),
                daily_start_time=schedule_data.get('daily_start_time'),
                daily_end_time=schedule_data.get('daily_end_time'),
                daily_interval=schedule_data.get('daily_interval', 0),
            )

        serializer = MassSendTaskSerializer(task)
        return api_success(serializer.data, '任务创建成功')


class MassSendTaskDetailView(APIView):
    """精准群发任务详情 / 更新 / 删除"""

    def _get_object(self, tenant, task_id):
        try:
            return MassSendTask.objects.get(id=task_id, tenant=tenant)
        except MassSendTask.DoesNotExist:
            return None

    def get(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        task = self._get_object(tenant, task_id)
        if not task:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')
        serializer = MassSendTaskSerializer(task)
        return api_success(serializer.data)

    def put(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        task = self._get_object(tenant, task_id)
        if not task:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')

        # 更新基础字段
        for field in ['name', 'status', 'created_by', 'started_by',
                       'is_enabled', 'daily_loop']:
            if field in request.data:
                setattr(task, field, request.data[field])
        if 'device_id' in request.data:
            try:
                task.device = WecomDevice.objects.get(
                    id=request.data['device_id'], tenant=tenant)
            except WecomDevice.DoesNotExist:
                return api_error(API_CODE.NOT_FOUND, '设备不存在')
        task.save()

        # 更新素材（先删后建）
        if 'materials' in request.data:
            task.materials.all().delete()
            for idx, mat in enumerate(request.data['materials']):
                MassSendMaterial.objects.create(
                    task=task,
                    order=idx,
                    msg_type=mat.get('msg_type', 'text'),
                    content=mat.get('content', {}),
                )

        # 更新发送对象
        if 'target' in request.data:
            target_data = request.data['target']
            target, _ = MassSendTarget.objects.get_or_create(task=task)
            target.target_type = target_data.get('target_type', target.target_type)
            target.tag_ids = target_data.get('tag_ids', target.tag_ids)
            target.contact_ids = target_data.get('contact_ids', target.contact_ids)
            target.group_ids = target_data.get('group_ids', target.group_ids)
            target.filter_conditions = target_data.get('filter_conditions', target.filter_conditions)
            target.estimated_count = target_data.get('estimated_count', target.estimated_count)
            target.save()

        # 更新执行时间
        if 'schedule' in request.data:
            schedule_data = request.data['schedule']
            schedule, _ = MassSendSchedule.objects.get_or_create(task=task)
            schedule.scheduled_at = schedule_data.get('scheduled_at', schedule.scheduled_at)
            schedule.daily_start_time = schedule_data.get('daily_start_time', schedule.daily_start_time)
            schedule.daily_end_time = schedule_data.get('daily_end_time', schedule.daily_end_time)
            schedule.daily_interval = schedule_data.get('daily_interval', schedule.daily_interval)
            schedule.save()

        serializer = MassSendTaskSerializer(task)
        return api_success(serializer.data, '任务更新成功')

    def delete(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        task = self._get_object(tenant, task_id)
        if not task:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')
        task.delete()
        return api_success(msg='任务已删除')


class MassSendTaskBatchDeleteView(APIView):
    """批量删除精准群发任务"""

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        ids = request.data.get('ids', [])
        if not ids or not isinstance(ids, list):
            return api_error(API_CODE.BAD_REQUEST, 'ids 应为非空数组')
        deleted, _ = MassSendTask.objects.filter(
            id__in=ids, tenant=tenant).delete()
        return api_success({'deleted': deleted}, f'已删除 {deleted} 个任务')


class MassSendTaskToggleView(APIView):
    """开启/关闭精准群发任务"""

    def post(self, request, task_id):
        tenant = _get_tenant(request)
        if not tenant:
            return api_error(API_CODE.UNAUTHORIZED, '未找到租户')
        try:
            task = MassSendTask.objects.get(id=task_id, tenant=tenant)
        except MassSendTask.DoesNotExist:
            return api_error(API_CODE.NOT_FOUND, '任务不存在')

        action = request.data.get('action', 'enable')
        started_by = request.data.get('started_by', '')

        if action == 'enable':
            task.is_enabled = True
            task.status = 'enabled'
            if started_by:
                task.started_by = started_by
        elif action == 'disable':
            task.is_enabled = False
            task.status = 'disabled'
        else:
            return api_error(API_CODE.BAD_REQUEST, 'action 必须是 enable 或 disable')
        task.save()

        serializer = MassSendTaskSerializer(task)
        return api_success(serializer.data, f'任务已{task.get_status_display()}')
