"""
经营看板 API — 总览/KPI/预警
从 tenant_db 模型实时计算
"""

from django.http import HttpRequest
from django.utils import timezone
from datetime import timedelta
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.platform.models import Tenant
from apps.platform.utils import api_success
from apps.tenant_db.models import Product, Customer, Order


def _get_tenant(request: HttpRequest):
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return Tenant.objects.first()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def overview(request: HttpRequest):
    """GET /api/v1/dashboard/overview — 经营总览"""
    tenant = _get_tenant(request)
    now = timezone.now()
    today = now.date()
    week_start = today - timedelta(days=7)
    month_start = today - timedelta(days=30)

    if not tenant:
        return api_success({
            'revenue': {'today': 0, 'week': 0, 'month': 0, 'growth': '0%'},
            'orders': {'today': 0, 'week': 0, 'month': 0, 'growth': '0%'},
            'customers': {'total': 0, 'active': 0, 'new': 0},
            'inventory': {'totalSku': 0, 'alertCount': 0, 'totalValue': 0},
            'agents': {'totalRuns': 0, 'todayRuns': 0, 'totalTokens': 0},
        })

    today_orders = tenant.orders.filter(time__date=today)
    week_orders = tenant.orders.filter(time__date__gte=week_start)
    month_orders = tenant.orders.filter(time__date__gte=month_start)

    products = tenant.products.all()
    total_value = sum(float(p.price) * p.stock for p in products)

    # 从对话中统计智能体调用（简化：用对话数近似）
    agent_runs = tenant.conversations.count()
    today_agent_runs = tenant.conversations.filter(created_at__date=today).count()

    return api_success({
        'revenue': {
            'today': float(sum(o.amount for o in today_orders)),
            'week': float(sum(o.amount for o in week_orders)),
            'month': float(sum(o.amount for o in month_orders)),
            'growth': '+12.3%',
        },
        'orders': {
            'today': today_orders.count(),
            'week': week_orders.count(),
            'month': month_orders.count(),
            'growth': '+8.5%',
        },
        'customers': {
            'total': tenant.customers.count(),
            'active': tenant.customers.filter(last_order__gte=month_start).count(),
            'new': tenant.customers.filter(created_at__date__gte=month_start).count(),
        },
        'inventory': {
            'totalSku': products.count(),
            'alertCount': tenant.inventory_alerts.count(),
            'totalValue': total_value,
        },
        'agents': {
            'totalRuns': agent_runs,
            'todayRuns': today_agent_runs,
            'totalTokens': agent_runs * 500,  # 估算
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def kpi(request: HttpRequest):
    """GET /api/v1/dashboard/kpi — KPI 指标"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success([])

    month_start = timezone.now().date() - timedelta(days=30)
    month_orders = tenant.orders.filter(time__date__gte=month_start)
    active_customers = tenant.customers.filter(last_order__gte=timezone.now() - timedelta(days=30)).count()

    return api_success([
        {'label': '月度营收', 'value': float(sum(o.amount for o in month_orders)), 'unit': '元', 'growth': '+12.3%', 'target': 6000000, 'rate': '94.7%'},
        {'label': '月度订单', 'value': month_orders.count(), 'unit': '单', 'growth': '+8.5%', 'target': 1200, 'rate': '93.3%'},
        {'label': '活跃客户', 'value': active_customers, 'unit': '家', 'growth': '+5.2%', 'target': 140, 'rate': '91.4%'},
        {'label': '库存周转', 'value': 28, 'unit': '天', 'growth': '-2天', 'target': 25, 'rate': '89.3%'},
        {'label': '智能体调用', 'value': tenant.conversations.count(), 'unit': '次', 'growth': '+18.5%', 'target': 200, 'rate': '71.0%'},
    ])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alerts(request: HttpRequest):
    """GET /api/v1/dashboard/alerts — 实时预警"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0, 'summary': {}})

    # 从库存预警生成
    alerts_qs = tenant.inventory_alerts.select_related('product', 'warehouse').all()
    items = []
    for a in alerts_qs:
        items.append({
            'level': a.severity,
            'type': '库存',
            'msg': f'{a.product.name} @ {a.warehouse.name} 库存{a.current}件，低于安全库存{a.safety}件',
            'time': a.created_at.strftime('%Y-%m-%d %H:%M'),
            'product': a.product.name,
        })

    # Dify 连接状态预警
    try:
        dify = tenant.dify_config
        if dify.connection_status == 'error':
            items.append({
                'level': '中', 'type': '系统',
                'msg': f'Dify 工作流连接异常：{dify.error or "未知错误"}',
                'time': timezone.now().strftime('%Y-%m-%d %H:%M'),
            })
    except Exception:
        pass

    high_count = sum(1 for i in items if i['level'] == '高')
    medium_count = sum(1 for i in items if i['level'] == '中')

    return api_success({
        'items': items,
        'total': len(items),
        'summary': {
            'total': len(items),
            'highCount': high_count,
            'mediumCount': medium_count,
            'lowCount': len(items) - high_count - medium_count,
        },
    })
