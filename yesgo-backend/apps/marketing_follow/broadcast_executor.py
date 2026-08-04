"""
apps/marketing_follow/broadcast_executor.py
精准群发执行器

对齐设计文档 v1.0 第 6 节（精准群发）和第 8 节（防骚扰护栏）。

群发防骚扰（独立于主动跟进）：
  1. 时间窗口 8:00-20:00
  2. 同一联系人每天最多 1 条群发
  3. 同一联系人每月最多 4 条群发
  4. 单次群发上限 200 人
  5. 发送间隔 1-2 秒/条（防止频控）

支持三种素材类型：
  - text: 纯文本
  - link: 图文链接（title + desc + url + pic_url）
  - miniprogram: 小程序卡片（title + page + pic_url）

两种触发路径：
  1. 手动群发：BroadcastTaskCreateView API → 创建 BroadcastTask + BroadcastRecipient + TaskExecution
  2. 自动群发：MarketingTask(action_type='broadcast') → EventDispatcher 创建 TaskExecution → execute_broadcast 从 action_config 构建 BroadcastTask
"""
import logging
import time
import random
from datetime import timedelta
from django.utils import timezone
from django.db import transaction

from .models import (
    MarketingTask, TaskExecution, BroadcastTask, BroadcastRecipient,
    ChatSetting, CustomerProfile,
)

logger = logging.getLogger(__name__)

# ============================================================
# 常量
# ============================================================

# 群发防骚扰参数
BROADCAST_TIME_WINDOW_START = 8
BROADCAST_TIME_WINDOW_END = 20
BROADCAST_DAILY_MAX_PER_CONTACT = 1    # 同一联系人每天最多 1 条群发
BROADCAST_MONTHLY_MAX_PER_CONTACT = 4  # 同一联系人每月最多 4 条群发
BROADCAST_MAX_RECIPIENTS = 200         # 单次群发上限
BROADCAST_SEND_INTERVAL_MIN = 1.0      # 发送间隔（秒）
BROADCAST_SEND_INTERVAL_MAX = 2.0
BROADCAST_BATCH_LOG_INTERVAL = 20      # 每发送 N 条打印一次进度日志


# ============================================================
# 主执行函数
# ============================================================

