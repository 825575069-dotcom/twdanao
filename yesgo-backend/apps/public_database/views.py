"""
公共数据库 API 视图
供应商管理 + 产品目录 + 采购报价 + 集采 + 订单 + 支付 + 资质 + 统计
"""
import os
import uuid
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import HttpRequest, HttpResponse
from django.conf import settings
from django.core.files.storage import default_storage
from django.db import IntegrityError
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.platform.utils import api_success, api_error, API_CODE
from apps.platform.permissions import require_platform_permission

from .models import (
    Supplier, CommissionProtocol, SupplierQualification,
    TenantQualification, FirstOperationRecord,
    PublicProduct, CollectiveBatch, ProcurementQuote,
    ProcurementOrder, OrderItem, QualificationExchange, PaymentRecord,
    SupplierDeliveryRule, CollectivePurchaseAnnouncement, CollectiveParticipation,
    SupplierAccount,
)
from .serializers import (
    SupplierSerializer, CommissionProtocolSerializer, SupplierQualificationSerializer,
    TenantQualificationSerializer, FirstOperationRecordSerializer,
    PublicProductSerializer, PublicProductDetailSerializer,
    CollectiveBatchSerializer, ProcurementQuoteSerializer,
    ProcurementOrderSerializer, QualificationExchangeSerializer, PaymentRecordSerializer,
    SupplierDeliveryRuleSerializer,
    CollectivePurchaseAnnouncementSerializer, CollectiveParticipationSerializer,
    SupplierAccountSerializer, OrderReturnSerializer,
)
from .services.search import search_products
from .services.product_sync import sync_supplier_products
from .services.procurement import (
    create_quick_quote, create_collective_quote,
    notify_collective_batches, supplier_quote_batch, distribute_collective_quotes,
    create_order, sync_order_to_supplier,
)
from .services.payment import create_payment, mock_process_payment, get_payment_statistics
from .services.qualification import (
    initiate_qualification_exchange, initiate_e_signature, complete_e_signature,
    verify_supplier,
)
from .services.collective_purchase import (
    create_announcement, publish_announcement, close_announcement, cancel_announcement,
    register_participation, get_tenant_participations,
    aggregate_demand, push_to_suppliers,
    supplier_quote_participation, supplier_batch_quote,
    distribute_quotes, tenant_adjust_quantity, tenant_decline,
    create_order_from_participation,
    get_delivery_rules, get_supplier_delivery_info,
)


# ========== 供应商管理 ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def supplier_list(request):
    qs = Supplier.objects.all().order_by('sort_order', '-created_at')
    search = request.query_params.get('search', '').strip()
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search) | Q(contact_name__icontains=search))
    data = SupplierSerializer(qs, many=True).data
    return api_success(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def supplier_create(request):
    serializer = SupplierSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return api_success(serializer.data, msg='供应商已创建')
    return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def supplier_detail(request, pk):
    try:
        supplier = Supplier.objects.get(pk=pk)
    except Supplier.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '供应商不存在')

    if request.method == 'GET':
        return api_success(SupplierSerializer(supplier).data)

    if request.method == 'PUT':
        serializer = SupplierSerializer(supplier, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return api_success(serializer.data, msg='供应商已更新')
        return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')

    if request.method == 'DELETE':
        if supplier.products.exists():
            return api_error(API_CODE.BAD_REQUEST, '该供应商下有产品，无法删除')
        supplier.delete()
        return api_success(msg='供应商已删除')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def supplier_verify(request, pk):
    """审核供应商资质"""
    approved = request.data.get('approved', True)
    remark = request.data.get('remark', '')
    supplier = verify_supplier(pk, approved=approved, remark=remark)
    return api_success(SupplierSerializer(supplier).data, msg='审核已完成')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def supplier_sync_products(request, pk):
    """从供应商 API 同步产品"""
    result = sync_supplier_products(pk)
    if result['success']:
        return api_success(result, msg=f"同步完成: 新增{result['created']}个, 更新{result['updated']}个")
    return api_error(API_CODE.BAD_REQUEST, result.get('error', '同步失败'))


# ========== 供应商资质 ==========

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def supplier_qualifications(request, pk):
    try:
        Supplier.objects.get(pk=pk)
    except Supplier.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '供应商不存在')

    if request.method == 'GET':
        qs = SupplierQualification.objects.filter(supplier_id=pk)
        return api_success(SupplierQualificationSerializer(qs, many=True).data)

    serializer = SupplierQualificationSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(supplier_id=pk)
        return api_success(serializer.data, msg='资质已添加')
    return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def qualification_delete(request, pk):
    try:
        qual = SupplierQualification.objects.get(pk=pk)
        qual.delete()
        return api_success(msg='资质已删除')
    except SupplierQualification.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '资质不存在')


# ========== 佣金协议 ==========

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def commission_protocol_list(request):
    if request.method == 'GET':
        qs = CommissionProtocol.objects.all().order_by('-created_at')
        return api_success(CommissionProtocolSerializer(qs, many=True).data)

    serializer = CommissionProtocolSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return api_success(serializer.data, msg='佣金协议已创建')
    return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')


