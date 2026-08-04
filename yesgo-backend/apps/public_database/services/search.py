"""
产品搜索服务 — 混合检索
结构化字段（产品名/厂家/规格）用 MySQL icontains 精确匹配
非结构化文本（知识图谱/说明书）用 BM25 关键词检索做语义搜索
后续可升级为向量数据库（Qdrant/Milvus）
"""
import re
from collections import defaultdict
from django.db.models import Q
from ..models import PublicProduct


def _extract_keywords(query):
    """提取关键词：2-3字中文 n-gram + 英文单词"""
    keywords = set()
    # 英文单词
    en_words = re.findall(r'[a-zA-Z]{2,}', query)
    for w in en_words:
        keywords.add(w.lower())
    # 中文 2-3 gram
    chinese = re.sub(r'[^\u4e00-\u9fa5]', '', query)
    for i in range(len(chinese)):
        for n in (2, 3):
            if i + n <= len(chinese):
                keywords.add(chinese[i:i+n])
    if not keywords:
        keywords.add(query.strip())
    return list(keywords)


def _bm25_score(text, keywords):
    """简易 BM25 评分"""
    if not text:
        return 0
    text_lower = text.lower()
    score = 0
    for kw in keywords:
        count = text_lower.count(kw.lower())
        if count > 0:
            # 词频 / 文本长度归一化
            score += count * (1 + 1.5 / (1 + count * 0.1))
    return score


def search_products(query, supplier_id=None, category=None, status='active',
                    page=1, page_size=20):
    """
    混合搜索产品
    返回 { results, total, page, page_size }
    """
    qs = PublicProduct.objects.select_related('supplier').all()

    if status:
        qs = qs.filter(status=status)
    if supplier_id:
        qs = qs.filter(supplier_id=supplier_id)
    if category:
        qs = qs.filter(category__icontains=category)

    if not query or not query.strip():
        total = qs.count()
        start = (page - 1) * page_size
        results = qs[start:start + page_size]
        return {
            'results': list(results),
            'total': total,
            'page': page,
            'page_size': page_size,
        }

    query = query.strip()

    # 第一层：结构化字段精确匹配（icontains）
    structured_q = Q(name__icontains=query) | \
                   Q(trade_name__icontains=query) | \
                   Q(manufacturer__icontains=query) | \
                   Q(specification__icontains=query) | \
                   Q(approval_number__icontains=query) | \
                   Q(product_code__icontains=query) | \
                   Q(barcode__icontains=query) | \
                   Q(category__icontains=query)

    structured_results = qs.filter(structured_q)

    # 第二层：非结构化文本 BM25 检索（知识图谱 + 说明书）
    keywords = _extract_keywords(query)
    text_candidates = qs.exclude(structured_q).filter(
        Q(knowledge_graph__icontains=query) | Q(manual_text__icontains=query)
    )

    # 对文本候选结果进行 BM25 评分
    scored = []
    for product in text_candidates:
        combined_text = f'{product.knowledge_graph} {product.manual_text}'
        score = _bm25_score(combined_text, keywords)
        if score > 0:
            scored.append((score, product))

    scored.sort(key=lambda x: x[0], reverse=True)

    # 合并结果：结构化匹配优先，BM25 结果在后
    all_results = list(structured_results) + [p for _, p in scored]
    total = len(all_results)

    start = (page - 1) * page_size
    paged = all_results[start:start + page_size]

    return {
        'results': paged,
        'total': total,
        'page': page,
        'page_size': page_size,
    }


def build_product_search_context(product):
    """
    构建产品搜索上下文文本（供智能体使用）
    """
    parts = []
    parts.append(f'产品名称: {product.name}')
    if product.trade_name:
        parts.append(f'商品名: {product.trade_name}')
    if product.specification:
        parts.append(f'规格: {product.specification}')
    if product.manufacturer:
        parts.append(f'厂家: {product.manufacturer}')
    if product.dosage_form:
        parts.append(f'剂型: {product.dosage_form}')
    parts.append(f'单价: ¥{product.price}/{product.unit or "件"}')
    if product.min_order_quantity > 1:
        parts.append(f'最小起订量: {product.min_order_quantity}')
    if product.stock_quantity > 0:
        parts.append(f'库存: {product.stock_quantity}{product.unit or "件"}')
    if product.knowledge_graph:
        parts.append(f'产品知识: {product.knowledge_graph}')
    if product.storage_condition:
        parts.append(f'储存条件: {product.storage_condition}')
    if product.delivery_info:
        parts.append(f'配送信息: {product.delivery_info}')
    if product.supplier:
        parts.append(f'供应商: {product.supplier.name}')
    return '\n'.join(parts)
