// ============================================================
// 后端集成层 —— 前端与第二层 Django 天网大脑的对接桥梁
// ============================================================
// 职责：
//   1. 自动登录（获取 JWT Token）
//   2. 启动时同步租户/模型/配置数据
//   3. 对话消息走后端 /chat/send（意图识别 + 智能体派发 + LLM）
//   4. 数据看板走后端 /data/* 和 /dashboard/*
//
// 降级策略：后端不可达时，自动回退到本地 mock 数据，确保前端不白屏。
// ============================================================

import { getApiClient, updateApiConfig } from './api'
import type { ApiResponse, PromptItem } from '../types'

// —— 连接状态 ——
export type BackendStatus = 'idle' | 'connecting' | 'connected' | 'error'

let _status: BackendStatus = 'idle'
const _listeners: Array<(s: BackendStatus) => void> = []

export function getBackendStatus(): BackendStatus {
  return _status
}

function setStatus(s: BackendStatus) {
  _status = s
  for (const fn of _listeners) fn(s)
}

export function onBackendStatusChange(fn: (s: BackendStatus) => void): () => void {
  _listeners.push(fn)
  return () => {
    const idx = _listeners.indexOf(fn)
    if (idx >= 0) _listeners.splice(idx, 1)
  }
}

// —— 数据提取辅助 ——
// 后端列表接口有两种返回格式：
//   1. 直接数组: { code: 0, data: [item1, item2, ...] }
//   2. 包装格式: { code: 0, data: { items: [...], total: N } }
// 此函数统一提取为数组
function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && 'items' in data) {
    return (data as Record<string, unknown>).items as unknown[]
  }
  return []
}

// —— 数据映射辅助 ——
// 后端使用 snake_case，前端使用 camelCase / 不同字段名
// 这些函数将后端数据转换为前端类型格式

/** 通用 snake_case → camelCase 转换 */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/** 递归转换对象的所有 key 为 camelCase */
function camelize(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(camelize)
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeToCamel(k)] = camelize(v)
    }
    return result
  }
  return obj
}

/** 映射模型数据：后端 context_k → 前端 contextK, description → desc */
function mapModel(item: unknown): unknown {
  const m = item as Record<string, unknown>
  return {
    ...m,
    id: String(m.id ?? ''),
    name: m.name ?? m.vendor ?? '',
    vendor: m.vendor ?? m.provider ?? '',
    type: m.type ?? m.model_type ?? 'commercial',
    contextK: m.contextK ?? m.context_k ?? 0,
    status: m.status ?? 'offline',
    desc: m.desc ?? m.description ?? '',
  }
}

/** 映射成员数据：确保 name/roleId/roleName/creditAllocationType 字段存在 */
function mapMember(item: unknown): unknown {
  const m = item as Record<string, unknown>
  return {
    ...m,
    id: String(m.id ?? ''),
    name: m.name ?? m.username ?? '',
    username: m.username ?? '',
    roleId: m.roleId ?? m.role_code ?? m.role ?? '',
    roleName: m.roleName ?? m.role_name ?? '',
    creditAllocationType: m.creditAllocationType ?? m.credit_allocation_type ?? 'fixed',
    creditAllocationValue: m.creditAllocationValue ?? m.credit_allocation_value,
    credits: m.credits ?? 0,
    phone: m.phone ?? '',
    enabled: m.enabled ?? true,
    status: m.status ?? 'offline',
    createdAt: m.createdAt ?? m.created_at ?? '',
  }
}

/** 映射角色数据：确保 desc/canManageMembers/canAssignCredits 等字段存在 */
function mapRole(item: unknown): unknown {
  const r = item as Record<string, unknown>
  return {
    ...r,
    id: String(r.id ?? ''),
    code: String(r.code ?? r.id ?? ''),
    desc: r.desc ?? r.description ?? '',
    agents: Array.isArray(r.agents) ? (r.agents as string[]) : [],
    views: Array.isArray(r.views) ? (r.views as string[]) : [],
    permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    canManageMembers: r.canManageMembers ?? r.can_manage_members ?? false,
    canAssignCredits: r.canAssignCredits ?? r.can_assign_credits ?? false,
  }
}

