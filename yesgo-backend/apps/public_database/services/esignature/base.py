"""
电子签章适配器基类 — 抽象接口，供法大大/e签宝/契约锁等第三方签章服务商实现

设计模式：适配器模式 + 工厂模式
- Base: 定义统一接口
- Mock: 模拟实现（开发阶段使用）
- Factory: 根据配置自动选择具体适配器
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class ESignContractResult:
    """创建签章合同的返回结果"""
    contract_id: str = ''
    contract_url: str = ''
    sign_url: str = ''           # 签署页面 URL（供前端跳转）
    status: str = 'created'      # created / signing / signed / failed
    message: str = ''


@dataclass
class ESignStatusResult:
    """查询签章状态的返回结果"""
    contract_id: str = ''
    status: str = 'unknown'      # unknown / created / signing / signed / failed / expired
    signed_at: Optional[str] = None    # ISO 格式签署完成时间
    contract_url: str = ''       # 签署完成后的合同下载 URL
    signers: list = field(default_factory=list)  # 签署人列表 [{name, status, signed_at}]


class ESignatureAdapterBase(ABC):
    """电子签章适配器抽象基类

    子类必须实现以下方法：
    - create_contract: 创建签章合同
    - get_sign_status: 查询签章状态
    - download_signed_contract: 下载已签署的合同
    - cancel_contract: 取消签章（可选）

    接入真实服务商时只需实现子类，无需改动业务代码。
    """

    # 服务商标识，子类覆盖
    provider_code = 'base'
    provider_name = '基础适配器'

    @abstractmethod
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
        """创建签章合同

        Args:
            contract_title: 合同标题
            buyer_name: 买方名称（租户企业名）
            buyer_contact: 买方联系方式（手机/邮箱）
            seller_name: 卖方名称（供应商名）
            seller_contact: 卖方联系方式
            file_url: 待签署文件 URL
            file_name: 文件名
            valid_days: 合同有效期（天）
        Returns:
            ESignContractResult
        """
        pass

    @abstractmethod
    def get_sign_status(self, contract_id: str) -> ESignStatusResult:
        """查询签章状态

        Args:
            contract_id: 合同 ID
        Returns:
            ESignStatusResult
        """
        pass

    @abstractmethod
    def download_signed_contract(self, contract_id: str) -> str:
        """下载已签署的合同

        Args:
            contract_id: 合同 ID
        Returns:
            已签署合同的下载 URL
        """
        pass

    def cancel_contract(self, contract_id: str) -> bool:
        """取消签章合同（可选实现）

        Args:
            contract_id: 合同 ID
        Returns:
            是否取消成功
        """
        logger.warning(f'[{self.provider_code}] cancel_contract 未实现，跳过 contract_id={contract_id}')
        return False

    def send_reminder(self, contract_id: str, signer_contact: str) -> bool:
        """发送签署提醒（可选实现）

        Args:
            contract_id: 合同 ID
            signer_contact: 签署人联系方式
        Returns:
            是否发送成功
        """
        logger.warning(f'[{self.provider_code}] send_reminder 未实现')
        return False
