"""
供应商门户认证服务 — Token 登录 + 身份验证 + B2B 管理
"""
import csv
import io
import logging
import secrets
from django.utils import timezone
from django.db.models import Sum, Count, Q
from datetime import timedelta
from decimal import Decimal
from ..models import (
    SupplierAccount, Supplier, PublicProduct, ProcurementOrder,
    CollectiveParticipation, CollectivePurchaseAnnouncement,
    SupplierQualification, OrderReturn, SupplierNotification,
    OrderItem, PaymentRecord,
    SupplierWallet, WithdrawalRecord,
)

logger = logging.getLogger(__name__)


def supplier_login(username, password):
    """
    供应商登录 — 用户名+密码 → 返回供应商信息和 API Token
    """
    try:
        account = SupplierAccount.objects.select_related('supplier').get(username=username)
    except SupplierAccount.DoesNotExist:
        return None, '用户名不存在'

    if not account.enabled:
        return None, '账号已禁用'

    if not account.check_password(password):
        return None, '密码错误'

    # 更新最后登录时间
    account.last_login_at = timezone.now()
    account.save(update_fields=['last_login_at'])

    # 如果没有 token，生成一个
    if not account.api_token:
        account.api_token = secrets.token_urlsafe(32)
        account.save(update_fields=['api_token'])

    return account, None


def get_supplier_by_token(token):
    """
    通过 API Token 获取供应商账号
    """
    try:
        account = SupplierAccount.objects.select_related('supplier').get(
            api_token=token, enabled=True
        )
        return account
    except SupplierAccount.DoesNotExist:
        return None


def get_supplier_dashboard(supplier_id):
    """
    供应商仪表盘数据
    """
    from ..models import (
        PublicProduct, ProcurementOrder, CollectiveParticipation,
        CollectivePurchaseAnnouncement,
    )
    from django.db.models import Sum, Count, Q

    supplier = Supplier.objects.get(id=supplier_id)

    # 产品统计
    products = PublicProduct.objects.filter(supplier=supplier)
    product_stats = {
        'total': products.count(),
        'active': products.filter(status='active').count(),
        'low_stock': products.filter(stock_quantity__lt=100).count(),
        'out_of_stock': products.filter(stock_quantity=0).count(),
    }

    # 订单统计
    orders = ProcurementOrder.objects.filter(supplier=supplier)
    order_stats = {
        'total': orders.count(),
        'pending': orders.filter(status__in=['submitted', 'qualified', 'paying']).count(),
        'paid': orders.filter(status__in=['paid', 'split', 'delivering']).count(),
        'completed': orders.filter(status='completed').count(),
        'total_amount': str(orders.aggregate(t=Sum('total_amount'))['t'] or 0),
        'commission': str(orders.aggregate(t=Sum('commission_amount'))['t'] or 0),
        'net_income': str(orders.aggregate(t=Sum('supplier_amount'))['t'] or 0),
    }

    # 集采参与统计
    participations = CollectiveParticipation.objects.filter(supplier=supplier)
    collective_stats = {
        'total': participations.count(),
        'registered': participations.filter(status='registered').count(),
        'quoted': participations.filter(status='quoted').count(),
        'ordered': participations.filter(status='ordered').count(),
    }

    # 待报价的集采公告
    pending_announcements = CollectivePurchaseAnnouncement.objects.filter(
        status='quoting'
    ).count()

    return {
        'supplier': {
            'id': supplier.id,
            'name': supplier.name,
            'code': supplier.code,
            'enabled': supplier.enabled,
            'qualification_status': supplier.qualification_status,
        },
        'products': product_stats,
        'orders': order_stats,
        'collective': collective_stats,
        'pending_quote_announcements': pending_announcements,
    }


def get_supplier_orders(supplier_id, status=None):
    """获取供应商订单列表"""
    from ..models import ProcurementOrder

    qs = ProcurementOrder.objects.select_related('tenant').filter(supplier_id=supplier_id)
    if status:
        qs = qs.filter(status=status)
    return qs.order_by('-created_at')


def update_order_status_by_supplier(order_id, supplier_id, new_status, tracking_number=''):
    """
    供应商更新订单状态（仅允许供应商操作自己的订单）
    允许的状态转换：submitted → delivering → completed
    """
    from ..models import ProcurementOrder

    order = ProcurementOrder.objects.get(id=order_id, supplier_id=supplier_id)

    allowed_transitions = {
        'submitted': ['delivering', 'cancelled'],
        'paid': ['delivering'],
        'split': ['delivering'],
        'delivering': ['completed'],
    }

    current = order.status
    if new_status not in allowed_transitions.get(current, []):
        raise ValueError(f'不允许从 {current} 状态切换到 {new_status}')

    order.status = new_status
    if tracking_number:
        order.tracking_number = tracking_number
    order.save(update_fields=['status', 'tracking_number', 'notes', 'updated_at'])

    # 触发通知：订单完成
    if new_status == 'completed':
        try:
            notify_order_completed(order)
        except Exception:
            logger.warning('Failed to send order completed notification', exc_info=True)

    return order


def get_supplier_products(supplier_id, search=''):
    """获取供应商产品列表"""
    from ..models import PublicProduct

    qs = PublicProduct.objects.filter(supplier_id=supplier_id)
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(specification__icontains=search))
    return qs.order_by('-updated_at')


def update_product_stock(product_id, supplier_id, stock_quantity):
    """供应商更新产品库存"""
    from ..models import PublicProduct

    product = PublicProduct.objects.get(id=product_id, supplier_id=supplier_id)
    old_stock = product.stock_quantity
    product.stock_quantity = stock_quantity
    if stock_quantity == 0:
        product.status = 'out_of_stock'
    elif product.status == 'out_of_stock' and stock_quantity > 0:
        product.status = 'active'
    product.save(update_fields=['stock_quantity', 'status', 'updated_at'])

    # 库存低于100时触发通知（仅当从>=100降到<100时）
    if old_stock >= 100 and stock_quantity < 100:
        try:
            notify_low_stock(product)
        except Exception:
            pass

    return product