/** 映射知识库文档：后端 snake_case → 前端 camelCase */
function mapKnowledgeDoc(item: unknown): unknown {
  const d = camelize(item) as Record<string, unknown>
  return {
    id: String(d.id ?? ''),
    name: d.name ?? d.title ?? '',
    type: d.type ?? d.category ?? '',
    size: d.size ?? '',
    folder: d.folder ?? '',
    boundAgents: Array.isArray(d.boundAgents) ? d.boundAgents as string[] : [],
    time: d.time ?? d.createdAt ?? '',
    contentText: d.contentText ?? '',
  }
}

/** 映射素材资产 */
function mapMediaAsset(item: unknown): unknown {
  const a = camelize(item) as Record<string, unknown>
  return {
    ...a,
    id: String(a.id ?? ''),
    name: a.name ?? a.filename ?? '',
    type: a.type ?? a.mimeType ?? 'image',
    size: a.size ?? a.fileSize ?? '',
    time: a.time ?? a.createdAt ?? '',
  }
}

/** 映射积分账本 */
function mapCreditEntry(item: unknown): unknown {
  const e = camelize(item) as Record<string, unknown>
  return {
    ...e,
    id: String(e.id ?? ''),
    agentId: e.agentId ?? e.agentCode ?? e.agent ?? '',
    agentName: e.agentName ?? e.agent ?? '',
  }
}

// ============================================================
// 1. 登录（用户名+密码）
// ============================================================

export interface LoginResult {
  success: boolean
  error?: string
  tenantId?: string
  userId?: string
  /** 用户名 */
  userName?: string
  /** 手机号 */
  userPhone?: string
  permissions?: string[]
}

/**
 * 使用用户名和密码登录后端
 * 成功后存储 token 和租户 ID 到 localStorage
 */
export async function loginToBackend(username: string, password: string): Promise<LoginResult> {
  setStatus('connecting')
  const client = getApiClient()

  try {
    const resp = await client.auth.login(username, password)
    if (resp.code === 0 && resp.data.access_token) {
      const { access_token, refresh_token, user, tenant } = resp.data
      localStorage.setItem('yesgo_access_token', access_token)
      localStorage.setItem('yesgo_refresh_token', refresh_token)

      // 存储租户 ID
      const tenantId = (tenant as Record<string, unknown>)?.id
      if (tenantId) {
        localStorage.setItem('yesgo_tenant_id', String(tenantId))
      }

      updateApiConfig({
        accessToken: access_token,
        refreshToken: refresh_token,
        tenantId: tenantId ? String(tenantId) : '',
      })

      // 提取权限清单
      const permissions = (user as Record<string, unknown>)?.permissions as string[] | undefined
      const userName = (user as Record<string, unknown>)?.name as string | undefined
      const userPhone = (user as Record<string, unknown>)?.phone as string | undefined

      setStatus('connected')
      return {
        success: true,
        tenantId: tenantId ? String(tenantId) : undefined,
        userId: (user as Record<string, unknown>)?.id as string | undefined,
        userName,
        userPhone: userPhone || '',
        permissions: permissions ?? [],
      }
    }
    setStatus('error')
    return { success: false, error: resp.msg || '登录失败' }
  } catch {
    setStatus('error')
    return { success: false, error: '无法连接到服务器' }
  }
}

export interface AuthCheckResult {
  valid: boolean
  permissions: string[]
  userName?: string
  userPhone?: string
}

/**
 * 检查当前 token 是否有效，并返回用户权限清单
 */
export async function checkAuth(): Promise<AuthCheckResult> {
  const client = getApiClient()
  if (!client.config.accessToken) return { valid: false, permissions: [] }

  setStatus('connecting')
  try {
    const meResp = await client.auth.me()
    if (meResp.code === 0) {
      const data = meResp.data as unknown as Record<string, unknown>
      const user = data?.user as Record<string, unknown> | undefined
      const permissions = (user?.permissions as string[]) ?? []
      const userName = user?.name as string | undefined
      const userPhone = user?.phone as string | undefined
      setStatus('connected')
      return { valid: true, permissions, userName, userPhone: userPhone || '' }
    }
  } catch {
    // token 失效
  }
  setStatus('idle')
  return { valid: false, permissions: [] }
}

