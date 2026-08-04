import { useState, useEffect, useCallback } from 'react'
import {
  Cpu, Cloud, Server, CheckCircle2, Loader2, Download, Zap, ShieldCheck,
  Key, BarChart3, GitBranch, AlertTriangle, Plus, Trash2, RefreshCw,
  X, Activity, TrendingUp
} from 'lucide-react'
import { PageTitle, Section } from './SkillsView'
import { useStore, type ModelInfo } from '../store/appStore'
import { businessAgents } from '../data/mockAgents'
import RabbitHead from './RabbitHead'
import { deployModel as deployModelBackend, testModel as testModelBackend } from '../lib/backend'
import { getApiClient } from '../lib/api'
import type {
  ModelKey, TokenUsageStats, RoutingStrategy,
  CircuitBreakerStatus
} from '../types'

// —— 状态元数据 ——
const statusMeta = {
  ready: { label: '可用', color: 'text-emerald-300', dot: 'bg-emerald-400' },
  deploying: { label: '部署中', color: 'text-amber-300', dot: 'bg-amber-400' },
  offline: { label: '未部署', color: 'text-text-muted', dot: 'bg-gray-600' }
} as const

const circuitStateMeta: Record<string, { label: string; color: string; dot: string }> = {
  closed: { label: '正常', color: 'text-emerald-300', dot: 'bg-emerald-400' },
  open: { label: '已熔断', color: 'text-red-300', dot: 'bg-red-400' },
  half_open: { label: '半开', color: 'text-amber-300', dot: 'bg-amber-400' }
}

const keyStatusMeta: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: '正常', color: 'text-emerald-300', dot: 'bg-emerald-400' },
  disabled: { label: '已禁用', color: 'text-text-muted', dot: 'bg-gray-500' },
  exhausted: { label: '配额耗尽', color: 'text-amber-300', dot: 'bg-amber-400' },
  error: { label: '异常', color: 'text-red-300', dot: 'bg-red-400' }
}

const strategyTypeLabels: Record<string, string> = {
  priority: '优先级',
  round_robin: '轮询',
  least_cost: '最低成本',
  lowest_latency: '最低延迟',
  weighted: '加权'
}

// —— Tab 定义 ——
type ModelTab = 'models' | 'keys' | 'usage' | 'routing' | 'circuit'

const TABS: { key: ModelTab; label: string; icon: typeof Cpu }[] = [
  { key: 'models', label: '模型列表', icon: Cpu },
  { key: 'keys', label: 'API密钥池', icon: Key },
  { key: 'usage', label: 'Token用量', icon: BarChart3 },
  { key: 'routing', label: '路由策略', icon: GitBranch },
  { key: 'circuit', label: '熔断器', icon: AlertTriangle }
]

