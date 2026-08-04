"""
快采三方案算法 — 送货最快 / 价格最低 / 综合建议

输入：用户采购需求（关键词或产品ID）+ 租户位置
处理：
  1. 从公共数据库搜索匹配产品（跨供应商）
  2. 查询各供应商到租户所在地的配送规则（SupplierDeliveryRule）
  3. 按三种策略生成方案卡片
输出：3 个方案卡片，每个包含产品列表、供应商、配送时长、价格、起订金额等
"""
import logging
from decimal import Decimal
from django.db.models import Q
from ..models import (
    PublicProduct, Supplier, SupplierDeliveryRule,
)
from .vector_search import find_medicine

logger = logging.getLogger(__name__)


def _get_delivery_info(supplier, province, city):
    """
    获取供应商到指定地点的配送信息
    优先匹配 省份+城市（城市在规则的城市列表中） → 省份（城市列表为空） → 全国兜底
    返回 (delivery_hours, min_order_amount)
    """
    # 1. 精确匹配 省份 + 城市在规则城市列表中
    rule = SupplierDeliveryRule.objects.filter(
        supplier=supplier, province=province, enabled=True
    ).filter(city__contains=city).first()

    # 2. 匹配 省份（城市列表为空，表示全省）
    if not rule:
        rule = SupplierDeliveryRule.objects.filter(
            supplier=supplier, province=province, city=[], enabled=True
        ).first()

    # 3. 全国兜底（省份和城市列表都为空）
    if not rule:
        rule = SupplierDeliveryRule.objects.filter(
            supplier=supplier, province='', city=[], enabled=True
        ).first()

    if rule:
        return rule.delivery_hours, rule.min_order_amount
    return 72, Decimal('0')  # 默认3天，无起订金额


def _format_product_card(product, delivery_hours, min_order_amount):
    """格式化产品卡片数据 — 字段名对齐前端 SolutionItem 接口"""
    # 结算方式：根据供应商资质状态推断
    settlement_method = '在线支付'
    if product.supplier.qualification_status == 'approved':
        settlement_method = '在线支付/月结'

    # 默认采购数量 = 最小起订量
    quantity = product.min_order_quantity or 1
    total_price = str(Decimal(product.price) * quantity)

    return {
        'product_id': product.id,
        'product_name': product.name,
        'product_spec': product.specification or '',
        'product_manufacturer': product.manufacturer or '',
        'product_unit': product.unit or '件',
        'product_price': str(product.price),
        'min_order_quantity': product.min_order_quantity,
        'stock_quantity': product.stock_quantity,
        'category': product.category,
        'approval_number': product.approval_number,
        'knowledge_graph': product.knowledge_graph[:200] if product.knowledge_graph else '',
        'storage_condition': product.storage_condition,
        'delivery_areas': product.delivery_areas,
        'status': product.status,
        'supplier_id': product.supplier.id,
        'supplier_name': product.supplier.name,
        'supplier_code': product.supplier.code,
        'supplier_province': product.supplier.province,
        'supplier_city': product.supplier.city,
        'supplier_qualification_status': product.supplier.qualification_status,
        'delivery_hours': delivery_hours,
        'min_order_amount': str(min_order_amount),
        'settlement_method': settlement_method,
        'quantity': quantity,
        'total_price': total_price,
    }