# ========== 产品 ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def product_list(request):
    query = request.query_params.get('search', '')
    supplier_id = request.query_params.get('supplier_id')
    category = request.query_params.get('category')
    status = request.query_params.get('status', 'active')
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 20))

    result = search_products(
        query=query, supplier_id=supplier_id, category=category,
        status=status, page=page, page_size=page_size
    )
    data = {
        'results': PublicProductSerializer(result['results'], many=True).data,
        'total': result['total'],
        'page': result['page'],
        'page_size': result['page_size'],
    }
    return api_success(data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def product_create(request):
    if request.method == 'GET':
        # 返回供应商列表供选择
        suppliers = Supplier.objects.filter(enabled=True).values('id', 'name', 'code')
        return api_success(list(suppliers))

    serializer = PublicProductSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return api_success(serializer.data, msg='产品已创建')
    return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def product_detail(request, pk):
    try:
        product = PublicProduct.objects.select_related('supplier').get(pk=pk)
    except PublicProduct.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '产品不存在')

    if request.method == 'GET':
        return api_success(PublicProductDetailSerializer(product).data)

    if request.method == 'PUT':
        serializer = PublicProductSerializer(product, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return api_success(serializer.data, msg='产品已更新')
        return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')

    if request.method == 'DELETE':
        product.delete()
        return api_success(msg='产品已删除')


# ========== 集采批次 ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def collective_batch_list(request):
    status = request.query_params.get('status')
    qs = CollectiveBatch.objects.select_related('product', 'supplier').all()
    if status:
        qs = qs.filter(status=status)
    qs = qs.order_by('-batch_date', '-created_at')
    return api_success(CollectiveBatchSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def collective_batch_detail(request, pk):
    try:
        batch = CollectiveBatch.objects.select_related('product', 'supplier').get(pk=pk)
    except CollectiveBatch.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '集采批次不存在')
    data = CollectiveBatchSerializer(batch).data
    data['quotes'] = ProcurementQuoteSerializer(batch.quotes.all(), many=True).data
    return api_success(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def collective_batch_notify(request):
    """通知所有 collecting 状态的集采批次供应商报价"""
    batch_date = request.data.get('batch_date')
    count = notify_collective_batches(batch_date)
    return api_success({'notified': count}, msg=f'已通知 {count} 个批次')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def collective_batch_quote(request, pk):
    """供应商对集采批次报价"""
    quoted_price = request.data.get('quoted_price')
    if not quoted_price:
        return api_error(API_CODE.BAD_REQUEST, '请提供报价')
    batch = supplier_quote_batch(pk, Decimal(str(quoted_price)))
    return api_success(CollectiveBatchSerializer(batch).data, msg='报价已提交')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def collective_batch_distribute(request):
    """分发集采报价给租户"""
    count = distribute_collective_quotes()
    return api_success({'distributed': count}, msg=f'已分发 {count} 个批次')


# ========== 采购报价 ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quote_list(request):
    qs = ProcurementQuote.objects.select_related('product', 'supplier', 'tenant').all()
    status = request.query_params.get('status')
    quote_type = request.query_params.get('quote_type')
    if status:
        qs = qs.filter(status=status)
    if quote_type:
        qs = qs.filter(quote_type=quote_type)
    qs = qs.order_by('-created_at')
    return api_success(ProcurementQuoteSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quote_quick(request):
    """创建快采报价"""
    tenant_id = request.data.get('tenant_id')
    product_id = request.data.get('product_id')
    quantity = int(request.data.get('quantity', 1))
    agent_id = request.data.get('agent_id', '')
    notes = request.data.get('notes', '')

    if not tenant_id or not product_id:
        return api_error(API_CODE.BAD_REQUEST, '缺少租户ID或产品ID')

    try:
        quote = create_quick_quote(tenant_id, product_id, quantity, agent_id, notes)
        return api_success(ProcurementQuoteSerializer(quote).data, msg='快采报价已生成')
    except PublicProduct.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '产品不存在')
    except Exception as e:
        return api_error(API_CODE.INTERNAL_ERROR, f'创建报价失败: {str(e)}')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quote_collective(request):
    """创建集采报价"""
    tenant_id = request.data.get('tenant_id')
    product_id = request.data.get('product_id')
    quantity = int(request.data.get('quantity', 1))
    agent_id = request.data.get('agent_id', '')
    notes = request.data.get('notes', '')

    if not tenant_id or not product_id:
        return api_error(API_CODE.BAD_REQUEST, '缺少租户ID或产品ID')

    try:
        quote, batch = create_collective_quote(tenant_id, product_id, quantity, agent_id, notes)
        return api_success({
            'quote': ProcurementQuoteSerializer(quote).data,
            'batch': CollectiveBatchSerializer(batch).data,
        }, msg='集采需求已加入当天批次')
    except PublicProduct.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '产品不存在')
    except Exception as e:
        return api_error(API_CODE.INTERNAL_ERROR, f'创建集采失败: {str(e)}')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quote_accept(request, pk):
    """接受报价"""
    quote = ProcurementQuote.objects.get(pk=pk)
    quote.status = 'accepted'
    quote.save(update_fields=['status', 'updated_at'])
    return api_success(ProcurementQuoteSerializer(quote).data, msg='已接受报价')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quote_reject(request, pk):
    """拒绝报价"""
    quote = ProcurementQuote.objects.get(pk=pk)
    quote.status = 'rejected'
    quote.save(update_fields=['status', 'updated_at'])
    return api_success(ProcurementQuoteSerializer(quote).data, msg='已拒绝报价')


# ========== 采购订单 ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_list(request):
    qs = ProcurementOrder.objects.select_related('tenant', 'supplier').all()
    status = request.query_params.get('status')
    tenant_id = request.query_params.get('tenant_id')
    supplier_id = request.query_params.get('supplier_id')
    order_type = request.query_params.get('order_type')
    if status:
        qs = qs.filter(status=status)
    if tenant_id:
        qs = qs.filter(tenant_id=tenant_id)
    if supplier_id:
        qs = qs.filter(supplier_id=supplier_id)
    if order_type:
        qs = qs.filter(order_type=order_type)
    qs = qs.order_by('-created_at')
    return api_success(ProcurementOrderSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def order_create(request):
    """从报价创建订单"""
    quote_id = request.data.get('quote_id')
    quantity = request.data.get('quantity')
    payment_method = request.data.get('payment_method', 'wechat')
    notes = request.data.get('notes', '')

    if not quote_id:
        return api_error(API_CODE.BAD_REQUEST, '缺少报价ID')

    try:
        order = create_order(quote_id, quantity=quantity, payment_method=payment_method, notes=notes)
        return api_success(ProcurementOrderSerializer(order).data, msg='订单已创建')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))
    except Exception as e:
        return api_error(API_CODE.INTERNAL_ERROR, f'创建订单失败: {str(e)}')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def order_quick_create(request):
    """
    快采一键下单 — 产品ID + 数量 → 自动创建报价 + 订单
    省去先创建报价再下单的中间步骤
    """
    tenant_id = request.data.get('tenant_id')
    product_id = request.data.get('product_id')
    quantity = int(request.data.get('quantity', 1))
    agent_id = request.data.get('agent_id', '')
    payment_method = request.data.get('payment_method', 'wechat')
    notes = request.data.get('notes', '')

    if not tenant_id or not product_id:
        return api_error(API_CODE.BAD_REQUEST, '缺少租户ID或产品ID')

    try:
        # 1. 创建快采报价
        quote = create_quick_quote(tenant_id, product_id, quantity, agent_id, notes)
        # 2. 从报价创建订单
        order = create_order(quote.id, quantity=quantity, payment_method=payment_method, notes=notes)
        return api_success({
            'order': ProcurementOrderSerializer(order).data,
            'quote_id': quote.id,
        }, msg='快采订单已创建')
    except PublicProduct.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '产品不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))
    except Exception as e:
        return api_error(API_CODE.INTERNAL_ERROR, f'快采下单失败: {str(e)}')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_detail(request, pk):
    try:
        order = ProcurementOrder.objects.select_related('tenant', 'supplier', 'quote').get(pk=pk)
    except ProcurementOrder.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '订单不存在')
    data = ProcurementOrderSerializer(order).data
    # 附带资质交换和支付记录
    if hasattr(order, 'qualification_exchange'):
        data['qualification_exchange'] = QualificationExchangeSerializer(order.qualification_exchange).data
    data['payments'] = PaymentRecordSerializer(order.payments.all(), many=True).data
    # 附带订单明细
    data['items'] = [
        {
            'id': item.id,
            'product_name': item.product_name,
            'product_spec': item.product_spec,
            'product_manufacturer': item.product_manufacturer,
            'product_unit': item.product_unit,
            'quantity': item.quantity,
            'unit_price': str(item.unit_price),
            'total_price': str(item.total_price),
        }
        for item in order.items.all()
    ]
    return api_success(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def order_sync_supplier(request, pk):
    """回传订单到供应商系统"""
    result = sync_order_to_supplier(pk)
    if result['success']:
        return api_success(result, msg='订单已同步供应商系统')
    return api_error(API_CODE.BAD_REQUEST, result.get('error', '同步失败'))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def order_qualification(request, pk):
    """发起资质交换"""
    buyer_quals = request.data.get('buyer_qualifications', [])
    exchange = initiate_qualification_exchange(pk, buyer_quals)
    return api_success(QualificationExchangeSerializer(exchange).data, msg='资质已交换')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def order_e_sign(request, pk):
    """发起电子签章（预留接口）"""
    exchange = initiate_e_signature(pk)
    return api_success(QualificationExchangeSerializer(exchange).data, msg='签章流程已发起（预留接口）')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def order_complete_sign(request, pk):
    """完成电子签章"""
    exchange = complete_e_signature(pk)
    return api_success(QualificationExchangeSerializer(exchange).data, msg='签章已完成（模拟）')


# ========== 支付 ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_list(request):
    qs = PaymentRecord.objects.select_related('order').all()
    qs = qs.order_by('-created_at')
    return api_success(PaymentRecordSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payment_create(request, pk):
    """创建支付"""
    payment_method = request.data.get('payment_method', 'wechat')
    try:
        payment = create_payment(pk, payment_method)
        return api_success(PaymentRecordSerializer(payment).data, msg='支付已创建')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payment_process(request, pk):
    """处理支付（mock，预留接口）"""
    try:
        payment = mock_process_payment(pk)
        return api_success(PaymentRecordSerializer(payment).data, msg='支付完成（模拟），分账已完成')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([AllowAny])
def payment_callback(request):
    """
    支付回调 webhook（预留接口）
    实际接入聚合支付后，支付服务商会回调此接口
    当前 mock 模式下可手动调用完成支付
    """
    from .services.payment import mock_process_payment

    payment_id = request.data.get('payment_id')
    transaction_id = request.data.get('transaction_id', '')
    status = request.data.get('status', 'success')

    if not payment_id:
        return api_error(API_CODE.BAD_REQUEST, '缺少支付记录ID')

    try:
        payment = mock_process_payment(payment_id)
        return api_success({
            'payment_id': payment.id,
            'order_number': payment.order.order_number,
            'status': payment.status,
            'transaction_id': payment.channel_transaction_id,
        }, msg='支付回调处理成功')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))
    except PaymentRecord.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '支付记录不存在')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_full_status(request, pk):
    """
    订单全状态聚合查询 — 租户端使用
    返回订单 + 明细 + 支付 + 资质 + 配送 的完整状态
    """
    try:
        order = ProcurementOrder.objects.select_related('tenant', 'supplier', 'quote').get(pk=pk)
    except ProcurementOrder.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '订单不存在')

    # 基本订单信息
    data = ProcurementOrderSerializer(order).data

    # 订单明细
    data['items'] = [
        {
            'id': item.id,
            'product_id': item.product_id,
            'product_name': item.product_name,
            'product_spec': item.product_spec,
            'product_manufacturer': item.product_manufacturer,
            'product_unit': item.product_unit,
            'quantity': item.quantity,
            'unit_price': str(item.unit_price),
            'total_price': str(item.total_price),
        }
        for item in order.items.select_related('product').all()
    ]

    # 支付信息
    payments = order.payments.all()
    data['payments'] = PaymentRecordSerializer(payments, many=True).data
    data['payment_status_display'] = order.get_payment_status_display()
    data['status_display'] = order.get_status_display()

    # 资质交换信息
    if hasattr(order, 'qualification_exchange'):
        exchange = order.qualification_exchange
        data['qualification_exchange'] = QualificationExchangeSerializer(exchange).data
        data['qualification_status_display'] = exchange.get_status_display()
    else:
        data['qualification_exchange'] = None
        data['qualification_status_display'] = '未发起'

    # 供应商信息
    data['supplier_info'] = {
        'id': order.supplier.id,
        'name': order.supplier.name,
        'contact_name': order.supplier.contact_name,
        'contact_phone': order.supplier.contact_phone,
    }

    # 配送信息（基于租户位置）
    from .services.collective_purchase import get_supplier_delivery_info
    tenant = order.tenant
    delivery_hours, min_order = get_supplier_delivery_info(
        order.supplier_id, tenant.province, tenant.city
    )
    data['delivery_info'] = {
        'delivery_hours': delivery_hours,
        'min_order_amount': str(min_order),
        'tenant_province': tenant.province,
        'tenant_city': tenant.city,
    }

    # 下一步操作提示
    next_actions = []
    if order.status == 'submitted':
        next_actions.append('initiate_qualification')
    elif order.status == 'qualified':
        next_actions.append('initiate_e_sign')
    elif order.status in ('paying',):
        next_actions.append('create_payment')
    elif order.status in ('paid', 'split'):
        next_actions.append('track_delivery')
    elif order.status == 'delivering':
        next_actions.append('confirm_receipt')
    data['next_actions'] = next_actions

    return api_success(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def statistics(request):
    """交易统计 + 收益统计"""
    from django.db.models.functions import TruncDate

    # 总体统计
    payment_stats = get_payment_statistics()

    # 订单统计
    orders = ProcurementOrder.objects.all()
    order_stats = {
        'total': orders.count(),
        'by_status': {},
    }
    for status_val, status_label in ProcurementOrder.STATUS_CHOICES:
        order_stats['by_status'][status_val] = {
            'label': status_label,
            'count': orders.filter(status=status_val).count(),
        }

    # 供应商统计
    suppliers = Supplier.objects.filter(enabled=True)
    supplier_stats = []
    for s in suppliers:
        supplier_stats.append({
            'id': s.id,
            'name': s.name,
            'product_count': s.products.count(),
            'order_count': s.orders.count(),
            'total_amount': str(s.orders.aggregate(t=Sum('total_amount'))['t'] or Decimal('0')),
            'commission': str(s.orders.aggregate(t=Sum('commission_amount'))['t'] or Decimal('0')),
        })

    # 近 7 天交易趋势
    seven_days_ago = timezone.now() - timedelta(days=7)
    daily_trend = []
    daily_qs = PaymentRecord.objects.filter(
        status='split', created_at__date__gte=seven_days_ago.date()
    ).annotate(day=TruncDate('created_at')).values('day').annotate(
        amount=Sum('amount'),
        commission=Sum('commission_amount'),
        count=Count('id'),
    ).order_by('day')
    for item in daily_qs:
        daily_trend.append({
            'date': item['day'].isoformat(),
            'amount': str(item['amount']),
            'commission': str(item['commission']),
            'count': item['count'],
        })

    return api_success({
        'payment': {k: str(v) if isinstance(v, Decimal) else v for k, v in payment_stats.items()},
        'orders': order_stats,
        'suppliers': supplier_stats,
        'daily_trend': daily_trend,
    })


# ========== 集采公告 ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def announcement_list(request):
    """集采公告列表"""
    qs = CollectivePurchaseAnnouncement.objects.all().order_by('-announce_time')
    status = request.query_params.get('status')
    if status:
        qs = qs.filter(status=status)
    data = CollectivePurchaseAnnouncementSerializer(qs, many=True).data
    return api_success(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def announcement_create(request):
    """创建集采公告"""
    title = request.data.get('title', '').strip()
    if not title:
        return api_error(API_CODE.BAD_REQUEST, '公告标题不能为空')

    quote_deadline = request.data.get('quote_deadline')
    order_deadline = request.data.get('order_deadline')
    if not quote_deadline or not order_deadline:
        return api_error(API_CODE.BAD_REQUEST, '报价截止和下单截止时间不能为空')

    try:
        announcement = create_announcement(
            title=title,
            description=request.data.get('description', ''),
            quote_deadline=quote_deadline,
            order_deadline=order_deadline,
            product_keywords=request.data.get('product_keywords', ''),
            supplier_ids=request.data.get('supplier_ids', ''),
            created_by=getattr(request.user, 'platform_profile', None),
            notes=request.data.get('notes', ''),
        )
        return api_success(
            CollectivePurchaseAnnouncementSerializer(announcement).data,
            msg='集采公告已创建'
        )
    except Exception as e:
        return api_error(API_CODE.INTERNAL_ERROR, f'创建失败: {str(e)}')


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def announcement_detail(request, pk):
    try:
        announcement = CollectivePurchaseAnnouncement.objects.get(pk=pk)
    except CollectivePurchaseAnnouncement.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '集采公告不存在')

    if request.method == 'GET':
        data = CollectivePurchaseAnnouncementSerializer(announcement).data
        # 附带参与记录
        participations = announcement.participations.select_related(
            'tenant', 'product', 'supplier'
        ).all()
        data['participations'] = CollectiveParticipationSerializer(participations, many=True).data
        return api_success(data)

    if request.method == 'PUT':
        serializer = CollectivePurchaseAnnouncementSerializer(announcement, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return api_success(serializer.data, msg='公告已更新')
        return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')

    if request.method == 'DELETE':
        if announcement.participations.exists():
            return api_error(API_CODE.BAD_REQUEST, '该公告下有参与记录，无法删除')
        announcement.delete()
        return api_success(msg='公告已删除')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def announcement_publish(request, pk):
    """发布集采公告"""
    try:
        announcement = publish_announcement(pk)
        return api_success(
            CollectivePurchaseAnnouncementSerializer(announcement).data,
            msg='公告已发布，开始收集需求'
        )
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def announcement_aggregate(request, pk):
    """汇总集采需求"""
    try:
        result = aggregate_demand(pk)
        return api_success(result)
    except CollectivePurchaseAnnouncement.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '集采公告不存在')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def announcement_push_suppliers(request, pk):
    """推送汇总需求给供应商报价"""
    try:
        result = push_to_suppliers(pk)
        return api_success(result, msg=f'已推送至 {result["pushed_count"]} 个供应商')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def announcement_distribute(request, pk):
    """分发供应商报价给租户"""
    try:
        result = distribute_quotes(pk)
        return api_success(result, msg=f'已分发 {result["distributed_count"]} 条报价至 {result["tenant_count"]} 个租户')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def announcement_close(request, pk):
    """关闭集采公告"""
    announcement = close_announcement(pk)
    return api_success(
        CollectivePurchaseAnnouncementSerializer(announcement).data,
        msg='公告已关闭'
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def announcement_cancel(request, pk):
    """取消集采公告"""
    announcement = cancel_announcement(pk)
    return api_success(
        CollectivePurchaseAnnouncementSerializer(announcement).data,
        msg='公告已取消'
    )


# ========== 集采参与记录 ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def participation_list(request):
    """集采参与记录列表（可按公告/租户/供应商过滤）"""
    qs = CollectiveParticipation.objects.select_related(
        'announcement', 'tenant', 'product', 'supplier'
    ).all()

    announcement_id = request.query_params.get('announcement_id')
    tenant_id = request.query_params.get('tenant_id')
    supplier_id = request.query_params.get('supplier_id')
    status = request.query_params.get('status')

    if announcement_id:
        qs = qs.filter(announcement_id=announcement_id)
    if tenant_id:
        qs = qs.filter(tenant_id=tenant_id)
    if supplier_id:
        qs = qs.filter(supplier_id=supplier_id)
    if status:
        qs = qs.filter(status=status)

    qs = qs.order_by('-created_at')
    return api_success(CollectiveParticipationSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def participation_register(request):
    """租户登记集采需求"""
    announcement_id = request.data.get('announcement_id')
    tenant_id = request.data.get('tenant_id')
    product_id = request.data.get('product_id')
    supplier_id = request.data.get('supplier_id')
    quantity = int(request.data.get('quantity', 1))
    notes = request.data.get('notes', '')

    if not all([announcement_id, tenant_id, product_id, supplier_id]):
        return api_error(API_CODE.BAD_REQUEST, '缺少必要参数')

    try:
        participation, created = register_participation(
            announcement_id, tenant_id, product_id, supplier_id, quantity, notes
        )
        msg = '需求已登记' if created else '需求已累加'
        return api_success(CollectiveParticipationSerializer(participation).data, msg=msg)
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))
    except Exception as e:
        return api_error(API_CODE.INTERNAL_ERROR, f'登记失败: {str(e)}')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def participation_quote(request, pk):
    """供应商对集采参与记录报价"""
    quoted_unit_price = request.data.get('quoted_unit_price')
    if not quoted_unit_price:
        return api_error(API_CODE.BAD_REQUEST, '请提供报价单价')

    participation = CollectiveParticipation.objects.get(pk=pk)
    try:
        count = supplier_quote_participation(
            participation.announcement_id,
            participation.supplier_id,
            participation.product_id,
            quoted_unit_price
        )
        participation.refresh_from_db()
        return api_success(
            CollectiveParticipationSerializer(participation).data,
            msg=f'报价已提交，更新 {count} 条记录'
        )
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def participation_batch_quote(request):
    """供应商批量报价"""
    announcement_id = request.data.get('announcement_id')
    supplier_id = request.data.get('supplier_id')
    quotes = request.data.get('quotes', [])

    if not all([announcement_id, supplier_id, quotes]):
        return api_error(API_CODE.BAD_REQUEST, '缺少必要参数')

    try:
        results = supplier_batch_quote(announcement_id, supplier_id, quotes)
        return api_success(results, msg=f'批量报价完成，共 {len(results)} 个产品')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def participation_adjust(request, pk):
    """租户调整最终数量"""
    final_quantity = request.data.get('final_quantity')
    if not final_quantity:
        return api_error(API_CODE.BAD_REQUEST, '请提供最终数量')

    try:
        participation = tenant_adjust_quantity(pk, int(final_quantity))
        return api_success(
            CollectiveParticipationSerializer(participation).data,
            msg='数量已调整'
        )
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def participation_decline(request, pk):
    """租户放弃参与"""
    participation = tenant_decline(pk)
    return api_success(
        CollectiveParticipationSerializer(participation).data,
        msg='已放弃该报价'
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def participation_create_order(request, pk):
    """从集采参与记录创建订单"""
    payment_method = request.data.get('payment_method', 'wechat')
    notes = request.data.get('notes', '')

    try:
        order = create_order_from_participation(pk, payment_method, notes)
        return api_success(ProcurementOrderSerializer(order).data, msg='订单已创建')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))
    except Exception as e:
        return api_error(API_CODE.INTERNAL_ERROR, f'创建订单失败: {str(e)}')