def execute_broadcast(execution: TaskExecution):
    """执行精准群发任务。

    完整链路：
      1. 标记 running
      2. 获取或创建 BroadcastTask
      3. 筛选接收者（若尚未创建 BroadcastRecipient）
      4. 逐个发送 + 防骚扰检查
      5. 更新 BroadcastTask 统计
      6. 积分扣减
      7. 标记 success/failed
    """
    task = execution.task
    contact = execution.target_contact
    tenant = execution.tenant

    # 标记开始执行
    execution.started_at = timezone.now()
    execution.status = 'running'
    execution.save(update_fields=['status', 'started_at'])

    logger.info(f'[Broadcast] start: task={task.name} exec={execution.id}')

    try:
        # 1. 获取 BroadcastTask
        broadcast_task = _get_or_create_broadcast_task(execution, task)
        if not broadcast_task:
            execution.status = 'failed'
            execution.error = '无法获取或创建群发任务'
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'error', 'completed_at'])
            return

        # 2. 检查时间窗口
        now = timezone.now()
        local_hour = now.hour
        if local_hour < BROADCAST_TIME_WINDOW_START or local_hour >= BROADCAST_TIME_WINDOW_END:
            execution.status = 'skipped'
            execution.error = f'非工作时间({local_hour}时)，允许时段 {BROADCAST_TIME_WINDOW_START}-{BROADCAST_TIME_WINDOW_END} 时'
            execution.completed_at = timezone.now()
            execution.result = {'skipped': True, 'reason': execution.error}
            execution.save(update_fields=['status', 'error', 'completed_at', 'result'])
            logger.info(f'[Broadcast] skipped: exec={execution.id} reason=non-work-hours')
            return

        # 3. 获取设备
        device = task.device
        if not device or device.status != 'online':
            execution.status = 'skipped'
            execution.error = f'设备不可用: {device.status if device else "无设备"}'
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'error', 'completed_at'])
            return

        # 4. 获取接收者列表
        recipients = broadcast_task.recipients.filter(status='pending').select_related(
            'contact', 'contact__device',
        )
        total_recipients = recipients.count()

        if total_recipients == 0:
            execution.status = 'skipped'
            execution.error = '无待发送的接收者'
            execution.completed_at = timezone.now()
            execution.result = {'skipped': True, 'reason': 'no pending recipients'}
            execution.save(update_fields=['status', 'error', 'completed_at', 'result'])
            logger.info(f'[Broadcast] skipped: exec={execution.id} reason=no-recipients')
            return

        # 限制单次群发上限
        if total_recipients > BROADCAST_MAX_RECIPIENTS:
            logger.warning(
                f'[Broadcast] recipients {total_recipients} exceeds max {BROADCAST_MAX_RECIPIENTS}, '
                f'truncating'
            )
            recipients = recipients[:BROADCAST_MAX_RECIPIENTS]
            total_recipients = BROADCAST_MAX_RECIPIENTS

        # 更新 BroadcastTask 状态为发送中
        broadcast_task.status = 'sending'
        broadcast_task.total_count = total_recipients
        broadcast_task.save(update_fields=['status', 'total_count'])

        # 5. 逐个发送
        sent_count = 0
        failed_count = 0
        skipped_count = 0
        total_tokens = 0

        from apps.wecom.qiwei_client import get_qiwei_client, QiWeiAPIError
        from apps.wecom.models import WecomMessage

        try:
            client = get_qiwei_client(device)
        except Exception as e:
            logger.error(f'[Broadcast] Failed to get qiwei client: {e}')
            execution.status = 'failed'
            execution.error = f'获取企微客户端失败: {e}'
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'error', 'completed_at'])
            broadcast_task.status = 'paused'
            broadcast_task.save(update_fields=['status'])
            return

        for i, recipient in enumerate(recipients):
            try:
                # 5a. 防骚扰检查
                allowed, reason = _check_broadcast_anti_harassment(recipient.contact, tenant)
                if not allowed:
                    recipient.status = 'skipped'
                    recipient.error = reason
                    recipient.save(update_fields=['status', 'error'])
                    skipped_count += 1
                    continue

                # 5b. 发送素材
                success = _send_material(client, device, recipient.contact,
                                        broadcast_task.material_type,
                                        broadcast_task.material_content, tenant)

                if success:
                    recipient.status = 'sent'
                    recipient.sent_at = timezone.now()
                    recipient.monthly_count = _get_monthly_broadcast_count(recipient.contact, tenant) + 1
                    recipient.save(update_fields=['status', 'sent_at', 'monthly_count'])

                    # 持久化发送的消息（文本类型）
                    if broadcast_task.material_type == 'text':
                        text_content = broadcast_task.material_content.get('text', '')
                        WecomMessage.objects.create(
                            tenant=tenant,
                            device=device,
                            contact=recipient.contact,
                            direction='outbound',
                            msg_type='text',
                            content=text_content,
                            ai_generated=True,
                        )
                    else:
                        WecomMessage.objects.create(
                            tenant=tenant,
                            device=device,
                            contact=recipient.contact,
                            direction='outbound',
                            msg_type=broadcast_task.material_type,
                            content=str(broadcast_task.material_content.get('title', '')),
                            ai_generated=True,
                        )

                    sent_count += 1
                else:
                    recipient.status = 'failed'
                    recipient.error = '发送失败'
                    recipient.save(update_fields=['status', 'error'])
                    failed_count += 1

                # 5c. 进度日志
                if (i + 1) % BROADCAST_BATCH_LOG_INTERVAL == 0:
                    logger.info(
                        f'[Broadcast] progress: exec={execution.id} '
                        f'{i+1}/{total_recipients} sent={sent_count} failed={failed_count} skipped={skipped_count}'
                    )
                    # 更新 BroadcastTask 统计
                    broadcast_task.sent_count = sent_count
                    broadcast_task.failed_count = failed_count
                    broadcast_task.save(update_fields=['sent_count', 'failed_count'])

                # 5d. 发送间隔
                if i < total_recipients - 1:
                    time.sleep(random.uniform(BROADCAST_SEND_INTERVAL_MIN, BROADCAST_SEND_INTERVAL_MAX))

            except QiWeiAPIError as e:
                logger.error(f'[Broadcast] Send to {recipient.contact} failed: {e}')
                recipient.status = 'failed'
                recipient.error = str(e)[:200]
                recipient.save(update_fields=['status', 'error'])
                failed_count += 1
            except Exception as e:
                logger.exception(f'[Broadcast] Send to {recipient.contact} error: {e}')
                recipient.status = 'failed'
                recipient.error = str(e)[:200]
                recipient.save(update_fields=['status', 'error'])
                failed_count += 1

        # 6. 更新 BroadcastTask 最终统计
        broadcast_task.sent_count = sent_count
        broadcast_task.failed_count = failed_count
        broadcast_task.status = 'completed'
        broadcast_task.save(update_fields=['sent_count', 'failed_count', 'status'])

        # 7. 积分扣减（按发送条数）
        credit_result = _deduct_broadcast_credits(tenant, task.agent_id, sent_count)

        # 8. 标记执行结果
        execution.status = 'success' if sent_count > 0 else 'failed'
        execution.completed_at = timezone.now()
        execution.result = {
            'broadcast_task_id': broadcast_task.id,
            'total_recipients': total_recipients,
            'sent_count': sent_count,
            'failed_count': failed_count,
            'skipped_count': skipped_count,
            'credit_cost': credit_result.get('deducted', 0),
        }
        execution.save(update_fields=['status', 'completed_at', 'result'])
        logger.info(
            f'[Broadcast] done: exec={execution.id} sent={sent_count} '
            f'failed={failed_count} skipped={skipped_count}'
        )

    except Exception as e:
        execution.status = 'failed'
        execution.error = str(e)[:500]
        execution.completed_at = timezone.now()
        execution.save(update_fields=['status', 'error', 'completed_at'])
        logger.exception(f'[Broadcast] failed: exec={execution.id} error={e}')


