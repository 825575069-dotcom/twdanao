"""
产品向量检索服务 — 基于 TF-IDF + 关键词加权的混合检索
用于「找药」模式：用户输入药品名/症状/适应症/厂家等关键词，
系统从公共数据库产品向量库中匹配并返回 3-5 款最相关产品。

检索策略：
1. 结构化字段精确匹配（名称/商品名/厂家/规格/批准文号）→ 高权重
2. 知识图谱/说明书文本 BM25 语义检索 → 中权重
3. 同义词扩展（症状→药品类别映射）
4. 综合评分排序，返回 Top-N
"""
import re
import math
import logging
from collections import defaultdict, Counter
from decimal import Decimal
from django.db.models import Q
from ..models import PublicProduct

logger = logging.getLogger(__name__)

# ========== 同义词/症状映射 ==========
SYMPTOM_MAP = {
    '感冒': ['感冒用药', '解热镇痛', '抗病毒'],
    '发烧': ['解热镇痛', '感冒用药'],
    '咳嗽': ['感冒用药', '止咳化痰'],
    '腹泻': ['消化系统', '止泻'],
    '胃痛': ['消化系统'],
    '胃酸': ['消化系统'],
    '高血压': ['心血管', '降压'],
    '心绞痛': ['心血管'],
    '糖尿病': ['糖尿病', '降糖'],
    '消炎': ['抗生素'],
    '感染': ['抗生素'],
    '补肾': ['补益用药'],
    '上火': ['感冒用药', '清热解毒'],
    '拉肚子': ['消化系统', '止泻'],
    '头疼': ['解热镇痛'],
    '头痛': ['解热镇痛'],
    '牙疼': ['解热镇痛'],
    '痛经': ['解热镇痛'],
    '过敏': ['抗过敏'],
}

# 停用词
STOP_WORDS = {'的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'}


def _tokenize(text):
    """中文分词：2-3字 n-gram + 英文单词"""
    if not text:
        return []
    tokens = set()
    # 英文单词
    en_words = re.findall(r'[a-zA-Z]{2,}', text)
    for w in en_words:
        tokens.add(w.lower())
    # 中文 2-3 gram
    chinese = re.sub(r'[^\u4e00-\u9fa5]', '', text)
    for i in range(len(chinese)):
        for n in (2, 3):
            if i + n <= len(chinese):
                gram = chinese[i:i + n]
                if gram not in STOP_WORDS:
                    tokens.add(gram)
    # 单字（如果文本很短）
    if len(chinese) <= 3:
        for c in chinese:
            if c not in STOP_WORDS:
                tokens.add(c)
    return list(tokens)


def _expand_query(query):
    """
    查询扩展：将症状词映射到药品类别
    返回 (原始关键词, 扩展类别列表)
    """
    keywords = _tokenize(query)
    expanded_categories = set()

    # 检查是否有症状词
    query_lower = query.lower()
    for symptom, categories in SYMPTOM_MAP.items():
        if symptom in query_lower or symptom in query:
            expanded_categories.update(categories)

    return keywords, list(expanded_categories)


def _compute_tf(tokens):
    """计算词频"""
    tf = Counter(tokens)
    total = len(tokens)
    if total == 0:
        return {}
    return {token: count / total for token, count in tf.items()}


def _bm25_score(text, query_tokens, avgdl=100, k1=1.5, b=0.75):
    """BM25 评分"""
    if not text or not query_tokens:
        return 0
    text_lower = text.lower()
    text_tokens = _tokenize(text)
    doc_len = len(text_tokens)
    tf = Counter(text_tokens)

    score = 0
    for token in query_tokens:
        if not token:
            continue
        tf_val = tf.get(token, 0)
        if tf_val > 0:
            # 简化 BM25：TF 饱和 + 文档长度归一化
            idf = 1.0  # 简化 IDF（实际应用中可预计算）
            numerator = tf_val * (k1 + 1)
            denominator = tf_val + k1 * (1 - b + b * doc_len / avgdl)
            score += idf * numerator / denominator
    return score