/**
 * 登出
 */
export function logoutBackend(): void {
  localStorage.removeItem('yesgo_access_token')
  localStorage.removeItem('yesgo_refresh_token')
  localStorage.removeItem('yesgo_tenant_id')
  updateApiConfig({ accessToken: '', refreshToken: '', tenantId: '' })
  setStatus('idle')
}

// ============================================================
// 2. 启动同步
// ============================================================

export interface SyncResult {
  tenant: unknown | null
  members: unknown[] | null
  package: unknown | null
  roles: unknown[] | null
  models: unknown[] | null
  config: unknown | null
  dify: unknown | null
  agents: unknown[] | null
  agentConfigs: unknown[] | null
}

/** 从后端同步全部初始化数据，任一接口失败不影响其他 */
export async function syncAllFromBackend(): Promise<SyncResult> {
  const client = getApiClient()
  const result: SyncResult = {
    tenant: null,
    members: null,
    package: null,
    roles: null,
    models: null,
    config: null,
    dify: null,
    agents: null,
    agentConfigs: null
  }

  const tasks: Array<{ key: keyof SyncResult; fn: () => Promise<ApiResponse<unknown>> }> = [
    {
      key: 'tenant',
      fn: () => client.tenant.info()
    },
    {
      key: 'members',
      fn: async () => {
        const r = await client.tenant.members()
        return { ...r, data: extractArray(r.data).map(mapMember) }
      }
    },
    {
      key: 'package',
      fn: () => client.tenant.package()
    },
    {
      key: 'roles',
      fn: async () => {
        const r = await client.tenant.roles()
        return { ...r, data: extractArray(r.data).map(mapRole) }
      }
    },
    {
      key: 'models',
      fn: async () => {
        const r = await client.models.list()
        return { ...r, data: extractArray(r.data).map(mapModel) }
      }
    },
    {
      key: 'config',
      fn: () => client.sysConfig.get()
    },
    {
      key: 'dify',
      fn: () => client.sysConfig.dify()
    },
    {
      key: 'agents',
      fn: async () => {
        const r = await client.agents.list()
        return { ...r, data: extractArray(r.data).map(camelize) }
      }
    },
    {
      key: 'agentConfigs',
      fn: async () => {
        const r = await client.agents.configs()
        return { ...r, data: extractArray(r.data).map(camelize) }
      }
    }
  ]

  await Promise.allSettled(
    tasks.map(async (t) => {
      try {
        const resp = await t.fn()
        if (resp.code === 0) {
          ;(result as unknown as Record<string, unknown>)[t.key] = resp.data
        }
      } catch {
        // 单个接口失败不影响其他
      }
    })
  )

  return result
}

// ============================================================
// 3. 对话消息走后端
// ============================================================

export interface ChatResponse {
  session_id: string
  reply: string
  agent: string
  agentCode: string
  intent: string
  confidence: number
  result: Record<string, unknown>
  tokens: number
}

/**
 * 发送对话消息到后端
 * 后端完成：意图识别 → 智能体派发 → LLM 调用 → 返回结果
 *
 * @returns ChatResponse 或 null（后端不可达时）
 */
export async function sendChatToBackend(
  message: string,
  sessionId?: string
): Promise<ChatResponse | null> {
  const client = getApiClient()
  try {
    const resp = await client.chat.send(message, sessionId)
    if (resp.code === 0 && resp.data) {
      return resp.data
    }
  } catch {
    // 后端不可达
  }
  return null
}

// ============================================================
// 3b. Ai药采购专用聊天（免扣积分）
// ============================================================

/** 公共数据库产品（对应后端 PublicProductSerializer） */
export interface PharmacyProduct {
  id: number
  name: string
  trade_name?: string
  specification?: string
  manufacturer?: string
  dosage_form?: string
  unit?: string
  price?: string
  min_order_quantity?: number
  category?: string
  approval_number?: string
  barcode?: string
  storage_condition?: string
  delivery_info?: string
  delivery_areas?: string
  supplier_name?: string
  supplier_id?: number
  status?: string
  stock_quantity?: number
  match_type?: string
  match_fields?: string[]
  score?: number
}

