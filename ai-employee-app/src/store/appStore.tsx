// 全局 mock 状态中枢 —— YesGo 平台数据底座
// 统管：智能体 / 算力积分账本 / 模型库 / 知识库 / SaaS 连接 / 双层配置
// 全程 mock，所有"接真"接缝以 // TODO: 接入真实 XXX 标注。
// 接入真实大模型 / SaaS 后，只需替换 action 内部实现，视图无需改动。
//
// 2026-07-21 融入同事 AGENTS.md 架构规范：
//   - 新增多租户状态（租户信息 / 成员关系 / 角色-智能体绑定）
//   - 新增 Dify 工作流配置（5 个工作流独立 API Key）
//   - 新增后端 API 连接配置（baseUrl / Token）
//   - 智能体 code 字段对齐五大工作流码

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { Agent, TenantInfo, TenantMembership, AgentBinding, DataBaseConnector, Role, TenantMember, MediaAsset, AgentWorkflowStep, MemoryConfig, WorkflowTemplate, WorkflowOrchRun } from '../types'
import { controlAgent, businessAgents } from '../data/mockAgents'
import { DEFAULT_DIFY_BASE_URL, type AgentCode, type DifyWorkflowConfig } from '../lib/constants'
import { checkAuth, syncAllFromBackend, syncExtendedFromBackend, loginToBackend, logoutBackend } from '../lib/backend'

// —— 模型 ——
export type ModelType = 'commercial' | 'open'
export interface ModelInfo {
  id: string
  name: string
  vendor: string
  type: ModelType
  contextK: number
  /** ready=可用 / deploying=部署中 / offline=未部署 */
  status: 'ready' | 'deploying' | 'offline'
  desc: string
}

// —— 算力积分账本 ——
export interface CreditEntry {
  id: string
  agentId: string
  agentName: string
  amount: number // 消耗为正数
  reason: string
  time: string
  balanceAfter: number
}

// —— 知识库 ——
export interface KnowledgeDoc {
  id: string
  name: string
  type: string
  size: string
  time: string
  folder: string
  boundAgents: string[] // 绑定的智能体 id
}

// —— SaaS 连接 ——
export interface SaaSConn {
  id: string
  name: string
  desc: string
  status: 'connected' | 'pending' | 'disconnected'
  twoWay: boolean // 是否双向回写
  lastSync: string
}

// —— 智能体自定义配置（企业层，覆盖出厂默认）——
export interface AgentConfig {
  agentId: string
  modelId: string // 绑定模型
  temperature: number
  maxRetry: number // 异常兜底：超时重试次数
  fallbackModelId: string // 失败降级备用模型
  humanTakeoverThreshold: number // 人工接管置信度阈值 %
  custom: boolean // 是否已被企业自定义（false=沿用出厂默认）
}

// —— 多租户（对齐 AGENTS.md） ——
export interface TenantState {
  /** 当前租户信息 */
  info: TenantInfo | null
  /** 当前用户在租户内的成员关系 */
  membership: TenantMembership | null
  /** 当前角色可访问的智能体绑定列表 */
  bindings: AgentBinding[]
  /** 租户套餐（含月度 Token 配额） */
  package: {
    id: string
    name: string
    quotas: Array<{ agentCode: AgentCode; monthly: number; used: number }>
  } | null
  /** 租户角色模板 */
  roles: Role[]
  /** 租户成员列表 */
  members: TenantMember[]
}

// —— Dify 连接状态 ——
export interface DifyState {
  /** 是否已配置（至少一个工作流有 API Key） */
  configured: boolean
  /** 各工作流配置 */
  workflows: Record<AgentCode, DifyWorkflowConfig>
  /** 连接状态 */
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
  /** 最近一次连接测试时间 */
  lastTest: string | null
  /** 连接测试错误信息 */
  error: string | null
}

interface TaskResult {
  text: string
  creditCost?: number
}

interface State {
  agents: Agent[]
  creditBalance: number
  creditLedger: CreditEntry[]
  models: ModelInfo[]
  knowledge: KnowledgeDoc[]
  saas: SaaSConn[]
  /** 数据底座连接器（ERP / B2B / B2C / 三方平台） */
  dataBaseConnectors: DataBaseConnector[]
  /** 当前对话已选中的数据底座 ID 列表 */
  activeDataBases: string[]
  configs: AgentConfig[]
  installedSkills: string[]
  /** 对话派发的待执行任务（办公室视图消费后清空） */
  pendingTask: { text: string; source: 'chat' } | null
  /** 智能体执行完毕后的结果（对话视图消费后清空） */
  lastResult: TaskResult | null
  /** 多租户状态（对齐 AGENTS.md） */
  tenant: TenantState
  /** Dify 工作流连接状态 */
  dify: DifyState
  /** 图片/宣传素材库 */
  media: MediaAsset[]
  /** 后端 API 连接配置 */
  apiBaseUrl: string
  auth: {
    accessToken: string
    refreshToken: string
    /** Token 是否有效 */
    valid: boolean
  }
  /** 是否已认证（登录成功后设为 true） */
  isAuthenticated: boolean
  /** 后端是否已连接（第二层天网大脑） */
  backendConnected: boolean
  /** 后端同步中 */
  backendSyncing: boolean
  /** 本地轻量摘要开关（自治模式开启，SaaS模式自动关闭） */
  localMemorySwitch: boolean
  /** 记忆参数配置（存储时长、Token上限） */
  memoryConfig: MemoryConfig
  /** 工作流模板库（平台预置 + 用户自定义） */
  workflowTemplates: WorkflowTemplate[]
  /** 当前活跃的工作流编排执行 */
  activeOrchRun: WorkflowOrchRun | null
  /** 当前用户的功能权限清单（permission codes，由后端 /auth/me 或 /auth/login 返回） */
  userPermissions: string[]
}

