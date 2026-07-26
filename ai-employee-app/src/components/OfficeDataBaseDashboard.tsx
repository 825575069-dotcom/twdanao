import { useState } from 'react'
import {
  Database,
  Building2,
  ShoppingCart,
  Warehouse,
  BarChart3,
  FileText,
  Cloud,
  CreditCard,
  Truck,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DataBaseConnector } from '../types'
import { useStore, ICON_REGISTRY } from '../store/appStore'

const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  ShoppingCart,
  Warehouse,
  BarChart3,
  Database,
  Cloud,
  CreditCard,
  Truck,
  Users,
  FileText
}

/** 未对接系统（mock，后端可对接后扩展） */
const PENDING_CONNECTORS: Array<{ id: string; name: string; desc: string; icon: LucideIcon }> = [
  {
    id: 'wecom',
    name: '企业微信 SCRM',
    desc: '对接企微客户与群聊数据，支撑营销跟客兔自动触达',
    icon: Users
  },
  {
    id: 'tms',
    name: '物流 TMS',
    desc: '对接承运商物流轨迹，实时同步发货与签收状态',
    icon: Truck
  },
  {
    id: 'finance',
    name: '财务核算系统',
    desc: '对接应收应付、开票与回款数据，辅助经营分析',
    icon: CreditCard
  },
  {
    id: 'cloud-doc',
    name: '云文档知识库',
    desc: '对接企业云文档，自动同步产品资料与培训材料',
    icon: Cloud
  }
]

function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? ICON_REGISTRY[iconName] ?? Database
}

export default function OfficeDataBaseDashboard() {
  const store = useStore()
  const connectors = store.dataBaseConnectors
  const enabled = connectors.filter((c) => c.enabled)
  const connected = connectors.filter((c) => c.status === 'connected' && c.enabled)
  const selectedForChat = store.activeDataBases.length

  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleToggle = (id: string) => {
    setTogglingId(id)
    store.toggleDataBaseConnector(id)
    window.setTimeout(() => setTogglingId(null), 300)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-5">
      {/* 标题 */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">数据底座</h2>
            <p className="text-sm text-text-secondary">
              对接企业 ERP、B2B/B2C 平台及三方系统，AI 通过读取数据底座做决策
            </p>
          </div>
        </div>
      </div>

      {/* 概览统计 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          value={enabled.length}
          total={connectors.length + PENDING_CONNECTORS.length}
          label="已启用系统"
          valueColor="text-text-primary"
        />
        <StatCard
          value={connected.length}
          label="已连接"
          valueColor="text-emerald-400"
        />
        <StatCard
          value={selectedForChat}
          label="当前对话已选"
          valueColor="text-text-primary"
        />
      </div>

      {/* 已对接 */}
      <SectionTitle title="已对接" dot="bg-emerald-400" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {connectors.map((c) => (
          <ConnectorCard
            key={c.id}
            connector={c}
            toggling={togglingId === c.id}
            onToggle={() => handleToggle(c.id)}
          />
        ))}
      </div>

      {/* 未对接 */}
      <SectionTitle title="未对接" dot="bg-text-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PENDING_CONNECTORS.map((c) => (
          <PendingCard key={c.id} item={c} />
        ))}
      </div>
    </div>
  )
}

// ============================================================
// 子组件
// ============================================================

function StatCard({
  value,
  total,
  label,
  valueColor
}: {
  value: number
  total?: number
  label: string
  valueColor: string
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-surface/60 p-5">
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${valueColor}`}>{value}</span>
        {total !== undefined && <span className="text-lg text-text-muted">/ {total}</span>}
      </div>
      <div className="mt-1 text-sm text-text-secondary">{label}</div>
    </div>
  )
}

function SectionTitle({ title, dot }: { title: string; dot: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="text-sm font-semibold text-text-primary">{title}</span>
    </div>
  )
}

function ConnectorCard({
  connector,
  toggling,
  onToggle
}: {
  connector: DataBaseConnector
  toggling: boolean
  onToggle: () => void
}) {
  const Icon = resolveIcon(connector.iconName)
  const isConnected = connector.status === 'connected' && connector.enabled

  return (
    <div className="relative flex flex-col rounded-2xl border border-border-subtle bg-bg-surface/60 p-5 transition-colors hover:border-border-default">
      {/* 顶部：图标 + 开关 */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg-elevated text-text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <button
          onClick={onToggle}
          disabled={toggling}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            connector.enabled ? 'bg-text-primary' : 'bg-border-strong'
          } ${toggling ? 'opacity-70' : ''}`}
          aria-label={connector.enabled ? '关闭' : '开启'}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg-surface shadow transition-transform ${
              connector.enabled ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* 名称与描述 */}
      <h3 className="mb-1 text-base font-semibold text-text-primary">{connector.name}</h3>
      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-text-secondary">{connector.desc}</p>

      {/* 底部状态与时间 */}
      <div className="mt-auto flex items-center justify-between border-t border-border-subtle pt-4">
        <div className="flex items-center gap-1.5 text-xs">
          {isConnected ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">已连接</span>
            </>
          ) : connector.enabled ? (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-amber-400">连接中</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-text-muted" />
              <span className="text-text-muted">已停用</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-text-muted">
          <Clock className="h-3.5 w-3.5" />
          <span>{connector.lastSync}</span>
        </div>
      </div>
    </div>
  )
}

function PendingCard({ item }: { item: { id: string; name: string; desc: string; icon: LucideIcon } }) {
  const Icon = item.icon
  return (
    <div className="relative flex flex-col rounded-2xl border border-border-subtle bg-bg-surface/40 p-5 opacity-70 transition-opacity hover:opacity-100">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-bg-elevated text-text-muted">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-text-primary">{item.name}</h3>
      <p className="line-clamp-2 text-sm leading-relaxed text-text-secondary">{item.desc}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-text-muted">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>未对接</span>
      </div>
    </div>
  )
}
