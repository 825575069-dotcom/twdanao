"""
记忆引擎异步任务
- 异步生成对话摘要
- 定时清理过期记忆
- 批量提取关键事实
"""

from celery import shared_task
from django.utils import timezone
from datetime import timedelta


@shared_task(queue='memory', max_retries=3, default_retry_delay=60)
def async_generate_summary(conversation_id: int):
    """
    异步生成对话摘要。
    由 chat 模块在消息数达到阈值时触发，
    避免阻塞用户请求。
    """
    from apps.memory_engine.services import generate_summary as _gen
    from apps.memory_engine.models import MemoryConfig

    try:
        _gen(conversation_id)
    except Exception as exc:
        raise async_generate_summary.retry(exc=exc)


@shared_task(queue='memory')
def cleanup_expired_memories():
    """
    定时清理过期记忆（保留期限可配置）。
    建议通过 Celery Beat 每天凌晨执行。
    """
    from apps.memory_engine.models import MemorySummary, MemoryFact, MemoryConfig
    from apps.platform.models import Tenant

    for tenant in Tenant.objects.filter(status='active'):
        config = MemoryConfig.objects.filter(tenant=tenant).first()
        retention_days = config.retention_days if config else 365
        cutoff = timezone.now() - timedelta(days=retention_days)

        # 清理过期摘要
        expired_summaries = MemorySummary.objects.filter(
            tenant=tenant, created_at__lt=cutoff
        )
        count = expired_summaries.count()
        expired_summaries.delete()

        # 清理低频事实（未被召回超过 180 天）
        fact_cutoff = timezone.now() - timedelta(days=180)
        stale_facts = MemoryFact.objects.filter(
            tenant=tenant,
            last_recalled_at__lt=fact_cutoff,
            times_recalled__lte=1,
        )
        fact_count = stale_facts.count()
        stale_facts.delete()

        if count > 0 or fact_count > 0:
            print(f'[{tenant.code}] 清理完成：摘要 {count}，事实 {fact_count}')

    return f'清理完成 @ {timezone.now().isoformat()}'


@shared_task(queue='memory')
def extract_key_facts_from_conversation(conversation_id: int):
    """
    从对话中批量提取关键事实。
    调用 LLM 分析对话内容，提取结构化事实存入 MemoryFact。
    TODO: 接入真实 LLM 后替换为实际 NLP 提取逻辑。
    """
    from apps.memory_engine.models import MemoryFact
    from apps.chat.models import Conversation, Message
    from apps.memory_engine.services import extract_keywords

    try:
        conversation = Conversation.objects.get(id=conversation_id)
        messages = Message.objects.filter(conversation=conversation).order_by('created_at')
        
        full_text = ' '.join([m.content for m in messages if m.content])
        keywords = extract_keywords(full_text)

        # Mock 事实提取（TODO: 接入真实 LLM）
        facts_created = 0
        for kw in keywords[:5]:
            MemoryFact.objects.get_or_create(
                tenant=conversation.tenant,
                key=kw,
                defaults={
                    'value': f'来自对话 #{conversation_id} 的关键词: {kw}',
                    'category': 'extracted',
                    'confidence': 0.6,
                }
            )
            facts_created += 1

        return f'提取完成：{facts_created} 条事实'
    except Conversation.DoesNotExist:
        return f'对话 #{conversation_id} 不存在'
