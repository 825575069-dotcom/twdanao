"""
安全审计 API —— 审计日志查询/安全配置/访问控制/安全事件
"""

from django.http import HttpRequest
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.platform.models import Tenant
from apps.platform.utils import api_success, api_error, API_CODE
from .models import AuditLog, SecurityConfig, AccessControlRule, SecurityEvent
from .serializers import (
    AuditLogSerializer,
    SecurityConfigSerializer,
    AccessControlRuleSerializer,
    SecurityEventSerializer,
)
from .utils import mask_dict, mask_phone, mask_id_card, mask_bank_card, mask_email, mask_name


def _get_tenant(request: HttpRequest):
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return Tenant.objects.first()


def _get_or_create_config(tenant: Tenant) -> SecurityConfig:
    config, _ = SecurityConfig.objects.get_or_create(tenant=tenant)
    return config


# ===== 审计日志 =====

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def audit_log_list(request: HttpRequest):
    """GET /api/v1/security/audit-logs — 审计日志列表（返回直接数组）"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success([])

    logs = AuditLog.objects.filter(tenant=tenant)

    # 筛选
    action = request.GET.get('action', '')
    if action:
        logs = logs.filter(action=action)

    risk_level = request.GET.get('risk_level', '')
    if risk_level:
        logs = logs.filter(risk_level=risk_level)

    user_id = request.GET.get('user_id', '')
    if user_id:
        logs = logs.filter(user_id=user_id)

    path = request.GET.get('path', '')
    if path:
        logs = logs.filter(path__icontains=path)

    start_date = request.GET.get('start_date', '')
    if start_date:
        logs = logs.filter(created_at__date__gte=start_date)

    end_date = request.GET.get('end_date', '')
    if end_date:
        logs = logs.filter(created_at__date__lte=end_date)

    # 分页
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 20))
    items = logs.order_by('-created_at')[(page - 1) * page_size: page * page_size]

    data = AuditLogSerializer(items, many=True).data
    return api_success(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def audit_log_stats(request: HttpRequest):
    """GET /api/v1/security/audit-logs/stats — 审计日志统计"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({})

    from django.db.models import Count, Q
    from datetime import timedelta

    total = AuditLog.objects.filter(tenant=tenant).count()
    today = timezone.now().date()
    today_count = AuditLog.objects.filter(tenant=tenant, created_at__date=today).count()
    week_ago = timezone.now() - timedelta(days=7)
    week_count = AuditLog.objects.filter(tenant=tenant, created_at__gte=week_ago).count()

    # 按操作类型统计
    by_action = AuditLog.objects.filter(tenant=tenant).values('action').annotate(count=Count('id'))
    action_stats = {item['action']: item['count'] for item in by_action}

    # 按风险等级统计
    by_risk = AuditLog.objects.filter(tenant=tenant).values('risk_level').annotate(count=Count('id'))
    risk_stats = {item['risk_level']: item['count'] for item in by_risk}

    # 高风险操作
    high_risk_count = AuditLog.objects.filter(
        tenant=tenant,
        risk_level__in=['high', 'critical']
    ).count()

    # 最近7天趋势
    daily_counts = []
    for i in range(7):
        day = today - timedelta(days=i)
        count = AuditLog.objects.filter(tenant=tenant, created_at__date=day).count()
        daily_counts.append({'date': day.isoformat(), 'count': count})
    daily_counts.reverse()

    return api_success({
        'total': total,
        'today': today_count,
        'this_week': week_count,
        'high_risk': high_risk_count,
        'by_action': action_stats,
        'by_risk': risk_stats,
        'daily_trend': daily_counts,
    })


