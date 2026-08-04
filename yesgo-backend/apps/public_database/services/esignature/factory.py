"""
签章适配器工厂 — 根据配置自动选择具体的签章服务商适配器

使用方式：
    from services.esignature.factory import get_esignature_adapter
    adapter = get_esignature_adapter()
    result = adapter.create_contract(...)

接入真实服务商时：
    1. 实现 ESignatureAdapterBase 子类（如 FadadaAdapter）
    2. 在 Django settings 中配置 ESIGNATURE_PROVIDER = 'fadada'
    3. 在此工厂注册
"""
from django.conf import settings
from .base import ESignatureAdapterBase
from .mock import MockESignatureAdapter

# 适配器注册表
_ADAPTER_REGISTRY = {
    'mock': MockESignatureAdapter,
    # 'fadada': FadadaAdapter,       # 法大大（待实现）
    # 'esign': ESignAdapter,         # e签宝（待实现）
    # 'qiyuesuo': QiyuesuoAdapter,   # 契约锁（待实现）
}


def get_esignature_adapter(provider: str = None) -> ESignatureAdapterBase:
    """获取签章适配器实例

    Args:
        provider: 服务商标识。None 时从 Django settings 读取 ESIGNATURE_PROVIDER，
                  默认 'mock'。
    Returns:
        ESignatureAdapterBase 实例
    """
    if provider is None:
        provider = getattr(settings, 'ESIGNATURE_PROVIDER', 'mock')

    adapter_cls = _ADAPTER_REGISTRY.get(provider)
    if not adapter_cls:
        raise ValueError(
            f'未知的签章服务商: {provider}。已注册: {list(_ADAPTER_REGISTRY.keys())}'
        )

    return adapter_cls()


def register_adapter(provider: str, adapter_cls):
    """注册新的签章适配器（供动态扩展使用）"""
    _ADAPTER_REGISTRY[provider] = adapter_cls
