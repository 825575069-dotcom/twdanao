"""
apps/marketing_follow/proactive_executor.py
主动跟进执行器 + 防骚扰护栏

对齐设计文档 v1.0 第 5 节（主动跟进触发）和第 8 节（防骚扰护栏）。

防骚扰护栏 5 条：
  1. 时间窗口 8:00-20:00
  2. 频率限制：每天 1 条 / 每周 3 条（同一联系人）
  3. 冷却期：最后一条消息后 30 分钟
  4. 月度上限：每月 8 条（同一联系人）
  5. 全局熔断：当天失败率 > 30% 暂停

执行链路：
  TaskExecution(pending) → 防骚扰检查 → 5层Prompt → LLM → 分段发送 → 积分扣减
"""
import logging
import random
import time
from datetime import timedelta
from django.utils import timezone
from django.db.models import Q, Count

from .models import (
    MarketingTask, TaskExecution, ChatSetting, CustomerProfile,
    ProactiveFollowTask,
)

logger = logging.getLogger(__name__)

# ============================================================
# 常量
# ============================================================

# 防骚扰参数
GUARD_TIME_WINDOW_START = 8   # 允许发送的开始小时
GUARD_TIME_WINDOW_END = 20    # 允许发送的结束小时
GUARD_DAILY_MAX = 1           # 同一联系人每天最多 1 条主动跟进
GUARD_WEEKLY_MAX = 3          # 同一联系人每周最多 3 条
GUARD_MONTHLY_MAX = 8         # 同一联系人每月最多 8 条
GUARD_COOLDOWN_MINUTES = 30   # 冷却期（分钟）
GUARD_GLOBAL_FAILURE_RATE = 0.30  # 全局熔断阈值

# 分段发送参数（与 ai_reply.py 一致）
MAX_SEGMENT_LENGTH = 30
SEND_INTERVAL_MIN = 1.0
SEND_INTERVAL_MAX = 3.0

# 时间窗口（小时）
TIME_WINDOW_START_HOUR = 8
TIME_WINDOW_END_HOUR = 20


# ============================================================
# 防骚扰护栏
# ============================================================

def check_anti_harassment(execution: TaskExecution) -> tuple:
    """执行防骚扰 5 条检查。

    Returns:
        (allowed: bool, reason: str)
    """
    contact = execution.target_contact
    tenant = execution.tenant
    now = timezone.now()

    # 1. 时间窗口检查
    local_hour = now.hour
    if local_hour < TIME_WINDOW_START_HOUR or local_hour >= TIME_WINDOW_END_HOUR:
        return False, f'非工作时间({local_hour}时)，允许时段 {TIME_WINDOW_START_HOUR}-{TIME_WINDOW_END_HOUR} 时'

    # 2. 冷却期检查
    from apps.wecom.models import WecomMessage
    last_msg = WecomMessage.objects.filter(
        contact=contact,
        direction='outbound',
    ).order_by('-created_at').first()
    if last_msg:
        elapsed = now - last_msg.created_at
        if elapsed < timedelta(minutes=GUARD_COOLDOWN_MINUTES):
            remaining = GUARD_COOLDOWN_MINUTES - int(elapsed.total_seconds() / 60)
            return False, f'冷却期内，还需等待 {remaining} 分钟'

    # 3. 频率限制：每天/每周
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())  # 本周一

    daily_count = TaskExecution.objects.filter(
        tenant=tenant,
        target_contact=contact,
        status='success',
        completed_at__gte=today_start,
    ).count()
    if daily_count >= GUARD_DAILY_MAX:
        return False, f'今日已发送 {daily_count} 条，超过每日上限 {GUARD_DAILY_MAX}'

    weekly_count = TaskExecution.objects.filter(
        tenant=tenant,
        target_contact=contact,
        status='success',
        completed_at__gte=week_start,
    ).count()
    if weekly_count >= GUARD_WEEKLY_MAX:
        return False, f'本周已发送 {weekly_count} 条，超过每周上限 {GUARD_WEEKLY_MAX}'

    # 4. 月度上限
    month_start = today_start.replace(day=1)
    monthly_count = TaskExecution.objects.filter(
        tenant=tenant,
        target_contact=contact,
        status='success',
        completed_at__gte=month_start,
    ).count()
    if monthly_count >= GUARD_MONTHLY_MAX:
        return False, f'本月已发送 {monthly_count} 条，超过月度上限 {GUARD_MONTHLY_MAX}'

    # 5. 全局熔断：当天失败率
    today_execs = TaskExecution.objects.filter(
        tenant=tenant,
        created_at__gte=today_start,
    )
    today_total = today_execs.count()
    today_failed = today_execs.filter(status='failed').count()
    if today_total >= 10 and today_failed / today_total > GUARD_GLOBAL_FAILURE_RATE:
        return False, f'全局熔断：今日失败率 {today_failed}/{today_total} > {GUARD_GLOBAL_FAILURE_RATE*100:.0f}%'

    return True, 'all checks passed'


