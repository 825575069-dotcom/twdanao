"""
积分扣减服务 — 智能体调用时检查并扣减积分

公式: 扣除积分 = ceil(Token消耗量 / tokens_per_credit * 智能体消耗系数)
免扣积分的智能体(free_deduction=True)不消耗积分。
"""

import math
import logging
from django.db import transaction

from apps.platform.models import (
    Tenant, TenantUser, Agent,
    CreditConfig, AgentCreditRule,
)

logger = logging.getLogger(__name__)

# chat_send 使用的 agent_code → Agent.code 映射
# 意图识别返回: procurement/operations/marketing/distribution/academic
# AgentCreditRule.agent_code 使用的是 agent_id 值(purchase/ops/crm/flow/academic)
# 需要通过 Agent 模型桥接两者
_CHAT_CODE_TO_AGENT_ID = {
    'procurement': 'purchase',
    'operations': 'ops',
    'marketing': 'crm',
    'distribution': 'flow',
    'academic': 'academic',
}


def _get_credit_config():
    """获取全局积分配置（单例，id=1）"""
    config = CreditConfig.objects.first()
    if not config:
        config = CreditConfig.objects.create(
            id=1,
            tokens_per_credit=1000,
            unit_price=0.10,
            free_credits_on_register=100,
            min_purchase_credits=100,
        )
    return config


def _get_agent_rule(agent_code):
    """查找智能体的积分消耗规则

    agent_code 来自 chat_send（意图识别），是 Agent.code 值。
    AgentCreditRule.agent_code 存的是 agent_id 值。
    先直接匹配，匹配不到再通过 Agent 模型桥接。
    """
    # 1. 直接匹配
    rule = AgentCreditRule.objects.filter(agent_code=agent_code, enabled=True).first()
    if rule:
        return rule

    # 2. 通过 Agent 模型桥接: chat_code → agent_id → AgentCreditRule
    agent_id = _CHAT_CODE_TO_AGENT_ID.get(agent_code, agent_code)
    rule = AgentCreditRule.objects.filter(agent_code=agent_id, enabled=True).first()
    if rule:
        return rule

    # 3. 尝试用 Agent.code 查找 agent_id
    try:
        agent = Agent.objects.filter(code=agent_code).first()
        if not agent:
            agent = Agent.objects.filter(agent_id=agent_code).first()
        if agent:
            rule = AgentCreditRule.objects.filter(
                agent_code=agent.agent_id, enabled=True
            ).first()
            if rule:
                return rule
    except Exception as e:
        logger.warning(f"查找Agent积分规则失败: {e}")

    return None


def _get_membership(tenant, user):
    """获取租户成员关系"""
    try:
        return tenant.members.get(user=user)
    except TenantUser.DoesNotExist:
        return None


def check_credits(tenant, user, agent_code):
    """调用前检查积分余额

    返回 (allowed: bool, reason: str)
    - 免扣积分的智能体 → 直接允许
    - 无限积分用户 → 直接允许
    - 无成员关系 → 允许（降级处理，不阻塞）
    - 余额 > 0 → 允许
    - 余额 <= 0 → 拒绝
    """
    rule = _get_agent_rule(agent_code)

    # 免扣积分 → 直接放行
    if rule and rule.free_deduction:
        return True, '免扣积分智能体'

    # 获取用户成员关系
    membership = _get_membership(tenant, user)
    if not membership:
        # 非租户成员（如平台管理员测试），不阻塞
        return True, '非租户成员（不扣积分）'

    # 无限积分用户 → 直接放行
    if membership.credit_allocation_type == 'unlimited':
        return True, '无限积分用户'

    # 检查余额
    if membership.credits <= 0:
        return False, '积分余额不足，请联系管理员充值或分配积分'

    return True, f'当前余额: {membership.credits}'


@transaction.atomic
def deduct_credits(tenant, user, agent_code, agent_name, tokens_consumed):
    """调用后扣减积分

    返回 dict:
    {
        'deducted': int,          # 实际扣除的积分数
        'tokens': int,            # 本次消耗的 Token 数
        'coefficient': float,     # 智能体消耗系数
        'tokens_per_credit': float,  # Token 兑换比例
        'free_deduction': bool,   # 是否免扣
        'balance_after': int,     # 扣减后用户余额
        'tenant_balance': int,    # 扣减后租户余额
    }
    """
    config = _get_credit_config()
    rule = _get_agent_rule(agent_code)

    coefficient = rule.coefficient if rule else 1.0
    free_deduction = rule.free_deduction if rule else False

    # 计算应扣积分
    if free_deduction or tokens_consumed <= 0:
        credits_to_deduct = 0
    else:
        tokens_per_credit = config.tokens_per_credit or 1000
        raw = tokens_consumed / tokens_per_credit * coefficient
        credits_to_deduct = max(1, math.ceil(raw))  # 至少扣1积分

    # 获取成员关系
    membership = _get_membership(tenant, user)

    # 扣减用户积分
    user_balance_after = 0
    if membership:
        if membership.credit_allocation_type != 'unlimited':
            membership.credits = max(0, membership.credits - credits_to_deduct)
            membership.save(update_fields=['credits'])
            user_balance_after = membership.credits
        else:
            # 无限用户不扣个人余额，但仍记录
            user_balance_after = membership.credits  # 保持 999999

    # 扣减租户积分池
    tenant_balance_after = tenant.credits
    if credits_to_deduct > 0:
        tenant.credits = max(0, tenant.credits - credits_to_deduct)
        tenant.save(update_fields=['credits'])
        tenant_balance_after = tenant.credits

    # 写入积分账本
    if credits_to_deduct > 0 and membership:
        try:
            from apps.tenant_ext.models import CreditLedger
            reason = (
                f'{agent_name or agent_code} 调用消耗'
                f'（{tokens_consumed} tokens × {coefficient} 系数 '
                f'÷ {config.tokens_per_credit} tokens/积分）'
            )
            CreditLedger.objects.create(
                tenant=tenant,
                user=user,
                agent_code=agent_code,
                agent_name=agent_name or '',
                amount=credits_to_deduct,
                reason=reason,
                balance_after=user_balance_after,
            )
        except Exception as e:
            logger.error(f'写入积分账本失败: {e}')

    return {
        'deducted': credits_to_deduct,
        'tokens': tokens_consumed,
        'coefficient': coefficient,
        'tokens_per_credit': config.tokens_per_credit,
        'free_deduction': free_deduction,
        'balance_after': user_balance_after,
        'tenant_balance': tenant_balance_after,
    }
