import { useState, useEffect, useCallback } from 'react'
import {
  ShieldAlert, FileText, Settings, AlertTriangle, TrendingUp,
  RefreshCw, Lock, Ban, CheckCircle,
  Filter
} from 'lucide-react'
import { getApiClient } from '../lib/api'
import { useStore } from '../store/appStore'
import type { AuditLog, SecurityOverview, SecurityConfig, AccessControlRule, SecurityEvent } from '../types'

type Tab = 'overview' | 'logs' | 'config' | 'rules' | 'events'

export default function SecurityView() {
  const store = useStore()
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState<SecurityOverview | null>(null)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [logStats, setLogStats] = useState<{ total: number; today: number; high_risk: number } | null>(null)
  const [config, setConfig] = useState<SecurityConfig | null>(null)
  const [rules, setRules] = useState<AccessControlRule[]>([])
  const [events, setEvents] = useState<SecurityEvent[]>([])

  const connected = store.backendConnected

  const fetchOverview = useCallback(async () => {
    if (!connected) return
    setLoading(true)
    try {
      const resp = await getApiClient().security.overview()
      if (resp.code === 0 && resp.data) setOverview(resp.data as SecurityOverview)
    } catch { /* ignore */ }
    setLoading(false)
  }, [connected])

  const fetchLogs = useCallback(async () => {
    if (!connected) return
    setLoading(true)
    try {
      const [logResp, statsResp] = await Promise.all([
        getApiClient().security.auditLogs({ page: 1, page_size: 50 }),
        getApiClient().security.auditStats(),
      ])
      if (logResp.code === 0 && logResp.data) {
        setLogs((logResp.data as { items: AuditLog[] }).items)
      }
      if (statsResp.code === 0 && statsResp.data) {
        const d = statsResp.data as { total: number; today: number; high_risk: number }
        setLogStats(d)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [connected])

  const fetchConfig = useCallback(async () => {
    if (!connected) return
    setLoading(true)
    try {
      const resp = await getApiClient().security.config()
      if (resp.code === 0 && resp.data) setConfig(resp.data as SecurityConfig)
    } catch { /* ignore */ }
    setLoading(false)
  }, [connected])

  const fetchRules = useCallback(async () => {
    if (!connected) return
    setLoading(true)
    try {
      const resp = await getApiClient().security.accessRules()
      if (resp.code === 0 && resp.data) setRules((resp.data as { items: AccessControlRule[] }).items)
    } catch { /* ignore */ }
    setLoading(false)
  }, [connected])

  const fetchEvents = useCallback(async () => {
    if (!connected) return
    setLoading(true)
    try {
      const resp = await getApiClient().security.events({ page: 1, page_size: 50 })
      if (resp.code === 0 && resp.data) setEvents((resp.data as { items: SecurityEvent[] }).items)
    } catch { /* ignore */ }
    setLoading(false)
  }, [connected])

  useEffect(() => {
    if (tab === 'overview') fetchOverview()
    else if (tab === 'logs') fetchLogs()
    else if (tab === 'config') fetchConfig()
    else if (tab === 'rules') fetchRules()
    else if (tab === 'events') fetchEvents()
  }, [tab, fetchOverview, fetchLogs, fetchConfig, fetchRules, fetchEvents])

  const tabs: { key: Tab; label: string; icon: typeof ShieldAlert }[] = [
    { key: 'overview', label: '安全概览', icon: TrendingUp },
    { key: 'logs', label: '审计日志', icon: FileText },
    { key: 'config', label: '安全配置', icon: Settings },
    { key: 'rules', label: '访问控制', icon: Lock },
    { key: 'events', label: '安全事件', icon: AlertTriangle },
  ]

  if (!connected) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">安全审计需要连接天网大脑后端</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* 标题栏 */}
      <div className="flex h-14 shrink-0 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-rose-400" />
          <h1 className="text-[15px] font-medium text-text-primary">安全审计</h1>
        </div>
        <button
          onClick={() => {
            if (tab === 'overview') fetchOverview()
            else if (tab === 'logs') fetchLogs()
            else if (tab === 'config') fetchConfig()
            else if (tab === 'rules') fetchRules()
            else if (tab === 'events') fetchEvents()
          }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-hover"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* Tab 栏 */}
      <div className="flex shrink-0 gap-1 px-6 pb-3">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                tab === t.key
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {tab === 'overview' && <OverviewTab overview={overview} loading={loading} />}
        {tab === 'logs' && <LogsTab logs={logs} stats={logStats} loading={loading} />}
        {tab === 'config' && <ConfigTab config={config} loading={loading} onSave={fetchConfig} />}
        {tab === 'rules' && <RulesTab rules={rules} loading={loading} />}
        {tab === 'events' && <EventsTab events={events} loading={loading} onRefresh={fetchEvents} />}
      </div>
    </div>
  )
}

/* ========== 概览 Tab ========== */
function OverviewTab({ overview, loading }: { overview: SecurityOverview | null; loading: boolean }) {
  if (loading && !overview) return <div className="py-20 text-center text-sm text-text-muted">加载中...</div>
  if (!overview) return <div className="py-20 text-center text-sm text-text-muted">暂无数据</div>

  const stats = overview.stats
  const riskColors: Record<string, string> = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-orange-400',
    critical: 'text-rose-400',
  }

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="审计日志总数" value={stats.total_audit_logs} icon={FileText} color="text-blue-400" />
        <StatCard label="高风险操作" value={stats.high_risk_logs} icon={AlertTriangle} color="text-rose-400" />
        <StatCard label="未处理事件" value={stats.unresolved_events} icon={AlertTriangle} color="text-orange-400" />
        <StatCard label="24h活动" value={stats.recent_logs_24h} icon={TrendingUp} color="text-emerald-400" />
      </div>

      {/* 安全配置概览 */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
        <h3 className="mb-3 text-sm font-medium text-text-primary">安全配置状态</h3>
        <div className="grid grid-cols-3 gap-3">
          <ConfigBadge label="操作审计" enabled={overview.config.audit_enabled} />
          <ConfigBadge label="数据隔离" enabled={overview.config.data_isolation} />
          <ConfigBadge label="手机号脱敏" enabled={overview.config.mask_phone} />
          <ConfigBadge label="身份证脱敏" enabled={overview.config.mask_id_card} />
          <ConfigBadge label="银行卡脱敏" enabled={overview.config.mask_bank_card} />
          <ConfigBadge label="邮箱脱敏" enabled={overview.config.mask_email} />
          <ConfigBadge label="请求签名" enabled={overview.config.request_sign_enabled} />
          <ConfigBadge label="API限流" enabled={overview.config.rate_limit_enabled} />
          <ConfigBadge label="限流/分钟" value={`${overview.config.rate_limit_per_minute}`} />
        </div>
      </div>

      {/* 安全事件统计 */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
        <h3 className="mb-3 text-sm font-medium text-text-primary">安全事件分布</h3>
        {Object.keys(overview.events_by_severity).length === 0 ? (
          <p className="text-sm text-text-muted">暂无安全事件</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(overview.events_by_severity).map(([sev, count]) => (
              <div key={sev} className="flex items-center justify-between">
                <span className={`text-sm font-medium ${riskColors[sev] || 'text-text-secondary'}`}>
                  {sev === 'low' ? '低风险' : sev === 'medium' ? '中风险' : sev === 'high' ? '高风险' : '严重'}
                </span>
                <span className="text-sm text-text-secondary">{count} 起</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof FileText; color: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
      <Icon className={`h-5 w-5 ${color}`} />
      <div className="mt-2 text-2xl font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  )
}

function ConfigBadge({ label, enabled, value }: { label: string; enabled?: boolean; value?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2">
      {value ? (
        <span className="text-xs font-medium text-text-primary">{label}: {value}</span>
      ) : enabled ? (
        <>
          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs text-text-secondary">{label}</span>
        </>
      ) : (
        <>
          <Ban className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-xs text-text-muted">{label}</span>
        </>
      )}
    </div>
  )
}

/* ========== 审计日志 Tab ========== */
function LogsTab({ logs, stats, loading }: { logs: AuditLog[]; stats: { total: number; today: number; high_risk: number } | null; loading: boolean }) {
  const [actionFilter, setActionFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')

  const filtered = logs.filter((l) => {
    if (actionFilter && l.action !== actionFilter) return false
    if (riskFilter && l.risk_level !== riskFilter) return false
    return true
  })

  const riskColors: Record<string, string> = {
    low: 'bg-emerald-500/10 text-emerald-400',
    medium: 'bg-amber-500/10 text-amber-400',
    high: 'bg-orange-500/10 text-orange-400',
    critical: 'bg-rose-500/10 text-rose-400',
  }

  const actionLabels: Record<string, string> = {
    login: '登录', logout: '登出', create: '创建', update: '更新', delete: '删除',
    query: '查询', export: '导出', upload: '上传', download: '下载',
    config_change: '配置变更', permission_change: '权限变更', data_access: '数据访问', api_call: 'API调用', security_event: '安全事件',
  }

  if (loading && logs.length === 0) return <div className="py-20 text-center text-sm text-text-muted">加载中...</div>

  return (
    <div className="space-y-3">
      {/* 统计 */}
      {stats && (
        <div className="flex gap-4 text-sm">
          <span className="text-text-secondary">总日志: <span className="font-semibold text-text-primary">{stats.total}</span></span>
          <span className="text-text-secondary">今日: <span className="font-semibold text-text-primary">{stats.today}</span></span>
          <span className="text-text-secondary">高风险: <span className="font-semibold text-rose-400">{stats.high_risk}</span></span>
        </div>
      )}

      {/* 筛选器 */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-text-muted" />
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs text-text-primary">
          <option value="">全部操作</option>
          {Object.entries(actionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs text-text-primary">
          <option value="">全部风险</option>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="critical">严重</option>
        </select>
      </div>

      {/* 日志列表 */}
      <div className="overflow-hidden rounded-xl border border-border-subtle">
        <table className="w-full text-xs">
          <thead className="bg-bg-elevated text-text-muted">
            <tr>
              <th className="px-3 py-2 text-left">时间</th>
              <th className="px-3 py-2 text-left">用户</th>
              <th className="px-3 py-2 text-left">操作</th>
              <th className="px-3 py-2 text-left">路径</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">耗时</th>
              <th className="px-3 py-2 text-left">风险</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {filtered.map((log) => (
              <tr key={log.id} className="bg-bg-surface hover:bg-bg-elevated/50">
                <td className="px-3 py-2 text-text-muted whitespace-nowrap">{new Date(log.created_at).toLocaleString('zh-CN')}</td>
                <td className="px-3 py-2 text-text-primary">{log.user_name || '-'}</td>
                <td className="px-3 py-2 text-text-secondary">{actionLabels[log.action] || log.action}</td>
                <td className="px-3 py-2 text-text-muted max-w-[200px] truncate">{log.path}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${log.response_status < 400 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {log.response_status}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-muted">{log.duration_ms}ms</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${riskColors[log.risk_level] || ''}`}>
                    {log.risk_level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <div className="py-10 text-center text-sm text-text-muted">暂无日志记录</div>}
    </div>
  )
}

/* ========== 安全配置 Tab ========== */
function ConfigTab({ config, loading, onSave }: { config: SecurityConfig | null; loading: boolean; onSave: () => void }) {
  const [saving, setSaving] = useState(false)
  const [local, setLocal] = useState<SecurityConfig | null>(config)

  useEffect(() => { setLocal(config) }, [config])

  if (loading && !config) return <div className="py-20 text-center text-sm text-text-muted">加载中...</div>
  if (!local) return <div className="py-20 text-center text-sm text-text-muted">暂无配置</div>

  const toggle = (key: keyof SecurityConfig) => {
    setLocal({ ...local, [key]: !local[key] })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const resp = await getApiClient().security.updateConfig(local)
      if (resp.code === 0) onSave()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const toggles: { key: keyof SecurityConfig; label: string; desc: string }[] = [
    { key: 'audit_enabled', label: '操作审计', desc: '记录所有API请求到审计日志' },
    { key: 'data_isolation', label: '数据隔离', desc: '按租户隔离数据，禁止跨租户访问' },
    { key: 'mask_phone', label: '手机号脱敏', desc: '138****8888' },
    { key: 'mask_id_card', label: '身份证脱敏', desc: '110***********1234' },
    { key: 'mask_bank_card', label: '银行卡脱敏', desc: '6222***********1234' },
    { key: 'mask_email', label: '邮箱脱敏', desc: 'z***@example.com' },
    { key: 'mask_name', label: '姓名脱敏', desc: '张**' },
    { key: 'request_sign_enabled', label: '请求签名', desc: 'API请求需携带签名验证' },
    { key: 'rate_limit_enabled', label: 'API限流', desc: '限制每分钟请求次数' },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
        <h3 className="mb-3 text-sm font-medium text-text-primary">脱敏与安全策略</h3>
        <div className="space-y-2">
          {toggles.map((t) => (
            <div key={t.key} className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2.5">
              <div>
                <div className="text-sm text-text-primary">{t.label}</div>
                <div className="text-[11px] text-text-muted">{t.desc}</div>
              </div>
              <button
                onClick={() => toggle(t.key)}
                className={`relative h-5 w-9 rounded-full transition-colors ${local[t.key] ? 'bg-accent' : 'bg-bg-hover'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${local[t.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs text-text-secondary">限流/分钟:</label>
          <input
            type="number"
            value={local.rate_limit_per_minute}
            onChange={(e) => setLocal({ ...local, rate_limit_per_minute: parseInt(e.target.value) || 60 })}
            className="w-24 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-1 text-xs text-text-primary"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        保存配置
      </button>
    </div>
  )
}

/* ========== 访问控制 Tab ========== */
function RulesTab({ rules, loading }: { rules: AccessControlRule[]; loading: boolean }) {
  if (loading && rules.length === 0) return <div className="py-20 text-center text-sm text-text-muted">加载中...</div>

  const typeLabels: Record<string, string> = {
    ip_whitelist: 'IP白名单', ip_blacklist: 'IP黑名单', time_restriction: '时间限制', api_restriction: 'API限制', data_restriction: '数据限制',
  }
  const actionColors: Record<string, string> = {
    allow: 'bg-emerald-500/10 text-emerald-400', deny: 'bg-rose-500/10 text-rose-400', warn: 'bg-amber-500/10 text-amber-400',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">共 {rules.length} 条规则</p>
      </div>
      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-xl border border-border-subtle bg-bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-text-secondary" />
                <span className="text-sm font-medium text-text-primary">{rule.name}</span>
                <span className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-muted">{typeLabels[rule.rule_type] || rule.rule_type}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${actionColors[rule.action] || ''}`}>{rule.action}</span>
                {rule.enabled ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Ban className="h-3.5 w-3.5 text-text-muted" />}
              </div>
            </div>
            <div className="mt-2 text-xs text-text-muted">
              匹配模式: <code className="rounded bg-bg-hover px-1 py-0.5 font-mono">{rule.pattern}</code>
            </div>
            {rule.description && <div className="mt-1 text-xs text-text-muted">{rule.description}</div>}
          </div>
        ))}
      </div>
      {rules.length === 0 && <div className="py-10 text-center text-sm text-text-muted">暂无访问控制规则</div>}
    </div>
  )
}

/* ========== 安全事件 Tab ========== */
function EventsTab({ events, loading, onRefresh }: { events: SecurityEvent[]; loading: boolean; onRefresh: () => void }) {
  if (loading && events.length === 0) return <div className="py-20 text-center text-sm text-text-muted">加载中...</div>

  const severityColors: Record<string, string> = {
    low: 'border-l-emerald-400', medium: 'border-l-amber-400', high: 'border-l-orange-400', critical: 'border-l-rose-400',
  }
  const severityLabels: Record<string, string> = {
    low: '低', medium: '中', high: '高', critical: '严重',
  }
  const typeLabels: Record<string, string> = {
    brute_force: '暴力破解', rate_limit_exceeded: '限流触发', unauthorized_access: '越权访问',
    sensitive_data: '敏感数据访问', abnormal_export: '异常导出', injection_attempt: '注入攻击', signature_invalid: '签名验证失败',
  }

  const handleResolve = async (eventId: string) => {
    try {
      const resp = await getApiClient().security.resolveEvent(eventId, '已处理')
      if (resp.code === 0) onRefresh()
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">共 {events.length} 起安全事件</p>
      <div className="space-y-2">
        {events.map((event) => (
          <div key={event.id} className={`rounded-xl border border-border-subtle border-l-4 bg-bg-surface p-4 ${severityColors[event.severity] || ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-text-secondary" />
                <span className="text-sm font-medium text-text-primary">{typeLabels[event.event_type] || event.event_type}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                  event.severity === 'critical' ? 'bg-rose-500/10 text-rose-400' :
                  event.severity === 'high' ? 'bg-orange-500/10 text-orange-400' :
                  event.severity === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-emerald-500/10 text-emerald-400'
                }`}>{severityLabels[event.severity]}</span>
                {event.resolved && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">已处理</span>}
              </div>
              <span className="text-[11px] text-text-muted">{new Date(event.created_at).toLocaleString('zh-CN')}</span>
            </div>
            <p className="mt-2 text-xs text-text-secondary">{event.description}</p>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-text-muted">
              {event.user_name && <span>用户: {event.user_name}</span>}
              {event.ip_address && <span>IP: {event.ip_address}</span>}
            </div>
            {!event.resolved && (
              <button
                onClick={() => handleResolve(event.id)}
                className="mt-2 flex items-center gap-1 rounded-lg bg-accent/10 px-2.5 py-1 text-xs text-accent transition-colors hover:bg-accent/20"
              >
                <CheckCircle className="h-3 w-3" />
                标记为已处理
              </button>
            )}
          </div>
        ))}
      </div>
      {events.length === 0 && <div className="py-10 text-center text-sm text-text-muted">暂无安全事件 🎉</div>}
    </div>
  )
}