def find_medicine(query, top_n=5, tenant_province='', tenant_city=''):
    """
    找药模式：从公共数据库产品向量库中检索匹配产品

    参数:
        query: 用户输入的搜索词（药品名/症状/适应症/厂家等）
        top_n: 返回结果数量（默认5）
        tenant_province: 租户省份（用于配送区域过滤/加权）
        tenant_city: 租户城市

    返回:
        [
            {
                'product': PublicProduct,
                'score': float,
                'match_type': str,  # 'exact' / 'semantic' / 'category'
                'match_fields': [str],  # 匹配到的字段名
            },
            ...
        ]
    """
    if not query or not query.strip():
        return []

    query = query.strip()
    keywords, expanded_categories = _expand_query(query)

    # 基础查询集：活跃状态的产品
    qs = PublicProduct.objects.select_related('supplier').filter(
        Q(status='active') | Q(status='out_of_stock')
    )

    # ========== 第一层：结构化字段精确匹配 ==========
    structured_q = (
        Q(name__icontains=query) |
        Q(trade_name__icontains=query) |
        Q(manufacturer__icontains=query) |
        Q(specification__icontains=query) |
        Q(approval_number__icontains=query) |
        Q(product_code__icontains=query) |
        Q(barcode__icontains=query) |
        Q(category__icontains=query) |
        Q(dosage_form__icontains=query)
    )

    # 关键词拆分后逐一匹配
    for kw in keywords:
        if len(kw) >= 2:
            structured_q |= Q(name__icontains=kw)
            structured_q |= Q(trade_name__icontains=kw)
            structured_q |= Q(manufacturer__icontains=kw)

    structured_results = list(qs.filter(structured_q))

    # ========== 第二层：知识图谱/说明书语义检索 ==========
    text_q = Q()
    for kw in keywords:
        if len(kw) >= 2:
            text_q |= Q(knowledge_graph__icontains=kw)
            text_q |= Q(manual_text__icontains=kw)
    # 也用原始查询匹配
    text_q |= Q(knowledge_graph__icontains=query)
    text_q |= Q(manual_text__icontains=query)

    text_candidates = list(qs.exclude(structured_q).filter(text_q))

    # 对文本候选结果进行 BM25 评分
    scored_text = []
    for product in text_candidates:
        combined_text = f'{product.knowledge_graph} {product.manual_text} {product.category}'
        score = _bm25_score(combined_text, keywords)
        if score > 0:
            scored_text.append((score, product, 'semantic'))

    # ========== 第三层：症状→类别扩展匹配 ==========
    category_results = []
    if expanded_categories:
        for cat in expanded_categories:
            cat_products = list(qs.exclude(structured_q).exclude(
                        id__in=[p.id for p in structured_results + [t[1] for t in scored_text]]
                    ).filter(category__icontains=cat))
            for p in cat_products:
                category_results.append((0.3, p, 'category'))

    # ========== 综合评分排序 ==========
    results = []

    # 结构化匹配 → 评分 1.0（精确匹配最高分）
    for product in structured_results:
        match_fields = []
        if query.lower() in (product.name or '').lower():
            match_fields.append('通用名')
        if query.lower() in (product.trade_name or '').lower():
            match_fields.append('商品名')
        if query.lower() in (product.manufacturer or '').lower():
            match_fields.append('厂家')
        if query.lower() in (product.specification or '').lower():
            match_fields.append('规格')
        if query.lower() in (product.category or '').lower():
            match_fields.append('分类')
        if not match_fields:
            # 关键词拆分匹配
            for kw in keywords:
                if kw.lower() in (product.name or '').lower():
                    match_fields.append('通用名')
                    break
                if kw.lower() in (product.trade_name or '').lower():
                    match_fields.append('商品名')
                    break
                if kw.lower() in (product.manufacturer or '').lower():
                    match_fields.append('厂家')
                    break

        # 配送区域加权
        delivery_bonus = 0
        if tenant_province and tenant_province in (product.delivery_areas or ''):
            delivery_bonus = 0.1
        if tenant_city and tenant_city in (product.delivery_areas or ''):
            delivery_bonus = 0.2

        # 库存加权
        stock_bonus = 0.1 if product.stock_quantity > 0 else -0.2

        results.append({
            'product': product,
            'score': 1.0 + delivery_bonus + stock_bonus,
            'match_type': 'exact',
            'match_fields': match_fields or ['关键词匹配'],
        })

    # 语义匹配结果
    for score, product, match_type in scored_text:
        delivery_bonus = 0
        if tenant_province and tenant_province in (product.delivery_areas or ''):
            delivery_bonus = 0.1
        stock_bonus = 0.1 if product.stock_quantity > 0 else -0.2

        results.append({
            'product': product,
            'score': score + delivery_bonus + stock_bonus,
            'match_type': 'semantic',
            'match_fields': ['知识图谱', '说明书'],
        })

    # 类别匹配结果
    for score, product, match_type in category_results:
        results.append({
            'product': product,
            'score': score,
            'match_type': 'category',
            'match_fields': ['症状类别匹配'],
        })

    # 按分数降序排列
    results.sort(key=lambda x: x['score'], reverse=True)

    # 去重（同一产品可能被多种方式匹配到）
    seen_ids = set()
    unique_results = []
    for r in results:
        pid = r['product'].id
        if pid not in seen_ids:
            seen_ids.add(pid)
            unique_results.append(r)

    return unique_results[:top_n]


def build_search_vector_text(product):
    """
    为产品构建搜索向量文本（存储到 search_vector 字段）
    将所有可搜索字段拼接成一个文本块，用于后续检索
    """
    parts = []
    if product.name:
        parts.append(product.name)
    if product.trade_name:
        parts.append(product.trade_name)
    if product.specification:
        parts.append(product.specification)
    if product.manufacturer:
        parts.append(product.manufacturer)
    if product.dosage_form:
        parts.append(product.dosage_form)
    if product.category:
        parts.append(product.category)
    if product.approval_number:
        parts.append(product.approval_number)
    if product.knowledge_graph:
        parts.append(product.knowledge_graph)
    if product.manual_text:
        parts.append(product.manual_text)
    if product.storage_condition:
        parts.append(product.storage_condition)
    if product.delivery_areas:
        parts.append(product.delivery_areas)
    return ' '.join(parts)


def refresh_search_vectors(batch_size=100):
    """
    批量刷新产品的 search_vector 字段
    """
    qs = PublicProduct.objects.all()
    total = 0
    for product in qs.iterator(chunk_size=batch_size):
        vector_text = build_search_vector_text(product)
        if product.search_vector != vector_text:
            product.search_vector = vector_text
            product.save(update_fields=['search_vector'])
            total += 1
    logger.info(f'刷新搜索向量: {total} 个产品已更新')
    return total