type Action =
  | { type: 'TOGGLE_AGENT'; id: string }
  | { type: 'SET_AGENTS'; agents: Agent[] }
  | { type: 'CONSUME_CREDITS'; agentId: string; agentName: string; amount: number; reason: string }
  | { type: 'RECHARGE'; amount: number }
  | { type: 'SET_DEFAULT_MODEL'; agentId: string; modelId: string }
  | { type: 'DEPLOY_MODEL'; id: string }
  | { type: 'ADD_DOC'; doc: KnowledgeDoc }
  | { type: 'REMOVE_DOC'; id: string }
  | { type: 'TOGGLE_SAAS_TWOWAY'; id: string }
  | { type: 'SET_SAAS_STATUS'; id: string; status: SaaSConn['status'] }
  // —— 数据底座连接器 ——
  | { type: 'TOGGLE_DATA_BASE_CONNECTOR'; id: string }
  | { type: 'SET_DATA_BASE_CONNECTOR_STATUS'; id: string; status: DataBaseConnector['status'] }
  | { type: 'ADD_DATA_BASE_CONNECTOR'; connector: DataBaseConnector }
  | { type: 'UPDATE_DATA_BASE_CONNECTOR'; id: string; updates: Partial<Omit<DataBaseConnector, 'id' | 'icon'>> }
  | { type: 'REMOVE_DATA_BASE_CONNECTOR'; id: string }
  | { type: 'RESET_DATA_BASE_CONNECTORS' }
  | { type: 'TOGGLE_CHAT_DATA_BASE'; id: string }
  | { type: 'UPDATE_CONFIG'; config: Partial<AgentConfig> & { agentId: string } }
  | { type: 'TOGGLE_SKILL'; name: string }
  // —— 智能体知识库绑定 / 命名 / 工作流 ——
  | { type: 'TOGGLE_AGENT_DATA_BASE'; agentId: string; connectorId: string }
  | { type: 'TOGGLE_AGENT_DOC'; agentId: string; docId: string }
  | { type: 'TOGGLE_AGENT_IMAGE'; agentId: string; imageId: string }
  | { type: 'RENAME_AGENT'; agentId: string; name: string }
  | { type: 'UPDATE_AGENT_ROLE_DESC'; agentId: string; role: string; description: string }
  | { type: 'UPDATE_AGENT_WORKFLOW'; agentId: string; workflow: AgentWorkflowStep[] }
  | { type: 'SET_AGENT_SCARF_COLOR'; agentId: string; scarfColor: Agent['scarfColor'] }
  // —— 图片素材库 ——
  | { type: 'ADD_MEDIA_ASSET'; asset: MediaAsset }
  | { type: 'REMOVE_MEDIA_ASSET'; id: string }
  | { type: 'SET_PENDING_TASK'; task: State['pendingTask'] }
  | { type: 'CLEAR_PENDING_TASK' }
  | { type: 'SET_LAST_RESULT'; result: TaskResult }
  // —— 多租户 ——
  | { type: 'SET_TENANT'; tenant: TenantInfo }
  | { type: 'CLEAR_TENANT' }
  | { type: 'SET_TENANT_MEMBERSHIP'; membership: TenantMembership }
  | { type: 'SET_AGENT_BINDINGS'; bindings: AgentBinding[] }
  | { type: 'SET_TENANT_PACKAGE'; pkg: TenantState['package'] }
  // —— 成员与角色 ——
  | { type: 'ADD_MEMBER'; member: TenantMember }
  | { type: 'REMOVE_MEMBER'; id: string }
  | { type: 'UPDATE_MEMBER_ROLE'; id: string; roleId: string; roleName: string }
  | { type: 'UPDATE_MEMBER_CREDITS'; id: string; credits: number }
  | { type: 'TOGGLE_MEMBER_STATUS'; id: string }
  | { type: 'ADD_ROLE'; role: Role }
  | { type: 'UPDATE_ROLE'; role: Role }
  | { type: 'REMOVE_ROLE'; id: string }
  // —— Dify ——
  | { type: 'SET_DIFY_WORKFLOW'; code: AgentCode; apiKey: string; baseUrl?: string }
  | { type: 'SET_DIFY_STATUS'; status: DifyState['connectionStatus']; error?: string }
  | { type: 'TEST_DIFY_CONNECTION'; code: AgentCode }
  // —— API 连接 ——
  | { type: 'SET_API_BASE_URL'; url: string }
  | { type: 'SET_AUTH_TOKENS'; accessToken: string; refreshToken: string }
  | { type: 'SET_BACKEND_STATUS'; connected: boolean; syncing?: boolean }
  | { type: 'LOGIN'; username: string; password: string }
  | { type: 'LOGIN_SUCCESS'; accessToken: string; refreshToken: string }
  | { type: 'LOGOUT' }
  | { type: 'SYNC_FROM_BACKEND'; tenant: unknown; members: unknown[]; package: unknown; roles: unknown[]; models: unknown[]; config: unknown; dify: unknown }
  | { type: 'SYNC_EXTENDED_FROM_BACKEND'; knowledge: unknown[] | null; media: unknown[] | null; tasks: unknown[] | null; creditBalance: number | null; creditLedger: unknown[] | null; skills: unknown[] | null; saas: unknown[] | null; connectors: unknown[] | null }
  // —— 运行模式 & 记忆配置 ——
  | { type: 'TOGGLE_OPERATION_MODE' }
  | { type: 'SET_MEMORY_CONFIG'; config: Partial<MemoryConfig> }
  // —— 工作流编排 ——
  | { type: 'ADD_WORKFLOW_TEMPLATE'; template: WorkflowTemplate }
  | { type: 'REMOVE_WORKFLOW_TEMPLATE'; id: string }
  | { type: 'START_ORCH_RUN'; run: WorkflowOrchRun }
  | { type: 'UPDATE_ORCH_RUN'; updates: Partial<WorkflowOrchRun> }
  | { type: 'CLEAR_ORCH_RUN' }
  | { type: 'SET_USER_PERMISSIONS'; permissions: string[] }

const now = () => new Date().toLocaleString('zh-CN', { hour12: false })

const MODELS: ModelInfo[] = [
  { id: 'qwen-max', name: '通义千问-Max', vendor: '阿里云', type: 'commercial', contextK: 32, status: 'ready', desc: '综合能力强，中文场景表现优秀' },
  { id: 'hunyuan-pro', name: '混元-Pro', vendor: '腾讯', type: 'commercial', contextK: 32, status: 'ready', desc: '国产商用，合规稳定' },
  { id: 'gpt-4o', name: 'GPT-4o', vendor: 'OpenAI', type: 'commercial', contextK: 128, status: 'ready', desc: '推理与多模态领先' },
  { id: 'claude-35', name: 'Claude 3.5 Sonnet', vendor: 'Anthropic', type: 'commercial', contextK: 200, status: 'ready', desc: '长文本与代码能力强' },
  { id: 'ernie-40', name: '文心一言 4.0', vendor: '百度', type: 'commercial', contextK: 8, status: 'ready', desc: '国产商用，知识问答稳定' },
  { id: 'vertical-pro', name: '垂直行业 Pro', vendor: 'YesGo 精调', type: 'commercial', contextK: 64, status: 'ready', desc: '医药行业精调模型，专业术语与合规能力强' },
  { id: 'qwen25-72b', name: 'Qwen2.5-72B', vendor: '阿里（开源）', type: 'open', contextK: 32, status: 'ready', desc: '可本地私有化部署，数据不出域' },
  { id: 'deepseek-v3', name: 'DeepSeek-V3', vendor: '深度求索（开源）', type: 'open', contextK: 64, status: 'ready', desc: '高性价比，推理能力强' },
  { id: 'llama31-70b', name: 'Llama-3.1-70B', vendor: 'Meta（开源）', type: 'open', contextK: 128, status: 'deploying', desc: '开源生态成熟，部署中' },
  { id: 'chatglm4', name: 'ChatGLM4-9B', vendor: '智谱（开源）', type: 'open', contextK: 128, status: 'offline', desc: '轻量本地模型，未部署' }
]

// 租户特定数据从后端同步，初始为空
const KNOWLEDGE: KnowledgeDoc[] = []

// 租户特定数据从后端同步，初始为空
const MEDIA_ASSETS: MediaAsset[] = []

// 租户特定数据从后端同步，初始为空
const SAAS: SaaSConn[] = []

// —— 数据底座连接器：客户可对接的外部业务系统 ——
import {
  Building2,
  ShoppingCart,
  Store,
  Truck,
  Warehouse,
  BarChart3,
  CreditCard,
  Globe,
  Boxes,
  Database,
  Server,
  Cloud,
  Network,
  Package,
  Layers,
  FileBox,
  ShoppingCart as CartIcon,
  Receipt,
  Activity,
  DollarSign,
  type LucideIcon
} from 'lucide-react'

// —— 图标注册表：iconName → LucideIcon ——
// 后台发布新系统时选择图标名称，序列化时只存 iconName，反序列化时查此表
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  Building2,
  ShoppingCart,
  Store,
  Truck,
  Warehouse,
  BarChart3,
  CreditCard,
  Globe,
  Boxes,
  Database,
  Server,
  Cloud,
  Network,
  Package,
  Layers,
  FileBox,
  CartIcon,
  Receipt,
  Activity,
  DollarSign
}