# ============================================================
# 主动跟进执行
# ============================================================

def execute_proactive_follow(execution: TaskExecution):
    """执行主动跟进任务。

    完整链路：
      1. 标记 running
      2. 防骚扰检查
      3. 构建 5 层 Prompt
      4. 调用 LLM 生成开场白
      5. 分段发送
      6. 积分扣减
      7. 标记 success/failed/skipped
    """
    task = execution.task
    contact = execution.target_contact
    tenant = execution.tenant

    # 标记开始执行
    execution.started_at = timezone.now()
    execution.status = 'running'
    execution.save(update_fields=['status', 'started_at'])

    logger.info(f'[ProactiveFollow] start: task={task.name} contact={contact} exec={execution.id}')

    try:
        # 1. 防骚扰检查
        allowed, reason = check_anti_harassment(execution)
        if not allowed:
            execution.status = 'skipped'
            execution.error = reason
            execution.completed_at = timezone.now()
            execution.result = {'skipped': True, 'reason': reason}
            execution.save(update_fields=['status', 'error', 'completed_at', 'result'])
            logger.info(f'[ProactiveFollow] skipped: exec={execution.id} reason={reason}')
            return

        # 2. 获取设备
        device = task.device
        if not device or device.status != 'online':
            execution.status = 'skipped'
            execution.error = f'设备不可用: {device.status if device else "无设备"}'
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'error', 'completed_at'])
            return

        # 3. 获取聊天设置
        chat_setting = ChatSetting.objects.filter(
            device=device, tenant=tenant,
        ).first()

        # 4. 构建 Prompt
        agent_id = task.agent_id or (chat_setting.agent_id if chat_setting else '')
        prompt = _build_proactive_prompt(execution, task, contact, tenant, chat_setting)

        # 5. 调用 LLM
        llm_result = _call_llm(prompt, tenant, agent_id)
        content = llm_result.get('content', '').strip()
        tokens = llm_result.get('total_tokens', 0)

        if not content:
            execution.status = 'failed'
            execution.error = 'LLM 返回空内容'
            execution.completed_at = timezone.now()
            execution.save(update_fields=['status', 'error', 'completed_at'])
            return

        # 6. 后端校验
        forbidden_words = chat_setting.forbidden_words if chat_setting else []
        content = _sanitize_reply(content, forbidden_words)

        # 7. 分段发送
        segments = _split_to_segments(content)
        sent_count = _send_segments(device, contact, segments, tenant)

        # 8. 积分扣减
        credit_result = _deduct_credits(tenant, agent_id, tokens)

        # 9. 记录 ProactiveFollowTask
        ProactiveFollowTask.objects.create(
            tenant=tenant,
            device=device,
            contact=contact,
            trigger_type='event',
            trigger_event=execution.trigger_event,
            agent_id=agent_id,
            status='sent',
            ai_content=content,
            sent_at=timezone.now(),
        )

        # 10. 标记成功
        execution.status = 'success'
        execution.completed_at = timezone.now()
        execution.result = {
            'content': content,
            'segments_count': len(segments),
            'sent_count': sent_count,
            'llm_tokens': tokens,
            'credit_cost': credit_result.get('deducted', 0),
        }
        execution.save(update_fields=['status', 'completed_at', 'result'])
        logger.info(f'[ProactiveFollow] success: exec={execution.id} segments={sent_count}')

    except Exception as e:
        execution.status = 'failed'
        execution.error = str(e)[:500]
        execution.completed_at = timezone.now()
        execution.save(update_fields=['status', 'error', 'completed_at'])
        logger.exception(f'[ProactiveFollow] failed: exec={execution.id} error={e}')


