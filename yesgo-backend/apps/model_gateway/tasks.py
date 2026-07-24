"""
模型网关异步任务
- 异步模型调用（不阻塞 HTTP 响应）
- 每日配额重置
- 密钥健康检查
"""

from celery import shared_task
from django.utils import timezone


@shared_task(queue='model', max_retries=2, default_retry_delay=30)
def async_model_call(model_id: str, messages: list, agent_code: str = '', tenant_code: str = ''):
    """
    异步模型调用。用于长耗时场景（如批量报告生成）。
    同步调用请直接用 views_ext.py 的 model_call 端点。
    """
    from apps.model_gateway.providers import get_provider
    from apps.model_gateway.services import CircuitBreaker, KeyPool
    from apps.model_gateway.models_ext import TokenUsage

    try:
        cb = CircuitBreaker(model_id)
        if not cb.can_request():
            return {'error': f'模型 {model_id} 已熔断', 'state': 'open'}

        pool = KeyPool(model_id)
        key = pool.get_available_key()
        if not key:
            return {'error': f'模型 {model_id} 无可用密钥', 'state': 'no_key'}

        provider = get_provider(model_id)
        result = provider.call(messages)

        # 记录用量
        TokenUsage.objects.create(
            model_name=model_id,
            agent_code=agent_code,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            total_tokens=result.total_tokens,
            cost=result.cost,
            latency_ms=result.latency_ms,
            status='success',
        )

        return result.to_dict()

    except Exception as exc:
        # 记录失败
        TokenUsage.objects.create(
            model_name=model_id,
            agent_code=agent_code,
            status='failed',
        )
        raise async_model_call.retry(exc=exc)


@shared_task(queue='model')
def reset_daily_quotas():
    """
    每日凌晨重置所有密钥的日配额。
    通过 Celery Beat 调度。
    """
    from apps.model_gateway.models_ext import ModelKey
    
    count = ModelKey.objects.update(daily_used=0)
    return f'已重置 {count} 个密钥的日配额 @ {timezone.now().isoformat()}'


@shared_task(queue='model')
def health_check_keys():
    """
    定期健康检查所有活跃密钥。
    对连续错误 3 次以上的密钥自动禁用。
    """
    from apps.model_gateway.models_ext import ModelKey

    failed_keys = ModelKey.objects.filter(error_count__gte=3, status='active')
    count = failed_keys.update(status='disabled')
    
    if count > 0:
        names = list(failed_keys.values_list('key_alias', flat=True))
        print(f'自动禁用 {count} 个异常密钥: {names}')

    return f'健康检查完成：禁用 {count} 个异常密钥'
