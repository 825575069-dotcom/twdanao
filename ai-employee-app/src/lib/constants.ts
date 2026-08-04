// ============================================================
// YesGo 平台常量 —— 对齐 AGENTS.md 多租户 SaaS 智能体平台架构
// 同事的五大智能体码（工作流 code）为权威标准
// ============================================================

/** 五大智能体工作流码（与 Dify 平台级工作流一一对应） */
export const AGENT_CODES = {
  procurement: 'procurement',
  operations: 'operations',
  marketing: 'marketing',
  distribution: 'distribution',
  academic: 'academic'
} as const

export type AgentCode = (typeof AGENT_CODES)[keyof typeof AGENT_CODES]

/** 智能体码 → 中文名称 */
export const AGENT_LABELS: Record<AgentCode, string> = {
  procurement: '采购兔',
  operations: '运营兔',
  marketing: '跟客兔',
  distribution: '流向兔',
  academic: '学术兔'
}

/** 旧版 id → AgentCode 映射（向后兼容） */
export const LEGACY_ID_TO_CODE: Record<string, AgentCode> = {
  purchase: 'procurement',
  ops: 'operations',
  crm: 'marketing',
  flow: 'distribution',
  academic: 'academic'
}

/** AgentCode → 旧版 id */
export const CODE_TO_LEGACY_ID: Record<AgentCode, string> = {
  procurement: 'purchase',
  operations: 'ops',
  marketing: 'crm',
  distribution: 'flow',
  academic: 'academic'
}

/** 采购任务状态（对齐 AGENTS.md） */
export const PROCUREMENT_TASK_STATUS = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'partial_succeeded'
] as const

export type ProcurementTaskStatus = (typeof PROCUREMENT_TASK_STATUS)[number]

// ============================================================
// API 业务码（对齐 AGENTS.md：统一 { code, msg, data } 响应）
// ============================================================

export const API_BUSINESS_CODE = {
  SUCCESS: 0,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TENANT_UNAVAILABLE: 1001,
  AGENT_UNAVAILABLE: 1002,
  DIFY_INVOKE_FAILED: 2001,
  PROCUREMENT_SESSION_EXPIRED: 3001,
  PROCUREMENT_ORDER_FAILED: 3002,
  INTERNAL_ERROR: 5000
} as const

/** API 业务码 → 描述 */
export const API_BUSINESS_CODE_MSG: Record<number, string> = {
  [API_BUSINESS_CODE.SUCCESS]: 'success',
  [API_BUSINESS_CODE.BAD_REQUEST]: '参数错误',
  [API_BUSINESS_CODE.UNAUTHORIZED]: '未授权',
  [API_BUSINESS_CODE.FORBIDDEN]: '权限不足',
  [API_BUSINESS_CODE.NOT_FOUND]: '资源不存在',
  [API_BUSINESS_CODE.TENANT_UNAVAILABLE]: '租户不可用',
  [API_BUSINESS_CODE.AGENT_UNAVAILABLE]: '智能体不可访问',
  [API_BUSINESS_CODE.DIFY_INVOKE_FAILED]: 'Dify 调用失败',
  [API_BUSINESS_CODE.PROCUREMENT_SESSION_EXPIRED]: '采购会话已过期',
  [API_BUSINESS_CODE.PROCUREMENT_ORDER_FAILED]: '采购下单失败',
  [API_BUSINESS_CODE.INTERNAL_ERROR]: '内部服务器错误'
}

// ============================================================
// 三入口路由前缀（对齐 AGENTS.md）
// ============================================================

export const ROUTE_PREFIX = {
  CONTROL: '/control',
  TENANT: '/tenant',
  MOBILE: '/mobile'
} as const

// ============================================================
// Dify 工作流配置
// ============================================================

/** 每个工作流独立 API Key（对齐 AGENTS.md：不假设单一密钥） */
export interface DifyWorkflowConfig {
  code: AgentCode
  apiKey: string
  baseUrl: string
}

/** Dify 调用输入结构（对齐 AGENTS.md：租户参数注入） */
export interface DifyInputs {
  tenant_code: string
  role_code: string
  tenant_config: Record<string, unknown>
  [key: string]: unknown
}

/** 默认 Dify 端点 */
export const DEFAULT_DIFY_BASE_URL = 'https://dify.86lw.cc/v1'

// ============================================================
// 租户套餐
// ============================================================

/** 智能体月度 Token 配额（对齐 AGENTS.md：按智能体配置额度，逐月重置） */
export interface AgentTokenQuota {
  agentCode: AgentCode
  monthlyTokens: number
  usedTokens: number
}

/** 租户套餐 */
export interface TenantPackage {
  id: string
  name: string
  quotas: AgentTokenQuota[]
  startDate: string
  endDate: string
}
