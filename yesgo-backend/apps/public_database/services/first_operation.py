"""
首营交换记录服务 — 首营记录全生命周期管理

流程：
1. 租户发起首营 → 收集双方资质快照 → status=draft
2. 提交首营 → 资质互换 → status=exchanged
3. 双方互验确认 → buyer_confirmed + seller_confirmed → status=exchanged（双方均确认后可发起签章）
4. 发起签章 → 调用签章适配器 → status=signing
5. 签章完成（回调/mock） → 设置有效期 → status=signed
6. 后续订单复用 → 检查 is_valid
7. 到期前30天自动提醒 → status=expired

供应商API复用：如果供应商已通过其系统与该租户（通过统一社会信用代码识别）建立首营资料，
则采购方无需重复交换，直接复用供应商系统的记录，创建 status=signed 的复用记录。

审核机制：双方互验（无需平台审核）
复用策略：签章完成后在 valid_until 前一直可复用，到期前提醒更新
"""
import logging
from datetime import date, timedelta
from django.utils import timezone
from django.db import transaction

import requests

from ..models import (
    FirstOperationRecord, TenantQualification, SupplierQualification,
    Supplier, QualificationExchange, ProcurementOrder,
)
from .esignature.factory import get_esignature_adapter

logger = logging.getLogger(__name__)

# 到期提醒天数
EXPIRY_REMIND_DAYS = 30
# 默认有效期（天）
DEFAULT_VALID_DAYS = 365


def _generate_record_number():
    """生成首营编号：FO-YYYYMMDD-XXXX"""
    today = timezone.now()
    prefix = f'FO-{today:%Y%m%d}'
    # 查找今天已有的编号数量
    count = FirstOperationRecord.objects.filter(
        record_number__startswith=prefix
    ).count()
    return f'{prefix}-{count + 1:04d}'


def _snapshot_tenant_qualifications(tenant_id):
    """生成租户资质快照"""
    quals = TenantQualification.objects.filter(tenant_id=tenant_id)
    return [{
        'id': q.id,
        'type': q.qualification_type,
        'type_display': q.get_qualification_type_display(),
        'name': q.qualification_name,
        'file_url': q.file_url,
        'file_name': q.file_name,
        'license_number': q.license_number,
        'issue_date': q.issue_date.isoformat() if q.issue_date else None,
        'expiry_date': q.expiry_date.isoformat() if q.expiry_date else None,
        'verified': q.verified,
        'status': q.status,
    } for q in quals]


def _snapshot_supplier_qualifications(supplier_id):
    """生成供应商资质快照"""
    quals = SupplierQualification.objects.filter(supplier_id=supplier_id)
    return [{
        'id': q.id,
        'type': q.qualification_type,
        'type_display': q.get_qualification_type_display(),
        'name': q.qualification_name,
        'file_url': q.file_url,
        'file_name': q.file_name,
        'license_number': q.license_number,
        'issue_date': q.issue_date.isoformat() if q.issue_date else None,
        'expiry_date': q.expiry_date.isoformat() if q.expiry_date else None,
        'verified': q.verified,
    } for q in quals]


# ========== 首营记录 CRUD ==========

