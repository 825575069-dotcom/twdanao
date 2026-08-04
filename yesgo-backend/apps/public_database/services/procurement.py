"""
采购服务 — 快采 + 集采逻辑
快采：智能体即时报价 → 用户改数量 → 提单
集采：当天汇总所有租户需求 → 通知供应商报价 → 次日统一报价 → 租户决定
"""
import logging
from datetime import date, timedelta
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum
from ..models import (
    Supplier, PublicProduct, CollectiveBatch, ProcurementQuote,
    ProcurementOrder, OrderItem, CommissionProtocol,
)

logger = logging.getLogger(__name__)


def create_quick_quote(tenant_id, product_id, quantity, agent_id='', notes=''):
    """创建快采报价请求 — 即时返回产品当前价格作为报价"""
    product = PublicProduct.objects.select_related('supplier').get(id=product_id)
    supplier = product.supplier

    quote = ProcurementQuote.objects.create(
        quote_type='quick',
        tenant_id=tenant_id,
        product=product,
        supplier=supplier,
        agent_id=agent_id,
        quantity=quantity,
        unit_price=product.price,
        total_price=product.price * quantity,
        status='quoted',
        notes=notes,
        expires_at=timezone.now() + timedelta(hours=24),
    )
    return quote


def create_collective_quote(tenant_id, product_id, quantity, agent_id='', notes=''):
    """
    创建集采报价请求 — 加入当天集采批次
    如果当天该产品+供应商没有集采批次，自动创建
    """
    product = PublicProduct.objects.select_related('supplier').get(id=product_id)
    supplier = product.supplier
    today = timezone.now().date()

    with transaction.atomic():
        batch, _ = CollectiveBatch.objects.select_for_update().get_or_create(
            batch_date=today,
            product=product,
            supplier=supplier,
            defaults={'status': 'collecting'}
        )

        # 累加需求量
        quote = ProcurementQuote.objects.create(
            quote_type='collective',
            tenant_id=tenant_id,
            product=product,
            supplier=supplier,
            collective_batch=batch,
            agent_id=agent_id,
            quantity=quantity,
            status='pending',
            notes=notes,
        )

        # 更新批次总需求量
        batch.total_quantity = ProcurementQuote.objects.filter(
            collective_batch=batch
        ).aggregate(total=Sum('quantity'))['total'] or 0
        batch.save(update_fields=['total_quantity'])

    return quote, batch


def notify_collective_batches(batch_date=None):
    """
    通知供应商对集采批次报价（当天结束时调用）
    状态：collecting → notifying_supplier
    返回通知的批次数
    """
    if batch_date is None:
        batch_date = timezone.now().date()

    batches = CollectiveBatch.objects.filter(
        batch_date=batch_date,
        status='collecting'
    )
    count = 0
    for batch in batches:
        # TODO: 通过 API 或第三层系统通知供应商
        # 目前只更新状态，供应商报价通过 supplier_quote_batch() 手动触发
        batch.status = 'notifying_supplier'
        batch.save(update_fields=['status', 'updated_at'])
        count += 1
        logger.info(f'已通知供应商 {batch.supplier.name} 对集采批次 {batch.id} 报价')

    return count


def supplier_quote_batch(batch_id, quoted_price):
    """
    供应商对集采批次报价
    状态：notifying_supplier → quoted
    """
    batch = CollectiveBatch.objects.get(id=batch_id)
    batch.quoted_price = quoted_price
    batch.quoted_at = timezone.now()
    batch.expires_at = timezone.now() + timedelta(hours=48)
    batch.status = 'quoted'
    batch.save(update_fields=['quoted_price', 'quoted_at', 'expires_at', 'status', 'updated_at'])

    # 更新该批次下所有 quote 的报价
    quotes = ProcurementQuote.objects.filter(collective_batch=batch, status='pending')
    for quote in quotes:
        quote.unit_price = quoted_price
        quote.total_price = quoted_price * quote.quantity
        quote.status = 'quoted'
        quote.expires_at = batch.expires_at
        quote.save(update_fields=['unit_price', 'total_price', 'status', 'expires_at', 'updated_at'])

    return batch


def distribute_collective_quotes():
    """
    次日定时分发集采报价给租户
    状态：quoted → distributed
    """
    batches = CollectiveBatch.objects.filter(status='quoted')
    count = 0
    for batch in batches:
        batch.status = 'distributed'
        batch.save(update_fields=['status', 'updated_at'])
        count += 1
    return count


