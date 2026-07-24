// ============================================================
// YesGo Dify 集成层 —— 5 个平台级智能体工作流
// 对齐 AGENTS.md：
//   - Dify 侧只维护 5 个平台级工作流，不按租户复制
//   - 每个工作流独立 API Key
//   - 租户个性化通过 inputs 注入（tenant_code, role_code, tenant_config）
//   - Dify 职责：意图识别 + OCR + 闲聊回复
//   - 后端职责：状态机 / 缓存 / SKU 检索 / 方案测算 / 下单 / 审计
//
// TODO: 接入真实 Dify —— 本模块接口签名已就绪，替换 fetch 调用即可。
//       当前为 mock 实现，返回结构对齐真实 Dify API。
// ============================================================

import {
  AGENT_CODES,
  DEFAULT_DIFY_BASE_URL,
  type AgentCode,
  type DifyInputs,
  type DifyWorkflowConfig
} from './constants'
import type { DifyWorkflowResult } from '../types'

// —— 配置管理 ——

/** 从 localStorage 读取 Dify 工作流配置 */
export function getDifyConfig(): Record<AgentCode, DifyWorkflowConfig> {
  const defaultConfig: Record<AgentCode, DifyWorkflowConfig> = {
    procurement: { code: 'procurement', apiKey: '', baseUrl: DEFAULT_DIFY_BASE_URL },
    operations: { code: 'operations', apiKey: '', baseUrl: DEFAULT_DIFY_BASE_URL },
    marketing: { code: 'marketing', apiKey: '', baseUrl: DEFAULT_DIFY_BASE_URL },
    distribution: { code: 'distribution', apiKey: '', baseUrl: DEFAULT_DIFY_BASE_URL },
    academic: { code: 'academic', apiKey: '', baseUrl: DEFAULT_DIFY_BASE_URL }
  }

  try {
    const saved = localStorage.getItem('yesgo_dify_config')
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<Record<AgentCode, Partial<DifyWorkflowConfig>>>
      for (const [code, cfg] of Object.entries(parsed)) {
        if (defaultConfig[code as AgentCode]) {
          Object.assign(defaultConfig[code as AgentCode], cfg)
        }
      }
    }
  } catch {
    // 静默回退默认值
  }

  return defaultConfig
}

/** 保存 Dify 工作流配置到 localStorage */
export function saveDifyConfig(config: Record<AgentCode, DifyWorkflowConfig>) {
  localStorage.setItem('yesgo_dify_config', JSON.stringify(config))
}

/** 获取单个工作流的 API Key */
export function getDifyApiKey(code: AgentCode): string {
  return getDifyConfig()[code]?.apiKey || ''
}

/** 判断 Dify 是否已配置（至少一个工作流有 API Key） */
export function isDifyConfigured(): boolean {
  const cfg = getDifyConfig()
  return Object.values(cfg).some((c) => !!c.apiKey)
}

// ============================================================
// 工作流调用
// ============================================================

// —— Dify API 标准类型（接口文档参考，实际接入时使用） ——
/*
interface DifyWorkflowRequest {
  inputs: Record<string, unknown>
  response_mode: 'blocking' | 'streaming'
  user: string
}

interface DifyWorkflowResponse {
  workflow_run_id: string
  task_id: string
  data: {
    id: string
    workflow_id: string
    status: string
    outputs: Record<string, unknown>
    error: string | null
    elapsed_time: number
    total_tokens: number
    total_steps: number
    created_at: number
    finished_at: number
  }
}
*/

/**
 * 调用 Dify 工作流（阻塞模式）
 *
 * TODO: 接入真实 Dify —— 替换 fetch 为真实 /v1/workflows/run 调用。
 *       当前 mock 模拟 Dify 响应格式，保证上层调用无需改动。
 */
export async function invokeDifyWorkflow(
  code: AgentCode,
  inputs: Partial<DifyInputs>,
  _user = 'default'
): Promise<DifyWorkflowResult> {
  const cfg = getDifyConfig()
  const wfConfig = cfg[code]

  if (!wfConfig?.apiKey) {
    throw new Error(`Dify 工作流 ${code} 未配置 API Key`)
  }

  // —— Mock 实现（模拟 Dify API 响应） ——
  // TODO: 接入真实 Dify —— 替换以下 fetch 调用
  // const resp = await fetch(`${wfConfig.baseUrl}/workflows/run`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${wfConfig.apiKey}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     inputs: {
  //       tenant_code: inputs.tenant_code || '',
  //       role_code: inputs.role_code || '',
  //       tenant_config: inputs.tenant_config || {},
  //       ...inputs
  //     },
  //     response_mode: 'blocking',
  //     user
  //   })
  // })
  // const json: DifyWorkflowResponse = await resp.json()

  // Mock：模拟 800ms Dify 处理延迟
  await new Promise((r) => setTimeout(r, 800))

  const mockOutputs = getMockOutputs(code, inputs)
  return {
    workflowCode: code,
    taskId: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'succeeded',
    outputs: mockOutputs,
    totalTokens: Math.floor(200 + Math.random() * 800),
    elapsedMs: 800
  }
}

