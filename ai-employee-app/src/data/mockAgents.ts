import { Crown, BarChart3, MessageCircle, ShoppingCart, MapPin, GraduationCap } from 'lucide-react'
import type { Agent, AgentWorkflowStep } from '../types'
import { AGENT_CODES } from '../lib/constants'

const defaultWorkflows: Record<string, AgentWorkflowStep[]> = {
  ops: [
    { id: 'w1', name: '读取经营数据', prompt: '从 SaaS 底座读取订单、销量、库存等经营全景数据，按时间维度聚合。' },
    { id: 'w2', name: '测算促销弹性', prompt: '根据历史促销数据测算价格弹性与毛利空间，识别高弹性商品。' },
    { id: 'w3', name: '生成经营建议', prompt: '输出促销方案、定价建议与库存周转优化建议，并标注风险点。' }
  ],
  crm: [
    { id: 'w1', name: '读取客户档案', prompt: '从 CRM 加载客户主数据、跟进记录与历史沟通内容。' },
    { id: 'w2', name: '分层跟进策略', prompt: '按客户活跃度、采购频次、区域等因素分层，制定差异化跟进策略。' },
    { id: 'w3', name: '生成话术建议', prompt: '为每层客户生成标准化沟通话术与拜访/触达节奏。' }
  ],
  purchase: [
    { id: 'w1', name: '读取库存与供应商', prompt: '读取库存缺口、安全库存阈值及供应商主数据（到货时效、报价系数）。' },
    { id: 'w2', name: '测算补货缺口', prompt: '汇总低于安全库存的商品与仓库，计算总补货量。' },
    { id: 'w3', name: '生成三套方案', prompt: '分别生成最快到货、价格最优、综合均衡三套采购方案。' },
    { id: 'w4', name: '回写 SaaS 订单', prompt: '将推荐方案回写为采购订单，并通知供应商备货。' }
  ],
  flow: [
    { id: 'w1', name: '读取流向数据', prompt: '拉取商品跨区域流向记录，包含发货地与销售地。' },
    { id: 'w2', name: '异常路径识别', prompt: '比对授权销售区域，识别窜货与异常低价倾销路径。' },
    { id: 'w3', name: '生成监控报告', prompt: '输出异常清单、预警等级与处理建议。' }
  ],
  academic: [
    { id: 'w1', name: '检索合规素材', prompt: '从知识库检索学术文献、合规素材与产品资料。' },
    { id: 'w2', name: '规划内容结构', prompt: '按目标受众（医生/药师/患者）分层规划内容结构与关键信息点。' },
    { id: 'w3', name: '生成学术内容', prompt: '生成课件大纲、患教素材与合规话术。' }
  ],
  control: [
    { id: 'w1', name: '意图识别', prompt: '解析用户自然语言输入，识别业务意图与关键实体。' },
    { id: 'w2', name: '智能体调度', prompt: '根据意图匹配最合适的业务智能体，并注入上下文。' },
    { id: 'w3', name: '结果回流', prompt: '汇总智能体执行结果，以自然语言回复用户。' }
  ]
}

/** YesGo 经理兔 —— 全局调度中枢 */
export const controlAgent: Agent = {
  id: 'control',
  name: 'YesGo 经理兔',
  role: '意图识别与智能体调度',
  icon: Crown,
  color: 'text-indigo-300',
  accent: '#818cf8',
  emoji: '🧠',
  description: '统筹拆解任务、调度五大业务兔、统一管控模型 / 算力 / 知识库 / SaaS 底座接口',
  enabled: true,
  status: 'idle',
  progress: 0,
  credits: 0,
  log: [],
  boundDataBases: [],
  boundDocs: [],
  boundImages: [],
  workflow: defaultWorkflows.control
}

/** 五大业务智能体（运营 / 跟客 / 采购 / 流向 / 学术） */
export const businessAgents: Agent[] = [
  {
    id: 'ops',
    code: AGENT_CODES.operations,
    name: '运营兔',
    role: '经营分析 / 促销测算',
    icon: BarChart3,
    color: 'text-emerald-300',
    accent: '#34d399',
    emoji: '📊',
    description: '促销推荐、B2B 比价定价、客户跟进提示、经营全景分析',
    enabled: true,
    status: 'idle',
    progress: 0,
  credits: 0,
  log: [],
  boundDataBases: [],
  boundDocs: [],
  boundImages: [],
  workflow: defaultWorkflows.ops
},
  {
    id: 'crm',
    code: AGENT_CODES.marketing,
    name: '跟客兔',
    role: '客户自动沟通',
    icon: MessageCircle,
    color: 'text-sky-300',
    accent: '#38bdf8',
    emoji: '💬',
    description: '面向药店 / 诊所自动标准化沟通、跟进台账、人工随时接管',
    enabled: true,
    status: 'idle',
    progress: 0,
  credits: 0,
  log: [],
  boundDataBases: [],
  boundDocs: [],
  boundImages: [],
  workflow: defaultWorkflows.crm
},
  {
    id: 'purchase',
    code: AGENT_CODES.procurement,
    name: '采购兔',
    role: '三套采购方案',
    icon: ShoppingCart,
    color: 'text-amber-300',
    accent: '#fbbf24',
    emoji: '🛒',
    description: '送货最快 / 价格最优 / 综合平衡，三套方案一键回写 SaaS',
    enabled: true,
    status: 'idle',
    progress: 0,
  credits: 0,
  log: [],
  boundDataBases: [],
  boundDocs: [],
  boundImages: [],
  workflow: defaultWorkflows.purchase
},
  {
    id: 'flow',
    code: AGENT_CODES.distribution,
    name: '流向兔',
    role: '窜货 / 库存预警',
    icon: MapPin,
    color: 'text-rose-300',
    accent: '#fb7185',
    emoji: '🗺️',
    description: '窜货跨区域监控、渠道滞销预警、销量智能预测',
    enabled: true,
    status: 'idle',
    progress: 0,
  credits: 0,
  log: [],
  boundDataBases: [],
  boundDocs: [],
  boundImages: [],
  workflow: defaultWorkflows.flow
},
  {
    id: 'academic',
    code: AGENT_CODES.academic,
    name: '学术兔',
    role: '学术内容生成',
    icon: GraduationCap,
    color: 'text-violet-300',
    accent: '#a78bfa',
    emoji: '🎓',
    description: '合规学术素材、分层内容定制、配合跟客自动下发',
    enabled: true,
    status: 'idle',
    progress: 0,
  credits: 0,
  log: [],
  boundDataBases: [],
  boundDocs: [],
  boundImages: [],
  workflow: defaultWorkflows.academic
}
]
