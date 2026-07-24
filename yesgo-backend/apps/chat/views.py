"""
智能体对话 API — 发送消息/历史/会话列表
使用 Django 模型持久化，保持与 Mock 版兼容的返回格式
"""

import random
import time as _time
from django.http import HttpRequest
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.platform.models import Tenant
from apps.platform.utils import api_success, api_error, API_CODE
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer, ChatSendSerializer

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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
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

    # 生成回复
    result = generate_agent_reply(agent_code, message_text)

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
            'result': {k: v for k, v in result.items() if k not in ('reply', 'tokens')},
            'tokens': result.get('tokens', 0),
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
        'result': {k: v for k, v in result.items() if k not in ('reply', 'tokens')},
        'tokens': result.get('tokens', 0),
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
def chat_conversations(request: HttpRequest):
    """GET /api/v1/chat/conversations — 会话列表"""
    tenant = _get_tenant(request)
    if not tenant:
        return api_success({'items': [], 'total': 0})

    conversations = tenant.conversations.filter(user=request.user).order_by('-updated_at')
    data = ConversationSerializer(conversations, many=True).data
    return api_success({'items': data, 'total': len(data)})