def _query_supplier_first_operation(supplier, enterprise_id):
    """查询供应商API，检查是否已与该企业建立首营资料

    通过供应商的 API（/api/brain/first-operation/）查询是否已存在首营记录。
    如果存在且有效，返回供应商侧的首营信息，用于复用。

    Returns:
        dict or None: 如果供应商确认已有首营记录，返回 {
            'valid_from': 'YYYY-MM-DD',
            'valid_until': 'YYYY-MM-DD',
            'seller_qualifications': [...],
        }，否则返回 None
    """
    if not supplier.api_base_url or not supplier.api_token:
        return None
    if not enterprise_id:
        return None

    try:
        url = supplier.api_base_url.rstrip('/') + '/api/brain/first-operation/'
        headers = {'Authorization': f'Bearer {supplier.api_token}'}
        params = {'enterprise_id': enterprise_id}
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        if resp.status_code != 200:
            logger.debug(f'供应商API首营查询返回 {resp.status_code}: {supplier.name}')
            return None

        data = resp.json()
        # 兼容两种响应格式：{code:0, data:{...}} 或直接 {...}
        result = data.get('data', data) if isinstance(data, dict) else None
        if not result or not isinstance(result, dict):
            return None

        if not result.get('exists', False):
            return None

        # 供应商确认已有首营记录，返回复用信息
        return {
            'valid_from': result.get('valid_from'),
            'valid_until': result.get('valid_until'),
            'seller_qualifications': result.get('seller_qualifications', []),
        }
    except Exception as e:
        logger.warning(f'查询供应商首营API失败: {supplier.name} - {e}')
        return None


def create_first_operation(tenant_id, supplier_id, created_by='', allow_draft=True):
    """创建/复用首营记录

    自动收集双方资质快照，支持三种结果：
    1. 本平台已有有效首营记录 → 直接复用
    2. 供应商已开户且API确认已建立首营 → 自动同步为外部复用记录（status=signed）
    3. 无记录且未开户 → 根据 allow_draft 决定是否创建草稿：
       - allow_draft=True（供应商手动创建或采方在订单中明确发起）→ 创建草稿
       - allow_draft=False（订单自动检测时）→ 返回 None，由前端提示采方发起首营交换
    """
    # 1. 检查本平台是否已有有效的首营记录
    existing = find_valid_first_operation(tenant_id, supplier_id)
    if existing:
        logger.info(f'首营记录已存在且有效: {existing.record_number}')
        return existing, False, 'reused'

    # 2. 查询供应商API，检查是否已与该租户建立首营资料
    try:
        from apps.platform.models import Tenant
        tenant = Tenant.objects.get(id=tenant_id)
        supplier = Supplier.objects.get(id=supplier_id)
    except Exception as e:
        logger.error(f'查询租户/供应商失败: {e}')
        supplier = None
        tenant = None

    if supplier and tenant and tenant.enterprise_id:
        external_info = _query_supplier_first_operation(supplier, tenant.enterprise_id)
        if external_info:
            # 供应商确认已有首营记录，创建外部复用记录
            today = date.today()
            valid_from_str = external_info.get('valid_from')
            valid_until_str = external_info.get('valid_until')

            try:
                valid_from = date.fromisoformat(valid_from_str) if valid_from_str else today
            except (ValueError, TypeError):
                valid_from = today

            try:
                valid_until = date.fromisoformat(valid_until_str) if valid_until_str else today + timedelta(days=DEFAULT_VALID_DAYS)
            except (ValueError, TypeError):
                valid_until = today + timedelta(days=DEFAULT_VALID_DAYS)

            # 如果已过期，不复用，走正常流程
            if valid_until < today:
                logger.info(f'供应商首营记录已过期，不复用: {supplier.name}')
            else:
                record = FirstOperationRecord.objects.create(
                    record_number=_generate_record_number(),
                    buyer_tenant_id=tenant_id,
                    seller_supplier_id=supplier_id,
                    buyer_qualifications=_snapshot_tenant_qualifications(tenant_id),
                    seller_qualifications=external_info.get('seller_qualifications') or _snapshot_supplier_qualifications(supplier_id),
                    buyer_confirmed=True,
                    buyer_confirmed_at=timezone.now(),
                    seller_confirmed=True,
                    seller_confirmed_at=timezone.now(),
                    status='signed',
                    valid_from=valid_from,
                    valid_until=valid_until,
                    external_reused=True,
                    external_source=supplier.api_base_url or supplier.name,
                    created_by=created_by,
                    notes=f'供应商API确认已建立首营资料，自动复用',
                )
                logger.info(f'创建外部复用首营记录: {record.record_number} (来源: {supplier.name})')
                return record, True, 'synced'

    # 3. 未找到有效记录，且未在供应商开户/无API记录
    if not allow_draft:
        logger.info(f'未找到有效首营记录且未在供应商开户，需采方发起交换: tenant={tenant_id}, supplier={supplier_id}')
        return None, False, 'needs_initiation'

    # 4. 创建新的草稿记录（供应商手动创建或采方在订单流中明确发起）
    record = FirstOperationRecord.objects.create(
        record_number=_generate_record_number(),
        buyer_tenant_id=tenant_id,
        seller_supplier_id=supplier_id,
        buyer_qualifications=_snapshot_tenant_qualifications(tenant_id),
        seller_qualifications=_snapshot_supplier_qualifications(supplier_id),
        status='draft',
        created_by=created_by,
    )
    logger.info(f'创建首营记录: {record.record_number}')
    return record, True, 'draft'


