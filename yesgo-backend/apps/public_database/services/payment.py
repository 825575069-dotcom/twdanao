"""
支付服务 — 聚合支付 + 分账结算（预留接口）
当前为 mock 实现，后续接入聚合支付服务商（Ping++/汇付天下等）
分账逻辑：用户付款到平台 → 平台扣佣金 → 自动分账给供应商
"""
import logging
from decimal import Decimal
from django.utils import timezone
from ..models import ProcurementOrder, PaymentRecord

logger = logging.getLogger(__name__)


def create_payment(order_id, payment_method):
    """
    创建支付记录
    """
    order = ProcurementOrder.objects.get(id=order_id)

    if order.payment_status != 'unpaid':
        raise ValueError(f'订单支付状态不允许: {order.payment_status}')

    payment = PaymentRecord.objects.create(
        order=order,
        payment_method=payment_method,
        amount=order.total_amount,
        commission_amount=order.commission_amount,
        supplier_amount=order.supplier_amount,
        status='pending',
    )

    # 更新订单支付方式
    order.payment_method = payment_method
    order.status = 'paying'
    order.save(update_fields=['payment_method', 'status', 'updated_at'])

    return payment


def mock_process_payment(payment_id):
    """
    模拟支付处理（预留接口）
    实际接入聚合支付服务商后替换此方法
    """
    payment = PaymentRecord.objects.select_related('order').get(id=payment_id)

    if payment.status != 'pending':
        raise ValueError(f'支付记录状态不允许: {payment.status}')

    # === 预留接口 ===
    # 实际接入时调用聚合支付 SDK:
    #   1. 调用支付服务商创建支付订单
    #   2. 用户完成支付后收到回调
    #   3. 触发分账（平台扣佣金，剩余分给供应商）
    # ================

    # Mock: 直接标记为已支付
    payment.status = 'paid'
    payment.channel = 'mock_aggregated_pay'
    payment.channel_transaction_id = f'MOCK_{timezone.now().strftime("%Y%m%d%H%M%S")}{payment.id:04d}'
    payment.paid_at = timezone.now()
    payment.save(update_fields=['status', 'channel', 'channel_transaction_id', 'paid_at', 'updated_at'])

    # 更新订单状态
    order = payment.order
    order.payment_status = 'paid'
    order.status = 'paid'
    order.save(update_fields=['payment_status', 'status', 'updated_at'])

    # 触发分账
    _process_split(payment)

    # 触发通知
    try:
        from .supplier_portal import notify_order_paid
        notify_order_paid(order)
    except Exception:
        logger.warning('Failed to send payment notification', exc_info=True)

    return payment


def _process_split(payment):
    """
    分账处理（预留接口）
    平台扣佣金 → 分账给供应商
    """
    # === 预留接口 ===
    # 实际接入时调用聚合支付分账 API:
    #   payment.channel_split_id = split_response.split_id
    # ================

    payment.status = 'split'
    payment.channel_split_id = f'SPLIT_{payment.channel_transaction_id}'
    payment.split_at = timezone.now()
    payment.save(update_fields=['status', 'channel_split_id', 'split_at', 'updated_at'])

    # 更新订单状态
    order = payment.order
    order.status = 'split'
    order.save(update_fields=['status', 'updated_at'])

    logger.info(f'分账完成: 订单 {order.order_number}, 佣金 ¥{payment.commission_amount}, 供应商 ¥{payment.supplier_amount}')


def get_payment_statistics(start_date=None, end_date=None):
    """支付统计"""
    qs = PaymentRecord.objects.filter(status='split')
    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)

    from django.db.models import Sum, Count
    stats = qs.aggregate(
        total_amount=Sum('amount'),
        total_commission=Sum('commission_amount'),
        total_supplier=Sum('supplier_amount'),
        total_count=Count('id'),
    )
    return {
        'total_amount': stats['total_amount'] or Decimal('0'),
        'total_commission': stats['total_commission'] or Decimal('0'),
        'total_supplier': stats['total_supplier'] or Decimal('0'),
        'total_count': stats['total_count'] or 0,
    }
