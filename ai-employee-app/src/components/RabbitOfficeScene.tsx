import { useState } from 'react'
import {
  Globe,
  ChevronRight,
  Database,
  FileText,
  Image
} from 'lucide-react'
import type { Agent } from '../types'
import { useStore } from '../store/appStore'
import RabbitHead from './RabbitHead'
import AgentConfigPanel from './AgentConfigPanel'

type ViewTab = 'office' | 'capabilities'

interface Props {
  control: Agent
  business: Agent[]
}

export default function RabbitOfficeScene({ control, business }: Props) {
  const store = useStore()
  const [tab, setTab] = useState<ViewTab>('office')
  const [configAgentId, setConfigAgentId] = useState<string | null>(null)

  const configAgent = configAgentId
    ? store.agents.find((a) => a.id === configAgentId) ?? null
    : null

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="shrink-0 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-elevated text-text-secondary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">AI办公室</h2>
              <p className="text-sm text-text-secondary">欢迎老板莅临办公室视察指导工作</p>
            </div>
          </div>

          {/* 标签切换：AI 办公室 / AI 能力配置 */}
          <div className="flex rounded-xl border border-border-subtle bg-bg-elevated p-1">
            <button
              onClick={() => setTab('office')}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === 'office'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              AI 办公室
            </button>
            <button
              onClick={() => setTab('capabilities')}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === 'capabilities'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              AI 能力配置
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {tab === 'office' ? (
          <OfficeScene control={control} business={business} onConfigAgent={setConfigAgentId} />
        ) : (
          <CapabilityGrid control={control} business={business} onConfigAgent={setConfigAgentId} />
        )}
      </div>

      {/* 智能体配置面板 */}
      {configAgent && <AgentConfigPanel agent={configAgent} onClose={() => setConfigAgentId(null)} />}
    </div>
  )
}

// ============================================================
// AI 办公室：可视化工位场景
// ============================================================
function OfficeScene({
  control,
  business,
  onConfigAgent
}: {
  control: Agent
  business: Agent[]
  onConfigAgent: (id: string) => void
}) {
  const agents = [control, ...business]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <OfficeDesk key={agent.id} agent={agent} onClick={() => onConfigAgent(agent.id)} />
      ))}
    </div>
  )
}

const CONFIG_ITEMS = [
  { key: 'data', label: '未配置', icon: Database, bound: (a: Agent) => a.boundDataBases.length },
  { key: 'doc', label: '未配置', icon: FileText, bound: (a: Agent) => a.boundDocs.length },
  { key: 'image', label: '未配置', icon: Image, bound: (a: Agent) => a.boundImages.length }
] as const

function OfficeDesk({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const isManager = agent.id === 'control'

  return (
    <div
      onClick={onClick}
      className={`group flex cursor-pointer flex-col rounded-2xl border bg-bg-surface p-4 transition-all hover:shadow-lg ${
        isManager
          ? 'border-accent/40 ring-1 ring-accent/10 hover:border-accent/60'
          : 'border-border-subtle hover:border-accent/30'
      }`}
    >
      {/* 上半部分：头像 + 信息 */}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated p-1">
          <RabbitHead agentId={agent.id} className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-base font-semibold ${isManager ? 'text-accent' : 'text-text-primary'}`}>
            {agent.name}
          </div>
          <div className="mt-0.5 text-xs text-accent">{agent.role}</div>
          <div className="mt-1.5 text-xs leading-relaxed text-text-secondary line-clamp-2">
            {agent.description}
          </div>
        </div>
      </div>

      {/* 底部：配置状态 + 步数 + 去配置 */}
      <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
        <div className="flex items-center gap-3">
          {CONFIG_ITEMS.map(({ key, label, icon: Icon, bound }) => {
            const count = bound(agent)
            const isConfigured = count > 0
            return (
              <div key={key} className="flex items-center gap-1 text-[10px] text-text-muted">
                <Icon className="h-3.5 w-3.5" />
                <span>{isConfigured ? `${count} 项` : label}</span>
              </div>
            )
          })}
          <div className="flex items-center gap-1 text-[10px] text-text-muted">
            <span>{agent.workflow.length} 步</span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          className="text-xs font-medium text-accent transition-colors hover:underline"
        >
          去配置
        </button>
      </div>
    </div>
  )
}

// ============================================================
// AI 能力配置：卡片网格
// ============================================================
function CapabilityGrid({
  control,
  business,
  onConfigAgent
}: {
  control: Agent
  business: Agent[]
  onConfigAgent: (id: string) => void
}) {
  const store = useStore()

  return (
    <div className="space-y-5">
      {/* 经理兔：全宽卡片 */}
      <ManagerCapabilityCard agent={control} onConfig={() => onConfigAgent(control.id)} />

      {/* 业务智能体：三列网格 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {business.map((agent) => (
          <CapabilityCard
            key={agent.id}
            agent={agent}
            onConfig={() => onConfigAgent(agent.id)}
            onToggle={() => store.toggleAgent(agent.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ManagerCapabilityCard({ agent, onConfig }: { agent: Agent; onConfig: () => void }) {
  return (
    <div className="rounded-2xl border border-accent/20 bg-bg-surface p-5 transition-all hover:border-accent/40 hover:shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-accent/20 bg-bg-elevated p-1.5">
          <RabbitHead agentId={agent.id} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="text-lg font-semibold text-text-primary">{agent.name}</div>
              <div className="text-sm text-accent">{agent.role}</div>
              <div className="mt-2 text-sm leading-relaxed text-text-secondary">{agent.description}</div>
            </div>
            <button
              onClick={onConfig}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
            >
              去配置
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {agent.capabilities.map((cap) => (
              <span
                key={cap}
                className="rounded-md bg-accent-soft/30 px-2.5 py-1 text-xs font-medium text-accent"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CapabilityCard({
  agent,
  onConfig,
  onToggle
}: {
  agent: Agent
  onConfig: () => void
  onToggle: () => void
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border-subtle bg-bg-surface p-5 transition-all hover:border-accent/30 hover:shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-bg-elevated p-1">
          <RabbitHead agentId={agent.id} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-base font-semibold text-text-primary">{agent.name}</div>
            {/* 启停开关 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                agent.enabled ? 'bg-text-primary' : 'bg-bg-hover'
              }`}
              title={agent.enabled ? '停用智能体' : '启用智能体'}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg-surface transition-all ${
                  agent.enabled ? 'left-4' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          <div className="text-xs text-text-muted">{agent.role}</div>
          <div className="mt-1.5 text-xs leading-relaxed text-text-secondary line-clamp-2">
            {agent.description}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {agent.capabilities.slice(0, 4).map((cap) => (
          <span
            key={cap}
            className="rounded-md bg-bg-elevated px-2 py-1 text-[11px] text-text-secondary"
          >
            {cap}
          </span>
        ))}
        {agent.capabilities.length > 4 && (
          <span className="rounded-md bg-bg-elevated px-2 py-1 text-[11px] text-text-muted">
            +{agent.capabilities.length - 4}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-end pt-4">
        <button
          onClick={onConfig}
          className="inline-flex items-center gap-1 rounded-lg border border-accent px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white"
        >
          去配置
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
