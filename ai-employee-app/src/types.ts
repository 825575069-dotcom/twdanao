import type { LucideIcon } from 'lucide-react'
import type { AgentCode } from './lib/constants'

// ============================================================
// 数据底座连接器（客户可对接的 ERP / B2B / B2C / 三方平台）
// ============================================================

/** 连接器类型 */
export type ConnectorType = 'erp' | 'b2b' | 'b2c' | 'third-party'

/** 数据底座连接器 */
export interface DataBaseConnector {
  id: string
  name: string
  type: ConnectorType
  desc: string
  /** 图标名称（用于 localStorage 序列化，运行时通过 ICON_REGISTRY 解析为 LucideIcon） */
  iconName: string
  /** 运行时图标组件（由 iconName 解析得到，不参与序列化） */
  icon: LucideIcon
  enabled: boolean
  /** 对接状态 */
  status: 'connected' | 'pending' | 'disconnected'
  lastSync: string
}

/** 智能体运行状态 */
export type AgentStatus = 'idle' | 'working' | 'done'

/** 智能体工作流步骤（可编辑） */
export interface AgentWorkflowStep {
  id: string
  name: string
  /** 该步骤交给模型的 Prompt / 工作流说明 */
  prompt: string
  /** 重试次数（0=不重试） */
  retryCount?: number
  /** 超时时间（毫秒） */
  timeout?: number
  /** 绑定的模型 ID */
  modelId?: string
  /** 触发条件（自然语言描述） */
  triggerCondition?: string
}

// ============================================================
// 工作流编排（需求文档第 7 章 / 第 8.1 章）
// ============================================================

/** 工作流模板 */
export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  /** 平台预置 / 自定义 */
  category: 'preset' | 'custom'
  /** 适用场景标签 */
  tags: string[]
  /** 编排步骤 */
  steps: WorkflowTemplateStep[]
  /** 步骤之间的依赖边（定义串行/并行） */
  edges: WorkflowEdge[]
  createdAt: string
}

/** 工作流模板步骤 */
export interface WorkflowTemplateStep {
  id: string
  /** 绑定的智能体 ID */
  agentId: string
  name: string
  prompt: string
  retryCount: number
  timeout: number
  modelId: string
  triggerCondition: string
}

/** 工作流边（串行 → / 并行 || ） */
export interface WorkflowEdge {
  from: string
  to: string
  /** sequential=串行（前一步完成后才执行）parallel=并行（与前一步同时启动） */
  type: 'sequential' | 'parallel'
}

/** 工作流节点执行状态 */
export type WorkflowNodeStatus = 'idle' | 'running' | 'waiting' | 'done' | 'failed'

/** 工作流编排执行记录 */
export interface WorkflowOrchRun {
  id: string
  templateId: string
  templateName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  nodes: WorkflowNodeRun[]
  taskText: string
  startedAt: string
  completedAt?: string
  totalCredits: number
}

/** 工作流节点执行快照 */
export interface WorkflowNodeRun {
  stepId: string
  agentId: string
  agentName: string
  agentEmoji: string
  status: WorkflowNodeStatus
  progress: number
  /** 实时日志 */
  logs: ExecLog[]
  startedAt?: string
  completedAt?: string
  /** 依赖的 stepId 列表 */
  dependencies: string[]
  retryUsed: number
  retryMax: number
}

/** 智能体实体（中控A + 五大业务智能体共用） */
export interface Agent {
  id: string
  /** 五大智能体工作流码（对齐 AGENTS.md：procurement/operations/marketing/distribution/academic） */
  code?: AgentCode
  name: string
  /** 角色 / 一句话定位 */
  role: string
  /** lucide 图标组件 */
  icon: LucideIcon
  /** tailwind 文本色类，如 'text-emerald-300' */
  color: string
  /** 十六进制主题色，用于光晕 / 进度条 */
  accent: string
  /** 拟人化形象（emoji） */
  emoji: string
  /** 围巾颜色（用于选择对应兔子形象） */
  scarfColor?: 'red' | 'green' | 'yellow' | 'blue' | 'orange' | 'purple'
  /** 自定义头像 URL（优先级高于 scarfColor） */
  avatar?: string
  description: string
  /** 能力标签（用于 AI 能力配置页展示） */
  capabilities: string[]
  /** 是否启用（权限开关） */
  enabled: boolean
  status: AgentStatus
  /** 任务进度 0-100 */
  progress: number
  /** 本次/累计算力积分消耗 */
  credits: number
  /** 当前任务实时日志（最新在前） */
  log: string[]
  /** 已绑定的数据底座 ID 列表 */
  boundDataBases: string[]
  /** 已绑定的知识文档 ID 列表 */
  boundDocs: string[]
  /** 已绑定的图片素材 ID 列表 */
  boundImages: string[]
  /** 可编辑的工作流步骤 */
  workflow: AgentWorkflowStep[]
}

