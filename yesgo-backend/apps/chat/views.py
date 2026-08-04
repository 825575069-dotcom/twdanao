"""
智能体对话 API — 发送消息/历史/会话列表
使用 Django 模型持久化，保持与 Mock 版兼容的返回格式
"""

import os
import random
import time as _time
import uuid
import logging
from types import SimpleNamespace
from django.http import HttpRequest
from django.conf import settings
from django.core.files.storage import default_storage
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.platform.models import Tenant, Agent, AgentConfig, DifyWorkflow
from apps.platform.credit_service import check_credits, deduct_credits
from .dify_client import invoke_dify_workflow, build_dify_inputs
from apps.platform.utils import api_success, api_error, API_CODE
from apps.platform.permissions import require_permission, has_tenant_permission
from apps.platform.workflow_engine import WorkflowEngine
from apps.public_database.ocr_service import recognize_qualification
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer, ChatSendSerializer

AGENT_PERMISSION_MAP = {
    'procurement': 'tenant.agent.purchase',
    'operations': 'tenant.agent.ops',
    'marketing': 'tenant.agent.crm',
    'distribution': 'tenant.agent.flow',
    'academic': 'tenant.agent.academic',
}

# 记忆引擎集成（可选导入，避免循环依赖）
try:
    from apps.memory_engine.services import build_memory_context, check_and_summarize, get_or_create_config
    MEMORY_ENGINE_AVAILABLE = True
except Exception:
    MEMORY_ENGINE_AVAILABLE = False

AGENT_NAMES = {
    'procurement': '采购智能体',
    'operations': '运营智能体',
    'marketing': '跟客智能体',
    'distribution': '流向智能体',
    'academic': '学术智能体',
}

logger = logging.getLogger(__name__)


def _get_tenant(request: HttpRequest):
    tenant_id = getattr(request, 'tenant_id', None)
    if tenant_id:
        try:
            return Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            pass
    return Tenant.objects.first()


def recognize_intent(text: str) -> dict:
    """意图识别（关键词规则引擎）"""
    text_lower = text.lower()
    keywords_map = [
        (['采购', '补货', '进货', '缺货', '下单'], 'procurement', '采购补货', 0.92),
        (['客户', '跟客', '回访', '跟进'], 'marketing', '客户跟进', 0.88),
        (['促销', '经营', '分析', '报表', '周报'], 'operations', '经营分析', 0.85),
        (['窜货', '流向', '预警', '滞销'], 'distribution', '流向监控', 0.90),
        (['学术', '课件', '培训', '素材'], 'academic', '学术内容', 0.87),
    ]
    for keywords, code, intent, confidence in keywords_map:
        if any(kw in text_lower for kw in keywords):
            return {'agentCode': code, 'intent': intent, 'confidence': confidence}
    return {'agentCode': 'procurement', 'intent': '通用咨询', 'confidence': 0.60}


def generate_agent_reply(agent_code: str, text: str) -> dict:
    """生成智能体回复"""
    result = {}
    reply_templates = {
        'procurement': f'已收到采购需求，正在分析"{text}"。根据当前库存数据和供应商报价，为您提供以下补货方案：',
        'operations': f'好的，正在分析"{text}"。当前经营数据如下：',
        'marketing': f'收到跟客任务，正在分析"{text}"相关的客户数据：',
        'distribution': f'正在分析"{text}"的流向数据，检测异常：',
        'academic': f'正在准备"{text}"相关的学术素材：',
    }
    reply = reply_templates.get(agent_code, '已收到指令，正在处理...')

    if agent_code == 'procurement':
        result['schemes'] = [
            {'label': '方案A（最快）', 'supplier': '华润医药', 'price': 8.50, 'leadTime': '1天', 'score': 92},
            {'label': '方案B（最优）', 'supplier': '国药控股', 'price': 7.80, 'leadTime': '2天', 'score': 95},
            {'label': '方案C（均衡）', 'supplier': '上药集团', 'price': 8.20, 'leadTime': '1.5天', 'score': 88},
        ]
        result['recommendation'] = '推荐方案B（国药控股），性价比最高'
    elif agent_code == 'operations':
        result['report'] = {'period': '本周', 'revenue': 285000, 'growth': '+12.3%', 'topProducts': ['阿莫西林胶囊', '布洛芬缓释胶囊']}
    elif agent_code == 'marketing':
        result['followUps'] = [
            {'customer': '大药房旗舰店', 'priority': '高', 'action': '电话回访', 'reason': '上月采购量下降30%'},
            {'customer': '健康连锁药店', 'priority': '中', 'action': '发送促销方案', 'reason': '新季度采购计划待确认'},
        ]
    elif agent_code == 'distribution':
        result['anomalies'] = [
            {'product': '阿莫西林胶囊', 'from': '华北', 'to': '华南', 'count': 200, 'severity': '中'},
        ]
    elif agent_code == 'academic':
        result['materials'] = [
            {'title': '抗生素合理使用指南', 'level': '高级', 'format': 'PDF'},
            {'title': '呼吸系统疾病诊疗路径', 'level': '中级', 'format': 'PPT'},
        ]

    result['reply'] = reply
    result['tokens'] = random.randint(200, 800)
    return result


