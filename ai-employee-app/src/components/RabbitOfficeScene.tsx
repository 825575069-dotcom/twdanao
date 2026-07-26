import { useState, useCallback } from 'react'
import {
  Settings2,
  Database,
  FileText,
  Image as ImageIcon,
  Cpu,
  Workflow as WorkflowIcon,
  Play,
  Square,
  RefreshCw,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Pause
} from 'lucide-react'
import type { Agent, WorkflowNodeStatus } from '../types'
import { useStore } from '../store/appStore'
import RabbitHead from './RabbitHead'
import AgentConfigPanel from './AgentConfigPanel'

import OfficeDataBaseDashboard from './OfficeDataBaseDashboard'

type ViewMode = 'overview' | 'config' | 'orchestrate'

const statusConfig: Record<WorkflowNodeStatus, { icon: typeof CheckCircle2; label: string; color: string; bg: string }> = {
  idle: { icon: Clock, label: '空闲', color: 'text-text-muted', bg: 'bg-bg-elevated' },
  running: { icon: Loader2, label: '执行中', color: 'text-sky-400', bg: 'bg-sky-500/10' },
  waiting: { icon: Pause, label: '等待依赖', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  done: { icon: CheckCircle2, label: '完成', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  failed: { icon: XCircle, label: '失败', color: 'text-red-400', bg: 'bg-red-500/10' }
}

interface Props {
  control: Agent
  business: Agent[]
}

export default function RabbitOfficeScene({ control, business }: Props) {
  const store = useStore()
  const [configAgentId, setConfigAgentId] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>('overview')

  const configAgent = configAgentId
    ? store.agents.find((a) => a.id === configAgentId) ?? null
    : null

  const orchRun = store.activeOrchRun

  const subtitleMap: Record<ViewMode, string> = {
    overview: '数据底座状态一览 · 已对接系统与未对接系统',
    config: '命名智能体 · 编辑工作流 · 配置数据底座与知识库',
    orchestrate: '编排工作流 · 串行/并行调度 · 实时监控执行状态'
  }

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="shrink-0 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated p-0.5">
              <RabbitHead agentId="control" className="h-full w-full" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">智能体配置中心</h2>
              <p className="text-sm text-text-secondary">{subtitleMap[mode]}</p>
            </div>
          </div>

          {/* 右侧：模式切换 + 算力 */}
          <div className="flex items-center gap-3">
            {/* 模式切换 */}
            <div className="flex rounded-xl border border-border-subtle bg-bg-elevated p-1">
              <button
                onClick={() => setMode('overview')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'overview' ? 'bg-accent-soft/40 text-accent' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Database className="mr-1 inline h-3 w-3" />
                数据底座
              </button>
              <button
                onClick={() => setMode('config')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'config' ? 'bg-accent-soft/40 text-accent' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Settings2 className="mr-1 inline h-3 w-3" />
                配置模式
              </button>
              <button
                onClick={() => setMode('orchestrate')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'orchestrate' ? 'bg-accent-soft/40 text-accent' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <GitBranch className="mr-1 inline h-3 w-3" />
                编排模式
              </button>
            </div>

            <span className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-secondary">
              <Cpu className="h-3.5 w-3.5 text-text-muted" />
              算力余额 <span className="font-semibold text-text-primary">{store.creditBalance.toLocaleString()}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {mode === 'overview' ? (
          <OfficeDataBaseDashboard />
        ) : mode === 'config' ? (
          <ConfigMode control={control} business={business} onConfigAgent={setConfigAgentId} />
        ) : (
          <OrchestrateMode business={business} orchRun={orchRun} />
        )}
      </div>

      {/* 智能体配置面板 */}
      {configAgent && <AgentConfigPanel agent={configAgent} onClose={() => setConfigAgentId(null)} />}
    </div>
  )
}

// ============================================================
// 配置模式（原有功能）
// ============================================================
function ConfigMode({
  control,
  business,
  onConfigAgent
}: {
  control: Agent
  business: Agent[]
  onConfigAgent: (id: string) => void
}) {
  return (
    <>
      <ManagerDesk agent={control} onClick={() => onConfigAgent(control.id)} />
      <div className="flex items-center gap-3 py-4">
        <div className="h-px flex-1 bg-border-subtle" />
        <span className="text-xs text-text-muted">五大业务智能体</span>
        <div className="h-px flex-1 bg-border-subtle" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {business.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onClick={() => onConfigAgent(agent.id)} />
        ))}
      </div>
    </>
  )
}

// ============================================================
// 编排模式（工作流可视化 + 中控面板 + 执行状态）
// ============================================================
function OrchestrateMode({
  business,
  orchRun
}: {
  business: Agent[]
  orchRun: ReturnType<typeof useStore>['activeOrchRun']
}) {
  const store = useStore()
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [running, setRunning] = useState(false)

  const selectedTemplate = store.workflowTemplates.find((t) => t.id === selectedTemplateId)

  // 获取模板中涉及的智能体及其依赖关系
  const involvedAgentIds = selectedTemplate
    ? [...new Set(selectedTemplate.steps.map((s) => s.agentId))]
    : []

  // 构建节点状态
  const nodeStatuses: Record<string, WorkflowNodeStatus> = {}
  if (orchRun) {
    orchRun.nodes.forEach((n) => {
      nodeStatuses[n.agentId] = n.status
    })
  } else {
    involvedAgentIds.forEach((id) => {
      nodeStatuses[id] = 'idle'
    })
  }

  // 模拟执行编排
  const startOrchestration = useCallback(() => {
    if (!selectedTemplate || running) return
    setRunning(true)

    const now = new Date().toLocaleString('zh-CN', { hour12: false })
    const nodes = selectedTemplate.steps.map((step) => {
      const agent = business.find((a) => a.id === step.agentId)!
      const deps = selectedTemplate.edges
        .filter((e) => e.to === step.id)
        .map((e) => e.from)
      return {
        stepId: step.id,
        agentId: step.agentId,
        agentName: agent?.name ?? step.agentId,
        agentEmoji: agent?.emoji ?? '',
        status: 'idle' as WorkflowNodeStatus,
        progress: 0,
        logs: [],
        dependencies: deps,
        retryUsed: 0,
        retryMax: step.retryCount
      }
    })

    const run = {
      id: `run_${Date.now()}`,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      status: 'running' as const,
      taskText: selectedTemplate.name,
      nodes,
      startedAt: now,
      totalCredits: 0
    }

    store.startOrchRun(run)

    // 模拟异步执行
    const executeStep = (stepIndex: number) => {
      if (stepIndex >= nodes.length) {
        store.updateOrchRun({ status: 'completed', completedAt: new Date().toLocaleString('zh-CN', { hour12: false }) })
        setRunning(false)
        return
      }

      const step = selectedTemplate.steps[stepIndex]
      const deps = selectedTemplate.edges.filter((e) => e.to === step.id).map((e) => e.from)

      // 检查依赖是否完成（并行节点依赖）
      const allDepsDone = deps.every((depId) => {
        const depNode = nodes.find((n) => n.stepId === depId)
        return depNode?.status === 'done'
      })

      if (deps.length > 0 && !allDepsDone) {
        // 依赖未就绪，设为等待
        const updatedNodes = nodes.map((n) =>
          n.stepId === step.id ? { ...n, status: 'waiting' as WorkflowNodeStatus } : n
        )
        store.updateOrchRun({ nodes: updatedNodes })
        // 重试检查
        setTimeout(() => executeStep(stepIndex), 500)
        return
      }

      // 设为运行中
      const runningNodes = nodes.map((n) =>
        n.stepId === step.id
          ? {
              ...n,
              status: 'running' as WorkflowNodeStatus,
              startedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
              logs: [
                ...n.logs,
                {
                  id: `log_${Date.now()}`,
                  agent: step.agentId,
                  level: 'agent' as const,
                  text: `🚀 开始执行: ${step.name}`,
                  time: new Date().toLocaleString('zh-CN', { hour12: false })
                }
              ]
            }
          : n
      )
      store.updateOrchRun({ nodes: runningNodes })

      // 模拟执行延迟
      const progressInterval = setInterval(() => {
        const current = nodes.find((n) => n.stepId === step.id)
        const currentProgress = current?.progress ?? 0
        if (currentProgress >= 90) {
          clearInterval(progressInterval)
          return
        }
        const nextProgress = Math.min(100, currentProgress + Math.floor(Math.random() * 25) + 10)
        const pNodes = nodes.map((n) =>
          n.stepId === step.id ? { ...n, progress: nextProgress } : n
        )
        store.updateOrchRun({ nodes: pNodes })
        nodes.forEach((n) => {
          if (n.stepId === step.id) n.progress = nextProgress
        })
      }, 400)

      setTimeout(() => {
        clearInterval(progressInterval)

        // 模拟记忆召回日志
        const memoryLog = {
          id: `log_mem_${Date.now()}`,
          agent: step.agentId,
          level: 'memory' as const,
          text: `🧠 记忆召回: 从历史会话中检索到 ${Math.floor(Math.random() * 5) + 1} 条相关记忆，关键词: ${['库存', '供应商', '窜货', '客户', '学术'][Math.floor(Math.random() * 5)]}`,
          time: new Date().toLocaleString('zh-CN', { hour12: false })
        }

        const doneNodes = nodes.map((n) =>
          n.stepId === step.id
            ? {
                ...n,
                status: 'done' as WorkflowNodeStatus,
                progress: 100,
                completedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                logs: [
                  ...n.logs,
                  memoryLog,
                  {
                    id: `log_${Date.now()}_done`,
                    agent: step.agentId,
                    level: 'agent' as const,
                    text: `✅ 完成: ${step.name}`,
                    time: new Date().toLocaleString('zh-CN', { hour12: false })
                  }
                ]
              }
            : n
        )

        // 检查同层级的并行步骤
        const parallelEdges = selectedTemplate.edges.filter((e) => e.from === step.id && e.type === 'parallel')
        if (parallelEdges.length > 0) {
          // 并行启动下一步
          parallelEdges.forEach((edge) => {
            const nextIndex = selectedTemplate.steps.findIndex((s) => s.id === edge.to)
            if (nextIndex >= 0 && nextIndex !== stepIndex + 1) {
              // 并行步骤单独调度
              setTimeout(() => executeStep(nextIndex), 500)
            }
          })
        }

        store.updateOrchRun({ nodes: doneNodes, totalCredits: (store.activeOrchRun?.totalCredits ?? 0) + (step.agentId === 'control' ? 0 : Math.floor(Math.random() * 8) + 3) })
        nodes.forEach((n) => {
          if (n.stepId === step.id) {
            n.status = 'done'
            n.progress = 100
          }
        })

        // 继续下一步
        setTimeout(() => executeStep(stepIndex + 1), 800)
      }, 1500 + Math.random() * 1000)
    }

    setTimeout(() => executeStep(0), 500)
  }, [selectedTemplate, business, store, running])

  const stopOrchestration = () => {
    store.clearOrchRun()
    setRunning(false)
  }

  return (
    <div className="space-y-6">
      {/* 模板选择器 */}
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
          <WorkflowIcon className="h-4 w-4 text-accent" />
          选择工作流模板
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {store.workflowTemplates.map((tpl) => {
            const active = selectedTemplateId === tpl.id
            const running = orchRun?.templateId === tpl.id && orchRun?.status === 'running'
            return (
              <button
                key={tpl.id}
                onClick={() => {
                  if (!running && !orchRun) setSelectedTemplateId(tpl.id)
                }}
                disabled={running}
                className={`relative rounded-xl border p-4 text-left transition-all ${
                  active
                    ? 'border-accent bg-accent-soft/30 shadow-sm'
                    : 'border-border-subtle bg-bg-surface hover:border-accent/50'
                } ${running ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {running && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 text-[10px] text-sky-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> 执行中
                  </span>
                )}
                <div className="text-sm font-medium text-text-primary">{tpl.name}</div>
                <div className="mt-1 text-[11px] text-text-muted line-clamp-2">{tpl.description}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {tpl.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                      {tag}
                    </span>
                  ))}
                  <span className="rounded-md bg-accent-soft/20 px-1.5 py-0.5 text-[10px] text-accent">
                    {tpl.steps.length} 步骤
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 编排控制面板 */}
      {selectedTemplate && (
        <>
          {/* 中控面板 */}
          <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-bg-surface p-0.5">
                  <RabbitHead agentId="control" className="h-full w-full" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-primary">
                    {orchRun ? `${orchRun.templateName} · ${orchRun.status === 'running' ? '执行中' : orchRun.status === 'completed' ? '已完成' : '已停止'}` : `准备执行: ${selectedTemplate.name}`}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    中控 A 调度中心
                    {orchRun?.startedAt ? ` · 启动于 ${orchRun.startedAt}` : ''}
                    {orchRun?.completedAt ? ` · 完成于 ${orchRun.completedAt}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!orchRun || orchRun.status === 'completed' ? (
                  <button
                    onClick={startOrchestration}
                    disabled={running}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    启动编排
                  </button>
                ) : (
                  <button
                    onClick={stopOrchestration}
                    className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Square className="h-4 w-4" />
                    停止
                  </button>
                )}
                {orchRun && (
                  <button
                    onClick={() => {
                      store.clearOrchRun()
                      setRunning(false)
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-bg-hover px-3 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    重置
                  </button>
                )}
              </div>
            </div>

            {/* 全局进度条 */}
            {orchRun && orchRun.status === 'running' && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
                  <span>编排执行进度</span>
                  <span>
                    {orchRun.nodes.filter((n) => n.status === 'done').length}/{orchRun.nodes.length} 步骤完成
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg-surface">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400 transition-all duration-500"
                    style={{
                      width: `${orchRun.nodes.length > 0
                        ? Math.round(
                            (orchRun.nodes.filter((n) => n.status === 'done').length / orchRun.nodes.length) * 100
                          )
                        : 0}%`
                    }}
                  />
                </div>
                {orchRun.totalCredits > 0 && (
                  <div className="mt-1 text-right text-[10px] text-text-muted">
                    已消耗算力: {orchRun.totalCredits} 积分
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 工作流可视化流程图 */}
          <WorkflowFlow
            template={selectedTemplate}
            business={business}
            orchRun={orchRun}
            nodeStatuses={nodeStatuses}
          />

          {/* 执行日志 */}
          {orchRun && (
            <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
              <h3 className="mb-3 text-sm font-semibold text-text-primary">📋 执行日志</h3>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {orchRun.nodes.flatMap((node) => node.logs).length === 0 ? (
                  <div className="py-4 text-center text-xs text-text-muted">暂无日志，启动编排后将实时显示</div>
                ) : (
                  orchRun.nodes.flatMap((node) =>
                    node.logs.map((log, i) => (
                      <div key={log.id || i} className="flex items-start gap-2.5 rounded-lg bg-bg-surface p-2.5">
                        <span
                          className={`mt-0.5 shrink-0 rounded px-1 py-0 text-[9px] font-medium ${
                            log.level === 'memory'
                              ? 'bg-violet-500/10 text-violet-400'
                              : log.level === 'agent'
                                ? 'bg-sky-500/10 text-sky-400'
                                : log.level === 'credit'
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-bg-hover text-text-muted'
                          }`}
                        >
                          {log.level === 'memory' ? '记忆' : log.level === 'agent' ? '智能体' : log.level === 'credit' ? '积分' : '控制'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-text-secondary">{log.text}</div>
                          <div className="mt-0.5 text-[10px] text-text-muted">{log.time}</div>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 未选择模板时的引导 */}
      {!selectedTemplate && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-bg-elevated py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft/20">
            <GitBranch className="h-8 w-8 text-accent/60" />
          </div>
          <div className="mt-4 text-sm font-medium text-text-secondary">选择一个工作流模板开始编排</div>
          <div className="mt-1 text-xs text-text-muted">
            平台预置了库存采购、客户触达、流向监控、学术推广等常用编排模板
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 工作流可视化流程图
// ============================================================
function WorkflowFlow({
  template,
  business,
  orchRun,
  nodeStatuses
}: {
  template: ReturnType<typeof useStore>['workflowTemplates'][number]
  business: Agent[]
  orchRun: ReturnType<typeof useStore>['activeOrchRun']
  nodeStatuses: Record<string, WorkflowNodeStatus>
}) {
  // 获取每个智能体在模板中的步骤
  const agentSteps = business
    .filter((a) => template.steps.some((s) => s.agentId === a.id))
    .map((a) => {
      const steps = template.steps.filter((s) => s.agentId === a.id)
      const status = nodeStatuses[a.id] || 'idle'
      const st = statusConfig[status]
      const StatusIcon = st.icon
      const runNode = orchRun?.nodes.find((n) => n.agentId === a.id)
      return { agent: a, steps, status, statusConfig: st, StatusIcon, runNode }
    })

  if (agentSteps.length === 0) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated py-8 text-center text-sm text-text-muted">
        该模板未绑定任何已知智能体
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
        <GitBranch className="h-4 w-4 text-accent" />
        工作流执行流程
      </h3>

      <div className="flex flex-wrap items-start gap-2">
        {agentSteps.map(({ agent, steps, status, statusConfig: st, StatusIcon, runNode }, idx) => (
          <div key={agent.id} className="flex items-center">
            {/* 智能体节点 */}
            <div
              className={`relative flex min-w-[160px] flex-col items-center rounded-xl border p-3 transition-all ${
                status === 'running'
                  ? 'border-sky-400/50 bg-sky-500/5 shadow-[0_0_12px_rgba(56,189,248,0.15)]'
                  : status === 'done'
                    ? 'border-emerald-400/50 bg-emerald-500/5'
                    : status === 'failed'
                      ? 'border-red-400/50 bg-red-500/5'
                      : status === 'waiting'
                        ? 'border-amber-400/50 bg-amber-500/5'
                        : 'border-border-subtle bg-bg-surface'
              }`}
            >
              {/* 状态徽章 */}
              <div className={`absolute -right-1.5 -top-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.bg} ${st.color}`}>
                <StatusIcon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
                {st.label}
              </div>

              {/* 头像 */}
              <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-bg-surface p-0.5">
                <RabbitHead agentId={agent.id} className="h-full w-full" />
              </div>

              {/* 名称 */}
              <div className="mt-1.5 text-xs font-medium text-text-primary">{agent.name}</div>

              {/* 步骤列表 */}
              <div className="mt-1.5 w-full space-y-1">
                {steps.map((step, si) => (
                  <div key={step.id} className="flex items-center gap-1 text-[10px] text-text-muted">
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-bg-elevated text-[9px] text-text-muted">
                      {si + 1}
                    </span>
                    <span className="truncate">{step.name}</span>
                  </div>
                ))}
              </div>

              {/* 进度条 */}
              {runNode && runNode.status === 'running' && (
                <div className="mt-2 w-full">
                  <div className="h-1 overflow-hidden rounded-full bg-bg-elevated">
                    <div
                      className="h-full rounded-full bg-sky-400 transition-all duration-300"
                      style={{ width: `${runNode.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 连接箭头 */}
            {idx < agentSteps.length - 1 && (
              <div className="flex shrink-0 items-center px-1">
                <div className="flex flex-col items-center">
                  <ArrowRight className="h-4 w-4 text-text-muted/50" />
                  {template.edges.some(
                    (e) =>
                      e.from === agentSteps[idx].steps[0]?.id &&
                      e.to === agentSteps[idx + 1].steps[0]?.id &&
                      e.type === 'parallel'
                  ) && (
                    <span className="text-[9px] text-amber-400/70">并行</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// —— 知识库绑定摘要 ——
function AgentKnowledgeSummary({ agent }: { agent: Agent }) {
  const total = agent.boundDataBases.length + agent.boundDocs.length + agent.boundImages.length
  if (total === 0) {
    return (
      <div className="mt-3 flex items-center gap-3 border-t border-border-subtle pt-2 text-[11px] text-text-muted">
        <span className="flex items-center gap-1"><Database className="h-3 w-3" /> 未配置</span>
        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> 未配置</span>
        <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> 未配置</span>
        <span className="flex items-center gap-1"><WorkflowIcon className="h-3 w-3" /> {agent.workflow.length} 步</span>
      </div>
    )
  }
  return (
    <div className="mt-3 flex items-center gap-3 border-t border-border-subtle pt-2 text-[11px] text-text-secondary">
      <span className="flex items-center gap-1">
        <Database className="h-3 w-3" /> {agent.boundDataBases.length} 底座
      </span>
      <span className="flex items-center gap-1">
        <FileText className="h-3 w-3" /> {agent.boundDocs.length} 文档
      </span>
      <span className="flex items-center gap-1">
        <ImageIcon className="h-3 w-3" /> {agent.boundImages.length} 图片
      </span>
      <span className="flex items-center gap-1">
        <WorkflowIcon className="h-3 w-3" /> {agent.workflow.length} 步
      </span>
    </div>
  )
}

// —— 中控 A 经理位 ——
function ManagerDesk({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer overflow-hidden rounded-2xl border border-border-subtle bg-bg-elevated p-5 transition-all hover:border-accent/50"
    >
      <div className="absolute right-3 top-3 flex items-center gap-1 text-[11px] text-text-muted">
        <Settings2 className="h-3 w-3" /> 配置
      </div>
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface p-1">
          <RabbitHead agentId={agent.id} className="h-full w-full" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">{agent.name}</span>
          </div>
          <div className="text-sm text-text-secondary">{agent.role}</div>
          <div className="mt-1 text-xs text-text-muted">{agent.description}</div>
        </div>
      </div>
      <AgentKnowledgeSummary agent={agent} />
    </div>
  )
}

// —— 智能体卡片 ——
function AgentCard({
  agent,
  onClick
}: {
  agent: Agent
  onClick: () => void
}) {
  const store = useStore()

  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer overflow-hidden rounded-2xl border p-4 text-left transition-all hover:border-accent/50 ${
        !agent.enabled ? 'opacity-50' : ''
      } border-border-subtle bg-bg-elevated`}
    >
      <div className="absolute right-12 top-3 flex items-center gap-1 text-[11px] text-text-muted">
        <Settings2 className="h-3 w-3" />
      </div>

      <div className="flex items-start gap-3">
        <div className="relative flex shrink-0 h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-bg-surface">
          <RabbitHead agentId={agent.id} className="h-full w-full" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-text-primary">{agent.name}</span>
            {!agent.enabled && <span className="text-[11px] text-text-muted">已停用</span>}
          </div>
          <div className="text-xs text-text-muted">{agent.role}</div>
          <div className="mt-1 text-[11px] text-text-muted line-clamp-2">{agent.description}</div>
        </div>
      </div>

      <AgentKnowledgeSummary agent={agent} />

      <button
        onClick={(e) => {
          e.stopPropagation()
          store.toggleAgent(agent.id)
        }}
        className={`absolute right-3 top-3 h-5 w-9 shrink-0 rounded-full transition-colors ${
          agent.enabled ? 'bg-text-primary' : 'bg-bg-hover'
        }`}
        title="启停智能体"
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg-surface transition-all ${
            agent.enabled ? 'left-4' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}
