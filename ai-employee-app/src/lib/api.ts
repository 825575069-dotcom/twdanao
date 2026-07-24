// ============================================================
// YesGo API 客户端 —— 统一 HTTP 封装
// 对齐 AGENTS.md：
//   - { code, msg, data } 标准响应
//   - Bearer Token 鉴权 + 自动刷新
//   - X-Tenant-ID 租户隔离头
//   - 请求重试 / 超时控制
//
// TODO: 接入真实后端 —— 替换 fetch 为真实 API 端点即可。
//       响应格式已对齐 AGENTS.md，后续只需把 mock 实现删掉。
// ============================================================

import type { ApiResponse, TenantInfo } from '../types'
import { API_BUSINESS_CODE } from './constants'

// —— 客户端配置 ——

export interface ApiClientConfig {
  /** 后端 API 基地址，如 http://192.168.2.180:8000/api */
  baseUrl: string
  /** 当前租户 ID */
  tenantId: string
  /** 访问令牌 */
  accessToken: string
  /** 刷新令牌 */
  refreshToken: string
  /** Token 签发者 */
  issuer: string
  /** 请求超时毫秒，默认 15000 */
  timeout: number
  /** 最大重试次数，默认 1 */
  maxRetry: number
  /** 当 Token 即将过期时提前刷新的窗口（秒），默认 1800 */
  refreshEarlySeconds: number
}

/** 获取默认配置（依赖 localStorage） */
export function getDefaultApiConfig(): ApiClientConfig {
  return {
    // 默认指向本地 Django 天网大脑后端（第二层）
    baseUrl: localStorage.getItem('yesgo_api_base_url') || 'http://localhost:8000/api/v1',
    tenantId: localStorage.getItem('yesgo_tenant_id') || 't_001',
    accessToken: localStorage.getItem('yesgo_access_token') || '',
    refreshToken: localStorage.getItem('yesgo_refresh_token') || '',
    issuer: 'yesgo',
    timeout: 15000,
    maxRetry: 1,
    refreshEarlySeconds: 1800
  }
}

// —— 请求构建 ——

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  /** 跳过租户头（总控接口不需要 X-Tenant-ID） */
  skipTenant?: boolean
  /** 跳过鉴权 */
  skipAuth?: boolean
  /** 超时覆盖 */
  timeout?: number
}

interface FetchContext {
  config: ApiClientConfig
  path: string
  options: RequestOptions
}

function buildHeaders(ctx: FetchContext): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }

  if (!ctx.options.skipAuth && ctx.config.accessToken) {
    h['Authorization'] = `Bearer ${ctx.config.accessToken}`
  }

  if (!ctx.options.skipTenant && ctx.config.tenantId) {
    h['X-Tenant-ID'] = ctx.config.tenantId
  }

  return { ...h, ...ctx.options.headers }
}

// —— 核心请求 ——

async function doFetch<T>(
  config: ApiClientConfig,
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const url = `${config.baseUrl}${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? config.timeout)

  try {
    const resp = await fetch(url, {
      method: options.method ?? 'GET',
      headers: buildHeaders({ config, path, options }),
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    })

    const json: ApiResponse<T> = await resp.json()

    // Token 过期 → 尝试刷新
    if (
      json.code === API_BUSINESS_CODE.UNAUTHORIZED &&
      config.refreshToken &&
      !path.includes('/auth/refresh')
    ) {
      const refreshed = await refreshAccessToken(config)
      if (refreshed) {
        return doFetch(config, path, options)
      }
    }

    return json
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        code: API_BUSINESS_CODE.INTERNAL_ERROR,
        msg: '请求超时',
        data: {} as T
      }
    }
    return {
      code: API_BUSINESS_CODE.INTERNAL_ERROR,
      msg: err instanceof Error ? err.message : '网络错误',
      data: {} as T
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

/** 自动重试封装 */
async function withRetry<T>(
  config: ApiClientConfig,
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  let last: ApiResponse<T> | null = null
  for (let i = 0; i <= config.maxRetry; i++) {
    last = await doFetch<T>(config, path, options)
    if (last.code === API_BUSINESS_CODE.SUCCESS) return last
    if (i < config.maxRetry) {
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
  return last!
}

// —— Token 管理 ——

async function refreshAccessToken(config: ApiClientConfig): Promise<boolean> {
  try {
    const resp = await fetch(`${config.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: config.refreshToken })
    })
    const json: ApiResponse<{ access_token: string; refresh_token: string }> = await resp.json()
    if (json.code === 0) {
      config.accessToken = json.data.access_token
      config.refreshToken = json.data.refresh_token
      localStorage.setItem('yesgo_access_token', json.data.access_token)
      localStorage.setItem('yesgo_refresh_token', json.data.refresh_token)
      return true
    }
  } catch {
    // 静默失败，让调用方处理
  }
  return false
}