# ── 工作流执行 ────────────────────────────

# agent_code（意图识别返回）→ Agent.code 映射
# 意图识别返回 procurement/operations/marketing/distribution/academic
# Agent.code 也用这些值（Agent.agent_id 是 ops/purchase/crm/flow/academic）
_AGENT_CODE_MAP = {
    'procurement': 'procurement',
    'operations': 'operations',
    'marketing': 'marketing',
    'distribution': 'distribution',
    'academic': 'academic',
}

# 全局引擎实例（无状态，可复用）
_workflow_engine = WorkflowEngine()


def find_workflow_for_agent(tenant, agent_code):
    """查找智能体绑定的工作流。

    优先级：
    1. AgentConfig.custom_workflow_template（租户级自定义模板）
    2. Agent.default_workflow_template（平台级默认模板）
    3. AgentConfig.custom_workflow（租户级内联步骤）
    4. Agent.default_workflow（平台级内联步骤）

    返回: (template_or_like, agent_config) 或 (None, None)
    """
    mapped_code = _AGENT_CODE_MAP.get(agent_code, agent_code)

    # 查找 Agent（先按 code 查，再按 agent_id 查）
    agent = None
    try:
        agent = Agent.objects.filter(code=mapped_code).first()
    except Agent.DoesNotExist:
        pass
    if not agent:
        try:
            agent = Agent.objects.filter(agent_id=mapped_code).first()
        except Agent.DoesNotExist:
            pass

    if not agent:
        return None, None

    # 查找租户级 AgentConfig
    agent_config = None
    if tenant:
        try:
            agent_config = AgentConfig.objects.get(tenant=tenant, agent_id=agent.agent_id)
        except AgentConfig.DoesNotExist:
            pass

    # 优先级 1：租户级自定义模板
    if agent_config and agent_config.custom_workflow_template:
        return agent_config.custom_workflow_template, agent_config

    # 优先级 2：平台级默认模板
    if agent.default_workflow_template:
        return agent.default_workflow_template, agent_config

    # 优先级 3：租户级内联步骤
    if agent_config and agent_config.custom_workflow:
        steps = agent_config.custom_workflow
        template_like = SimpleNamespace(steps=steps, edges=[])
        return template_like, agent_config

    # 优先级 4：平台级内联步骤
    if agent.default_workflow:
        steps = agent.default_workflow
        template_like = SimpleNamespace(steps=steps, edges=[])
        return template_like, agent_config

    return None, agent_config


def execute_workflow_reply(agent_code, text, tenant):
    """通过工作流引擎生成回复。

    返回 dict（与 generate_agent_reply 格式兼容）或 None（无绑定工作流时）。
    """
    template, agent_config = find_workflow_for_agent(tenant, agent_code)
    if not template:
        return None

    result = _workflow_engine.execute(
        template=template,
        user_input=text,
        tenant=tenant,
        agent_config=agent_config,
    )

    if not result.success:
        return None  # 执行失败，fallback 到硬编码

    # 转为与 generate_agent_reply 兼容的格式
    return {
        'reply': result.reply,
        'tokens': result.total_tokens,
        'workflow': True,
        'execution_log': result.execution_log,
        'step_results': result.step_results,
    }


# ── 外部工作流：按智能体类型映射数据底座 ────────────────────────────
# 每种智能体需要查询的数据源类型（与内部工作流节点 data_source 配置对齐）
_AGENT_DATA_SOURCES = {
    'procurement': ['stock', 'product', 'procurement'],
    'operations': ['dashboard', 'stock', 'product'],
    'marketing': ['customer'],
    'distribution': ['flow', 'order'],
    'academic': ['product'],
}