/** 后台发布系统时可选的图标列表（供 UI 图标选择器使用） */
export const ICON_OPTIONS = Object.keys(ICON_REGISTRY)

/** 根据 iconName 获取图标组件，找不到时回退到 Database 图标 */
function resolveIcon(iconName: string): LucideIcon {
  return ICON_REGISTRY[iconName] ?? Database
}

// localStorage 存储 key
const STORAGE_KEY_CONNECTORS = 'yesgo-data-connectors'

/** 序列化连接器数组为可存储的 JSON（去掉 icon 函数，保留 iconName） */
function serializeConnectors(connectors: DataBaseConnector[]): string {
  const serializable = connectors.map(({ icon: _icon, ...rest }) => rest)
  return JSON.stringify(serializable)
}

/** 从 localStorage 反序列化连接器数组（根据 iconName 恢复 icon 组件） */
function deserializeConnectors(json: string): DataBaseConnector[] | null {
  try {
    const raw = JSON.parse(json) as Array<Omit<DataBaseConnector, 'icon'>>
    if (!Array.isArray(raw)) return null
    return raw.map((c) => ({
      ...c,
      icon: resolveIcon(c.iconName || 'Database')
    }))
  } catch {
    return null
  }
}

/** 从 localStorage 加载连接器，失败时返回 null（调用方回退到默认值） */
function loadConnectorsFromStorage(): DataBaseConnector[] | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY_CONNECTORS)
    if (!json) return null
    return deserializeConnectors(json)
  } catch {
    return null
  }
}

/** 保存连接器到 localStorage */
function saveConnectorsToStorage(connectors: DataBaseConnector[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONNECTORS, serializeConnectors(connectors))
  } catch {
    // localStorage 满或不可用，静默失败
  }
}

const DATA_BASE_CONNECTORS: DataBaseConnector[] = [
  {
    id: 'erp',
    name: '企业 ERP 中间库',
    type: 'erp',
    desc: '对接企业内部 ERP，读取商品、库存、订单、财务等核心主数据',
    iconName: 'Building2',
    icon: Building2,
    enabled: true,
    status: 'connected',
    lastSync: '刚刚'
  },
  {
    id: 'b2b-platform',
    name: 'B2B 电商平台',
    type: 'b2b',
    desc: '对接医药 B2B 批发平台，获取客户下单、报价、账期数据',
    iconName: 'ShoppingCart',
    icon: ShoppingCart,
    enabled: true,
    status: 'connected',
    lastSync: '2 分钟前'
  },
  {
    id: 'b2c-store',
    name: 'B2C 零售商城',
    type: 'b2c',
    desc: '对接自营或第三方零售商城，获取 C 端订单与会员数据',
    iconName: 'Store',
    icon: Store,
    enabled: false,
    status: 'disconnected',
    lastSync: '未连接'
  },
  {
    id: 'wms',
    name: '第三方仓储 WMS',
    type: 'third-party',
    desc: '对接第三方仓储物流系统，实时同步多仓库存与发货状态',
    iconName: 'Warehouse',
    icon: Warehouse,
    enabled: true,
    status: 'connected',
    lastSync: '5 分钟前'
  },
  {
    id: 'logistics',
    name: '物流追踪平台',
    type: 'third-party',
    desc: '对接物流承运商，追踪药品流向与签收状态',
    iconName: 'Truck',
    icon: Truck,
    enabled: false,
    status: 'pending',
    lastSync: '待授权'
  },
  {
    id: 'tmall-jd',
    name: '天猫 / 京东旗舰店',
    type: 'third-party',
    desc: '对接天猫、京东等主流电商平台店铺数据',
    iconName: 'Globe',
    icon: Globe,
    enabled: false,
    status: 'disconnected',
    lastSync: '未连接'
  },
  {
    id: 'pos',
    name: '门店 POS 系统',
    type: 'third-party',
    desc: '对接连锁药店 POS，获取终端销售与库存动销数据',
    iconName: 'CreditCard',
    icon: CreditCard,
    enabled: false,
    status: 'disconnected',
    lastSync: '未连接'
  },
  {
    id: 'bi',
    name: '企业经营 BI',
    type: 'third-party',
    desc: '对接企业内部 BI 报表系统，获取经营分析指标',
    iconName: 'BarChart3',
    icon: BarChart3,
    enabled: true,
    status: 'connected',
    lastSync: '10 分钟前'
  },
  {
    id: 'saas-base',
    name: '医药 SaaS 底座',
    type: 'third-party',
    desc: '对接现有医药 SaaS 数据底座（商品 / 库存 / 订单 / 流向 / 客户）',
    iconName: 'Boxes',
    icon: Boxes,
    enabled: true,
    status: 'connected',
    lastSync: '刚刚'
  }
]

// 出厂默认配置（只读基线）
export const FACTORY_CONFIG: Record<string, Omit<AgentConfig, 'agentId' | 'custom'>> = {
  ops: { modelId: 'qwen-max', temperature: 0.3, maxRetry: 2, fallbackModelId: 'hunyuan-pro', humanTakeoverThreshold: 60 },
  crm: { modelId: 'hunyuan-pro', temperature: 0.5, maxRetry: 2, fallbackModelId: 'qwen-max', humanTakeoverThreshold: 70 },
  purchase: { modelId: 'qwen-max', temperature: 0.2, maxRetry: 3, fallbackModelId: 'deepseek-v3', humanTakeoverThreshold: 65 },
  flow: { modelId: 'deepseek-v3', temperature: 0.2, maxRetry: 2, fallbackModelId: 'qwen-max', humanTakeoverThreshold: 60 },
  academic: { modelId: 'qwen25-72b', temperature: 0.6, maxRetry: 2, fallbackModelId: 'qwen-max', humanTakeoverThreshold: 75 }
}

const INIT_CONFIGS: AgentConfig[] = businessAgents.map((a) => ({
  agentId: a.id,
  ...FACTORY_CONFIG[a.id],
  custom: false
}))

// 租户角色从后端同步，初始为空
const ROLES: Role[] = []

// 租户成员从后端同步，初始为空
const MEMBERS: TenantMember[] = []

