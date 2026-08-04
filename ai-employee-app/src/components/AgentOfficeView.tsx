import { useState, useEffect } from 'react'
import type { Agent, LogLevel } from '../types'
import { dispatchSync, type AgentId, type DispatchResult } from '../lib/dispatch'
import { useStore } from '../store/appStore'
import RabbitOfficeScene from './RabbitOfficeScene'
import {
  getProducts,
  getShortages,
  getSuppliers,
  submitOrder,
  getCustomers,
  getFlows
} from '../data/mockSaaS'

// —— 采购闭环结果结构 ——
interface PurchaseScheme {
  label: string
  supplier: string
  leadTimeDays: number
  qty: number
  estPrice: number
  recommended?: boolean
}
interface PurchaseResult {
  sku: string
  productName: string
  totalNeed: number
  unit: string
  schemes: PurchaseScheme[]
  orderId: string
}

const BASE_PRICE = 18 // mock 基准单价（元/单位），预留接入真实 SaaS 价格字段

interface Phase {
  progress: number
  label: string
  logs: { level: LogLevel; agent: string; text: string }[]
  result?: PurchaseResult
  credits?: number
}

// 记忆召回词库（模拟从长期记忆中检索到的关键词）
const MEMORY_KEYWORDS = [
  '阿莫西林库存预警', '供应商报价对比', '九州通合作记录', '窜货稽查历史',
  '慢病管理推广', '两票制合规审核', 'Q2促销复盘', '抗生素分级政策',
  '客户分级跟进', '区域流向异常'
]

export default function AgentOfficeView() {
  const store = useStore()
  const [running, setRunning] = useState(false)

  const agents = store.agents
  const control = agents.find((a) => a.id === 'control')
  const business = agents.filter((a) => a.id !== 'control')

  // 防守：后端同步后若 agents 为空，静默返回（AgentOfficeView 隐藏渲染，不可见）
  if (!control) return null

  // 监听来自对话视图的派发任务 → 后台执行 → 结果回流至对话
  useEffect(() => {
    if (store.pendingTask && !running) {
      const taskText = store.pendingTask.text
      store.clearPendingTask()
      runTask(taskText)
    }
  }, [store.pendingTask]) // eslint-disable-line react-hooks/exhaustive-deps

  // 执行一个自然语言任务：对话驱动中控调度 → 派发 → 智能体执行闭环（后台静默执行，结果回流对话）
  const runTask = (raw: string) => {
    const text = raw.trim()
    if (!text || running) return

    const d: DispatchResult = dispatchSync(text)
    const target = business.find((a) => a.id === d.agentId) ?? business[0]
    if (!target) {
      store.setTaskResult({ text: '暂无可用的业务智能体，请在智能体配置中心启用后再试' })
      return
    }
    if (!target.enabled) {
      store.setTaskResult({ text: `${target.name} 已停用，无法派发；请在配置中心开启` })
      return
    }

    setRunning(true)

    const phases = buildPhases(target.id as AgentId, d)
    let i = 0
    const step = () => {
      if (i >= phases.length) {
        setRunning(false)
        const result = buildResultText(target, d, phases[phases.length - 1]?.result)
        store.setTaskResult(result)
        return
      }
      const p = phases[i]
      if (p.credits != null) {
        store.consumeCredits(target.id, target.name, p.credits, d.intent)
      }
      i++
      setTimeout(step, 750)
    }
    setTimeout(step, 600)
  }

  return <RabbitOfficeScene control={control} business={business} />
}

// —— 生成一条记忆召回日志 ——
function makeMemoryLog(agentId: string): { level: LogLevel; agent: string; text: string } {
  const keyword = MEMORY_KEYWORDS[Math.floor(Math.random() * MEMORY_KEYWORDS.length)]
  const recallCount = Math.floor(Math.random() * 4) + 1
  return {
    level: 'memory' as LogLevel,
    agent: agentId,
    text: `🧠 记忆召回：检索到 ${recallCount} 条相关历史记忆，关键词「${keyword}」，注入当前上下文`
  }
}

// —— 根据智能体 + 意图，构建分阶段执行步骤（含记忆召回日志）——
function buildPhases(agentId: AgentId, d: DispatchResult): Phase[] {
  if (agentId === 'purchase') return buildPurchasePhases(d)
  return buildGenericPhases(agentId)
}