/**
 * 调用 Dify 意图识别（轻量级，用于对话调度）
 *
 * TODO: 接入真实 Dify —— Dify 聊天 API /chat-messages。
 */
export async function invokeDifyIntentRecognition(
  text: string,
  _user = 'default'
): Promise<{
  intent: string
  agentCode: AgentCode
  confidence: number
  entities: Record<string, string>
}> {
  // Mock 实现 —— 关键词规则引擎（与 dispatch.ts 逻辑对齐）
  await new Promise((r) => setTimeout(r, 300))

  const t = text.toLowerCase()
  let agentCode: AgentCode = 'procurement'
  let intent = '采购补货'
  let confidence = 0.6

  if (t.includes('采购') || t.includes('补货') || t.includes('进货') || t.includes('缺货')) {
    agentCode = 'procurement'; intent = '采购补货'; confidence = 0.92
  } else if (t.includes('客户') || t.includes('跟客') || t.includes('回访') || t.includes('跟进')) {
    agentCode = 'marketing'; intent = '客户跟进'; confidence = 0.88
  } else if (t.includes('促销') || t.includes('经营') || t.includes('分析') || t.includes('报表')) {
    agentCode = 'operations'; intent = '经营分析'; confidence = 0.85
  } else if (t.includes('窜货') || t.includes('流向') || t.includes('预警') || t.includes('滞销')) {
    agentCode = 'distribution'; intent = '流向监控'; confidence = 0.90
  } else if (t.includes('学术') || t.includes('课件') || t.includes('培训') || t.includes('素材')) {
    agentCode = 'academic'; intent = '学术内容'; confidence = 0.87
  }

  const entities: Record<string, string> = {}
  // 提取商品名
  const productMatch = t.match(/(阿莫西林|头孢|布洛芬|胰岛素|奥美拉唑|氯雷他定|蒙脱石散)/)
  if (productMatch) entities.product = productMatch[1]

  return { intent, agentCode, confidence, entities }
}

// —— Mock 数据生成 ——

function getMockOutputs(
  code: AgentCode,
  _inputs: Partial<DifyInputs>
): Record<string, unknown> {
  switch (code) {
    case AGENT_CODES.procurement:
      return {
        reply: `好的老板，马上落实！🛒 采购智能体已出发干活了 🏃`,
        schemes: [
          { label: '价格最优', supplier: '九州通医药（华中）', price: 54000, leadTime: 5, score: 92 },
          { label: '物流最快', supplier: '国药控股（华东）', price: 58500, leadTime: 2, score: 88 },
          { label: '综合均衡', supplier: '九州通医药（华中）', price: 54000, leadTime: 3, score: 95 }
        ],
        recommendation: '综合均衡',
        totalNeed: 2000,
        unit: '盒'
      }
    case AGENT_CODES.operations:
      return {
        reply: `好的老板，马上落实！📊 运营智能体正在分析经营数据...`,
        report: {
          period: '本周',
          revenue: 1285000,
          growth: '+12.3%',
          topProducts: ['阿莫西林', '头孢克肟', '布洛芬'],
          alerts: ['华北仓库存预警', '华南仓配送延迟']
        }
      }
    case AGENT_CODES.marketing:
      return {
        reply: `好的老板，马上落实！💬 跟客智能体正在制定跟进计划...`,
        followUps: [
          { customer: '康健大药房', priority: '高', action: '48h 内电话回访', reason: '上月销量下滑 15%' },
          { customer: '仁和堂连锁', priority: '中', action: '发送新品资料', reason: '新品上线通知' }
        ]
      }
    case AGENT_CODES.distribution:
      return {
        reply: `好的老板，马上落实！🗺️ 流向智能体正在扫描异常...`,
        anomalies: [
          { product: '阿莫西林', from: '华北仓', to: '华南区域', count: 120, severity: '高' },
          { product: '头孢克肟', from: '华东仓', to: '西南区域', count: 45, severity: '中' }
        ],
        summary: '本周发现 2 起窜货异常，涉及金额约 ¥38,000'
      }
    case AGENT_CODES.academic:
      return {
        reply: `好的老板，马上落实！🎓 学术智能体正在生成素材...`,
        materials: [
          { title: '慢病管理患者教育手册', level: '初级', format: 'PDF', pages: 8 },
          { title: '抗生素合理使用指南', level: '进阶', format: 'PPT', slides: 15 }
        ]
      }
    default:
      return { reply: '已收到指令，正在处理...' }
  }
}