/** 快采方案中的单个供应商报价 */
export interface SolutionItem {
  product_id: number
  product_name: string
  product_spec: string
  product_manufacturer: string
  product_unit: string
  product_price: string
  supplier_id: number
  supplier_name: string
  delivery_hours: number
  min_order_amount: string
  stock_quantity: number
  total_price: string
  quantity: number
  settlement_method?: string
}

/** 快采方案 */
export interface PurchaseSolution {
  strategy: string
  strategy_label: string
  strategy_desc: string
  items: SolutionItem[]
  total_price: string
  avg_delivery_hours: number
  supplier_count: number
}

/** 快采三方案响应 */
export interface QuickPurchaseSolutions {
  fastest: PurchaseSolution | null
  cheapest: PurchaseSolution | null
  comprehensive: PurchaseSolution | null
  total_products_found: number
  query: string
}

/** 订单明细项 */
export interface OrderItem {
  id: number
  product_id: number
  product_name: string
  product_spec: string
  product_manufacturer: string
  product_unit: string
  quantity: number
  unit_price: string
  total_price: string
}

/** 支付记录 */
export interface PaymentRecord {
  id: number
  order: number
  payment_method: string
  amount: string
  status: string
  status_display?: string
  transaction_id?: string
  paid_at?: string | null
  created_at: string
}

/** 资质交换信息 */
export interface QualificationExchangeInfo {
  id: number
  order: number
  status: string
  status_display?: string
  buyer_qualifications?: unknown[]
  seller_qualifications?: unknown[]
  initiated_at?: string
  completed_at?: string | null
}

/** 供应商信息（订单详情中） */
export interface OrderSupplierInfo {
  id: number
  name: string
  contact_name: string
  contact_phone: string
}

/** 配送信息 */
export interface OrderDeliveryInfo {
  delivery_hours: number
  min_order_amount: string
  tenant_province: string
  tenant_city: string
}

/** 订单全状态响应 */
export interface OrderFullStatus {
  id: number
  order_number: string
  status: string
  status_display: string
  payment_status: string
  payment_status_display: string
  total_amount: string
  order_type: string
  created_at: string
  updated_at?: string
  tenant_id?: number
  supplier_id?: number
  items: OrderItem[]
  payments: PaymentRecord[]
  qualification_exchange: QualificationExchangeInfo | null
  qualification_status_display: string
  supplier_info: OrderSupplierInfo
  delivery_info: OrderDeliveryInfo
  next_actions: string[]
}

/** 订单列表项（简化） */
export interface OrderListItem {
  id: number
  order_number: string
  status: string
  status_display?: string
  payment_status: string
  payment_status_display?: string
  total_amount: string
  order_type: string
  created_at: string
  supplier_name?: string
  supplier_id?: number
  tenant_id?: number
}

/** Ai药采购聊天响应 */
export interface PharmacyChatResponse {
  session_id: string
  reply: string
  agent: string
  agentCode: string
  intent: string
  confidence: number
  result: Record<string, unknown>
  tokens: number
  workflow: boolean
  credit: { deducted: number; tokens: number; coefficient: number; free: boolean; reason: string }
  mode: string
  products: PharmacyProduct[]
  solutions: QuickPurchaseSolutions | null
}

/**
 * 发送 Ai药采购消息到后端
 * 后端强制使用采购智能体，免扣积分，自动查询公共数据库产品
 *
 * @param message 用户输入的采购需求
 * @param sessionId 会话 ID（可选，首次对话不传）
 * @param mode 采购模式：quick=快采 / collective=集采 / search=找品
 * @returns PharmacyChatResponse 或 null（后端不可达时）
 */
export async function sendPharmacyChat(
  message: string,
  sessionId?: string,
  mode?: 'quick' | 'collective' | 'search'
): Promise<PharmacyChatResponse | null> {
  const client = getApiClient()
  try {
    const resp = await client.pharmacy.send(message, sessionId, mode)
    if (resp.code === 0 && resp.data) {
      return resp.data as PharmacyChatResponse
    }
  } catch {
    // 后端不可达
  }
  return null
}

