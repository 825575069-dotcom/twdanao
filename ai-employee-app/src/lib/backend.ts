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
import type { ApiResponse } from '../types'

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

/** 映射成员数据：确保 name/roleId/roleName 字段存在 */
function mapMember(item: unknown): unknown {
  const m = item as Record<string, unknown>
  return {
    ...m,
    id: String(m.id ?? ''),
    name: m.name ?? m.username ?? '',
    roleId: m.roleId ?? m.role_code ?? m.role ?? '',
    roleName: m.roleName ?? m.role_name ?? '',
  }
}

/** 映射角色数据：确保 desc/canManageMembers/canAssignCredits 字段存在 */
function mapRole(item: unknown): unknown {
  const r = item as Record<string, unknown>
  return {
    ...r,
    id: String(r.id ?? ''),
    desc: r.desc ?? r.description ?? '',
    canManageMembers: r.canManageMembers ?? r.can_manage_members ?? false,
    canAssignCredits: r.canAssignCredits ?? r.can_assign_credits ?? false,
  }
}

/** 映射知识库文档 */
function mapKnowledgeDoc(item: unknown): unknown {
  const d = camelize(item) as Record<string, unknown>
  return {
    ...d,
    id: String(d.id ?? ''),
    title: d.title ?? d.name ?? '',
    category: d.category ?? d.type ?? '',
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

      setStatus('connected')
      return {
        success: true,
        tenantId: tenantId ? String(tenantId) : undefined,
        userId: (user as Record<string, unknown>)?.id as string | undefined,
      }
    }
    setStatus('error')
    return { success: false, error: resp.msg || '登录失败' }
  } catch {
    setStatus('error')
    return { success: false, error: '无法连接到服务器' }
  }
}

/**
 * 检查当前 token 是否有效
 */
export async function checkAuth(): Promise<boolean> {
  const client = getApiClient()
  if (!client.config.accessToken) return false

  setStatus('connecting')
  try {
    const meResp = await client.auth.me()
    if (meResp.code === 0) {
      setStatus('connected')
      return true
    }
  } catch {
    // token 失效
  }
  setStatus('idle')
  return false
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
    dify: null
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
    connectors: null
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
