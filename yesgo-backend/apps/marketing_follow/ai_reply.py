"""
apps/marketing_follow/ai_reply.py
AI 被动回复链路

完整流程：
1. 三级开关检查（企业级 → 设备级 → 客户级）
2. 工作时间检查
3. 构建 5 层 Prompt（角色定位/知识文档/数据底座/聊天设置/执行指令）
4. 调用 LLM 生成回复
5. 后端校验（禁用词/价格承诺/绝对化用语/长度）
6. 模仿真人分段发送（≤30字/连续多条/口语化/1-3秒间隔/无签名/称呼用备注名）
7. 积分扣减
"""
import re
import time
import random
import logging
from datetime import datetime

from django.utils import timezone
from django.db import connection

from apps.wecom.models import WecomMessage, WecomContact, WecomDevice
from apps.wecom.qiwei_client import get_qiwei_client, QiWeiAPIError
from apps.platform.models import Tenant, Agent, AgentConfig
from apps.platform.knowledge_rag import build_knowledge_context

from .models import ChatSetting, AiReplyTask

logger = logging.getLogger(__name__)

# ============================================================
# 常量
# ============================================================

# 模仿真人回复配置
MAX_SEGMENT_LENGTH = 30       # 每条消息最大字数
SEND_INTERVAL_MIN = 1.0       # 分段发送最小间隔（秒）
SEND_INTERVAL_MAX = 3.0       # 分段发送最大间隔（秒）

# 后端校验：绝对化用语
FORBIDDEN_ABSOLUTE_WORDS = [
    '最好', '最佳', '最优', '最低价', '最便宜', '最高',
    '唯一', '独家', '第一', '国家级', '世界级',
    '绝对', '100%', '保证', '承诺', '包退', '包换',
]

# 后端校验：价格承诺
PRICE_PATTERNS = [
    r'保证.*?最低价',
    r'承诺.*?低价',
    r'肯定比.*?便宜',
    r'绝对不会.*?贵',
]


# ============================================================
# 主入口
# ============================================================

def generate_ai_reply(message_id: int):
    """
    AI 被动回复主入口

    由 wecom.webhook_handler._trigger_ai_reply() 调用，
    在 ThreadPoolExecutor 线程中执行。

    Args:
        message_id: WecomMessage.id（inbound 消息）
    """
    try:
        msg = WecomMessage.objects.select_related(
            'tenant', 'device', 'contact'
        ).get(id=message_id)
    except WecomMessage.DoesNotExist:
        logger.error(f'Message {message_id} not found')
        return

    device = msg.device
    contact = msg.contact
    tenant = msg.tenant

    # ── 1. 三级开关检查 ──
    allowed, reason = _check_three_level_switch(device, contact)
    if not allowed:
        logger.info(f'AI reply skipped (switch off): {reason}, contact={contact}')
        _create_skipped_task(msg, reason)
        return

    # ── 2. 获取聊天设置 ──
    chat_setting = _get_chat_setting(device, tenant)
    if not chat_setting:
        logger.warning(f'No ChatSetting for device={device.name}, skipping AI reply')
        _create_skipped_task(msg, '未配置聊天设置')
        return

    # ── 3. 工作时间检查 ──
    if not _check_work_hours(chat_setting):
        logger.info(f'AI reply skipped (outside work hours): contact={contact}')
        _create_skipped_task(msg, '非AI工作时间')
        return

    # ── 3.5 停止回复关键词检查 ──
    if chat_setting.stop_reply_keywords:
        msg_text = msg.content or ''
        for kw in chat_setting.stop_reply_keywords:
            if kw and kw in msg_text:
                logger.info(f'AI reply skipped (stop keyword "{kw}"): contact={contact}')
                _create_skipped_task(msg, f'命中停止回复关键词: {kw}')
                # 自动关闭该联系人的AI托管，转为人工
                contact.ai_hosted = False
                contact.save(update_fields=['ai_hosted'])
                return

    # ── 3.6 非文本消息处理 ──
    if msg.msg_type and msg.msg_type != 'text':
        handled = _handle_non_text_message(msg, chat_setting, device, contact, tenant)
        if handled is not None:
            return  # 已处理（忽略或直接发送固定文字），不进入 LLM 流程

    # ── 3.7 群聊回复模式检查 ──
    is_group = getattr(msg, 'conversation_type', None) == 'group' or bool(getattr(msg, 'room_id', None))
    if is_group:
        allowed, reason = _check_group_reply_mode(msg, chat_setting, device)
        if not allowed:
            logger.info(f'AI reply skipped (group mode): {reason}')
            _create_skipped_task(msg, reason)
            return

    # ── 4. 创建 AiReplyTask ──
    task = AiReplyTask.objects.create(
        tenant=tenant,
        device=device,
        contact=contact,
        inbound_message=msg,
        status='processing',
    )

    try:
        # ── 5. 构建 5 层 Prompt ──
        prompt = _build_prompt(msg, chat_setting, device, contact, tenant)
        task.prompt_snapshot = prompt
        task.save(update_fields=['prompt_snapshot'])

        # ── 6. 调用 LLM ──
        llm_result = _call_llm(prompt, tenant, chat_setting.agent_id)
        ai_content = llm_result.get('content', '')
        tokens = llm_result.get('total_tokens', 0)
        task.ai_content = ai_content
        task.llm_tokens = tokens
        task.save(update_fields=['ai_content', 'llm_tokens'])

        if not ai_content or not ai_content.strip():
            task.status = 'failed'
            task.error = 'LLM returned empty content'
            task.save(update_fields=['status', 'error'])
            return

        # ── 7. 后端校验 ──
        validated, issues = _validate_reply(ai_content, chat_setting.forbidden_words)
        if not validated:
            logger.warning(f'AI reply validation failed: {issues}')
            # 尝试清理后继续发送（替换禁用词而非完全放弃）
            ai_content = _sanitize_reply(ai_content, chat_setting.forbidden_words)
            if not ai_content.strip():
                task.status = 'failed'
                task.error = f'Validation failed: {issues}'
                task.save(update_fields=['status', 'error'])
                return

        # ── 7.5 硬过滤：移除 AI 标识/元文本/免责声明（防止 LLM 不遵守指令）──
        ai_content = _strip_ai_artifacts(ai_content)
        if not ai_content.strip():
            task.status = 'failed'
            task.error = 'Content empty after AI artifact stripping'
            task.save(update_fields=['status', 'error'])
            return

        # ── 8. 模仿真人分段发送 ──
        segments = _split_to_segments(ai_content, chat_setting, contact)
        task.ai_segments = segments
        task.save(update_fields=['ai_segments'])

        _send_segments(device, contact, segments, tenant, chat_setting)

        # ── 9. 更新状态 ──
        task.status = 'sent'
        task.sent_at = timezone.now()
        task.save(update_fields=['status', 'sent_at'])

        # 更新联系人最后联系时间
        contact.last_contacted_at = timezone.now()
        contact.save(update_fields=['last_contacted_at'])

        # ── 10. 积分扣减 ──
        credit_result = _deduct_credits(tenant, chat_setting.agent_id, tokens)
        task.credit_cost = credit_result.get('deducted', 0)
        task.save(update_fields=['credit_cost'])

        logger.info(
            f'AI reply sent: task={task.id}, contact={contact}, '
            f'segments={len(segments)}, tokens={tokens}, credits={task.credit_cost}'
        )

    except Exception as e:
        logger.exception(f'AI reply failed: {e}')
        task.status = 'failed'
        task.error = str(e)[:500]
        task.save(update_fields=['status', 'error'])
    finally:
        connection.close()


