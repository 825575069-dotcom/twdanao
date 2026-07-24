// 对话驱动中控调度 —— 意图识别 + 派发
// ============================================================
// 双层架构（对齐 AGENTS.md）：
//   第 1 层：Dify 意图识别（接入真实 Dify 时启用）
//   第 2 层：本地规则引擎（关键词 + 实体抽取，离线/回退）
//
// 当前为规则引擎，预留「接入真实 Dify」接缝：
//   把 dispatch() 内部替换为 invokeDifyIntentRecognition() 即可，
//   返回结构 DispatchResult 保持不变。
// ============================================================

import { findProduct } from '../data/mockSaaS'
import { type AgentCode } from './constants'
// TODO: 接入真实 Dify —— 取消注释以下导入
// import { invokeDifyIntentRecognition, isDifyConfigured } from './dify'

export type AgentId = 'ops' | 'crm' | 'purchase' | 'flow' | 'academic'

export interface DispatchResult {
  agentId: AgentId
  /** 五大工作流码（对齐 AGENTS.md） */
  agentCode: AgentCode
  /** 人类可读的意图描述 */
  intent: string
  /** 抽取到的商品实体（如有） */
  product?: { sku: string; name: string }
  confidence: number
  /** 处理来源：'dify' 或 'local' */
  source: 'dify' | 'local'
}

interface Rule {
  agentId: AgentId
  agentCode: AgentCode
  intent: string
  keywords: string[]
}

const RULES: Rule[] = [
  {
    agentId: 'purchase',
    agentCode: 'procurement',
    intent: '采购补货',
    keywords: ['采购', '补货', '进货', '下单', '订购', '买', '缺货', '备货', '库存']
  },
  {
    agentId: 'crm',
    agentCode: 'marketing',
    intent: '客户跟进',
    keywords: ['客户', '跟客', '回访', '药店', '诊所', '沟通', '跟进', '拜访']
  },
  {
    agentId: 'ops',
    agentCode: 'operations',
    intent: '经营分析',
    keywords: ['促销', '活动', '定价', '比价', '经营', '分析', '销量', '报表', '业绩']
  },
  {
    agentId: 'flow',
    agentCode: 'distribution',
    intent: '流向监控',
    keywords: ['窜货', '流向', '滞销', '预警', '渠道', '跨区域', '异常']
  },
  {
    agentId: 'academic',
    agentCode: 'academic',
    intent: '学术内容',
    keywords: ['学术', '合规', '课件', '培训', '素材', '患教', '推广']
  }
]

/**
 * 中控意图识别：把自然语言指令解析为「哪个智能体 + 什么意图 + 提取到的实体」。
 *
 * 调度策略：
 *   1. 若 Dify 已配置 → 优先走 Dify 意图识别（更准）
 *   2. 回退本地规则引擎（关键词 + 实体抽取）
 *
 * TODO: 接入真实模型 —— 替换为 Dify function-calling，返回同样结构即可。
 */
export async function dispatch(text: string): Promise<DispatchResult> {
  // 第 1 层：尝试 Dify
  // TODO: 接入真实 Dify —— 取消注释以下代码块
  // if (isDifyConfigured()) {
  //   try {
  //     const result = await invokeDifyIntentRecognition(text)
  //     return {
  //       agentId: CODE_TO_LEGACY_ID[result.agentCode] as AgentId,
  //       agentCode: result.agentCode,
  //       intent: result.intent,
  //       product: result.entities.product
  //         ? { sku: result.entities.product, name: result.entities.product }
  //         : undefined,
  //       confidence: result.confidence,
  //       source: 'dify'
  //     }
  //   } catch {
  //     // Dify 不可用 → 回退本地规则引擎
  //   }
  // }

  // 第 2 层：本地规则引擎（Mock 回退）
  return localDispatch(text)
}

/** 本地规则引擎（关键词 + 实体抽取） */
function localDispatch(text: string): DispatchResult {
  const t = text.trim()
  if (!t) {
    return { agentId: 'purchase', agentCode: 'procurement', intent: '未识别指令', confidence: 0, source: 'local' }
  }

  // 1) 关键词命中（取命中数最多的智能体）
  const score: Record<string, number> = {}
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (t.includes(kw)) score[rule.agentId] = (score[rule.agentId] ?? 0) + 1
    }
  }

  let best: AgentId = 'purchase'
  let bestScore = 0
  for (const rule of RULES) {
    const s = score[rule.agentId] ?? 0
    if (s > bestScore) {
      bestScore = s
      best = rule.agentId
    }
  }

  // 2) 实体抽取：从指令中识别商品
  const product = findProduct(t)

  // 3) 兜底：无关键词命中但有商品名 → 默认派采购（补货最常见）
  if (bestScore === 0 && product) {
    return {
      agentId: 'purchase',
      agentCode: 'procurement',
      intent: '采购补货',
      product: { sku: product.sku, name: product.name },
      confidence: 0.6,
      source: 'local'
    }
  }

  const matched = RULES.find((r) => r.agentId === best)!
  return {
    agentId: best,
    agentCode: matched.agentCode,
    intent: matched.intent,
    product: product ? { sku: product.sku, name: product.name } : undefined,
    confidence: bestScore > 0 ? Math.min(0.99, 0.6 + bestScore * 0.12) : 0.4,
    source: 'local'
  }
}

/**
 * 同步版本（向后兼容）
 * @deprecated 推荐使用 async dispatch()
 */
export function dispatchSync(text: string): DispatchResult {
  return localDispatch(text)
}