/** 图片/宣传素材 */
export interface MediaAsset {
  id: string
  name: string
  /** 预览 URL（mock 阶段可为空） */
  url?: string
  type: 'image'
  size: string
  time: string
}

// ============================================================
// 多租户（对齐 AGENTS.md：X-Tenant-ID + 租户隔离）
// ============================================================

/** 租户信息 */
export interface TenantInfo {
  id: string
  code: string
  name: string
  status: 'active' | 'inactive' | 'suspended'
  platformName?: string
}

/** 租户成员关系（对齐 AGENTS.md：TenantMembership） */
export interface TenantMembership {
  userId: string
  tenantId: string
  roleCode: string
  roleName: string
}

/** 角色-智能体绑定（对齐 AGENTS.md：AgentBinding） */
export interface AgentBinding {
  roleCode: string
  agentCode: AgentCode
  visible: boolean
}

/** 租户内角色（权限模板） */
export interface Role {
  id: string
  name: string
  desc: string
  /** 可访问的智能体 id 列表 */
  agents: string[]
  /** 可访问的视图 key 列表 */
  views: string[]
  /** 是否允许管理成员 */
  canManageMembers: boolean
  /** 是否允许分配积分 */
  canAssignCredits: boolean
}

/** 租户成员 */
export interface TenantMember {
  id: string
  name: string
  /** 头像（可选，默认取首字） */
  avatar?: string
  roleId: string
  roleName: string
  /** 企业分配的积分余额 */
  credits: number
  /** 在线状态 */
  status: 'online' | 'offline'
  /** 账号是否启用 */
  enabled: boolean
}

// ============================================================
// API 标准响应（对齐 AGENTS.md：{ code, msg, data }）
// ============================================================

/** 统一 API 响应结构 */
export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

// ============================================================
// 提示词（首页提示词 / 普通提示词）
// ============================================================

export interface PromptItem {
  id: number
  prompt_type: 'home' | 'chat'
  category: string
  title: string
  icon: string
  content: string
  enabled: boolean
  sort: number
}

/** 分页响应 */
export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ============================================================
// Dify 集成（对齐 AGENTS.md：5 个平台级工作流）
// ============================================================

/** Dify 工作流执行结果 */
export interface DifyWorkflowResult {
  workflowCode: AgentCode
  taskId: string
  status: ProcurementTaskStatus
  outputs: Record<string, unknown>
  totalTokens: number
  elapsedMs: number
}

/** 采购任务（对齐 AGENTS.md 任务状态集） */
export type ProcurementTaskStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'partial_succeeded'

// ============================================================
// 双层分层持久记忆引擎（需求文档第 9 章）
// ============================================================

/** 记忆存储周期 */
export type RetentionMonths = 6 | 12 | 24

/** 记忆参数配置（租户管理员可调整） */
export interface MemoryConfig {
  /** 记忆自动保存周期 */
  retentionMonths: RetentionMonths
  /** 单账号长期记忆总 Token 容量上限 */
  tokenCap: number
}

/** 单轮对话记忆摘要（本地轻量化组件，仅自治模式使用） */
export interface MemorySummary {
  id: string
  /** 对话日期 */
  date: string
  /** 关键词 */
  keywords: string[]
  /** 简短摘要 */
  summary: string
  /** 该轮对话的消息数 */
  messageCount: number
  /** 估算 Token 占用 */
  estimatedTokens: number
  /** 创建时间 */
  createdAt: string
}

/** 执行流水日志级别 */
export type LogLevel = 'control' | 'agent' | 'saas' | 'credit' | 'memory'

export interface ExecLog {
  id: string
  /** 来源智能体 id，中控为 'control' */
  agent: string
  level: LogLevel
  text: string
  time: string
}

// ============================================================
// 记忆引擎（第二层天网大脑 — 后端双层记忆）
// ============================================================

/** 记忆召回上下文（后端返回） */
export interface MemoryContext {
  short_term: ShortTermMessage[]
  summaries: RecalledSummary[]
  facts: RecalledFact[]
  total_tokens: number
  strategy: string
}

/** 短期记忆消息 */
export interface ShortTermMessage {
  role: string
  content: string
  agent_code: string
  agent_name: string
  time: string
}

/** 召回的摘要 */
export interface RecalledSummary {
  id: string
  date: string
  title: string
  content: string
  keywords: string[]
  key_facts: unknown[]
  agent_codes: string[]
  message_count: number
}

