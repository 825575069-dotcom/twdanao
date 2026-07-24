"""
商户数据接入 API —— 第一层预留接口
对齐架构文档 v1.1：
  POST /api/v1/platform/products/sync       — 商品同步
  POST /api/v1/platform/inventory/sync      — 库存同步
  POST /api/v1/platform/orders/sync         — 订单同步
  POST /api/v1/platform/customers/sync      — 客户同步
  POST /api/v1/platform/distribution/sync   — 流向同步

每个接口通过 X-Tenant-ID 标识来源商户，X-Platform-Key 鉴权
"""
from django.http import HttpRequest
from rest_framework.decorators import api_view
from apps.platform.utils import api_success


@api_view(['POST'])
def sync_products(request: HttpRequest):
    """POST /api/v1/platform/products/sync — 商品同步"""
    tenant_id = getattr(request, 'tenant_id', '')
    data = request.data if hasattr(request, 'data') else {}
    items = data.get('items', [])
    return api_success({
        'tenantId': tenant_id,
        'synced': len(items),
        'msg': f'已同步 {len(items)} 条商品数据',
    })


@api_view(['POST'])
def sync_inventory(request: HttpRequest):
    """POST /api/v1/platform/inventory/sync — 库存同步"""
    tenant_id = getattr(request, 'tenant_id', '')
    data = request.data if hasattr(request, 'data') else {}
    items = data.get('items', [])
    return api_success({
        'tenantId': tenant_id,
        'synced': len(items),
        'msg': f'已同步 {len(items)} 条库存数据',
    })


@api_view(['POST'])
def sync_orders(request: HttpRequest):
    """POST /api/v1/platform/orders/sync — 订单同步"""
    tenant_id = getattr(request, 'tenant_id', '')
    data = request.data if hasattr(request, 'data') else {}
    items = data.get('items', [])
    return api_success({
        'tenantId': tenant_id,
        'synced': len(items),
        'msg': f'已同步 {len(items)} 条订单数据',
    })


@api_view(['POST'])
def sync_customers(request: HttpRequest):
    """POST /api/v1/platform/customers/sync — 客户同步"""
    tenant_id = getattr(request, 'tenant_id', '')
    data = request.data if hasattr(request, 'data') else {}
    items = data.get('items', [])
    return api_success({
        'tenantId': tenant_id,
        'synced': len(items),
        'msg': f'已同步 {len(items)} 条客户数据',
    })


@api_view(['POST'])
def sync_distribution(request: HttpRequest):
    """POST /api/v1/platform/distribution/sync — 流向同步"""
    tenant_id = getattr(request, 'tenant_id', '')
    data = request.data if hasattr(request, 'data') else {}
    items = data.get('items', [])
    return api_success({
        'tenantId': tenant_id,
        'synced': len(items),
        'msg': f'已同步 {len(items)} 条流向数据',
    })
