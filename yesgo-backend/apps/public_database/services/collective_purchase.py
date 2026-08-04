"""
集采全流程服务 — 基于集采公告 + 参与记录模型
流程：平台创建公告 → 租户登记需求 → 系统汇总 → 推送供应商 → 供应商报价 → 分发报价 → 租户调整数量 → 租户下单
"""
import logging
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Count, Q

from ..models import (
    CollectivePurchaseAnnouncement,
    CollectiveParticipation,
    Supplier,
    PublicProduct,
    ProcurementOrder,
    OrderItem,
    CommissionProtocol,
    CollectiveBatch,
    ProcurementQuote,
)

logger = logging.getLogger(__name__)


def _product_matches_tenant(product, tenant):
    """判断产品是否对指定租户可销（区域+渠道匹配）。

    规则：
    - 产品 sales_regions 为空 → 全国可销，匹配所有租户
    - 产品 sales_regions 有值 → 租户 province 必须在列表中
    - 产品 sales_channels 为空 → 全渠道可销
    - 产品 sales_channels 有值 → 租户 channel 必须在列表中
    """
    # 区域匹配
    regions = product.sales_regions or []
    if regions:
        prov = (tenant.province or '').strip()
        if not prov:
            return False
        matched = False
        for region in regions:
            r_prov = (region.get('province') or '').strip()
            if r_prov == prov:
                cities = region.get('cities') or []
                if cities:
                    t_city = (tenant.city or '').strip()
                    if t_city and t_city in cities:
                        matched = True
                        break
                else:
                    matched = True
                    break
        if not matched:
            return False

    # 渠道匹配
    channels = product.sales_channels or []
    if channels:
        if not tenant.channel:
            return False
        if tenant.channel not in channels:
            return False

    return True


# ========== 公告管理 ==========

def create_announcement(title, description, quote_deadline, order_deadline,
                        product_keywords='', supplier_ids='', created_by=None, notes=''):
    """创建集采公告"""
    announcement = CollectivePurchaseAnnouncement.objects.create(
        title=title,
        description=description,
        announce_time=timezone.now(),
        quote_deadline=quote_deadline,
        order_deadline=order_deadline,
        status='draft',
        product_keywords=product_keywords,
        supplier_ids=supplier_ids,
        created_by=created_by,
        notes=notes,
    )
    return announcement


def publish_announcement(announcement_id):
    """发布集采公告：draft → announced → collecting"""
    announcement = CollectivePurchaseAnnouncement.objects.get(id=announcement_id)
    if announcement.status not in ('draft',):
        raise ValueError(f'公告状态不允许发布: {announcement.status}')
    announcement.status = 'collecting'
    announcement.save(update_fields=['status', 'updated_at'])
    return announcement


def close_announcement(announcement_id):
    """关闭集采公告"""
    announcement = CollectivePurchaseAnnouncement.objects.get(id=announcement_id)
    announcement.status = 'closed'
    announcement.save(update_fields=['status', 'updated_at'])
    return announcement


def cancel_announcement(announcement_id):
    """取消集采公告"""
    announcement = CollectivePurchaseAnnouncement.objects.get(id=announcement_id)
    announcement.status = 'cancelled'
    announcement.save(update_fields=['status', 'updated_at'])
    return announcement


# ========== 租户参与 ==========

def register_participation(announcement_id, tenant_id, product_id, supplier_id, quantity, notes=''):
    """
    租户登记集采需求
    同一公告+租户+产品+供应商的组合如果已存在，则累加数量
    校验产品可销区域/渠道是否匹配租户属性
    """
    from ..models import PublicProduct as _PublicProduct
    from apps.platform.models import Tenant

    announcement = CollectivePurchaseAnnouncement.objects.get(id=announcement_id)
    if announcement.status not in ('collecting', 'announced'):
        raise ValueError(f'公告当前状态不允许登记: {announcement.status}')

    product = PublicProduct.objects.get(id=product_id)

    # 校验可销区域+渠道匹配
    tenant = Tenant.objects.only('province', 'city', 'channel').get(id=tenant_id)
    if not _product_matches_tenant(product, tenant):
        raise ValueError(f'产品"{product.name}"不在您所在区域或渠道的可销范围内')

    supplier = Supplier.objects.get(id=supplier_id)

    with transaction.atomic():
        participation, created = CollectiveParticipation.objects.select_for_update().get_or_create(
            announcement=announcement,
            tenant_id=tenant_id,
            product=product,
            supplier=supplier,
            defaults={
                'quantity': quantity,
                'status': 'registered',
                'notes': notes,
            }
        )
        if not created:
            # 已存在则累加数量
            participation.quantity += quantity
            if notes:
                participation.notes = (participation.notes + '\n' + notes) if participation.notes else notes
            participation.save(update_fields=['quantity', 'notes', 'updated_at'])

    return participation, created


