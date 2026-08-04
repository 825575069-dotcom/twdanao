import { useState, useCallback, useMemo } from 'react'
import {
  BarChart3,
  LayoutGrid,
  RefreshCw,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Users
} from 'lucide-react'
import { useStore } from '../store/appStore'
import { PageTitle } from './SkillsView'
import { getPlatformDashboard, getOverviewDashboard, type PlatformDashboard, type CoreKpi, type TrendPoint, type CategoryShareItem, type RegionShareItem, type TopProductItem } from '../data/mockDashboard'
import { AGENT_LABELS } from '../lib/constants'
import type { DataBaseConnector, Agent } from '../types'
import RabbitHead from './RabbitHead'

const timeRanges = ['今日', '本周', '本月', '本季度'] as const

export default function DataView() {
  const store = useStore()
  const enabledConnectors = store.dataBaseConnectors.filter((c) => c.enabled)
  const [selectedId, setSelectedId] = useState<string>('overview')
  const [timeRange, setTimeRange] = useState<(typeof timeRanges)[number]>('本月')
  const [refreshing, setRefreshing] = useState(false)
  const [exported, setExported] = useState(false)

  // 按设计稿的 tab 顺序：经营全景 + 已启用的特定类型数据底座
  const platformTabs = useMemo(() => {
    const preferred = ['erp', 'b2b-platform', 'wms', 'bi', 'saas-base']
    const sorted = preferred
      .map((id) => enabledConnectors.find((c) => c.id === id))
      .filter(Boolean) as typeof enabledConnectors
    const others = enabledConnectors.filter((c) => !preferred.includes(c.id))
    return [{ id: 'overview', name: '经营全景', icon: LayoutGrid }, ...sorted, ...others]
  }, [enabledConnectors])

  const dashboard: PlatformDashboard = useMemo(() => {
    return selectedId === 'overview'
      ? getOverviewDashboard(enabledConnectors.map((c) => c.id))
      : getPlatformDashboard(selectedId)
  }, [selectedId, enabledConnectors])

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

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageTitle
        icon={BarChart3}
        title="经营看板"
        desc="经营全景与各数据底座板块统计"
      />

      {/* 工具栏：时间范围 + 刷新 + 导出 */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-surface/60 p-1">
          <Calendar className="ml-2 h-3.5 w-3.5 text-text-muted" />
          {timeRanges.map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`rounded-lg px-3 py-1 text-xs transition-colors ${
                timeRange === r
                  ? 'bg-text-primary text-bg-surface'
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
      <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
        {platformTabs.map((c) => {
          const isOverview = c.id === 'overview'
          const active = selectedId === c.id
          const Icon = c.icon
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                active
                  ? 'border-text-primary bg-text-primary text-bg-surface'
                  : 'border-border-subtle bg-bg-surface text-text-secondary hover:border-border hover:text-text-primary'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="max-w-[140px] truncate">{c.name}</span>
              {isOverview && (
                <span className="ml-0.5 rounded bg-bg-surface px-1.5 py-0 text-[10px] text-text-primary">
                  {enabledConnectors.length}
                </span>
              )}
              {!isOverview && (c as DataBaseConnector).status && (
                <span
                  className={`ml-0.5 h-1.5 w-1.5 rounded-full ${
                    (c as DataBaseConnector).status === 'connected' ? 'bg-emerald-400' : (c as DataBaseConnector).status === 'pending' ? 'bg-amber-400' : 'bg-text-muted'
                  }`}
                />
              )}
            </button>
          )
        })}
        {enabledConnectors.length === 0 && (
          <span className="text-xs text-text-muted">暂无已启用的数据底座，请先到「数据底座」页面开启。</span>
        )}
      </div>

      {/* 核心指标 */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboard.coreKpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      {/* 趋势图 */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="月度销售额趋势（万元）">
          <LineChart data={dashboard.salesTrend} color="#ef4444" />
        </ChartCard>
        <ChartCard title="累计订单量增长趋势">
          <AreaChart data={dashboard.orderTrend} color="#3b82f6" />
        </ChartCard>
      </div>

      {/* 分布图 */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="品类销售占比">
          <DonutChart data={dashboard.categoryShare} />
        </ChartCard>
        <ChartCard title="区域销售分布（万元）">
          <HorizontalBarChart data={dashboard.regionShare} />
        </ChartCard>
      </div>

      {/* Top 5 热销产品 */}
      <div className="mb-5 rounded-xl border border-border-subtle bg-bg-surface/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Top 5 热销产品</h3>
          <span className="text-xs text-text-muted">按销售额排序</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted">
                <th className="pb-2.5 font-medium">排名</th>
                <th className="pb-2.5 font-medium">产品名称</th>
                <th className="pb-2.5 font-medium">销售额</th>
                <th className="pb-2.5 font-medium">销量</th>
                <th className="pb-2.5 font-medium">环比</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.topProducts.map((p) => (
                <TopProductRow key={p.name} product={p} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 智能体贡献看板 */}
      <div className="rounded-xl border border-border-subtle bg-bg-surface/60 p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-soft">
            <Users className="h-3.5 w-3.5 text-accent" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">智能体贡献看板</h3>
          <span className="ml-auto text-xs text-text-muted">{timeRange}数据</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {dashboard.agentContributions.map((ac) => (
            <AgentContributionCard key={ac.code} contribution={ac} agent={store.agents.find((a) => a.code === ac.code)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ kpi }: { kpi: CoreKpi }) {
  const isPositive = kpi.growth >= 0
  const isInverted = kpi.label.includes('周转') // 周转天数下降为好事
  const good = isInverted ? !isPositive : isPositive
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface/60 p-4 transition-shadow hover:shadow-sm">
      <div className="mb-3 text-xs text-text-muted">{kpi.label}</div>
      <div className="mb-2 flex items-baseline gap-1">
        {kpi.prefix && <span className="text-lg font-semibold" style={{ color: kpi.color }}>{kpi.prefix}</span>}
        <span className="text-2xl font-bold tracking-tight" style={{ color: kpi.color }}>{kpi.value}</span>
        {kpi.suffix && <span className="text-sm text-text-muted">{kpi.suffix}</span>}
      </div>
      <div className={`flex items-center gap-1 text-xs ${good ? 'text-emerald-500' : 'text-rose-500'}`}>
        {good ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        <span>{isPositive ? `+${kpi.growth}%` : `${kpi.growth}%`}</span>
        <span className="text-text-muted">{kpi.growthLabel}</span>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface/60 p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">{title}</h3>
      {children}
    </div>
  )
}

function LineChart({ data, color }: { data: TrendPoint[]; color: string }) {
  const width = 100
  const height = 40
  const padding = 4
  const values = data.map((d) => d.value)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2)
    const y = height - padding - ((d.value - min) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')
  const areaPoints = `${points.split(' ')[0]} ${points} ${points.split(' ').pop()}`

  return (
    <div className="relative h-48 w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
        {/* 渐变 */}
        <defs>
          <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 面积 */}
        <polygon
          points={areaPoints.split(' ').map((p, i, arr) => {
            if (i === 0) return `${p.split(',')[0]},${height}`
            if (i === arr.length - 1) return `${p.split(',')[0]},${height}`
            return p
          }).join(' ')}
          fill="url(#lineArea)"
        />
        {/* 折线 */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* 数据点 */}
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2)
          const y = height - padding - ((d.value - min) / range) * (height - padding * 2)
          return <circle key={i} cx={x} cy={y} r="0.8" fill={color} />
        })}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[10px] text-text-muted">
        {data.filter((_, i) => i % 2 === 0).map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

function AreaChart({ data, color }: { data: TrendPoint[]; color: string }) {
  const width = 100
  const height = 40
  const padding = 4
  const values = data.map((d) => d.value)
  const max = Math.max(...values, 1)
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2)
    const y = height - padding - (d.value / max) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="relative h-48 w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon
          points={`${padding},${height} ${points} ${width - padding},${height}`}
          fill="url(#areaFill)"
        />
        <polyline points={points} fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2)
          const y = height - padding - (d.value / max) * (height - padding * 2)
          return <circle key={i} cx={x} cy={y} r="0.7" fill={color} />
        })}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[10px] text-text-muted">
        {data.filter((_, i) => i % 2 === 0).map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
      {/* 最后一个值的标注 */}
      <div className="absolute right-2 top-2 text-xs font-semibold" style={{ color }}>
        {data[data.length - 1]?.value.toLocaleString()}
      </div>
    </div>
  )
}

function DonutChart({ data }: { data: CategoryShareItem[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const radius = 15.9155
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex h-48 items-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          {data.map((d, i) => {
            const dash = (d.value / total) * circumference
            const gap = circumference - dash
            const el = (
              <circle
                key={i}
                cx="21"
                cy="21"
                r={radius}
                fill="transparent"
                stroke={d.color}
                strokeWidth="4"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
              />
            )
            offset += dash
            return el
          })}
        </svg>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
              <span className="text-text-secondary">{d.label}</span>
            </div>
            <span className="font-medium text-text-primary">{d.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HorizontalBarChart({ data }: { data: RegionShareItem[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex h-48 flex-col justify-center gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-xs">
          <span className="w-12 shrink-0 text-text-secondary">{d.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="w-10 text-right font-medium text-text-primary">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

function TopProductRow({ product }: { product: TopProductItem }) {
  const positive = product.growth >= 0
  return (
    <tr className="border-b border-border-subtle/50 last:border-0">
      <td className="py-3 text-text-secondary">{product.rank}</td>
      <td className="py-3">
        <div className="font-medium text-text-primary">{product.name}</div>
        <div className="text-[10px] text-text-muted">{product.spec}</div>
      </td>
      <td className="py-3 font-medium text-text-primary">¥ {product.sales}万</td>
      <td className="py-3 text-text-secondary">{product.volume.toLocaleString()}{product.volumeUnit}</td>
      <td className={`py-3 ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>
        {positive ? '+' : ''}{product.growth}%
      </td>
    </tr>
  )
}

function AgentContributionCard({ contribution, agent }: { contribution: { code: string; name: string; metrics: { label: string; value: string; growth?: number }[] }; agent?: Agent }) {
  const primary = contribution.metrics[0]
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4 transition-shadow hover:shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-bg-elevated">
          <RabbitHead scarfColor={agent?.scarfColor ?? 'darkgreen'} className="h-full w-full" />
        </div>
        <div>
          <div className="text-sm font-medium text-text-primary">{contribution.name}</div>
          <div className="text-[10px] text-text-muted">{AGENT_LABELS[agent?.code ?? 'procurement']}</div>
        </div>
      </div>
      <div className="mb-3">
        <div className="text-[10px] text-text-muted">{primary?.label}</div>
        <div className="text-lg font-bold text-accent">{primary?.value}</div>
        {primary?.growth != null && (
          <div className={`mt-0.5 flex items-center gap-0.5 text-[10px] ${primary.growth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {primary.growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {primary.growth >= 0 ? '+' : ''}{primary.growth}%
          </div>
        )}
      </div>
      <div className="space-y-1.5 border-t border-border-subtle/50 pt-2">
        {contribution.metrics.slice(1).map((m) => (
          <div key={m.label} className="flex items-center justify-between text-xs">
            <span className="text-text-muted">{m.label}</span>
            <span className="font-medium text-text-primary">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
