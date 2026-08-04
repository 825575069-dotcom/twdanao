"""
资质交换服务 — 医药行业资质合规
1. 供应商入驻时提交资质文件审核
2. 下单时双方交换资质（买方可下载卖方资质，卖方可下载买方资质）
3. 电子签章 — 通过签章适配器框架（法大大/e签宝/契约锁/Mock）
4. 首营资料复用 — 已签章的首营记录在有效期内可被订单复用
"""
import logging
from django.utils import timezone
from ..models import ProcurementOrder, QualificationExchange, Supplier, SupplierQualification
from .esignature.factory import get_esignature_adapter

logger = logging.getLogger(__name__)


def get_supplier_qualifications(supplier_id):
    """获取供应商资质文件列表"""
    return SupplierQualification.objects.filter(supplier_id=supplier_id)


def verify_supplier(supplier_id, approved=True, remark=''):
    """审核供应商资质"""
    supplier = Supplier.objects.get(id=supplier_id)
    if approved:
        supplier.qualification_status = 'approved'
        supplier.qualifications.update(verified=True)
    else:
        supplier.qualification_status = 'rejected'
    supplier.qualification_verified_at = timezone.now()
    supplier.qualification_remark = remark
    supplier.save(update_fields=['qualification_status', 'qualification_verified_at',
                                  'qualification_remark', 'updated_at'])
    return supplier


def initiate_qualification_exchange(order_id, buyer_qualifications=None):
    """
    发起资质交换
    buyer_qualifications: 买方资质文件列表 [{type, name, file_url, file_name}]
    """
    order = ProcurementOrder.objects.select_related('supplier', 'tenant').get(id=order_id)

    # 收集卖方（供应商）资质
    seller_quals = []
    for q in order.supplier.qualifications.all():
        seller_quals.append({
            'type': q.qualification_type,
            'type_display': q.get_qualification_type_display(),
            'name': q.qualification_name,
            'file_url': q.file_url,
            'file_name': q.file_name,
            'license_number': q.license_number,
            'expiry_date': q.expiry_date.isoformat() if q.expiry_date else None,
            'verified': q.verified,
        })

    exchange, created = QualificationExchange.objects.get_or_create(
        order=order,
        defaults={
            'buyer_qualifications': buyer_qualifications or [],
            'seller_qualifications': seller_quals,
            'status': 'exchanged',
        }
    )

    if not created:
        exchange.buyer_qualifications = buyer_qualifications or exchange.buyer_qualifications
        exchange.seller_qualifications = seller_quals
        exchange.status = 'exchanged'
        exchange.save(update_fields=['buyer_qualifications', 'seller_qualifications', 'status', 'updated_at'])

    # 更新订单状态
    order.qualification_exchange_status = 'exchanged'
    order.status = 'qualified'
    order.save(update_fields=['qualification_exchange_status', 'status', 'updated_at'])

    return exchange


def initiate_e_signature(order_id, provider=None):
    """
    发起电子签章 — 通过签章适配器创建合同

    如果订单关联了首营记录，则复用首营签章，不重复发起。
    """
    order = ProcurementOrder.objects.select_related('tenant', 'supplier').get(id=order_id)
    exchange = order.qualification_exchange

    # 如果已关联首营记录，复用首营签章
    if exchange.first_operation and exchange.first_operation.is_valid:
        exchange.status = 'signed'
        exchange.e_signature_service = exchange.first_operation.e_signature_service
        exchange.e_signature_contract_id = exchange.first_operation.e_signature_contract_id
        exchange.e_signature_signed_at = exchange.first_operation.e_signature_signed_at
        exchange.save(update_fields=[
            'status', 'e_signature_service', 'e_signature_contract_id',
            'e_signature_signed_at', 'updated_at'
        ])
        order.e_signature_status = 'signed'
        order.e_signature_contract_id = exchange.e_signature_contract_id
        order.status = 'paying'
        order.save(update_fields=['e_signature_status', 'e_signature_contract_id', 'status', 'updated_at'])
        logger.info(f'订单 {order.order_number} 复用首营签章')
        return exchange

    # 通过适配器创建签章合同
    adapter = get_esignature_adapter(provider)
    contract_file_url = ''
    if exchange.buyer_qualifications:
        contract_file_url = exchange.buyer_qualifications[0].get('file_url', '')

    result = adapter.create_contract(
        contract_title=f'采购合同签章 - {order.order_number}',
        buyer_name=order.tenant.name,
        buyer_contact='',
        seller_name=order.supplier.name,
        seller_contact=order.supplier.contact_phone or '',
        file_url=contract_file_url,
        file_name=f'采购合同_{order.order_number}',
    )

    exchange.e_signature_service = adapter.provider_code
    exchange.e_signature_contract_id = result.contract_id
    exchange.status = 'signing'
    exchange.save(update_fields=[
        'e_signature_service', 'e_signature_contract_id', 'status', 'updated_at'
    ])

    order.e_signature_status = 'signing'
    order.e_signature_contract_id = result.contract_id
    order.save(update_fields=['e_signature_status', 'e_signature_contract_id', 'updated_at'])

    logger.info(f'订单 {order.order_number} 签章已发起: contract={result.contract_id}')
    return exchange


def complete_e_signature(order_id):
    """完成电子签章 — 通过适配器查询并同步签章状态"""
    order = ProcurementOrder.objects.get(id=order_id)
    exchange = order.qualification_exchange

    if not exchange.e_signature_contract_id:
        raise ValueError('签章合同ID为空，无法完成签章')

    # 通过适配器查询签章状态
    adapter = get_esignature_adapter(exchange.e_signature_service or None)
    status_result = adapter.get_sign_status(exchange.e_signature_contract_id)

    if status_result.status != 'signed':
        raise ValueError(f'签章状态为 {status_result.status}，尚未完成签署')

    exchange.status = 'signed'
    exchange.e_signature_signed_at = timezone.now()
    if status_result.contract_url:
        exchange.e_signature_contract_url = status_result.contract_url
    exchange.save(update_fields=[
        'status', 'e_signature_signed_at', 'e_signature_contract_url', 'updated_at'
    ])

    order.e_signature_status = 'signed'
    order.status = 'paying'
    order.save(update_fields=['e_signature_status', 'status', 'updated_at'])

    logger.info(f'订单 {order.order_number} 签章完成')
    return exchange