# ============================================================
# 1. 三级开关检查
# ============================================================

def _check_three_level_switch(device: WecomDevice, contact: WecomContact):
    """
    三级开关检查：
    1. 企业级：ChatSetting.ai_enabled
    2. 设备级：WecomDevice.ai_enabled
    3. 客户级：WecomContact.ai_hosted

    Returns:
        (allowed: bool, reason: str)
    """
    # 设备级开关（最快检查，无需额外查询）
    if not device.ai_enabled:
        return False, '设备级AI开关已关闭'

    if device.status == 'banned':
        return False, '设备已封禁'

    # 客户级开关
    if not contact.ai_hosted:
        return False, '客户级AI托管已关闭'

    # 企业级开关（需要查 ChatSetting）
    chat_setting = ChatSetting.objects.filter(
        device=device, tenant=device.tenant
    ).first()
    if not chat_setting:
        # 没有 ChatSetting 记录，默认不允许
        return False, '未配置聊天设置'

    if not chat_setting.ai_enabled:
        return False, '企业级AI总开关已关闭'

    return True, 'all switches on'


# ============================================================
# 2. 聊天设置
# ============================================================

def _get_chat_setting(device, tenant):
    """获取设备的聊天设置"""
    return ChatSetting.objects.filter(device=device, tenant=tenant).first()


def _check_work_hours(chat_setting: ChatSetting) -> bool:
    """
    检查当前是否在 AI 工作时间内

    如果未设置工作时间，默认全天可回复
    """
    if not chat_setting.work_hours_start or not chat_setting.work_hours_end:
        return True

    now = timezone.now()
    # 转为本地时间的 time
    if timezone.is_aware(now):
        from django.conf import settings
        local_now = timezone.localtime(now, timezone.get_default_timezone())
    else:
        local_now = now

    current_time = local_now.time()
    return chat_setting.work_hours_start <= current_time <= chat_setting.work_hours_end


# ============================================================
# 3. 构建 5 层 Prompt
# ============================================================