// —— 工作流编排模板（平台预置） ——
const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tpl-stock-purchase',
    name: '库存预警→采购闭环',
    description: '运营兔监控库存指标→采购兔生成补货方案→回写 SaaS 订单',
    category: 'preset',
    tags: ['库存', '采购', '供应链'],
    createdAt: '2026-07-20',
    steps: [
      { id: 's1', agentId: 'ops', name: '库存监控', prompt: '读取各仓库库存数据，对比安全库存阈值，生成预警清单', retryCount: 2, timeout: 30000, modelId: 'qwen-max', triggerCondition: '库存低于安全线自动触发 / 手动触发' },
      { id: 's2', agentId: 'purchase', name: '生成采购方案', prompt: '根据库存缺口匹配供应商，生成三套采购方案（最快/最优/均衡）', retryCount: 3, timeout: 60000, modelId: 'qwen-max', triggerCondition: 's1 完成后自动触发' },
      { id: 's3', agentId: 'purchase', name: '回写订单', prompt: '将采纳的方案回写为 SaaS 采购订单', retryCount: 2, timeout: 30000, modelId: 'hunyuan-pro', triggerCondition: '用户确认方案后触发' }
    ],
    edges: [
      { from: 's1', to: 's2', type: 'sequential' },
      { from: 's2', to: 's3', type: 'sequential' }
    ]
  },
  {
    id: 'tpl-crm-outreach',
    name: '客户分析→精准触达',
    description: '跟客兔分析客户→运营兔分层→学术兔生成内容→跟客兔执行触达',
    category: 'preset',
    tags: ['客户', '营销', '学术'],
    createdAt: '2026-07-20',
    steps: [
      { id: 's1', agentId: 'crm', name: '客户分层', prompt: '读取客户档案与历史交易，按活跃度、采购频次分层', retryCount: 2, timeout: 30000, modelId: 'hunyuan-pro', triggerCondition: '每周一自动 / 手动触发' },
      { id: 's2a', agentId: 'ops', name: '经营分析', prompt: '分析各层级客户的毛利贡献与增长潜力', retryCount: 2, timeout: 30000, modelId: 'qwen-max', triggerCondition: 's1 完成后并行触发' },
      { id: 's2b', agentId: 'academic', name: '内容生成', prompt: '为不同层级客户生成差异化沟通内容与学术素材', retryCount: 2, timeout: 45000, modelId: 'qwen25-72b', triggerCondition: 's1 完成后并行触发' },
      { id: 's3', agentId: 'crm', name: '执行触达', prompt: '按策略将内容下发给目标客户，生成跟进台账', retryCount: 1, timeout: 60000, modelId: 'hunyuan-pro', triggerCondition: 's2a 和 s2b 均完成后触发' }
    ],
    edges: [
      { from: 's1', to: 's2a', type: 'parallel' },
      { from: 's1', to: 's2b', type: 'parallel' },
      { from: 's2a', to: 's3', type: 'sequential' },
      { from: 's2b', to: 's3', type: 'sequential' }
    ]
  },
  {
    id: 'tpl-flow-monitor',
    name: '流向监控→窜货预警',
    description: '流向兔拉取数据→运营兔辅助分析→生成预警报告',
    category: 'preset',
    tags: ['流向', '窜货', '合规'],
    createdAt: '2026-07-20',
    steps: [
      { id: 's1', agentId: 'flow', name: '拉取流向', prompt: '拉取全渠道商品流向数据，比对授权销售区域', retryCount: 3, timeout: 45000, modelId: 'deepseek-v3', triggerCondition: '每日自动 / 手动触发' },
      { id: 's2', agentId: 'flow', name: '窜货识别', prompt: '识别跨区域窜货路径、异常低价倾销，标记风险等级', retryCount: 2, timeout: 30000, modelId: 'deepseek-v3', triggerCondition: 's1 完成后自动触发' },
      { id: 's3', agentId: 'ops', name: '影响分析', prompt: '分析窜货对区域销售的影响，测算损失金额', retryCount: 2, timeout: 30000, modelId: 'qwen-max', triggerCondition: 's2 完成后自动触发' }
    ],
    edges: [
      { from: 's1', to: 's2', type: 'sequential' },
      { from: 's2', to: 's3', type: 'sequential' }
    ]
  },
  {
    id: 'tpl-academic-campaign',
    name: '学术推广全流程',
    description: '学术兔生成内容→跟客兔执行下发→运营兔追踪效果',
    category: 'preset',
    tags: ['学术', '推广', '效果追踪'],
    createdAt: '2026-07-20',
    steps: [
      { id: 's1', agentId: 'academic', name: '内容策划', prompt: '根据推广目标与受众，策划学术内容结构与关键信息点', retryCount: 2, timeout: 30000, modelId: 'qwen25-72b', triggerCondition: '营销活动启动时手动触发' },
      { id: 's2', agentId: 'academic', name: '生成素材', prompt: '生成合规课件、患教资料、推广话术等全链路素材', retryCount: 3, timeout: 60000, modelId: 'qwen25-72b', triggerCondition: 's1 完成后自动触发' },
      { id: 's3a', agentId: 'crm', name: '渠道下发', prompt: '通过跟客兔将素材下发给目标客户', retryCount: 2, timeout: 45000, modelId: 'hunyuan-pro', triggerCondition: 's2 完成后并行触发' },
      { id: 's3b', agentId: 'ops', name: '效果追踪', prompt: '追踪推广活动数据，分析转化率与 ROI', retryCount: 2, timeout: 30000, modelId: 'qwen-max', triggerCondition: 's2 完成后并行触发' }
    ],
    edges: [
      { from: 's1', to: 's2', type: 'sequential' },
      { from: 's2', to: 's3a', type: 'parallel' },
      { from: 's2', to: 's3b', type: 'parallel' }
    ]
  }
]

