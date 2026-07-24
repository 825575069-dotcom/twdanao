"""
记忆引擎核心服务 —— 记忆召回 + 摘要生成 + 关键事实提取
不依赖外部 LLM，使用本地规则+模板实现，后续可替换为真实 LLM 调用
"""

import re
from datetime import timedelta
from django.db import models
from django.utils import timezone
from django.db.models import Q

from apps.platform.models import Tenant
from apps.chat.models import Conversation, Message
from .models import MemoryConfig, MemorySummary, MemoryFact, MemoryRecallLog


def get_or_create_config(tenant: Tenant) -> MemoryConfig:
    """获取或创建租户记忆配置"""
    config, _ = MemoryConfig.objects.get_or_create(tenant=tenant)
    return config


def recall_short_term(conversation: Conversation, window: int = 20) -> list:
    """
    第一层记忆：短期记忆 —— 取最近N条消息
    返回消息列表，用于构造上下文
    """
    messages = conversation.messages.order_by('-created_at')[:window]
    # 反转为时间正序
    msgs = list(reversed(messages))
    return [{
        'role': m.role,
        'content': m.content,
        'agent_code': m.agent_code,
        'agent_name': m.agent_name,
        'time': m.created_at.isoformat(),
    } for m in msgs]


def recall_summaries(tenant: Tenant, query: str, limit: int = 5) -> list:
    """
    第二层记忆：长期记忆 —— 按关键词匹配召回历史摘要
    """
    if not query:
        return []

    # 简单关键词匹配：按标题和内容搜索
    keywords = extract_keywords(query)
    if not keywords:
        # 如果无法提取关键词，返回最近的摘要
        summaries = MemorySummary.objects.filter(
            tenant=tenant,
            status='active'
        ).order_by('-created_at')[:limit]
    else:
        # 构建Q对象进行多关键词OR搜索
        q = Q()
        for kw in keywords:
            q |= Q(title__icontains=kw) | Q(content__icontains=kw) | Q(keywords__contains=[kw])
        summaries = MemorySummary.objects.filter(
            tenant=tenant,
            status='active'
        ).filter(q).order_by('-created_at')[:limit]

    return [{
        'id': str(s.id),
        'date': s.summary_date.isoformat(),
        'title': s.title,
        'content': s.content,
        'keywords': s.keywords,
        'key_facts': s.key_facts,
        'agent_codes': s.agent_codes,
        'message_count': s.message_count,
    } for s in summaries]


def recall_facts(tenant: Tenant, query: str, limit: int = 10) -> list:
    """
    第二层记忆：长期记忆 —— 按关键词匹配召回关键事实
    """
    if not query:
        # 返回最近被召回的事实（热度排序）
        facts = MemoryFact.objects.filter(
            tenant=tenant
        ).order_by('-times_recalled', '-updated_at')[:limit]
    else:
        keywords = extract_keywords(query)
        q = Q()
        for kw in keywords:
            q |= Q(key__icontains=kw) | Q(value__icontains=kw)
        facts = MemoryFact.objects.filter(tenant=tenant).filter(q).order_by('-times_recalled', '-updated_at')[:limit]

    return [{
        'id': str(f.id),
        'category': f.category,
        'key': f.key,
        'value': f.value,
        'confidence': f.confidence,
        'times_recalled': f.times_recalled,
    } for f in facts]


def extract_keywords(text: str) -> list:
    """从文本中提取关键词（简单分词+过滤停用词）"""
    if not text:
        return []
    # 中文关键词：按标点和空格分词，取长度>=2的
    stop_words = {'的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那'}
    # 按非中文/非字母数字分割
    words = re.split(r'[^\u4e00-\u9fa5a-zA-Z0-9]+', text)
    keywords = [w for w in words if len(w) >= 2 and w not in stop_words]
    # 额外：对连续中文字符串，每3-4个字符切一次作为子关键词
    for w in words:
        if len(w) >= 6 and re.match(r'^[\u4e00-\u9fa5]+$', w):
            for i in range(0, len(w) - 3, 2):
                sub = w[i:i+4]
                if sub not in keywords:
                    keywords.append(sub)
    return keywords[:15]  # 限制数量


def build_memory_context(tenant: Tenant, conversation: Conversation, query: str) -> dict:
    """
    构建完整的记忆上下文 —— 混合召回策略
    返回: {
        short_term: [...],     # 短期消息
        summaries: [...],      # 召回的摘要
        facts: [...],          # 召回的事实
        total_tokens: int,     # 估算token数
        strategy: str,         # 使用的策略
    }
    """
    config = get_or_create_config(tenant)
    if not config.enabled:
        return {
            'short_term': [],
            'summaries': [],
            'facts': [],
            'total_tokens': 0,
            'strategy': 'disabled',
        }

    # 第一层：短期记忆
    short_term = recall_short_term(conversation, config.short_term_window)

    # 第二层：长期记忆
    summaries = recall_summaries(tenant, query, limit=5)
    facts = recall_facts(tenant, query, limit=10)

    # 估算 token 数（粗略：1个中文字符≈1.5 token）
    all_text = ' '.join([
        ' '.join([m['content'] for m in short_term]),
        ' '.join([s['content'] for s in summaries]),
        ' '.join([f['value'] for f in facts]),
    ])
    estimated_tokens = int(len(all_text) * 1.5)

    # 记录召回日志
    MemoryRecallLog.objects.create(
        tenant=tenant,
        conversation=conversation,
        recalled_summaries=[s['id'] for s in summaries],
        recalled_facts=[f['id'] for f in facts],
        short_term_messages=len(short_term),
        total_tokens=estimated_tokens,
        recall_strategy='hybrid',
    )

    # 更新事实的召回次数
    fact_ids = [f['id'] for f in facts]
    if fact_ids:
        MemoryFact.objects.filter(id__in=fact_ids).update(
            times_recalled=models.F('times_recalled') + 1,
            last_recalled=timezone.now(),
        )

    return {
        'short_term': short_term,
        'summaries': summaries,
        'facts': facts,
        'total_tokens': estimated_tokens,
        'strategy': 'hybrid',
    }