def _build_prompt(msg: WecomMessage, chat_setting: ChatSetting,
                  device: WecomDevice, contact: WecomContact,
                  tenant: Tenant) -> str:
    """
    构建 5 层 Prompt

    [角色定位]  ← Agent + AgentConfig.system_prompt
    [知识文档]  ← knowledge_rag.build_knowledge_context()
    [数据底座]  ← 客户画像 + 最近消息上下文
    [聊天设置]  ← ChatSetting（风格/长度/称呼/禁用词/模仿真人规则）
    [执行指令]  ← 场景指令 + 客户消息
    """
    parts = []

    # ── [角色定位] ──
    role_text = _build_role_context(chat_setting.agent_id)
    if role_text:
        parts.append(role_text)

    # ── [知识文档] ──
    try:
        knowledge_text = build_knowledge_context(
            tenant=tenant,
            query=msg.content,
            agent_id=chat_setting.agent_id,
            top_k=3,
        )
        if knowledge_text:
            parts.append(knowledge_text)
    except Exception as e:
        logger.warning(f'Knowledge RAG failed: {e}')

    # ── [数据底座] ──
    data_text = _build_data_context(contact, tenant, chat_setting)
    if data_text:
        parts.append(data_text)

    # ── [聊天设置] ──
    settings_text = _build_chat_settings_context(chat_setting, contact)
    parts.append(settings_text)

    # ── [执行指令] ──
    instruction = _build_instruction(msg, contact)
    parts.append(instruction)

    return '\n\n'.join(parts)


def _build_role_context(agent_id: str) -> str:
    """构建 [角色定位] 上下文"""
    if not agent_id:
        return ''

    try:
        agent = Agent.objects.filter(agent_id=agent_id).select_related('agent_role').first()
        if not agent:
            agent = Agent.objects.filter(code=agent_id).select_related('agent_role').first()
        if not agent:
            return ''

        lines = ['[角色定位]']
        if agent.agent_role:
            role = agent.agent_role
            lines.append(f'你是「{role.name}」。')
            if role.description:
                lines.append(role.description)
        else:
            lines.append(f'你是「{agent.name}」。')
            if agent.description:
                lines.append(agent.description)

        # 追加 AgentConfig.system_prompt
        config = AgentConfig.objects.filter(agent_id=agent_id).first()
        if config and config.system_prompt:
            lines.append(config.system_prompt)

        return '\n'.join(lines)
    except Exception as e:
        logger.warning(f'Build role context failed: {e}')
        return ''


def _build_data_context(contact: WecomContact, tenant: Tenant,
                       chat_setting: ChatSetting = None) -> str:
    """
    构建 [数据底座] 上下文

    包含客户画像 + 最近对话历史（按 chat_setting.memory_rounds 条数）
    """
    lines = ['[数据底座]']

    # 客户画像
    try:
        from .models import CustomerProfile
        profile = CustomerProfile.objects.filter(contact=contact).first()
        if profile:
            lines.append(f'客户等级: {profile.customer_level}')
            lines.append(f'历史订单数: {profile.total_orders}')
            lines.append(f'历史采购总额: {profile.total_amount}元')
            if profile.last_order_at:
                lines.append(f'最后下单: {profile.last_order_at.strftime("%Y-%m-%d")}')
            if profile.browse_products:
                lines.append(f'常浏览产品: {", ".join(profile.browse_products[:5])}')
    except Exception:
        pass

    # 最近对话历史（按 memory_rounds 配置条数，默认10）
    try:
        memory_rounds = chat_setting.memory_rounds if chat_setting else 10
        recent_msgs = WecomMessage.objects.filter(
            contact=contact
        ).exclude(id=contact.messages.last().id if contact.messages.last() else -1).order_by('-created_at')[:memory_rounds]

        if recent_msgs.exists():
            lines.append('\n最近对话:')
            for m in reversed(list(recent_msgs)):
                direction = '客户' if m.direction == 'inbound' else '我方'
                content_preview = m.content[:60] if m.content else f'[{m.msg_type}]'
                lines.append(f'  {direction}: {content_preview}')
    except Exception:
        pass

    # 联系人基本信息
    lines.append(f'\n客户备注名: {contact.remark or contact.name or "未知"}')
    if contact.enterprise_id:
        lines.append(f'统一社会信用代码: {contact.enterprise_id}')

    return '\n'.join(lines)