const initialState: State = {
  agents: [controlAgent, ...businessAgents],
  creditBalance: 0,
  creditLedger: [],
  models: MODELS,
  knowledge: KNOWLEDGE,
  saas: SAAS,
  dataBaseConnectors: DATA_BASE_CONNECTORS,
  activeDataBases: ['erp', 'b2b-platform', 'saas-base'],
  configs: INIT_CONFIGS,
  media: MEDIA_ASSETS,
  installedSkills: [],
  pendingTask: null,
  lastResult: null,
  // —— 多租户状态（登录后从后端同步） ——
  tenant: {
    info: null,
    membership: null,
    bindings: [],
    package: null,
    roles: ROLES,
    members: MEMBERS
  },
  // —— Dify Mock 初始值 ——
  dify: {
    configured: false,
    workflows: {
      procurement: { code: 'procurement', apiKey: '', baseUrl: DEFAULT_DIFY_BASE_URL },
      operations: { code: 'operations', apiKey: '', baseUrl: DEFAULT_DIFY_BASE_URL },
      marketing: { code: 'marketing', apiKey: '', baseUrl: DEFAULT_DIFY_BASE_URL },
      distribution: { code: 'distribution', apiKey: '', baseUrl: DEFAULT_DIFY_BASE_URL },
      academic: { code: 'academic', apiKey: '', baseUrl: DEFAULT_DIFY_BASE_URL }
    },
    connectionStatus: 'disconnected',
    lastTest: null,
    error: null
  },
  // —— API 连接 ——
  apiBaseUrl: '',
  auth: {
    accessToken: '',
    refreshToken: '',
    valid: false
  },
  isAuthenticated: false,
  backendConnected: false,
  backendSyncing: false,
  // —— 运行模式 & 记忆配置 ——
  localMemorySwitch: false,
  memoryConfig: {
    retentionMonths: 12,
    tokenCap: 50000
  },
  // —— 工作流编排 ——
  workflowTemplates: WORKFLOW_TEMPLATES,
  activeOrchRun: null,
  userPermissions: []
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'TOGGLE_AGENT':
      return {
        ...state,
        agents: state.agents.map((a) => (a.id === action.id ? { ...a, enabled: !a.enabled } : a))
      }
    case 'SET_AGENTS':
      return { ...state, agents: action.agents }
    case 'CONSUME_CREDITS': {
      const balanceAfter = Math.max(0, state.creditBalance - action.amount)
      // 同步扣除当前登录成员的个人积分余额
      const currentUserId = state.tenant.membership?.userId
      const updatedMembers = currentUserId
        ? state.tenant.members.map((m) =>
            m.id === currentUserId ? { ...m, credits: Math.max(0, m.credits - action.amount) } : m
          )
        : state.tenant.members
      // TODO: 接入真实算力计费网关
      const entry: CreditEntry = {
        id: `c${Date.now()}`,
        agentId: action.agentId,
        agentName: action.agentName,
        amount: action.amount,
        reason: action.reason,
        time: now(),
        balanceAfter
      }
      return {
        ...state,
        creditBalance: balanceAfter,
        creditLedger: [entry, ...state.creditLedger],
        tenant: { ...state.tenant, members: updatedMembers }
      }
    }
    case 'RECHARGE':
      return { ...state, creditBalance: state.creditBalance + action.amount }
    case 'SET_DEFAULT_MODEL':
      return {
        ...state,
        configs: state.configs.map((c) =>
          c.agentId === action.agentId ? { ...c, modelId: action.modelId, custom: true } : c
        )
      }
    case 'DEPLOY_MODEL':
      // TODO: 接入真实私有化部署编排
      return {
        ...state,
        models: state.models.map((m) => (m.id === action.id ? { ...m, status: 'ready' } : m))
      }
    case 'ADD_DOC':
      // TODO: 接入真实向量化入库
      return { ...state, knowledge: [action.doc, ...state.knowledge] }
    case 'REMOVE_DOC':
      return { ...state, knowledge: state.knowledge.filter((d) => d.id !== action.id) }
    case 'TOGGLE_SAAS_TWOWAY':
      return {
        ...state,
        saas: state.saas.map((s) => (s.id === action.id ? { ...s, twoWay: !s.twoWay } : s))
      }
    case 'SET_SAAS_STATUS':
      return {
        ...state,
        saas: state.saas.map((s) =>
          s.id === action.id ? { ...s, status: action.status, lastSync: action.status === 'connected' ? '刚刚' : s.lastSync } : s
        )
      }
    // —— 数据底座连接器 ——
    case 'TOGGLE_DATA_BASE_CONNECTOR':
      return {
        ...state,
        dataBaseConnectors: state.dataBaseConnectors.map((c) =>
          c.id === action.id ? { ...c, enabled: !c.enabled } : c
        ),
        // 关闭连接器时，同步从当前对话的已选列表中移除
        activeDataBases: state.activeDataBases.filter((id) => {
          const c = state.dataBaseConnectors.find((x) => x.id === id)
          return id !== action.id || (c?.enabled ?? false)
        })
      }
    case 'SET_DATA_BASE_CONNECTOR_STATUS':
      return {
        ...state,
        dataBaseConnectors: state.dataBaseConnectors.map((c) =>
          c.id === action.id
            ? { ...c, status: action.status, lastSync: action.status === 'connected' ? '刚刚' : c.lastSync }
            : c
        )
      }
    case 'ADD_DATA_BASE_CONNECTOR':
      return {
        ...state,
        dataBaseConnectors: [...state.dataBaseConnectors, action.connector]
      }
    case 'UPDATE_DATA_BASE_CONNECTOR': {
      const iconName = action.updates.iconName
      return {
        ...state,
        dataBaseConnectors: state.dataBaseConnectors.map((c) =>
          c.id === action.id
            ? {
                ...c,
                ...action.updates,
                // 如果更新了 iconName，同步更新 icon 组件
                icon: iconName ? resolveIcon(iconName) : c.icon
              }
            : c
        )
      }
    }
    case 'REMOVE_DATA_BASE_CONNECTOR':
      return {
        ...state,
        dataBaseConnectors: state.dataBaseConnectors.filter((c) => c.id !== action.id),
        // 同步从已选列表中移除
        activeDataBases: state.activeDataBases.filter((id) => id !== action.id)
      }
    case 'RESET_DATA_BASE_CONNECTORS':
      return {
        ...state,
        dataBaseConnectors: DATA_BASE_CONNECTORS,
        activeDataBases: ['erp', 'b2b-platform', 'saas-base']
      }
    case 'TOGGLE_CHAT_DATA_BASE':
      return {
        ...state,
        activeDataBases: state.activeDataBases.includes(action.id)
          ? state.activeDataBases.filter((id) => id !== action.id)
          : [...state.activeDataBases, action.id]
      }
    case 'UPDATE_CONFIG':
      return {
        ...state,
        configs: state.configs.map((c) =>
          c.agentId === action.config.agentId ? { ...c, ...action.config, custom: true } : c
        )
      }
    case 'TOGGLE_SKILL':
      return {
        ...state,
        installedSkills: state.installedSkills.includes(action.name)
          ? state.installedSkills.filter((n) => n !== action.name)
          : [...state.installedSkills, action.name]
      }
    // —— 智能体知识库绑定 / 命名 / 工作流 ——
    case 'TOGGLE_AGENT_DATA_BASE':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id !== action.agentId
            ? a
            : {
                ...a,
                boundDataBases: a.boundDataBases.includes(action.connectorId)
                  ? a.boundDataBases.filter((id) => id !== action.connectorId)
                  : [...a.boundDataBases, action.connectorId]
              }
        )
      }
    case 'TOGGLE_AGENT_DOC':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id !== action.agentId
            ? a
            : {
                ...a,
                boundDocs: a.boundDocs.includes(action.docId)
                  ? a.boundDocs.filter((id) => id !== action.docId)
                  : [...a.boundDocs, action.docId]
              }
        )
      }
    case 'TOGGLE_AGENT_IMAGE':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id !== action.agentId
            ? a
            : {
                ...a,
                boundImages: a.boundImages.includes(action.imageId)
                  ? a.boundImages.filter((id) => id !== action.imageId)
                  : [...a.boundImages, action.imageId]
              }
        )
      }
    case 'RENAME_AGENT':
      return {
        ...state,
        agents: state.agents.map((a) => (a.id === action.agentId ? { ...a, name: action.name } : a))
      }
    case 'UPDATE_AGENT_ROLE_DESC':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === action.agentId ? { ...a, role: action.role, description: action.description } : a
        )
      }
    case 'UPDATE_AGENT_WORKFLOW':
      return {
        ...state,
        agents: state.agents.map((a) => (a.id === action.agentId ? { ...a, workflow: action.workflow } : a))
      }
    case 'SET_AGENT_SCARF_COLOR':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === action.agentId ? { ...a, scarfColor: action.scarfColor } : a
        )
      }
    // —— 图片素材库 ——
    case 'ADD_MEDIA_ASSET':
      return { ...state, media: [action.asset, ...state.media] }
    case 'REMOVE_MEDIA_ASSET':
      return { ...state, media: state.media.filter((m) => m.id !== action.id) }
    case 'SET_PENDING_TASK':
      return { ...state, pendingTask: action.task }
    case 'CLEAR_PENDING_TASK':
      return { ...state, pendingTask: null }
    case 'SET_LAST_RESULT':
      return { ...state, lastResult: action.result }
    // —— 多租户 ——
    case 'SET_TENANT':
      return { ...state, tenant: { ...state.tenant, info: action.tenant } }
    case 'CLEAR_TENANT':
      return {
        ...state,
        tenant: { info: null, membership: null, bindings: [], package: null, roles: [], members: [] }
      }
    case 'SET_TENANT_MEMBERSHIP':
      return { ...state, tenant: { ...state.tenant, membership: action.membership } }
    case 'SET_AGENT_BINDINGS':
      return { ...state, tenant: { ...state.tenant, bindings: action.bindings } }
    case 'SET_TENANT_PACKAGE':
      return { ...state, tenant: { ...state.tenant, package: action.pkg } }
    // —— 成员与角色 ——
    case 'ADD_MEMBER':
      return { ...state, tenant: { ...state.tenant, members: [...state.tenant.members, action.member] } }
    case 'REMOVE_MEMBER':
      return { ...state, tenant: { ...state.tenant, members: state.tenant.members.filter((m) => m.id !== action.id) } }
    case 'UPDATE_MEMBER_ROLE':
      return {
        ...state,
        tenant: {
          ...state.tenant,
          members: state.tenant.members.map((m) =>
            m.id === action.id ? { ...m, roleId: action.roleId, roleName: action.roleName } : m
          )
        }
      }
    case 'UPDATE_MEMBER_CREDITS':
      return {
        ...state,
        tenant: {
          ...state.tenant,
          members: state.tenant.members.map((m) => (m.id === action.id ? { ...m, credits: action.credits } : m))
        }
      }
    case 'TOGGLE_MEMBER_STATUS':
      return {
        ...state,
        tenant: {
          ...state.tenant,
          members: state.tenant.members.map((m) => (m.id === action.id ? { ...m, enabled: !m.enabled } : m))
        }
      }
    case 'ADD_ROLE':
      return { ...state, tenant: { ...state.tenant, roles: [...state.tenant.roles, action.role] } }
    case 'UPDATE_ROLE':
      return {
        ...state,
        tenant: {
          ...state.tenant,
          roles: state.tenant.roles.map((r) => (r.id === action.role.id ? action.role : r))
        }
      }
    case 'REMOVE_ROLE':
      return {
        ...state,
        tenant: {
          ...state.tenant,
          roles: state.tenant.roles.filter((r) => r.id !== action.id)
        }
      }
    // —— Dify ——
    case 'SET_DIFY_WORKFLOW': {
      const wf = {
        ...state.dify.workflows[action.code],
        apiKey: action.apiKey,
        baseUrl: action.baseUrl ?? state.dify.workflows[action.code].baseUrl
      }
      const workflows = { ...state.dify.workflows, [action.code]: wf }
      const configured = Object.values(workflows).some((c) => !!c.apiKey)
      return { ...state, dify: { ...state.dify, workflows, configured } }
    }
    case 'SET_DIFY_STATUS':
      return {
        ...state,
        dify: {
          ...state.dify,
          connectionStatus: action.status,
          error: action.error ?? null,
          lastTest: action.status === 'connected' ? now() : state.dify.lastTest
        }
      }
    case 'TEST_DIFY_CONNECTION': {
      // TODO: 接入真实 Dify —— 实际发起 /v1/workflows/run 测试调用
      const hasKey = !!state.dify.workflows[action.code]?.apiKey
      return {
        ...state,
        dify: {
          ...state.dify,
          connectionStatus: hasKey ? 'connected' : 'error',
          error: hasKey ? null : `工作流 ${action.code} 未配置 API Key`,
          lastTest: now()
        }
      }
    }
    // —— API 连接 ——
    case 'SET_API_BASE_URL':
      return { ...state, apiBaseUrl: action.url }
    case 'SET_AUTH_TOKENS':
      return {
        ...state,
        auth: {
          accessToken: action.accessToken,
          refreshToken: action.refreshToken,
          valid: !!action.accessToken
        }
      }
    case 'SET_BACKEND_STATUS':
      return {
        ...state,
        backendConnected: action.connected,
        backendSyncing: action.syncing ?? state.backendSyncing
      }
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        auth: {
          accessToken: action.accessToken,
          refreshToken: action.refreshToken,
          valid: true
        }
      }
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        auth: { accessToken: '', refreshToken: '', valid: false },
        backendConnected: false,
        backendSyncing: false,
      }
    case 'SYNC_FROM_BACKEND': {
      // 从后端同步的数据覆盖到 store（仅覆盖非 null 字段）
      const next: State = { ...state, backendConnected: true, backendSyncing: false }

      if (action.tenant) {
        next.tenant = { ...next.tenant, info: action.tenant as TenantInfo }
      }
      if (action.members && Array.isArray(action.members)) {
        next.tenant = { ...next.tenant, members: action.members as TenantMember[] }
      }
      if (action.roles && Array.isArray(action.roles)) {
        next.tenant = { ...next.tenant, roles: action.roles as Role[] }
      }
      if (action.package) {
        next.tenant = { ...next.tenant, package: action.package as TenantState['package'] }
      }
      if (action.models && Array.isArray(action.models)) {
        next.models = action.models as ModelInfo[]
      }
      if (action.config && typeof action.config === 'object') {
        const cfg = action.config as { agents?: AgentConfig[] }
        if (cfg.agents && Array.isArray(cfg.agents)) {
          next.configs = cfg.agents
        }
      }
      if (action.dify && typeof action.dify === 'object') {
        next.dify = action.dify as DifyState
      }
      return next
    }
    case 'SYNC_EXTENDED_FROM_BACKEND': {
      const next: State = { ...state }
      if (action.knowledge && Array.isArray(action.knowledge)) {
        next.knowledge = action.knowledge as KnowledgeDoc[]
      }
      if (action.media && Array.isArray(action.media)) {
        next.media = action.media as MediaAsset[]
      }
      if (action.tasks && Array.isArray(action.tasks)) {
        // Tasks are stored in component state, not in global store — skip
      }
      if (action.creditBalance !== null && typeof action.creditBalance === 'number') {
        next.creditBalance = action.creditBalance
      }
      if (action.creditLedger && Array.isArray(action.creditLedger)) {
        next.creditLedger = action.creditLedger as CreditEntry[]
      }
      if (action.skills && Array.isArray(action.skills)) {
        const installed = (action.skills as Array<{ installed: boolean; name: string }>)
          .filter(s => s.installed).map(s => s.name)
        next.installedSkills = installed
      }
      if (action.saas && Array.isArray(action.saas)) {
        next.saas = action.saas as SaaSConn[]
      }
      if (action.connectors && Array.isArray(action.connectors)) {
        // 后端返回的 connector 没有 icon 组件，需要从 iconName 恢复
        next.dataBaseConnectors = (action.connectors as Array<Record<string, unknown>>).map(c => ({
          ...c,
          icon: ICON_REGISTRY[(c.iconName as string) || 'Database'] ?? Database
        })) as DataBaseConnector[]
      }
      return next
    }
    // —— 运行模式 & 记忆配置 ——
    case 'TOGGLE_OPERATION_MODE':
      return {
        ...state,
        localMemorySwitch: !state.localMemorySwitch
      }
    case 'SET_MEMORY_CONFIG':
      return {
        ...state,
        memoryConfig: { ...state.memoryConfig, ...action.config }
      }
    // —— 工作流编排 ——
    case 'ADD_WORKFLOW_TEMPLATE':
      return { ...state, workflowTemplates: [...state.workflowTemplates, action.template] }
    case 'REMOVE_WORKFLOW_TEMPLATE':
      return { ...state, workflowTemplates: state.workflowTemplates.filter((t) => t.id !== action.id) }
    case 'START_ORCH_RUN':
      return { ...state, activeOrchRun: action.run }
    case 'UPDATE_ORCH_RUN':
      return {
        ...state,
        activeOrchRun: state.activeOrchRun ? { ...state.activeOrchRun, ...action.updates } : null
      }
    case 'CLEAR_ORCH_RUN':
      return { ...state, activeOrchRun: null }
    case 'SET_USER_PERMISSIONS':
      return { ...state, userPermissions: action.permissions }
    default:
      return state
  }
}