// ============================================================
// 4. 数据看板走后端
// ============================================================

export async function fetchDashboardOverview(): Promise<Record<string, unknown> | null> {
  const client = getApiClient()
  try {
    const resp = await client.dashboard.overview()
    if (resp.code === 0) return resp.data as Record<string, unknown>
  } catch {
    // 降级
  }
  return null
}

export async function fetchProducts(): Promise<unknown[] | null> {
  const client = getApiClient()
  try {
    const resp = await client.data.products()
    if (resp.code === 0) {
      const d = resp.data as Record<string, unknown>
      return (d?.items ?? d ?? []) as unknown[]
    }
  } catch {
    // 降级
  }
  return null
}

export async function fetchInventory(): Promise<unknown | null> {
  const client = getApiClient()
  try {
    const resp = await client.data.inventory()
    if (resp.code === 0) return resp.data
  } catch {
    // 降级
  }
  return null
}

export async function fetchOrders(): Promise<unknown | null> {
  const client = getApiClient()
  try {
    const resp = await client.data.orders()
    if (resp.code === 0) return resp.data
  } catch {
    // 降级
  }
  return null
}

export async function fetchCustomers(): Promise<unknown | null> {
  const client = getApiClient()
  try {
    const resp = await client.data.customers()
    if (resp.code === 0) return resp.data
  } catch {
    // 降级
  }
  return null
}

export async function fetchDistribution(): Promise<unknown | null> {
  const client = getApiClient()
  try {
    const resp = await client.data.distribution()
    if (resp.code === 0) return resp.data
  } catch {
    // 降级
  }
  return null
}

// ============================================================
// 5. 健康检查
// ============================================================

export async function checkBackendHealth(): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.health()
    return resp.code === 0
  } catch {
    return false
  }
}

// ============================================================
// 6. 扩展数据同步（知识库 / 素材 / 任务 / 积分 / 技能 / SaaS / 连接器）
// ============================================================

export interface ExtendedSyncResult {
  knowledge: unknown[] | null
  media: unknown[] | null
  tasks: unknown[] | null
  creditBalance: number | null
  creditLedger: unknown[] | null
  skills: unknown[] | null
  saas: unknown[] | null
  connectors: unknown[] | null
  workflowTemplates: unknown[] | null
}

/** 从后端同步扩展数据（各视图 mount 时调用） */
export async function syncExtendedFromBackend(): Promise<ExtendedSyncResult> {
  const client = getApiClient()
  const result: ExtendedSyncResult = {
    knowledge: null,
    media: null,
    tasks: null,
    creditBalance: null,
    creditLedger: null,
    skills: null,
    saas: null,
    connectors: null,
    workflowTemplates: null
  }

  const tasks: Array<{ key: keyof ExtendedSyncResult; fn: () => Promise<ApiResponse<unknown>> }> = [
    {
      key: 'knowledge',
      fn: async () => {
        const r = await client.knowledge.list()
        return { ...r, data: extractArray(r.data).map(mapKnowledgeDoc) }
      }
    },
    {
      key: 'media',
      fn: async () => {
        const r = await client.media.list()
        return { ...r, data: extractArray(r.data).map(mapMediaAsset) }
      }
    },
    {
      key: 'tasks',
      fn: async () => {
        const r = await client.tasks.list()
        return { ...r, data: extractArray(r.data).map(camelize) }
      }
    },
    {
      key: 'creditBalance',
      fn: async () => {
        const r = await client.credits.balance()
        const d = r.data as Record<string, unknown>
        return { ...r, data: d?.balance ?? 0 }
      }
    },
    {
      key: 'creditLedger',
      fn: async () => {
        const r = await client.credits.ledger()
        return { ...r, data: extractArray(r.data).map(mapCreditEntry) }
      }
    },
    {
      key: 'skills',
      fn: async () => {
        const r = await client.skills.list()
        return { ...r, data: extractArray(r.data).map(camelize) }
      }
    },
    {
      key: 'saas',
      fn: async () => {
        const r = await client.saas.list()
        return { ...r, data: extractArray(r.data).map(camelize) }
      }
    },
    {
      key: 'connectors',
      fn: async () => {
        const r = await client.connectors.list()
        return { ...r, data: extractArray(r.data).map(camelize) }
      }
    },
    {
      key: 'workflowTemplates',
      fn: async () => {
        const r = await client.workflowTemplates.list()
        return { ...r, data: extractArray(r.data).map(camelize) }
      }
    }
  ]

  await Promise.allSettled(
    tasks.map(async (t) => {
      try {
        const resp = await t.fn()
        if (resp.code === 0) {
          ;(result as unknown as Record<string, unknown>)[t.key] = resp.data
        }
      } catch {
        // 单个接口失败不影响其他
      }
    })
  )

  return result
}

