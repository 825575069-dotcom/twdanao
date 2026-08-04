"""
知识文档 RAG 检索服务

提供基于关键词/文本匹配的知识文档检索能力。
架构预留向量化检索接口，后续可替换为真实的 embedding 向量检索。
"""

import logging
import re
from collections import Counter
from typing import List

logger = logging.getLogger(__name__)


def _tokenize(text: str) -> List[str]:
    """简单分词：中文按字切，英文按词切"""
    if not text:
        return []
    # 英文词
    tokens = re.findall(r'[a-zA-Z]{2,}', text.lower())
    # 中文词（按2-4字组合）
    cn_chars = re.findall(r'[\u4e00-\u9fa5]+', text)
    for segment in cn_chars:
        # 2-gram
        for i in range(len(segment) - 1):
            tokens.append(segment[i:i+2])
        # 单字也保留
        for ch in segment:
            tokens.append(ch)
    return tokens


def _bm25_score(query_tokens: List[str], doc_tokens: List[str], avg_doc_len: float = 100) -> float:
    """简化的 BM25 打分"""
    if not query_tokens or not doc_tokens:
        return 0.0

    k1 = 1.5
    b = 0.75

    doc_len = len(doc_tokens)
    doc_counter = Counter(doc_tokens)

    score = 0.0
    for qt in query_tokens:
        tf = doc_counter.get(qt, 0)
        if tf == 0:
            continue
        # 简化 IDF：假设所有词的 IDF=1（无全局语料库统计）
        idf = 1.0
        score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc_len / max(avg_doc_len, 1)))

    return score


def retrieve_knowledge(tenant, query: str, agent_id: str = '', top_k: int = 3) -> list:
    """检索知识文档

    Args:
        tenant: 租户对象
        query: 查询文本
        agent_id: 智能体ID（用于过滤绑定该智能体的文档，空则检索全部）
        top_k: 返回前 K 条

    Returns:
        [{"doc_id": int, "name": str, "type": str, "content_snippet": str, "score": float}]
    """
    try:
        from apps.tenant_ext.models import KnowledgeDoc
    except ImportError:
        return []

    # 查询租户下的知识文档
    docs = KnowledgeDoc.objects.filter(tenant=tenant)

    # 如果指定了 agent_id，在 Python 层过滤（兼容 SQLite）
    if agent_id:
        docs = [d for d in docs if agent_id in (d.bound_agents or [])]
    else:
        docs = list(docs)

    # 只检索有文本内容的文档
    docs_with_content = [d for d in docs if d.content_text]
    docs = docs_with_content if docs_with_content else docs

    if not docs:
        return []

    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    scored_docs = []
    for doc in docs:
        # 搜索文本：文档名 + content_text
        search_text = f'{doc.name} {doc.content_text}'
        doc_tokens = _tokenize(search_text)
        score = _bm25_score(query_tokens, doc_tokens)
        if score > 0:
            # 提取片段：找到匹配关键词附近的文本
            snippet = _extract_snippet(doc.content_text or doc.name, query_tokens, max_len=200)
            scored_docs.append({
                'doc_id': doc.id,
                'name': doc.name,
                'type': doc.type,
                'content_snippet': snippet,
                'score': round(score, 4),
            })

    # 按分数降序，取 top_k
    scored_docs.sort(key=lambda x: x['score'], reverse=True)
    return scored_docs[:top_k]


def _extract_snippet(text: str, query_tokens: List[str], max_len: int = 200) -> str:
    """从文本中提取包含查询关键词的片段"""
    if not text:
        return ''

    # 找到第一个匹配关键词的位置
    text_lower = text.lower()
    best_pos = 0
    for token in query_tokens:
        pos = text_lower.find(token.lower())
        if pos >= 0:
            best_pos = pos
            break

    # 截取片段
    start = max(0, best_pos - max_len // 4)
    end = min(len(text), start + max_len)
    snippet = text[start:end]
    if start > 0:
        snippet = '...' + snippet
    if end < len(text):
        snippet = snippet + '...'
    return snippet


def build_knowledge_context(tenant, query: str, agent_id: str = '', top_k: int = 3) -> str:
    """构建知识文档上下文文本，用于注入 prompt

    返回格式：
    [知识文档]
    1. 《文档名》: 内容片段...
    2. 《文档名》: 内容片段...
    """
    results = retrieve_knowledge(tenant, query, agent_id, top_k)
    if not results:
        return ''

    lines = ['[知识文档]']
    for i, r in enumerate(results, 1):
        lines.append(f'{i}. 《{r["name"]}》({r["type"]}): {r["content_snippet"]}')

    return '\n'.join(lines)