interface StoreCtx extends State {
  toggleAgent: (id: string) => void
  setAgents: (agents: Agent[]) => void
  consumeCredits: (agentId: string, agentName: string, amount: number, reason: string) => void
  recharge: (amount: number) => void
  setDefaultModel: (agentId: string, modelId: string) => void
  deployModel: (id: string) => void
  addDoc: (doc: KnowledgeDoc) => void
  removeDoc: (id: string) => void
  toggleSaasTwoWay: (id: string) => void
  setSaasStatus: (id: string, status: SaaSConn['status']) => void
  // —— 数据底座连接器 ——
  toggleDataBaseConnector: (id: string) => void
  setDataBaseConnectorStatus: (id: string, status: DataBaseConnector['status']) => void
  addDataBaseConnector: (connector: DataBaseConnector) => void
  updateDataBaseConnector: (id: string, updates: Partial<Omit<DataBaseConnector, 'id' | 'icon'>>) => void
  removeDataBaseConnector: (id: string) => void
  resetDataBaseConnectors: () => void
  toggleChatDataBase: (id: string) => void
  updateConfig: (config: Partial<AgentConfig> & { agentId: string }) => void
  toggleSkill: (name: string) => void
  // —— 智能体知识库绑定 / 命名 / 工作流 ——
  toggleAgentDataBase: (agentId: string, connectorId: string) => void
  toggleAgentDoc: (agentId: string, docId: string) => void
  toggleAgentImage: (agentId: string, imageId: string) => void
  renameAgent: (agentId: string, name: string) => void
  updateAgentRoleDesc: (agentId: string, role: string, description: string) => void
  updateAgentWorkflow: (agentId: string, workflow: AgentWorkflowStep[]) => void
  setAgentScarfColor: (agentId: string, scarfColor: Agent['scarfColor']) => void
  // —— 图片素材库 ——
  addMediaAsset: (asset: MediaAsset) => void
  removeMediaAsset: (id: string) => void
  modelById: (id: string) => ModelInfo | undefined
  /** 从对话派发任务到办公室 */
  dispatchTask: (text: string) => void
  /** 清空待执行任务（办公室消费后调用） */
  clearPendingTask: () => void
  /** 智能体执行完毕，回写结果到对话（可附带积分消耗） */
  setTaskResult: (result: TaskResult) => void
  // —— 多租户 ——
  setTenant: (tenant: TenantInfo) => void
  clearTenant: () => void
  setTenantMembership: (membership: TenantMembership) => void
  setAgentBindings: (bindings: AgentBinding[]) => void
  setTenantPackage: (pkg: TenantState['package']) => void
  // —— 成员与角色 ——
  addMember: (member: TenantMember) => void
  removeMember: (id: string) => void
  updateMemberRole: (id: string, roleId: string, roleName: string) => void
  updateMemberCredits: (id: string, credits: number) => void
  toggleMemberStatus: (id: string) => void
  addRole: (role: Role) => void
  updateRole: (role: Role) => void
  removeRole: (id: string) => void
  // —— Dify ——
  setDifyWorkflow: (code: AgentCode, apiKey: string, baseUrl?: string) => void
  setDifyStatus: (status: DifyState['connectionStatus'], error?: string) => void
  testDifyConnection: (code: AgentCode) => void
  // —— API 连接 ——
  setApiBaseUrl: (url: string) => void
  setAuthTokens: (accessToken: string, refreshToken: string) => void
  // —— 认证 ——
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  // —— 后端同步 ——
  setBackendStatus: (connected: boolean, syncing?: boolean) => void
  syncFromBackend: (data: { tenant: unknown; members: unknown[]; package: unknown; roles: unknown[]; models: unknown[]; config: unknown; dify: unknown }) => void
  syncExtendedFromBackend: (data: { knowledge: unknown[] | null; media: unknown[] | null; tasks: unknown[] | null; creditBalance: number | null; creditLedger: unknown[] | null; skills: unknown[] | null; saas: unknown[] | null; connectors: unknown[] | null }) => void
  // —— 运行模式 & 记忆配置 ——
  toggleOperationMode: () => void
  setMemoryConfig: (config: Partial<MemoryConfig>) => void
  // —— 工作流编排 ——
  addWorkflowTemplate: (template: WorkflowTemplate) => void
  removeWorkflowTemplate: (id: string) => void
  startOrchRun: (run: WorkflowOrchRun) => void
  updateOrchRun: (updates: Partial<WorkflowOrchRun>) => void
  clearOrchRun: () => void
  // —— 权限 ——
  setUserPermissions: (permissions: string[]) => void
}

