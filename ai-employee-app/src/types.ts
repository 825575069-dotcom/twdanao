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
  /** 围巾颜色（用于选择对应兔子形象）— 12 色体系 */
  scarfColor?: 'brown' | 'purple' | 'magenta' | 'darkgreen' | 'darkblue' | 'springgreen' | 'bluegray' | 'orangered' | 'pink' | 'red' | 'yellow' | 'royalblue'
  /** 自定义头像 URL（优先级高于 scarfColor） */
  avatar?: string
  description: string
  /** 能力标签（用于 AI 能力配置页展示） */
  capabilities: string[]
  /** 运行统计（用于 AI 办公室工位卡片角标） */
  stats?: {
    /** 任务/工作流数量 */
    tasks: number
    /** 能力数量 */
    capabilities: number
    /** 营销素材数量 */
    materials: number
    /** 产出/文档数量 */
    outputs: number
  }
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
  /** 角色编码（租户内唯一，创建时自动生成） */
  code: string
  name: string
  desc: string
  /** 可访问的智能体 code 列表 */
  agents: string[]
  /** 可访问的视图 key 列表 */
  views: string[]
  /** 后端权限码列表（由 views/agents 自动映射，编辑时无需直接修改） */
  permissions: string[]
  /** 是否允许管理成员 */
  canManageMembers: boolean
  /** 是否允许分配积分 */
  canAssignCredits: boolean
}

/** 积分分配类型 */
export type CreditAllocationType = 'unlimited' | 'monthly' | 'daily' | 'fixed'

/** 积分分配标签映射 */
export const CREDIT_ALLOCATION_LABELS: Record<CreditAllocationType, string> = {
  unlimited: '无限',
  monthly: '月用量',
  daily: '日用量',
  fixed: '固定量',
}

/** 积分分配类型选项（供 UI 选择器使用） */
export const CREDIT_ALLOCATION_OPTIONS: { value: CreditAllocationType; label: string; desc: string }[] = [
  { value: 'unlimited', label: '无限', desc: '不限制积分使用量' },
  { value: 'monthly', label: '月用量', desc: '每月重置的积分额度' },
  { value: 'daily', label: '日用量', desc: '每日重置的积分额度' },
  { value: 'fixed', label: '固定量', desc: '一次性分配的固定积分' },
]