def _build_all_context_for_agent(tenant, agent_code, text):
    """为智能体构建全部配置上下文（知识/数据/素材/角色）。

    返回 (knowledge_context, data_context, media_context, role_context) 四个文本块。
    外部异常时对应字段为空字符串，不阻塞主流程。
    """
    knowledge_context = ''
    data_context = ''
    media_context = ''
    role_context = ''

    mapped_code = _AGENT_CODE_MAP.get(agent_code, agent_code)

    # 先定位平台 Agent；agent_id 是 AgentConfig 的外键依据
    agent = None
    try:
        agent = Agent.objects.filter(code=mapped_code).select_related('agent_role').first()
        if not agent:
            agent = Agent.objects.filter(agent_id=mapped_code).select_related('agent_role').first()
    except Exception:
        pass

    real_agent_id = agent.agent_id if agent else mapped_code

    # ── 1. 角色定位 ──
    try:
        if agent and agent.agent_role:
            role = agent.agent_role
            role_context = f'[角色定位]\n你是「{role.name}」。'
            if role.description:
                role_context += f'\n{role.description}'
    except Exception:
        pass

    # ── 2. 知识文档 RAG ──
    try:
        from apps.platform.knowledge_rag import build_knowledge_context
        knowledge_context = build_knowledge_context(
            tenant=tenant,
            query=text,
            agent_id=real_agent_id,
            top_k=5,
        )
    except Exception:
        pass

    # ── 3. 数据底座 ──
    data_sources = _AGENT_DATA_SOURCES.get(agent_code, ['dashboard'])
    try:
        from apps.platform.data_query import query_data_source
        data_parts = []
        for ds in data_sources:
            result = query_data_source(tenant, ds, text)
            if result:
                data_parts.append(result)
        if data_parts:
            data_context = '\n\n'.join(data_parts)
    except Exception:
        pass

    # ── 4. 营销素材 ──
    try:
        from apps.tenant_ext.models import MediaAsset
        agent_config = AgentConfig.objects.filter(tenant=tenant, agent_id=real_agent_id).first()
        if agent_config and agent_config.bound_images:
            asset_ids = agent_config.bound_images
            assets = MediaAsset.objects.filter(
                tenant=tenant, id__in=asset_ids
            ).order_by('-created_at')
            if assets.exists():
                lines = ['[营销素材]', '以下是可用的营销素材，请在回答中参考和应用：']
                for asset in assets[:10]:
                    parts = [f'- {asset.name}（{asset.type}）']
                    if asset.description:
                        parts.append(f'  描述：{asset.description}')
                    if asset.url:
                        parts.append(f'  链接：{asset.url}')
                    if asset.file:
                        parts.append(f'  文件：{asset.file.url}')
                    lines.append('\n'.join(parts))
                media_context = '\n'.join(lines)
    except Exception:
        pass

    return knowledge_context, data_context, media_context, role_context