const Ctx = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  // 懒加载初始化：优先从 localStorage 读取已保存的连接器，没有则用默认值
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const stored = loadConnectorsFromStorage()
    if (stored && stored.length > 0) {
      return { ...initialState, dataBaseConnectors: stored }
    }
    return initialState
  })

  // 持久化：dataBaseConnectors 变化时自动保存到 localStorage
  useEffect(() => {
    saveConnectorsToStorage(state.dataBaseConnectors)
  }, [state.dataBaseConnectors])

  // 启动同步：检查已有 token → 从后端拉取租户/模型/配置数据
  useEffect(() => {
    let cancelled = false
    async function init() {
      dispatch({ type: 'SET_BACKEND_STATUS', connected: false, syncing: true })
      try {
        // 1. 检查已有 token 是否有效
        const authResult = await checkAuth()
        if (cancelled) return
        if (!authResult.valid) {
          dispatch({ type: 'SET_BACKEND_STATUS', connected: false, syncing: false })
          return
        }
        // token 有效，标记已认证并存储权限
        const accessToken = localStorage.getItem('yesgo_access_token') || ''
        const refreshToken = localStorage.getItem('yesgo_refresh_token') || ''
        dispatch({ type: 'LOGIN_SUCCESS', accessToken, refreshToken })
        dispatch({ type: 'SET_USER_PERMISSIONS', permissions: authResult.permissions })
        // 2. 同步全部数据
        const result = await syncAllFromBackend()
        if (cancelled) return
        dispatch({
          type: 'SYNC_FROM_BACKEND',
          tenant: result.tenant,
          members: result.members ?? [],
          package: result.package,
          roles: result.roles ?? [],
          models: result.models ?? [],
          config: result.config,
          dify: result.dify
        })
        // 3. 同步扩展数据（知识库/素材/任务/积分/技能/SaaS/连接器）
        const extResult = await syncExtendedFromBackend()
        if (cancelled) return
        dispatch({
          type: 'SYNC_EXTENDED_FROM_BACKEND',
          knowledge: extResult.knowledge,
          media: extResult.media,
          tasks: extResult.tasks,
          creditBalance: extResult.creditBalance,
          creditLedger: extResult.creditLedger,
          skills: extResult.skills,
          saas: extResult.saas,
          connectors: extResult.connectors
        })
      } catch (e) {
        console.error('[init] 后端同步异常，降级为本地模式', e)
        if (!cancelled) {
          dispatch({ type: 'SET_BACKEND_STATUS', connected: false, syncing: false })
        }
      }
    }
    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<StoreCtx>(
    () => ({
      ...state,
      toggleAgent: (id) => dispatch({ type: 'TOGGLE_AGENT', id }),
      setAgents: (agents) => dispatch({ type: 'SET_AGENTS', agents }),
      consumeCredits: (agentId, agentName, amount, reason) =>
        dispatch({ type: 'CONSUME_CREDITS', agentId, agentName, amount, reason }),
      recharge: (amount) => dispatch({ type: 'RECHARGE', amount }),
      setDefaultModel: (agentId, modelId) => dispatch({ type: 'SET_DEFAULT_MODEL', agentId, modelId }),
      deployModel: (id) => dispatch({ type: 'DEPLOY_MODEL', id }),
      addDoc: (doc) => dispatch({ type: 'ADD_DOC', doc }),
      removeDoc: (id) => dispatch({ type: 'REMOVE_DOC', id }),
      toggleSaasTwoWay: (id) => dispatch({ type: 'TOGGLE_SAAS_TWOWAY', id }),
      setSaasStatus: (id, status) => dispatch({ type: 'SET_SAAS_STATUS', id, status }),
      // —— 数据底座连接器 ——
      toggleDataBaseConnector: (id) => dispatch({ type: 'TOGGLE_DATA_BASE_CONNECTOR', id }),
      setDataBaseConnectorStatus: (id, status) => dispatch({ type: 'SET_DATA_BASE_CONNECTOR_STATUS', id, status }),
      addDataBaseConnector: (connector) => dispatch({ type: 'ADD_DATA_BASE_CONNECTOR', connector }),
      updateDataBaseConnector: (id, updates) => dispatch({ type: 'UPDATE_DATA_BASE_CONNECTOR', id, updates }),
      removeDataBaseConnector: (id) => dispatch({ type: 'REMOVE_DATA_BASE_CONNECTOR', id }),
      resetDataBaseConnectors: () => dispatch({ type: 'RESET_DATA_BASE_CONNECTORS' }),
      toggleChatDataBase: (id) => dispatch({ type: 'TOGGLE_CHAT_DATA_BASE', id }),
      updateConfig: (config) => dispatch({ type: 'UPDATE_CONFIG', config }),
      toggleSkill: (name) => dispatch({ type: 'TOGGLE_SKILL', name }),
      // —— 智能体知识库绑定 / 命名 / 工作流 ——
      toggleAgentDataBase: (agentId, connectorId) => dispatch({ type: 'TOGGLE_AGENT_DATA_BASE', agentId, connectorId }),
      toggleAgentDoc: (agentId, docId) => dispatch({ type: 'TOGGLE_AGENT_DOC', agentId, docId }),
      toggleAgentImage: (agentId, imageId) => dispatch({ type: 'TOGGLE_AGENT_IMAGE', agentId, imageId }),
      renameAgent: (agentId, name) => dispatch({ type: 'RENAME_AGENT', agentId, name }),
      updateAgentRoleDesc: (agentId, role, description) => dispatch({ type: 'UPDATE_AGENT_ROLE_DESC', agentId, role, description }),
      updateAgentWorkflow: (agentId, workflow) => dispatch({ type: 'UPDATE_AGENT_WORKFLOW', agentId, workflow }),
      setAgentScarfColor: (agentId, scarfColor) => dispatch({ type: 'SET_AGENT_SCARF_COLOR', agentId, scarfColor }),
      // —— 图片素材库 ——
      addMediaAsset: (asset) => dispatch({ type: 'ADD_MEDIA_ASSET', asset }),
      removeMediaAsset: (id) => dispatch({ type: 'REMOVE_MEDIA_ASSET', id }),
      modelById: (id) => state.models.find((m) => m.id === id),
      dispatchTask: (text) => dispatch({ type: 'SET_PENDING_TASK', task: { text, source: 'chat' } }),
      clearPendingTask: () => dispatch({ type: 'CLEAR_PENDING_TASK' }),
      setTaskResult: (result) => dispatch({ type: 'SET_LAST_RESULT', result }),
      // —— 多租户 ——
      setTenant: (tenant) => dispatch({ type: 'SET_TENANT', tenant }),
      clearTenant: () => dispatch({ type: 'CLEAR_TENANT' }),
      setTenantMembership: (membership) => dispatch({ type: 'SET_TENANT_MEMBERSHIP', membership }),
      setAgentBindings: (bindings) => dispatch({ type: 'SET_AGENT_BINDINGS', bindings }),
      setTenantPackage: (pkg) => dispatch({ type: 'SET_TENANT_PACKAGE', pkg }),
      // —— 成员与角色 ——
      addMember: (member) => dispatch({ type: 'ADD_MEMBER', member }),
      removeMember: (id) => dispatch({ type: 'REMOVE_MEMBER', id }),
      updateMemberRole: (id, roleId, roleName) => dispatch({ type: 'UPDATE_MEMBER_ROLE', id, roleId, roleName }),
      updateMemberCredits: (id, credits) => dispatch({ type: 'UPDATE_MEMBER_CREDITS', id, credits }),
      toggleMemberStatus: (id) => dispatch({ type: 'TOGGLE_MEMBER_STATUS', id }),
      addRole: (role) => dispatch({ type: 'ADD_ROLE', role }),
      updateRole: (role) => dispatch({ type: 'UPDATE_ROLE', role }),
      removeRole: (id) => dispatch({ type: 'REMOVE_ROLE', id }),
      // —— Dify ——
      setDifyWorkflow: (code, apiKey, baseUrl) => dispatch({ type: 'SET_DIFY_WORKFLOW', code, apiKey, baseUrl }),
      setDifyStatus: (status, error) => dispatch({ type: 'SET_DIFY_STATUS', status, error }),
      testDifyConnection: (code) => dispatch({ type: 'TEST_DIFY_CONNECTION', code }),
      // —— API 连接 ——
      setApiBaseUrl: (url) => dispatch({ type: 'SET_API_BASE_URL', url }),
      setAuthTokens: (accessToken, refreshToken) => dispatch({ type: 'SET_AUTH_TOKENS', accessToken, refreshToken }),
      // —— 认证 ——
      login: async (username, password) => {
        const result = await loginToBackend(username, password)
        if (result.success) {
          const accessToken = localStorage.getItem('yesgo_access_token') || ''
          const refreshToken = localStorage.getItem('yesgo_refresh_token') || ''
          dispatch({ type: 'LOGIN_SUCCESS', accessToken, refreshToken })
          dispatch({ type: 'SET_USER_PERMISSIONS', permissions: result.permissions ?? [] })
          // 同步全部数据
          const syncResult = await syncAllFromBackend()
          dispatch({
            type: 'SYNC_FROM_BACKEND',
            tenant: syncResult.tenant,
            members: syncResult.members ?? [],
            package: syncResult.package,
            roles: syncResult.roles ?? [],
            models: syncResult.models ?? [],
            config: syncResult.config,
            dify: syncResult.dify
          })
          const extResult = await syncExtendedFromBackend()
          dispatch({
            type: 'SYNC_EXTENDED_FROM_BACKEND',
            knowledge: extResult.knowledge,
            media: extResult.media,
            tasks: extResult.tasks,
            creditBalance: extResult.creditBalance,
            creditLedger: extResult.creditLedger,
            skills: extResult.skills,
            saas: extResult.saas,
            connectors: extResult.connectors
          })
          return true
        }
        return false
      },
      logout: () => {
        logoutBackend()
        dispatch({ type: 'LOGOUT' })
      },
      // —— 后端同步 ——
      setBackendStatus: (connected, syncing) => dispatch({ type: 'SET_BACKEND_STATUS', connected, syncing }),
      syncFromBackend: (data) => dispatch({ type: 'SYNC_FROM_BACKEND', ...data }),
      syncExtendedFromBackend: (data) => dispatch({ type: 'SYNC_EXTENDED_FROM_BACKEND', ...data }),
      // —— 运行模式 & 记忆配置 ——
      toggleOperationMode: () => dispatch({ type: 'TOGGLE_OPERATION_MODE' }),
      setMemoryConfig: (config) => dispatch({ type: 'SET_MEMORY_CONFIG', config }),
      // —— 工作流编排 ——
      addWorkflowTemplate: (template) => dispatch({ type: 'ADD_WORKFLOW_TEMPLATE', template }),
      removeWorkflowTemplate: (id) => dispatch({ type: 'REMOVE_WORKFLOW_TEMPLATE', id }),
      startOrchRun: (run) => dispatch({ type: 'START_ORCH_RUN', run }),
      updateOrchRun: (updates) => dispatch({ type: 'UPDATE_ORCH_RUN', updates }),
      clearOrchRun: () => dispatch({ type: 'CLEAR_ORCH_RUN' }),
      setUserPermissions: (permissions) => dispatch({ type: 'SET_USER_PERMISSIONS', permissions })
    }),
    [state]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