export default function ModelsView() {
  const store = useStore()
  const [tab, setTab] = useState<ModelTab>('models')
  const [testing, setTesting] = useState<string | null>(null)
  const [tested, setTested] = useState<Record<string, boolean>>({})

  const commercial = store.models.filter((m) => m.type === 'commercial')
  const open = store.models.filter((m) => m.type === 'open')

  const runTest = async (id: string) => {
    setTesting(id)
    if (store.backendConnected) {
      const result = await testModelBackend(id)
      setTesting(null)
      setTested((t) => ({ ...t, [id]: result !== null }))
    } else {
      setTimeout(() => {
        setTesting(null)
        setTested((t) => ({ ...t, [id]: true }))
      }, 900)
    }
  }

  const boundBy = (modelId: string) =>
    store.configs.filter((c) => c.modelId === modelId).map((c) => businessAgents.find((a) => a.id === c.agentId)?.name ?? c.agentId)

  // ============================================================
  // 模型卡片（Tab 1 复用）
  // ============================================================
  const ModelCard = ({ m }: { m: ModelInfo }) => {
    const s = statusMeta[m.status]
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface/60 p-4 transition-colors hover:border-border">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated">
              {m.type === 'commercial' ? (
                <Cloud className="h-4.5 w-4.5 text-sky-300" />
              ) : (
                <Server className="h-4.5 w-4.5 text-emerald-300" />
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-text-primary">{m.name}</div>
              <div className="text-xs text-text-muted">{m.vendor} · {m.contextK}K 上下文</div>
            </div>
          </div>
          <span className={`flex items-center gap-1 text-xs ${s.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        </div>

        <p className="mt-2.5 text-xs leading-relaxed text-text-secondary">{m.desc}</p>

        {boundBy(m.id).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {boundBy(m.id).map((n) => (
              <span key={n} className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">
                {n}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          {m.status === 'offline' ? (
            <button
              onClick={async () => {
                if (store.backendConnected) await deployModelBackend(m.id)
                store.deployModel(m.id)
              }}
              className="flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              <Download className="h-3 w-3" /> 私有化部署
            </button>
          ) : (
            <button
              onClick={() => runTest(m.id)}
              disabled={testing === m.id}
              className="flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              {testing === m.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : tested[m.id] ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-300" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              {testing === m.id ? '测试中' : tested[m.id] ? '连通正常' : '连接测试'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ============================================================
  // Tab 1: 模型列表（原有内容）
  // ============================================================
  const ModelsTab = () => (
    <>
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="text-xs leading-relaxed text-text-secondary">
          <span className="text-text-primary">当前所有模型为模拟状态。</span>
          商用模型填入 API Key、开源模型完成私有化部署后，把网关切到真实通道即可让智能体跑真实业务数据。数据敏感场景建议用开源本地模型（数据不出域）。
        </div>
      </div>

      <Section title="商用大模型（云端 API）">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {commercial.map((m) => <ModelCard key={m.id} m={m} />)}
        </div>
      </Section>

      <Section title="开源模型（本地私有化部署）">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {open.map((m) => <ModelCard key={m.id} m={m} />)}
        </div>
      </Section>

      <Section title="智能体模型绑定">
        <div className="overflow-hidden rounded-xl border border-border-subtle">
          {businessAgents.map((a, i) => {
            const cfg = store.configs.find((c) => c.agentId === a.id)!
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i !== businessAgents.length - 1 ? 'border-b border-border-subtle' : ''
                } bg-bg-surface/40`}
              >
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-bg-elevated">
                  <RabbitHead agentId={a.id} className="h-full w-full" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-text-primary">{a.name}</div>
                  <div className="text-xs text-text-muted">{a.role}</div>
                </div>
                <select
                  value={cfg.modelId}
                  onChange={(e) => store.setDefaultModel(a.id, e.target.value)}
                  className="rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                >
                  {store.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </Section>
    </>
  )

  // ============================================================
  // Tab 2: API 密钥池
  // ============================================================
  const KeysTab = () => {
    const [keys, setKeys] = useState<ModelKey[]>([])
    const [loading, setLoading] = useState(false)
    const [showAdd, setShowAdd] = useState(false)
    const [addForm, setAddForm] = useState({ model: '', key_alias: '', api_key: '', endpoint: '', priority: 10, daily_quota: 1000 })
    const [adding, setAdding] = useState(false)

    const loadKeys = useCallback(async () => {
      if (!store.backendConnected) {
        // Mock 数据
        const now = new Date().toISOString()
        setKeys([
          { id: 'k1', model: 'gpt-4o', model_name: 'GPT-4o', key_alias: '主密钥', api_key_masked: 'sk-****abcd', endpoint: 'https://api.openai.com', status: 'active', priority: 1, daily_quota: 10000, daily_used: 2340, total_used: 45200, last_used: now, last_error: '', error_count: 0, created_at: '2026-06-01T00:00:00Z' },
          { id: 'k2', model: 'qwen-max', model_name: '通义千问-Max', key_alias: '阿里云生产', api_key_masked: 'sk-****efgh', endpoint: 'https://dashscope.aliyuncs.com', status: 'active', priority: 1, daily_quota: 5000, daily_used: 120, total_used: 8120, last_used: now, last_error: '', error_count: 0, created_at: '2026-06-15T00:00:00Z' },
          { id: 'k3', model: 'claude-35', model_name: 'Claude 3.5 Sonnet', key_alias: '备用', api_key_masked: 'sk-****ijkl', endpoint: 'https://api.anthropic.com', status: 'exhausted', priority: 2, daily_quota: 5000, daily_used: 5000, total_used: 25000, last_used: now, last_error: '', error_count: 0, created_at: '2026-07-01T00:00:00Z' },
          { id: 'k4', model: 'hunyuan-pro', model_name: '混元-Pro', key_alias: '腾讯云', api_key_masked: 'sk-****mnop', endpoint: 'https://hunyuan.tencentcloudapi.com', status: 'active', priority: 1, daily_quota: 8000, daily_used: 0, total_used: 0, last_used: null, last_error: '', error_count: 0, created_at: '2026-07-20T00:00:00Z' },
        ])
        return
      }
      setLoading(true)
      try {
        const api = getApiClient()
        const res = await api.models.keys()
        if (res.code === 0) setKeys((res.data as { items: ModelKey[] })?.items ?? [])
      } catch { /* 降级 mock */ }
      setLoading(false)
    }, [store.backendConnected])

    useEffect(() => { loadKeys() }, [loadKeys])

    const handleAdd = async () => {
      if (!addForm.model || !addForm.api_key) return
      setAdding(true)
      try {
        if (store.backendConnected) {
          const api = getApiClient()
          const res = await api.models.addKey({
            model: addForm.model, key_alias: addForm.key_alias,
            api_key: addForm.api_key, endpoint: addForm.endpoint || undefined,
            priority: addForm.priority, daily_quota: addForm.daily_quota
          })
          if (res.code === 0) {
            setKeys((prev) => [...prev, res.data as ModelKey])
          }
        } else {
          // Mock 新增
          const newKey: ModelKey = {
            id: `k${Date.now()}`, model: addForm.model,
            model_name: store.models.find((m) => m.id === addForm.model)?.name ?? addForm.model,
            key_alias: addForm.key_alias || addForm.model,
            api_key_masked: addForm.api_key.slice(0, 3) + '****' + addForm.api_key.slice(-4),
            endpoint: addForm.endpoint, status: 'active',
            priority: addForm.priority, daily_quota: addForm.daily_quota, daily_used: 0,
            total_used: 0, last_used: null, last_error: '', error_count: 0, created_at: new Date().toISOString()
          }
          setKeys((prev) => [...prev, newKey])
        }
        setShowAdd(false)
        setAddForm({ model: '', key_alias: '', api_key: '', endpoint: '', priority: 10, daily_quota: 1000 })
      } catch { /* ignore */ }
      setAdding(false)
    }

    const handleDelete = async (keyId: string) => {
      if (store.backendConnected) {
        const api = getApiClient()
        await api.models.deleteKey(keyId)
      }
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
    }

    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs text-text-muted">
            {keys.length} 个密钥 · {keys.filter((k) => k.status === 'active').length} 正常
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadKeys} className="flex items-center gap-1 rounded-lg border border-border-subtle px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1 text-xs text-white hover:bg-accent-strong transition-colors">
              <Plus className="h-3 w-3" /> 添加密钥
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium text-text-primary">添加 API 密钥</div>
              <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-text-muted" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-text-muted">模型</label>
                <select value={addForm.model} onChange={(e) => setAddForm((f) => ({ ...f, model: e.target.value }))}
                  className="mt-0.5 w-full rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent">
                  <option value="">选择模型</option>
                  {store.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-text-muted">别名</label>
                <input value={addForm.key_alias} onChange={(e) => setAddForm((f) => ({ ...f, key_alias: e.target.value }))}
                  placeholder="例：生产环境主密钥" className="mt-0.5 w-full rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-text-muted">API Key</label>
                <input value={addForm.api_key} onChange={(e) => setAddForm((f) => ({ ...f, api_key: e.target.value }))}
                  placeholder="sk-..." className="mt-0.5 w-full rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted">Endpoint（可选）</label>
                <input value={addForm.endpoint} onChange={(e) => setAddForm((f) => ({ ...f, endpoint: e.target.value }))}
                  placeholder="https://api.xxx.com" className="mt-0.5 w-full rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-text-muted">优先级</label>
                  <input type="number" value={addForm.priority} onChange={(e) => setAddForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                    className="mt-0.5 w-full rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted">日配额（次）</label>
                  <input type="number" value={addForm.daily_quota} onChange={(e) => setAddForm((f) => ({ ...f, daily_quota: Number(e.target.value) }))}
                    className="mt-0.5 w-full rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="rounded-lg border border-border-subtle px-3 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors">取消</button>
              <button onClick={handleAdd} disabled={adding || !addForm.model || !addForm.api_key}
                className="rounded-lg bg-accent px-3 py-1 text-xs text-white hover:bg-accent-strong disabled:opacity-50 transition-colors">
                {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : '确认添加'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {keys.map((k) => {
            const s = keyStatusMeta[k.status]
            const model = store.models.find((m) => m.id === k.model)
            return (
              <div key={k.id} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-surface/40 px-4 py-3 transition-colors hover:border-border">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated">
                  <Key className="h-4 w-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{k.key_alias}</span>
                    <span className={`flex items-center gap-1 text-[10px] ${s.color}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted">{model?.name ?? k.model_name} · {k.api_key_masked}</div>
                  {k.endpoint && <div className="text-[10px] text-text-muted truncate">{k.endpoint}</div>}
                </div>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <div className="text-right">
                    <div>配额 {k.daily_used}/{k.daily_quota}</div>
                    <div className={`h-1 w-16 rounded-full mt-0.5 ${k.daily_quota > 0 ? 'bg-border-subtle' : 'bg-red-500/20'}`}>
                      <div className={`h-full rounded-full ${k.daily_used / Math.max(k.daily_quota, 1) > 0.8 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(100, (k.daily_used / Math.max(k.daily_quota, 1)) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px]">P{k.priority}</span>
                  <button onClick={() => handleDelete(k.id)} className="text-text-muted hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
          {!loading && keys.length === 0 && (
            <div className="py-12 text-center text-xs text-text-muted">暂无 API 密钥，点击「添加密钥」开始</div>
          )}
        </div>
      </div>
    )
  }

  // ============================================================
  // Tab 3: Token 用量统计
  // ============================================================
  const UsageTab = () => {
    const [stats, setStats] = useState<TokenUsageStats | null>(null)

    const loadUsage = useCallback(async () => {
      if (!store.backendConnected) {
        // Mock
        setStats({
          total: { calls: 1256, tokens: 2456000, cost: 12.84, success_rate: 98.5 },
          by_model: [
            { model__name: 'GPT-4o', total_tokens: 890000, total_calls: 420, total_cost: 6.23 },
            { model__name: '通义千问-Max', total_tokens: 620000, total_calls: 380, total_cost: 2.48 },
            { model__name: '混元-Pro', total_tokens: 520000, total_calls: 280, total_cost: 2.08 },
            { model__name: 'Claude 3.5 Sonnet', total_tokens: 426000, total_calls: 176, total_cost: 2.05 },
          ],
          by_agent: [
            { agent_code: 'ops', total_tokens: 680000, total_calls: 350 },
            { agent_code: 'crm', total_tokens: 520000, total_calls: 280 },
            { agent_code: 'purchase', total_tokens: 480000, total_calls: 240 },
            { agent_code: 'flow', total_tokens: 410000, total_calls: 210 },
            { agent_code: 'academic', total_tokens: 366000, total_calls: 176 },
          ],
          by_status: { success: 1238, failed: 12, timeout: 4, circuit_open: 2 },
          daily_trend: [
            { date: '07-20', tokens: 380000, calls: 190, cost: 1.9 },
            { date: '07-21', tokens: 420000, calls: 210, cost: 2.1 },
            { date: '07-22', tokens: 350000, calls: 175, cost: 1.75 },
            { date: '07-23', tokens: 510000, calls: 255, cost: 2.55 },
            { date: '07-24', tokens: 460000, calls: 230, cost: 2.3 },
            { date: '07-25', tokens: 336000, calls: 196, cost: 2.24 },
          ],
          recent: [
            { id: 'r1', model_name: 'GPT-4o', user_name: '张经理', agent_code: 'ops', prompt_tokens: 2400, completion_tokens: 800, total_tokens: 3200, cost: 0.0224, latency_ms: 850, status: 'success', created_at: '2026-07-24T10:30:00Z' },
            { id: 'r2', model_name: '通义千问-Max', user_name: '李运营', agent_code: 'crm', prompt_tokens: 1800, completion_tokens: 600, total_tokens: 2400, cost: 0.0096, latency_ms: 620, status: 'success', created_at: '2026-07-24T10:28:00Z' },
            { id: 'r3', model_name: '混元-Pro', user_name: '王采购', agent_code: 'purchase', prompt_tokens: 3000, completion_tokens: 1200, total_tokens: 4200, cost: 0.0168, latency_ms: 780, status: 'success', created_at: '2026-07-24T10:25:00Z' },
          ]
        })
        return
      }
      try {
        const api = getApiClient()
        const res = await api.models.tokenUsage()
        if (res.code === 0) setStats(res.data as TokenUsageStats)
      } catch { /* 降级 */ }
    }, [store.backendConnected])

    useEffect(() => { loadUsage() }, [loadUsage])

    if (!stats) {
      return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-text-muted" /></div>
    }

    const maxDailyTokens = Math.max(...stats.daily_trend.map((d) => d.tokens), 1)

    const recordStatusLabel = (s: string) => {
      const map: Record<string, { label: string; cls: string }> = {
        success: { label: '成功', cls: 'text-emerald-300' },
        failed: { label: '失败', cls: 'text-red-300' },
        timeout: { label: '超时', cls: 'text-amber-300' },
        circuit_open: { label: '熔断', cls: 'text-red-400' }
      }
      return map[s] ?? { label: s, cls: 'text-text-muted' }
    }

    return (
      <div className="space-y-6">
        {/* 概要卡片 */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '总调用次数', value: stats.total.calls.toLocaleString(), icon: Activity, color: 'text-sky-300' },
            { label: '总 Token', value: (stats.total.tokens / 1000).toFixed(0) + 'K', icon: BarChart3, color: 'text-accent/50' },
            { label: '总费用', value: '¥' + stats.total.cost.toFixed(2), icon: TrendingUp, color: 'text-emerald-300' },
            { label: '成功率', value: stats.total.success_rate + '%', icon: CheckCircle2, color: 'text-amber-300' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4">
              <div className="flex items-center gap-2">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span className="text-xs text-text-muted">{item.label}</span>
              </div>
              <div className="mt-2 text-xl font-semibold text-text-primary">{item.value}</div>
            </div>
          ))}
        </div>

        {/* 按模型 + 每日趋势 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4">
            <div className="mb-3 text-xs font-medium text-text-muted">按模型分布</div>
            {stats.by_model.map((item) => {
              const maxTokens = Math.max(...stats.by_model.map((m) => m.total_tokens), 1)
              return (
                <div key={item.model__name} className="mb-2 last:mb-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-primary">{item.model__name}</span>
                    <span className="text-text-muted">{(item.total_tokens / 1000).toFixed(0)}K · ¥{item.total_cost.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-border-subtle">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(item.total_tokens / maxTokens) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4">
            <div className="mb-3 text-xs font-medium text-text-muted">每日趋势（近7天）</div>
            <div className="flex items-end gap-2 h-24">
              {stats.daily_trend.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-text-muted">{(d.tokens / 1000).toFixed(0)}K</span>
                  <div className="w-full rounded-t bg-accent/60 hover:bg-accent transition-colors"
                    style={{ height: `${Math.max((d.tokens / maxDailyTokens) * 100, 4)}%`, minHeight: 4 }} />
                  <span className="text-[10px] text-text-muted">{d.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 按智能体分布 */}
        <div className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4">
          <div className="mb-3 text-xs font-medium text-text-muted">按智能体分布</div>
          <div className="flex gap-3">
            {stats.by_agent.map((item) => {
              const agent = businessAgents.find((a) => a.id === item.agent_code)
              const maxTokens = Math.max(...stats.by_agent.map((a) => a.total_tokens), 1)
              return (
                <div key={item.agent_code} className="flex-1">
                  <div className="flex justify-center mb-1">
                    <div className="h-7 w-7 overflow-hidden rounded-full">
                      <RabbitHead agentId={agent?.id ?? item.agent_code} className="h-full w-full" />
                    </div>
                  </div>
                  <div className="text-center text-xs text-text-primary font-medium">{agent?.name ?? item.agent_code}</div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-border-subtle">
                    <div className="h-full rounded-full bg-accent/60" style={{ width: `${(item.total_tokens / maxTokens) * 100}%` }} />
                  </div>
                  <div className="text-center text-[10px] text-text-muted mt-1">{(item.total_tokens / 1000).toFixed(0)}K · {item.total_calls}次</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 状态分布 + 最近记录 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4">
            <div className="mb-3 text-xs font-medium text-text-muted">调用状态分布</div>
            <div className="flex gap-3">
              {Object.entries(stats.by_status).map(([status, count]) => {
                const info = recordStatusLabel(status)
                const pct = stats.total.calls > 0 ? ((count / stats.total.calls) * 100).toFixed(1) : '0'
                return (
                  <div key={status} className="flex-1 text-center">
                    <div className={`text-lg font-semibold ${info.cls}`}>{count}</div>
                    <div className="text-[10px] text-text-muted">{info.label}</div>
                    <div className="text-[10px] text-text-muted">{pct}%</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4">
            <div className="mb-3 text-xs font-medium text-text-muted">最近调用</div>
            <div className="space-y-1.5">
              {stats.recent.slice(0, 5).map((r) => {
                const info = recordStatusLabel(r.status)
                return (
                  <div key={r.id} className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 text-text-primary truncate">{r.model_name}</span>
                    <span className="text-text-muted">{r.total_tokens}tk</span>
                    <span className="text-text-muted">{r.latency_ms}ms</span>
                    <span className="ml-auto flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${info.cls === 'text-emerald-300' ? 'bg-emerald-400' : info.cls === 'text-red-300' ? 'bg-red-400' : 'bg-amber-400'}`} />
                      {info.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // Tab 4: 路由策略
  // ============================================================
  const RoutingTab = () => {
    const [strategies, setStrategies] = useState<RoutingStrategy[]>([])
    const [showAdd, setShowAdd] = useState(false)
    const [addForm, setAddForm] = useState({ agent_code: '', primary_model: '', fallback_model: '', strategy_type: 'priority' as RoutingStrategy['strategy_type'] })

    const loadRouting = useCallback(async () => {
      if (!store.backendConnected) {
        // Mock
        setStrategies([
          { id: 'rs1', name: '运营默认', agent_code: 'ops', primary_model: 'gpt-4o', fallback_model: 'qwen-max', primary_model_name: 'GPT-4o', fallback_model_name: '通义千问-Max', strategy_type: 'priority', weight_config: {}, enabled: true, created_at: '2026-06-01T00:00:00Z' },
          { id: 'rs2', name: '跟客默认', agent_code: 'crm', primary_model: 'qwen-max', fallback_model: 'hunyuan-pro', primary_model_name: '通义千问-Max', fallback_model_name: '混元-Pro', strategy_type: 'round_robin', weight_config: { qwen_max: 7, hunyuan_pro: 3 }, enabled: true, created_at: '2026-06-01T00:00:00Z' },
          { id: 'rs3', name: '采购默认', agent_code: 'purchase', primary_model: 'hunyuan-pro', fallback_model: 'claude-35', primary_model_name: '混元-Pro', fallback_model_name: 'Claude 3.5 Sonnet', strategy_type: 'least_cost', weight_config: {}, enabled: true, created_at: '2026-06-01T00:00:00Z' },
          { id: 'rs4', name: '流向默认', agent_code: 'flow', primary_model: 'claude-35', fallback_model: 'gpt-4o', primary_model_name: 'Claude 3.5 Sonnet', fallback_model_name: 'GPT-4o', strategy_type: 'lowest_latency', weight_config: {}, enabled: true, created_at: '2026-06-01T00:00:00Z' },
          { id: 'rs5', name: '学术默认', agent_code: 'academic', primary_model: 'qwen-max', fallback_model: 'ernie-40', primary_model_name: '通义千问-Max', fallback_model_name: '文心一言 4.0', strategy_type: 'weighted', weight_config: { qwen_max: 6, ernie_40: 4 }, enabled: true, created_at: '2026-06-01T00:00:00Z' },
        ])
        return
      }
      try {
        const api = getApiClient()
        const res = await api.models.routing()
        if (res.code === 0) setStrategies((res.data as { items: RoutingStrategy[] })?.items ?? [])
      } catch { /* 降级 */ }
    }, [store.backendConnected])

    useEffect(() => { loadRouting() }, [loadRouting])

    const handleAdd = async () => {
      if (!addForm.agent_code) return
      try {
        if (store.backendConnected) {
          const api = getApiClient()
          const res = await api.models.createRouting(addForm)
          if (res.code === 0) setStrategies((prev) => [...prev, res.data as RoutingStrategy])
        } else {
          const agent = businessAgents.find((a) => a.id === addForm.agent_code)
          const primary = store.models.find((m) => m.id === addForm.primary_model)
          const fallback = store.models.find((m) => m.id === addForm.fallback_model)
          setStrategies((prev) => [...prev, {
            id: `rs${Date.now()}`, name: agent?.name ? `${agent.name}策略` : addForm.agent_code,
            agent_code: addForm.agent_code, primary_model: addForm.primary_model || null,
            fallback_model: addForm.fallback_model || null,
            primary_model_name: primary?.name ?? addForm.primary_model,
            fallback_model_name: fallback?.name ?? addForm.fallback_model,
            strategy_type: addForm.strategy_type, weight_config: {}, enabled: true, created_at: new Date().toISOString()
          }])
        }
        setShowAdd(false)
        setAddForm({ agent_code: '', primary_model: '', fallback_model: '', strategy_type: 'priority' })
      } catch { /* ignore */ }
    }

    const handleDelete = async (id: string) => {
      if (store.backendConnected) {
        const api = getApiClient()
        await api.models.deleteRouting(id)
      }
      setStrategies((prev) => prev.filter((s) => s.id !== id))
    }

    const handleToggle = async (s: RoutingStrategy) => {
      if (store.backendConnected) {
        const api = getApiClient()
        await api.models.updateRouting(s.id, { enabled: !s.enabled })
      }
      setStrategies((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)))
    }

    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs text-text-muted">{strategies.length} 条策略</div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1 text-xs text-white hover:bg-accent-strong transition-colors">
            <Plus className="h-3 w-3" /> 添加策略
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium text-text-primary">添加路由策略</div>
              <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-text-muted" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-text-muted">智能体</label>
                <select value={addForm.agent_code} onChange={(e) => setAddForm((f) => ({ ...f, agent_code: e.target.value }))}
                  className="mt-0.5 w-full rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent">
                  <option value="">选择智能体</option>
                  {businessAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-text-muted">策略类型</label>
                <select value={addForm.strategy_type} onChange={(e) => setAddForm((f) => ({ ...f, strategy_type: e.target.value as RoutingStrategy['strategy_type'] }))}
                  className="mt-0.5 w-full rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent">
                  {Object.entries(strategyTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-text-muted">主模型</label>
                <select value={addForm.primary_model} onChange={(e) => setAddForm((f) => ({ ...f, primary_model: e.target.value }))}
                  className="mt-0.5 w-full rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent">
                  <option value="">自动选择</option>
                  {store.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-text-muted">降级模型</label>
                <select value={addForm.fallback_model} onChange={(e) => setAddForm((f) => ({ ...f, fallback_model: e.target.value }))}
                  className="mt-0.5 w-full rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent">
                  <option value="">无降级</option>
                  {store.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="rounded-lg border border-border-subtle px-3 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors">取消</button>
              <button onClick={handleAdd} disabled={!addForm.agent_code}
                className="rounded-lg bg-accent px-3 py-1 text-xs text-white hover:bg-accent-strong disabled:opacity-50 transition-colors">确认添加</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {strategies.map((s) => {
            const agent = businessAgents.find((a) => a.id === s.agent_code)
            return (
              <div key={s.id} className={`flex items-center gap-3 rounded-xl border bg-bg-surface/40 px-4 py-3 transition-colors hover:border-border ${s.enabled ? 'border-border-subtle' : 'border-border-subtle/50 opacity-60'}`}>
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-bg-elevated">
                  <RabbitHead agentId={agent?.id ?? s.agent_code} className="h-full w-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{s.name}</span>
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">{strategyTypeLabels[s.strategy_type] ?? s.strategy_type}</span>
                  </div>
                  <div className="text-xs text-text-muted">
                    主: {s.primary_model_name || '自动'} → 降级: {s.fallback_model_name || '-'}
                  </div>
                </div>
                <button onClick={() => handleToggle(s)}
                  className={`h-6 w-10 rounded-full transition-colors ${s.enabled ? 'bg-accent' : 'bg-border-subtle'}`}>
                  <div className={`h-5 w-5 rounded-full bg-white mt-0.5 transition-transform ${s.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <button onClick={() => handleDelete(s.id)} className="text-text-muted hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ============================================================
  // Tab 5: 熔断器状态
  // ============================================================
  const CircuitTab = () => {
    const [circuits, setCircuits] = useState<CircuitBreakerStatus[]>([])
    const [loading, setLoading] = useState(false)
    const [resetting, setResetting] = useState<string | null>(null)

    const loadCircuits = useCallback(async () => {
      if (!store.backendConnected) {
        // Mock
        setCircuits(store.models.map((m) => ({
          model_id: m.id, model_name: m.name,
          state: m.id === 'claude-35' ? 'open' : m.id === 'ernie-40' ? 'half_open' : 'closed',
          failure_count: m.id === 'claude-35' ? 5 : m.id === 'ernie-40' ? 2 : 0,
          failure_threshold: 3, recovery_timeout: 60,
          last_failure: m.id === 'claude-35' ? new Date(Date.now() - 300000).toISOString() : null,
          last_error: m.id === 'claude-35' ? 'Connection timeout after 30s' : ''
        })))
        return
      }
      setLoading(true)
      try {
        const api = getApiClient()
        const res = await api.models.circuitBreakers()
        if (res.code === 0) setCircuits((res.data as { items: CircuitBreakerStatus[] })?.items ?? [])
      } catch { /* 降级 */ }
      setLoading(false)
    }, [store.backendConnected])

    useEffect(() => { loadCircuits() }, [loadCircuits])

    const handleReset = async (modelId: string) => {
      setResetting(modelId)
      if (store.backendConnected) {
        const api = getApiClient()
        await api.models.resetCircuitBreaker(modelId)
      }
      setCircuits((prev) => prev.map((c) => (c.model_id === modelId ? { ...c, state: 'closed', failure_count: 0, last_failure: null, last_error: '' } : c)))
      setResetting(null)
    }

    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs text-text-muted">
            {circuits.filter((c) => c.state === 'open').length} 已熔断 · {circuits.filter((c) => c.state === 'half_open').length} 半开 · {circuits.filter((c) => c.state === 'closed').length} 正常
          </div>
          <button onClick={loadCircuits} className="flex items-center gap-1 rounded-lg border border-border-subtle px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {circuits.map((c) => {
            const s = circuitStateMeta[c.state]
            const model = store.models.find((m) => m.id === c.model_id)
            return (
              <div key={c.model_id} className={`rounded-xl border bg-bg-surface/40 p-4 transition-colors hover:border-border ${
                c.state === 'open' ? 'border-red-500/30 bg-red-500/5' : c.state === 'half_open' ? 'border-amber-500/30 bg-amber-500/5' : 'border-border-subtle'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated">
                      <Server className="h-4.5 w-4.5 text-text-muted" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">{model?.name ?? c.model_name}</div>
                      <div className="text-xs text-text-muted">{model?.vendor ?? ''}</div>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 text-xs ${s.color}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-text-muted">失败次数</span>
                    <div className="text-text-primary font-mono">{c.failure_count} / {c.failure_threshold}</div>
                  </div>
                  <div>
                    <span className="text-text-muted">恢复超时</span>
                    <div className="text-text-primary font-mono">{c.recovery_timeout}s</div>
                  </div>
                </div>

                {c.last_error && (
                  <div className="mt-2 rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-300 truncate">
                    {c.last_error}
                  </div>
                )}

                {c.state !== 'closed' && (
                  <button onClick={() => handleReset(c.model_id)} disabled={resetting === c.model_id}
                    className="mt-3 flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300 hover:bg-amber-500/20 transition-colors">
                    {resetting === c.model_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    手动复位
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ============================================================
  // 主渲染
  // ============================================================
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle
        icon={Cpu}
        title="模型网关"
        desc="商用大模型与开源私有化模型双选，按智能体路由绑定。管理 API 密钥池、Token 用量、路由策略与熔断器。"
      />

      {/* Tab 导航 */}
      <div className="mb-6 flex items-center gap-1 rounded-xl border border-border-subtle bg-bg-surface/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      {tab === 'models' && <ModelsTab />}
      {tab === 'keys' && <KeysTab />}
      {tab === 'usage' && <UsageTab />}
      {tab === 'routing' && <RoutingTab />}
      {tab === 'circuit' && <CircuitTab />}
    </div>
  )
}