// ============================================================
// 7. 各视图 CRUD 操作走后端
// ============================================================

// —— 知识库 ——
export async function createKnowledgeDoc(doc: Record<string, unknown>): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.knowledge.create(doc)
    return resp.code === 0
  } catch {
    return false
  }
}

export async function deleteKnowledgeDoc(docId: string): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.knowledge.delete(docId)
    return resp.code === 0
  } catch {
    return false
  }
}

/** 更新知识文档（绑定/解绑智能体等） */
export async function updateKnowledgeDoc(
  docId: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const client = getApiClient()
  try {
    const resp = await client.knowledge.update(docId, data)
    return resp.code === 0 ? mapKnowledgeDoc(resp.data) as Record<string, unknown> : null
  } catch {
    return null
  }
}

/** 获取知识文档文本内容（在线预览） */
export async function getKnowledgeDocContent(
  docId: string
): Promise<string | null> {
  const client = getApiClient()
  try {
    const resp = await client.knowledge.content(docId)
    if (resp.code === 0) {
      const d = resp.data as Record<string, unknown>
      return (d?.content_text as string) ?? ''
    }
  } catch {
    // 降级
  }
  return null
}

// —— 素材 ——
export async function createMediaAsset(asset: Record<string, unknown>): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.media.create(asset)
    return resp.code === 0
  } catch {
    return false
  }
}

export async function deleteMediaAsset(assetId: string): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.media.delete(assetId)
    return resp.code === 0
  } catch {
    return false
  }
}

// —— 任务 ——
export async function createTask(task: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const client = getApiClient()
  try {
    const resp = await client.tasks.create(task)
    return resp.code === 0 ? resp.data as Record<string, unknown> : null
  } catch {
    return null
  }
}

export async function updateTask(taskId: string, updates: Record<string, unknown>): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.tasks.update(taskId, updates)
    return resp.code === 0
  } catch {
    return false
  }
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.tasks.delete(taskId)
    return resp.code === 0
  } catch {
    return false
  }
}

// —— 积分 ——
export async function rechargeCredits(amount: number): Promise<number | null> {
  const client = getApiClient()
  try {
    const resp = await client.credits.recharge(amount)
    if (resp.code === 0) {
      return (resp.data as Record<string, unknown>)?.balance as number ?? null
    }
  } catch {
    // 降级
  }
  return null
}

export interface CreditPackageInfo {
  id: number
  name: string
  credits: number
  price: string
  bonus_credits: number
  is_popular: boolean
  enabled: boolean
}

export interface CreditConfigInfo {
  tokens_per_credit: number
  unit_price: string
  free_credits_on_register: number
  min_purchase_credits: number
  enable_online_pay: boolean
  enable_offline_pay: boolean
}