def submit_first_operation(record_id):
    """提交首营记录 → 资质互换状态

    刷新双方资质快照，状态改为 exchanged。
    """
    record = FirstOperationRecord.objects.get(id=record_id)
    if record.status != 'draft':
        raise ValueError(f'首营记录状态为 {record.status}，无法提交')

    # 刷新资质快照
    record.buyer_qualifications = _snapshot_tenant_qualifications(record.buyer_tenant_id)
    record.seller_qualifications = _snapshot_supplier_qualifications(record.seller_supplier_id)
    record.status = 'exchanged'
    record.save(update_fields=[
        'buyer_qualifications', 'seller_qualifications', 'status', 'updated_at'
    ])
    logger.info(f'首营记录已提交，资质已互换: {record.record_number}')
    return record


def confirm_first_operation(record_id, confirmer, remark=''):
    """双方互验确认

    Args:
        record_id: 首营记录 ID
        confirmer: 'buyer' 或 'seller'
        remark: 确认备注
    """
    record = FirstOperationRecord.objects.get(id=record_id)
    if record.status not in ('exchanged', 'submitted'):
        raise ValueError(f'首营记录状态为 {record.status}，无法确认')

    now = timezone.now()
    if confirmer == 'buyer':
        record.buyer_confirmed = True
        record.buyer_confirmed_at = now
        record.buyer_remark = remark
    elif confirmer == 'seller':
        record.seller_confirmed = True
        record.seller_confirmed_at = now
        record.seller_remark = remark
    else:
        raise ValueError(f'confirmer 必须是 buyer 或 seller')

    record.save(update_fields=[
        f'{confirmer}_confirmed', f'{confirmer}_confirmed_at',
        f'{confirmer}_remark', 'updated_at'
    ])

    # 双方都确认后，可发起签章
    if record.buyer_confirmed and record.seller_confirmed:
        logger.info(f'首营记录双方确认完成: {record.record_number}')

    return record


def reject_first_operation(record_id, rejecter, remark=''):
    """拒绝首营记录

    Args:
        record_id: 首营记录 ID
        rejecter: 'buyer' 或 'seller'
        remark: 拒绝原因
    """
    record = FirstOperationRecord.objects.get(id=record_id)
    if record.status in ('signed', 'expired'):
        raise ValueError(f'首营记录状态为 {record.status}，无法拒绝')

    record.status = 'rejected'
    if rejecter == 'buyer':
        record.buyer_remark = remark
    elif rejecter == 'seller':
        record.seller_remark = remark
    record.save(update_fields=['status', f'{rejecter}_remark', 'updated_at'])
    logger.info(f'首营记录被拒绝: {record.record_number} ({rejecter}): {remark}')
    return record


# ========== 签章流程 ==========