# ========== 产品管理 CRUD ==========

def create_product(supplier_id, data):
    """供应商创建产品"""
    product = PublicProduct.objects.create(
        supplier_id=supplier_id,
        product_code=data.get('product_code', ''),
        name=data['name'],
        trade_name=data.get('trade_name', ''),
        specification=data.get('specification', ''),
        manufacturer=data.get('manufacturer', ''),
        dosage_form=data.get('dosage_form', ''),
        unit=data.get('unit', ''),
        price=Decimal(str(data.get('price', 0))),
        min_order_quantity=int(data.get('min_order_quantity', 1)),
        category=data.get('category', ''),
        approval_number=data.get('approval_number', ''),
        barcode=data.get('barcode', ''),
        image_url=data.get('image_url', ''),
        storage_condition=data.get('storage_condition', ''),
        stock_quantity=int(data.get('stock_quantity', 0)),
        status='active' if int(data.get('stock_quantity', 0)) > 0 else 'out_of_stock',
        sales_regions=data.get('sales_regions') or [],
        sales_channels=data.get('sales_channels') or [],
    )
    return product


def update_product(product_id, supplier_id, data):
    """供应商编辑产品"""
    product = PublicProduct.objects.get(id=product_id, supplier_id=supplier_id)

    allowed_fields = [
        'product_code', 'name', 'trade_name', 'specification', 'manufacturer',
        'dosage_form', 'unit', 'price', 'min_order_quantity', 'category',
        'approval_number', 'barcode', 'image_url', 'storage_condition',
        'stock_quantity', 'status', 'sales_regions', 'sales_channels',
    ]
    for field in allowed_fields:
        if field in data:
            if field == 'price':
                setattr(product, field, Decimal(str(data[field])))
            elif field in ('min_order_quantity', 'stock_quantity'):
                setattr(product, field, int(data[field]))
            else:
                setattr(product, field, data[field])

    # 库存为 0 自动设为缺货
    if 'stock_quantity' in data and int(data['stock_quantity']) == 0:
        product.status = 'out_of_stock'
    elif 'stock_quantity' in data and int(data['stock_quantity']) > 0 and product.status == 'out_of_stock':
        if 'status' not in data:
            product.status = 'active'

    product.save()
    return product


def toggle_product_status(product_id, supplier_id):
    """供应商上下架产品"""
    product = PublicProduct.objects.get(id=product_id, supplier_id=supplier_id)
    if product.status == 'active':
        product.status = 'inactive'
    elif product.status == 'inactive':
        product.status = 'active' if product.stock_quantity > 0 else 'out_of_stock'
    else:  # out_of_stock
        product.status = 'active' if product.stock_quantity > 0 else 'inactive'
    product.save(update_fields=['status', 'updated_at'])
    return product


def delete_product(product_id, supplier_id):
    """供应商删除产品（有未完成订单不允许删除）"""
    product = PublicProduct.objects.get(id=product_id, supplier_id=supplier_id)
    # 检查是否有未完成订单
    active_orders = ProcurementOrder.objects.filter(
        supplier_id=supplier_id,
        items__product_id=product_id,
        status__in=['submitted', 'paid', 'split', 'delivering']
    ).exists()
    if active_orders:
        raise ValueError('该产品有未完成的订单，无法删除')
    product.delete()


# ========== 资质管理 ==========

def get_supplier_qualifications(supplier_id):
    """获取供应商资质列表"""
    return SupplierQualification.objects.filter(supplier_id=supplier_id).order_by('-created_at')


def create_qualification(supplier_id, data):
    """供应商上传资质"""
    qual = SupplierQualification.objects.create(
        supplier_id=supplier_id,
        qualification_type=data['qualification_type'],
        qualification_name=data.get('qualification_name', ''),
        file_url=data.get('file_url', ''),
        file_name=data.get('file_name', ''),
        license_number=data.get('license_number', ''),
        expiry_date=data.get('expiry_date') or None,
        verified=False,
    )
    return qual


def update_qualification(qual_id, supplier_id, data):
    """供应商更新资质"""
    qual = SupplierQualification.objects.get(id=qual_id)
    if qual.supplier_id != supplier_id:
        raise ValueError('无权操作此资质')
    for field in ['qualification_type', 'qualification_name', 'license_number',
                  'expiry_date', 'file_url', 'file_name', 'file_size']:
        if field in data:
            val = data[field]
            if field == 'expiry_date':
                # 空字符串或"长期" → null（长期有效）
                val = val if val and val != '长期' else None
            setattr(qual, field, val)
    qual.save()
    return qual


def delete_qualification(qual_id, supplier_id):
    """供应商删除资质"""
    qual = SupplierQualification.objects.get(id=qual_id)
    if qual.supplier_id != supplier_id:
        raise ValueError('无权操作此资质')
    qual.delete()


def get_qualification_alerts(supplier_id):
    """获取资质到期预警（30天内到期）"""
    today = timezone.now().date()
    alert_date = today + timedelta(days=30)
    return SupplierQualification.objects.filter(
        supplier_id=supplier_id,
        expiry_date__isnull=False,
        expiry_date__lte=alert_date,
        expiry_date__gte=today,
    ).count()


def get_qualification_expired_count(supplier_id):
    """获取已过期资质数量"""
    today = timezone.now().date()
    return SupplierQualification.objects.filter(
        supplier_id=supplier_id,
        expiry_date__isnull=False,
        expiry_date__lt=today,
    ).count()


# ========== 退货管理 ==========

def get_supplier_returns(supplier_id, status=None):
    """获取供应商退货列表"""
    qs = OrderReturn.objects.select_related('order', 'tenant').filter(supplier_id=supplier_id)
    if status:
        qs = qs.filter(status=status)
    return qs.order_by('-created_at')


