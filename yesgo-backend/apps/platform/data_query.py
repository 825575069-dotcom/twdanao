"""
数据底座查询服务

根据工作流节点的 data_source 配置，查询 tenant_db 中的真实业务数据，
将查询结果格式化为文本上下文，注入到工作流 prompt 中。

支持的 data_source 类型：
- stock / inventory: 商品库存清单 + 预警商品
- product: 商品目录
- customer: 客户列表与分级
- order: 近期订单
- procurement: 采购视角（低库存商品 + 补货需求）
- flow: 流向视角（订单配送状态）
- dashboard: 经营概览统计
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# data_source 别名映射 → 标准类型
_SOURCE_ALIASES = {
    '库存': 'stock',
    '库存查询': 'stock',
    'inventory': 'stock',
    '商品': 'product',
    'products': 'product',
    '客户': 'customer',
    'customers': 'customer',
    '订单': 'order',
    'orders': 'order',
    '采购': 'procurement',
    'procurement': 'procurement',
    'purchase': 'procurement',
    '流向': 'flow',
    'distribution': 'flow',
    'flow': 'flow',
    '概览': 'dashboard',
    'dashboard': 'dashboard',
    'summary': 'dashboard',
}


def query_data_source(tenant, data_source: str, user_input: str = '') -> str:
    """根据 data_source 类型查询数据底座，返回格式化文本上下文。

    Args:
        tenant: 租户对象
        data_source: 数据源类型标识（如 'stock', 'customer', 'procurement'）
        user_input: 用户输入（用于关键词过滤，可选）

    Returns:
        格式化的数据上下文文本，如：
        [数据底座]
        商品库存清单：
        1. 阿莫西林胶囊 (0.25g*24粒) - 库存: 3200盒, 单价: ¥12.50, 状态: 正常
        ...
        若无数据返回空字符串。
    """
    if not tenant or not data_source:
        return ''

    source_type = _SOURCE_ALIASES.get(data_source.strip().lower(), data_source.strip().lower())

    try:
        from apps.tenant_db.models import Product, Customer, Order, Warehouse, InventoryAlert
    except ImportError:
        logger.warning('tenant_db 模型不可用，跳过数据底座查询')
        return ''

    # 从用户输入中提取关键词用于过滤
    keywords = _extract_keywords(user_input)

    if source_type == 'stock':
        return _query_stock(tenant, Product, InventoryAlert, keywords)
    elif source_type == 'product':
        return _query_products(tenant, Product, keywords)
    elif source_type == 'customer':
        return _query_customers(tenant, Customer, keywords)
    elif source_type == 'order':
        return _query_orders(tenant, Order, keywords)
    elif source_type == 'procurement':
        return _query_procurement(tenant, Product, InventoryAlert, keywords)
    elif source_type == 'flow':
        return _query_flow(tenant, Order, keywords)
    elif source_type == 'dashboard':
        return _query_dashboard(tenant, Product, Customer, Order)
    else:
        logger.warning(f'未知 data_source 类型: {data_source}')
        return ''


def build_data_context(tenant, data_source: str, user_input: str = '') -> str:
    """构建数据底座上下文文本（query_data_source 的别名，与 build_knowledge_context 对齐）"""
    return query_data_source(tenant, data_source, user_input)


# ── 各类型查询实现 ────────────────────────────

def _query_stock(tenant, Product, InventoryAlert, keywords: list) -> str:
    """商品库存清单 + 预警"""
    products = Product.objects.filter(tenant=tenant)
    if keywords:
        products = _filter_products(products, keywords)
    products = products[:20]

    if not products:
        return ''

    lines = ['[数据底座]', '商品库存清单：']
    for i, p in enumerate(products, 1):
        status_icon = '⚠️' if p.status == '库存预警' else '✓'
        lines.append(
            f'{i}. {p.name} ({p.spec}) - 库存: {p.stock}{p.unit}, '
            f'单价: ¥{p.price}, 状态: {status_icon} {p.status}'
        )

    # 追加预警信息
    alerts = InventoryAlert.objects.filter(tenant=tenant).select_related('product', 'warehouse')
    if alerts:
        lines.append('')
        lines.append('库存预警：')
        for a in alerts[:10]:
            lines.append(
                f'  • {a.product.name} @ {a.warehouse.name} - '
                f'当前: {a.current}, 安全: {a.safety}, 严重度: {a.severity}'
            )

    return '\n'.join(lines)


def _query_products(tenant, Product, keywords: list) -> str:
    """商品目录"""
    products = Product.objects.filter(tenant=tenant)
    if keywords:
        products = _filter_products(products, keywords)
    products = products[:30]

    if not products:
        return ''

    lines = ['[数据底座]', '商品目录：']
    for i, p in enumerate(products, 1):
        lines.append(
            f'{i}. {p.name} | 规格: {p.spec} | 品类: {p.category} | '
            f'单价: ¥{p.price} | 库存: {p.stock}{p.unit}'
        )

    return '\n'.join(lines)


def _query_customers(tenant, Customer, keywords: list) -> str:
    """客户列表与分级"""
    customers = Customer.objects.filter(tenant=tenant)
    if keywords:
        customers = _filter_customers(customers, keywords)
    customers = customers.order_by('-monthly_purchase')[:20]

    if not customers:
        return ''

    lines = ['[数据底座]', '客户列表（按月采购额降序）：']
    for i, c in enumerate(customers, 1):
        last_order = c.last_order.strftime('%Y-%m-%d') if c.last_order else '无'
        lines.append(
            f'{i}. {c.name} | 类型: {c.type} | 等级: {c.level}级 | '
            f'月采购额: ¥{c.monthly_purchase:,.0f} | 联系人: {c.contact} {c.phone} | '
            f'最后下单: {last_order}'
        )

    return '\n'.join(lines)


def _query_orders(tenant, Order, keywords: list) -> str:
    """近期订单"""
    orders = Order.objects.filter(tenant=tenant).order_by('-time')[:20]

    if not orders:
        return ''

    lines = ['[数据底座]', '近期订单：']
    for i, o in enumerate(orders, 1):
        lines.append(
            f'{i}. 订单#{o.id} | {o.customer_name} | 金额: ¥{o.amount:,.0f} | '
            f'商品数: {o.items_count} | 状态: {o.status} | 下单: {o.time.strftime("%Y-%m-%d %H:%M")}'
        )

    return '\n'.join(lines)


def _query_procurement(tenant, Product, InventoryAlert, keywords: list) -> str:
    """采购视角：低库存商品 + 补货需求"""
    # 状态为预警的商品 + 库存较低的商品
    low_stock = Product.objects.filter(tenant=tenant, status='库存预警')
    all_products = Product.objects.filter(tenant=tenant)

    if keywords:
        low_stock = _filter_products(low_stock, keywords)
        all_products = _filter_products(all_products, keywords)

    lines = ['[数据底座]', '采购补货数据：']

    if low_stock.exists():
        lines.append('需紧急补货商品：')
        for i, p in enumerate(low_stock, 1):
            lines.append(
                f'{i}. {p.name} ({p.spec}) - 当前库存: {p.stock}{p.unit}, '
                f'单价: ¥{p.price}, 建议补货量: {max(1000 - p.stock, 500)}{p.unit}'
            )
    else:
        lines.append('当前无库存预警商品。')

    # 所有商品的库存摘要
    lines.append('')
    lines.append('商品库存摘要：')
    for p in all_products[:15]:
        lines.append(f'  • {p.name}: {p.stock}{p.unit} ({p.status})')

    return '\n'.join(lines)


def _query_flow(tenant, Order, keywords: list) -> str:
    """流向视角：订单配送状态"""
    orders = Order.objects.filter(tenant=tenant).order_by('-time')[:20]

    if not orders:
        return ''

    # 按状态分组统计
    status_groups = {}
    for o in orders:
        status_groups.setdefault(o.status, []).append(o)

    lines = ['[数据底座]', '订单流向与配送状态：']
    lines.append(f'订单总数: {len(orders)}')
    for status, group in status_groups.items():
        total_amount = sum(o.amount for o in group)
        lines.append(f'  {status}: {len(group)}笔, 合计 ¥{total_amount:,.0f}')

    lines.append('')
    lines.append('近期订单明细：')
    for i, o in enumerate(orders[:10], 1):
        lines.append(
            f'{i}. 订单#{o.id} | {o.customer_name} | ¥{o.amount:,.0f} | {o.status} | {o.time.strftime("%m-%d")}'
        )

    return '\n'.join(lines)


def _query_dashboard(tenant, Product, Customer, Order) -> str:
    """经营概览统计"""
    from django.db.models import Sum, Count

    products = Product.objects.filter(tenant=tenant)
    customers = Customer.objects.filter(tenant=tenant)
    orders = Order.objects.filter(tenant=tenant)

    total_revenue = orders.aggregate(Sum('amount'))['amount__sum'] or 0
    total_stock_value = sum(p.stock * p.price for p in products)

    alert_count = products.filter(status='库存预警').count()

    lines = ['[数据底座]', '经营概览：']
    lines.append(f'商品总数: {products.count()} (预警: {alert_count})')
    lines.append(f'客户总数: {customers.count()}')
    lines.append(f'订单总数: {orders.count()}')
    lines.append(f'订单总金额: ¥{total_revenue:,.0f}')
    lines.append(f'库存货值估算: ¥{total_stock_value:,.0f}')

    # 客户分级统计
    level_a = customers.filter(level='A').count()
    level_b = customers.filter(level='B').count()
    level_c = customers.filter(level='C').count()
    lines.append(f'客户分级: A级{level_a} / B级{level_b} / C级{level_c}')

    return '\n'.join(lines)


# ── 辅助函数 ────────────────────────────

def _extract_keywords(text: str) -> list:
    """从用户输入中提取关键词用于数据过滤

    使用 2-4 字中文 n-gram + 英文词，避免整句作为一个关键词。
    """
    if not text:
        return []
    import re
    keywords = []

    # 提取连续中文段落
    cn_segments = re.findall(r'[\u4e00-\u9fa5]+', text)
    for seg in cn_segments:
        if len(seg) <= 4:
            # 短词直接用
            keywords.append(seg)
        else:
            # 长段落拆成 2-3 字 n-gram
            for i in range(len(seg) - 1):
                keywords.append(seg[i:i+2])
            # 也保留 3 字组合
            for i in range(len(seg) - 2):
                keywords.append(seg[i:i+3])

    # 英文词
    en_words = re.findall(r'[a-zA-Z]{2,}', text)
    keywords.extend(en_words)

    # 去重并去太短的
    seen = set()
    result = []
    for kw in keywords:
        if len(kw) >= 2 and kw not in seen:
            seen.add(kw)
            result.append(kw)

    return result


def _filter_products(queryset, keywords: list):
    """按关键词过滤商品（名称或规格匹配），无匹配时回退全量"""
    if not keywords:
        return queryset
    from django.db.models import Q
    q = Q()
    for kw in keywords:
        q |= Q(name__icontains=kw) | Q(spec__icontains=kw) | Q(category__icontains=kw)
    filtered = queryset.filter(q)
    # 回退：如果关键词过滤后无结果，返回全量
    return filtered if filtered.exists() else queryset


def _filter_customers(queryset, keywords: list):
    """按关键词过滤客户，无匹配时回退全量"""
    if not keywords:
        return queryset
    from django.db.models import Q
    q = Q()
    for kw in keywords:
        q |= Q(name__icontains=kw) | Q(contact__icontains=kw) | Q(type__icontains=kw)
    filtered = queryset.filter(q)
    # 回退：如果关键词过滤后无结果，返回全量
    return filtered if filtered.exists() else queryset