def _calculate_commission(supplier, amount):
    """计算佣金"""
    protocol = supplier.commission_protocols.filter(status='active').first()
    if not protocol:
        return Decimal('0')

    if protocol.protocol_type == 'percentage':
        commission = amount * protocol.value / Decimal('100')
    else:
        commission = protocol.value

    if commission < protocol.min_commission:
        commission = protocol.min_commission

    return commission.quantize(Decimal('0.01'))


def create_order(quote_id, quantity=None, payment_method='wechat', notes=''):
    """
    从报价创建采购订单（提单）
    """
    quote = ProcurementQuote.objects.select_related('product', 'supplier', 'tenant').get(id=quote_id)

    if quote.status not in ('quoted', 'accepted'):
        raise ValueError(f'报价状态不允许下单: {quote.status}')

    qty = quantity or quote.quantity
    unit_price = quote.unit_price or quote.product.price
    total = unit_price * qty

    commission = _calculate_commission(quote.supplier, total)
    supplier_amount = total - commission

    with transaction.atomic():
        order = ProcurementOrder.objects.create(
            order_number=f'PO{timezone.now().strftime("%Y%m%d%H%M%S")}{quote.id:04d}',
            tenant=quote.tenant,
            supplier=quote.supplier,
            quote=quote,
            order_type=quote.quote_type,
            status='submitted',
            total_amount=total,
            commission_amount=commission,
            supplier_amount=supplier_amount,
            payment_method=payment_method,
            notes=notes,
        )

        OrderItem.objects.create(
            order=order,
            product=quote.product,
            product_name=quote.product.name,
            product_spec=quote.product.specification,
            product_manufacturer=quote.product.manufacturer,
            product_unit=quote.product.unit,
            quantity=qty,
            unit_price=unit_price,
            total_price=total,
        )

        # 更新报价状态
        quote.status = 'ordered'
        quote.save(update_fields=['status', 'updated_at'])

    # 自动复用/同步首营记录；未找到则保持 pending，由前端提示采方发起交换
    try:
        from .first_operation import link_order_to_first_operation
        link_order_to_first_operation(order.id)
    except Exception:
        logger.warning(f'订单 {order.order_number} 首营关联失败', exc_info=True)

    # 触发通知
    try:
        from .supplier_portal import notify_order_created
        notify_order_created(order)
    except Exception:
        logger.warning('Failed to send order notification', exc_info=True)

    return order


def sync_order_to_supplier(order_id):
    """
    回传订单到供应商 SaaS 系统（预留接口）
    通过供应商 API 将订单信息发送到供应商系统
    """
    order = ProcurementOrder.objects.select_related('supplier', 'tenant').get(id=order_id)
    supplier = order.supplier

    if not supplier.api_base_url:
        # 无 API 的供应商，标记为已同步（后续可手动处理）
        order.supplier_order_synced = True
        order.supplier_order_id = f'MANUAL_{order.order_number}'
        order.save(update_fields=['supplier_order_synced', 'supplier_order_id'])
        return {'success': True, 'method': 'manual', 'message': '供应商无API，标记为手动处理'}

    import requests
    url = supplier.api_base_url.rstrip('/') + '/api/brain/orders/'
    headers = {'Authorization': f'Bearer {supplier.api_token}'}
    payload = {
        'order_number': order.order_number,
        'tenant_name': order.tenant.name,
        'items': [
            {
                'product_name': item.product_name,
                'product_spec': item.product_spec,
                'quantity': item.quantity,
                'unit_price': str(item.unit_price),
                'total_price': str(item.total_price),
            }
            for item in order.items.all()
        ],
        'total_amount': str(order.total_amount),
        'payment_method': order.payment_method,
        'notes': order.notes,
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if data.get('code') == 0:
            order.supplier_order_synced = True
            order.supplier_order_id = data.get('data', {}).get('supplier_order_id', '')
            order.save(update_fields=['supplier_order_synced', 'supplier_order_id'])
            return {'success': True, 'method': 'api', 'supplier_order_id': order.supplier_order_id}
        else:
            return {'success': False, 'error': data.get('msg', 'API返回错误')}
    except Exception as e:
        logger.error(f'回传订单 {order.order_number} 到供应商失败: {e}')
        return {'success': False, 'error': str(e)}