def approve_return(return_id, supplier_id, remark=''):
    """供应商同意退货"""
    ret = OrderReturn.objects.get(id=return_id, supplier_id=supplier_id)
    if ret.status != 'requested':
        raise ValueError(f'当前状态 {ret.status} 不允许同意退货')
    ret.status = 'approved'
    ret.supplier_remark = remark
    ret.processed_at = timezone.now()
    ret.save(update_fields=['status', 'supplier_remark', 'processed_at', 'updated_at'])
    # 更新关联订单支付状态为退款中
    order = ret.order
    order.payment_status = 'refunding'
    order.save(update_fields=['payment_status', 'updated_at'])
    # 触发通知
    try:
        create_notification(
            supplier_id=supplier_id,
            notification_type='return_processed',
            title=f'退货已同意 {ret.return_number}',
            content=f'退货申请 {ret.return_number} 已同意，等待客户寄回商品。',
            related_type='return', related_id=ret.id,
        )
    except Exception:
        pass
    return ret


def reject_return(return_id, supplier_id, remark=''):
    """供应商拒绝退货"""
    ret = OrderReturn.objects.get(id=return_id, supplier_id=supplier_id)
    if ret.status != 'requested':
        raise ValueError(f'当前状态 {ret.status} 不允许拒绝退货')
    ret.status = 'rejected'
    ret.supplier_remark = remark
    ret.processed_at = timezone.now()
    ret.save(update_fields=['status', 'supplier_remark', 'processed_at', 'updated_at'])
    # 触发通知
    try:
        create_notification(
            supplier_id=supplier_id,
            notification_type='return_processed',
            title=f'退货已拒绝 {ret.return_number}',
            content=f'退货申请 {ret.return_number} 已拒绝。原因：{remark}',
            related_type='return', related_id=ret.id,
        )
    except Exception:
        pass
    return ret


def complete_return(return_id, supplier_id, tracking_number=''):
    """供应商确认退货完成"""
    ret = OrderReturn.objects.get(id=return_id, supplier_id=supplier_id)
    if ret.status not in ('approved', 'returning'):
        raise ValueError(f'当前状态 {ret.status} 不允许完成退货')
    ret.status = 'completed'
    ret.return_tracking_number = tracking_number or ret.return_tracking_number
    ret.completed_at = timezone.now()
    ret.save(update_fields=['status', 'return_tracking_number', 'completed_at', 'updated_at'])
    # 更新关联订单
    order = ret.order
    order.payment_status = 'refunded'
    order.status = 'refunded'
    order.save(update_fields=['payment_status', 'status', 'updated_at'])
    # 触发通知
    try:
        create_notification(
            supplier_id=supplier_id,
            notification_type='return_processed',
            title=f'退货已完成 {ret.return_number}',
            content=f'退货 {ret.return_number} 已完成，退款金额 ¥{ret.refund_amount}。',
            related_type='return', related_id=ret.id,
        )
    except Exception:
        pass
    return ret


# ========== 增强仪表盘 ==========

def get_enhanced_dashboard(supplier_id):
    """增强仪表盘 — 含趋势、预警、统计"""
    supplier = Supplier.objects.get(id=supplier_id)
    today = timezone.now()
    month_ago = today - timedelta(days=30)

    # 产品统计
    products = PublicProduct.objects.filter(supplier=supplier)
    product_stats = {
        'total': products.count(),
        'active': products.filter(status='active').count(),
        'inactive': products.filter(status='inactive').count(),
        'out_of_stock': products.filter(status='out_of_stock').count(),
        'low_stock': products.filter(stock_quantity__lt=100, stock_quantity__gt=0).count(),
    }

    # 订单统计
    orders = ProcurementOrder.objects.filter(supplier=supplier)
    order_stats = {
        'total': orders.count(),
        'pending': orders.filter(status__in=['submitted', 'qualified', 'paying']).count(),
        'paid': orders.filter(status__in=['paid', 'split', 'delivering']).count(),
        'completed': orders.filter(status='completed').count(),
        'cancelled': orders.filter(status='cancelled').count(),
        'refunded': orders.filter(status='refunded').count(),
        'today_count': orders.filter(created_at__date=today.date()).count(),
        'month_count': orders.filter(created_at__gte=month_ago).count(),
        'total_amount': str(orders.aggregate(t=Sum('total_amount'))['t'] or 0),
        'month_amount': str(orders.filter(created_at__gte=month_ago).aggregate(t=Sum('total_amount'))['t'] or 0),
        'commission': str(orders.aggregate(t=Sum('commission_amount'))['t'] or 0),
        'net_income': str(orders.aggregate(t=Sum('supplier_amount'))['t'] or 0),
    }

    # 集采统计
    participations = CollectiveParticipation.objects.filter(supplier=supplier)
    collective_stats = {
        'total': participations.count(),
        'registered': participations.filter(status='registered').count(),
        'quoted': participations.filter(status='quoted').count(),
        'ordered': participations.filter(status='ordered').count(),
    }

    # 退货统计
    returns = OrderReturn.objects.filter(supplier=supplier)
    return_stats = {
        'total': returns.count(),
        'pending': returns.filter(status='requested').count(),
        'approved': returns.filter(status='approved').count(),
        'completed': returns.filter(status='completed').count(),
    }

    # 资质预警
    qual_expiring_soon = get_qualification_alerts(supplier_id)
    qual_expired = get_qualification_expired_count(supplier_id)
    qual_expiry_list = []
    alert_date = today.date() + timedelta(days=30)
    # 包含已过期和30天内到期的资质
    for q in SupplierQualification.objects.filter(
        supplier_id=supplier_id, expiry_date__isnull=False,
        expiry_date__lte=alert_date,
    ).order_by('expiry_date'):
        days_left = (q.expiry_date - today.date()).days
        qual_expiry_list.append({
            'id': q.id,
            'name': q.qualification_name,
            'qualification_type': q.qualification_type,
            'expiry_date': q.expiry_date.isoformat(),
            'days_until_expiry': days_left,
            'is_expired': days_left < 0,
        })

    # 库存预警
    low_stock_products = []
    for p in products.filter(stock_quantity__lt=100).order_by('stock_quantity')[:10]:
        low_stock_products.append({
            'id': p.id,
            'name': p.name,
            'specification': p.specification,
            'stock_quantity': p.stock_quantity,
            'unit': p.unit,
            'status': p.status,
        })

    # 月度销售趋势（近6个月）
    monthly_trend = []
    for i in range(5, -1, -1):
        month_start = today.replace(day=1) - timedelta(days=i * 30)
        month_end = month_start + timedelta(days=30)
        month_orders = orders.filter(created_at__gte=month_start, created_at__lt=month_end)
        monthly_trend.append({
            'month': f'{month_start.month}月',
            'order_count': month_orders.count(),
            'amount': str(month_orders.aggregate(t=Sum('total_amount'))['t'] or 0),
        })

    return {
        'supplier': {
            'id': supplier.id,
            'name': supplier.name,
            'code': supplier.code,
            'enabled': supplier.enabled,
            'qualification_status': supplier.qualification_status,
            'contact_name': supplier.contact_name,
            'contact_phone': supplier.contact_phone,
        },
        'products': product_stats,
        'orders': order_stats,
        'collective': collective_stats,
        'returns': return_stats,
        'pending_quote_announcements': CollectivePurchaseAnnouncement.objects.filter(status='quoting').count(),
        'qualification_alerts': {'expiring_soon': qual_expiring_soon, 'expired': qual_expired},
        'qualification_expiry': qual_expiry_list,
        'low_stock_products': low_stock_products,
        'monthly_trend': [{'month': m['month'], 'count': m['order_count'], 'amount': m['amount']} for m in monthly_trend],
    }


