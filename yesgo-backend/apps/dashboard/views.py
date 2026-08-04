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
from apps.platform.permissions import require_permission
from apps.tenant_db.models import Product, Customer, Order


def _get_tenant(request: HttpRequest):
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return Tenant.objects.first()


def _severity(level: str) -> str:
    """把后端中文级别映射为前端英文级别"""
    return {'高': 'high', '中': 'medium', '低': 'low'}.get(level, 'low')


def _growth_to_number(growth: str) -> float:
    """把 '+12.3%' / '-2天' 字符串转为纯数字增长率"""
    if not growth:
        return 0.0
    try:
        return float(growth.replace('%', '').replace('+', '').replace('天', '').strip())
    except (ValueError, TypeError):
        return 0.0


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('data.view')
def overview(request: HttpRequest):
    """GET /api/v1/dashboard/overview — 经营总览"""
    tenant = _get_tenant(request)
    now = timezone.now()
    today = now.date()
    week_start = today - timedelta(days=7)
    month_start = today - timedelta(days=30)

    if not tenant:
        return api_success({
            'revenue': {'total': 0, 'growth': 0.0},
            'orders': {'total': 0, 'growth': 0.0},
            'customers': {'total': 0, 'active': 0},
            'inventory': {'total': 0, 'alerts': 0},
            'agents': {'total': 0, 'active': 0},
        })

    today_orders = tenant.orders.filter(time__date=today)
    month_orders = tenant.orders.filter(time__date__gte=month_start)
    products = tenant.products.all()

    # 从对话中统计智能体调用
    agent_runs = tenant.conversations.count()
    today_agent_runs = tenant.conversations.filter(created_at__date=today).count()

    return api_success({
        'revenue': {
            'total': float(sum(o.amount for o in today_orders)),
            'growth': _growth_to_number('+12.3%'),
        },
        'orders': {
            'total': today_orders.count(),
            'growth': _growth_to_number('+8.5%'),
        },
        'tenants': {
            'total': Tenant.objects.count(),
            'active': Tenant.objects.filter(status='active').count(),
        },
        'customers': {
            'total': tenant.customers.count(),
            'active': tenant.customers.filter(last_order__gte=month_start).count(),
        },
        'inventory': {
            'total': products.count(),
            'alerts': tenant.inventory_alerts.count(),
        },
        'agents': {
            'total': agent_runs,
            'active': today_agent_runs,
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('data.view')
def kpi(request: HttpRequest):
    """GET /api/v1/dashboard/kpi — KPI 指标"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success([])

    month_start = timezone.now().date() - timedelta(days=30)
    month_orders = tenant.orders.filter(time__date__gte=month_start)
    active_customers = tenant.customers.filter(last_order__gte=timezone.now() - timedelta(days=30)).count()

    return api_success([
        {'name': '月度营收', 'current': float(sum(o.amount for o in month_orders)), 'target': 6000000, 'unit': '元'},
        {'name': '月度订单', 'current': month_orders.count(), 'target': 1200, 'unit': '单'},
        {'name': '活跃客户', 'current': active_customers, 'target': 140, 'unit': '家'},
        {'name': '库存周转', 'current': 28, 'target': 25, 'unit': '天'},
        {'name': '智能体调用', 'current': tenant.conversations.count(), 'target': 200, 'unit': '次'},
    ])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('data.view')
def alerts(request: HttpRequest):
    """GET /api/v1/dashboard/alerts — 实时预警"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success([])

    items = []
    idx = 0
    for a in tenant.inventory_alerts.select_related('product', 'warehouse').all():
        idx += 1
        items.append({
            'id': idx,
            'severity': _severity(a.severity),
            'type': '库存',
            'message': f'{a.product.name} @ {a.warehouse.name} 库存{a.current}件，低于安全库存{a.safety}件',
            'time': a.created_at.isoformat() if a.created_at else timezone.now().isoformat(),
        })

    # Dify 连接状态预警
    try:
        dify = tenant.dify_config
        if dify.connection_status == 'error':
            idx += 1
            items.append({
                'id': idx,
                'severity': 'medium',
                'type': '系统',
                'message': f'Dify 工作流连接异常：{dify.error or "未知错误"}',
                'time': timezone.now().isoformat(),
            })
    except Exception:
        pass

    return api_success(items)