# ===== 安全配置 =====

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def security_config_view(request: HttpRequest):
    """GET|PUT /api/v1/security/config — 安全配置"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    config = _get_or_create_config(tenant)

    if request.method == 'GET':
        data = SecurityConfigSerializer(config).data
        # 不返回签名密钥明文
        data['sign_secret'] = '***' if data.get('sign_secret') else ''
        return api_success(data)

    # PUT
    allowed = [
        'audit_enabled', 'data_isolation',
        'mask_phone', 'mask_id_card', 'mask_bank_card', 'mask_email', 'mask_name',
        'request_sign_enabled', 'rate_limit_enabled', 'rate_limit_per_minute',
        'sensitive_keywords',
    ]
    for key in allowed:
        if key in request.data:
            setattr(config, key, request.data[key])

    # 签名密钥单独处理（非***时才更新）
    if 'sign_secret' in request.data and request.data['sign_secret'] != '***':
        config.sign_secret = request.data['sign_secret']

    config.save()
    data = SecurityConfigSerializer(config).data
    data['sign_secret'] = '***' if data.get('sign_secret') else ''
    return api_success(data, msg='安全配置已更新')


# ===== 数据脱敏测试 =====

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mask_test(request: HttpRequest):
    """POST /api/v1/security/mask-test — 脱敏测试"""
    tenant = _get_tenant(request)
    config = _get_or_create_config(tenant) if tenant else None

    data = request.data.get('data', {})
    if not data:
        return api_error(code=API_CODE.BAD_REQUEST, msg='缺少 data 字段')

    masked = mask_dict(data, config)
    return api_success({'original': data, 'masked': masked})


# ===== 访问控制规则 =====

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def access_rule_list(request: HttpRequest):
    """GET|POST /api/v1/security/access-rules — 访问控制规则列表/创建"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success([])

    if request.method == 'GET':
        rules = AccessControlRule.objects.filter(tenant=tenant).order_by('-created_at')
        data = AccessControlRuleSerializer(rules, many=True).data
        return api_success(data)

    # POST
    name = request.data.get('name', '')
    rule_type = request.data.get('rule_type', '')
    pattern = request.data.get('pattern', '')
    if not name or not rule_type or not pattern:
        return api_error(code=API_CODE.BAD_REQUEST, msg='name, rule_type, pattern 不能为空')

    rule = AccessControlRule.objects.create(
        tenant=tenant,
        name=name,
        rule_type=rule_type,
        pattern=pattern,
        action=request.data.get('action', 'allow'),
        enabled=request.data.get('enabled', True),
        description=request.data.get('description', ''),
    )
    return api_success(AccessControlRuleSerializer(rule).data, msg='规则已创建')


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def access_rule_detail(request: HttpRequest, rule_id: str):
    """PUT|DELETE /api/v1/security/access-rules/<id>"""
    tenant = _get_tenant(request)
    try:
        rule = AccessControlRule.objects.get(id=rule_id, tenant=tenant)
    except AccessControlRule.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='规则不存在')

    if request.method == 'DELETE':
        rule.delete()
        return api_success(msg='规则已删除')

    # PUT
    allowed = ['name', 'rule_type', 'pattern', 'action', 'enabled', 'description']
    for key in allowed:
        if key in request.data:
            setattr(rule, key, request.data[key])
    rule.save()
    return api_success(AccessControlRuleSerializer(rule).data, msg='规则已更新')


# ===== 安全事件 =====

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def security_event_list(request: HttpRequest):
    """GET /api/v1/security/events — 安全事件列表（返回直接数组）"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success([])

    events = SecurityEvent.objects.filter(tenant=tenant)

    severity = request.GET.get('severity', '')
    if severity:
        events = events.filter(severity=severity)

    resolved = request.GET.get('resolved', '')
    if resolved:
        is_resolved = resolved == 'true'
        events = events.filter(resolved=is_resolved)

    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 20))
    items = events.order_by('-created_at')[(page - 1) * page_size: page * page_size]

    data = SecurityEventSerializer(items, many=True).data
    return api_success(data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def security_event_resolve(request: HttpRequest, event_id: str):
    """PUT /api/v1/security/events/<id>/resolve — 处理安全事件"""
    tenant = _get_tenant(request)
    try:
        event = SecurityEvent.objects.get(id=event_id, tenant=tenant)
    except SecurityEvent.DoesNotExist:
        return api_error(code=API_CODE.NOT_FOUND, msg='事件不存在')

    event.resolved = True
    event.resolved_by = request.user
    event.resolved_at = timezone.now()
    event.resolve_note = request.data.get('note', '')
    event.save()
    return api_success(SecurityEventSerializer(event).data, msg='事件已处理')


# ===== 安全概览 =====

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def security_overview(request: HttpRequest):
    """GET /api/v1/security/overview — 安全概览（对齐前端 SecurityOverview 接口）"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({
            'total_audit_logs': 0,
            'total_events': 0,
            'unresolved_events': 0,
            'critical_events': 0,
            'audit_trend': [],
            'events_by_type': [],
        })

    from django.db.models import Count
    from datetime import timedelta

    # 统计数据
    total_logs = AuditLog.objects.filter(tenant=tenant).count()
    total_events = SecurityEvent.objects.filter(tenant=tenant).count()
    unresolved_events = SecurityEvent.objects.filter(tenant=tenant, resolved=False).count()
    critical_events = SecurityEvent.objects.filter(tenant=tenant, severity='critical').count()

    # 审计日志最近7天趋势
    today = timezone.now().date()
    audit_trend = []
    for i in range(7):
        day = today - timedelta(days=i)
        count = AuditLog.objects.filter(tenant=tenant, created_at__date=day).count()
        audit_trend.append({'date': day.isoformat(), 'count': count})
    audit_trend.reverse()

    # 安全事件按类型统计
    events_by_type_qs = SecurityEvent.objects.filter(tenant=tenant).values('event_type').annotate(count=Count('id'))
    events_by_type = [{'type': item['event_type'], 'count': item['count']} for item in events_by_type_qs]

    return api_success({
        'total_audit_logs': total_logs,
        'total_events': total_events,
        'unresolved_events': unresolved_events,
        'critical_events': critical_events,
        'audit_trend': audit_trend,
        'events_by_type': events_by_type,
    })