# ========== 消息通知 ==========

def create_notification(supplier_id, notification_type, title, content,
                         related_type='', related_id=None, extra_data=None):
    """创建供应商通知（内部辅助函数）"""
    return SupplierNotification.objects.create(
        supplier_id=supplier_id,
        notification_type=notification_type,
        title=title,
        content=content,
        related_type=related_type,
        related_id=related_id,
        extra_data=extra_data or {},
    )


def notify_order_created(order):
    """新订单通知 — 订单创建时自动触发"""
    create_notification(
        supplier_id=order.supplier_id,
        notification_type='order_new',
        title=f'新订单 {order.order_number}',
        content=f'您收到来自 {order.tenant.name} 的新订单，订单金额 ¥{order.total_amount}，请及时处理。',
        related_type='order',
        related_id=order.id,
        extra_data={'order_number': order.order_number, 'amount': str(order.total_amount)},
    )


def notify_order_paid(order):
    """订单已支付通知"""
    create_notification(
        supplier_id=order.supplier_id,
        notification_type='order_paid',
        title=f'订单已支付 {order.order_number}',
        content=f'订单 {order.order_number} 已完成支付，金额 ¥{order.total_amount}，平台佣金 ¥{order.commission_amount}，您应得 ¥{order.supplier_amount}。请尽快安排发货。',
        related_type='order',
        related_id=order.id,
        extra_data={'order_number': order.order_number, 'supplier_amount': str(order.supplier_amount)},
    )


def notify_order_completed(order):
    """订单已完成通知"""
    create_notification(
        supplier_id=order.supplier_id,
        notification_type='order_completed',
        title=f'订单已完成 {order.order_number}',
        content=f'订单 {order.order_number} 已确认完成，交易金额 ¥{order.total_amount}。',
        related_type='order',
        related_id=order.id,
    )


def notify_return_requested(ret):
    """退货申请通知"""
    create_notification(
        supplier_id=ret.supplier_id,
        notification_type='return_requested',
        title=f'退货申请 {ret.return_number}',
        content=f'客户 {ret.tenant.name} 申请退货，退款金额 ¥{ret.refund_amount}，原因：{ret.reason}。请及时处理。',
        related_type='return',
        related_id=ret.id,
        extra_data={'return_number': ret.return_number, 'refund_amount': str(ret.refund_amount)},
    )


def notify_collective_announcement(announcement, supplier_id):
    """集采公告通知"""
    create_notification(
        supplier_id=supplier_id,
        notification_type='collective_announcement',
        title=f'集采公告：{announcement.title}',
        content=f'新集采公告已发布，报价截止：{announcement.quote_deadline:%Y-%m-%d %H:%M}，请及时查看并报价。',
        related_type='announcement',
        related_id=announcement.id,
    )


def notify_low_stock(product):
    """库存不足通知"""
    create_notification(
        supplier_id=product.supplier_id,
        notification_type='low_stock',
        title=f'库存不足：{product.name}',
        content=f'产品「{product.name} {product.specification}」当前库存仅 {product.stock_quantity} {product.unit}，低于安全库存量，请及时补货。',
        related_type='product',
        related_id=product.id,
    )


def notify_quote_submitted(supplier_id, announcement_title, product_name, quoted_unit_price, total_quantity, is_requote=False):
    """报价已提交通知 — 供应商提交报价后通知自己（确认）"""
    action = '修改报价' if is_requote else '提交报价'
    create_notification(
        supplier_id=supplier_id,
        notification_type='collective_announcement',
        title=f'{action}确认：{product_name}',
        content=f'您已为集采「{announcement_title}」中的产品「{product_name}」{action}，单价 ¥{quoted_unit_price}，总需求量 {total_quantity}。',
        related_type='announcement',
        extra_data={
            'announcement_title': announcement_title,
            'product_name': product_name,
            'quoted_unit_price': quoted_unit_price,
            'total_quantity': total_quantity,
        },
    )


def notify_qualification_expiring(qual, days_left):
    """资质即将到期通知"""
    create_notification(
        supplier_id=qual.supplier_id,
        notification_type='qualification_expiring',
        title=f'资质即将到期：{qual.qualification_name}',
        content=f'资质「{qual.qualification_name}」将于 {qual.expiry_date} 到期（剩余 {days_left} 天），请及时更新。',
        related_type='qualification',
        related_id=qual.id,
    )


