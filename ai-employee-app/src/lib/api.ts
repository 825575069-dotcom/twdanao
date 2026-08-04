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

import type { ApiResponse, TenantInfo, PromptItem, MassSendTask, MassSendTaskPayload, MomentsTask, MomentsTaskListResponse, MomentsTaskPayload, MarketingDashboard, AreaCode, WecomDevice } from '../types'
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
  const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD
  const savedBaseUrl = localStorage.getItem('yesgo_api_base_url')
  // Electron 打包后可能把 file:// 地址写入 localStorage，必须过滤
  const baseUrl = savedBaseUrl && !savedBaseUrl.startsWith('file:')
    ? savedBaseUrl
    : (isProd ? 'https://twdanaob.88yldh.com/api/v1' : 'http://localhost:8000/api/v1')
  return {
    // 默认指向天网大脑后端（第二层）— 生产环境用 HTTPS 域名，开发环境用 localhost
    baseUrl,
    tenantId: localStorage.getItem('yesgo_tenant_id') || '',
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

/** 确保路径以 / 结尾（Django APPEND_SLASH 要求），处理查询参数 */
function ensureTrailingSlash(path: string): string {
  if (path.includes('?')) {
    const idx = path.indexOf('?')
    const basePath = path.slice(0, idx)
    const query = path.slice(idx + 1)
    return basePath.endsWith('/') ? path : `${basePath}/?${query}`
  }
  return path.endsWith('/') ? path : `${path}/`
}

async function doFetch<T>(
  config: ApiClientConfig,
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const url = `${config.baseUrl}${ensureTrailingSlash(path)}`
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
    const resp = await fetch(`${config.baseUrl}/auth/refresh/`, {
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
  const patch = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    withRetry<T>(config, path, { ...opts, method: 'PATCH', body })
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
      me: () => get<TenantInfo>('/auth/me'),
      forgotPasswordSendCode: (phone: string) =>
        post<{ phone: string; code?: string; expires_in: number }>(
          '/auth/forgot-password/send-code',
          { phone },
          { skipAuth: true, skipTenant: true }
        ),
      forgotPasswordVerifyCode: (phone: string, code: string) =>
        post<{ phone: string; reset_token: string; expires_in: number }>(
          '/auth/forgot-password/verify-code',
          { phone, code },
          { skipAuth: true, skipTenant: true }
        ),
      forgotPasswordReset: (phone: string, resetToken: string, newPassword: string) =>
        post<{ msg: string }>(
          '/auth/forgot-password/reset',
          { phone, reset_token: resetToken, new_password: newPassword },
          { skipAuth: true, skipTenant: true }
        )
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
        ),
      // 语音转文字
      stt: async (audio: File): Promise<ApiResponse<{ text: string }>> => {
        const formData = new FormData()
        formData.append('audio', audio)
        const url = `${config.baseUrl}/chat/stt/`
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
          return { code: 500, msg: '语音识别失败', data: { text: '' } }
        } finally {
          clearTimeout(timeoutId)
        }
      }
    },

    // —— Ai药采购（免扣积分专用端点） ——
    pharmacy: {
      send: (message: string, sessionId?: string, mode?: 'quick' | 'collective' | 'search') =>
        post<{
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
          products: unknown[]
          solutions: unknown | null
        }>('/chat/pharmacy/send', { message, session_id: sessionId, mode: mode ?? 'quick' }),
    },

    // —— 公共数据库（采购 API） ——
    pdb: {
      // 快采一键下单
      quickOrder: (data: { tenant_id: string; product_id: number; quantity: number; payment_method?: string; notes?: string }) =>
        post('/public-databases/orders/quick-create/', data),
      // 从报价创建订单
      createOrder: (data: { quote_id: number; quantity?: number; payment_method?: string; notes?: string }) =>
        post('/public-databases/orders/create/', data),
      // 订单列表
      orders: (params?: { tenant_id?: string; status?: string; order_type?: string }) => {
        const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
        return get(`/public-databases/orders/${qs}`)
      },
      // 订单详情
      orderDetail: (id: number) => get(`/public-databases/orders/${id}/`),
      // 订单全状态
      orderFullStatus: (id: number) => get(`/public-databases/orders/${id}/full-status/`),
      // 创建支付
      createPayment: (orderId: number, method?: string) =>
        post(`/public-databases/orders/${orderId}/pay/`, { payment_method: method || 'wechat' }),
      // 处理支付
      processPayment: (paymentId: number) => post(`/public-databases/payments/${paymentId}/process/`),
      // 支付回调
      paymentCallback: (data: { payment_id: number; status?: string }) =>
        post('/public-databases/payments/callback/', data),
      // 资质交换
      qualification: (orderId: number, buyerQualifications: unknown[]) =>
        post(`/public-databases/orders/${orderId}/qualification/`, { buyer_qualifications: buyerQualifications }),
      // 电子签章
      eSign: (orderId: number) => post(`/public-databases/orders/${orderId}/e-sign/`),
      completeSign: (orderId: number) => post(`/public-databases/orders/${orderId}/complete-sign/`),

      // 集采公告
      announcements: (params?: { status?: string }) => {
        const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
        return get(`/public-databases/announcements/${qs}`)
      },
      announcementDetail: (id: number) => get(`/public-databases/announcements/${id}/`),
      createAnnouncement: (data: Record<string, unknown>) => post('/public-databases/announcements/create/', data),
      publishAnnouncement: (id: number) => post(`/public-databases/announcements/${id}/publish/`),
      aggregateDemand: (id: number) => post(`/public-databases/announcements/${id}/aggregate/`),
      pushSuppliers: (id: number) => post(`/public-databases/announcements/${id}/push-suppliers/`),
      distributeQuotes: (id: number) => post(`/public-databases/announcements/${id}/distribute/`),

      // 集采参与
      participations: (params?: { announcement_id?: number; tenant_id?: string; status?: string }) => {
        const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
        return get(`/public-databases/participations/${qs}`)
      },
      registerParticipation: (data: { announcement_id: number; tenant_id: string; product_id: number; supplier_id: number; quantity: number; notes?: string }) =>
        post('/public-databases/participations/register/', data),
      adjustParticipation: (id: number, finalQuantity: number) =>
        post(`/public-databases/participations/${id}/adjust/`, { final_quantity: finalQuantity }),
      declineParticipation: (id: number) => post(`/public-databases/participations/${id}/decline/`),
      orderFromParticipation: (id: number, paymentMethod?: string) =>
        post(`/public-databases/participations/${id}/create-order/`, { payment_method: paymentMethod || 'wechat' }),

      // 产品搜索
      products: (params?: { search?: string; supplier_id?: number; category?: string; page?: number; page_size?: number }) => {
        const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
        return get(`/public-databases/products/${qs}`)
      },

      // —— 租户资质管理 ——
      tenantQualifications: () => get('/public-databases/tenant-qualifications/'),
      createTenantQualification: (data: Record<string, unknown>) => post('/public-databases/tenant-qualifications/', data),
      updateTenantQualification: (id: number, data: Record<string, unknown>) => put(`/public-databases/tenant-qualifications/${id}/`, data),
      deleteTenantQualification: (id: number) => del(`/public-databases/tenant-qualifications/${id}/`),

      // —— 供应商列表（首营资料选择用） ——
      suppliers: (params?: { search?: string }) => {
        const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
        return get(`/public-databases/suppliers/${qs}`)
      },

      // —— 首营资料管理 ——
      firstOperations: (params?: { status?: string; supplier_id?: number }) => {
        const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
        return get(`/public-databases/first-operations/${qs}`)
      },
      firstOperationDetail: (id: number) => get(`/public-databases/first-operations/${id}/`),
      createFirstOperation: (data: { supplier_id: number; notes?: string }) => post('/public-databases/first-operations/', data),
      submitFirstOperation: (id: number) => post(`/public-databases/first-operations/${id}/submit/`),
      confirmFirstOperation: (id: number, data: { remark?: string }) => post(`/public-databases/first-operations/${id}/confirm/`, data),
      rejectFirstOperation: (id: number, data: { remark?: string }) => post(`/public-databases/first-operations/${id}/reject/`, data),
      esignFirstOperation: (id: number, data?: { provider?: string }) => post(`/public-databases/first-operations/${id}/esign/`, data || {}),
      checkEsignStatus: (id: number) => post(`/public-databases/first-operations/${id}/esign-status/`),
      mockSignFirstOperation: (id: number) => post(`/public-databases/first-operations/${id}/mock-sign/`),
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
      update: (docId: string, data: unknown) => put(`/docs/${docId}`, data),
      content: (docId: string) => get(`/docs/${docId}/content`),
      delete: (docId: string) => del(`/docs/${docId}/delete`)
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
      recharge: (amount: number) => post('/credits/recharge', { amount }),
      packages: () => get<{ packages: unknown[]; config: Record<string, unknown> }>('/credits/packages/'),
      createOrder: (data: { package_id?: number; credits?: number; payment_method?: string }) =>
        post('/credits/orders/create/', data),
      myOrders: () => get<{ items: unknown[]; total: number }>('/credits/orders/')
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

    // —— 提示词（首页提示词 / 普通提示词 / 采购对话提示词，公开读取） ——
    prompts: {
      list: (type: 'home' | 'chat' | 'purchase_chat' | 'purchase_home', category?: string) => {
        const params = new URLSearchParams({ type })
        if (category) params.append('category', category)
        return get<PromptItem[]>(`/prompts?${params.toString()}`, { skipAuth: true, skipTenant: true })
      }
    },

    // —— 平台智能体（公开读取 + 租户配置写回） ——
    agents: {
      list: () => get<unknown[]>('/agents', { skipAuth: true, skipTenant: true }),
      configs: () => get<unknown[]>('/agents/configs'),
      updateConfig: (agentId: string, config: unknown) => put(`/agents/configs/${agentId}`, config),
    },

    // —— 工作流模板（公开读取） ——
    workflowTemplates: {
      list: () => get<unknown[]>('/workflow-templates', { skipAuth: true, skipTenant: true }),
    },

    // —— 企微设备/联系人/消息（wecom app） ——
    wecom: {
      // 省份地区代码
      areaCodes: () => get<AreaCode[]>('/wecom/area-codes/'),
      // 设备
      devices: {
        list: (params?: { status?: string }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<unknown[]>(`/wecom/devices/${qs}`)
        },
        /** 租户端：用 GUID + 备注 + 手机号绑定设备（天网大脑预创建的企微号） */
        bind: (data: { guid: string; mobile: string; remark: string }) =>
          post<WecomDevice>('/wecom/devices/bind/', data),
        /** 获取登录二维码（无需 qiwe_token，后端自动使用全局 Token） */
        getQrcode: (data: { guid: string; device_id?: number }) =>
          post<{ loginQrcodeBase64Data: string; loginQrcodeKey: string }>('/wecom/devices/get-qrcode/', data),
        /** 轮询登录状态（无需 qiwe_token） */
        checkLogin: (data: { guid: string; device_id?: number }) =>
          post<{ loginQrcodeStatus: number; userId?: string; nickname?: string }>('/wecom/devices/check-login/', data),
        /** 提交设备验证码（无需 qiwe_token） */
        verifyCode: (data: { guid: string; code: string; device_id?: number }) =>
          post<Record<string, unknown>>('/wecom/devices/verify-code/', data),
        get: (deviceId: number) => get(`/wecom/devices/${deviceId}/`),
        update: (deviceId: number, data: Record<string, unknown>) => put(`/wecom/devices/${deviceId}/`, data),
        delete: (deviceId: number) => del(`/wecom/devices/${deviceId}/`),
        /** 设备退出登录 */
        logout: (deviceId: number) => post<Record<string, unknown>>(`/wecom/devices/${deviceId}/logout/`),
      },
      // 联系人
      contacts: {
        list: (params?: { device_id?: number; search?: string; page?: number; page_size?: number; tag_ids?: string; untagged?: boolean }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<{ list: unknown[]; total: number; page: number; page_size: number }>(`/wecom/contacts/${qs}`)
        },
        get: (contactId: number) => get(`/wecom/contacts/${contactId}/`),
        update: (contactId: number, data: { remark?: string; ai_hosted?: boolean; enterprise_id?: string; is_pinned?: boolean }) =>
          put(`/wecom/contacts/${contactId}/`, data),
        delete: (contactId: number) => del(`/wecom/contacts/${contactId}/`),
      },
      // 消息
      messages: {
        list: (params: { contact_id?: number; room_id?: number; device_id?: number; limit?: number; before_id?: number; include_group?: boolean }) => {
          const qs = '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
          return get<unknown[]>(`/wecom/messages/${qs}`)
        },
        send: (data: { device_id: number; contact_id?: number; room_id?: number; msg_type: 'text' | 'image' | 'miniprogram'; content: string; quoted_message_id?: number; client_msg_id?: string; app_id?: string; page_path?: string; title?: string; app_name?: string; desc?: string; icon_url?: string; username?: string; thumb_url?: string; cover_image_id?: string; cover_image_aes_key?: string; cover_image_md5?: string; cover_image_size?: number }) =>
          post('/wecom/messages/send/', data),
        delete: (messageId: number) => del(`/wecom/messages/${messageId}/`),
        recall: (messageId: number) => patch(`/wecom/messages/${messageId}/recall/`),
        /** 发送媒体消息（图片/文件/语音）— 使用 FormData 上传 */
        sendMedia: async (data: {
          device_id: number
          contact_id?: number
          room_id?: number
          msg_type: 'image' | 'file' | 'voice'
          file: File
          voice_time?: number
        }): Promise<ApiResponse<unknown>> => {
          const formData = new FormData()
          formData.append('device_id', String(data.device_id))
          if (data.contact_id !== undefined) formData.append('contact_id', String(data.contact_id))
          if (data.room_id !== undefined) formData.append('room_id', String(data.room_id))
          formData.append('msg_type', data.msg_type)
          formData.append('file', data.file)
          if (data.voice_time !== undefined) {
            formData.append('voice_time', String(data.voice_time))
          }
          const url = `${config.baseUrl}/wecom/messages/send/`
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
            return { code: 500, msg: '媒体消息发送失败', data: null }
          } finally {
            clearTimeout(timeoutId)
          }
        },
      },
      // 标签
      tags: {
        list: (params?: { device_id?: number; group_id?: number }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null && String(v) !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<unknown[]>(`/wecom/tags/${qs}`)
        },
        create: (data: { name: string; color?: string; device_id?: number; group_id?: number }) => post('/wecom/tags/', data),
        update: (tagId: number, data: { name?: string; color?: string; group_id?: number; order?: number }) =>
          put(`/wecom/tags/${tagId}/`, data),
        delete: (tagId: number) => del(`/wecom/tags/${tagId}/`),
      },
      // 标签分组
      tagGroups: {
        list: (params?: { device_id?: number }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null && String(v) !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<unknown[]>(`/wecom/tag-groups/${qs}`)
        },
        create: (data: { device_id: number; name: string; is_customer_level?: boolean }) => post('/wecom/tag-groups/', data),
        update: (groupId: number, data: { name?: string; order?: number; is_customer_level?: boolean }) =>
          put(`/wecom/tag-groups/${groupId}/`, data),
        delete: (groupId: number) => del(`/wecom/tag-groups/${groupId}/`),
      },
      // 联系人标签更新
      contactTags: {
        update: (contactId: number, tagIds: number[]) => put(`/wecom/contacts/${contactId}/tags/`, { tag_ids: tagIds }),
      },
      // 群标签更新
      groupRoomTags: {
        update: (roomId: number, tagIds: number[]) => put(`/wecom/groups/${roomId}/tags/`, { tag_ids: tagIds }),
      },
      // 群聊
      groups: {
        list: (params?: { device_id?: number; tag_ids?: string; untagged?: boolean; search?: string }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<unknown[]>(`/wecom/groups/${qs}`)
        },
        members: (roomId: number) => get<{
          room_id: number
          group_id: string
          name: string
          member_count: number
          members: Array<{
            external_userid: string
            contact_id: number | null
            name: string
            avatar: string
            contact_source: string
            is_external: boolean
            is_owner: boolean
          }>
        }>(`/wecom/groups/${roomId}/members/`),
      },
      // 同步
      sync: {
        contacts: (deviceId: number) => post('/wecom/sync/contacts/', { device_id: deviceId }),
        groups: (deviceId: number) => post('/wecom/sync/groups/', { device_id: deviceId }),
        tags: () => post('/wecom/sync/tags/'),
      },
      // 收藏
      favorites: {
        list: () => get<unknown[]>('/wecom/favorites/'),
        create: (data: { message_id?: number; msg_type?: string; content?: string; media_file_url?: string; media_file_name?: string; raw_data?: Record<string, unknown> }) =>
          post('/wecom/favorites/', data),
        delete: (favoriteId: number) => del(`/wecom/favorites/${favoriteId}/`),
      },
      // 草稿（后端持久化）
      drafts: {
        get: (params: { contact_id?: number; room_id?: number }) => {
          const qs = '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
          return get<{ content: string; media_url: string; media_type: string; updated_at: string } | null>(`/wecom/drafts/${qs}`)
        },
        save: (data: { contact_id?: number; room_id?: number; content: string; media_url?: string; media_type?: string }) =>
          put('/wecom/drafts/', data),
        delete: (params: { contact_id?: number; room_id?: number }) => {
          const qs = '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
          return del(`/wecom/drafts/${qs}`)
        },
      },
      // SSE 实时推送 URL 构建（EventSource 不支持自定义头，token 通过 query 传递）
      sseUrl: (deviceId: number) => {
        const cfg = getDefaultApiConfig()
        const base = cfg.baseUrl.replace(/\/api\/v1$/, '')
        const token = encodeURIComponent(cfg.accessToken)
        const tenantId = encodeURIComponent(cfg.tenantId)
        return `${base}/api/v1/wecom/sse/?device_id=${deviceId}&token=${token}&X-Tenant-ID=${tenantId}`
      },
      // 标记会话消息为已读
      markRead: (data: { contact_id?: number; room_id?: number }) =>
        post('/wecom/messages/mark-read/', data),
    },

    // —— 营销跟客（marketing_follow app） ——
    marketing: {
      // 聊天设置
      chatSettings: {
        list: () => get<unknown[]>('/marketing/chat-settings/'),
        get: (deviceId: number) => get(`/marketing/chat-settings/${deviceId}/`),
        save: (deviceId: number, data: Record<string, unknown>) => post(`/marketing/chat-settings/${deviceId}/`, data),
      },
      // AI 回复任务
      aiTasks: {
        list: (params?: { device_id?: number; contact_id?: number; status?: string; page?: number; page_size?: number }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<{ list: unknown[]; total: number; page: number; page_size: number }>(`/marketing/ai-reply-tasks/${qs}`)
        },
      },
      // 主动跟进任务
      proactiveTasks: {
        list: (params?: { status?: string; page?: number; page_size?: number }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<{ list: unknown[]; total: number; page: number; page_size: number }>(`/marketing/proactive-tasks/${qs}`)
        },
      },
      // 群发任务
      broadcastTasks: {
        list: (params?: { page?: number; page_size?: number }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<{ list: unknown[]; total: number; page: number; page_size: number }>(`/marketing/broadcast-tasks/${qs}`)
        },
        create: (data: Record<string, unknown>) => post('/marketing/broadcast-tasks/create/', data),
      },
      // 朋友圈任务
      momentsTasks: {
        list: (params?: { search?: string; status?: string; created_by?: string; start_date?: string; end_date?: string; page?: number; page_size?: number }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null && String(v) !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<MomentsTaskListResponse>(`/marketing/moments-tasks/${qs}`)
        },
        create: (data: MomentsTaskPayload) => post<MomentsTask>('/marketing/moments-tasks/', data),
        get: (taskId: number) => get<MomentsTask>(`/marketing/moments-tasks/${taskId}/`),
        update: (taskId: number, data: Partial<MomentsTaskPayload>) => put<MomentsTask>(`/marketing/moments-tasks/${taskId}/`, data),
        delete: (taskId: number) => del(`/marketing/moments-tasks/${taskId}/`),
        batchDelete: (ids: number[]) => post('/marketing/moments-tasks/batch-delete/', { ids }),
        toggle: (taskId: number, action: 'enable' | 'disable') => post(`/marketing/moments-tasks/${taskId}/toggle/`, { action }),
      },
      // 客户画像
      customerProfiles: {
        list: (params?: { page?: number; page_size?: number }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<{ list: unknown[]; total: number; page: number; page_size: number }>(`/marketing/customer-profiles/${qs}`)
        },
      },
      // 数据看板
      dashboard: {
        get: (params?: { range?: string; start_date?: string; end_date?: string }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null && String(v) !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<MarketingDashboard>(`/marketing/dashboard/${qs}`)
        },
      },
      // 自动贴标签规则
      autoTagRules: {
        list: (params?: { device_id?: number }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null && String(v) !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<unknown[]>(`/marketing/auto-tag-rules/${qs}`)
        },
        create: (data: { device_id: number; name: string; keywords: string[]; match_mode: 'any' | 'all'; scope: 'contact' | 'group'; target_tag: number }) =>
          post('/marketing/auto-tag-rules/', data),
        get: (ruleId: number) => get(`/marketing/auto-tag-rules/${ruleId}/`),
        update: (ruleId: number, data: { name?: string; keywords?: string[]; match_mode?: 'any' | 'all'; scope?: 'contact' | 'group'; target_tag?: number; is_enabled?: boolean }) =>
          put(`/marketing/auto-tag-rules/${ruleId}/`, data),
        delete: (ruleId: number) => del(`/marketing/auto-tag-rules/${ruleId}/`),
        run: (ruleId: number) => post(`/marketing/auto-tag-rules/${ruleId}/run/`),
      },
      // 精准群发任务
      massSendTasks: {
        list: (params?: { search?: string; status?: string; created_by?: string; start_date?: string; end_date?: string; page?: number; page_size?: number }) => {
          const qs = params ? '?' + Object.entries(params).filter(([, v]) => v != null && String(v) !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : ''
          return get<{ list: MassSendTask[]; total: number; page: number; page_size: number }>(`/marketing/mass-send-tasks/${qs}`)
        },
        create: (data: MassSendTaskPayload) => post<MassSendTask>('/marketing/mass-send-tasks/', data),
        get: (taskId: number) => get<MassSendTask>(`/marketing/mass-send-tasks/${taskId}/`),
        update: (taskId: number, data: Partial<MassSendTaskPayload>) => put<MassSendTask>(`/marketing/mass-send-tasks/${taskId}/`, data),
        delete: (taskId: number) => del(`/marketing/mass-send-tasks/${taskId}/`),
        batchDelete: (ids: number[]) => post('/marketing/mass-send-tasks/batch-delete/', { ids }),
        toggle: (taskId: number, action: 'enable' | 'disable') => post(`/marketing/mass-send-tasks/${taskId}/toggle/`, { action }),
      },
    },

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
    upload: async (file: File, qualificationType?: string): Promise<ApiResponse<{
      url: string
      name: string
      size: number
      type: string
      ocr?: {
        license_number?: string
        issue_date?: string
        expiry_date?: string
        raw_text?: string
        error?: string
      }
    }>> => {
      const formData = new FormData()
      formData.append('file', file)
      if (qualificationType) formData.append('qualification_type', qualificationType)
      const url = `${config.baseUrl}/chat/upload/`
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