def get_tenant_participations(announcement_id, tenant_id):
    """获取租户在某次集采中的参与记录"""
    return CollectiveParticipation.objects.filter(
        announcement_id=announcement_id,
        tenant_id=tenant_id
    ).select_related('product', 'supplier', 'announcement').order_by('-created_at')


# ========== 汇总需求 ==========

def aggregate_demand(announcement_id):
    """
    汇总集采需求 — 按产品+供应商聚合所有租户的需求数量
    返回汇总列表，包含每个 产品+供应商 组合的总需求量
    """
    announcement = CollectivePurchaseAnnouncement.objects.get(id=announcement_id)

    participations = CollectiveParticipation.objects.filter(
        announcement=announcement,
        status__in=['registered', 'quoted']
    ).values('product_id', 'supplier_id').annotate(
        total_quantity=Sum('quantity'),
        tenant_count=Count('tenant', distinct=True),
    ).order_by('supplier_id', 'product_id')

    result = []
    for item in participations:
        product = PublicProduct.objects.select_related('supplier').get(id=item['product_id'])
        supplier = Supplier.objects.get(id=item['supplier_id'])
        result.append({
            'product_id': item['product_id'],
            'product_name': product.name,
            'product_spec': product.specification,
            'product_manufacturer': product.manufacturer,
            'product_unit': product.unit,
            'product_price': str(product.price),
            'supplier_id': item['supplier_id'],
            'supplier_name': supplier.name,
            'total_quantity': item['total_quantity'],
            'tenant_count': item['tenant_count'],
            'stock_quantity': product.stock_quantity,
        })

    return {
        'announcement_id': announcement_id,
        'announcement_title': announcement.title,
        'status': announcement.status,
        'aggregated_items': result,
        'total_products': len(result),
        'total_tenants': CollectiveParticipation.objects.filter(
            announcement=announcement
        ).values('tenant').distinct().count(),
    }


# ========== 推送供应商报价 ==========

def push_to_suppliers(announcement_id):
    """
    推送汇总需求给供应商报价
    状态：collecting → quoting
    通知指定供应商或全部有库存的供应商
    """
    announcement = CollectivePurchaseAnnouncement.objects.get(id=announcement_id)
    if announcement.status not in ('collecting',):
        raise ValueError(f'公告当前状态不允许推送: {announcement.status}')

    # 获取需要通知的供应商
    if announcement.supplier_ids:
        supplier_id_list = [int(sid.strip()) for sid in announcement.supplier_ids.split(',') if sid.strip()]
        suppliers = Supplier.objects.filter(id__in=supplier_id_list, enabled=True)
    else:
        # 全部有产品库存的活跃供应商
        suppliers = Supplier.objects.filter(enabled=True, products__stock_quantity__gt=0).distinct()

    # 更新所有已登记的参与记录状态不变，公告状态变为 quoting
    announcement.status = 'quoting'
    announcement.save(update_fields=['status', 'updated_at'])

    supplier_list = []
    for s in suppliers:
        # 获取该供应商涉及的汇总需求
        items = CollectiveParticipation.objects.filter(
            announcement=announcement,
            supplier=s,
            status='registered'
        ).select_related('product')
        if items.exists():
            supplier_list.append({
                'supplier_id': s.id,
                'supplier_name': s.name,
                'contact_name': s.contact_name,
                'contact_phone': s.contact_phone,
                'item_count': items.count(),
                'total_quantity': sum(i.quantity for i in items),
            })

    logger.info(f'集采公告 {announcement_id} 已推送至 {len(supplier_list)} 个供应商')
    return {
        'pushed_count': len(supplier_list),
        'suppliers': supplier_list,
    }


# ========== 供应商报价 ==========