def generate_quick_purchase_solutions(query, tenant_province='', tenant_city='', top_n=5):
    """
    快采三方案生成

    参数:
        query: 采购需求关键词（药品名/症状/厂家等）
        tenant_province: 租户省份
        tenant_city: 租户城市
        top_n: 每个方案最多产品数

    返回:
        {
            'fastest': {方案卡片},
            'cheapest': {方案卡片},
            'comprehensive': {方案卡片},
        }
    """
    # 1. 搜索匹配产品
    search_results = find_medicine(query, top_n=20, tenant_province=tenant_province, tenant_city=tenant_city)

    if not search_results:
        return {
            'fastest': None,
            'cheapest': None,
            'comprehensive': None,
            'message': f'未找到匹配「{query}」的产品',
        }

    # 2. 为每个产品附加配送信息
    product_cards = []
    for r in search_results:
        product = r['product']
        delivery_hours, min_order_amount = _get_delivery_info(
            product.supplier, tenant_province, tenant_city
        )
        card = _format_product_card(product, delivery_hours, min_order_amount)
        card['search_score'] = round(r['score'], 2)
        card['match_type'] = r['match_type']
        card['match_fields'] = r['match_fields']
        # 计算单价每小时的配送效率（用于综合评分）
        card['delivery_efficiency'] = float(product.price) / max(delivery_hours, 1)
        product_cards.append(card)

    # ========== 方案1：送货最快 ==========
    # 按配送时长升序，优先有库存的
    sorted_by_delivery = sorted(
        product_cards,
        key=lambda x: (x['delivery_hours'], -x['stock_quantity'], float(x['product_price']))
    )
    fastest_products = sorted_by_delivery[:top_n]
    fastest_supplier_count = len(set(p['supplier_name'] for p in fastest_products))

    fastest = {
        'strategy': 'fastest',
        'strategy_label': '送货最快',
        'strategy_desc': f'配送时长 {fastest_products[0]["delivery_hours"]} 小时起，优先推荐距离最近的供应商',
        'items': fastest_products,
        'supplier_count': fastest_supplier_count,
        'total_price': str(round(sum(float(p['product_price']) * p['quantity'] for p in fastest_products), 2)),
        'avg_delivery_hours': round(sum(p['delivery_hours'] for p in fastest_products) / len(fastest_products), 1) if fastest_products else 0,
    }

    # ========== 方案2：价格最低 ==========
    # 按单价升序，优先有库存的
    sorted_by_price = sorted(
        product_cards,
        key=lambda x: (float(x['product_price']), -x['stock_quantity'], x['delivery_hours'])
    )
    cheapest_products = sorted_by_price[:top_n]
    cheapest_supplier_count = len(set(p['supplier_name'] for p in cheapest_products))

    cheapest = {
        'strategy': 'cheapest',
        'strategy_label': '价格最低',
        'strategy_desc': f'单品供应价 ¥{cheapest_products[0]["product_price"]} 起，为您找到最优惠的供应价格',
        'items': cheapest_products,
        'supplier_count': cheapest_supplier_count,
        'total_price': str(round(sum(float(p['product_price']) * p['quantity'] for p in cheapest_products), 2)),
        'avg_delivery_hours': round(sum(p['delivery_hours'] for p in cheapest_products) / len(cheapest_products), 1) if cheapest_products else 0,
    }

    # ========== 方案3：综合建议 ==========
    # 综合评分 = 价格归一化(40%) + 配送速度归一化(30%) + 库存归一化(15%) + 供应商资质(15%)
    # 控制在 3-5 家供应商，符合起订金额标准，价格适宜

    if product_cards:
        prices = [float(p['product_price']) for p in product_cards]
        deliveries = [p['delivery_hours'] for p in product_cards]
        stocks = [p['stock_quantity'] for p in product_cards]

        price_min, price_max = min(prices), max(prices)
        delivery_min, delivery_max = min(deliveries), max(deliveries)
        stock_max = max(stocks) if max(stocks) > 0 else 1

        for p in product_cards:
            # 价格评分：越低越高（0-1）
            price_score = 1 - (float(p['product_price']) - price_min) / max(price_max - price_min, 0.01)
            # 配送评分：越快越高（0-1）
            delivery_score = 1 - (p['delivery_hours'] - delivery_min) / max(delivery_max - delivery_min, 1)
            # 库存评分：越多越高（0-1）
            stock_score = p['stock_quantity'] / stock_max if stock_max > 0 else 0
            # 供应商资质评分
            qual_score = 1.0 if p['supplier_qualification_status'] == 'approved' else 0.5

            p['composite_score'] = round(
                price_score * 0.40 + delivery_score * 0.30 + stock_score * 0.15 + qual_score * 0.15, 3
            )

    # 按综合评分降序，并控制供应商数量在 3-5 家
    sorted_by_composite = sorted(product_cards, key=lambda x: x['composite_score'], reverse=True)

    # 选出综合评分最高的产品，同时确保供应商多样性
    comprehensive_products = []
    selected_suppliers = set()
    for p in sorted_by_composite:
        if p['supplier_name'] not in selected_suppliers:
            comprehensive_products.append(p)
            selected_suppliers.add(p['supplier_name'])
        elif len(comprehensive_products) < 3:
            comprehensive_products.append(p)
        if len(selected_suppliers) >= 5 and len(comprehensive_products) >= 5:
            break
        if len(comprehensive_products) >= top_n:
            break

    # 确保至少 3 家供应商
    if len(selected_suppliers) < 3:
        for p in sorted_by_composite:
            if p not in comprehensive_products and len(comprehensive_products) < top_n:
                comprehensive_products.append(p)
                selected_suppliers.add(p['supplier_name'])

    comp_supplier_count = len(set(p['supplier_name'] for p in comprehensive_products))

    comprehensive = {
        'strategy': 'comprehensive',
        'strategy_label': '综合建议',
        'strategy_desc': f'推荐 {comp_supplier_count} 家供应商，兼顾价格、配送速度与供应商资质，符合起订金额标准',
        'items': comprehensive_products,
        'supplier_count': comp_supplier_count,
        'total_price': str(round(sum(float(p['product_price']) * p['quantity'] for p in comprehensive_products), 2)),
        'avg_delivery_hours': round(sum(p['delivery_hours'] for p in comprehensive_products) / len(comprehensive_products), 1) if comprehensive_products else 0,
    }

    return {
        'fastest': fastest,
        'cheapest': cheapest,
        'comprehensive': comprehensive,
        'total_products_found': len(product_cards),
        'query': query,
    }
