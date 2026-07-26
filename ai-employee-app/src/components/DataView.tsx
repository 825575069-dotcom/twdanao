import { useState, useCallback, useEffect } from 'react'
import { BarChart3, LayoutGrid, RefreshCw, Download, Calendar, Wifi, Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { useStore } from '../store/appStore'
import { PageTitle, Section } from './SkillsView'
import {
  getPlatformDashboard,
  getOverviewDashboard,
  orderStatus,
  type PlatformDashboard
} from '../data/mockDashboard'
import { getApiClient } from '../lib/api'
import type { DataBaseConnector } from '../types'

const timeRanges = ['今日', '本周', '本月', '本季度'] as const

export default function DataView() {
  const store = useStore()
  const enabledConnectors = store.dataBaseConnectors.filter((c) => c.enabled)
  const [selectedId, setSelectedId] = useState<string>('overview')
  const [timeRange, setTimeRange] = useState<(typeof timeRanges)[number]>('本月')
  const [refreshing, setRefreshing] = useState(false)
  const [exported, setExported] = useState(false)

  const dashboard: PlatformDashboard =
    selectedId === 'overview'
      ? getOverviewDashboard(enabledConnectors.map((c) => c.id))
      : getPlatformDashboard(selectedId)

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
    }, 800)
  }, [])

  const handleExport = useCallback(() => {
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }, [])

  // —— 后端实时数据 ——
  const [backendOverview, setBackendOverview] = useState<Record<string, unknown> | null>(null)
  const [backendKpis, setBackendKpis] = useState<Array<Record<string, unknown>>>([])
  const [backendAlerts, setBackendAlerts] = useState<Array<Record<string, unknown>>>([])
  const [backendProducts, setBackendProducts] = useState<Array<Record<string, unknown>>>([])
  const [backendLoading, setBackendLoading] = useState(false)

  const loadBackendData = useCallback(async () => {
    setBackendLoading(true)
    const client = getApiClient()
    try {
      const [ovResp, kpiResp, alertResp, prodResp] = await Promise.all([
        client.dashboard.overview(),
        client.dashboard.kpi(),
        client.dashboard.alerts(),
        client.data.products()
      ])
      if (ovResp.code === 0) setBackendOverview(ovResp.data as Record<string, unknown>)
      if (kpiResp.code === 0) setBackendKpis(((kpiResp.data as Record<string, unknown>)?.items ?? []) as Array<Record<string, unknown>>)
      if (alertResp.code === 0) setBackendAlerts(((alertResp.data as Record<string, unknown>)?.items ?? []) as Array<Record<string, unknown>>)
      if (prodResp.code === 0) setBackendProducts(((prodResp.data as Record<string, unknown>)?.items ?? []) as Array<Record<string, unknown>>)
    } catch {
      // 后端不可达
    }
    setBackendLoading(false)
  }, [])

  useEffect(() => {
    loadBackendData()
  }, [loadBackendData])

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle
        icon={BarChart3}
        title={`数据看板 · ${dashboard.platformName}`}
        desc="根据已对接的数据底座切换平台看板，总览聚合全平台经营关键指标。"
      />

      {/* 后端实时数据面板（第二层天网大脑） */}
      {store.backendConnected && (
        <div className="mb-6 overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between border-b border-emerald-500/15 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-300">天网大脑实时数据</span>
              <span className="text-[10px] text-emerald-400/60">来自第二层 Django 后端 API</span>
            </div>
            <button
              onClick={loadBackendData}
              disabled={backendLoading}
              className="flex items-center gap-1 text-[10px] text-emerald-400/80 hover:text-emerald-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${backendLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>

          <div className="p-4">
            {backendLoading && backendOverview === null ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                <span className="ml-2 text-xs text-emerald-400/60">加载中...</span>
              </div>
            ) : (
              <>
                {/* Overview 指标 */}
                {backendOverview && (
                  <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
                    {[
                      { label: '今日营收', value: backendOverview.revenue as Record<string, unknown> },
                      { label: '今日订单', value: backendOverview.orders as Record<string, unknown> },
                      { label: '活跃客户', value: backendOverview.customers as Record<string, unknown> },
                      { label: '库存SKU', value: backendOverview.inventory as Record<string, unknown> },
                      { label: '智能体调用', value: backendOverview.agents as Record<string, unknown> },
                    ].map((item) => {
                      const v = item.value
                      return (
                        <div key={item.label} className="rounded-lg border border-emerald-500/10 bg-bg-surface/40 p-2.5">
                          <div className="text-[10px] text-text-muted">{item.label}</div>
                          <div className="mt-0.5 text-sm font-semibold text-text-primary">
                            {v?.today != null ? `¥${Number(v.today).toLocaleString()}` :
                             v?.total != null ? Number(v.total).toLocaleString() :
                             v?.totalSku != null ? Number(v.totalSku).toLocaleString() :
                             v?.todayRuns != null ? `${v.todayRuns} / ${v.totalRuns ?? 0}` : '-'}
                          </div>
                          {v?.growth != null && (
                            <div className={`flex items-center gap-0.5 text-[10px] ${String(v.growth).startsWith('+') ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {String(v.growth).startsWith('+') ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                              {v.growth as string}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* KPI 指标 */}
                {backendKpis.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-1.5 text-[10px] font-medium text-text-muted">KPI 达成率</div>
                    <div className="space-y-1.5">
                      {backendKpis.map((k, i) => {
                        const growth = String(k.growth ?? '')
                        const isPositive = growth.startsWith('+')
                        return (
                          <div key={i} className="flex items-center gap-3 rounded-lg border border-border-subtle/50 bg-bg-surface/30 px-3 py-1.5">
                            <span className="w-20 shrink-0 text-xs text-text-secondary">{k.label as string}</span>
                            <span className="text-sm font-medium text-text-primary">
                              {Number(k.value).toLocaleString()}{k.unit as string}
                            </span>
                            <span className={`flex items-center gap-0.5 text-[10px] ${isPositive ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                              {growth}
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-bg-elevated">
                                <div
                                  className={`h-full rounded-full ${Number(String(k.rate).replace('%', '')) >= 100 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                  style={{ width: `${Math.min(100, Number(String(k.rate).replace('%', '')))}%` }}
                                />
                              </div>
                              <span className="w-10 text-right text-[10px] text-text-muted">{k.rate as string}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 预警 */}
                {backendAlerts.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-1.5 text-[10px] font-medium text-text-muted">实时预警</div>
                    <div className="space-y-1">
                      {backendAlerts.slice(0, 4).map((a, i) => (
                        <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                          a.level === '高' ? 'border-rose-500/20 bg-rose-500/5' :
                          a.level === '中' ? 'border-amber-500/15 bg-amber-500/5' :
                          'border-border-subtle bg-bg-surface/30'
                        }`}>
                          <AlertTriangle className={`h-3 w-3 shrink-0 ${
                            a.level === '高' ? 'text-rose-400' :
                            a.level === '中' ? 'text-amber-400' : 'text-text-muted'
                          }`} />
                          <span className="text-text-secondary">{a.msg as string}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-text-muted">{a.time as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 商品列表 */}
                {backendProducts.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-medium text-text-muted">商品列表（来自 /data/products）</div>
                    <div className="overflow-hidden rounded-lg border border-border-subtle/50">
                      <div className="flex items-center gap-2 border-b border-border-subtle/50 bg-bg-surface/40 px-3 py-1.5 text-[10px] text-text-muted">
                        <div className="w-24">商品名</div>
                        <div className="flex-1">规格</div>
                        <div className="w-16 text-right">价格</div>
                        <div className="w-16 text-right">库存</div>
                        <div className="w-16 text-right">状态</div>
                      </div>
                      {backendProducts.slice(0, 6).map((p, i) => (
                        <div key={i} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${i !== Math.min(5, backendProducts.length - 1) ? 'border-b border-border-subtle/30' : ''} bg-bg-surface/20`}>
                          <div className="w-24 truncate text-text-primary">{p.name as string}</div>
                          <div className="flex-1 truncate text-text-muted">{p.spec as string}</div>
                          <div className="w-16 text-right text-text-secondary">¥{p.price as number}</div>
                          <div className="w-16 text-right text-text-secondary">{p.stock as number}</div>
                          <div className={`w-16 text-right ${p.status === '库存预警' ? 'text-rose-400' : 'text-emerald-400'}`}>{p.status as string}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 工具栏：时间范围 + 刷新 + 导出 */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-surface/60 p-1">
          <Calendar className="ml-2 h-3.5 w-3.5 text-text-muted" />
          {timeRanges.map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                timeRange === r
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-surface/60 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '刷新中…' : '刷新数据'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-surface/60 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            <Download className="h-3.5 w-3.5" />
            {exported ? '已导出' : '导出报表'}
          </button>
        </div>
      </div>
      {exported && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-xs text-emerald-400">
          ✅ 报表已导出到下载目录（{dashboard.platformName}_{timeRange}.csv）
        </div>
      )}

      {/* 平台切换 Tab */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
        <PlatformTab
          active={selectedId === 'overview'}
          onClick={() => setSelectedId('overview')}
          icon={LayoutGrid}
          label="经营全景"
          badge={enabledConnectors.length}
        />
        {enabledConnectors.map((c) => (
          <PlatformTab
            key={c.id}
            active={selectedId === c.id}
            onClick={() => setSelectedId(c.id)}
            icon={c.icon}
            label={c.name}
            status={c.status}
          />
        ))}
        {enabledConnectors.length === 0 && (
          <span className="text-xs text-text-muted">暂无已启用的数据底座，请先到「数据底座」页面开启。</span>
        )}
      </div>

      {/* 核心指标 */}
      <Section title="核心指标">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {dashboard.kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-border-subtle bg-bg-surface/60 p-4">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated">
                <k.icon className="h-4 w-4 text-accent" />
              </div>
              <div className="text-lg font-semibold text-text-primary">{k.value}</div>
              <div className="text-xs text-text-muted">{k.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 各商品库存分布 */}
      {dashboard.stockBySku && dashboard.stockBySku.length > 0 && (
        <Section title="各商品库存分布">
          <div className="space-y-2.5 rounded-xl border border-border-subtle bg-bg-surface/60 p-5">
            {(() => {
              const maxStock = Math.max(1, ...dashboard.stockBySku.map((s) => s.stock))
              return dashboard.stockBySku.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-xs text-text-secondary">{s.name}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent/50 to-accent"
                      style={{ width: `${(s.stock / maxStock) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs text-text-muted">{s.stock.toLocaleString()}</span>
                </div>
              ))
            })()}
          </div>
        </Section>
      )}

      {/* 近期订单 */}
      {dashboard.orders && dashboard.orders.length > 0 && (
        <Section title={`近期订单（${dashboard.orders.length}）`}>
          <div className="overflow-hidden rounded-xl border border-border-subtle">
            <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-surface/60 px-4 py-2.5 text-xs text-text-muted">
              <div className="w-24">订单号</div>
              <div className="flex-1">商品</div>
              <div className="w-16 text-right">数量</div>
              <div className="hidden w-32 sm:block">供应商</div>
              <div className="w-20 text-right">状态</div>
            </div>
            {dashboard.orders.map((o, i) => {
              const st = orderStatus[o.status]
              return (
                <div
                  key={`${o.id}-${i}`}
                  className={`flex items-center gap-3 px-4 py-2.5 ${
                    i !== dashboard.orders!.length - 1 ? 'border-b border-border-subtle' : ''
                  } bg-bg-surface/30`}
                >
                  <div className="w-24 font-mono text-xs text-text-secondary">{o.id}</div>
                  <div className="min-w-0 flex-1 truncate text-sm text-text-primary">{o.productName}</div>
                  <div className="w-16 text-right text-sm text-text-secondary">{o.qty}</div>
                  <div className="hidden w-32 truncate text-xs text-text-muted sm:block">
                    {o.supplier ?? '-'}
                  </div>
                  <div className={`w-20 text-right text-xs ${st.color}`}>{st.label}</div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* 库存预警 */}
      {dashboard.shortages && dashboard.shortages.length > 0 && (
        <Section title="库存预警（低于安全库存）">
          <div className="overflow-hidden rounded-xl border border-rose-500/25">
            <div className="flex items-center gap-3 border-b border-border-subtle bg-rose-500/5 px-4 py-2.5 text-xs text-text-muted">
              <div className="flex-1">商品 / 仓库</div>
              <div className="w-20 text-right">当前</div>
              <div className="w-20 text-right">安全线</div>
              <div className="w-20 text-right">缺口</div>
            </div>
            {dashboard.shortages.map((s, i) => (
              <div
                key={`${s.sku}-${s.warehouse}-${i}`}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  i !== dashboard.shortages!.length - 1 ? 'border-b border-border-subtle' : ''
                } bg-bg-surface/30`}
              >
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-text-primary">{s.productName}</span>
                  <span className="text-xs text-text-muted">· {s.warehouse}</span>
                </div>
                <div className="w-20 text-right text-sm text-rose-300">{s.stock}</div>
                <div className="w-20 text-right text-xs text-text-muted">{s.safetyStock}</div>
                <div className="w-20 text-right text-sm text-text-primary">
                  {s.safetyStock - s.stock} {s.unit}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 流向监控 */}
      {dashboard.flows && dashboard.flows.length > 0 && (
        <Section title="流向监控 · 窜货预警">
          <div className="space-y-2">
            {dashboard.flows.map((f) => (
              <div
                key={f.id}
                className={`flex items-center gap-3 rounded-xl border p-3.5 ${
                  f.abnormal ? 'border-rose-500/30 bg-rose-500/5' : 'border-border-subtle bg-bg-surface/40'
                }`}
              >
                <span className={`text-base ${f.abnormal ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {f.abnormal ? '🚨' : '📍'}
                </span>
                <div className="flex-1 text-sm text-text-secondary">
                  <span className="text-text-primary">{f.productName}</span> · {f.fromRegion} → {f.toRegion} ·{' '}
                  {f.qty} 件
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                    f.abnormal ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'
                  }`}
                >
                  {f.abnormal ? '窜货异常' : '正常'}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 智能洞察 */}
      {dashboard.insights.length > 0 && (
        <Section title="智能洞察（由数据底座推导）">
          <div className="space-y-2">
            {dashboard.insights.map((ins, i) => (
              <Insight key={i} tag={ins.tag} warn={ins.warn} text={ins.text} />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function PlatformTab({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
  status
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
  badge?: number
  status?: DataBaseConnector['status']
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-all ${
        active
          ? 'border-text-primary bg-text-primary text-bg-surface'
          : 'border-border-subtle bg-bg-surface text-text-secondary hover:border-border hover:text-text-primary'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="max-w-[120px] truncate">{label}</span>
      {badge !== undefined && (
        <span className="ml-0.5 rounded bg-bg-surface px-1 py-0 text-[10px] text-text-primary">{badge}</span>
      )}
      {status && (
        <span
          className={`ml-0.5 h-1.5 w-1.5 rounded-full ${
            status === 'connected' ? 'bg-emerald-400' : status === 'pending' ? 'bg-amber-400' : 'bg-text-muted'
          }`}
        />
      )}
    </button>
  )
}

function Insight({ text, tag, warn }: { text: string; tag: string; warn?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-surface/40 p-3.5">
      <span
        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
          warn ? 'bg-rose-500/10 text-rose-300' : 'bg-accent-soft text-accent'
        }`}
      >
        {tag}
      </span>
      <span className="text-sm leading-relaxed text-text-secondary">{text}</span>
    </div>
  )
}