def supplier_quote_participation(announcement_id, supplier_id, product_id, quoted_unit_price, quote_notes=''):
    """
    供应商对集采产品报价 — 批量更新该供应商在该公告下所有该产品的参与记录
    支持首次报价（registered → quoted）和修改报价（quoted → quoted，在截止前）
    """
    announcement = CollectivePurchaseAnnouncement.objects.get(id=announcement_id)
    if announcement.status not in ('quoting',):
        raise ValueError(f'公告当前状态不允许供应商报价: {announcement.status}')

    # 截止时间校验
    if announcement.quote_deadline and timezone.now() > announcement.quote_deadline:
        raise ValueError('报价已截止，无法提交或修改报价')

    price = Decimal(str(quoted_unit_price))
    if price <= 0:
        raise ValueError('报价单价必须大于 0')

    # 允许 registered 和 quoted 状态的记录报价/重新报价
    participations = CollectiveParticipation.objects.filter(
        announcement=announcement,
        supplier_id=supplier_id,
        product_id=product_id,
        status__in=['registered', 'quoted']
    )

    if not participations.exists():
        raise ValueError('未找到对应的参与记录')

    is_requote = participations.first().status == 'quoted'

    with transaction.atomic():
        for p in participations:
            p.quoted_unit_price = price
            p.quoted_total_price = price * p.quantity
            p.status = 'quoted'
            if quote_notes:
                p.quote_notes = quote_notes
            p.save(update_fields=['quoted_unit_price', 'quoted_total_price', 'status', 'quote_notes', 'updated_at'])

    # 触发通知：报价已提交
    try:
        from .supplier_portal import notify_quote_submitted
        announcement_title = announcement.title
        product_name = participations.first().product.name
        total_qty = sum(p.quantity for p in participations)
        notify_quote_submitted(
            supplier_id=supplier_id,
            announcement_title=announcement_title,
            product_name=product_name,
            quoted_unit_price=str(price),
            total_quantity=total_qty,
            is_requote=is_requote,
        )
    except Exception:
        logger.warning('Failed to send quote submitted notification', exc_info=True)

    return participations.count()


def supplier_batch_quote(announcement_id, supplier_id, quotes):
    """
    供应商批量报价
    quotes: [{'product_id': 1, 'quoted_unit_price': '12.50', 'quote_notes': '量大优惠'}, ...]
    """
    announcement = CollectivePurchaseAnnouncement.objects.get(id=announcement_id)
    if announcement.status not in ('quoting',):
        raise ValueError(f'公告当前状态不允许供应商报价: {announcement.status}')

    # 截止时间校验
    if announcement.quote_deadline and timezone.now() > announcement.quote_deadline:
        raise ValueError('报价已截止，无法提交或修改报价')

    results = []
    errors = []
    with transaction.atomic():
        for q in quotes:
            product_id = q.get('product_id')
            price = Decimal(str(q.get('quoted_unit_price', 0)))
            notes = q.get('quote_notes', '')
            if price <= 0:
                errors.append({'product_id': product_id, 'error': '报价单价必须大于 0'})
                continue
            try:
                count = supplier_quote_participation(announcement_id, supplier_id, product_id, price, notes)
                results.append({
                    'product_id': product_id,
                    'quoted_unit_price': str(price),
                    'updated_count': count,
                })
            except ValueError as e:
                errors.append({'product_id': product_id, 'error': str(e)})

    return {'success': results, 'errors': errors}


# ========== 分发报价 ==========

def distribute_quotes(announcement_id):
    """
    分发供应商报价给租户
    按租户区域+渠道过滤可销产品，只推送匹配的报价
    状态：quoting → distributed
    """
    announcement = CollectivePurchaseAnnouncement.objects.get(id=announcement_id)
    if announcement.status not in ('quoting',):
        raise ValueError(f'公告当前状态不允许分发: {announcement.status}')

    announcement.status = 'distributed'
    announcement.save(update_fields=['status', 'updated_at'])

    # 获取所有已报价的参与记录
    quoted_participations = CollectiveParticipation.objects.filter(
        announcement=announcement,
        status='quoted'
    ).select_related('product', 'supplier', 'tenant')

    # 按租户区域+渠道过滤
    filtered = []
    for p in quoted_participations:
        if _product_matches_tenant(p.product, p.tenant):
            filtered.append(p)
    quoted_participations = filtered

    # 按租户分组
    tenant_summary = {}
    for p in quoted_participations:
        tid = p.tenant_id
        if tid not in tenant_summary:
            tenant_summary[tid] = {
                'tenant_id': tid,
                'tenant_name': p.tenant.name,
                'items': [],
            }
        tenant_summary[tid]['items'].append({
            'participation_id': p.id,
            'product_name': p.product.name,
            'product_spec': p.product.specification,
            'supplier_name': p.supplier.name,
            'quantity': p.quantity,
            'quoted_unit_price': str(p.quoted_unit_price),
            'quoted_total_price': str(p.quoted_total_price),
        })

    return {
        'distributed_count': quoted_participations.count(),
        'tenant_count': len(tenant_summary),
        'tenants': list(tenant_summary.values()),
    }