def _build_chat_settings_context(chat_setting: ChatSetting, contact: WecomContact) -> str:
    """
    构建 [聊天设置] 上下文

    注入模仿真人回复的全部规则：
    - 回复风格 / 回复长度
    - 客户称呼方式
    - 禁用词
    - 模仿真人规则（短句/口语化/分段/无签名）
    """
    style_map = {
        'professional': '专业（但保持口语化，不要生硬）',
        'friendly': '友好亲切',
        'lively': '活泼热情',
        'calm': '沉稳平和',
    }
    length_map = {
        'short': '简短（每次回复尽量1-2句话，不超过30字）',
        'medium': '适中（每次回复2-3句话，不超过60字）',
        'detailed': '详细（可以多解释一些，但不超过100字）',
    }

    # 客户称呼
    address_map = {
        'remark': contact.remark or contact.name or '客户',
        'nickname': contact.name or contact.remark or '客户',
        'surname_prefix': _get_surname_prefix(contact),
    }
    customer_name = address_map.get(chat_setting.customer_address, contact.remark or '客户')

    lines = [
        '[聊天设置]',
        f'回复风格: {style_map.get(chat_setting.reply_style, "友好亲切")}',
        f'回复长度: {length_map.get(chat_setting.reply_length, "简短")}',
        f'客户称呼: 请称呼客户为「{customer_name}」',
    ]

    # 禁用词
    if chat_setting.forbidden_words:
        lines.append(f'禁用词: 回复中绝对不能出现以下词汇: {", ".join(chat_setting.forbidden_words)}')

    # 模仿真人规则（核心）
    lines.append('')
    lines.append('【绝对禁止】AI身份泄露规则:')
    lines.append('- 你是一个真实的企微员工，不是AI、不是机器人、不是助手')
    lines.append('- 绝对不能出现任何模型名称（如DeepSeek、GPT、Claude等）')
    lines.append('- 绝对不能出现"作为AI"、"我是AI"、"作为一个AI"等自我标识')
    lines.append('- 绝对不能出现"已分析您的诉求"、"基于当前数据"、"建议如下"等AI元文本')
    lines.append('- 绝对不能出现"以上仅供参考"、"仅供参考"等AI免责声明')
    lines.append('- 绝对不能出现"让我来分析"、"我认为"、"我注意到"等思考过程')
    lines.append('- 直接输出回复内容，不要任何前缀、解释、思考过程')
    lines.append('')
    lines.append('【重要】模仿真人回复规则:')
    lines.append('- 用口语化表达，像微信聊天一样自然，不要用书面语或官方腔调')
    lines.append('- 每条回复控制在30字以内，简短直接')
    lines.append('- 可以把回复拆成2-3条连续消息（用换行分隔不同消息）')
    lines.append('- 不要使用markdown格式（不要用**、#、-等符号）')
    lines.append('- 称呼客户用备注名，像熟人聊天一样')

    # 快捷回复话术库（提示 AI 参考）
    if chat_setting.quick_replies:
        lines.append(f'\n参考话术库（可灵活调整，不要原样照搬）:')
        for i, qr in enumerate(chat_setting.quick_replies[:5], 1):
            if isinstance(qr, dict):
                lines.append(f'  {i}. {qr.get("keyword", "")}: {qr.get("reply", "")}')
            elif isinstance(qr, str):
                lines.append(f'  {i}. {qr}')

    return '\n'.join(lines)


def _build_instruction(msg: WecomMessage, contact: WecomContact) -> str:
    """构建 [执行指令] 上下文"""
    lines = [
        '[执行指令]',
        f'客户「{contact.remark or contact.name or "未知"}」刚发来一条消息，请以企微聊天的方式回复。',
        '',
        f'客户消息内容: {msg.content}',
        '',
        '请直接输出回复内容（不要解释你的思考过程），',
        '如果需要分多条发送，用换行分隔。',
    ]
    return '\n'.join(lines)


def _get_surname_prefix(contact: WecomContact) -> str:
    """提取姓氏 + 称谓（如"王经理"）"""
    name = contact.remark or contact.name or ''
    if not name:
        return '客户'
    # 取第一个字作为姓
    surname = name[0]
    # 如果名字包含"经理"/"总"等称谓直接用
    if '经理' in name or '总' in name or '老板' in name:
        return name
    return f'{surname}经理'


# ============================================================
# 4. 调用 LLM
# ============================================================

def _call_llm(prompt: str, tenant: Tenant, agent_id: str) -> dict:
    """
    调用大模型生成回复

    链路：ChatSetting.agent_id → AgentConfig.model_id → AIModel → get_provider → provider.call

    Returns:
        {
            'content': str,        # LLM 生成的回复
            'total_tokens': int,   # 消耗的 token 数
            'model_name': str,     # 模型名称
        }
    """
    try:
        from apps.model_gateway.models import AIModel
        from apps.model_gateway.providers import get_provider

        # 查找 AgentConfig 获取模型配置
        model = None
        if agent_id:
            config = AgentConfig.objects.filter(agent_id=agent_id).first()
            if config and config.model_id:
                model = AIModel.objects.filter(id=config.model_id, status='ready').first()
            # 兜底模型
            if not model and config and config.fallback_model_id:
                model = AIModel.objects.filter(id=config.fallback_model_id, status='ready').first()

        # 没有配置模型 → 取第一个可用模型
        if not model:
            model = AIModel.objects.filter(status='ready').first()

        if not model:
            logger.warning('No AIModel available, returning fallback reply')
            return {
                'content': '好的，我收到了您的消息，稍后给您回复。',
                'total_tokens': 50,
                'model_name': 'fallback',
            }

        provider = get_provider(model)
        if not provider:
            return {
                'content': '好的，收到~有什么可以帮您的吗？',
                'total_tokens': 30,
                'model_name': 'no-provider',
            }

        messages = [
            {'role': 'system', 'content': prompt},
            {'role': 'user', 'content': '请生成回复。'},
        ]

        response = provider.call(messages, temperature=0.7)
        return response.to_dict()

    except Exception as e:
        logger.exception(f'LLM call failed: {e}')
        return {
            'content': '',
            'total_tokens': 0,
            'model_name': 'error',
        }