def initiate_esign(record_id, provider=None):
    """发起首营资料电子签章

    调用签章适配器创建合同，更新首营记录状态为 signing。
    """
    record = FirstOperationRecord.objects.select_related('buyer_tenant', 'seller_supplier').get(id=record_id)

    if record.status != 'exchanged':
        raise ValueError(f'首营记录状态为 {record.status}，必须为 exchanged 才能发起签章')

    if not (record.buyer_confirmed and record.seller_confirmed):
        raise ValueError('双方必须完成互验确认后才能发起签章')

    # 构建签署文件信息（使用买方资质文件作为合同附件）
    contract_file_url = ''
    contract_file_name = f'首营资料_{record.record_number}'
    if record.buyer_qualifications:
        contract_file_url = record.buyer_qualifications[0].get('file_url', '')

    # 获取租户和供应商联系方式
    tenant = record.buyer_tenant
    supplier = record.seller_supplier

    adapter = get_esignature_adapter(provider)
    result = adapter.create_contract(
        contract_title=f'首营资料签章 - {tenant.name} ↔ {supplier.name}',
        buyer_name=tenant.name,
        buyer_contact=getattr(tenant, 'contact_phone', '') or '',
        seller_name=supplier.name,
        seller_contact=supplier.contact_phone or '',
        file_url=contract_file_url,
        file_name=contract_file_name,
        valid_days=DEFAULT_VALID_DAYS,
    )

    record.e_signature_service = adapter.provider_code
    record.e_signature_contract_id = result.contract_id
    record.status = 'signing'
    record.save(update_fields=[
        'e_signature_service', 'e_signature_contract_id', 'status', 'updated_at'
    ])

    logger.info(f'首营签章已发起: {record.record_number} → contract={result.contract_id}')
    return record, result


def check_esign_status(record_id):
    """查询签章状态并同步更新首营记录"""
    record = FirstOperationRecord.objects.get(id=record_id)
    if not record.e_signature_contract_id:
        return record

    adapter = get_esignature_adapter(record.e_signature_service or None)
    result = adapter.get_sign_status(record.e_signature_contract_id)

    # 如果签章完成，自动更新首营记录
    if result.status == 'signed' and record.status != 'signed':
        _complete_esign(record, result)

    return record


def _complete_esign(record, esign_result=None):
    """签章完成内部方法 — 设置有效期、状态"""
    now = timezone.now()
    today = now.date()

    record.status = 'signed'
    record.e_signature_signed_at = now
    record.valid_from = today
    record.valid_until = today + timedelta(days=DEFAULT_VALID_DAYS)

    if esign_result and esign_result.contract_url:
        record.e_signature_contract_url = esign_result.contract_url
    elif not record.e_signature_contract_url:
        # 从适配器获取下载 URL
        adapter = get_esignature_adapter(record.e_signature_service or None)
        record.e_signature_contract_url = adapter.download_signed_contract(record.e_signature_contract_id)

    record.save(update_fields=[
        'status', 'e_signature_signed_at', 'e_signature_contract_url',
        'valid_from', 'valid_until', 'updated_at'
    ])
    logger.info(f'首营签章完成: {record.record_number}，有效期至 {record.valid_until}')


def mock_complete_esign(record_id):
    """模拟完成签章（开发/测试用）

    通过 Mock 适配器的 mock_complete_sign 方法模拟签署完成。
    """
    record = FirstOperationRecord.objects.get(id=record_id)
    if record.status != 'signing':
        raise ValueError(f'首营记录状态为 {record.status}，必须为 signing 才能 mock 完成')

    from .esignature.mock import MockESignatureAdapter
    mock_adapter = MockESignatureAdapter()
    mock_adapter.mock_complete_sign(record.e_signature_contract_id)

    _complete_esign(record)
    return record


# ========== 复用与到期 ==========

def find_valid_first_operation(tenant_id, supplier_id):
    """查找有效的首营记录（已签章且在有效期内）"""
    today = date.today()
    return FirstOperationRecord.objects.filter(
        buyer_tenant_id=tenant_id,
        seller_supplier_id=supplier_id,
        status='signed',
        valid_until__gte=today,
    ).order_by('-valid_until').first()