# ========== 供应商配送规则 ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def delivery_rule_list(request):
    """配送规则列表"""
    supplier_id = request.query_params.get('supplier_id')
    qs = get_delivery_rules(supplier_id)
    return api_success(SupplierDeliveryRuleSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def delivery_rule_create(request):
    """创建配送规则"""
    serializer = SupplierDeliveryRuleSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return api_success(serializer.data, msg='配送规则已创建')
    return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def delivery_rule_detail(request, pk):
    try:
        rule = SupplierDeliveryRule.objects.get(pk=pk)
    except SupplierDeliveryRule.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '配送规则不存在')

    if request.method == 'GET':
        return api_success(SupplierDeliveryRuleSerializer(rule).data)

    if request.method == 'PUT':
        serializer = SupplierDeliveryRuleSerializer(rule, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return api_success(serializer.data, msg='配送规则已更新')
        return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')

    if request.method == 'DELETE':
        rule.delete()
        return api_success(msg='配送规则已删除')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def supplier_delivery_info(request, supplier_id):
    """查询供应商对某区域的配送信息"""
    province = request.query_params.get('province', '')
    city = request.query_params.get('city', '')
    delivery_hours, min_order_amount = get_supplier_delivery_info(supplier_id, province, city)
    return api_success({
        'supplier_id': supplier_id,
        'province': province,
        'city': city,
        'delivery_hours': delivery_hours,
        'min_order_amount': str(min_order_amount),
    })


# ========== 供应商账号管理 ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def supplier_account_list(request):
    """供应商账号列表"""
    qs = SupplierAccount.objects.select_related('supplier').all()
    return api_success(SupplierAccountSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def supplier_account_create(request):
    """创建供应商账号"""
    supplier_id = request.data.get('supplier_id')
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()

    if not all([supplier_id, username, password]):
        return api_error(API_CODE.BAD_REQUEST, '供应商、用户名、密码不能为空')

    if SupplierAccount.objects.filter(username=username).exists():
        return api_error(API_CODE.BAD_REQUEST, '用户名已存在')

    account = SupplierAccount(
        supplier_id=supplier_id,
        username=username,
        contact_name=request.data.get('contact_name', ''),
        contact_phone=request.data.get('contact_phone', ''),
    )
    account.set_password(password)

    # 生成 API Token
    import secrets
    account.api_token = secrets.token_urlsafe(32)
    account.save()

    return api_success(SupplierAccountSerializer(account).data, msg='供应商账号已创建')


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def supplier_account_detail(request, pk):
    try:
        account = SupplierAccount.objects.get(pk=pk)
    except SupplierAccount.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '供应商账号不存在')

    if request.method == 'PUT':
        # 更新基本信息
        if 'contact_name' in request.data:
            account.contact_name = request.data['contact_name']
        if 'contact_phone' in request.data:
            account.contact_phone = request.data['contact_phone']
        if 'enabled' in request.data:
            account.enabled = request.data['enabled']
        # 重置密码
        new_password = request.data.get('password')
        if new_password:
            account.set_password(new_password)
        # 重新生成 Token
        if request.data.get('regenerate_token'):
            import secrets
            account.api_token = secrets.token_urlsafe(32)
        account.save()
        return api_success(SupplierAccountSerializer(account).data, msg='账号已更新')

    if request.method == 'DELETE':
        account.delete()
        return api_success(msg='供应商账号已删除')


# ========== 供应商门户（Token 认证）==========

def _get_supplier_account_from_request(request):
    """从请求中提取供应商账号（通过 Token）"""
    from .services.supplier_portal import get_supplier_by_token
    token = request.META.get('HTTP_X_SUPPLIER_TOKEN', '')
    if not token:
        token = request.query_params.get('supplier_token', '')
    if not token:
        return None
    return get_supplier_by_token(token)


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_login(request):
    """供应商门户登录"""
    from .services.supplier_portal import supplier_login
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()

    if not username or not password:
        return api_error(API_CODE.BAD_REQUEST, '用户名和密码不能为空')

    account, error = supplier_login(username, password)
    if error:
        return api_error(API_CODE.UNAUTHORIZED, error)

    return api_success({
        'token': account.api_token,
        'supplier_id': account.supplier_id,
        'supplier_name': account.supplier.name,
        'username': account.username,
        'contact_name': account.contact_name,
        'contact_phone': account.contact_phone,
    }, msg='登录成功')


@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_dashboard(request):
    """供应商仪表盘"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import get_supplier_dashboard
    dashboard = get_supplier_dashboard(account.supplier_id)
    return api_success(dashboard)


@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_orders(request):
    """供应商订单列表"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import get_supplier_orders
    status = request.query_params.get('status')
    orders = get_supplier_orders(account.supplier_id, status)
    return api_success(ProcurementOrderSerializer(orders, many=True).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_order_update(request, pk):
    """供应商更新订单状态"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import update_order_status_by_supplier
    new_status = request.data.get('status', '')
    tracking_number = request.data.get('tracking_number', '')

    if not new_status:
        return api_error(API_CODE.BAD_REQUEST, '请提供新状态')

    try:
        order = update_order_status_by_supplier(pk, account.supplier_id, new_status, tracking_number)
        return api_success(ProcurementOrderSerializer(order).data, msg='订单状态已更新')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_products(request):
    """供应商产品列表"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import get_supplier_products
    search = request.query_params.get('search', '')
    products = get_supplier_products(account.supplier_id, search)
    return api_success(PublicProductSerializer(products, many=True).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_product_update_stock(request, pk):
    """供应商更新产品库存"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import update_product_stock
    stock_quantity = request.data.get('stock_quantity')
    if stock_quantity is None:
        return api_error(API_CODE.BAD_REQUEST, '请提供库存数量')

    try:
        product = update_product_stock(pk, account.supplier_id, int(stock_quantity))
        return api_success(PublicProductSerializer(product).data, msg='库存已更新')
    except Exception as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_collective_items(request):
    """供应商待报价的集采需求"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    # 获取当前供应商的集采参与记录
    participations = CollectiveParticipation.objects.select_related(
        'announcement', 'tenant', 'product'
    ).filter(supplier_id=account.supplier_id)

    status = request.query_params.get('status')
    if status:
        participations = participations.filter(status=status)

    participations = participations.order_by('-created_at')
    return api_success(CollectiveParticipationSerializer(participations, many=True).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_delivery_rules(request):
    """供应商配送规则列表"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    rules = SupplierDeliveryRule.objects.filter(supplier_id=account.supplier_id)
    return api_success(SupplierDeliveryRuleSerializer(rules, many=True).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_delivery_rule_create(request):
    """供应商创建配送规则"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    data = request.data.copy()
    data['supplier'] = account.supplier_id
    serializer = SupplierDeliveryRuleSerializer(data=data)
    if serializer.is_valid():
        try:
            serializer.save()
            return api_success(serializer.data, msg='配送规则已创建')
        except IntegrityError:
            return api_error(API_CODE.BAD_REQUEST, '该省份的配送规则已存在')
    return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')


@api_view(['PUT', 'DELETE'])
@permission_classes([AllowAny])
def supplier_portal_delivery_rule_detail(request, pk):
    """供应商更新/删除配送规则"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    try:
        rule = SupplierDeliveryRule.objects.get(pk=pk)
    except SupplierDeliveryRule.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '配送规则不存在')

    if rule.supplier_id != account.supplier_id:
        return api_error(API_CODE.FORBIDDEN, '无权操作此配送规则')

    if request.method == 'DELETE':
        rule.delete()
        return api_success({'deleted': True}, msg='配送规则已删除')

    data = request.data.copy()
    data.pop('supplier', None)
    serializer = SupplierDeliveryRuleSerializer(rule, data=data, partial=True)
    if serializer.is_valid():
        try:
            serializer.save()
            return api_success(serializer.data, msg='配送规则已更新')
        except IntegrityError:
            return api_error(API_CODE.BAD_REQUEST, '该省份的配送规则已存在')
    return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_submit_quote(request, pk):
    """供应商通过门户提交报价（支持首次报价、修改报价、报价备注）"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    quoted_unit_price = request.data.get('quoted_unit_price')
    if not quoted_unit_price:
        return api_error(API_CODE.BAD_REQUEST, '请提供报价单价')

    quote_notes = request.data.get('quote_notes', '')

    try:
        participation = CollectiveParticipation.objects.get(pk=pk)
        if participation.supplier_id != account.supplier_id:
            return api_error(API_CODE.FORBIDDEN, '无权操作此记录')

        from .services.collective_purchase import supplier_quote_participation
        count = supplier_quote_participation(
            participation.announcement_id,
            account.supplier_id,
            participation.product_id,
            quoted_unit_price,
            quote_notes
        )
        participation.refresh_from_db()
        return api_success(
            CollectiveParticipationSerializer(participation).data,
            msg=f'报价已提交，更新 {count} 条记录'
        )
    except CollectiveParticipation.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '参与记录不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_batch_quote(request):
    """供应商批量报价（支持报价备注）"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    announcement_id = request.data.get('announcement_id')
    quotes = request.data.get('quotes', [])
    if not announcement_id or not quotes:
        return api_error(API_CODE.BAD_REQUEST, '缺少公告ID或报价数据')

    try:
        from .services.collective_purchase import supplier_batch_quote
        results = supplier_batch_quote(announcement_id, account.supplier_id, quotes)
        success_count = len(results.get('success', []))
        error_count = len(results.get('errors', []))
        msg = f'批量报价完成，成功 {success_count} 个'
        if error_count:
            msg += f'，失败 {error_count} 个'
        return api_success(results, msg=msg)
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_aggregate_demand(request):
    """供应商门户 — 集采汇总需求视图（按公告+产品聚合）"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    try:
        from .services.collective_purchase import get_supplier_aggregated_demand
        result = get_supplier_aggregated_demand(account.supplier_id)
        return api_success(result)
    except Exception as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_decline_quote(request, pk):
    """供应商拒绝报价"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    reason = request.data.get('reason', '')

    try:
        participation = CollectiveParticipation.objects.get(pk=pk)
        if participation.supplier_id != account.supplier_id:
            return api_error(API_CODE.FORBIDDEN, '无权操作此记录')

        from .services.collective_purchase import supplier_decline_quote
        count = supplier_decline_quote(
            participation.announcement_id,
            account.supplier_id,
            participation.product_id,
            reason
        )
        return api_success(
            {'declined_count': count},
            msg=f'已拒绝报价，影响 {count} 条记录'
        )
    except CollectiveParticipation.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '参与记录不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


# ========== 供应商门户 — 产品管理 CRUD ==========

@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_product_create(request):
    """供应商创建产品"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import create_product
    name = request.data.get('name', '').strip()
    if not name:
        return api_error(API_CODE.BAD_REQUEST, '产品名称不能为空')

    try:
        product = create_product(account.supplier_id, request.data)
        return api_success(PublicProductSerializer(product).data, msg='产品已创建')
    except Exception as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_product_update(request, pk):
    """供应商编辑产品"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import update_product
    try:
        product = update_product(pk, account.supplier_id, request.data)
        return api_success(PublicProductSerializer(product).data, msg='产品已更新')
    except PublicProduct.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '产品不存在')
    except Exception as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_product_toggle_status(request, pk):
    """供应商上下架产品"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import toggle_product_status
    try:
        product = toggle_product_status(pk, account.supplier_id)
        return api_success(PublicProductSerializer(product).data, msg='产品状态已切换')
    except PublicProduct.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '产品不存在')
    except Exception as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['DELETE'])
@permission_classes([AllowAny])
def supplier_portal_product_delete(request, pk):
    """供应商删除产品"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import delete_product
    try:
        delete_product(pk, account.supplier_id)
        return api_success({}, msg='产品已删除')
    except PublicProduct.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '产品不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


# ========== 供应商门户 — 资质管理 ==========

@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_qualifications(request):
    """供应商资质列表"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import get_supplier_qualifications
    quals = get_supplier_qualifications(account.supplier_id)
    return api_success(SupplierQualificationSerializer(quals, many=True).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_qualification_create(request):
    """供应商上传资质"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import create_qualification
    qualification_type = request.data.get('qualification_type', '').strip()
    if not qualification_type:
        return api_error(API_CODE.BAD_REQUEST, '资质类型不能为空')

    try:
        qual = create_qualification(account.supplier_id, request.data)
        return api_success(SupplierQualificationSerializer(qual).data, msg='资质已上传')
    except Exception as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['DELETE'])
@permission_classes([AllowAny])
def supplier_portal_qualification_delete(request, pk):
    """供应商删除资质"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import delete_qualification
    try:
        delete_qualification(pk, account.supplier_id)
        return api_success({}, msg='资质已删除')
    except SupplierQualification.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '资质不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


# 供应商门户文件上传大小/扩展名限制
_SP_UPLOAD_MAX_SIZE = 20 * 1024 * 1024
_SP_UPLOAD_ALLOWED_EXT = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'}


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_qualification_upload(request):
    """供应商门户：上传资质文件 + OCR 识别"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    file_obj = request.FILES.get('file')
    if not file_obj:
        return api_error(API_CODE.BAD_REQUEST, '请选择要上传的文件')

    if file_obj.size > _SP_UPLOAD_MAX_SIZE:
        return api_error(API_CODE.BAD_REQUEST, '文件大小不能超过20MB')

    ext = os.path.splitext(file_obj.name)[1].lower()
    if ext not in _SP_UPLOAD_ALLOWED_EXT:
        return api_error(API_CODE.BAD_REQUEST, '仅支持图片或PDF文件')

    filename = f'{uuid.uuid4().hex}{ext}'
    subdir = 'qualifications'
    path = os.path.join(subdir, filename)

    os.makedirs(os.path.join(settings.MEDIA_ROOT, subdir), exist_ok=True)
    with default_storage.open(path, 'wb+') as dest:
        for chunk in file_obj.chunks():
            dest.write(chunk)

    url = request.build_absolute_uri(settings.MEDIA_URL + path.replace('\\', '/'))

    # OCR 识别
    qual_type = request.POST.get('qualification_type', '') or request.data.get('qualification_type', '')
    from .ocr_service import recognize_qualification
    ocr_result = recognize_qualification(url, qualification_type=qual_type)

    return api_success({
        'url': url,
        'name': file_obj.name,
        'size': file_obj.size,
        'type': file_obj.content_type or '',
        'ocr': ocr_result,
    })


@api_view(['PUT'])
@permission_classes([AllowAny])
def supplier_portal_qualification_update(request, pk):
    """供应商门户：更新资质信息"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import update_qualification
    try:
        qual = update_qualification(pk, account.supplier_id, request.data)
        return api_success(SupplierQualificationSerializer(qual).data, msg='资质已更新')
    except SupplierQualification.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '资质不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_tenants(request):
    """供应商门户：获取与该供应商有过业务往来的租户列表"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from apps.platform.models import Tenant
    supplier_id = account.supplier_id

    # 已有订单的租户
    order_tenant_ids = set(
        ProcurementOrder.objects.filter(supplier_id=supplier_id)
        .values_list('tenant_id', flat=True)
    )
    # 已有首营记录的租户
    fo_tenant_ids = set(
        FirstOperationRecord.objects.filter(seller_supplier_id=supplier_id)
        .values_list('buyer_tenant_id', flat=True)
    )
    all_tenant_ids = order_tenant_ids | fo_tenant_ids

    tenants = Tenant.objects.filter(id__in=all_tenant_ids).values(
        'id', 'name', 'enterprise_id', 'province', 'city', 'channel'
    )

    # 标注每个租户的首营状态
    result = []
    for t in tenants:
        fo = FirstOperationRecord.objects.filter(
            buyer_tenant_id=t['id'],
            seller_supplier_id=supplier_id
        ).order_by('-created_at').first()
        fo_status = fo.status if fo else None
        fo_status_display = fo.get_status_display() if fo else None
        result.append({
            **t,
            'channel_display': dict(Tenant._meta.get_field('channel').choices).get(t['channel'], ''),
            'first_operation_status': fo_status,
            'first_operation_status_display': fo_status_display,
        })

    return api_success(result)


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_first_operation_create(request):
    """供应商门户：手动新建/同步首营记录"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    tenant_id = request.data.get('tenant_id')
    if not tenant_id:
        return api_error(API_CODE.BAD_REQUEST, '请选择租户')

    from .services.first_operation import create_first_operation
    try:
        record, created, source = create_first_operation(
            tenant_id=tenant_id,
            supplier_id=account.supplier_id,
            created_by=account.username,
            allow_draft=True,
        )
        if record is None:
            return api_error(API_CODE.BAD_REQUEST, '无法创建首营记录')

        source_msg = {
            'reused': '首营记录已存在，直接复用',
            'synced': '供应商API确认已建立首营，自动同步',
            'draft': '已创建首营草稿记录',
        }.get(source, '操作成功')

        return api_success(
            FirstOperationRecordSerializer(record).data,
            msg=source_msg,
        )
    except Exception as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


# ========== 供应商门户 — 退货管理 ==========

@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_returns(request):
    """供应商退货列表"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import get_supplier_returns
    status = request.query_params.get('status')
    returns = get_supplier_returns(account.supplier_id, status)
    return api_success(OrderReturnSerializer(returns, many=True).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_return_approve(request, pk):
    """供应商同意退货"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import approve_return
    remark = request.data.get('remark', '')
    try:
        ret = approve_return(pk, account.supplier_id, remark)
        return api_success(OrderReturnSerializer(ret).data, msg='已同意退货')
    except OrderReturn.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '退货申请不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_return_reject(request, pk):
    """供应商拒绝退货"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import reject_return
    remark = request.data.get('remark', '')
    if not remark:
        return api_error(API_CODE.BAD_REQUEST, '拒绝退货需要填写原因')
    try:
        ret = reject_return(pk, account.supplier_id, remark)
        return api_success(OrderReturnSerializer(ret).data, msg='已拒绝退货')
    except OrderReturn.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '退货申请不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_return_complete(request, pk):
    """供应商确认退货完成"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import complete_return
    tracking_number = request.data.get('tracking_number', '')
    try:
        ret = complete_return(pk, account.supplier_id, tracking_number)
        return api_success(OrderReturnSerializer(ret).data, msg='退货已完成')
    except OrderReturn.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '退货申请不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


# ========== 供应商门户 — 增强仪表盘 ==========

@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_enhanced_dashboard(request):
    """供应商增强仪表盘"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import get_enhanced_dashboard
    dashboard = get_enhanced_dashboard(account.supplier_id)
    return api_success(dashboard)


# ========== 供应商门户 — 消息通知 ==========

@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_notifications(request):
    """供应商通知列表"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import get_supplier_notifications, serialize_notification
    is_read = request.query_params.get('is_read')
    notification_type = request.query_params.get('type')
    limit = int(request.query_params.get('limit', 50))

    is_read_val = None
    if is_read == 'true':
        is_read_val = True
    elif is_read == 'false':
        is_read_val = False

    notifs = get_supplier_notifications(account.supplier_id, is_read_val, notification_type, limit)
    return api_success([serialize_notification(n) for n in notifs])


@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_unread_count(request):
    """未读通知数量"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import get_unread_notification_count
    count = get_unread_notification_count(account.supplier_id)
    return api_success({'count': count})


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_notification_read(request, pk):
    """标记单条通知为已读"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import mark_notification_read, serialize_notification
    try:
        notif = mark_notification_read(pk, account.supplier_id)
        return api_success(serialize_notification(notif), msg='已标记为已读')
    except Exception:
        return api_error(API_CODE.NOT_FOUND, '通知不存在')


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_notification_read_all(request):
    """标记所有通知为已读"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import mark_all_notifications_read
    count = mark_all_notifications_read(account.supplier_id)
    return api_success({'marked_count': count}, msg=f'已标记 {count} 条通知为已读')


# ========== 供应商门户 — 订单导出 ==========

@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_orders_export(request):
    """导出供应商订单为 CSV"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import export_orders_csv
    status = request.query_params.get('status')
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')

    try:
        csv_content, filename = export_orders_csv(
            account.supplier_id, status, date_from, date_to
        )
        response = HttpResponse(csv_content, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    except Exception as e:
        return api_error(API_CODE.INTERNAL_ERROR, f'导出失败: {str(e)}')


# ========== 供应商门户 — 对账单 ==========

@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_reconciliation(request):
    """供应商对账单（汇总+明细）"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import get_reconciliation
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')

    recon = get_reconciliation(account.supplier_id, date_from, date_to)
    return api_success(recon)


@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_reconciliation_export(request):
    """导出供应商对账单为 CSV"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import export_reconciliation_csv
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')

    try:
        csv_content, filename = export_reconciliation_csv(
            account.supplier_id, date_from, date_to
        )
        response = HttpResponse(csv_content, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    except Exception as e:
        return api_error(API_CODE.INTERNAL_ERROR, f'导出失败: {str(e)}')


# ============================================================
# 供应商钱包 & 提现
# ============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_balance(request):
    """获取供应商钱包余额"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import get_supplier_balance
    balance = get_supplier_balance(account.supplier_id)
    return api_success(balance)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def supplier_portal_withdrawals(request):
    """提现记录列表 (GET) / 发起提现 (POST)"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    if request.method == 'GET':
        from .services.supplier_portal import get_withdrawals
        status = request.query_params.get('status', 'all')
        records = get_withdrawals(account.supplier_id, status)
        from .serializers import WithdrawalRecordSerializer
        return api_success(WithdrawalRecordSerializer(records, many=True).data)

    # POST — 发起提现
    amount = request.data.get('amount')
    bank_name = request.data.get('bank_name', '').strip()
    bank_account = request.data.get('bank_account', '').strip()
    bank_holder = request.data.get('bank_holder', '').strip()
    remark = request.data.get('remark', '').strip()

    if not amount:
        return api_error(API_CODE.BAD_REQUEST, '请输入提现金额')
    if not bank_name or not bank_account or not bank_holder:
        return api_error(API_CODE.BAD_REQUEST, '请完整填写银行信息')

    from .services.supplier_portal import create_withdrawal
    try:
        withdrawal = create_withdrawal(
            account.supplier_id, amount,
            bank_name, bank_account, bank_holder, remark
        )
        from .serializers import WithdrawalRecordSerializer
        return api_success(
            WithdrawalRecordSerializer(withdrawal).data,
            msg=f'提现申请已提交，编号 {withdrawal.withdrawal_number}'
        )
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_withdrawal_cancel(request, pk):
    """取消提现申请"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import cancel_withdrawal
    try:
        withdrawal = cancel_withdrawal(pk, account.supplier_id)
        from .serializers import WithdrawalRecordSerializer
        return api_success(
            WithdrawalRecordSerializer(withdrawal).data,
            msg='提现已取消'
        )
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


# ============================================================
# 供应商门户 — 银行卡管理
# ============================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_bank_send_code(request):
    """发送银行卡修改验证码至平台管理员手机"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import send_bank_verify_code
    try:
        result = send_bank_verify_code(account.supplier_id)
        # 临时返回 code 便于测试；生产环境接入短信后应移除 code 字段
        return api_success(
            {'phone_masked': result['phone_masked'], 'expires_in': result['expires_in'], 'code': result['code']},
            msg=f'验证码已发送至管理员手机 {result["phone_masked"]}'
        )
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_bank_update(request):
    """校验验证码并更新供应商银行卡信息"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.supplier_portal import update_bank_info
    try:
        data = update_bank_info(
            account.supplier_id,
            request.data.get('verify_code', '').strip(),
            request.data.get('bank_name', '').strip(),
            request.data.get('bank_account', '').strip(),
            request.data.get('bank_holder', '').strip(),
        )
        return api_success(data, msg='银行卡信息已更新')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


# ============================================================
# 平台后台 — 提现管理
# ============================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def admin_withdrawal_list(request):
    """平台后台：获取所有供应商提现记录"""
    from .services.supplier_portal import admin_get_all_withdrawals, admin_get_withdrawal_stats
    status = request.query_params.get('status', 'all')
    search = request.query_params.get('search', '').strip()

    records = admin_get_all_withdrawals(status, search)
    stats = admin_get_withdrawal_stats()

    from .serializers import WithdrawalRecordSerializer
    data = {
        'stats': stats,
        'records': WithdrawalRecordSerializer(records, many=True).data,
    }
    return api_success(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def admin_withdrawal_approve(request, pk):
    """平台后台：审核通过提现申请 (pending → processing)"""
    from .services.supplier_portal import admin_approve_withdrawal
    admin_remark = request.data.get('admin_remark', '').strip()
    try:
        withdrawal = admin_approve_withdrawal(pk, admin_remark)
        from .serializers import WithdrawalRecordSerializer
        return api_success(
            WithdrawalRecordSerializer(withdrawal).data,
            msg=f'提现 {withdrawal.withdrawal_number} 已审核通过'
        )
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def admin_withdrawal_reject(request, pk):
    """平台后台：拒绝提现申请 (pending → rejected)"""
    from .services.supplier_portal import admin_reject_withdrawal
    admin_remark = request.data.get('admin_remark', '').strip()
    try:
        withdrawal = admin_reject_withdrawal(pk, admin_remark)
        from .serializers import WithdrawalRecordSerializer
        return api_success(
            WithdrawalRecordSerializer(withdrawal).data,
            msg=f'提现 {withdrawal.withdrawal_number} 已拒绝'
        )
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def admin_withdrawal_complete(request, pk):
    """平台后台：确认提现已到账 (processing → completed)"""
    from .services.supplier_portal import admin_complete_withdrawal
    admin_remark = request.data.get('admin_remark', '').strip()
    try:
        withdrawal = admin_complete_withdrawal(pk, admin_remark)
        from .serializers import WithdrawalRecordSerializer
        return api_success(
            WithdrawalRecordSerializer(withdrawal).data,
            msg=f'提现 {withdrawal.withdrawal_number} 已确认到账'
        )
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_platform_permission('platform.publicDatabase.manage')
def admin_wallet_overview(request):
    """平台后台：所有供应商钱包概览"""
    from .services.supplier_portal import admin_get_wallets_overview
    data = admin_get_wallets_overview()
    return api_success(data)


# ============================================================
# 租户资质管理
# ============================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tenant_qualifications(request):
    """租户资质列表 / 创建"""
    if request.method == 'GET':
        # 优先从 middleware 获取租户上下文（X-Tenant-ID 头或 JWT 推断）
        tenant_id = getattr(request, 'tenant_id', None)
        if not tenant_id:
            tenant_id = request.query_params.get('tenant_id')
        if not tenant_id:
            # 兼容旧逻辑：尝试从当前用户的租户获取
            user = request.user
            tenant_id = getattr(user, 'tenant_id', None) or getattr(
                getattr(user, 'tenant_profile', None), 'tenant_id', None
            )
        if not tenant_id:
            return api_error(API_CODE.BAD_REQUEST, '缺少 tenant_id')

        from .services.first_operation import refresh_tenant_qualification_status
        refresh_tenant_qualification_status(tenant_id)

        qs = TenantQualification.objects.filter(tenant_id=tenant_id)
        return api_success(TenantQualificationSerializer(qs, many=True).data)

    # POST — 创建资质
    tenant_id = getattr(request, 'tenant_id', None) or request.data.get('tenant_id')
    if not tenant_id:
        user = request.user
        tenant_id = getattr(user, 'tenant_id', None) or getattr(
            getattr(user, 'tenant_profile', None), 'tenant_id', None
        )
    if not tenant_id:
        return api_error(API_CODE.BAD_REQUEST, '缺少 tenant_id')

    data = request.data.copy()
    data['tenant'] = tenant_id
    serializer = TenantQualificationSerializer(data=data)
    if serializer.is_valid():
        qual = serializer.save()
        # 自动更新状态
        from .services.first_operation import update_qualification_status
        update_qualification_status(qual)
        qual.save(update_fields=['status'])
        return api_success(TenantQualificationSerializer(qual).data, msg='资质已上传')
    return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def tenant_qualification_detail(request, pk):
    """租户资质编辑 / 删除"""
    try:
        qual = TenantQualification.objects.get(pk=pk)
    except TenantQualification.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '资质不存在')

    if request.method == 'PUT':
        serializer = TenantQualificationSerializer(qual, data=request.data, partial=True)
        if serializer.is_valid():
            qual = serializer.save()
            from .services.first_operation import update_qualification_status
            update_qualification_status(qual)
            qual.save(update_fields=['status'])
            return api_success(TenantQualificationSerializer(qual).data, msg='资质已更新')
        return api_error(API_CODE.BAD_REQUEST, f'参数错误: {serializer.errors}')

    if request.method == 'DELETE':
        qual.delete()
        return api_success(msg='资质已删除')


# ============================================================
# 首营资料管理
# ============================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def first_operations(request):
    """首营记录列表 / 创建"""
    if request.method == 'GET':
        # 优先从 middleware 获取租户上下文（X-Tenant-ID 头或 JWT 推断）
        tenant_id = getattr(request, 'tenant_id', None) or request.query_params.get('tenant_id')
        supplier_id = request.query_params.get('supplier_id')
        status = request.query_params.get('status')

        qs = FirstOperationRecord.objects.select_related('buyer_tenant', 'seller_supplier').all()
        if tenant_id:
            qs = qs.filter(buyer_tenant_id=tenant_id)
        if supplier_id:
            qs = qs.filter(seller_supplier_id=supplier_id)
        if status:
            qs = qs.filter(status=status)
        qs = qs.order_by('-created_at')
        return api_success(FirstOperationRecordSerializer(qs, many=True).data)

    # POST — 创建首营记录
    tenant_id = getattr(request, 'tenant_id', None) or request.data.get('tenant_id')
    supplier_id = request.data.get('supplier_id')
    created_by = request.data.get('created_by', '')

    if not tenant_id or not supplier_id:
        return api_error(API_CODE.BAD_REQUEST, '缺少租户ID或供应商ID')

    from .services.first_operation import create_first_operation
    try:
        record, created, source = create_first_operation(tenant_id, supplier_id, created_by, allow_draft=True)
        if source == 'reused':
            msg = '已有有效首营记录，直接复用'
        elif source == 'synced':
            msg = '供应商已开户且存在首营记录，系统自动同步'
        elif source == 'needs_initiation':
            return api_error(API_CODE.BAD_REQUEST, '未在供应商开户或无有效首营记录，请发起首营交换')
        else:
            msg = '首营记录已创建'
        return api_success(FirstOperationRecordSerializer(record).data, msg=msg)
    except Exception as e:
        return api_error(API_CODE.INTERNAL_ERROR, f'创建失败: {str(e)}')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def first_operation_detail(request, pk):
    """首营记录详情"""
    try:
        record = FirstOperationRecord.objects.select_related('buyer_tenant', 'seller_supplier').get(pk=pk)
    except FirstOperationRecord.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '首营记录不存在')
    return api_success(FirstOperationRecordSerializer(record).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def first_operation_submit(request, pk):
    """提交首营记录 → 资质互换"""
    from .services.first_operation import submit_first_operation
    try:
        record = submit_first_operation(pk)
        return api_success(FirstOperationRecordSerializer(record).data, msg='首营资料已提交，资质已互换')
    except FirstOperationRecord.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '首营记录不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def first_operation_confirm(request, pk):
    """双方互验确认"""
    from .services.first_operation import confirm_first_operation
    confirmer = request.data.get('confirmer', '')  # 'buyer' or 'seller'
    remark = request.data.get('remark', '')

    if confirmer not in ('buyer', 'seller'):
        return api_error(API_CODE.BAD_REQUEST, 'confirmer 必须是 buyer 或 seller')

    try:
        record = confirm_first_operation(pk, confirmer, remark)
        both = record.buyer_confirmed and record.seller_confirmed
        msg = '确认成功，双方已互验完成' if both else f'{confirmer}已确认'
        return api_success(FirstOperationRecordSerializer(record).data, msg=msg)
    except FirstOperationRecord.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '首营记录不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def first_operation_reject(request, pk):
    """拒绝首营记录"""
    from .services.first_operation import reject_first_operation
    rejecter = request.data.get('rejecter', '')
    remark = request.data.get('remark', '')

    if rejecter not in ('buyer', 'seller'):
        return api_error(API_CODE.BAD_REQUEST, 'rejecter 必须是 buyer 或 seller')

    try:
        record = reject_first_operation(pk, rejecter, remark)
        return api_success(FirstOperationRecordSerializer(record).data, msg='已拒绝首营记录')
    except FirstOperationRecord.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '首营记录不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def first_operation_esign(request, pk):
    """发起首营资料电子签章"""
    from .services.first_operation import initiate_esign
    provider = request.data.get('provider')
    try:
        record, result = initiate_esign(pk, provider)
        return api_success({
            'record': FirstOperationRecordSerializer(record).data,
            'sign_url': result.sign_url,
            'contract_id': result.contract_id,
        }, msg='签章流程已发起')
    except FirstOperationRecord.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '首营记录不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def first_operation_esign_status(request, pk):
    """查询首营签章状态"""
    from .services.first_operation import check_esign_status
    try:
        record = check_esign_status(pk)
        return api_success(FirstOperationRecordSerializer(record).data, msg=f'签章状态: {record.status}')
    except FirstOperationRecord.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '首营记录不存在')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def first_operation_mock_sign(request, pk):
    """模拟完成首营签章（开发/测试用）"""
    from .services.first_operation import mock_complete_esign
    try:
        record = mock_complete_esign(pk)
        return api_success(FirstOperationRecordSerializer(record).data, msg='签章已完成（模拟）')
    except FirstOperationRecord.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '首营记录不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


# ============================================================
# 供应商门户 — 首营资料
# ============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_first_operations(request):
    """供应商门户：首营记录列表"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    status = request.query_params.get('status')
    qs = FirstOperationRecord.objects.select_related('buyer_tenant', 'seller_supplier').filter(
        seller_supplier_id=account.supplier_id
    )
    if status:
        qs = qs.filter(status=status)
    qs = qs.order_by('-created_at')
    return api_success(FirstOperationRecordSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def supplier_portal_first_operation_detail(request, pk):
    """供应商门户：首营记录详情"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    try:
        record = FirstOperationRecord.objects.get(pk=pk)
        if record.seller_supplier_id != account.supplier_id:
            return api_error(API_CODE.FORBIDDEN, '无权查看此首营记录')
        return api_success(FirstOperationRecordSerializer(record).data)
    except FirstOperationRecord.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '首营记录不存在')


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_first_operation_confirm(request, pk):
    """供应商门户：确认首营记录"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.first_operation import confirm_first_operation
    remark = request.data.get('remark', '')
    try:
        record = confirm_first_operation(pk, 'seller', remark)
        if record.seller_supplier_id != account.supplier_id:
            return api_error(API_CODE.FORBIDDEN, '无权操作此首营记录')
        both = record.buyer_confirmed and record.seller_confirmed
        msg = '确认成功，双方已互验完成' if both else '供应商已确认'
        return api_success(FirstOperationRecordSerializer(record).data, msg=msg)
    except FirstOperationRecord.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '首营记录不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


@api_view(['POST'])
@permission_classes([AllowAny])
def supplier_portal_first_operation_reject(request, pk):
    """供应商门户：拒绝首营记录"""
    account = _get_supplier_account_from_request(request)
    if not account:
        return api_error(API_CODE.UNAUTHORIZED, '请先登录')

    from .services.first_operation import reject_first_operation
    remark = request.data.get('remark', '')
    try:
        record = reject_first_operation(pk, 'seller', remark)
        if record.seller_supplier_id != account.supplier_id:
            return api_error(API_CODE.FORBIDDEN, '无权操作此首营记录')
        return api_success(FirstOperationRecordSerializer(record).data, msg='已拒绝首营记录')
    except FirstOperationRecord.DoesNotExist:
        return api_error(API_CODE.NOT_FOUND, '首营记录不存在')
    except ValueError as e:
        return api_error(API_CODE.BAD_REQUEST, str(e))


# ============================================================
# 签章回调 Webhook（第三方签章服务回调）
# ============================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def esign_callback(request):
    """电子签章回调 webhook — 第三方签章服务完成签署后回调此接口

    请求体包含 contract_id 和 status。
    系统根据 contract_id 查找对应的首营记录或订单资质交换记录，更新状态。
    """
    contract_id = request.data.get('contract_id', '')
    status = request.data.get('status', '')

    if not contract_id or not status:
        return api_error(API_CODE.BAD_REQUEST, '缺少 contract_id 或 status')

    # 查找首营记录
    fo = FirstOperationRecord.objects.filter(e_signature_contract_id=contract_id).first()
    if fo:
        if status == 'signed' and fo.status == 'signing':
            from .services.first_operation import _complete_esign
            _complete_esign(fo)
            return api_success({'record_number': fo.record_number, 'status': 'signed'}, msg='首营签章完成')
        return api_success({'record_number': fo.record_number, 'status': fo.status}, msg='状态已同步')

    # 查找订单资质交换记录
    exchange = QualificationExchange.objects.filter(e_signature_contract_id=contract_id).first()
    if exchange:
        if status == 'signed' and exchange.status == 'signing':
            from .services.qualification import complete_e_signature
            complete_e_signature(exchange.order_id)
            return api_success({'order_number': exchange.order.order_number, 'status': 'signed'}, msg='订单签章完成')
        return api_success({'order_number': exchange.order.order_number, 'status': exchange.status}, msg='状态已同步')

    return api_error(API_CODE.NOT_FOUND, f'未找到 contract_id={contract_id} 对应的签章记录')