function buildPurchasePhases(d: DispatchResult): Phase[] {
  const products = getProducts()
  const target = d.product
    ? products.find((p) => p.sku === d.product!.sku)!
    : worstShortageProduct(products)
  const shortages = getShortages(target.sku)
  const unit = shortages[0]?.unit ?? '盒'
  const totalNeed =
    shortages.reduce((s, i) => s + (i.safetyStock - i.stock), 0) || 300

  const suppliers = getSuppliers()
  const fastest = suppliers.reduce((a, b) => (a.leadTimeDays <= b.leadTimeDays ? a : b))
  const cheapest = suppliers.reduce((a, b) => (a.priceFactor <= b.priceFactor ? a : b))
  const balanced = suppliers.find((s) => s.name.includes('九州通')) ?? suppliers[1]

  const mk = (s: (typeof suppliers)[number]) => ({
    supplier: s.name,
    leadTimeDays: s.leadTimeDays,
    qty: totalNeed,
    estPrice: Math.round(totalNeed * BASE_PRICE * s.priceFactor)
  })
  const schemes: PurchaseScheme[] = [
    { label: '最快到货', recommended: false, ...mk(fastest) },
    { label: '价格最优', recommended: false, ...mk(cheapest) },
    { label: '综合均衡', recommended: true, ...mk(balanced) }
  ]
  const order = submitOrder(target.sku, totalNeed, balanced.name)

  return [
    {
      progress: 10,
      label: '读取 SaaS 库存底座',
      logs: [
        makeMemoryLog('purchase'),
        { level: 'agent' as LogLevel, agent: 'purchase', text: `读取 ${target.name} 库存与供应商主数据` },
        {
          level: 'saas' as LogLevel,
          agent: 'purchase',
          text: `查询库存：发现 ${shortages.length} 个仓低于安全库存（${shortages
            .map((s) => s.warehouse)
            .join('、')}）`
        }
      ]
    },
    {
      progress: 35,
      label: '测算补货缺口',
      logs: [
        {
          level: 'saas' as LogLevel,
          agent: 'purchase',
          text: `计算补货量：合计 ${totalNeed} ${unit}`
        },
        { level: 'agent' as LogLevel, agent: 'purchase', text: '匹配 4 家供应商到货时效与报价' }
      ]
    },
    {
      progress: 60,
      label: '生成三套方案',
      logs: [
        makeMemoryLog('purchase'),
        { level: 'agent' as LogLevel, agent: 'purchase', text: '生成方案：最快 / 最优 / 均衡' }
      ],
      result: { sku: target.sku, productName: target.name, totalNeed, unit, schemes, orderId: order.id }
    },
    {
      progress: 85,
      label: '回写 SaaS 订单',
      logs: [
        { level: 'saas' as LogLevel, agent: 'purchase', text: `回写采购订单 ${order.id} → ${balanced.name}` }
      ]
    },
    {
      progress: 100,
      label: '✅ 采购方案已生成',
      logs: [
        { level: 'credit' as LogLevel, agent: 'purchase', text: '调用模型生成方案，消耗 12 算力积分' },
        { level: 'agent' as LogLevel, agent: 'purchase', text: '✅ 三套方案已生成，可一键采纳' }
      ],
      credits: 12
    }
  ]
}

function buildGenericPhases(agentId: AgentId): Phase[] {
  if (agentId === 'crm') {
    const customers = getCustomers()
    return [
      {
        progress: 25,
        label: '读取客户档案',
        logs: [
          makeMemoryLog(agentId),
          { level: 'agent' as LogLevel, agent: agentId, text: `加载客户主数据（${customers.length} 家）` },
          { level: 'saas' as LogLevel, agent: agentId, text: '读取客户跟进台账与历史沟通记录' }
        ]
      },
      {
        progress: 65,
        label: '生成跟进计划',
        logs: [
          makeMemoryLog(agentId),
          { level: 'agent' as LogLevel, agent: agentId, text: '生成分层跟进计划与话术建议' }
        ]
      },
      {
        progress: 100,
        label: '✅ 跟进计划已生成',
        logs: [
          { level: 'credit' as LogLevel, agent: agentId, text: '调用模型生成话术，消耗 6 算力积分' },
          { level: 'agent' as LogLevel, agent: agentId, text: '✅ 计划已就绪，可一键下发' }
        ],
        credits: 6
      }
    ]
  }
  if (agentId === 'flow') {
    const flows = getFlows()
    const abnormal = flows.filter((f) => f.abnormal).length
    return [
      {
        progress: 25,
        label: '读取流向数据',
        logs: [
          makeMemoryLog(agentId),
          { level: 'saas' as LogLevel, agent: agentId, text: `拉取流向记录 ${flows.length} 条` },
          { level: 'agent' as LogLevel, agent: agentId, text: '跨区域路径比对与异常识别' }
        ]
      },
      {
        progress: 65,
        label: '检测窜货异常',
        logs: [
          {
            level: 'saas' as LogLevel,
            agent: agentId,
            text: abnormal > 0 ? `发现 ${abnormal} 条窜货异常，已标记` : '未发现窜货异常'
          }
        ]
      },
      {
        progress: 100,
        label: '✅ 监控报告已生成',
        logs: [
          { level: 'credit' as LogLevel, agent: agentId, text: '调用模型分析，消耗 8 算力积分' },
          { level: 'agent' as LogLevel, agent: agentId, text: '✅ 监控报告已生成' }
        ],
        credits: 8
      }
    ]
  }
  if (agentId === 'academic') {
    return [
      {
        progress: 30,
        label: '检索合规素材',
        logs: [
          makeMemoryLog(agentId),
          { level: 'saas' as LogLevel, agent: agentId, text: '检索知识库与合规素材' },
          { level: 'agent' as LogLevel, agent: agentId, text: '按受众分层规划内容结构' }
        ]
      },
      {
        progress: 70,
        label: '生成学术内容',
        logs: [
          makeMemoryLog(agentId),
          { level: 'agent' as LogLevel, agent: agentId, text: '生成学术课件大纲与患教素材' }
        ]
      },
      {
        progress: 100,
        label: '✅ 内容已生成',
        logs: [
          { level: 'credit' as LogLevel, agent: agentId, text: '调用模型生成，消耗 10 算力积分' },
          { level: 'agent' as LogLevel, agent: agentId, text: '✅ 内容已生成，可配合跟客下发' }
        ],
        credits: 10
      }
    ]
  }
  // ops 默认
  return [
    {
      progress: 30,
      label: '读取经营数据',
      logs: [
        makeMemoryLog(agentId),
        { level: 'saas' as LogLevel, agent: agentId, text: '读取订单 / 销量 / 库存经营全景' },
        { level: 'agent' as LogLevel, agent: agentId, text: '测算促销弹性与毛利空间' }
      ]
    },
    {
      progress: 70,
      label: '生成经营建议',
      logs: [
        makeMemoryLog(agentId),
        { level: 'agent' as LogLevel, agent: agentId, text: '生成促销方案与定价建议' }
      ]
    },
    {
      progress: 100,
      label: '✅ 建议已生成',
      logs: [
        { level: 'credit' as LogLevel, agent: agentId, text: '调用模型测算，消耗 9 算力积分' },
        { level: 'agent' as LogLevel, agent: agentId, text: '✅ 经营建议已生成' }
      ],
      credits: 9
    }
  ]
}