# ============================================================
# 5. 后端校验
# ============================================================

def _validate_reply(content: str, forbidden_words: list) -> tuple:
    """
    后端校验 AI 回复

    检查：
    - 不包含 forbidden_words
    - 不包含绝对化用语
    - 不包含价格承诺

    Returns:
        (passed: bool, issues: list[str])
    """
    issues = []

    # 禁用词检查
    if forbidden_words:
        for word in forbidden_words:
            if word and word in content:
                issues.append(f'包含禁用词: {word}')

    # 绝对化用语
    for word in FORBIDDEN_ABSOLUTE_WORDS:
        if word in content:
            issues.append(f'包含绝对化用语: {word}')

    # 价格承诺
    for pattern in PRICE_PATTERNS:
        if re.search(pattern, content):
            issues.append(f'包含价格承诺: {pattern}')

    return len(issues) == 0, issues


def _sanitize_reply(content: str, forbidden_words: list) -> str:
    """
    清理 AI 回复中的不合规内容

    将禁用词替换为 *
    """
    sanitized = content
    if forbidden_words:
        for word in forbidden_words:
            if word and word in sanitized:
                sanitized = sanitized.replace(word, '*' * len(word))

    for word in FORBIDDEN_ABSOLUTE_WORDS:
        if word in sanitized:
            sanitized = sanitized.replace(word, '*' * len(word))

    return sanitized


def _strip_ai_artifacts(content: str) -> str:
    """
    硬过滤：移除 LLM 回复中可能泄露 AI 身份的内容

    LLM 不总是遵守 prompt 指令，此函数作为最后防线，确保：
    1. 模型名前缀（[DeepSeek-V3]、[GPT-4] 等）
    2. AI 元文本（"已分析您的诉求"、"基于当前数据" 等）
    3. AI 免责声明（"以上仅供参考" 等）
    4. 思考过程泄露（"让我来分析"、"建议如下" 等）
    5. markdown 格式残留

    均不会出现在发送给好友的消息中。
    """
    if not content or not content.strip():
        return content

    text = content

    # ── 1. 移除模型名前缀：[DeepSeek-V3]、[GPT-4]、[Claude] 等 ──
    text = re.sub(r'^\s*\[[A-Za-z0-9\-_.]+\]\s*', '', text)

    # ── 2. 移除 AI 元文本前缀（常见 LLM 开场白）──
    ai_prefix_patterns = [
        r'^已分析.{0,10}诉求[：:]\s*',
        r'^基于.{0,10}数据[，,]?\s*这是.{0,10}建议.{0,10}[。.]?\s*',
        r'^基于.{0,10}数据[，,]\s*',
        r'^根据.{0,10}分析[，,]\s*',
        r'^我来帮您?.{0,6}分析[：:]\s*',
        r'^为您?.{0,6}分析[：:]\s*',
        r'^作为.{0,6}AI[，,]\s*',
        r'^我是.{0,6}AI[，,]\s*',
        r'^作为一个AI[，,]\s*',
        r'^以下是.{0,10}建议[：:]\s*',
        r'^这是.{0,10}建议.{0,10}[。.]?\s*',
        r'^建议如下[：:]\s*',
        r'^分析如下[：:]\s*',
        r'^回复如下[：:]\s*',
        r'^我的.{0,6}建议是[：:]\s*',
        r'^让(我|咱).{0,10}[看看来]\s*',
    ]
    for pattern in ai_prefix_patterns:
        text = re.sub(pattern, '', text)

    # ── 3. 移除 AI 免责声明后缀 ──
    ai_suffix_patterns = [
        r'[，,。.]?\s*以上(内容)?仅供参考[。.]?\s*$',
        r'[，,。.]?\s*以上建议仅供参考[。.]?\s*$',
        r'[，,。.]?\s*以上信息仅供参考[。.]?\s*$',
        r'[，,。.]?\s*仅供参考[。.]?\s*$',
        r'[，,。.]?\s*请注意[，,].{0,30}$',
        r'[，,。.]?\s*免责声明[：:].{0,50}$',
        r'[，,。.]?\s*以上.{0,10}不构成.{0,20}$',
        r'[，,。.]?\s*如有.{0,10}疑问.{0,20}咨询.{0,20}$',
        r'[，,。.]?\s*具体.{0,6}以.{0,10}为准[。.]?\s*$',
    ]
    for pattern in ai_suffix_patterns:
        text = re.sub(pattern, '', text)

    # ── 4. 移除思考过程泄露 ──
    thinking_patterns = [
        r'让我来.{0,15}[分析想想看看]\s*',
        r'我认为[，,]\s*',
        r'我觉?得[，,]\s*',
        r'我注意到[，,]\s*',
        r'我了解到[，,]\s*',
        r'我理解[，,]\s*',
        r'根据我的.{0,6}分析[，,]\s*',
        r'从我的.{0,6}角度[，,]\s*',
    ]
    for pattern in thinking_patterns:
        text = re.sub(pattern, '', text)

    # ── 5. 移除 markdown 格式残留 ──
    # 移除 **加粗** 标记
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    # 移除 # 标题标记
    text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
    # 移除 - 列表标记（行首）
    text = re.sub(r'^\s*[-\u2022]\s*', '', text, flags=re.MULTILINE)
    # 移除 `代码` 标记
    text = re.sub(r'`(.+?)`', r'\1', text)

    # ── 6. 清理多余空行和首尾空白 ──
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()

    return text