# ============================================================
# Prompt 构建（复用 ai_reply.py 的 5 层模式）
# ============================================================

def _build_proactive_prompt(execution, task, contact, tenant, chat_setting) -> str:
    """构建主动跟进 5 层 Prompt。"""
    parts = []
    parts.append(_build_role_context(task, chat_setting))
    parts.append(_build_knowledge_context(task, tenant))
    parts.append(_build_data_context(contact, tenant))
    parts.append(_build_trigger_context(execution, task, contact))
    parts.append(_build_action_instruction(task, contact, chat_setting))
    return '\n\n'.join(parts)


def _build_role_context(task, chat_setting) -> str:
    """[角色定位]"""
    agent_id = task.agent_id or (chat_setting.agent_id if chat_setting else '')
    try:
        from apps.platform.models import Agent, AgentConfig
        agent = None
        if agent_id:
            agent = Agent.objects.filter(agent_id=agent_id).first()
        if not agent:
            agent = Agent.objects.filter(code='follow_rabbit').first()
        if not agent:
            return '[角色定位]\n你是一位专业的医药行业营销跟客助手。'

        lines = [f'[角色定位]\n你是「{agent.name}」。']
        if agent.description:
            lines.append(agent.description)
        config = AgentConfig.objects.filter(agent=agent).first()
        if config and config.system_prompt:
            lines.append(config.system_prompt)
        return '\n'.join(lines)
    except Exception:
        return '[角色定位]\n你是一位专业的医药行业营销跟客助手。'


def _build_knowledge_context(task, tenant) -> str:
    """[知识文档]"""
    try:
        from apps.platform.knowledge_rag import build_knowledge_context
        agent_id = task.agent_id or ''
        return build_knowledge_context(tenant, query='主动跟进 开场白', agent_id=agent_id, top_k=3)
    except Exception:
        return '[知识文档]\n（暂无知识文档）'


def _build_data_context(contact, tenant) -> str:
    """[数据底座] — 客户画像 + 最近消息"""
    lines = ['[数据底座]']

    # 客户画像
    try:
        profile = CustomerProfile.objects.get(contact=contact, tenant=tenant)
        lines.append(f'客户等级: {profile.customer_level}')
        lines.append(f'历史订单数: {profile.total_orders}')
        lines.append(f'历史采购总额: {profile.total_amount}')
        lines.append(f'最后下单时间: {profile.last_order_at}')
        if profile.browse_products:
            lines.append(f'常浏览产品: {", ".join(profile.browse_products[:5])}')
        if profile.tags:
            lines.append(f'客户标签: {", ".join(profile.tags)}')
    except CustomerProfile.DoesNotExist:
        lines.append('客户画像: 暂无')

    # 联系人基本信息
    lines.append(f'客户昵称: {contact.name}')
    lines.append(f'客户备注: {contact.remark}')

    # 最近 5 条消息
    from apps.wecom.models import WecomMessage
    recent_msgs = WecomMessage.objects.filter(
        contact=contact,
    ).order_by('-created_at')[:5]
    if recent_msgs:
        lines.append('\n最近对话记录:')
        for msg in recent_msgs:
            direction = '客户' if msg.direction == 'inbound' else '我方'
            content_preview = msg.content[:50] if msg.content else f'[{msg.msg_type}]'
            lines.append(f'  {direction}: {content_preview}')

    return '\n'.join(lines)


