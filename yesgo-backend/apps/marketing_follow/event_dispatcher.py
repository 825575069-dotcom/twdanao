"""
apps/marketing_follow/event_dispatcher.py
事件信号系统 + EventDispatcher

对齐设计文档 v1.0 第 5 节（主动跟进触发）和第 7.3 节（EventDispatcher）。

事件流：
  webhook_handler 收到消息 → 触发事件 → EventDispatcher.match() 遍历 active 的
  MarketingTask → 匹配 trigger_config.conditions → 创建 TaskExecution(pending)
  → run_task_runner 命令轮询 pending 队列执行

支持的事件类型：
  - message_received     客户发来消息
  - contact_added        新联系人添加
  - order_completed      订单完成（来自数据底座）
  - no_contact_days      N天未联系（定时扫描触发）
"""
import logging
from datetime import timedelta
from django.utils import timezone
from django.db.models import Q

from .models import MarketingTask, TaskExecution, CustomerProfile

logger = logging.getLogger(__name__)

# 事件类型常量
EVENT_MESSAGE_RECEIVED = 'message_received'
EVENT_CONTACT_ADDED = 'contact_added'
EVENT_ORDER_COMPLETED = 'order_completed'
EVENT_NO_CONTACT_DAYS = 'no_contact_days'

VALID_EVENTS = {
    EVENT_MESSAGE_RECEIVED,
    EVENT_CONTACT_ADDED,
    EVENT_ORDER_COMPLETED,
    EVENT_NO_CONTACT_DAYS,
}


def dispatch_event(event_type: str, tenant_id: int, contact_id: int,
                   event_data: dict = None, device_id: int = None):
    """事件分发入口。

    遍历该租户下所有 active 且 trigger_type='event' 的 MarketingTask，
    匹配 trigger_config 中的条件，为每个匹配项创建一条 TaskExecution。

    Args:
        event_type: 事件类型（见 VALID_EVENTS）
        tenant_id: 租户 ID
        contact_id: 联系人 ID (WecomContact.id)
        event_data: 事件附加上下文（消息内容、订单信息等）
        device_id: 设备 ID（可选，用于过滤绑定特定设备的任务）

    Returns:
        int: 创建的 TaskExecution 数量
    """
    if event_type not in VALID_EVENTS:
        logger.warning(f'[EventDispatcher] 未知事件类型: {event_type}')
        return 0

    event_data = event_data or {}
    now = timezone.now()

    # 查询活跃的 event 型任务
    qs = MarketingTask.objects.filter(
        tenant_id=tenant_id,
        trigger_type='event',
        status='active',
    ).filter(
        Q(valid_from__isnull=True) | Q(valid_from__lte=now)
    ).filter(
        Q(valid_until__isnull=True) | Q(valid_until__gte=now)
    )

    if device_id:
        qs = qs.filter(device_id=device_id)

    created_count = 0
    for task in qs:
        if _match_conditions(task, event_type, contact_id, tenant_id, event_data):
            # 防重复：同任务+同联系人+pending/running 状态不重复创建
            exists = TaskExecution.objects.filter(
                task=task,
                target_contact_id=contact_id,
                status__in=['pending', 'running'],
            ).exists()
            if exists:
                logger.debug(f'[EventDispatcher] 跳过重复: task={task.id} contact={contact_id}')
                continue

            TaskExecution.objects.create(
                task=task,
                tenant_id=tenant_id,
                target_contact_id=contact_id,
                status='pending',
                trigger_event={
                    'event_type': event_type,
                    'event_data': event_data,
                    'dispatched_at': now.isoformat(),
                },
            )
            created_count += 1
            logger.info(f'[EventDispatcher] 创建执行: task={task.name} contact={contact_id} event={event_type}')

    if created_count:
        logger.info(f'[EventDispatcher] event={event_type} tenant={tenant_id} created={created_count}')

    return created_count


def _match_conditions(task: MarketingTask, event_type: str,
                      contact_id: int, tenant_id: int, event_data: dict) -> bool:
    """检查任务的 trigger_config 是否匹配当前事件。"""
    config = task.trigger_config or {}

    # 事件类型必须匹配
    config_event = config.get('event_type', '')
    if config_event and config_event != event_type:
        return False

    conditions = config.get('conditions', {})

    # 获取客户画像（用于条件匹配）
    profile = _get_customer_profile(contact_id, tenant_id)

    # 1. 关键词匹配（仅 message_received 事件）
    if event_type == EVENT_MESSAGE_RECEIVED:
        keywords = conditions.get('keywords', [])
        if keywords:
            message_content = event_data.get('content', '').lower()
            matched = any(kw.lower() in message_content for kw in keywords)
            if not matched:
                return False

    # 2. 客户等级匹配
    customer_levels = conditions.get('customer_levels', [])
    if customer_levels:
        level = profile.customer_level if profile else 'C'
        if level not in customer_levels:
            return False

    # 3. 标签匹配
    tags = conditions.get('tags', [])
    if tags:
        contact_tags = profile.tags if profile else []
        if not any(t in contact_tags for t in tags):
            return False

    # 4. 最低订单数
    min_orders = conditions.get('min_orders', 0)
    if min_orders:
        total_orders = profile.total_orders if profile else 0
        if total_orders < min_orders:
            return False

    # 5. N天未联系（仅 no_contact_days 事件）
    if event_type == EVENT_NO_CONTACT_DAYS:
        days = conditions.get('days', 7)
        threshold = timezone.now() - timedelta(days=days)
        last_contacted = event_data.get('last_contacted_at')
        if last_contacted:
            from datetime import datetime, timezone as dt_tz
            if isinstance(last_contacted, str):
                try:
                    last_contacted = datetime.fromisoformat(last_contacted)
                    if last_contacted.tzinfo is None:
                        last_contacted = last_contacted.replace(tzinfo=dt_tz.utc)
                except (ValueError, TypeError):
                    pass
            if last_contacted and last_contacted > threshold:
                return False

    return True


def _get_customer_profile(contact_id: int, tenant_id: int):
    """获取客户画像，不存在返回 None。"""
    try:
        return CustomerProfile.objects.get(contact_id=contact_id, tenant_id=tenant_id)
    except CustomerProfile.DoesNotExist:
        return None