# ============================================================
# 6. 模仿真人分段发送
# ============================================================

def _split_to_segments(content: str, chat_setting: ChatSetting,
                       contact: WecomContact) -> list:
    """
    将 AI 回复内容拆分为多条消息（模仿真人分段发送）

    拆分规则：
    1. 如果 AI 已经用换行分隔了多条消息，尊重原始分段
    2. 对每段按标点符号进一步拆分，使每条 ≤ 30 字
    3. 确保每段都是完整的语义单元（不截断在标点中间）

    Returns:
        ['第一条消息', '第二条消息', ...]
    """
    content = content.strip()
    if not content:
        return []

    # Step 1: 按换行符分段（AI 可能已经分好了）
    raw_segments = [s.strip() for s in content.split('\n') if s.strip()]

    # Step 2: 对过长的段落按标点进一步拆分
    final_segments = []
    for seg in raw_segments:
        if len(seg) <= MAX_SEGMENT_LENGTH:
            final_segments.append(seg)
        else:
            # 按标点拆分
            sub_segs = _split_by_punctuation(seg)
            final_segments.extend(sub_segs)

    # Step 3: 合并过短的段落（< 5字的与前一条合并）
    merged = []
    for seg in final_segments:
        if merged and len(seg) < 5:
            merged[-1] = merged[-1] + seg
        else:
            merged.append(seg)

    # 限制最多 4 条消息（防止刷屏）
    if len(merged) > 4:
        # 合并最后几条
        while len(merged) > 4:
            merged[-2] = merged[-2] + merged[-1]
            merged.pop()

    return merged


def _split_by_punctuation(text: str) -> list:
    """
    按标点符号拆分长文本，使每段尽量 ≤ MAX_SEGMENT_LENGTH

    策略：用正则提取「文本+标点」的原子单元，然后贪心累积到接近上限再切分。
    """
    # 提取所有「文本片段 + 结尾标点」的原子单元
    # 匹配模式：非标点字符 + 可选的一个标点
    pattern = r'[^。！？；，,.!?;\n]+[。！？；，,.!?;]?'
    atoms = re.findall(pattern, text)
    atoms = [a.strip() for a in atoms if a.strip()]

    if not atoms:
        return [text] if text.strip() else []

    result = []
    current = ''

    for atom in atoms:
        # 如果当前累积为空，直接加入
        if not current:
            current = atom
        # 如果加入后不超过上限，累积
        elif len(current) + len(atom) <= MAX_SEGMENT_LENGTH:
            current += atom
        # 否则，先保存当前累积，开始新的一段
        else:
            result.append(current)
            current = atom

    # 最后一段
    if current:
        result.append(current)

    # 硬截断：如果某段仍然超长（极端情况），按长度切
    final = []
    for seg in result:
        while len(seg) > MAX_SEGMENT_LENGTH:
            final.append(seg[:MAX_SEGMENT_LENGTH])
            seg = seg[MAX_SEGMENT_LENGTH:]
        if seg:
            final.append(seg)

    return final if final else [text]


