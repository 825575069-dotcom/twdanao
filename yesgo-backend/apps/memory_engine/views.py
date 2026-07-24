"""
记忆引擎 API —— 记忆配置/摘要管理/召回日志/手动摘要生成
"""

from django.http import HttpRequest
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.platform.models import Tenant
from apps.platform.utils import api_success, api_error, API_CODE
from apps.chat.models import Conversation
from .models import MemoryConfig, MemorySummary, MemoryFact, MemoryRecallLog
from .serializers import (
    MemoryConfigSerializer,
    MemorySummarySerializer,
    MemoryFactSerializer,
    MemoryRecallLogSerializer,
)
from .services import (
    get_or_create_config,
    build_memory_context,
    generate_summary,
    cleanup_expired_memories,
)


def _get_tenant(request: HttpRequest):
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return Tenant.objects.first()


# ===== 记忆配置 =====

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def memory_config_view(request: HttpRequest):
    """GET|PUT /api/v1/memory/config — 记忆配置"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    config = get_or_create_config(tenant)

    if request.method == 'GET':
        data = MemoryConfigSerializer(config).data
        return api_success(data)

    # PUT
    allowed = ['enabled', 'short_term_window', 'summary_threshold',
               'retention_days', 'max_summaries', 'auto_summary']
    for key in allowed:
        if key in request.data:
            setattr(config, key, request.data[key])
    config.save()
    return api_success(MemoryConfigSerializer(config).data, msg='记忆配置已更新')


# ===== 摘要管理 =====

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def memory_summary_list(request: HttpRequest):
    """GET /api/v1/memory/summaries — 摘要列表"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    summaries = MemorySummary.objects.filter(tenant=tenant).order_by('-created_at')

    # 筛选
    status = request.GET.get('status', '')
    if status:
        summaries = summaries.filter(status=status)

    agent_code = request.GET.get('agent_code', '')
    if agent_code:
        summaries = summaries.filter(agent_codes__contains=[agent_code])

    keyword = request.GET.get('keyword', '')
    if keyword:
        summaries = summaries.filter(title__icontains=keyword)

    # 分页
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 20))
    total = summaries.count()
    items = summaries[(page - 1) * page_size: page * page_size]

    data = MemorySummarySerializer(items, many=True).data
    return api_success({'items': data, 'total': total, 'page': page, 'page_size': page_size})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def memory_summary_generate(request: HttpRequest):
    """POST /api/v1/memory/summaries/generate — 手动为指定会话生成摘要"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    conversation_id = request.data.get('conversation_id', '')
    if not conversation_id:
        return api_error(code=API_CODE.BAD_REQUEST, msg='缺少 conversation_id')

    try:
        conversation = Conversation.objects.get(id=conversation_id, tenant=tenant)
    except Conversation.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='会话不存在')

    summary = generate_summary(tenant, conversation)
    if not summary:
        return api_error(msg='会话无消息，无法生成摘要')

    return api_success(MemorySummarySerializer(summary).data, msg='摘要已生成')


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def memory_summary_delete(request: HttpRequest, summary_id: str):
    """DELETE /api/v1/memory/summaries/<id> — 删除摘要"""
    tenant = _get_tenant(request)
    try:
        summary = MemorySummary.objects.get(id=summary_id, tenant=tenant)
    except MemorySummary.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='摘要不存在')

    summary.delete()
    return api_success(msg='摘要已删除')


# ===== 关键事实 =====

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def memory_fact_list(request: HttpRequest):
    """GET /api/v1/memory/facts — 关键事实列表"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    facts = MemoryFact.objects.filter(tenant=tenant).order_by('-updated_at')

    category = request.GET.get('category', '')
    if category:
        facts = facts.filter(category=category)

    keyword = request.GET.get('keyword', '')
    if keyword:
        facts = facts.filter(key__icontains=keyword)

    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 20))
    total = facts.count()
    items = facts[(page - 1) * page_size: page * page_size]

    data = MemoryFactSerializer(items, many=True).data
    return api_success({'items': data, 'total': total, 'page': page, 'page_size': page_size})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def memory_fact_create(request: HttpRequest):
    """POST /api/v1/memory/facts — 手动添加关键事实"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    key = request.data.get('key', '')
    value = request.data.get('value', '')
    if not key or not value:
        return api_error(code=API_CODE.BAD_REQUEST, msg='key 和 value 不能为空')

    fact = MemoryFact.objects.create(
        tenant=tenant,
        user=request.user,
        category=request.data.get('category', 'general'),
        key=key,
        value=value,
        confidence=float(request.data.get('confidence', 0.9)),
    )
    return api_success(MemoryFactSerializer(fact).data, msg='关键事实已添加')


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def memory_fact_delete(request: HttpRequest, fact_id: str):
    """DELETE /api/v1/memory/facts/<id> — 删除关键事实"""
    tenant = _get_tenant(request)
    try:
        fact = MemoryFact.objects.get(id=fact_id, tenant=tenant)
    except MemoryFact.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='事实不存在')

    fact.delete()
    return api_success(msg='事实已删除')


# ===== 召回日志 =====

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def memory_recall_logs(request: HttpRequest):
    """GET /api/v1/memory/recall-logs — 召回日志"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    logs = MemoryRecallLog.objects.filter(tenant=tenant).order_by('-created_at')

    conversation_id = request.GET.get('conversation_id', '')
    if conversation_id:
        logs = logs.filter(conversation_id=conversation_id)

    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 20))
    total = logs.count()
    items = logs[(page - 1) * page_size: page * page_size]

    data = MemoryRecallLogSerializer(items, many=True).data
    return api_success({'items': data, 'total': total, 'page': page, 'page_size': page_size})