def generate_summary(tenant: Tenant, conversation: Conversation) -> MemorySummary:
    """
    生成对话摘要 —— 从会话消息中提取关键信息
    当前使用模板规则，后续可替换为 LLM 调用
    """
    messages = conversation.messages.all().order_by('created_at')
    if not messages:
        return None

    config = get_or_create_config(tenant)
    today = timezone.now().date()

    # 提取消息文本
    user_messages = [m for m in messages if m.role == 'user']
    assistant_messages = [m for m in messages if m.role == 'assistant']

    # 提取关键词
    all_text = ' '.join([m.content for m in user_messages])
    keywords = extract_keywords(all_text)

    # 提取涉及的智能体
    agent_codes = list(set(m.agent_code for m in assistant_messages if m.agent_code))

    # 生成摘要内容（模板方式）
    summary_parts = []
    summary_parts.append(f'本会话共 {len(messages)} 条消息，用户提问 {len(user_messages)} 次。')
    if agent_codes:
        agent_names = {
            'procurement': '采购智能体',
            'operations': '运营智能体',
            'marketing': '跟客智能体',
            'distribution': '流向智能体',
            'academic': '学术智能体',
        }
        names = [agent_names.get(c, c) for c in agent_codes]
        summary_parts.append(f'涉及智能体：{", ".join(names)}。')

    # 列出用户主要关注点
    if user_messages:
        topics = [m.content[:50] for m in user_messages[:5]]
        summary_parts.append('主要话题：' + ' | '.join(topics))

    # 提取关键事实
    key_facts = []
    for m in assistant_messages:
        meta = m.metadata or {}
        result = meta.get('result', {})
        if 'schemes' in result:
            for s in result['schemes']:
                key_facts.append({
                    'type': 'procurement_scheme',
                    'supplier': s.get('supplier', ''),
                    'price': s.get('price', 0),
                    'label': s.get('label', ''),
                })
        if 'followUps' in result:
            for f in result['followUps']:
                key_facts.append({
                    'type': 'follow_up',
                    'customer': f.get('customer', ''),
                    'action': f.get('action', ''),
                    'priority': f.get('priority', ''),
                })
        if 'anomalies' in result:
            for a in result['anomalies']:
                key_facts.append({
                    'type': 'distribution_anomaly',
                    'product': a.get('product', ''),
                    'severity': a.get('severity', ''),
                })

    content = '\n'.join(summary_parts)
    title = user_messages[0].content[:50] if user_messages else '未命名会话'

    # 估算 token
    token_count = int(len(all_text) * 1.5)

    summary = MemorySummary.objects.create(
        tenant=tenant,
        conversation=conversation,
        user=conversation.user,
        summary_date=today,
        title=title,
        content=content,
        keywords=keywords[:20],
        key_facts=key_facts[:30],
        agent_codes=agent_codes,
        message_count=len(messages),
        token_count=token_count,
        status='active',
    )

    # 从摘要中提取关键事实存入 MemoryFact
    for fact_data in key_facts[:10]:
        fact_type = fact_data.pop('type', 'general')
        MemoryFact.objects.create(
            tenant=tenant,
            user=conversation.user,
            category='business' if fact_type != 'general' else 'general',
            key=f'{fact_type}_{conversation.id}',
            value=str(fact_data),
            confidence=0.85,
            source_conversation=conversation,
        )

    return summary


def check_and_summarize(tenant: Tenant, conversation: Conversation):
    """
    检查是否需要生成摘要（消息数达到阈值时触发）
    """
    config = get_or_create_config(tenant)
    if not config.auto_summary:
        return None

    # 检查消息数是否达到阈值
    if conversation.message_count >= config.summary_threshold:
        # 检查是否已经有该会话的摘要
        existing = MemorySummary.objects.filter(
            conversation=conversation,
            summary_date=timezone.now().date(),
        ).exists()
        if not existing:
            return generate_summary(tenant, conversation)
    return None


def cleanup_expired_memories(tenant: Tenant):
    """清理过期记忆"""
    config = get_or_create_config(tenant)
    cutoff = timezone.now() - timedelta(days=config.retention_days)

    # 过期摘要
    MemorySummary.objects.filter(
        tenant=tenant,
        created_at__lt=cutoff,
        status='active',
    ).update(status='expired')

    # 超出最大数量的旧摘要归档
    active_summaries = MemorySummary.objects.filter(
        tenant=tenant,
        status='active',
    ).order_by('-created_at')
    if active_summaries.count() > config.max_summaries:
        for s in active_summaries[config.max_summaries:]:
            s.status = 'archived'
            s.save()