def _build_trigger_context(execution, task, contact) -> str:
    """[触发场景]"""
    trigger_event = execution.trigger_event or {}
    event_type = trigger_event.get('event_type', '')
    event_data = trigger_event.get('event_data', {})

    lines = ['[触发场景]']
    scene_map = {
        'message_received': '客户发来消息',
        'contact_added': '新联系人添加',
        'order_completed': '客户完成订单',
        'no_contact_days': '长时间未联系',
    }
    scene_desc = scene_map.get(event_type, event_type)
    lines.append(f'触发原因: {scene_desc}')

    if event_type == 'message_received' and event_data.get('content'):
        lines.append(f'客户消息: "{event_data["content"][:100]}"')
    elif event_type == 'no_contact_days':
        conditions = (task.trigger_config or {}).get('conditions', {})
        days = conditions.get('days', 7)
        lines.append(f'已 {days} 天未联系该客户')
    elif event_type == 'order_completed':
        lines.append(f'订单信息: {event_data}')

    return '\n'.join(lines)


def _build_action_instruction(task, contact, chat_setting) -> str:
    """[执行指令]"""
    action_config = task.action_config or {}
    lines = ['[执行指令]']

    lines.append('请生成一条主动跟进开场白消息，要求：')
    lines.append('1. 语气自然亲切，像真人销售跟客户聊天')
    lines.append('2. 结合客户画像和触发场景，体现个性化')
    lines.append('3. 不要太长，控制在 30-50 字以内')
    lines.append('4. 不要直接推销产品，先建立关系')
    lines.append('5. 不要包含价格、折扣等敏感信息')

    # 称呼方式
    if chat_setting:
        address_map = {
            'remark': contact.remark or contact.name,
            'nickname': contact.name,
            'surname_prefix': f'{contact.remark[:1]}总' if contact.remark else '您好',
        }
        address = address_map.get(chat_setting.customer_address, contact.name or '您好')
        lines.append(f'6. 称呼客户为: {address}')

    custom_prompt = action_config.get('custom_prompt', '')
    if custom_prompt:
        lines.append(f'\n额外要求: {custom_prompt}')

    lines.append('\n请直接输出开场白内容，不要包含任何解释或标记。')
    return '\n'.join(lines)


# ============================================================
# LLM 调用（复用 ai_reply.py 的 provider 模式）
# ============================================================

def _call_llm(prompt: str, tenant, agent_id: str) -> dict:
    """调用大模型生成内容。"""
    try:
        from apps.model_gateway.models import AIModel
        from apps.model_gateway.providers import get_provider
        from apps.platform.models import AgentConfig

        model = None
        config = None
        if agent_id:
            from apps.platform.models import Agent
            agent = Agent.objects.filter(agent_id=agent_id).first()
            if agent:
                config = AgentConfig.objects.filter(agent=agent).first()
                if config and config.model_id:
                    model = AIModel.objects.filter(id=config.model_id, status='ready').first()
                if not model and config and config.fallback_model_id:
                    model = AIModel.objects.filter(id=config.fallback_model_id, status='ready').first()

        if not model:
            model = AIModel.objects.filter(status='ready').first()

        if not model:
            logger.warning('[ProactiveFollow] No AI model available, using fallback')
            return {
                'content': '您好，最近忙吗？有什么可以帮到您的吗？',
                'total_tokens': 0,
            }

        provider = get_provider(model)
        messages = [
            {'role': 'system', 'content': prompt},
            {'role': 'user', 'content': '请生成主动跟进开场白。'},
        ]
        response = provider.call(messages, temperature=0.7)
        return response.to_dict()

    except Exception as e:
        logger.exception(f'[ProactiveFollow] LLM call failed: {e}')
        return {
            'content': '您好，最近忙吗？有什么可以帮到您的吗？',
            'total_tokens': 0,
        }