// ============================================================
// 公开 API 方法 —— 按领域分组
// ============================================================

/** 创建 API 客户端实例 */
export function createApiClient(cfg?: Partial<ApiClientConfig>) {
  const config: ApiClientConfig = { ...getDefaultApiConfig(), ...cfg }
  const get = <T>(path: string, opts?: RequestOptions) => withRetry<T>(config, path, { ...opts, method: 'GET' })
  const post = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    withRetry<T>(config, path, { ...opts, method: 'POST', body })
  const put = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    withRetry<T>(config, path, { ...opts, method: 'PUT', body })
  const del = <T>(path: string, opts?: RequestOptions) => withRetry<T>(config, path, { ...opts, method: 'DELETE' })

  return {
    config,

    // —— 认证 ——
    auth: {
      login: (username: string, password: string) =>
        post<{ access_token: string; refresh_token: string; user: Record<string, unknown>; tenant: Record<string, unknown> }>(
          '/auth/login',
          { username, password },
          { skipAuth: true, skipTenant: true }
        ),
      logout: () => post('/auth/logout'),
      me: () => get<TenantInfo>('/auth/me')
    },

    // —— 对话 ——
    chat: {
      send: (message: string, sessionId?: string) =>
        post<{ session_id: string; reply: string; agent: string; agentCode: string; intent: string; confidence: number; result: Record<string, unknown>; tokens: number }>(
          '/chat/send',
          { message, session_id: sessionId }
        ),
      history: (conversationId: string) =>
        get<{ items: Array<{ role: string; content: string; agent?: string; agentCode?: string }>; total: number }>(
          `/chat/history?conversation_id=${conversationId}`
        ),
      conversations: () =>
        get<{ items: Array<{ id: string; title: string; time: string; agent: string; messageCount: number }>; total: number }>(
          '/chat/conversations'
        )
    },

    // —— 数据底座 ——
    data: {
      products: () => get('/data/products'),
      inventory: () => get('/data/inventory'),
      orders: () => get('/data/orders'),
      customers: () => get('/data/customers'),
      distribution: () => get('/data/distribution')
    },

    // —— 经营看板 ——
    dashboard: {
      overview: () => get('/dashboard/overview'),
      kpi: () => get('/dashboard/kpi'),
      alerts: () => get('/dashboard/alerts')
    },

    // —— 系统配置 ——
    sysConfig: {
      get: () => get('/config/'),
      update: (config: unknown) => put('/config/', config),
      dify: () => get('/config/dify'),
      updateDify: (config: unknown) => put('/config/dify', config)
    },

    // —— 模型网关 ——
    models: {
      list: () => get('/models/list'),
      test: (modelId: string) => post('/models/test', { modelId }),
      config: () => get('/models/config'),
      deploy: (modelId: string) => post('/models/deploy', { modelId }),
      // 密钥池
      keys: (modelId?: string) => get(`/models/keys${modelId ? `?model_id=${modelId}` : ''}`),
      addKey: (key: { model: string; key_alias: string; api_key: string; endpoint?: string; priority?: number; daily_quota?: number }) =>
        post('/models/keys', key),
      updateKey: (keyId: string, updates: unknown) => put(`/models/keys/${keyId}`, updates),
      deleteKey: (keyId: string) => del(`/models/keys/${keyId}`),
      resetKeyQuota: () => post('/models/keys/reset-quota'),
      // Token用量
      tokenUsage: () => get('/models/token-usage'),
      // 路由策略
      routing: () => get('/models/routing'),
      createRouting: (strategy: unknown) => post('/models/routing', strategy),
      updateRouting: (strategyId: string, updates: unknown) => put(`/models/routing/${strategyId}`, updates),
      deleteRouting: (strategyId: string) => del(`/models/routing/${strategyId}`),
      // 熔断器
      circuitBreakers: () => get('/models/circuit-breakers'),
      resetCircuitBreaker: (modelId: string) => post('/models/circuit-breakers/reset', { model_id: modelId }),
      // 限流器
      rateLimiter: () => get('/models/rate-limiter'),
      // 模型调用
      call: (params: { model_id: string; messages: Array<{ role: string; content: string }>; agent_code?: string; conversation_id?: string }) =>
        post('/models/call', params),
    },

    // —— 租户管理（成员/角色 CRUD） ——
    tenant: {
      info: () => get<TenantInfo>('/tenant/info'),
      members: () => get<{ items: unknown[]; total: number }>('/tenant/members'),
      package: () => get('/tenant/package'),
      roles: () => get<{ items: unknown[]; total: number }>('/tenant/roles'),
      createMember: (member: unknown) => post('/tenant/members/create', member),
      updateMember: (memberId: string, updates: unknown) => put(`/tenant/members/${memberId}`, updates),
      deleteMember: (memberId: string) => del(`/tenant/members/${memberId}/delete`),
      createRole: (role: unknown) => post('/tenant/roles/create', role),
      updateRole: (roleId: string, updates: unknown) => put(`/tenant/roles/${roleId}`, updates),
      deleteRole: (roleId: string) => del(`/tenant/roles/${roleId}/delete`)
    },

    // —— 知识库 ——
    knowledge: {
      list: () => get<{ items: unknown[]; total: number }>('/docs'),
      create: (doc: unknown) => post('/docs', doc),
      delete: (docId: string) => del(`/docs/${docId}`)
    },

    // —— 素材库 ——
    media: {
      list: () => get<{ items: unknown[]; total: number }>('/assets'),
      create: (asset: unknown) => post('/assets', asset),
      delete: (assetId: string) => del(`/assets/${assetId}`)
    },

    // —— 自动任务 ——
    tasks: {
      list: () => get<{ items: unknown[]; total: number }>('/tasks'),
      create: (task: unknown) => post('/tasks', task),
      update: (taskId: string, updates: unknown) => put(`/tasks/${taskId}`, updates),
      delete: (taskId: string) => del(`/tasks/${taskId}/delete`)
    },

    // —— 积分 ——
    credits: {
      balance: () => get<{ balance: number }>('/credits/balance'),
      ledger: () => get<{ items: unknown[]; total: number }>('/credits/ledger'),
      recharge: (amount: number) => post('/credits/recharge', { amount })
    },

    // —— 技能 ——
    skills: {
      list: () => get<{ items: unknown[]; total: number }>('/skills/list'),
      toggle: (name: string) => post('/skills/toggle', { name })
    },

    // —— SaaS 连接 ——
    saas: {
      list: () => get<{ items: unknown[]; total: number }>('/saas/connections'),
      update: (connId: string, updates: unknown) => put(`/saas/connections/${connId}`, updates)
    },

    // —— 数据底座连接器 ——
    connectors: {
      list: () => get<{ items: unknown[]; total: number }>('/connectors'),
      create: (connector: unknown) => post('/connectors', connector),
      update: (connId: string, updates: unknown) => put(`/connectors/${connId}`, updates),
      delete: (connId: string) => del(`/connectors/${connId}/delete`)
    },

    // —— 健康检查 ——
    health: () => get('/health/'),

    // —— 记忆引擎 ——
    memory: {
      config: () => get('/memory/config'),
      updateConfig: (config: unknown) => put('/memory/config', config),
      summaries: (params?: { status?: string; agent_code?: string; keyword?: string; page?: number; page_size?: number }) => {
        const qs = new URLSearchParams()
        if (params) Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)) })
        const q = qs.toString()
        return get(`/memory/summaries${q ? `?${q}` : ''}`)
      },
      generateSummary: (conversationId: string) => post('/memory/summaries/generate', { conversation_id: conversationId }),
      deleteSummary: (summaryId: string) => del(`/memory/summaries/${summaryId}`),
      facts: (params?: { category?: string; keyword?: string; page?: number; page_size?: number }) => {
        const qs = new URLSearchParams()
        if (params) Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)) })
        const q = qs.toString()
        return get(`/memory/facts${q ? `?${q}` : ''}`)
      },
      addFact: (fact: { key: string; value: string; category?: string; confidence?: number }) => post('/memory/facts/create', fact),
      deleteFact: (factId: string) => del(`/memory/facts/${factId}`),
      recallLogs: (conversationId?: string) => get(`/memory/recall-logs${conversationId ? `?conversation_id=${conversationId}` : ''}`),
      recall: (query: string, conversationId?: string) => post('/memory/recall', { query, conversation_id: conversationId }),
      stats: () => get('/memory/stats'),
      cleanup: () => post('/memory/cleanup'),
    },

    // —— 安全审计 ——
    security: {
      auditLogs: (params?: { action?: string; risk_level?: string; user_id?: string; path?: string; start_date?: string; end_date?: string; page?: number; page_size?: number }) => {
        const qs = new URLSearchParams()
        if (params) Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)) })
        const q = qs.toString()
        return get(`/security/audit-logs${q ? `?${q}` : ''}`)
      },
      auditStats: () => get('/security/audit-logs/stats'),
      config: () => get('/security/config'),
      updateConfig: (config: unknown) => put('/security/config', config),
      maskTest: (data: Record<string, unknown>) => post('/security/mask-test', { data }),
      accessRules: () => get('/security/access-rules'),
      createAccessRule: (rule: unknown) => post('/security/access-rules', rule),
      updateAccessRule: (ruleId: string, updates: unknown) => put(`/security/access-rules/${ruleId}`, updates),
      deleteAccessRule: (ruleId: string) => del(`/security/access-rules/${ruleId}`),
      events: (params?: { severity?: string; resolved?: string; page?: number; page_size?: number }) => {
        const qs = new URLSearchParams()
        if (params) Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)) })
        const q = qs.toString()
        return get(`/security/events${q ? `?${q}` : ''}`)
      },
      resolveEvent: (eventId: string, note?: string) => put(`/security/events/${eventId}/resolve`, { note }),
      overview: () => get('/security/overview'),
    },

    // —— 文件上传 ——
    upload: async (file: File): Promise<ApiResponse<{ url: string; name: string; size: number; type: string }>> => {
      const formData = new FormData()
      formData.append('file', file)
      const url = `${config.baseUrl}/chat/upload`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: config.accessToken ? `Bearer ${config.accessToken}` : '',
            ...(config.tenantId ? { 'X-Tenant-ID': config.tenantId } : {}),
          },
          body: formData,
          signal: controller.signal,
        })
        return await resp.json()
      } catch {
        return { code: 500, msg: '文件上传失败', data: { url: '', name: file.name, size: file.size, type: file.type } }
      } finally {
        clearTimeout(timeoutId)
      }
    },

    // —— 便捷方法 ——
    get,
    post,
    put,
    del,

    /** 判断 API 是否可用 */
    isAvailable: () => !!config.baseUrl && !!config.accessToken
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

// —— 单例 ——

let _client: ApiClient | null = null

export function getApiClient(): ApiClient {
  if (!_client) _client = createApiClient()
  return _client
}

/** 更新全局 API 配置（例如用户在设置页修改后端地址/Token） */
export function updateApiConfig(cfg: Partial<ApiClientConfig>) {
  _client = createApiClient({ ...getDefaultApiConfig(), ...cfg })
}
