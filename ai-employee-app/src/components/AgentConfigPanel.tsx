import { useState } from 'react'
import {
  X,
  Database,
  FileText,
  Image,
  Check,
  LayoutGrid,
  Settings2,
  Workflow as WorkflowIcon,
  Plus,
  Trash2,
  Save,
  Copy,
  ChevronDown,
  RotateCcw,
  Clock,
  Cpu,
  Zap
} from 'lucide-react'
import { useStore } from '../store/appStore'
import type { KnowledgeDoc } from '../store/appStore'
import RabbitHead from './RabbitHead'
import type { Agent, DataBaseConnector, MediaAsset, AgentWorkflowStep } from '../types'

type TabKey = 'basic' | 'workflow' | 'dataBase' | 'docs' | 'images'

const tabs: { key: TabKey; label: string; icon: typeof Database }[] = [
  { key: 'basic', label: '基础信息', icon: Settings2 },
  { key: 'workflow', label: '工作流', icon: WorkflowIcon },
  { key: 'dataBase', label: '数据底座', icon: Database },
  { key: 'docs', label: '知识文档', icon: FileText },
  { key: 'images', label: '营销素材', icon: Image }
]

export default function AgentConfigPanel({
  agent,
  onClose
}: {
  agent: Agent
  onClose: () => void
}) {
  const store = useStore()
  const [tab, setTab] = useState<TabKey>('basic')

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-border-subtle bg-bg-surface shadow-xl animate-slide-in-right">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated p-0.5">
              <RabbitHead agentId={agent.id} className="h-full w-full" />
            </div>
            <div>
              <div className="text-base font-semibold text-text-primary">{agent.name}</div>
              <div className="text-xs text-text-muted">{agent.role}</div>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn h-8 w-8">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-border-subtle px-3 pt-3">
          {tabs.map((t) => {
            const Icon = t.icon
            const count =
              t.key === 'dataBase'
                ? agent.boundDataBases.length
                : t.key === 'docs'
                  ? agent.boundDocs.length
                  : t.key === 'images'
                    ? agent.boundImages.length
                    : t.key === 'workflow'
                      ? agent.workflow.length
                      : 0
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 px-1 pb-2.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {count > 0 && (
                  <span className="rounded bg-bg-elevated px-1 py-0 text-[10px] text-text-secondary">{count}</span>
                )}
                {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
              </button>
            )
          })}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'basic' && <BasicInfoTab agent={agent} />}
          {tab === 'workflow' && <WorkflowTab agent={agent} />}
          {tab === 'dataBase' && (
            <DataBaseTab
              agent={agent}
              connectors={store.dataBaseConnectors}
              onToggle={(id) => store.toggleAgentDataBase(agent.id, id)}
            />
          )}
          {tab === 'docs' && (
            <DocsTab agent={agent} docs={store.knowledge} onToggle={(id) => store.toggleAgentDoc(agent.id, id)} />
          )}
          {tab === 'images' && (
            <ImagesTab agent={agent} images={store.media} onToggle={(id) => store.toggleAgentImage(agent.id, id)} />
          )}
        </div>

        {/* 底部 */}
        <div className="border-t border-border-subtle px-5 py-4">
          <div className="text-xs text-text-muted">
            已配置：{agent.boundDataBases.length} 个数据底座 · {agent.boundDocs.length} 份文档 · {agent.boundImages.length} 张图片 · {agent.workflow.length} 个工作流步骤
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 基础信息 Tab —— 名称 / 角色 / 描述 可编辑
// ============================================================
const SCARF_COLORS: { key: NonNullable<Agent['scarfColor']>; label: string }[] = [
  { key: 'purple', label: '紫（经理）' },
  { key: 'red', label: '红' },
  { key: 'green', label: '绿' },
  { key: 'yellow', label: '黄' },
  { key: 'blue', label: '蓝' },
  { key: 'orange', label: '橙' }
]