export async function fetchCreditPackages(): Promise<{ packages: CreditPackageInfo[]; config: CreditConfigInfo | null }> {
  const client = getApiClient()
  try {
    const resp = await client.credits.packages()
    if (resp.code === 0) {
      const d = resp.data as { packages: unknown[]; config: Record<string, unknown> }
      const packages = (d.packages || []).map((p) => {
        const pkg = p as Record<string, unknown>
        return {
          id: pkg.id as number,
          name: pkg.name as string,
          credits: pkg.credits as number,
          price: String(pkg.price ?? '0'),
          bonus_credits: (pkg.bonus_credits ?? 0) as number,
          is_popular: (pkg.is_popular ?? false) as boolean,
          enabled: (pkg.enabled ?? true) as boolean,
        }
      })
      const config = d.config ? {
        tokens_per_credit: (d.config.tokens_per_credit ?? 1000) as number,
        unit_price: String(d.config.unit_price ?? '0.10'),
        free_credits_on_register: (d.config.free_credits_on_register ?? 1000) as number,
        min_purchase_credits: (d.config.min_purchase_credits ?? 100) as number,
        enable_online_pay: (d.config.enable_online_pay ?? false) as boolean,
        enable_offline_pay: (d.config.enable_offline_pay ?? true) as boolean,
      } : null
      return { packages, config }
    }
  } catch {
    // 降级
  }
  return { packages: [], config: null }
}

export interface CreditOrderInfo {
  id: number
  order_no: string
  credits: number
  bonus_credits: number
  total_credits: number
  amount: string
  payment_method: string
  payment_method_display: string
  status: string
  status_display: string
  created_at: string
}

export async function createCreditOrder(data: { package_id?: number; credits?: number; payment_method?: string }): Promise<CreditOrderInfo | null> {
  const client = getApiClient()
  try {
    const resp = await client.credits.createOrder(data)
    if (resp.code === 0) {
      return resp.data as unknown as CreditOrderInfo
    }
  } catch {
    // 降级
  }
  return null
}

export async function fetchCreditOrders(): Promise<CreditOrderInfo[]> {
  const client = getApiClient()
  try {
    const resp = await client.credits.myOrders()
    if (resp.code === 0) {
      const d = resp.data as { items: unknown[]; total: number }
      return (d.items || []).map((o) => o as unknown as CreditOrderInfo)
    }
  } catch {
    // 降级
  }
  return []
}

// —— 技能 ——
export async function toggleSkill(name: string): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.skills.toggle(name)
    return resp.code === 0
  } catch {
    return false
  }
}

// —— SaaS 连接 ——
export async function updateSaasConnection(connId: string, updates: Record<string, unknown>): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.saas.update(connId, updates)
    return resp.code === 0
  } catch {
    return false
  }
}

// —— 数据底座连接器 ——
export async function createConnector(connector: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const client = getApiClient()
  try {
    const resp = await client.connectors.create(connector)
    return resp.code === 0 ? resp.data as Record<string, unknown> : null
  } catch {
    return null
  }
}

export async function updateConnector(connId: string, updates: Record<string, unknown>): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.connectors.update(connId, updates)
    return resp.code === 0
  } catch {
    return false
  }
}

export async function deleteConnector(connId: string): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.connectors.delete(connId)
    return resp.code === 0
  } catch {
    return false
  }
}

// —— 模型部署 ——
export async function deployModel(modelId: string): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.models.deploy(modelId)
    return resp.code === 0
  } catch {
    return false
  }
}

// —— 提示词 ——
export interface HomePromptCard {
  id: number
  category: string
  title: string
  desc: string
  prompt: string
  icon: string
}

/** 拉取首页提示词（首页卡片）。返回 null 时调用方回退到本地静态卡片 */
export async function fetchHomePrompts(): Promise<HomePromptCard[] | null> {
  const client = getApiClient()
  try {
    const resp = await client.prompts.list('home')
    if (resp.code === 0) {
      return (resp.data as PromptItem[]).map((p) => ({
        id: p.id,
        category: p.category,
        title: p.title,
        desc: p.content,
        prompt: p.content,
        icon: p.icon,
      }))
    }
  } catch {
    // 后端不可达 → 回退静态卡片
  }
  return null
}

/** 拉取普通提示词（聊天输入框上方_chips）。返回 null 时调用方不展示 */
export async function fetchChatPrompts(): Promise<string[] | null> {
  const client = getApiClient()
  try {
    const resp = await client.prompts.list('chat')
    if (resp.code === 0) {
      return (resp.data as PromptItem[]).map((p) => p.content)
    }
  } catch {
    // 后端不可达 → 不展示
  }
  return null
}