def get_supplier_notifications(supplier_id, is_read=None, notification_type=None, limit=50):
    """获取供应商通知列表"""
    qs = SupplierNotification.objects.filter(supplier_id=supplier_id)
    if is_read is not None:
        qs = qs.filter(is_read=is_read)
    if notification_type:
        qs = qs.filter(notification_type=notification_type)
    return qs.order_by('-created_at')[:limit]


def get_unread_notification_count(supplier_id):
    """获取未读通知数量"""
    return SupplierNotification.objects.filter(supplier_id=supplier_id, is_read=False).count()


def mark_notification_read(notification_id, supplier_id):
    """标记单条通知为已读"""
    notif = SupplierNotification.objects.get(id=notification_id, supplier_id=supplier_id)
    if not notif.is_read:
        notif.is_read = True
        notif.read_at = timezone.now()
        notif.save(update_fields=['is_read', 'read_at'])
    return notif


def mark_all_notifications_read(supplier_id):
    """标记所有通知为已读"""
    count = SupplierNotification.objects.filter(
        supplier_id=supplier_id, is_read=False
    ).update(is_read=True, read_at=timezone.now())
    return count


def serialize_notification(notif):
    """序列化通知对象为字典"""
    return {
        'id': notif.id,
        'notification_type': notif.notification_type,
        'type_display': notif.get_notification_type_display(),
        'title': notif.title,
        'content': notif.content,
        'is_read': notif.is_read,
        'related_type': notif.related_type,
        'related_id': notif.related_id,
        'extra_data': notif.extra_data,
        'created_at': notif.created_at.isoformat() if notif.created_at else None,
        'read_at': notif.read_at.isoformat() if notif.read_at else None,
    }


# ========== 订单导出 CSV ==========

def export_orders_csv(supplier_id, status=None, date_from=None, date_to=None):
    """
    导出供应商订单为 CSV
    返回 (csv_content: str, filename: str)
    """
    qs = ProcurementOrder.objects.select_related('tenant').filter(supplier_id=supplier_id)
    if status:
        qs = qs.filter(status=status)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    qs = qs.order_by('-created_at')

    output = io.StringIO()
    output.write('\ufeff')  # BOM for Excel UTF-8
    writer = csv.writer(output)
    writer.writerow([
        '订单编号', '订单类型', '买方租户', '订单状态', '支付状态',
        '订单总额', '佣金金额', '供应商应得', '支付方式', '物流单号',
        '创建时间', '更新时间',
    ])

    status_map = dict(ProcurementOrder.STATUS_CHOICES)
    pay_status_map = dict(ProcurementOrder.PAYMENT_STATUS_CHOICES)
    order_type_map = dict(ProcurementOrder.ORDER_TYPE_CHOICES)

    for order in qs:
        writer.writerow([
            order.order_number,
            order_type_map.get(order.order_type, order.order_type),
            order.tenant.name,
            status_map.get(order.status, order.status),
            pay_status_map.get(order.payment_status, order.payment_status),
            str(order.total_amount),
            str(order.commission_amount),
            str(order.supplier_amount),
            order.get_payment_method_display(),
            order.tracking_number,
            order.created_at.strftime('%Y-%m-%d %H:%M'),
            order.updated_at.strftime('%Y-%m-%d %H:%M'),
        ])

    today_str = timezone.now().strftime('%Y%m%d')
    filename = f'supplier_orders_{today_str}.csv'
    return output.getvalue(), filename


# ========== 供应商对账单 ==========

def get_reconciliation(supplier_id, date_from=None, date_to=None):
    """
    供应商对账单 — 汇总结算数据
    包含：订单总额、佣金扣除、退款金额、应收净额、明细列表
    """
    qs = ProcurementOrder.objects.select_related('tenant').filter(supplier_id=supplier_id)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    # 汇总数据
    total_amount = qs.aggregate(t=Sum('total_amount'))['t'] or Decimal('0')
    commission = qs.aggregate(t=Sum('commission_amount'))['t'] or Decimal('0')
    supplier_amount = qs.aggregate(t=Sum('supplier_amount'))['t'] or Decimal('0')

    # 退款金额
    returns_qs = OrderReturn.objects.filter(
        supplier_id=supplier_id,
        status='completed',
    )
    if date_from:
        returns_qs = returns_qs.filter(completed_at__date__gte=date_from)
    if date_to:
        returns_qs = returns_qs.filter(completed_at__date__lte=date_to)
    refund_total = returns_qs.aggregate(t=Sum('refund_amount'))['t'] or Decimal('0')

    # 已收金额（已支付订单的供应商应得）
    paid_qs = qs.filter(payment_status='paid')
    received_amount = paid_qs.aggregate(t=Sum('supplier_amount'))['t'] or Decimal('0')

    # 待收金额（未支付订单的供应商应得）
    unpaid_qs = qs.filter(payment_status='unpaid')
    pending_amount = unpaid_qs.aggregate(t=Sum('supplier_amount'))['t'] or Decimal('0')

    # 订单数统计
    order_count = qs.count()
    completed_count = qs.filter(status='completed').count()
    cancelled_count = qs.filter(status='cancelled').count()
    refunded_count = qs.filter(status='refunded').count()

    # 明细列表
    details = []
    for order in qs.order_by('-created_at'):
        # 查找该订单的退货记录
        order_returns = OrderReturn.objects.filter(order=order, status='completed')
        order_refund = order_returns.aggregate(t=Sum('refund_amount'))['t'] or Decimal('0')

        details.append({
            'order_number': order.order_number,
            'tenant_name': order.tenant.name,
            'order_type': order.get_order_type_display(),
            'status': order.get_status_display(),
            'payment_status': order.get_payment_status_display(),
            'total_amount': str(order.total_amount),
            'commission_amount': str(order.commission_amount),
            'supplier_amount': str(order.supplier_amount),
            'refund_amount': str(order_refund),
            'net_amount': str(order.supplier_amount - order_refund),
            'created_at': order.created_at.strftime('%Y-%m-%d %H:%M'),
            'tracking_number': order.tracking_number,
        })

    return {
        'summary': {
            'total_amount': str(total_amount),
            'commission': str(commission),
            'supplier_amount': str(supplier_amount),
            'refund_total': str(refund_total),
            'received_amount': str(received_amount),
            'pending_amount': str(pending_amount),
            'net_receivable': str(supplier_amount - refund_total),
            'order_count': order_count,
            'completed_count': completed_count,
            'cancelled_count': cancelled_count,
            'refunded_count': refunded_count,
        },
        'details': details,
        'date_from': date_from,
        'date_to': date_to,
    }