# ============================================================
# BroadcastTask 获取/创建
# ============================================================

def _get_or_create_broadcast_task(execution: TaskExecution, task: MarketingTask) -> BroadcastTask:
    """从 execution.trigger_event 或 task.action_config 获取/创建 BroadcastTask。"""
    trigger_event = execution.trigger_event or {}

    # 路径 1: 手动群发 — trigger_event 中带 broadcast_task_id
    broadcast_task_id = trigger_event.get('broadcast_task_id')
    if broadcast_task_id:
        try:
            return BroadcastTask.objects.get(id=broadcast_task_id, tenant=execution.tenant)
        except BroadcastTask.DoesNotExist:
            logger.warning(f'[Broadcast] broadcast_task_id={broadcast_task_id} not found')

    # 路径 2: 自动群发 — 从 action_config 构建
    action_config = task.action_config or {}
    if not action_config:
        logger.error(f'[Broadcast] task {task.id} has empty action_config')
        return None

    # 创建 BroadcastTask
    broadcast_task = BroadcastTask.objects.create(
        tenant=execution.tenant,
        device=task.device,
        name=f'{task.name} - 自动群发 {timezone.now():%Y%m%d%H%M}',
        material_type=action_config.get('material_type', 'text'),
        material_content=action_config.get('material_content', {}),
        filter_tags=action_config.get('filter_tags', []),
        filter_conditions=action_config.get('filter_conditions', {}),
        status='pending',
        total_count=0,
    )

    # 筛选接收者并创建 BroadcastRecipient
    contacts = _filter_recipients(task, execution.tenant)
    recipients_to_create = []
    for contact in contacts:
        recipients_to_create.append(BroadcastRecipient(
            task=broadcast_task,
            contact=contact,
            status='pending',
        ))
    if recipients_to_create:
        BroadcastRecipient.objects.bulk_create(recipients_to_create, ignore_conflicts=True)

    broadcast_task.total_count = len(recipients_to_create)
    broadcast_task.save(update_fields=['total_count'])

    # 记录 broadcast_task_id 到 trigger_event
    execution.trigger_event = {
        **trigger_event,
        'broadcast_task_id': broadcast_task.id,
        'auto_created': True,
    }
    execution.save(update_fields=['trigger_event'])

    return broadcast_task


# ============================================================
# 接收者筛选
# ============================================================