function BasicInfoTab({ agent }: { agent: Agent }) {
  const store = useStore()
  const [name, setName] = useState(agent.name)
  const [role, setRole] = useState(agent.role)
  const [description, setDescription] = useState(agent.description)
  const [saved, setSaved] = useState(false)

  const dirty =
    name !== agent.name ||
    role !== agent.role ||
    description !== agent.description

  const handleSave = () => {
    store.renameAgent(agent.id, name.trim() || agent.name)
    store.updateAgentRoleDesc(agent.id, role.trim() || agent.role, description.trim() || agent.description)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const scarfColor = agent.scarfColor ?? 'purple'

  return (
    <div className="space-y-4">
      <div className="text-xs text-text-muted">自定义智能体名称、角色定位与功能描述</div>

      {/* 名称 */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">智能体名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="给智能体起个名字"
          className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {/* 角色 */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">角色定位</label>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="一句话描述智能体角色"
          className="w-full rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {/* 描述 */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">功能描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="详细描述智能体的功能与职责"
          rows={4}
          className="w-full resize-none rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {/* 围巾颜色 */}
      <div>
        <label className="mb-2 block text-xs font-medium text-text-secondary">围巾颜色（形象）</label>
        <div className="flex flex-wrap gap-3">
          {SCARF_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => store.setAgentScarfColorWithSwap(agent.id, c.key)}
              title={c.label}
              className={`relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 transition-all ${
                scarfColor === c.key
                  ? 'border-accent ring-2 ring-accent/20'
                  : 'border-border-subtle hover:border-accent/50'
              }`}
            >
              <img
                src={c.key === 'purple' ? '/yesgo-avatar.png' : `/rabbits/${c.key}.png`}
                alt={c.label}
                className="h-full w-full object-contain"
              />
              {scarfColor === c.key && (
                <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-[11px] text-text-muted">
          围巾颜色全局互斥。若其他兔仔已使用该颜色，会自动与当前兔仔交换颜色
        </div>
      </div>

      {/* 保存按钮 */}
      <button
        onClick={handleSave}
        disabled={!dirty}
        className={`btn-primary w-full ${!dirty ? 'opacity-50' : ''}`}
      >
        {saved ? (
          <>
            <Check className="h-4 w-4" />
            已保存
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            保存修改
          </>
        )}
      </button>

      {dirty && !saved && (
        <div className="text-center text-[11px] text-text-muted">有未保存的修改</div>
      )}
    </div>
  )
}

// ============================================================
// 工作流 Tab —— 模板选择 + 步骤增删改 + Prompt/重试/模型/触发条件
// ============================================================
function WorkflowTab({ agent }: { agent: Agent }) {
  const store = useStore()
  const [steps, setSteps] = useState<AgentWorkflowStep[]>(agent.workflow.map((s) => ({ ...s })))
  const [saved, setSaved] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  const dirty = JSON.stringify(steps) !== JSON.stringify(agent.workflow)

  const updateStep = (id: string, field: keyof AgentWorkflowStep, value: string | number) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const addStep = () => {
    const newId = `w${Date.now()}`
    setSteps((prev) => [
      ...prev,
      { id: newId, name: '新步骤', prompt: '', retryCount: 2, timeout: 30000, modelId: 'qwen-max', triggerCondition: '' }
    ])
  }

  const deleteStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id))
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const arr = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= arr.length) return arr
      ;[arr[index], arr[target]] = [arr[target], arr[index]]
      return arr
    })
  }

  const loadTemplate = (templateId: string) => {
    const tpl = store.workflowTemplates.find((t) => t.id === templateId)
    if (!tpl) return
    // 只加载属于当前智能体的步骤
    const agentSteps = tpl.steps
      .filter((s) => s.agentId === agent.id)
      .map((s) => ({
        id: `w${Date.now()}_${s.id}`,
        name: s.name,
        prompt: s.prompt,
        retryCount: s.retryCount,
        timeout: s.timeout,
        modelId: s.modelId,
        triggerCondition: s.triggerCondition
      }))
    if (agentSteps.length > 0) {
      setSteps(agentSteps)
    }
    setShowTemplatePicker(false)
  }

  const handleSave = () => {
    store.updateAgentWorkflow(agent.id, steps)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // 获取包含当前智能体的模板
  const relevantTemplates = store.workflowTemplates.filter((t) =>
    t.steps.some((s) => s.agentId === agent.id)
  )

  return (
    <div className="space-y-3">
      {/* 模板选择器 */}
      {relevantTemplates.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowTemplatePicker(!showTemplatePicker)}
            className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2.5 text-sm text-text-secondary hover:border-accent/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Copy className="h-3.5 w-3.5 text-accent" />
              从平台工作流模板加载
            </span>
            <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${showTemplatePicker ? 'rotate-180' : ''}`} />
          </button>
          {showTemplatePicker && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-border-subtle bg-bg-elevated shadow-xl overflow-hidden">
              {relevantTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => loadTemplate(tpl.id)}
                  className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-bg-hover transition-colors border-b border-border-subtle last:border-0"
                >
                  <div className="mt-0.5 shrink-0 rounded-lg bg-accent-soft/40 p-1.5">
                    <WorkflowIcon className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-text-primary">{tpl.name}</div>
                    <div className="mt-0.5 text-[11px] text-text-muted line-clamp-1">{tpl.description}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tpl.tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">{tag}</span>
                      ))}
                      <span className="rounded-md bg-accent-soft/30 px-1.5 py-0.5 text-[10px] text-accent">
                        {tpl.steps.filter((s) => s.agentId === agent.id).length} 步骤
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 步骤管理头部 */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-text-muted">共 {steps.length} 个步骤 · 编辑 Prompt 与执行参数</div>
        <button onClick={addStep} className="flex items-center gap-1 rounded-lg bg-bg-elevated px-2 py-1 text-xs text-accent hover:bg-bg-hover">
          <Plus className="h-3 w-3" />
          添加步骤
        </button>
      </div>

      {steps.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-bg-elevated py-8 text-center text-sm text-text-muted">
          暂无工作流步骤，点击「添加步骤」或从平台模板加载
        </div>
      )}

      {steps.map((step, index) => (
        <div key={step.id} className="rounded-xl border border-border-subtle bg-bg-elevated p-3">
          {/* 步骤头部 */}
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft/40 text-[11px] font-medium text-accent">
              {index + 1}
            </span>
            <input
              type="text"
              value={step.name}
              onChange={(e) => updateStep(step.id, 'name', e.target.value)}
              placeholder="步骤名称"
              className="flex-1 rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            {/* 排序按钮 */}
            <button
              onClick={() => moveStep(index, 'up')}
              disabled={index === 0}
              className={`flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-bg-hover ${index === 0 ? 'opacity-30' : ''}`}
              title="上移"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
            </button>
            <button
              onClick={() => moveStep(index, 'down')}
              disabled={index === steps.length - 1}
              className={`flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-bg-hover ${index === steps.length - 1 ? 'opacity-30' : ''}`}
              title="下移"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <button
              onClick={() => deleteStep(step.id)}
              className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-red-500/10 hover:text-red-400"
              title="删除步骤"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          {/* Prompt */}
          <textarea
            value={step.prompt}
            onChange={(e) => updateStep(step.id, 'prompt', e.target.value)}
            placeholder="该步骤的 Prompt / 工作流说明（交给模型执行的指令）"
            rows={3}
            className="w-full resize-none rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-xs text-text-secondary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />

          {/* 执行参数：重试 / 超时 / 模型 / 触发条件 */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {/* 重试次数 */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-text-muted">
                <RotateCcw className="h-3 w-3" /> 重试次数
              </label>
              <select
                value={step.retryCount ?? 2}
                onChange={(e) => updateStep(step.id, 'retryCount', Number(e.target.value))}
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
              >
                <option value={0}>不重试</option>
                <option value={1}>1 次</option>
                <option value={2}>2 次</option>
                <option value={3}>3 次</option>
                <option value={5}>5 次</option>
              </select>
            </div>

            {/* 超时时间 */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-text-muted">
                <Clock className="h-3 w-3" /> 超时 (秒)
              </label>
              <select
                value={step.timeout ?? 30000}
                onChange={(e) => updateStep(step.id, 'timeout', Number(e.target.value))}
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
              >
                <option value={15000}>15s</option>
                <option value={30000}>30s</option>
                <option value={45000}>45s</option>
                <option value={60000}>60s</option>
                <option value={120000}>120s</option>
              </select>
            </div>

            {/* 绑定模型 */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-text-muted">
                <Cpu className="h-3 w-3" /> 绑定模型
              </label>
              <select
                value={step.modelId ?? 'qwen-max'}
                onChange={(e) => updateStep(step.id, 'modelId', e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
              >
                {store.models
                  .filter((m) => m.status === 'ready')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* 触发条件 */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-text-muted">
                <Zap className="h-3 w-3" /> 触发条件
              </label>
              <input
                type="text"
                value={step.triggerCondition ?? ''}
                onChange={(e) => updateStep(step.id, 'triggerCondition', e.target.value)}
                placeholder="如上一步完成自动触发"
                className="w-full rounded-lg border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>
      ))}

      {steps.length > 0 && (
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={`btn-primary w-full ${!dirty ? 'opacity-50' : ''}`}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" />
              已保存
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              保存工作流
            </>
          )}
        </button>
      )}
    </div>
  )
}

// ============================================================
// 数据底座 Tab
// ============================================================
function DataBaseTab({
  agent,
  connectors,
  onToggle
}: {
  agent: Agent
  connectors: DataBaseConnector[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-text-muted">为该智能体选择可读取的数据底座</div>
      {connectors.length === 0 ? (
        <Empty text="暂无可用的数据底座" />
      ) : (
        connectors.map((c) => {
          const checked = agent.boundDataBases.includes(c.id)
          const enabled = c.enabled && c.status === 'connected'
          return (
            <label
              key={c.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                checked ? 'border-accent bg-accent-soft/40' : 'border-border-subtle bg-bg-elevated'
              } ${!enabled ? 'opacity-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!enabled}
                onChange={() => onToggle(c.id)}
                className="mt-0.5 h-4 w-4 rounded border-border-subtle text-accent focus:ring-accent"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-3.5 w-3.5 text-text-muted" />
                  <span className="text-sm font-medium text-text-primary">{c.name}</span>
                </div>
                <div className="mt-0.5 text-xs text-text-muted">{c.desc}</div>
                {!enabled && <div className="mt-1 text-[11px] text-text-muted">未启用或未连接</div>}
              </div>
              {checked && <Check className="mt-0.5 h-4 w-4 text-accent" />}
            </label>
          )
        })
      )}
    </div>
  )
}

// ============================================================
// 知识文档 Tab
// ============================================================
function DocsTab({
  agent,
  docs,
  onToggle
}: {
  agent: Agent
  docs: KnowledgeDoc[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-text-muted">为该智能体选择可引用的知识文档</div>
      {docs.length === 0 ? (
        <Empty text="暂无可用的知识文档" />
      ) : (
        docs.map((d) => {
          const checked = agent.boundDocs.includes(d.id)
          return (
            <label
              key={d.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                checked ? 'border-accent bg-accent-soft/40' : 'border-border-subtle bg-bg-elevated'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(d.id)}
                className="mt-0.5 h-4 w-4 rounded border-border-subtle text-accent focus:ring-accent"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-text-muted" />
                  <span className="text-sm font-medium text-text-primary">{d.name}</span>
                </div>
                <div className="mt-0.5 text-xs text-text-muted">
                  {d.folder} · {d.type} · {d.size}
                </div>
              </div>
              {checked && <Check className="mt-0.5 h-4 w-4 text-accent" />}
            </label>
          )
        })
      )}
    </div>
  )
}

// ============================================================
// 营销素材 Tab
// ============================================================
function ImagesTab({
  agent,
  images,
  onToggle
}: {
  agent: Agent
  images: MediaAsset[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-text-muted">为该智能体选择可使用的营销素材</div>
      {images.length === 0 ? (
        <Empty text="暂无可用的营销素材" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {images.map((img) => {
            const checked = agent.boundImages.includes(img.id)
            return (
              <label
                key={img.id}
                className={`relative cursor-pointer overflow-hidden rounded-xl border aspect-video transition ${
                  checked ? 'border-accent ring-2 ring-accent/20' : 'border-border-subtle bg-bg-elevated'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(img.id)}
                  className="absolute left-2 top-2 h-4 w-4 rounded border-border-subtle text-accent focus:ring-accent"
                />
                <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
                  <Image className="h-8 w-8 text-text-muted/40" />
                  <div className="w-full truncate text-center text-[11px] text-text-muted">{img.name}</div>
                </div>
                {checked && (
                  <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-border-subtle bg-bg-elevated py-10 text-center text-sm text-text-muted">{text}</div>
}