# ========== 租户调整数量 ==========

def tenant_adjust_quantity(participation_id, final_quantity):
    """
    租户根据报价调整最终数量
    """
    participation = CollectiveParticipation.objects.get(id=participation_id)
    if participation.status not in ('quoted',):
        raise ValueError(f'参与记录状态不允许调整: {participation.status}')

    participation.final_quantity = final_quantity
    if participation.quoted_unit_price:
        participation.quoted_total_price = participation.quoted_unit_price * final_quantity
    participation.save(update_fields=['final_quantity', 'quoted_total_price', 'updated_at'])

    return participation


def tenant_decline(participation_id):
    """租户放弃参与"""
    participation = CollectiveParticipation.objects.get(id=participation_id)
    participation.status = 'declined'
    participation.save(update_fields=['status', 'updated_at'])
    return participation


def supplier_decline_quote(announcement_id, supplier_id, product_id, reason=''):
    """
    供应商拒绝报价 — 批量将该供应商在该公告下该产品的所有参与记录标记为 supplier_declined
    """
    announcement = CollectivePurchaseAnnouncement.objects.get(id=announcement_id)
    if announcement.status not in ('quoting',):
        raise ValueError(f'公告当前状态不允许操作: {announcement.status}')

    # 截止时间校验
    if announcement.quote_deadline and timezone.now() > announcement.quote_deadline:
        raise ValueError('报价已截止，无法操作')

    participations = CollectiveParticipation.objects.filter(
        announcement=announcement,
        supplier_id=supplier_id,
        product_id=product_id,
        status__in=['registered', 'quoted']
    )

    if not participations.exists():
        raise ValueError('未找到对应的参与记录')

    with transaction.atomic():
        for p in participations:
            p.status = 'supplier_declined'
            if reason:
                p.quote_notes = f'[拒绝原因] {reason}'
            p.save(update_fields=['status', 'quote_notes', 'updated_at'])

    return participations.count()


def get_supplier_aggregated_demand(supplier_id):
    """
    获取供应商的集采汇总需求 — 按公告+产品聚合
    返回每个公告下该供应商涉及的产品的总需求量（跨租户汇总）
    """
    participations = CollectiveParticipation.objects.select_related(
        'announcement', 'product'
    ).filter(
        supplier_id=supplier_id,
        status__in=['registered', 'quoted', 'supplier_declined']
    )

    # 按公告分组
    announcements = {}
    for p in participations:
        ann_id = p.announcement_id
        if ann_id not in announcements:
            announcements[ann_id] = {
                'announcement_id': ann_id,
                'announcement_title': p.announcement.title,
                'announcement_status': p.announcement.status,
                'quote_deadline': p.announcement.quote_deadline.isoformat() if p.announcement.quote_deadline else None,
                'order_deadline': p.announcement.order_deadline.isoformat() if p.announcement.order_deadline else None,
                'description': p.announcement.description,
                'products': {},
            }

        prod_id = p.product_id
        if prod_id not in announcements[ann_id]['products']:
            announcements[ann_id]['products'][prod_id] = {
                'product_id': prod_id,
                'product_name': p.product.name,
                'product_spec': p.product.specification,
                'product_manufacturer': p.product.manufacturer,
                'product_unit': p.product.unit,
                'total_quantity': 0,
                'tenant_count': 0,
                'tenants': set(),
                'quoted_unit_price': None,
                'quoted_total_price': None,
                'status': p.status,
                'quote_notes': p.quote_notes,
            }

        prod = announcements[ann_id]['products'][prod_id]
        prod['total_quantity'] += p.quantity
        prod['tenants'].add(p.tenant_id)
        # 如果有报价信息，取最新
        if p.quoted_unit_price:
            prod['quoted_unit_price'] = str(p.quoted_unit_price)
            prod['quoted_total_price'] = str(p.quoted_total_price)
        # 状态优先级：quoted > registered > supplier_declined
        if p.status == 'quoted':
            prod['status'] = 'quoted'
            prod['quote_notes'] = p.quote_notes
        elif p.status == 'registered' and prod['status'] != 'quoted':
            prod['status'] = 'registered'

    # 转换为列表
    result = []
    for ann_data in announcements.values():
        products_list = []
        for prod_data in ann_data['products'].values():
            prod_data['tenant_count'] = len(prod_data['tenants'])
            del prod_data['tenants']
            products_list.append(prod_data)
        ann_data['products'] = products_list
        ann_data['total_products'] = len(products_list)
        ann_data['total_quantity'] = sum(p['total_quantity'] for p in products_list)
        # 统计报价进度
        ann_data['pending_count'] = sum(1 for p in products_list if p['status'] == 'registered')
        ann_data['quoted_count'] = sum(1 for p in products_list if p['status'] == 'quoted')
        ann_data['declined_count'] = sum(1 for p in products_list if p['status'] == 'supplier_declined')
        result.append(ann_data)

    # 按公告 ID 倒序
    result.sort(key=lambda x: x['announcement_id'], reverse=True)
    return result