/** 租户成员 */
export interface TenantMember {
  id: string
  name: string
  /** 账号名 */
  username?: string
  /** 头像（可选，默认取首字） */
  avatar?: string
  roleId: string
  roleName: string
  /** 企业分配的积分余额 */
  credits: number
  /** 积分分配类型 */
  creditAllocationType: CreditAllocationType
  /** 积分分配值（unlimited 时忽略） */
  creditAllocationValue?: number
  /** 在线状态 */
  status: 'online' | 'offline'
  /** 账号是否启用 */
  enabled: boolean
  /** 手机号 */
  phone?: string
  /** 密码（仅创建/编辑时临时使用，不回显） */
  password?: string
  /** 加入时间 */
  createdAt?: string
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
// 提示词（首页提示词 / 普通提示词 / 采购对话提示词 / 采购兔首页提示词）
// ============================================================

export interface PromptItem {
  id: number
  prompt_type: 'home' | 'chat' | 'purchase_chat' | 'purchase_home'
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

// ============================================================
// 营销跟客 — 企微数据层（wecom app）
// ============================================================

/** 企微设备（企微账号绑定） */
export interface WecomDevice {
  id: number
  tenant: string
  tenant_name: string
  guid: string
  name: string
  qw_user_id: string
  qw_account: string
  status: 'online' | 'offline' | 'banned'
  ai_enabled: boolean
  callback_url: string
  last_heartbeat: string | null
  qiwe_token: string
  avatar: string
  province_code: string
  created_at: string
  updated_at: string
}

/** 省份地区代码 */
export interface AreaCode {
  code: string
  name: string
}

/** 企微外部联系人 */
export interface WecomContact {
  id: number
  tenant: string
  device: number
  device_name: string
  external_userid: string
  name: string
  remark: string
  avatar: string
  enterprise_id: string
  contact_source?: 'wechat' | 'wecom' | 'group_chat' | 'unknown'
  qiwe_contact_type?: number
  qiwe_add_time?: number
  gender?: number
  mobile?: string
  ai_hosted: boolean
  is_pinned?: boolean
  pinned_at?: string | null
  last_contacted_at: string | null
  tags: number[]
  tags_display: Array<{ id: number; name: string; color: string }>
  created_at: string
  updated_at: string
  last_message?: string
  last_message_time?: string | null
  last_message_type?: string
}

/** 企微消息 */
export interface WecomMessage {
  id: number
  tenant: string
  device: number
  device_name: string
  contact: number | null
  contact_name: string
  contact_avatar: string
  room: number | null
  room_name: string | null
  conversation_type: 'personal' | 'group'
  conversation_type_display: string
  sender_name: string | null
  direction: 'inbound' | 'outbound'
  direction_display: string
  msg_type: 'text' | 'image' | 'file' | 'link' | 'video' | 'voice' | 'miniprogram'
  msg_type_display: string
  content: string
  media_file: number | null
  media_file_url: string | null
  raw_data: Record<string, unknown>
  ai_generated: boolean
  is_recalled: boolean
  /** 乐观更新：前端生成的 UUID，用于匹配 sending→sent 状态变更 */
  client_msg_id?: string | null
  /** 消息状态：sending=发送中 / sent=已发送 / delivered=已送达 / read=已读 / failed=发送失败 */
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  quoted_message: number | null
  quoted_message_content: string | null
  quoted_message_contact_name: string | null
  quoted_message_direction: 'inbound' | 'outbound' | null
  quoted_message_created_at: string | null
  created_at: string
}

/** 企微聊天草稿（后端持久化） */
export interface WecomDraft {
  id: number
  tenant: string
  device: number
  conversation_type: 'personal' | 'group'
  conversation_type_display: string
  conversation_id: number
  content: string
  media_url: string
  media_type: string
  updated_at: string
  created_at: string
}

/** 企微标签分组 */
export interface WecomTagGroup {
  id: number
  tenant: string
  device: number
  device_name: string
  group_id: string
  name: string
  order: number
  is_customer_level: boolean
  tag_count: number
  created_at: string
}

/** 企微标签 */
export interface WecomTag {
  id: number
  tenant: string
  device: number | null
  device_name: string
  tag_id: string
  name: string
  color: string
  group: number | null
  group_name: string
  order: number
  is_customer_level: boolean
  contact_count: number
  group_room_count: number
  created_at: string
}

/** 企微群聊 */
export interface WecomGroupRoom {
  id: number
  tenant: string
  device: number
  device_name: string
  group_id: string
  name: string
  owner_id: string
  member_count: number
  member_user_ids?: string[]
  tags: number[]
  tags_display: Array<{ id: number; name: string; color: string }>
  created_at: string
  last_message?: string
  last_message_time?: string | null
  last_message_type?: string
}

/** 统一会话项（单聊或群聊，参考微信合并排序） */
export interface UnifiedSession {
  /** 唯一 id：`contact-${id}` 或 `group-${id}` */
  session_key: string
  /** 类型：单聊/群聊 */
  kind: 'contact' | 'group'
  /** 数据库 id（单聊为 contact.id，群聊为 group.id） */
  id: number
  /** 名称 */
  name: string
  /** 备注名（仅单聊） */
  remark?: string
  /** 头像 URL（仅单聊有，群聊用多人头像拼图） */
  avatar?: string
  /** 来源类型（仅单聊） */
  contact_source?: 'wechat' | 'wecom' | 'group_chat' | 'unknown'
  /** 群聊：成员数 */
  member_count?: number
  /** 群聊：成员 userId 列表 */
  member_user_ids?: string[]
  /** 最后消息预览 */
  last_message: string
  /** 最后消息类型 */
  last_message_type: string
  /** 最后消息时间 */
  last_message_time: string | null
  /** 最后联系时间 */
  last_contacted_at?: string | null
  /** 是否置顶（仅单聊有，群聊暂不置顶） */
  is_pinned: boolean
  /** 置顶时间 */
  pinned_at?: string | null
  /** AI 托管（仅单聊有） */
  ai_hosted: boolean
  /** 标签列表（单聊/群聊通用） */
  tags: number[]
  tags_display: Array<{ id: number; name: string; color: string }>
  /** 单聊引用 */
  contact_ref?: WecomContact
  /** 群聊引用 */
  group_ref?: WecomGroupRoom
}

// ============================================================
// 营销跟客 — 业务层（marketing_follow app）
// ============================================================

/** 聊天设置（每个企微账号一套） */
export interface ChatSetting {
  id: number
  tenant: string
  device: number
  device_name: string
  agent_id: string
  agent_name: string
  ai_enabled: boolean
  reply_style: 'professional' | 'friendly' | 'lively' | 'calm'
  reply_length: 'short' | 'medium' | 'detailed'
  customer_address: 'remark' | 'nickname' | 'surname_prefix'
  ai_signature: boolean
  quick_replies: string[]
  forbidden_words: string[]
  work_hours_start: string | null
  work_hours_end: string | null
  // 单聊设置
  memory_rounds: number
  reply_delay_min: number
  reply_delay_max: number
  non_text_reply_strategy: 'ignore' | 'reply_text' | 'reply_template'
  non_text_reply_content: string
  stop_reply_keywords: string[]
  // 群聊设置
  group_reply_mode: 'at_only' | 'at_and_whitelist' | 'all'
  group_no_at_whitelist: string[]
  group_fixed_reply_enabled: boolean
  group_fixed_reply_start: string | null
  group_fixed_reply_end: string | null
  group_fixed_reply_rooms: string[]
  created_at: string
  updated_at: string
}

/** AI回复任务 */
export interface AiReplyTask {
  id: number
  tenant: string
  device: number
  device_name: string
  contact: number
  contact_name: string
  contact_avatar: string
  inbound_message: number | null
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped'
  status_display: string
  ai_content: string
  ai_segments: string[]
  prompt_snapshot: string
  llm_tokens: number
  credit_cost: number
  error: string
  created_at: string
  sent_at: string | null
}

/** 主动跟进任务 */
export interface ProactiveFollowTask {
  id: number
  tenant: string
  device: number
  device_name: string
  contact: number
  contact_name: string
  trigger_type: 'event' | 'schedule' | 'manual'
  trigger_type_display: string
  trigger_event: Record<string, unknown>
  agent_id: string
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  status_display: string
  ai_content: string
  error: string
  created_at: string
  sent_at: string | null
}

/** 群发任务 */
export interface BroadcastTask {
  id: number
  tenant: string
  device: number
  device_name: string
  name: string
  material_type: 'text' | 'link' | 'miniprogram'
  material_type_display: string
  material_content: Record<string, unknown>
  filter_tags: string[]
  filter_conditions: Record<string, unknown>
  total_count: number
  sent_count: number
  failed_count: number
  status: 'draft' | 'pending' | 'sending' | 'completed' | 'paused'
  status_display: string
  scheduled_at: string | null
  created_at: string
}

/** 朋友圈内容（一条任务可含多条内容，支持图片/视频/链接） */
export interface MomentsContent {
  id: number
  task: number
  order: number
  text: string
  random_emoji: boolean
  media_type: 'image' | 'video' | 'link'
  media_type_display: string
  media_urls: string[]
  link_title: string
  link_desc: string
  link_url: string
  link_pic_url: string
  ai_polish_enabled: boolean
  tone_template: string
  prompt_template: string
  created_at: string
}

/** 朋友圈发送对象 */
export interface MomentsTarget {
  id: number
  task: number
  device_ids: number[]
  estimated_count: number
  created_at: string
}

/** 朋友圈执行时间 */
export interface MomentsSchedule {
  id: number
  task: number
  scheduled_at: string | null
  daily_start_time: string | null
  daily_end_time: string | null
  daily_interval: number
  created_at: string
}

/** 朋友圈任务 */
export interface MomentsTask {
  id: number
  tenant: string
  device: number
  device_name: string
  name: string
  status: 'draft' | 'enabled' | 'disabled' | 'approved' | 'rejected'
  status_display: string
  created_by: string
  started_by: string
  is_enabled: boolean
  daily_loop: boolean
  wechat_total: number
  success_sent: number
  pending: number
  failed: number
  network_error: number
  contents: MomentsContent[]
  target: MomentsTarget | null
  schedule: MomentsSchedule | null
  created_at: string
  updated_at: string
}

/** 朋友圈任务列表响应 */
export interface MomentsTaskListResponse {
  list: MomentsTask[]
  total: number
  page: number
  page_size: number
}

/** 朋友圈任务创建/更新请求体 */
export interface MomentsTaskPayload {
  device: number
  name: string
  daily_loop?: boolean
  contents: Array<{
    order: number
    text: string
    random_emoji?: boolean
    media_type?: MomentsContent['media_type']
    media_urls?: string[]
    link_title?: string
    link_desc?: string
    link_url?: string
    link_pic_url?: string
    ai_polish_enabled?: boolean
    tone_template?: string
    prompt_template?: string
  }>
  target: {
    device_ids?: number[]
  }
  schedule: {
    scheduled_at?: string | null
    daily_start_time?: string | null
    daily_end_time?: string | null
    daily_interval?: number
  }
}

/** 客户画像 */
export interface CustomerProfile {
  id: number
  tenant: string
  contact: number
  contact_name: string
  enterprise_id: string
  customer_level: 'VIP' | 'A' | 'B' | 'C'
  total_orders: number
  total_amount: string
  last_order_at: string | null
  browse_products: unknown[]
  tags: string[]
  updated_at: string
}

/** 趋势数据点 */
export interface DashboardTrendPoint {
  date: string
  value: number
}

/** 营销跟客数据看板 — 4 区块结构 */
export interface MarketingDashboard {
  range: string
  start_date: string
  end_date: string
  updated_at: string
  exposure: {
    total_exposure: number
    ai_greeting: number
    ai_nurturing: number
    ai_mass_send: number
    ai_moments: number
    ai_tracking: number
    trend: DashboardTrendPoint[]
  }
  reply: {
    total_reply: number
    nurturing_reply: number
    mass_send_reply: number
    tracking_reply: number
    trend: DashboardTrendPoint[]
  }
  customer: {
    total_contacts: number
    high_intent: number
    medium_intent: number
    total_groups: number
    new_groups: number
    new_contacts: number
    trend: DashboardTrendPoint[]
  }
  message: {
    total_messages: number
    sent_messages: number
    received_messages: number
    trend: DashboardTrendPoint[]
  }
}

/** 自动贴标签规则 */
export interface AutoTagRule {
  id: number
  tenant: string
  device: number
  device_name: string
  name: string
  keywords: string[]
  match_mode: 'any' | 'all'
  match_mode_display: string
  scope: 'contact' | 'group'
  scope_display: string
  target_tag: number
  target_tag_name: string
  target_tag_color: string
  is_enabled: boolean
  hit_count: number
  last_run_at: string | null
  created_at: string
}

// ============================================================
// 精准群发（mass_send 模型组）
// ============================================================

/** 精准群发素材（一条任务可含多条不同类型素材） */
export interface MassSendMaterial {
  id: number
  task: number
  order: number
  msg_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'link' | 'miniprogram' | 'channel'
  msg_type_display: string
  content: {
    text?: string
    insert_greeting?: boolean
    fallback_text?: string
    media_url?: string
    media_name?: string
    title?: string
    desc?: string
    url?: string
    cover_url?: string
    app_id?: string
    page_path?: string
    username?: string
    [key: string]: unknown
  }
  created_at: string
}

/** 精准群发发送对象 */
export interface MassSendTarget {
  id: number
  task: number
  target_type: 'contact' | 'group' | 'all'
  target_type_display: string
  tag_ids: number[]
  contact_ids: number[]
  group_ids: number[]
  filter_conditions: Record<string, unknown>
  estimated_count: number
  created_at: string
}

/** 精准群发执行时间 */
export interface MassSendSchedule {
  id: number
  task: number
  scheduled_at: string | null
  daily_start_time: string | null
  daily_end_time: string | null
  daily_interval: number
  created_at: string
}

/** 精准群发任务 */
export interface MassSendTask {
  id: number
  tenant: string
  device: number
  device_name: string
  name: string
  status: 'draft' | 'enabled' | 'disabled' | 'approved' | 'rejected'
  status_display: string
  created_by: string
  started_by: string
  is_enabled: boolean
  daily_loop: boolean
  planned_total: number
  planned_success: number
  planned_pending: number
  planned_failed: number
  planned_network_error: number
  disabled_count: number
  reply_rate: number
  materials: MassSendMaterial[]
  target: MassSendTarget | null
  schedule: MassSendSchedule | null
  created_at: string
  updated_at: string
}

/** 精准群发任务列表响应 */
export interface MassSendTaskListResponse {
  list: MassSendTask[]
  total: number
  page: number
  page_size: number
}

/** 精准群发任务创建/更新请求体 */
export interface MassSendTaskPayload {
  device: number
  name: string
  daily_loop?: boolean
  materials: Array<{
    order: number
    msg_type: MassSendMaterial['msg_type']
    content: MassSendMaterial['content']
  }>
  target: {
    target_type: MassSendTarget['target_type']
    tag_ids?: number[]
    contact_ids?: number[]
    group_ids?: number[]
    filter_conditions?: Record<string, unknown>
  }
  schedule: {
    scheduled_at?: string | null
    daily_start_time?: string | null
    daily_end_time?: string | null
    daily_interval?: number
  }
}
