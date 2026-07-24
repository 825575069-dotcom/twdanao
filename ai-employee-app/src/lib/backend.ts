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

// ============================================================
// 1. 自动登录
// ============================================================

export async function autoLogin(): Promise<boolean> {
  setStatus('connecting')
  const client = getApiClient()

  // 已有 token → 验证 /auth/me
  if (client.config.accessToken) {
    try {
      const meResp = await client.auth.me()
      if (meResp.code === 0) {
        setStatus('connected')
        return true
      }
    } catch {
      // token 失效，继续走 login
    }
  }

  // 登录（Mock 后端：任意用户名密码均可）
  try {
    const resp = await client.auth.login('陈升', 'yesgo2026')
    if (resp.code === 0 && resp.data.access_token) {
      const { access_token, refresh_token } = resp.data
      localStorage.setItem('yesgo_access_token', access_token)
      localStorage.setItem('yesgo_refresh_token', refresh_token)
      updateApiConfig({ accessToken: access_token, refreshToken: refresh_token })
      setStatus('connected')
      return true
    }
  } catch {
    // 后端不可达
  }

  setStatus('error')
  return false
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
        return { ...r, data: (r.data as Record<string, unknown>)?.items ?? [] }
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
        return { ...r, data: (r.data as Record<string, unknown>)?.items ?? [] }
      }
    },
    {
      key: 'models',
      fn: async () => {
        const r = await client.models.list()
        const d = r.data as Record<string, unknown>
        return { ...r, data: d?.items ?? d ?? [] }
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
        return { ...r, data: (r.data as Record<string, unknown>)?.items ?? [] }
      }
    },
    {
      key: 'media',
      fn: async () => {
        const r = await client.media.list()
        return { ...r, data: (r.data as Record<string, unknown>)?.items ?? [] }
      }
    },
    {
      key: 'tasks',
      fn: async () => {
        const r = await client.tasks.list()
        return { ...r, data: (r.data as Record<string, unknown>)?.items ?? [] }
      }
    },
    {
      key: 'creditBalance',
      fn: async () => {
        const r = await client.credits.balance()
        return { ...r, data: (r.data as Record<string, unknown>)?.balance ?? 0 }
      }
    },
    {
      key: 'creditLedger',
      fn: async () => {
        const r = await client.credits.ledger()
        return { ...r, data: (r.data as Record<string, unknown>)?.items ?? [] }
      }
    },
    {
      key: 'skills',
      fn: async () => {
        const r = await client.skills.list()
        return { ...r, data: (r.data as Record<string, unknown>)?.items ?? [] }
      }
    },
    {
      key: 'saas',
      fn: async () => {
        const r = await client.saas.list()
        return { ...r, data: (r.data as Record<string, unknown>)?.items ?? [] }
      }
    },
    {
      key: 'connectors',
      fn: async () => {
        const r = await client.connectors.list()
        return { ...r, data: (r.data as Record<string, unknown>)?.items ?? [] }
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
