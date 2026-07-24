"""
模型网关增强 API —— 密钥池/Token统计/路由策略/熔断器/限流器
"""

import random
from django.http import HttpRequest
from django.utils import timezone
from django.db.models import Sum, Count, Q
from datetime import timedelta
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.platform.models import Tenant
from apps.platform.utils import api_success, api_error, API_CODE
from .models import AIModel
from .models_ext import ModelKey, TokenUsage, RoutingStrategy, CircuitBreakerState
from .serializers_ext import (
    ModelKeySerializer, ModelKeyCreateSerializer,
    TokenUsageSerializer, RoutingStrategySerializer,
    CircuitBreakerStateSerializer,
)
from .services import CircuitBreaker, RateLimiter, KeyPool
from .providers import get_provider


def _get_tenant(request: HttpRequest):
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return Tenant.objects.first()


# ===== 密钥池管理 =====

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def model_keys_view(request: HttpRequest):
    """GET|POST /api/v1/models/keys — 密钥列表/添加"""
    if request.method == 'GET':
        model_id = request.GET.get('model_id', '')
        if model_id:
            keys = ModelKey.objects.filter(model_id=model_id).order_by('priority')
        else:
            keys = ModelKey.objects.all().order_by('priority')
        data = ModelKeySerializer(keys, many=True).data
        return api_success(data)

    # POST — 添加密钥
    serializer = ModelKeyCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    model_id = serializer.validated_data.get('model')
    try:
        model = AIModel.objects.get(id=model_id)
    except AIModel.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='模型不存在')

    key = serializer.save()
    return api_success(ModelKeySerializer(key).data, msg='密钥已添加')


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def model_key_detail(request: HttpRequest, key_id: str):
    """PUT|DELETE /api/v1/models/keys/<id>"""
    try:
        key = ModelKey.objects.get(id=key_id)
    except ModelKey.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='密钥不存在')

    if request.method == 'DELETE':
        key.delete()
        return api_success(msg='密钥已删除')

    # PUT
    allowed = ['key_alias', 'api_key', 'endpoint', 'status', 'priority', 'daily_quota']
    for field in allowed:
        if field in request.data:
            setattr(key, field, request.data[field])
    key.save()
    return api_success(ModelKeySerializer(key).data, msg='密钥已更新')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def model_key_reset_quota(request: HttpRequest):
    """POST /api/v1/models/keys/reset-quota — 重置所有密钥每日配额"""
    ModelKey.objects.all().update(daily_used=0)
    return api_success(msg='所有密钥每日配额已重置')


# ===== Token 用量统计 =====

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def token_usage_stats(request: HttpRequest):
    """GET /api/v1/models/token-usage — Token用量统计"""
    tenant = _get_tenant(request)

    # 总量统计
    queryset = TokenUsage.objects.all()
    if tenant:
        queryset = queryset.filter(tenant=tenant)

    total = queryset.count()
    total_tokens = queryset.aggregate(total=Sum('total_tokens'))['total'] or 0
    total_cost = queryset.aggregate(total=Sum('cost'))['total'] or 0
    success_count = queryset.filter(status='success').count()
    failed_count = queryset.filter(status__in=['failed', 'timeout', 'circuit_open']).count()

    # 按模型统计
    by_model = queryset.values('model__name').annotate(
        total_tokens=Sum('total_tokens'),
        total_calls=Count('id'),
        total_cost=Sum('cost'),
    ).order_by('-total_tokens')

    # 按智能体统计
    by_agent = queryset.values('agent_code').annotate(
        total_tokens=Sum('total_tokens'),
        total_calls=Count('id'),
        total_cost=Sum('cost'),
    ).order_by('-total_tokens')

    # 按状态统计
    by_status = queryset.values('status').annotate(count=Count('id'))
    status_stats = {item['status']: item['count'] for item in by_status}

    # 最近7天趋势
    today = timezone.now().date()
    daily_trend = []
    for i in range(7):
        day = today - timedelta(days=i)
        day_qs = queryset.filter(created_at__date=day)
        daily_trend.append({
            'date': day.isoformat(),
            'tokens': day_qs.aggregate(t=Sum('total_tokens'))['t'] or 0,
            'calls': day_qs.count(),
            'cost': day_qs.aggregate(c=Sum('cost'))['c'] or 0,
        })
    daily_trend.reverse()

    # 最近记录
    recent = queryset.order_by('-created_at')[:20]
    recent_data = TokenUsageSerializer(recent, many=True).data

    # 返回格式对齐前端 TokenUsageStats 接口
    return api_success({
        'total_tokens': total_tokens,
        'total_cost': round(total_cost, 2),
        'by_model': [
            {
                'model_name': item.get('model__name', '') or '',
                'tokens': item.get('total_tokens', 0) or 0,
                'cost': round(item.get('total_cost', 0) or 0, 2),
            }
            for item in by_model
        ],
        'by_agent': [
            {
                'agent_code': item.get('agent_code', '') or '',
                'tokens': item.get('total_tokens', 0) or 0,
                'cost': round(item.get('total_cost', 0) or 0, 2),
            }
            for item in by_agent
        ],
        'trend': [
            {
                'date': item['date'],
                'tokens': item['tokens'],
            }
            for item in daily_trend
        ],
    })