def _filter_recipients(task: MarketingTask, tenant):
    """根据 filter_tags 和 filter_conditions 筛选接收者。"""
    from apps.wecom.models import WecomContact
    from django.db.models import Q

    action_config = task.action_config or {}
    filter_tags = action_config.get('filter_tags', [])
    filter_conditions = action_config.get('filter_conditions', {})

    # 基础查询：该设备的所有联系人
    contacts = WecomContact.objects.filter(
        tenant=tenant,
        device=task.device,
        ai_hosted=True,  # 仅 AI 托管的联系人
    )

    # 1. 标签筛选（通过 CustomerProfile.tags）
    if filter_tags:
        # 筛选有任一匹配标签的联系人
        tag_query = Q()
        for tag in filter_tags:
            tag_query |= Q(tags__contains=[tag])
        contacts = contacts.filter(
            id__in=CustomerProfile.objects.filter(
                tenant=tenant,
            ).filter(tag_query).values_list('contact_id', flat=True)
        )

    # 2. 客户等级筛选
    customer_levels = filter_conditions.get('customer_levels', [])
    if customer_levels:
        contacts = contacts.filter(
            id__in=CustomerProfile.objects.filter(
                tenant=tenant,
                customer_level__in=customer_levels,
            ).values_list('contact_id', flat=True)
        )

    # 3. 最低订单数筛选
    min_orders = filter_conditions.get('min_orders')
    if min_orders:
        contacts = contacts.filter(
            id__in=CustomerProfile.objects.filter(
                tenant=tenant,
                total_orders__gte=min_orders,
            ).values_list('contact_id', flat=True)
        )

    # 4. 最低采购总额筛选
    min_amount = filter_conditions.get('min_amount')
    if min_amount:
        contacts = contacts.filter(
            id__in=CustomerProfile.objects.filter(
                tenant=tenant,
                total_amount__gte=min_amount,
            ).values_list('contact_id', flat=True)
        )

    return contacts


def _filter_recipients_by_params(device, tenant, filter_tags: list, filter_conditions: dict):
    """根据筛选参数筛选接收者（供 API 直接调用，不依赖 MarketingTask）。

    Args:
        device: WecomDevice 实例
        tenant: Tenant 实例
        filter_tags: 标签列表
        filter_conditions: 条件 dict

    Returns:
        WecomContact QuerySet
    """
    from apps.wecom.models import WecomContact
    from django.db.models import Q

    contacts = WecomContact.objects.filter(
        tenant=tenant,
        device=device,
        ai_hosted=True,
    )

    if filter_tags:
        tag_query = Q()
        for tag in filter_tags:
            tag_query |= Q(tags__contains=[tag])
        contacts = contacts.filter(
            id__in=CustomerProfile.objects.filter(
                tenant=tenant,
            ).filter(tag_query).values_list('contact_id', flat=True)
        )

    customer_levels = filter_conditions.get('customer_levels', [])
    if customer_levels:
        contacts = contacts.filter(
            id__in=CustomerProfile.objects.filter(
                tenant=tenant,
                customer_level__in=customer_levels,
            ).values_list('contact_id', flat=True)
        )

    min_orders = filter_conditions.get('min_orders')
    if min_orders:
        contacts = contacts.filter(
            id__in=CustomerProfile.objects.filter(
                tenant=tenant,
                total_orders__gte=min_orders,
            ).values_list('contact_id', flat=True)
        )

    min_amount = filter_conditions.get('min_amount')
    if min_amount:
        contacts = contacts.filter(
            id__in=CustomerProfile.objects.filter(
                tenant=tenant,
                total_amount__gte=min_amount,
            ).values_list('contact_id', flat=True)
        )

    return contacts
# ============================================================

def _check_broadcast_anti_harassment(contact, tenant) -> tuple:
    """群发防骚扰检查。

    Returns:
        (allowed: bool, reason: str)
    """
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today_start.replace(day=1)

    # 1. 每日上限
    daily_count = BroadcastRecipient.objects.filter(
        contact=contact,
        status='sent',
        sent_at__gte=today_start,
    ).count()
    if daily_count >= BROADCAST_DAILY_MAX_PER_CONTACT:
        return False, f'今日已收到 {daily_count} 条群发，超过每日上限 {BROADCAST_DAILY_MAX_PER_CONTACT}'

    # 2. 月度上限
    monthly_count = BroadcastRecipient.objects.filter(
        contact=contact,
        status='sent',
        sent_at__gte=month_start,
    ).count()
    if monthly_count >= BROADCAST_MONTHLY_MAX_PER_CONTACT:
        return False, f'本月已收到 {monthly_count} 条群发，超过月度上限 {BROADCAST_MONTHLY_MAX_PER_CONTACT}'

    return True, 'all checks passed'


def _get_monthly_broadcast_count(contact, tenant) -> int:
    """获取联系人本月已收群发数。"""
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return BroadcastRecipient.objects.filter(
        contact=contact,
        status='sent',
        sent_at__gte=month_start,
    ).count()


# ============================================================
# 素材发送
# ============================================================