def link_order_to_first_operation(order_id, first_operation_id=None):
    """将订单的资质交换记录关联到首营记录

    逻辑：
    1. 如果提供 first_operation_id，直接复用该记录；
    2. 否则自动检测：
       - 先查找本平台有效首营记录；
       - 再尝试通过供应商API同步（需供应商已开户并存在记录）；
       - 仍未找到则保持订单为 pending，返回 None 并提示采方发起首营交换。
    3. 找到/同步到有效记录后，复用首营资质快照，订单进入 qualified。
    """
    order = ProcurementOrder.objects.select_related('tenant', 'supplier').get(id=order_id)

    if first_operation_id:
        fo = FirstOperationRecord.objects.get(id=first_operation_id)
        if not fo.is_valid:
            raise ValueError('首营记录已过期或未签章，无法关联')
    else:
        # 自动复用或同步：不创建草稿，未找到则返回 None
        result = create_first_operation(
            order.tenant_id,
            order.supplier_id,
            created_by='system',
            allow_draft=False,
        )
        fo = result[0]
        if not fo:
            logger.info(f'订单 {order.order_number} 未找到有效首营记录，等待采方发起交换')
            return None

    # 创建或更新资质交换记录，复用首营快照
    exchange, created = QualificationExchange.objects.get_or_create(
        order=order,
        defaults={
            'first_operation': fo,
            'buyer_qualifications': fo.buyer_qualifications,
            'seller_qualifications': fo.seller_qualifications,
            'status': 'exchanged',
        }
    )
    if not created:
        exchange.first_operation = fo
        exchange.buyer_qualifications = fo.buyer_qualifications
        exchange.seller_qualifications = fo.seller_qualifications
        exchange.status = 'exchanged'
        exchange.save(update_fields=[
            'first_operation', 'buyer_qualifications',
            'seller_qualifications', 'status', 'updated_at'
        ])

    # 更新订单状态
    order.qualification_exchange_status = 'exchanged'
    order.e_signature_status = 'signed'  # 复用首营签章
    order.e_signature_contract_id = fo.e_signature_contract_id
    order.status = 'qualified'
    order.save(update_fields=[
        'qualification_exchange_status', 'e_signature_status',
        'e_signature_contract_id', 'status', 'updated_at'
    ])

    logger.info(f'订单 {order.order_number} 复用首营记录 {fo.record_number}')
    return exchange


def get_expiring_records(days=EXPIRY_REMIND_DAYS):
    """获取即将到期的首营记录（用于定时提醒）"""
    today = date.today()
    threshold = today + timedelta(days=days)
    return FirstOperationRecord.objects.filter(
        status='signed',
        valid_until__gte=today,
        valid_until__lte=threshold,
    ).select_related('buyer_tenant', 'seller_supplier')


def check_and_expire_records():
    """检查并更新过期的首营记录"""
    today = date.today()
    expired = FirstOperationRecord.objects.filter(
        status='signed',
        valid_until__lt=today,
    )
    count = expired.update(status='expired', updated_at=timezone.now())
    if count:
        logger.info(f'已更新 {count} 条首营记录为过期状态')
    return count


# ========== 租户资质状态更新 ==========

def update_qualification_status(qualification):
    """更新单个资质的状态（valid / expiring / expired）"""
    if not qualification.expiry_date:
        qualification.status = 'valid'
        return

    today = date.today()
    threshold = today + timedelta(days=EXPIRY_REMIND_DAYS)

    if qualification.expiry_date < today:
        qualification.status = 'expired'
    elif qualification.expiry_date <= threshold:
        qualification.status = 'expiring'
    else:
        qualification.status = 'valid'


def refresh_tenant_qualification_status(tenant_id):
    """刷新租户所有资质的状态"""
    quals = TenantQualification.objects.filter(tenant_id=tenant_id)
    updated = 0
    for q in quals:
        old_status = q.status
        update_qualification_status(q)
        if q.status != old_status:
            q.save(update_fields=['status', 'updated_at'])
            updated += 1
    return updated