# ============================================================
# 后端校验（与 ai_reply.py 一致）
# ============================================================

def _sanitize_reply(content: str, forbidden_words: list) -> str:
    """清理禁用词。"""
    for word in forbidden_words:
        if word and word in content:
            content = content.replace(word, '*' * len(word))
    return content


# ============================================================
# 分段发送（与 ai_reply.py 一致）
# ============================================================

def _split_to_segments(content: str) -> list:
    """将内容拆分为分段（模仿真人聊天）。"""
    if not content:
        return []

    segments = []

    # 1. 按换行分段
    parts = [p.strip() for p in content.split('\n') if p.strip()]

    # 2. 过长段落按标点拆分
    for part in parts:
        if len(part) <= MAX_SEGMENT_LENGTH:
            segments.append(part)
        else:
            # 按句号/问号/感叹号拆分
            import re
            sentences = re.split(r'[。！？!?]', part)
            sentences = [s.strip() for s in sentences if s.strip()]
            current = ''
            for sent in sentences:
                if len(current) + len(sent) + 1 <= MAX_SEGMENT_LENGTH:
                    current = (current + sent + '。') if current else (sent + '。')
                else:
                    if current:
                        segments.append(current)
                    current = sent + '。'
            if current:
                segments.append(current)

    # 3. 合并过短段落
    merged = []
    for seg in segments:
        if merged and len(merged[-1]) < 5:
            merged[-1] = merged[-1] + seg
        else:
            merged.append(seg)

    # 4. 最多 4 条
    return merged[:4]


def _send_segments(device, contact, segments: list, tenant) -> int:
    """分段发送消息，返回成功发送数。"""
    from apps.wecom.models import WecomMessage
    from apps.wecom.qiwei_client import get_qiwei_client, QiWeiAPIError

    sent_count = 0
    try:
        client = get_qiwei_client(device)
    except Exception as e:
        logger.error(f'[ProactiveFollow] Failed to get qiwei client: {e}')
        return 0

    for i, seg in enumerate(segments):
        try:
            response = client.send_text(
                to_id=contact.external_userid,
                content=seg,
                guid=device.guid,
            )

            # 捕获 QiWe 返回的消息标识
            msg_server_id = response.get('msgServerId') or response.get('msgserverid')
            msg_unique_id = response.get('msgUniqueIdentifier') or response.get('msguniqueidentifier') or ''

            # 持久化发送的消息
            WecomMessage.objects.create(
                tenant=tenant,
                device=device,
                contact=contact,
                direction='outbound',
                msg_type='text',
                content=seg,
                ai_generated=True,
                msg_server_id=msg_server_id,
                msg_unique_identifier=msg_unique_id,
            )
            sent_count += 1

            # 模仿真人间隔（最后一条不等）
            if i < len(segments) - 1:
                time.sleep(random.uniform(SEND_INTERVAL_MIN, SEND_INTERVAL_MAX))

        except QiWeiAPIError as e:
            logger.error(f'[ProactiveFollow] Send segment {i} failed: {e}')
            break
        except Exception as e:
            logger.exception(f'[ProactiveFollow] Send segment {i} error: {e}')
            break

    return sent_count


# ============================================================
# 积分扣减（复用 credit_service）
# ============================================================

def _deduct_credits(tenant, agent_id: str, tokens: int) -> dict:
    """扣减积分。"""
    try:
        from apps.platform.credit_service import deduct_credits
        from apps.platform.models import TenantUser

        user = TenantUser.objects.filter(
            tenant=tenant,
            role__in=['admin', 'owner'],
        ).first()

        if not user:
            return {'deducted': 0, 'reason': 'no admin user'}

        result = deduct_credits(
            tenant=tenant,
            user=user,
            agent_code=agent_id or 'proactive_follow',
            agent_name='主动跟进',
            tokens_consumed=tokens,
        )
        return result
    except Exception as e:
        logger.exception(f'[ProactiveFollow] Credit deduction failed: {e}')
        return {'deducted': 0, 'error': str(e)}