def export_reconciliation_csv(supplier_id, date_from=None, date_to=None):
    """
    导出供应商对账单为 CSV
    返回 (csv_content: str, filename: str)
    """
    recon = get_reconciliation(supplier_id, date_from, date_to)

    output = io.StringIO()
    output.write('\ufeff')  # BOM for Excel
    writer = csv.writer(output)

    # 汇总部分
    writer.writerow(['=== 对账单汇总 ==='])
    writer.writerow([])
    s = recon['summary']
    writer.writerow(['订单总数', s['order_count']])
    writer.writerow(['已完成订单', s['completed_count']])
    writer.writerow(['已取消订单', s['cancelled_count']])
    writer.writerow(['已退款订单', s['refunded_count']])
    writer.writerow(['订单总额', s['total_amount']])
    writer.writerow(['平台佣金', s['commission']])
    writer.writerow(['供应商应得', s['supplier_amount']])
    writer.writerow(['退款总额', s['refund_total']])
    writer.writerow(['已收金额', s['received_amount']])
    writer.writerow(['待收金额', s['pending_amount']])
    writer.writerow(['应收净额', s['net_receivable']])
    writer.writerow([])

    # 明细部分
    writer.writerow(['=== 订单明细 ==='])
    writer.writerow([
        '订单编号', '买方租户', '订单类型', '订单状态', '支付状态',
        '订单总额', '佣金金额', '供应商应得', '退款金额', '实收净额',
        '创建时间', '物流单号',
    ])

    for d in recon['details']:
        writer.writerow([
            d['order_number'],
            d['tenant_name'],
            d['order_type'],
            d['status'],
            d['payment_status'],
            d['total_amount'],
            d['commission_amount'],
            d['supplier_amount'],
            d['refund_amount'],
            d['net_amount'],
            d['created_at'],
            d['tracking_number'],
        ])

    today_str = timezone.now().strftime('%Y%m%d')
    filename = f'supplier_reconciliation_{today_str}.csv'
    return output.getvalue(), filename


# ============================================================
# 供应商钱包 & 提现
# ============================================================

def get_or_create_wallet(supplier_id):
    """获取或创建供应商钱包"""
    wallet, created = SupplierWallet.objects.get_or_create(supplier_id=supplier_id)
    return wallet