/** 召回的关键事实 */
export interface RecalledFact {
  id: string
  category: string
  key: string
  value: string
  confidence: number
  times_recalled: number
}

/** 记忆统计 */
export interface MemoryStats {
  enabled: boolean
  total_summaries: number
  active_summaries: number
  archived_summaries: number
  total_facts: number
  total_recalls: number
  recent_recalls_7d: number
  facts_by_category: Record<string, number>
  config: {
    short_term_window: number
    summary_threshold: number
    retention_days: number
    max_summaries: number
    auto_summary: boolean
  }
}

// ============================================================
// 文件上传 / 附件
// ============================================================

/** 对话附件 */
export interface FileAttachment {
  id: string
  name: string
  type: string
  size: number
  /** 上传状态 */
  status: 'uploading' | 'done' | 'error'
  /** 上传进度 0-100 */
  progress: number
  /** 文件预览 URL（图片类型） */
  previewUrl?: string
}

// ============================================================
// 模型网关增强（密钥池 / Token统计 / 路由策略 / 熔断器）
// ============================================================

/** 模型密钥 */
export interface ModelKey {
  id: string
  model: string
  model_name: string
  key_alias: string
  api_key_masked: string
  endpoint: string
  status: 'active' | 'disabled' | 'exhausted' | 'error'
  priority: number
  daily_quota: number
  daily_used: number
  total_used: number
  last_used: string | null
  last_error: string
  error_count: number
  created_at: string
}

/** Token 用量记录 */
export interface TokenUsageRecord {
  id: string
  model_name: string
  user_name: string
  agent_code: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost: number
  latency_ms: number
  status: 'success' | 'failed' | 'timeout' | 'circuit_open'
  created_at: string
}

/** Token 用量统计 */
export interface TokenUsageStats {
  total: {
    calls: number
    tokens: number
    cost: number
    success_rate: number
  }
  by_model: Array<{ model__name: string; total_tokens: number; total_calls: number; total_cost: number }>
  by_agent: Array<{ agent_code: string; total_tokens: number; total_calls: number }>
  by_status: Record<string, number>
  daily_trend: Array<{ date: string; tokens: number; calls: number; cost: number }>
  recent: TokenUsageRecord[]
}

/** 路由策略 */
export interface RoutingStrategy {
  id: string
  name: string
  agent_code: string
  primary_model: string | null
  fallback_model: string | null
  primary_model_name: string
  fallback_model_name: string
  strategy_type: 'priority' | 'round_robin' | 'least_cost' | 'lowest_latency' | 'weighted'
  weight_config: Record<string, unknown>
  enabled: boolean
  created_at: string
}

/** 熔断器状态 */
export interface CircuitBreakerStatus {
  model_id: string
  model_name: string
  state: 'closed' | 'open' | 'half_open'
  failure_count: number
  failure_threshold: number
  recovery_timeout: number
  last_failure: string | null
  last_error: string
}

// ============================================================
// 安全审计
// ============================================================

/** 审计日志 */
export interface AuditLog {
  id: string
  user_name: string
  action: string
  resource_type: string
  resource_id: string
  description: string
  method: string
  path: string
  ip_address: string
  response_status: number
  duration_ms: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
}

/** 审计日志统计 */
export interface AuditLogStats {
  total: number
  today: number
  this_week: number
  high_risk: number
  by_action: Record<string, number>
  by_risk: Record<string, number>
  daily_trend: Array<{ date: string; count: number }>
}

/** 安全配置 */
export interface SecurityConfig {
  audit_enabled: boolean
  data_isolation: boolean
  mask_phone: boolean
  mask_id_card: boolean
  mask_bank_card: boolean
  mask_email: boolean
  mask_name: boolean
  request_sign_enabled: boolean
  sign_secret: string
  rate_limit_enabled: boolean
  rate_limit_per_minute: number
  sensitive_keywords: string[]
}

/** 安全概览 */
export interface SecurityOverview {
  config: SecurityConfig
  stats: {
    total_audit_logs: number
    high_risk_logs: number
    unresolved_events: number
    active_rules: number
    recent_logs_24h: number
  }
  events_by_severity: Record<string, number>
}

/** 访问控制规则 */
export interface AccessControlRule {
  id: string
  name: string
  rule_type: 'ip_whitelist' | 'ip_blacklist' | 'time_restriction' | 'api_restriction' | 'data_restriction'
  pattern: string
  action: 'allow' | 'deny' | 'warn'
  enabled: boolean
  description: string
  created_at: string
}

/** 安全事件 */
export interface SecurityEvent {
  id: string
  event_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  user_name: string
  ip_address: string
  resolved: boolean
  resolved_by_name: string
  resolved_at: string | null
  resolve_note: string
  created_at: string
}
