"""
Mock 电子签章适配器 — 开发阶段模拟签章流程

不调用任何外部 API，模拟创建合同→签署中→已签署的完整生命周期。
生产环境接入法大大/e签宝/契约锁时，替换为真实适配器即可。
"""
import uuid
from datetime import timedelta
from django.utils import timezone
from .base import ESignatureAdapterBase, ESignContractResult, ESignStatusResult


class MockESignatureAdapter(ESignatureAdapterBase):
    """模拟签章适配器"""

    provider_code = 'mock'
    provider_name = '模拟签章服务'

    # 内存存储合同状态（开发阶段用，生产环境由服务商管理）
    _contracts = {}

    def create_contract(
        self,
        contract_title: str,
        buyer_name: str,
        buyer_contact: str,
        seller_name: str,
        seller_contact: str,
        file_url: str,
        file_name: str = '',
        valid_days: int = 365,
        **kwargs
    ) -> ESignContractResult:
        """模拟创建签章合同"""
        contract_id = f'MOCK_{uuid.uuid4().hex[:12].upper()}'
        sign_url = f'/mock-sign/{contract_id}'

        self._contracts[contract_id] = {
            'contract_id': contract_id,
            'contract_title': contract_title,
            'buyer_name': buyer_name,
            'seller_name': seller_name,
            'file_url': file_url,
            'file_name': file_name,
            'status': 'signing',
            'created_at': timezone.now().isoformat(),
            'signed_at': None,
            'contract_url': '',
            'valid_days': valid_days,
            'signers': [
                {'name': buyer_name, 'role': 'buyer', 'status': 'pending', 'signed_at': None},
                {'name': seller_name, 'role': 'seller', 'status': 'pending', 'signed_at': None},
            ],
        }

        return ESignContractResult(
            contract_id=contract_id,
            contract_url=file_url,
            sign_url=sign_url,
            status='signing',
            message=f'模拟合同已创建：{contract_title}',
        )

    def get_sign_status(self, contract_id: str) -> ESignStatusResult:
        """查询模拟签章状态"""
        contract = self._contracts.get(contract_id)
        if not contract:
            return ESignStatusResult(
                contract_id=contract_id,
                status='unknown',
                message='合同不存在',
            )

        return ESignStatusResult(
            contract_id=contract_id,
            status=contract['status'],
            signed_at=contract.get('signed_at'),
            contract_url=contract.get('contract_url', ''),
            signers=contract.get('signers', []),
        )

    def download_signed_contract(self, contract_id: str) -> str:
        """获取模拟签署后的合同 URL"""
        contract = self._contracts.get(contract_id)
        if not contract:
            return ''
        return contract.get('contract_url', '') or contract.get('file_url', '')

    def mock_complete_sign(self, contract_id: str) -> bool:
        """模拟完成签署（供测试/开发使用）

        将合同状态从 signing 改为 signed，生成签署完成时间和下载 URL。
        """
        contract = self._contracts.get(contract_id)
        if not contract or contract['status'] != 'signing':
            return False

        now = timezone.now()
        contract['status'] = 'signed'
        contract['signed_at'] = now.isoformat()
        contract['contract_url'] = f'/mock-signed/{contract_id}.pdf'

        for signer in contract['signers']:
            signer['status'] = 'signed'
            signer['signed_at'] = now.isoformat()

        return True

    def cancel_contract(self, contract_id: str) -> bool:
        """取消模拟合同"""
        contract = self._contracts.get(contract_id)
        if not contract:
            return False
        contract['status'] = 'failed'
        return True
