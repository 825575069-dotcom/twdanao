"""
产品同步服务 — 从供应商 SaaS 平台 API 同步产品目录
标准同步协议：
  GET {api_base_url}/api/brain/products/
  Authorization: Bearer {api_token}
  响应: { "code": 0, "data": { "total": N, "products": [...] } }
"""
import logging
from datetime import datetime
from django.utils import timezone
from ..models import Supplier, PublicProduct

logger = logging.getLogger(__name__)


def sync_supplier_products(supplier_id):
    """
    从供应商 API 同步产品列表
    返回 { success, synced, created, updated, errors }
    """
    try:
        supplier = Supplier.objects.get(id=supplier_id)
    except Supplier.DoesNotExist:
        return {'success': False, 'error': '供应商不存在'}

    if not supplier.api_base_url:
        return {'success': False, 'error': '供应商未配置 API 地址'}
    if not supplier.sync_enabled:
        return {'success': False, 'error': '供应商未启用同步'}

    import requests
    url = supplier.api_base_url.rstrip('/') + '/api/brain/products/'
    headers = {'Authorization': f'Bearer {supplier.api_token}'}

    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error(f'同步供应商 {supplier.name} 产品失败: {e}')
        supplier.last_synced_at = timezone.now()
        supplier.save(update_fields=['last_synced_at'])
        return {'success': False, 'error': f'API 请求失败: {str(e)}'}

    if data.get('code') != 0:
        return {'success': False, 'error': f'API 返回错误: {data.get("msg", "unknown")}'}

    products_data = data.get('data', {}).get('products', [])
    created = 0
    updated = 0
    errors = []

    for item in products_data:
        try:
            product_code = item.get('product_code', '')
            defaults = {
                'name': item.get('name', ''),
                'trade_name': item.get('trade_name', ''),
                'specification': item.get('specification', ''),
                'manufacturer': item.get('manufacturer', ''),
                'dosage_form': item.get('dosage_form', ''),
                'unit': item.get('unit', ''),
                'price': item.get('price', 0),
                'min_order_quantity': item.get('min_order_quantity', 1),
                'category': item.get('category', ''),
                'approval_number': item.get('approval_number', ''),
                'barcode': item.get('barcode', ''),
                'knowledge_graph': item.get('knowledge_graph', ''),
                'manual_url': item.get('manual_url', ''),
                'manual_text': item.get('manual_text', ''),
                'delivery_info': item.get('delivery_info', ''),
                'storage_condition': item.get('storage_condition', ''),
                'delivery_areas': item.get('delivery_areas', ''),
                'status': item.get('status', 'active'),
                'last_synced_at': timezone.now(),
            }

            if product_code:
                obj, created_flag = PublicProduct.objects.update_or_create(
                    supplier=supplier, product_code=product_code,
                    defaults=defaults
                )
            else:
                obj = PublicProduct.objects.create(supplier=supplier, **defaults)
                created_flag = True

            if created_flag:
                created += 1
            else:
                updated += 1
        except Exception as e:
            errors.append(f'{item.get("name", "?")}: {str(e)}')

    supplier.last_synced_at = timezone.now()
    supplier.save(update_fields=['last_synced_at'])

    return {
        'success': True,
        'synced': len(products_data),
        'created': created,
        'updated': updated,
        'errors': errors,
    }