def execute_external_workflow_reply(agent_code, text, tenant, user_identifier=''):
    """调用外部 Dify 工作流生成回复。

    当智能体 capability_mode='external' 且 external_workflow_code 有值时，
    从 DifyWorkflow 表中查找对应记录并发起真实 HTTP 请求。

    注入天网大脑配置数据：知识文档 RAG 检索结果、数据底座查询结果、
    营销素材信息、智能体角色定位 → 作为 Dify inputs 传递给外部 AI。

    返回 dict（与 generate_agent_reply 格式兼容）或 None（未配置外部工作流时）。
    """
    mapped_code = _AGENT_CODE_MAP.get(agent_code, agent_code)

    agent = None
    try:
        agent = Agent.objects.filter(code=mapped_code).first()
    except Exception:
        pass
    if not agent:
        try:
            agent = Agent.objects.filter(agent_id=mapped_code).first()
        except Exception:
            pass

    if not agent or agent.capability_mode != 'external' or not agent.external_workflow_code:
        return None

    try:
        dify_wf = DifyWorkflow.objects.filter(
            dify_config__tenant=tenant,
            code=agent.external_workflow_code,
        ).select_related('dify_config').first()
    except Exception:
        dify_wf = None

    if not dify_wf:
        return {
            'reply': f'[{agent.name or agent_code}] 未找到外部工作流配置（{agent.external_workflow_code}），请联系管理员配置 API Key。',
            'tokens': 0,
            'workflow': True,
            'external': True,
            'error': 'missing_dify_workflow',
        }

    if not dify_wf.api_key:
        return {
            'reply': f'[{agent.name or agent_code}] 外部工作流（{dify_wf.code}）尚未配置 API Key，无法调用。',
            'tokens': 0,
            'workflow': True,
            'external': True,
            'error': 'missing_api_key',
        }

    # 获取天网大脑配置上下文：知识文档 + 数据底座 + 营销素材 + 角色定位
    knowledge_context, data_context, media_context, role_context = \
        _build_all_context_for_agent(tenant, agent_code, text)

    inputs = build_dify_inputs(
        tenant, agent, text,
        knowledge_context=knowledge_context,
        data_context=data_context,
        media_context=media_context,
        role_context=role_context,
    )
    dify_result = invoke_dify_workflow(
        api_key=dify_wf.api_key,
        base_url=dify_wf.base_url,
        user=user_identifier or f'tenant_{tenant.id}',
        inputs=inputs,
        response_mode='blocking',
    )

    if not dify_result.success:
        return {
            'reply': f'[{agent.name or agent_code}] 外部工作流调用失败：{dify_result.error}',
            'tokens': 0,
            'workflow': True,
            'external': True,
            'error': dify_result.error,
        }

    return {
        'reply': dify_result.reply,
        'tokens': dify_result.total_tokens,
        'workflow': True,
        'external': True,
        'outputs': dify_result.outputs,
        'dify': {
            'workflow_run_id': dify_result.workflow_run_id,
            'task_id': dify_result.task_id,
            'status': dify_result.status,
            'elapsed_time': dify_result.elapsed_time,
        },
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_permission('chat.view')
def chat_send(request: HttpRequest):
    """POST /api/v1/chat/send — 发送消息"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    serializer = ChatSendSerializer(data=request.data)
    if not serializer.is_valid():
        return api_error(code=API_CODE.BAD_REQUEST, msg=str(serializer.errors))

    data = serializer.validated_data
    message_text = data['message']
    session_id = data.get('session_id', '')

    # 意图识别
    intent = recognize_intent(message_text)
    agent_code = intent['agentCode']

    # 权限检查：需要对应智能体权限
    perm_code = AGENT_PERMISSION_MAP.get(agent_code)
    if perm_code and not has_tenant_permission(request.user, tenant, perm_code):
        return api_error(code=API_CODE.FORBIDDEN, msg='无权限使用该智能体')

    # 积分检查：调用前检查余额
    credit_allowed, credit_reason = check_credits(tenant, request.user, agent_code)
    if not credit_allowed:
        return api_error(code=API_CODE.FORBIDDEN, msg=credit_reason)

    # 查找或创建会话
    if session_id:
        try:
            conversation = Conversation.objects.get(id=session_id, tenant=tenant)
        except Conversation.DoesNotExist:
            conversation = Conversation.objects.create(
                tenant=tenant, user=request.user,
                title=message_text[:30], agent_code=agent_code
            )
    else:
        conversation = Conversation.objects.create(
            tenant=tenant, user=request.user,
            title=message_text[:30], agent_code=agent_code
        )

    # 记忆引擎：构建记忆上下文
    memory_context = None
    if MEMORY_ENGINE_AVAILABLE:
        try:
            memory_context = build_memory_context(tenant, conversation, message_text)
        except Exception:
            memory_context = None

    # 保存用户消息
    Message.objects.create(
        conversation=conversation, role='user',
        content=message_text
    )

    # 模拟延迟
    _time.sleep(0.5)

    # 生成回复：
    # 1. 若智能体是 external 模式，优先调用外部 Dify 工作流
    # 2. 否则走内部工作流引擎
    # 3. 都未命中则 fallback 到硬编码回复
    result = execute_external_workflow_reply(
        agent_code, message_text, tenant,
        user_identifier=str(request.user.id) if request.user else f'tenant_{tenant.id}'
    )
    if result is None:
        result = execute_workflow_reply(agent_code, message_text, tenant)
    if result is None:
        result = generate_agent_reply(agent_code, message_text)

    # 积分扣减：根据 Token 消耗扣减积分
    tokens_consumed = result.get('tokens', 0)
    agent_display_name = AGENT_NAMES.get(agent_code, agent_code)
    credit_info = deduct_credits(
        tenant, request.user, agent_code, agent_display_name, tokens_consumed
    )

    # 记忆引擎：在回复中加入记忆上下文提示
    memory_hint = ''
    if memory_context and memory_context.get('strategy') != 'disabled':
        recalled_summaries = memory_context.get('summaries', [])
        recalled_facts = memory_context.get('facts', [])
        if recalled_summaries or recalled_facts:
            memory_hint = f'\n\n📋 **记忆召回**：短期{memory_context["short_term_messages"]}条 | 摘要{len(recalled_summaries)}篇 | 事实{len(recalled_facts)}条 | 估算{memory_context["total_tokens"]}tokens'

    # 保存助手消息
    assistant_msg = Message.objects.create(
        conversation=conversation, role='assistant',
        content=result.get('reply', ''),
        agent_code=agent_code,
        agent_name=AGENT_NAMES.get(agent_code, ''),
        metadata={
            'intent': intent,
            'result': {k: v for k, v in result.items() if k not in ('reply', 'tokens', 'execution_log', 'step_results')},
            'tokens': result.get('tokens', 0),
            'workflow': result.get('workflow', False),
            'execution_log': result.get('execution_log', []),
            'credit': credit_info,
            'memory': {
                'strategy': memory_context['strategy'] if memory_context else 'disabled',
                'short_term_count': memory_context.get('short_term_messages', 0) if memory_context else 0,
                'summary_count': len(memory_context.get('summaries', [])) if memory_context else 0,
                'fact_count': len(memory_context.get('facts', [])) if memory_context else 0,
                'total_tokens': memory_context.get('total_tokens', 0) if memory_context else 0,
            } if memory_context else None,
        }
    )

    # 更新会话消息计数
    conversation.message_count = conversation.messages.count()
    conversation.save()

    # 记忆引擎：检查是否需要生成摘要
    if MEMORY_ENGINE_AVAILABLE:
        try:
            check_and_summarize(tenant, conversation)
        except Exception:
            pass

    return api_success({
        'session_id': str(conversation.id),
        'reply': result.get('reply', '') + memory_hint,
        'agent': AGENT_NAMES.get(agent_code, '智能体'),
        'agentCode': agent_code,
        'intent': intent['intent'],
        'confidence': intent['confidence'],
        'result': {k: v for k, v in result.items() if k not in ('reply', 'tokens', 'execution_log', 'step_results')},
        'tokens': result.get('tokens', 0),
        'workflow': result.get('workflow', False),
        'execution_log': result.get('execution_log', []),
        'credit': credit_info,
        'memory': {
            'strategy': memory_context['strategy'] if memory_context else 'disabled',
            'short_term_count': len(memory_context.get('short_term', [])) if memory_context else 0,
            'summary_count': len(memory_context.get('summaries', [])) if memory_context else 0,
            'fact_count': len(memory_context.get('facts', [])) if memory_context else 0,
            'total_tokens': memory_context.get('total_tokens', 0) if memory_context else 0,
            'recalled_summaries': memory_context.get('summaries', []) if memory_context else [],
            'recalled_facts': memory_context.get('facts', []) if memory_context else [],
        } if memory_context else None,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('chat.view')
def chat_history(request: HttpRequest):
    """GET /api/v1/chat/history?conversation_id=xxx"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    conversation_id = request.GET.get('conversation_id', '')
    if not conversation_id:
        return api_success({'items': [], 'total': 0})

    try:
        conversation = Conversation.objects.get(id=conversation_id, tenant=tenant)
    except Conversation.DoesNotExist:
        return api_success({'items': [], 'total': 0})

    messages = conversation.messages.all()
    data = MessageSerializer(messages, many=True).data
    return api_success({'items': data, 'total': len(data)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('chat.view')
def chat_conversations(request: HttpRequest):
    """GET /api/v1/chat/conversations — 会话列表"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    conversations = tenant.conversations.filter(user=request.user).order_by('-updated_at')
    data = ConversationSerializer(conversations, many=True).data
    return api_success({'items': data, 'total': len(data)})


# ── Ai药采购专用接口 ────────────────────────────

def _product_matches_tenant(product, tenant):
    """判断产品是否对指定租户可销，根据可销区域和可销渠道匹配。

    规则：
    - 产品 sales_regions 为空 → 全国可销，匹配所有租户
    - 产品 sales_regions 有值 → 租户省份必须在列表中，如果指定了城市则城市也需匹配
    - 产品 sales_channels 为空 → 全渠道可销，匹配所有租户
    - 产品 sales_channels 有值 → 租户 channel 必须在列表中
    - 租户 province 为空 → 无法匹配有区域限制的产品
    - 租户 channel 为空 → 无法匹配有渠道限制的产品
    """
    # 区域匹配
    regions = product.sales_regions or []
    if regions:
        if not tenant.province:
            return False
        matched = False
        for region in regions:
            province = (region.get('province') or '').strip()
            if province == tenant.province:
                cities = region.get('cities') or []
                if cities:
                    if tenant.city and tenant.city in cities:
                        matched = True
                        break
                else:
                    matched = True
                    break
        if not matched:
            return False

    # 渠道匹配
    channels = product.sales_channels or []
    if channels:
        if not tenant.channel:
            return False
        if tenant.channel not in channels:
            return False

    return True


def _query_public_products(message_text, tenant=None, limit=20):
    """从公共数据库搜索产品，返回上下文文本。

    按消息关键词匹配产品名称、厂家、规格、批准文号等字段，
    并根据租户的区域（province/city）和渠道（channel）筛选可销产品，
    将匹配到的产品信息格式化为 prompt 注入文本。
    """
    try:
        from apps.public_database.models import PublicProduct
        from django.db.models import Q

        qs = PublicProduct.objects.select_related('supplier').filter(status='active')
        keywords = [kw.strip() for kw in message_text.replace('，', ' ').replace(',', ' ').split() if kw.strip()]
        if keywords:
            q = Q()
            for kw in keywords:
                q |= Q(name__icontains=kw)
                q |= Q(trade_name__icontains=kw)
                q |= Q(manufacturer__icontains=kw)
                q |= Q(specification__icontains=kw)
                q |= Q(category__icontains=kw)
                q |= Q(approval_number__icontains=kw)
                q |= Q(product_code__icontains=kw)
            qs = qs.filter(q)

        # 取更多产品以便过滤，limit 是最终返回数量
        products = list(qs.order_by('-updated_at')[:max(limit * 2, 50)])

        # 按租户区域+渠道过滤
        if tenant and products:
            products = [p for p in products if _product_matches_tenant(p, tenant)]
            products = products[:limit]

        if not products:
            return ''

        lines = ['[公共数据库产品]', f'根据您的需求，从公共数据库中找到以下 {len(products)} 个相关产品：']
        for i, p in enumerate(products, 1):
            parts = [f'{i}. {p.name}']
            if p.trade_name:
                parts.append(f'（商品名：{p.trade_name}）')
            detail_parts = []
            if p.specification:
                detail_parts.append(f'规格：{p.specification}')
            if p.manufacturer:
                detail_parts.append(f'厂家：{p.manufacturer}')
            if p.price:
                detail_parts.append(f'价格：¥{p.price}')
            if p.supplier:
                detail_parts.append(f'供应商：{p.supplier.name}')
            if p.min_order_quantity and p.min_order_quantity > 1:
                detail_parts.append(f'起订量：{p.min_order_quantity}')
            if p.category:
                detail_parts.append(f'分类：{p.category}')
            if p.approval_number:
                detail_parts.append(f'批准文号：{p.approval_number}')
            if p.storage_condition:
                detail_parts.append(f'储存条件：{p.storage_condition}')
            if p.delivery_info:
                detail_parts.append(f'配送：{p.delivery_info[:80]}')
            parts.append(' | '.join(detail_parts))
            lines.append(' '.join(parts))

        return '\n'.join(lines)
    except Exception:
        return ''


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_permission('chat.view')
def pharmacy_send(request: HttpRequest):
    """POST /api/v1/chat/pharmacy/send — Ai药采购专用聊天

    特点：
    1. 强制使用采购智能体（procurement），不走意图识别
    2. 免扣积分（免费使用）
    3. 自动查询公共数据库产品，注入到 prompt 上下文
    4. 支持快采/集采/找品三种模式
    """
    tenant = _get_tenant(request)
    if not tenant:
        return api_error(code=API_CODE.NOT_FOUND, msg='未找到租户')

    message_text = request.data.get('message', '').strip()
    session_id = request.data.get('session_id', '')
    mode = request.data.get('mode', 'quick')  # quick / collective / search

    if not message_text:
        return api_error(code=API_CODE.BAD_REQUEST, msg='消息不能为空')

    agent_code = 'procurement'  # 强制采购智能体

    # 权限检查：需要采购智能体权限
    perm_code = AGENT_PERMISSION_MAP.get(agent_code)
    if perm_code and not has_tenant_permission(request.user, tenant, perm_code):
        return api_error(code=API_CODE.FORBIDDEN, msg='无权限使用采购智能体')

    # 注意：Ai药采购免扣积分，不调用 check_credits / deduct_credits

    # 查找或创建会话
    if session_id:
        try:
            conversation = Conversation.objects.get(id=session_id, tenant=tenant)
        except Conversation.DoesNotExist:
            conversation = Conversation.objects.create(
                tenant=tenant, user=request.user,
                title=message_text[:30], agent_code=agent_code
            )
    else:
        conversation = Conversation.objects.create(
            tenant=tenant, user=request.user,
            title=message_text[:30], agent_code=agent_code
        )

    # 记忆引擎：构建记忆上下文
    memory_context = None
    if MEMORY_ENGINE_AVAILABLE:
        try:
            memory_context = build_memory_context(tenant, conversation, message_text)
        except Exception:
            memory_context = None

    # 保存用户消息
    Message.objects.create(
        conversation=conversation, role='user',
        content=message_text
    )

    # 模拟延迟
    _time.sleep(0.5)

    # 查询公共数据库产品，构建产品上下文
    product_context = _query_public_products(message_text, tenant=tenant)

    # 构建增强消息（注入产品上下文 + 采购模式提示）
    mode_hint = {
        'quick': '（快采模式：用户需要快速采购，请优先推荐现货、快速配送的方案）',
        'collective': '（集采模式：用户希望参与集采拼单以获得更优价格，请关注集采批次和批量优惠）',
        'search': '（找品模式：用户在搜索查找产品信息，请提供详细的产品参数、厂家、批准文号等信息）',
    }.get(mode, '')

    enhanced_text = message_text
    if product_context:
        enhanced_text = f'{message_text}\n\n{product_context}'
    if mode_hint:
        enhanced_text = f'{enhanced_text}\n{mode_hint}'

    # 生成回复：优先外部工作流 → 内部工作流 → 硬编码
    result = execute_external_workflow_reply(
        agent_code, enhanced_text, tenant,
        user_identifier=str(request.user.id) if request.user else f'tenant_{tenant.id}'
    )
    if result is None:
        result = execute_workflow_reply(agent_code, enhanced_text, tenant)
    if result is None:
        result = generate_agent_reply(agent_code, message_text)

    # 免扣积分：返回 credit_info 但 deducted=0
    credit_info = {
        'deducted': 0,
        'tokens': result.get('tokens', 0),
        'coefficient': 0,
        'free': True,
        'reason': 'Ai药采购免扣积分',
    }

    # 记忆引擎提示
    memory_hint = ''
    if memory_context and memory_context.get('strategy') != 'disabled':
        recalled_summaries = memory_context.get('summaries', [])
        recalled_facts = memory_context.get('facts', [])
        if recalled_summaries or recalled_facts:
            memory_hint = f'\n\n📋 **记忆召回**：短期{memory_context["short_term_messages"]}条 | 摘要{len(recalled_summaries)}篇 | 事实{len(recalled_facts)}条 | 估算{memory_context["total_tokens"]}tokens'

    # 保存助手消息
    Message.objects.create(
        conversation=conversation, role='assistant',
        content=result.get('reply', ''),
        agent_code=agent_code,
        agent_name=AGENT_NAMES.get(agent_code, ''),
        metadata={
            'intent': {'agentCode': agent_code, 'intent': '药房采购', 'confidence': 1.0},
            'result': {k: v for k, v in result.items() if k not in ('reply', 'tokens', 'execution_log', 'step_results')},
            'tokens': result.get('tokens', 0),
            'workflow': result.get('workflow', False),
            'execution_log': result.get('execution_log', []),
            'credit': credit_info,
            'pharmacy_mode': mode,
            'product_context_injected': bool(product_context),
            'memory': {
                'strategy': memory_context['strategy'] if memory_context else 'disabled',
                'short_term_count': memory_context.get('short_term_messages', 0) if memory_context else 0,
                'summary_count': len(memory_context.get('summaries', [])) if memory_context else 0,
                'fact_count': len(memory_context.get('facts', [])) if memory_context else 0,
                'total_tokens': memory_context.get('total_tokens', 0) if memory_context else 0,
            } if memory_context else None,
        }
    )

    # 更新会话消息计数
    conversation.message_count = conversation.messages.count()
    conversation.save()

    # 记忆引擎：检查是否需要生成摘要
    if MEMORY_ENGINE_AVAILABLE:
        try:
            check_and_summarize(tenant, conversation)
        except Exception:
            pass

    # 根据模式获取结构化数据
    solutions = None
    search_results = None
    products = []

    if mode == 'quick':
        # 快采模式：生成三方案
        solutions = _get_quick_purchase_solutions(message_text, tenant)
        products = _get_product_list(message_text, limit=10)
    elif mode == 'search':
        # 找品模式：使用向量搜索
        search_results = _get_search_results(message_text, tenant)
        products = search_results
    else:
        # 集采模式：返回产品列表供选择
        products = _get_product_list(message_text, limit=10)

    return api_success({
        'session_id': str(conversation.id),
        'reply': result.get('reply', '') + memory_hint,
        'agent': AGENT_NAMES.get(agent_code, '智能体'),
        'agentCode': agent_code,
        'intent': '药房采购',
        'confidence': 1.0,
        'result': {k: v for k, v in result.items() if k not in ('reply', 'tokens', 'execution_log', 'step_results')},
        'tokens': result.get('tokens', 0),
        'workflow': result.get('workflow', False),
        'execution_log': result.get('execution_log', []),
        'credit': credit_info,
        'mode': mode,
        'products': products,
        'solutions': solutions,
        'memory': {
            'strategy': memory_context['strategy'] if memory_context else 'disabled',
            'short_term_count': len(memory_context.get('short_term', [])) if memory_context else 0,
            'summary_count': len(memory_context.get('summaries', [])) if memory_context else 0,
            'fact_count': len(memory_context.get('facts', [])) if memory_context else 0,
            'total_tokens': memory_context.get('total_tokens', 0) if memory_context else 0,
            'recalled_summaries': memory_context.get('summaries', []) if memory_context else [],
            'recalled_facts': memory_context.get('facts', []) if memory_context else [],
        } if memory_context else None,
    })


def _get_product_list(message_text, limit=10):
    """从公共数据库搜索产品，返回序列化产品列表（供前端展示产品卡片）"""
    try:
        from apps.public_database.models import PublicProduct
        from apps.public_database.serializers import PublicProductSerializer
        from django.db.models import Q

        qs = PublicProduct.objects.select_related('supplier').filter(status='active')
        keywords = [kw.strip() for kw in message_text.replace('，', ' ').replace(',', ' ').split() if kw.strip()]
        if keywords:
            q = Q()
            for kw in keywords:
                q |= Q(name__icontains=kw)
                q |= Q(trade_name__icontains=kw)
                q |= Q(manufacturer__icontains=kw)
                q |= Q(specification__icontains=kw)
                q |= Q(category__icontains=kw)
                q |= Q(approval_number__icontains=kw)
                q |= Q(product_code__icontains=kw)
            qs = qs.filter(q)

        products = qs.order_by('-updated_at')[:limit]
        return PublicProductSerializer(products, many=True).data
    except Exception:
        return []


def _get_quick_purchase_solutions(message_text, tenant):
    """
    快采三方案：调用 quick_purchase 服务生成送货最快/价格最低/综合建议三套方案
    """
    try:
        from apps.public_database.services.quick_purchase import generate_quick_purchase_solutions
        solutions = generate_quick_purchase_solutions(
            query=message_text,
            tenant_province=tenant.province if tenant else '',
            tenant_city=tenant.city if tenant else '',
        )
        return solutions
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f'快采方案生成失败: {e}')
        return None


def _get_search_results(message_text, tenant):
    """
    找药搜索：调用 vector_search 服务进行语义搜索
    """
    try:
        from apps.public_database.services.vector_search import find_medicine
        results = find_medicine(
            query=message_text,
            top_n=10,
            tenant_province=tenant.province if tenant else '',
            tenant_city=tenant.city if tenant else '',
        )
        # 序列化搜索结果
        product_list = []
        for r in results:
            p = r['product']
            product_list.append({
                'id': p.id,
                'name': p.name,
                'trade_name': p.trade_name,
                'specification': p.specification,
                'manufacturer': p.manufacturer,
                'category': p.category,
                'price': str(p.price),
                'unit': p.unit,
                'approval_number': p.approval_number,
                'supplier_name': p.supplier.name if p.supplier else '',
                'supplier_id': p.supplier_id,
                'stock_quantity': p.stock_quantity,
                'match_type': r.get('match_type', ''),
                'match_fields': r.get('match_fields', []),
                'score': round(r.get('score', 0), 3),
            })
        return product_list
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f'找药搜索失败: {e}')
        return []


# ── 文件上传 ────────────────────────────────

_UPLOAD_MAX_SIZE = 20 * 1024 * 1024
_UPLOAD_ALLOWED_EXT = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_file(request):
    """通用文件上传，返回可���接访问的 URL；资质文件自动 OCR 识别编号与日期"""
    file_obj = request.FILES.get('file')
    if not file_obj:
        return api_error('请选择要上传的文件')

    if file_obj.size > _UPLOAD_MAX_SIZE:
        return api_error('文件大小不能超过20MB')

    ext = os.path.splitext(file_obj.name)[1].lower()
    if ext not in _UPLOAD_ALLOWED_EXT:
        return api_error('仅支持图片或PDF文件')

    filename = f'{uuid.uuid4().hex}{ext}'
    subdir = 'qualifications'
    path = os.path.join(subdir, filename)

    os.makedirs(os.path.join(settings.MEDIA_ROOT, subdir), exist_ok=True)
    with default_storage.open(path, 'wb+') as dest:
        for chunk in file_obj.chunks():
            dest.write(chunk)

    url = request.build_absolute_uri(settings.MEDIA_URL + path.replace('\\', '/'))

    # 资质文件 OCR 识别
    qual_type = request.POST.get('qualification_type', '') or request.data.get('qualification_type', '')
    ocr_result = recognize_qualification(url, qualification_type=qual_type)

    return api_success({
        'url': url,
        'name': file_obj.name,
        'size': file_obj.file.size if hasattr(file_obj.file, 'size') else file_obj.size,
        'type': file_obj.content_type or '',
        'ocr': ocr_result,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def speech_to_text(request):
    """
    语音转文字接口
    接收前端录音（WebM/MP3/WAV），使用 Vosk 离线识别返回文本

    请求: multipart/form-data
      - audio: 音频文件
      - format: 音频格式（可选，默认从文件名推断）

    响应: { code: 0, msg: 'ok', data: { text: '识别文本' } }
    """
    audio_file = request.FILES.get('audio')
    if not audio_file:
        return api_error(msg='请上传音频文件')

    if audio_file.size > 10 * 1024 * 1024:
        return api_error(msg='音频文件不能超过10MB')

    # 推断音频格式
    input_format = request.POST.get('format', '')
    if not input_format:
        ext = os.path.splitext(audio_file.name)[1].lower().lstrip('.')
        input_format = ext if ext else 'webm'

    try:
        audio_bytes = audio_file.read()
        from .stt import transcribe_audio
        text = transcribe_audio(audio_bytes, input_format)

        return api_success({'text': text})
    except RuntimeError as e:
        logger.error('STT 服务不可用: %s', str(e))
        return api_error(msg=f'语音识别服务未就绪: {str(e)}')
    except Exception as e:
        logger.error('STT 转写失败: %s', str(e), exc_info=True)
        return api_error(msg='语音识别失败，请重试')