/** 拉取采购兔首页提示词（purchase_home 类型）。返回 null 时调用方不展示 */
export async function fetchPurchaseHomePrompts(): Promise<HomePromptCard[] | null> {
  const client = getApiClient()
  try {
    const resp = await client.prompts.list('purchase_home')
    if (resp.code === 0) {
      return (resp.data as PromptItem[]).map((p) => ({
        id: p.id,
        category: p.category,
        title: p.title,
        desc: p.content,
        prompt: p.content,
        icon: p.icon,
      }))
    }
  } catch {
    // 后端不可达 → 不展示
  }
  return null
}

export interface PurchaseChatPromptGroup {
  quick: PromptItem[]
  collective: PromptItem[]
  search: PromptItem[]
}

/** 拉取采购对话快捷输入提示词，按 快采/集采/找品 三库分组。返回 null 时调用方不展示 */
export async function fetchPurchaseChatPrompts(): Promise<PurchaseChatPromptGroup | null> {
  const client = getApiClient()
  try {
    const resp = await client.prompts.list('purchase_chat')
    if (resp.code === 0) {
      const items = (resp.data as PromptItem[]) || []
      return {
        quick: items.filter((p) => p.category === 'quick').sort((a, b) => a.sort - b.sort || a.id - b.id),
        collective: items.filter((p) => p.category === 'collective').sort((a, b) => a.sort - b.sort || a.id - b.id),
        search: items.filter((p) => p.category === 'search').sort((a, b) => a.sort - b.sort || a.id - b.id),
      }
    }
  } catch {
    // 后端不可达 → 不展示
  }
  return null
}

// —— 模型连接测试 ——
export async function testModel(modelId: string): Promise<Record<string, unknown> | null> {
  const client = getApiClient()
  try {
    const resp = await client.models.test(modelId)
    return resp.code === 0 ? resp.data as Record<string, unknown> : null
  } catch {
    return null
  }
}

// —— 系统配置更新 ——
export async function updateSysConfig(config: Record<string, unknown>): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.sysConfig.update(config)
    return resp.code === 0
  } catch {
    return false
  }
}

// —— Dify 配置更新 ——
export async function updateDifyConfig(config: Record<string, unknown>): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.sysConfig.updateDify(config)
    return resp.code === 0
  } catch {
    return false
  }
}

// —— 成员 CRUD ——
export async function createMember(member: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const client = getApiClient()
  try {
    const resp = await client.tenant.createMember(member)
    return resp.code === 0 ? resp.data as Record<string, unknown> : null
  } catch {
    return null
  }
}

export async function updateMember(memberId: string, updates: Record<string, unknown>): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.tenant.updateMember(memberId, updates)
    return resp.code === 0
  } catch {
    return false
  }
}

export async function deleteMember(memberId: string): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.tenant.deleteMember(memberId)
    return resp.code === 0
  } catch {
    return false
  }
}

// —— 角色 CRUD ——
export async function createRole(role: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const client = getApiClient()
  try {
    const resp = await client.tenant.createRole(role)
    return resp.code === 0 ? resp.data as Record<string, unknown> : null
  } catch {
    return null
  }
}

export async function updateRole(roleId: string, updates: Record<string, unknown>): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.tenant.updateRole(roleId, updates)
    return resp.code === 0
  } catch {
    return false
  }
}

export async function deleteRole(roleId: string): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.tenant.deleteRole(roleId)
    return resp.code === 0
  } catch {
    return false
  }
}

// —— 智能体配置写回（第三层 → 第二层） ——
export async function updateAgentConfig(
  agentId: string,
  config: Record<string, unknown>
): Promise<boolean> {
  const client = getApiClient()
  try {
    const resp = await client.agents.updateConfig(agentId, config)
    return resp.code === 0
  } catch {
    return false
  }
}

// —— 智能体配置批量读取 ——
export async function fetchAgentConfigs(): Promise<unknown[] | null> {
  const client = getApiClient()
  try {
    const resp = await client.agents.configs()
    if (resp.code === 0) {
      return extractArray(resp.data).map(camelize)
    }
  } catch {
    // 降级
  }
  return null
}