def get_supplier_balance(supplier_id):
    """
    获取供应商余额详情
    余额计算 = 已支付订单 supplier_amount 之和 - 已完成退款 - 已完成提现 - 待处理提现
    """
    wallet = get_or_create_wallet(supplier_id)

    # 总收入：已支付且已完成/发货/交付的订单
    earned = ProcurementOrder.objects.filter(
        supplier_id=supplier_id,
        payment_status='paid',
        status__in=['completed', 'shipped', 'delivered']
    ).aggregate(total=Sum('supplier_amount'))['total'] or Decimal('0')

    # 总退款：已完成的退货
    refunded = OrderReturn.objects.filter(
        supplier_id=supplier_id,
        status='completed'
    ).aggregate(total=Sum('refund_amount'))['total'] or Decimal('0')

    # 已提现
    withdrawn = WithdrawalRecord.objects.filter(
        supplier_id=supplier_id,
        status='completed'
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

    # 待处理提现（pending + processing）
    pending = WithdrawalRecord.objects.filter(
        supplier_id=supplier_id,
        status__in=['pending', 'processing']
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

    available = earned - refunded - withdrawn - pending

    return {
        'total_earned': str(earned),
        'total_refunded': str(refunded),
        'total_withdrawn': str(withdrawn),
        'pending_withdrawal': str(pending),
        'available_balance': str(available),
        'bank_name': wallet.bank_name,
        'bank_account': wallet.bank_account,
        'bank_holder': wallet.bank_holder,
    }


def _get_admin_phone():
    """获取平台管理员手机号（优先超级管理员，其次第一个有手机号的 PlatformUser）"""
    from django.contrib.auth.models import User
    from apps.platform.models import PlatformUser

    # 优先超级管理员
    superusers = User.objects.filter(is_superuser=True)
    for user in superusers:
        phone = ''
        if hasattr(user, 'platform_profile'):
            phone = user.platform_profile.phone or ''
        if phone:
            return phone

    # fallback：任意有手机号的平台员工
    platform_users = PlatformUser.objects.exclude(phone='')
    if platform_users.exists():
        return platform_users.first().phone

    return ''


def _mask_phone(phone: str) -> str:
    """手机号脱敏：138****8888"""
    if len(phone) < 7:
        return phone
    return phone[:3] + '****' + phone[-4:]


def send_bank_verify_code(supplier_id):
    """
    向平台管理员手机发送银行卡修改验证码
    返回 {'phone_masked': '138****8888', 'code': '123456', 'expires_in': 600}
    注：当前未接入短信通道，code 直接返回便于测试；生产环境应接入短信后删除返回 code。
    """
    from django.utils import timezone
    import random

    phone = _get_admin_phone()
    if not phone:
        raise ValueError('平台管理员手机号未配置，无法发送验证码')

    code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    wallet = get_or_create_wallet(supplier_id)
    wallet.bank_verify_code = code
    wallet.bank_verify_expires_at = timezone.now() + timezone.timedelta(minutes=10)
    wallet.save(update_fields=['bank_verify_code', 'bank_verify_expires_at', 'updated_at'])

    # TODO: 接入短信通道后改为真实发送，不再返回 code
    return {
        'phone_masked': _mask_phone(phone),
        'code': code,
        'expires_in': 600,
    }


def update_bank_info(supplier_id, verify_code, bank_name, bank_account, bank_holder):
    """
    校验管理员验证码并更新供应商银行卡信息
    """
    from django.utils import timezone

    wallet = get_or_create_wallet(supplier_id)

    if not verify_code or not bank_name or not bank_account or not bank_holder:
        raise ValueError('请完整填写验证码与银行卡信息')

    if wallet.bank_verify_code != verify_code:
        raise ValueError('验证码错误')

    if not wallet.bank_verify_expires_at or wallet.bank_verify_expires_at < timezone.now():
        raise ValueError('验证码已过期，请重新获取')

    wallet.bank_name = bank_name.strip()
    wallet.bank_account = bank_account.strip()
    wallet.bank_holder = bank_holder.strip()
    wallet.bank_verify_code = ''
    wallet.bank_verify_expires_at = None
    wallet.save(update_fields=['bank_name', 'bank_account', 'bank_holder', 'bank_verify_code', 'bank_verify_expires_at', 'updated_at'])

    return {
        'bank_name': wallet.bank_name,
        'bank_account': wallet.bank_account,
        'bank_holder': wallet.bank_holder,
    }


def create_withdrawal(supplier_id, amount, bank_name, bank_account, bank_holder, remark=''):
    """
    发起提现申请
    - 校验可提现余额
    - 创建提现记录（状态 pending）
    - 触发通知
    """
    balance = get_supplier_balance(supplier_id)
    available = Decimal(balance['available_balance'])

    try:
        amount = Decimal(str(amount))
    except Exception:
        raise ValueError('提现金额格式错误')

    if amount <= 0:
        raise ValueError('提现金额必须大于 0')

    if amount > available:
        raise ValueError(f'可提现余额不足（当前可提现：¥{available}）')

    # 最低提现金额校验
    if amount < Decimal('10'):
        raise ValueError('最低提现金额为 ¥10')

    # 生成提现编号
    today_str = timezone.now().strftime('%Y%m%d')
    count_today = WithdrawalRecord.objects.filter(
        created_at__date=timezone.now().date()
    ).count()
    withdrawal_number = f'WD{today_str}{count_today + 1:04d}'

    wallet = get_or_create_wallet(supplier_id)

    withdrawal = WithdrawalRecord.objects.create(
        withdrawal_number=withdrawal_number,
        wallet=wallet,
        supplier_id=supplier_id,
        amount=amount,
        fee=Decimal('0'),  # 当前免手续费
        bank_name=bank_name,
        bank_account=bank_account,
        bank_holder=bank_holder,
        remark=remark,
        status='pending',
    )

    # 更新钱包银行信息（如果钱包银行信息为空，则保存）
    if not wallet.bank_name:
        wallet.bank_name = bank_name
        wallet.bank_account = bank_account
        wallet.bank_holder = bank_holder
        wallet.save(update_fields=['bank_name', 'bank_account', 'bank_holder', 'updated_at'])

    # 触发通知
    try:
        create_notification(
            supplier_id=supplier_id,
            notification_type='withdrawal_created',
            title=f'提现申请已提交：¥{amount}',
            content=f'提现编号 {withdrawal_number}，金额 ¥{amount}，收款账户 {bank_name}（{bank_account[-4:]}），状态：待审核。我们将在 1-3 个工作日内处理。',
            related_type='withdrawal',
            related_id=withdrawal.id,
        )
    except Exception:
        logger.warning(f'Failed to send withdrawal notification for {withdrawal_number}')

    return withdrawal


def get_withdrawals(supplier_id, status=None):
    """获取供应商提现记录列表"""
    qs = WithdrawalRecord.objects.filter(supplier_id=supplier_id).order_by('-created_at')
    if status and status != 'all':
        qs = qs.filter(status=status)
    return list(qs)


def cancel_withdrawal(withdrawal_id, supplier_id):
    """
    供应商取消提现（仅 pending 状态可取消）
    """
    try:
        withdrawal = WithdrawalRecord.objects.get(pk=withdrawal_id, supplier_id=supplier_id)
    except WithdrawalRecord.DoesNotExist:
        raise ValueError('提现记录不存在')

    if withdrawal.status != 'pending':
        raise ValueError(f'当前状态（{withdrawal.get_status_display()}）无法取消')

    withdrawal.status = 'cancelled'
    withdrawal.processed_at = timezone.now()
    withdrawal.save(update_fields=['status', 'processed_at', 'updated_at'])

    # 通知
    try:
        create_notification(
            supplier_id=supplier_id,
            notification_type='system',
            title=f'提现已取消：{withdrawal.withdrawal_number}',
            content=f'提现编号 {withdrawal.withdrawal_number}（¥{withdrawal.amount}）已取消，金额将退回可用余额。',
            related_type='withdrawal',
            related_id=withdrawal.id,
        )
    except Exception:
        logger.warning(f'Failed to send withdrawal cancel notification')

    return withdrawal


# ============================================================
# 平台后台 — 提现管理
# ============================================================

def admin_get_all_withdrawals(status=None, supplier_search=''):
    """
    平台后台：获取所有供应商的提现记录
    支持按状态筛选 + 供应商名称/编号搜索
    """
    qs = WithdrawalRecord.objects.select_related('supplier').all()
    if status and status != 'all':
        qs = qs.filter(status=status)
    if supplier_search:
        qs = qs.filter(
            Q(supplier__name__icontains=supplier_search) |
            Q(supplier__code__icontains=supplier_search) |
            Q(withdrawal_number__icontains=supplier_search)
        )
    return qs.order_by('-created_at')


def admin_approve_withdrawal(withdrawal_id, admin_remark=''):
    """
    平台审核通过提现申请：pending → processing
    """
    try:
        withdrawal = WithdrawalRecord.objects.get(pk=withdrawal_id)
    except WithdrawalRecord.DoesNotExist:
        raise ValueError('提现记录不存在')

    if withdrawal.status != 'pending':
        raise ValueError(f'当前状态（{withdrawal.get_status_display()}）不允许审核操作')

    withdrawal.status = 'processing'
    withdrawal.admin_remark = admin_remark
    withdrawal.processed_at = timezone.now()
    withdrawal.save(update_fields=['status', 'admin_remark', 'processed_at', 'updated_at'])

    # 通知供应商
    try:
        create_notification(
            supplier_id=withdrawal.supplier_id,
            notification_type='withdrawal_created',
            title=f'提现审核通过：{withdrawal.withdrawal_number}',
            content=f'您的提现申请 {withdrawal.withdrawal_number}（¥{withdrawal.amount}）已审核通过，正在处理中，请耐心等待到账。',
            related_type='withdrawal',
            related_id=withdrawal.id,
        )
    except Exception:
        logger.warning(f'Failed to send withdrawal approve notification for {withdrawal.withdrawal_number}')

    return withdrawal


def admin_reject_withdrawal(withdrawal_id, admin_remark=''):
    """
    平台拒绝提现申请：pending → rejected
    """
    try:
        withdrawal = WithdrawalRecord.objects.get(pk=withdrawal_id)
    except WithdrawalRecord.DoesNotExist:
        raise ValueError('提现记录不存在')

    if withdrawal.status != 'pending':
        raise ValueError(f'当前状态（{withdrawal.get_status_display()}）不允许拒绝操作')

    if not admin_remark.strip():
        raise ValueError('拒绝提现需要填写拒绝原因')

    withdrawal.status = 'rejected'
    withdrawal.admin_remark = admin_remark
    withdrawal.processed_at = timezone.now()
    withdrawal.save(update_fields=['status', 'admin_remark', 'processed_at', 'updated_at'])

    # 通知供应商
    try:
        create_notification(
            supplier_id=withdrawal.supplier_id,
            notification_type='withdrawal_rejected',
            title=f'提现被拒绝：{withdrawal.withdrawal_number}',
            content=f'您的提现申请 {withdrawal.withdrawal_number}（¥{withdrawal.amount}）已被拒绝。原因：{admin_remark}。金额已退回可用余额。',
            related_type='withdrawal',
            related_id=withdrawal.id,
        )
    except Exception:
        logger.warning(f'Failed to send withdrawal reject notification for {withdrawal.withdrawal_number}')

    return withdrawal


def admin_complete_withdrawal(withdrawal_id, admin_remark=''):
    """
    平台确认提现已到账：processing → completed
    """
    try:
        withdrawal = WithdrawalRecord.objects.get(pk=withdrawal_id)
    except WithdrawalRecord.DoesNotExist:
        raise ValueError('提现记录不存在')

    if withdrawal.status != 'processing':
        raise ValueError(f'当前状态（{withdrawal.get_status_display()}）不允许完成操作，需先审核通过')

    withdrawal.status = 'completed'
    if admin_remark.strip():
        withdrawal.admin_remark = admin_remark
    withdrawal.completed_at = timezone.now()
    withdrawal.save(update_fields=['status', 'admin_remark', 'completed_at', 'updated_at'])

    # 通知供应商
    try:
        create_notification(
            supplier_id=withdrawal.supplier_id,
            notification_type='withdrawal_completed',
            title=f'提现已到账：{withdrawal.withdrawal_number}',
            content=f'您的提现 {withdrawal.withdrawal_number}（¥{withdrawal.amount}）已到账，收款账户 {withdrawal.bank_name}（{withdrawal.bank_account[-4:]}）。如有疑问请联系平台客服。',
            related_type='withdrawal',
            related_id=withdrawal.id,
        )
    except Exception:
        logger.warning(f'Failed to send withdrawal complete notification for {withdrawal.withdrawal_number}')

    return withdrawal


def admin_get_wallets_overview():
    """
    平台后台：获取所有供应商钱包概览
    返回每个供应商的余额信息
    """
    suppliers = Supplier.objects.filter(enabled=True).order_by('name')
    result = []
    for supplier in suppliers:
        balance = get_supplier_balance(supplier.id)
        result.append({
            'supplier_id': supplier.id,
            'supplier_name': supplier.name,
            'supplier_code': supplier.code,
            'total_earned': balance['total_earned'],
            'total_refunded': balance['total_refunded'],
            'total_withdrawn': balance['total_withdrawn'],
            'pending_withdrawal': balance['pending_withdrawal'],
            'available_balance': balance['available_balance'],
            'bank_name': balance['bank_name'],
            'bank_account': balance['bank_account'],
            'bank_holder': balance['bank_holder'],
        })
    return result


def admin_get_withdrawal_stats():
    """
    平台后台：提现统计概览
    """
    total_pending = WithdrawalRecord.objects.filter(status='pending').count()
    total_processing = WithdrawalRecord.objects.filter(status='processing').count()
    total_completed = WithdrawalRecord.objects.filter(status='completed').count()
    total_rejected = WithdrawalRecord.objects.filter(status='rejected').count()
    total_cancelled = WithdrawalRecord.objects.filter(status='cancelled').count()

    pending_amount = WithdrawalRecord.objects.filter(
        status__in=['pending', 'processing']
    ).aggregate(t=Sum('amount'))['t'] or Decimal('0')

    completed_amount = WithdrawalRecord.objects.filter(
        status='completed'
    ).aggregate(t=Sum('amount'))['t'] or Decimal('0')

    return {
        'total_pending': total_pending,
        'total_processing': total_processing,
        'total_completed': total_completed,
        'total_rejected': total_rejected,
        'total_cancelled': total_cancelled,
        'pending_amount': str(pending_amount),
        'completed_amount': str(completed_amount),
    }