def _send_segments(device: WecomDevice, contact: WecomContact,
                   segments: list, tenant: Tenant,
                   chat_setting: ChatSetting = None):
    """
    逐条发送消息，模拟真人节奏

    - 每条间隔按 chat_setting.reply_delay_min/max 随机（默认 1-3 秒）
    - 发送后持久化 WecomMessage(direction=outbound, ai_generated=True)
    """
    client = get_qiwei_client(device)

    delay_min = chat_setting.reply_delay_min if chat_setting else SEND_INTERVAL_MIN
    delay_max = chat_setting.reply_delay_max if chat_setting else SEND_INTERVAL_MAX
    # 确保 min <= max
    if delay_min > delay_max:
        delay_min, delay_max = delay_max, delay_min

    for i, seg in enumerate(segments):
        # 发送前等待（第一条立即发）
        if i > 0:
            delay = random.uniform(delay_min, delay_max)
            time.sleep(delay)

        try:
            response = client.send_text(
                to_id=contact.external_userid,
                content=seg,
                guid=device.guid,
            )

            # 捕获 QiWe 返回的消息标识
            msg_server_id = response.get('msgServerId') or response.get('msgserverid')
            msg_unique_id = response.get('msgUniqueIdentifier') or response.get('msguniqueidentifier') or ''

            # 持久化发出的消息
            ai_msg = WecomMessage.objects.create(
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

            # 通过 SSE 推送 AI 回复消息到前端
            try:
                from apps.wecom import sse as sse_module
                sse_module.publish_message_event(ai_msg)
            except Exception:
                pass

            logger.debug(f'Sent segment {i+1}/{len(segments)}: {seg[:30]}')

        except QiWeiAPIError as e:
            logger.error(f'Send text failed (segment {i+1}): {e.message}')
            # 发送失败不中断后续段落
            raise


# ============================================================
# 7. 积分扣减
# ============================================================

def _deduct_credits(tenant: Tenant, agent_id: str, tokens: int) -> dict:
    """
    扣减积分

    复用 credit_service.deduct_credits()，传入租户管理员用户
    """
    try:
        from apps.platform.credit_service import deduct_credits
        from apps.platform.models import TenantUser
        from django.contrib.auth import get_user_model
        User = get_user_model()

        # 找到租户的管理员用户（用于积分扣减）
        admin_membership = TenantUser.objects.filter(
            tenant=tenant,
            role__in=['admin', 'owner'],
        ).select_related('user').first()

        if not admin_membership:
            # 退而求其次：取租户下任意用户
            admin_membership = TenantUser.objects.filter(
                tenant=tenant,
            ).select_related('user').first()

        if not admin_membership:
            logger.warning(f'No user found for tenant {tenant.id} to deduct credits')
            return {'deducted': 0, 'reason': 'no_user'}

        user = admin_membership.user

        # 使用 agent_id 或默认 'wecom_chat'
        effective_agent_code = agent_id or 'wecom_chat'
        agent_name = '企微AI回复'

        result = deduct_credits(
            tenant=tenant,
            user=user,
            agent_code=effective_agent_code,
            agent_name=agent_name,
            tokens_consumed=tokens,
        )

        logger.info(
            f'Credit deducted: tenant={tenant.id}, user={user.username}, '
            f'tokens={tokens}, deducted={result.get("deducted", 0)}'
        )
        return result

    except Exception as e:
        logger.error(f'Credit deduction failed: {e}')
        return {'deducted': 0, 'error': str(e)}


# ============================================================
# 辅助
# ============================================================

def _create_skipped_task(msg: WecomMessage, reason: str):
    """创建被跳过的 AiReplyTask 记录"""
    AiReplyTask.objects.create(
        tenant=msg.tenant,
        device=msg.device,
        contact=msg.contact,
        inbound_message=msg,
        status='skipped',
        error=reason,
    )


# ============================================================
# 8. 非文本消息处理
# ============================================================

def _handle_non_text_message(msg: WecomMessage, chat_setting: ChatSetting,
                             device: WecomDevice, contact: WecomContact,
                             tenant: Tenant):
    """
    处理非文本消息（图片/语音/视频/文件/表情等）

    根据 chat_setting.non_text_reply_strategy 决定：
    - ignore: 不回复
    - reply_text: 回复固定文字
    - reply_template: 回复话术模板

    Returns:
        None: 继续正常 LLM 回复流程（策略未配置或回退）
        str: 已处理，主流程应停止
    """
    strategy = chat_setting.non_text_reply_strategy
    reply_content = chat_setting.non_text_reply_content or ''

    if strategy == 'ignore':
        logger.info(f'Non-text message ignored: type={msg.msg_type}, contact={contact}')
        _create_skipped_task(msg, f'非文本消息策略: 不回复 ({msg.msg_type})')
        return 'ignored'

    if strategy == 'reply_text' and reply_content:
        task = AiReplyTask.objects.create(
            tenant=tenant, device=device, contact=contact,
            inbound_message=msg, status='processing',
        )
        try:
            segments = _split_to_segments(reply_content, chat_setting, contact)
            task.ai_content = reply_content
            task.ai_segments = segments
            task.save(update_fields=['ai_content', 'ai_segments'])

            _send_segments(device, contact, segments, tenant, chat_setting)

            task.status = 'sent'
            task.sent_at = timezone.now()
            task.save(update_fields=['status', 'sent_at'])
            contact.last_contacted_at = timezone.now()
            contact.save(update_fields=['last_contacted_at'])
            logger.info(f'Non-text reply_text sent: contact={contact}')
        except Exception as e:
            logger.error(f'Non-text reply_text failed: {e}')
            task.status = 'failed'
            task.error = str(e)[:500]
            task.save(update_fields=['status', 'error'])
        return 'replied'

    if strategy == 'reply_template' and reply_content:
        # 从 quick_replies 中查找匹配的话术模板
        template_reply = ''
        if chat_setting.quick_replies:
            for qr in chat_setting.quick_replies:
                if isinstance(qr, dict):
                    if qr.get('keyword', '') == reply_content or qr.get('name', '') == reply_content:
                        template_reply = qr.get('reply', '')
                        break
                elif isinstance(qr, str) and qr == reply_content:
                    template_reply = qr
                    break

        if template_reply:
            task = AiReplyTask.objects.create(
                tenant=tenant, device=device, contact=contact,
                inbound_message=msg, status='processing',
            )
            try:
                segments = _split_to_segments(template_reply, chat_setting, contact)
                task.ai_content = template_reply
                task.ai_segments = segments
                task.save(update_fields=['ai_content', 'ai_segments'])

                _send_segments(device, contact, segments, tenant, chat_setting)

                task.status = 'sent'
                task.sent_at = timezone.now()
                task.save(update_fields=['status', 'sent_at'])
                contact.last_contacted_at = timezone.now()
                contact.save(update_fields=['last_contacted_at'])
                logger.info(f'Non-text reply_template sent: contact={contact}')
            except Exception as e:
                logger.error(f'Non-text reply_template failed: {e}')
                task.status = 'failed'
                task.error = str(e)[:500]
                task.save(update_fields=['status', 'error'])
            return 'replied'
        else:
            logger.warning(f'Template not found: {reply_content}, falling back to LLM')
            _create_skipped_task(msg, f'话术模板未找到: {reply_content}')
            return 'template_not_found'

    # 策略为 reply_text 但未配置内容 → 继续正常 LLM 流程
    return None


# ============================================================
# 9. 群聊回复模式检查
# ============================================================

def _check_group_reply_mode(msg: WecomMessage, chat_setting: ChatSetting,
                            device: WecomDevice):
    """
    检查群聊回复模式

    Returns:
        (allowed: bool, reason: str)
    """
    room_id = getattr(msg, 'room_id', None) or ''
    mode = chat_setting.group_reply_mode

    # 模式：所有群消息都回复
    if mode == 'all':
        # 如果开启了固定回复时间，需检查时间段和群列表
        if chat_setting.group_fixed_reply_enabled:
            if not _check_fixed_reply_time(chat_setting):
                return False, '群聊固定回复时间外'
            if chat_setting.group_fixed_reply_rooms:
                if room_id not in chat_setting.group_fixed_reply_rooms:
                    return False, '当前群不在固定回复列表中'
        return True, 'group mode: all'

    # 模式：仅@我时回复
    if mode == 'at_only':
        if _is_at_me(msg, device):
            return True, 'group mode: at_me'
        return False, '群聊模式为仅@我时回复（未@我）'

    # 模式：@我或白名单群回复
    if mode == 'at_and_whitelist':
        if _is_at_me(msg, device):
            return True, 'group mode: at_me'
        whitelist = chat_setting.group_no_at_whitelist or []
        if room_id and room_id in whitelist:
            return True, 'group mode: whitelist'
        return False, '群聊模式为@我或白名单群回复（未@且不在白名单）'

    # 默认：不允许
    return False, f'未知群聊回复模式: {mode}'


def _check_fixed_reply_time(chat_setting: ChatSetting) -> bool:
    """检查当前是否在群聊固定回复时间段内"""
    if not chat_setting.group_fixed_reply_start or not chat_setting.group_fixed_reply_end:
        return True  # 未设置时间，默认允许

    now = timezone.now()
    if timezone.is_aware(now):
        local_now = timezone.localtime(now, timezone.get_default_timezone())
    else:
        local_now = now

    current_time = local_now.time()
    return chat_setting.group_fixed_reply_start <= current_time <= chat_setting.group_fixed_reply_end


def _is_at_me(msg: WecomMessage, device: WecomDevice) -> bool:
    """检查群消息中是否@了本设备"""
    content = msg.content or ''
    if not content:
        return False

    device_name = getattr(device, 'name', '') or ''
    device_wxid = getattr(device, 'external_userid', '') or ''

    if device_name and f'@{device_name}' in content:
        return True
    if device_wxid and f'@{device_wxid}' in content:
        return True

    return False
