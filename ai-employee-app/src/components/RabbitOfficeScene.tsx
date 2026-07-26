import { useState } from 'react'
import { Globe, Database, FileText, Image } from 'lucide-react'
import type { Agent } from '../types'
import { useStore } from '../store/appStore'
import RabbitHead from './RabbitHead'
import AgentConfigPanel from './AgentConfigPanel'

interface Props {
  control: Agent
  business: Agent[]
}

export default function RabbitOfficeScene({ control, business }: Props) {
  const store = useStore()
  const [configAgentId, setConfigAgentId] = useState<string | null>(null)

  const configAgent = configAgentId
    ? store.agents.find((a) => a.id === configAgentId) ?? null
    : null

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="shrink-0 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-elevated text-text-secondary">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">AI办公室</h2>
            <p className="text-sm text-text-secondary">欢迎老板莅临办公室视察指导工作</p>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <OfficeScene control={control} business={business} onConfigAgent={setConfigAgentId} />
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
  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer flex-col rounded-2xl border border-border-subtle bg-bg-surface p-4 transition-all hover:border-accent/30 hover:shadow-lg"
    >
      {/* 上半部分：头像 + 信息 */}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-white p-1">
          <RabbitHead agentId={agent.id} className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-text-primary">{agent.name}</div>
          <div className="mt-0.5 text-xs text-text-secondary">{agent.role}</div>
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