# ===== 记忆召回（供前端预览） =====

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def memory_recall(request: HttpRequest):
    """POST /api/v1/memory/recall — 手动触发记忆召回（预览）"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    query = request.data.get('query', '')
    conversation_id = request.data.get('conversation_id', '')

    if conversation_id:
        try:
            conversation = Conversation.objects.get(id=conversation_id, tenant=tenant)
        except Conversation.DoesNotExist:
            return api_error(code=API_CODE.NOT_FOUND, msg='会话不存在')
    else:
        # 创建临时会话用于召回
        conversation = Conversation.objects.create(
            tenant=tenant, user=request.user,
            title=f'召回预览: {query[:20]}', agent_code=''
        )

    context = build_memory_context(tenant, conversation, query)
    return api_success(context)


# ===== 记忆统计 =====

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def memory_stats(request: HttpRequest):
    """GET /api/v1/memory/stats — 记忆引擎统计"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({})

    config = get_or_create_config(tenant)
    total_summaries = MemorySummary.objects.filter(tenant=tenant).count()
    active_summaries = MemorySummary.objects.filter(tenant=tenant, status='active').count()
    total_facts = MemoryFact.objects.filter(tenant=tenant).count()
    total_recalls = MemoryRecallLog.objects.filter(tenant=tenant).count()

    # 最近7天召回趋势
    from django.utils import timezone
    from datetime import timedelta
    seven_days_ago = timezone.now() - timedelta(days=7)
    recent_recalls = MemoryRecallLog.objects.filter(
        tenant=tenant,
        created_at__gte=seven_days_ago
    ).count()

    # 按智能体统计事实
    agent_facts = {}
    for fact in MemoryFact.objects.filter(tenant=tenant):
        cat = fact.category
        agent_facts[cat] = agent_facts.get(cat, 0) + 1

    return api_success({
        'enabled': config.enabled,
        'total_summaries': total_summaries,
        'active_summaries': active_summaries,
        'archived_summaries': total_summaries - active_summaries,
        'total_facts': total_facts,
        'total_recalls': total_recalls,
        'recent_recalls_7d': recent_recalls,
        'facts_by_category': agent_facts,
        'config': {
            'short_term_window': config.short_term_window,
            'summary_threshold': config.summary_threshold,
            'retention_days': config.retention_days,
            'max_summaries': config.max_summaries,
            'auto_summary': config.auto_summary,
        }
    })


# ===== 清理过期记忆 =====

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def memory_cleanup(request: HttpRequest):
    """POST /api/v1/memory/cleanup — 清理过期记忆"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    cleanup_expired_memories(tenant)
    return api_success(msg='过期记忆已清理')