# ========== 从集采参与创建订单 ==========

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


def create_order_from_participation(participation_id, payment_method='wechat', notes=''):
    """
    从集采参与记录创建采购订单
    状态：distributed → ordering
    """
    participation = CollectiveParticipation.objects.select_related(
        'product', 'supplier', 'tenant', 'announcement'
    ).get(id=participation_id)

    if participation.status not in ('quoted',):
        raise ValueError(f'参与记录状态不允许下单: {participation.status}')

    qty = participation.final_quantity or participation.quantity
    unit_price = participation.quoted_unit_price or participation.product.price
    total = unit_price * qty

    commission = _calculate_commission(participation.supplier, total)
    supplier_amount = total - commission

    with transaction.atomic():
        order = ProcurementOrder.objects.create(
            order_number=f'CP{timezone.now().strftime("%Y%m%d%H%M%S")}{participation.id:04d}',
            tenant=participation.tenant,
            supplier=participation.supplier,
            order_type='collective',
            status='submitted',
            total_amount=total,
            commission_amount=commission,
            supplier_amount=supplier_amount,
            payment_method=payment_method,
            notes=notes or f'集采订单 - {participation.announcement.title}',
        )

        OrderItem.objects.create(
            order=order,
            product=participation.product,
            product_name=participation.product.name,
            product_spec=participation.product.specification,
            product_manufacturer=participation.product.manufacturer,
            product_unit=participation.product.unit,
            quantity=qty,
            unit_price=unit_price,
            total_price=total,
        )

        # 更新参与记录状态
        participation.status = 'ordered'
        participation.save(update_fields=['status', 'updated_at'])

        # 检查公告是否应进入 ordering 状态
        announcement = participation.announcement
        if announcement.status == 'distributed':
            announcement.status = 'ordering'
            announcement.save(update_fields=['status', 'updated_at'])

    # 自动复用/同步首营记录；未找到则保持 pending，由前端提示采方发起交换
    try:
        from .first_operation import link_order_to_first_operation
        link_order_to_first_operation(order.id)
    except Exception:
        logger.warning(f'集采订单 {order.order_number} 首营关联失败', exc_info=True)

    # 触发通知
    try:
        from .supplier_portal import notify_order_created
        notify_order_created(order)
    except Exception:
        pass

    return order


# ========== 配送规则管理 ==========

def get_delivery_rules(supplier_id=None):
    """获取配送规则列表"""
    qs = CollectivePurchaseAnnouncement.objects.none()  # placeholder
    from ..models import SupplierDeliveryRule
    qs = SupplierDeliveryRule.objects.select_related('supplier').all()
    if supplier_id:
        qs = qs.filter(supplier_id=supplier_id)
    return qs.order_by('supplier', 'province', 'city')


def get_supplier_delivery_info(supplier_id, province='', city=''):
    """
    获取供应商对某区域的配送信息（带回退匹配）
    匹配优先级：精确省市 → 省份 → 全国默认
    """
    from ..models import SupplierDeliveryRule

    # 1. 精确匹配省市
    if province and city:
        rule = SupplierDeliveryRule.objects.filter(
            supplier_id=supplier_id, province=province, city=city, enabled=True
        ).first()
        if rule:
            return rule.delivery_hours, rule.min_order_amount

    # 2. 匹配省份
    if province:
        rule = SupplierDeliveryRule.objects.filter(
            supplier_id=supplier_id, province=province, city='', enabled=True
        ).first()
        if rule:
            return rule.delivery_hours, rule.min_order_amount

    # 3. 全国默认
    rule = SupplierDeliveryRule.objects.filter(
        supplier_id=supplier_id, province='', city='', enabled=True
    ).first()
    if rule:
        return rule.delivery_hours, rule.min_order_amount

    # 4. 无规则，返回默认值
    return 48, Decimal('0')