def _send_material(client, device, contact, material_type: str,
                   material_content: dict, tenant) -> bool:
    """根据素材类型发送消息。

    Args:
        client: QiWeiClient 实例
        device: WecomDevice 实例
        contact: WecomContact 实例
        material_type: text / link / miniprogram
        material_content: 素材内容 dict
        tenant: Tenant 实例

    Returns:
        True 发送成功, False 发送失败
    """
    try:
        to_id = contact.external_userid
        guid = device.guid

        if material_type == 'text':
            text = material_content.get('text', '')
            if not text:
                logger.warning(f'[Broadcast] empty text content for contact={contact.id}')
                return False
            client.send_text(to_id=to_id, content=text, guid=guid)
            return True

        elif material_type == 'link':
            title = material_content.get('title', '')
            desc = material_content.get('desc', '')
            url = material_content.get('url', '')
            pic_url = material_content.get('pic_url', '')
            if not url:
                logger.warning(f'[Broadcast] empty link url for contact={contact.id}')
                return False
            client.send_link(
                to_id=to_id, title=title, icon_url=pic_url or '',
                link_url=url, desc=desc, guid=guid,
            )
            return True

        elif material_type == 'miniprogram':
            # 小程序卡片使用 send_link 降级发送（QiWe 网关暂无独立小程序发送接口）
            title = material_content.get('title', '')
            desc = material_content.get('desc', '')
            url = material_content.get('url', '')
            pic_url = material_content.get('pic_url', '')
            if not url:
                logger.warning(f'[Broadcast] empty miniprogram url for contact={contact.id}')
                return False
            client.send_link(
                to_id=to_id, title=title, icon_url=pic_url or '',
                link_url=url, desc=desc, guid=guid,
            )
            return True

        else:
            logger.warning(f'[Broadcast] unknown material_type: {material_type}')
            return False

    except Exception as e:
        logger.error(f'[Broadcast] _send_material error: {e}')
        return False


# ============================================================
# 积分扣减
# ============================================================

def _deduct_broadcast_credits(tenant, agent_id: str, sent_count: int) -> dict:
    """群发积分扣减。

    按发送条数扣减，每条 1 积分（可通过 action_config.overrides 调整）。
    """
    if sent_count <= 0:
        return {'deducted': 0, 'reason': 'no messages sent'}

    try:
        from apps.platform.credit_service import deduct_credits
        from apps.platform.models import TenantUser

        user = TenantUser.objects.filter(
            tenant=tenant,
            role__in=['admin', 'owner'],
        ).first()

        if not user:
            return {'deducted': 0, 'reason': 'no admin user'}

        # 群发按发送条数扣减：每条 1 token 等价
        result = deduct_credits(
            tenant=tenant,
            user=user,
            agent_code=agent_id or 'broadcast',
            agent_name='精准群发',
            tokens_consumed=sent_count,
        )
        return result
    except Exception as e:
        logger.exception(f'[Broadcast] Credit deduction failed: {e}')
        return {'deducted': 0, 'error': str(e)}


# ============================================================
# 预览接收者（供 API 调用）
# ============================================================

def preview_recipients(device, tenant, filter_tags: list, filter_conditions: dict) -> list:
    """预览筛选后的接收者列表（不发送）。

    供 BroadcastTaskCreateView 在创建前预览使用。
    """
    from apps.wecom.models import WecomContact
    from django.db.models import Q

    contacts = WecomContact.objects.filter(
        tenant=tenant,
        device=device,
        ai_hosted=True,
    )

    if filter_tags:
        tag_query = Q()
        for tag in filter_tags:
            tag_query |= Q(tags__contains=[tag])
        contacts = contacts.filter(
            id__in=CustomerProfile.objects.filter(
                tenant=tenant,
            ).filter(tag_query).values_list('contact_id', flat=True)
        )

    customer_levels = filter_conditions.get('customer_levels', [])
    if customer_levels:
        contacts = contacts.filter(
            id__in=CustomerProfile.objects.filter(
                tenant=tenant,
                customer_level__in=customer_levels,
            ).values_list('contact_id', flat=True)
        )

    min_orders = filter_conditions.get('min_orders')
    if min_orders:
        contacts = contacts.filter(
            id__in=CustomerProfile.objects.filter(
                tenant=tenant,
                total_orders__gte=min_orders,
            ).values_list('contact_id', flat=True)
        )

    # 返回前 100 条预览
    contacts = contacts[:100]
    result = []
    for c in contacts:
        result.append({
            'id': c.id,
            'name': c.name,
            'remark': c.remark,
            'external_userid': c.external_userid,
        })
    return result