function worstShortageProduct(products: ReturnType<typeof getProducts>) {
  let worst = products[0]
  let worstGap = -1
  for (const p of products) {
    const gap = getShortages(p.sku).reduce((s, i) => s + (i.safetyStock - i.stock), 0)
    if (gap > worstGap) {
      worstGap = gap
      worst = p
    }
  }
  return worst
}

/** 智能体执行完毕 → 生成自然语言结果回报给对话视图 */
function buildResultText(
  target: Agent,
  d: DispatchResult,
  purchaseResult?: PurchaseResult
): { text: string; creditCost?: number } {
  const { name } = target
  switch (target.id) {
    case 'purchase': {
      const r = purchaseResult
      if (!r) return { text: `${name}已完成补货分析，方案已就绪。` }
      const rec = r.schemes.find((s) => s.recommended)!
      return {
        text: `经理，${name}搞定了！\n\n` +
          `${r.productName} 补货方案：\n` +
          `• 总需补货 **${r.totalNeed}${r.unit}**\n` +
          `• 推荐方案：${rec.label} — 从「${rec.supplier}」采购，约 **${rec.leadTimeDays} 天到货**，预估 **¥${rec.estPrice.toLocaleString()}**\n` +
          `• 订单号：${r.orderId}\n\n` +
          `三套方案已生成：\n` +
          r.schemes.map((s) => `  - ${s.label}：${s.supplier}，${s.leadTimeDays}天，¥${s.estPrice.toLocaleString()}`).join('\n') +
          `\n\n可在对话中回复"采纳"来确认采购方案`,
        creditCost: 12
      }
    }
    case 'crm':
      return {
        text: `经理，${name}跟进计划已做好！\n\n` +
          `已为相关客户生成分层跟进计划，包含沟通话术与拜访节奏建议。`,
        creditCost: 6
      }
    case 'ops':
      return {
        text: `经理，${name}经营报告出来了！\n\n` +
          `已完成经营数据分析，包含促销弹性测算、毛利空间分析与定价建议。`,
        creditCost: 9
      }
    case 'flow':
      return {
        text: `经理，${name}监控完成！\n\n` +
          `流向数据已拉取分析，渠道异常情况已标记。\n` +
          (d.intent.includes('窜货') ? '发现窜货风险点，建议立即核查。\n' : ''),
        creditCost: 8
      }
    case 'academic':
      return {
        text: `经理，${name}素材准备好了！\n\n` +
          `学术内容已生成——合规课件大纲、分层患教素材一应俱全。\n` +
          `可配合跟客兔直接下发。`,
        creditCost: 10
      }
    default:
      return { text: `${name}任务执行完毕。` }
  }
}

// ============================================================
// 后端编排 API 预留（TODO: 接入第二层天网大脑工作流编排）
// ============================================================
// 预留接口签名：
//   POST /api/v1/workflow/orchestrate
//     body: { template_id: string, context: Record<string, unknown> }
//     response: { code: 0, data: { run_id: string, nodes: WorkflowNodeRun[] } }
//
//   GET /api/v1/workflow/orchestrate/{run_id}/status
//     response: { code: 0, data: WorkflowOrchRun }
//
// 当前阶段：前端本地 mock 编排执行，后续接入后端只需替换
// RabbitOfficeScene 中 startOrchestration 内的 store 调用为后端 API。