# ===== 路由策略 =====

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def routing_strategy_view(request: HttpRequest):
    """GET|POST /api/v1/models/routing — 路由策略列表/创建"""
    tenant = _get_tenant(request)

    if request.method == 'GET':
        qs = RoutingStrategy.objects.all()
        if tenant:
            qs = qs.filter(tenant=tenant)
        strategies = qs.order_by('-created_at')
        data = RoutingStrategySerializer(strategies, many=True).data
        return api_success(data)

    # POST
    serializer = RoutingStrategySerializer(data=request.data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    strategy = serializer.save(tenant=tenant)
    return api_success(RoutingStrategySerializer(strategy).data, msg='路由策略已创建')


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def routing_strategy_detail(request: HttpRequest, strategy_id: str):
    """PUT|DELETE /api/v1/models/routing/<id>"""
    try:
        strategy = RoutingStrategy.objects.get(id=strategy_id)
    except RoutingStrategy.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='路由策略不存在')

    if request.method == 'DELETE':
        strategy.delete()
        return api_success(msg='路由策略已删除')

    # PUT
    allowed = ['name', 'agent_code', 'primary_model', 'fallback_model',
               'strategy_type', 'weight_config', 'enabled']
    for field in allowed:
        if field in request.data:
            setattr(strategy, field, request.data[field])
    strategy.save()
    return api_success(RoutingStrategySerializer(strategy).data, msg='路由策略已更新')


# ===== 熔断器 =====

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def circuit_breaker_list(request: HttpRequest):
    """GET /api/v1/models/circuit-breakers — 所有熔断器状态（返回直接数组）"""
    models = AIModel.objects.all()
    result = []
    for model in models:
        cb = CircuitBreaker(model)
        status = cb.get_status()
        status['id'] = cb.state_obj.id
        result.append(status)
    return api_success(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def circuit_breaker_reset(request: HttpRequest):
    """POST /api/v1/models/circuit-breakers/reset — 重置熔断器"""
    model_id = request.data.get('model_id', '')
    if not model_id:
        return api_error(code=API_CODE.BAD_REQUEST, msg='缺少 model_id')

    try:
        model = AIModel.objects.get(id=model_id)
    except AIModel.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='模型不存在')

    cb = CircuitBreaker(model)
    cb.reset()
    return api_success(cb.get_status(), msg=f'{model.name} 熔断器已重置')


# ===== 限流器 =====

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def rate_limiter_status(request: HttpRequest):
    """GET /api/v1/models/rate-limiter — 限流器状态"""
    tenant = _get_tenant(request)
    user = request.user

    # 按租户+用户维度限流
    key = f'{tenant.id if tenant else "default"}:{user.id}'
    limiter = RateLimiter(key=key, max_requests=60, window_seconds=60)

    return api_success(limiter.get_status())


# ===== 模型调用（集成 Provider + CircuitBreaker + KeyPool） =====

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def model_call(request: HttpRequest):
    """
    POST /api/v1/models/call — 通过网关调用模型
    集成：密钥池选择 → 熔断检查 → Provider调用 → Token统计
    """
    tenant = _get_tenant(request)

    model_id = request.data.get('model_id', '')
    messages = request.data.get('messages', [])
    agent_code = request.data.get('agent_code', '')
    conversation_id = request.data.get('conversation_id', '')

    if not model_id:
        return api_error(code=API_CODE.BAD_REQUEST, msg='缺少 model_id')
    if not messages:
        return api_error(code=API_CODE.BAD_REQUEST, msg='缺少 messages')

    try:
        model = AIModel.objects.get(id=model_id)
    except AIModel.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='模型不存在')

    # 1. 熔断器检查
    cb = CircuitBreaker(model)
    if not cb.can_request():
        # 记录熔断状态
        TokenUsage.objects.create(
            tenant=tenant,
            model=model,
            user=request.user,
            agent_code=agent_code,
            conversation_id=conversation_id,
            status='circuit_open',
            error_msg='熔断器处于打开状态',
        )
        return api_error(code=API_CODE.FORBIDDEN, msg=f'模型 {model.name} 熔断中，请稍后重试或切换备用模型')

    # 2. 密钥池选择
    pool = KeyPool(model)
    key = pool.get_available_key()
    if not key:
        cb.record_failure('无可用密钥')
        return api_error(msg=f'模型 {model.name} 无可用密钥')

    # 3. Provider 调用
    provider = get_provider(model)
    if not provider:
        return api_error(msg=f'模型 {model.name} 无可用 Provider')

    try:
        response = provider.call(messages)

        if response.success:
            # 记录成功
            cb.record_success()
            pool.record_usage(key.id, response.total_tokens)

            # 记录 Token 用量
            cost = response.total_tokens * 0.0001  # 简单费用估算
            TokenUsage.objects.create(
                tenant=tenant,
                model=model,
                user=request.user,
                agent_code=agent_code,
                conversation_id=conversation_id,
                prompt_tokens=response.prompt_tokens,
                completion_tokens=response.completion_tokens,
                total_tokens=response.total_tokens,
                cost=cost,
                latency_ms=response.latency_ms,
                status='success',
            )

            return api_success({
                'content': response.content,
                'model': response.model_name,
                'tokens': {
                    'prompt': response.prompt_tokens,
                    'completion': response.completion_tokens,
                    'total': response.total_tokens,
                },
                'latency_ms': response.latency_ms,
                'cost': round(cost, 4),
                'key_used': key.key_alias,
            })
        else:
            cb.record_failure(response.error)
            pool.record_error(key.id, response.error)

            TokenUsage.objects.create(
                tenant=tenant,
                model=model,
                user=request.user,
                agent_code=agent_code,
                conversation_id=conversation_id,
                status='failed',
                error_msg=response.error,
            )

            return api_error(msg=f'模型调用失败: {response.error}')

    except Exception as e:
        error_msg = str(e)
        cb.record_failure(error_msg)
        pool.record_error(key.id, error_msg)

        TokenUsage.objects.create(
            tenant=tenant,
            model=model,
            user=request.user,
            agent_code=agent_code,
            conversation_id=conversation_id,
            status='failed',
            error_msg=error_msg,
        )

        return api_error(msg=f'模型调用异常: {error_msg}')
