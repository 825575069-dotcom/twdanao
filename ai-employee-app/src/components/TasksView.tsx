import { useState, useEffect } from 'react'
import { PageTitle, Section } from './SkillsView'
import { CalendarClock, History, Plus, Trash2, Play, Clock } from 'lucide-react'
import { useStore } from '../store/appStore'
import { businessAgents } from '../data/mockAgents'
import { createTask, updateTask, deleteTask } from '../lib/backend'
import { getApiClient } from '../lib/api'

interface ScheduledTask {
  id: string
  name: string
  schedule: string
  agentId: string
  enabled: boolean
  lastRun?: string
  lastResult?: string
  status?: string
}

const DEFAULT_TASKS: ScheduledTask[] = [
  { id: 't1', name: '每日库存巡检', schedule: '每天 09:00', agentId: 'purchase', enabled: true },
  { id: 't2', name: '客户跟进提醒', schedule: '每周一/周四', agentId: 'crm', enabled: true },
  { id: 't3', name: '流向异常扫描', schedule: '每天 18:00', agentId: 'flow', enabled: false }
]

export default function TasksView() {
  const store = useStore()
  const [tasks, setTasks] = useState<ScheduledTask[]>(DEFAULT_TASKS)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formSchedule, setFormSchedule] = useState('')
  const [formAgent, setFormAgent] = useState(businessAgents[0]?.id ?? '')

  // 从后端加载任务列表
  useEffect(() => {
    if (!store.backendConnected) return
    const client = getApiClient()
    client.tasks.list().then((resp) => {
      if (resp.code === 0) {
        const items = (resp.data as Record<string, unknown>)?.items as ScheduledTask[]
        if (items && items.length > 0) setTasks(items)
      }
    }).catch(() => {})
  }, [store.backendConnected])

  const agentName = (id: string) => businessAgents.find((a) => a.id === id)?.name ?? id

  const addTask = async () => {
    if (!formName.trim() || !formSchedule.trim()) return
    const newTask: ScheduledTask = {
      id: `t_${Date.now()}`,
      name: formName.trim(),
      schedule: formSchedule.trim(),
      agentId: formAgent,
      enabled: true
    }
    // 先调后端创建
    if (store.backendConnected) {
      const created = await createTask({
        name: newTask.name, schedule: newTask.schedule, agentId: newTask.agentId, enabled: true
      })
      if (created) {
        newTask.id = (created as Record<string, unknown>).id as string
      }
    }
    setTasks((prev) => [...prev, newTask])
    setFormName('')
    setFormSchedule('')
    setShowForm(false)
  }

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    const newEnabled = !task?.enabled
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: newEnabled } : t)))
    if (store.backendConnected) {
      await updateTask(id, { enabled: newEnabled })
    }
  }

  const removeTask = async (id: string) => {
    if (store.backendConnected) {
      await deleteTask(id)
    }
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle icon={CalendarClock} title="自动任务" desc="定时任务、工作流编排与执行记录" />

      <Section title="定时任务">
        <div className="mb-3 flex justify-end">
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary h-9 px-3 text-xs">
            <Plus className="h-4 w-4" /> 新建任务
          </button>
        </div>

        {showForm && (
          <div className="card mb-3 space-y-3 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">任务名称</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例：每日库存巡检"
                className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">执行频率</label>
              <input
                value={formSchedule}
                onChange={(e) => setFormSchedule(e.target.value)}
                placeholder="例：每天 09:00 / 每周一"
                className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">执行智能体</label>
              <select
                value={formAgent}
                onChange={(e) => setFormAgent(e.target.value)}
                className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary outline-none focus:border-accent"
              >
                {businessAgents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost px-4">取消</button>
              <button onClick={addTask} disabled={!formName.trim() || !formSchedule.trim()} className="btn-primary px-4 disabled:opacity-50">
                创建
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="card py-8 text-center text-sm text-text-muted">暂无定时任务</div>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="card flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated">
                    <Clock className="h-4 w-4 text-text-muted" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text-primary">{t.name}</div>
                    <div className="text-xs text-text-muted">{t.schedule} · {agentName(t.agentId)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTask(t.id)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                      t.enabled
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-bg-hover text-text-muted'
                    }`}
                  >
                    {t.enabled ? '已启用' : '已停用'}
                  </button>
                  <button onClick={() => removeTask(t.id)} className="icon-btn h-8 w-8 text-rose-500 hover:text-rose-600" title="删除">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Section>

      <Section title="执行历史">
        <div className="card overflow-hidden">
          {store.creditLedger.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">暂无执行记录</div>
          ) : (
            store.creditLedger.map((e, i) => (
              <div
                key={e.id}
                className={`flex items-center justify-between px-4 py-3 ${i !== store.creditLedger.length - 1 ? 'border-b border-border-subtle' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <History className="h-4 w-4 text-text-muted" />
                  <div>
                    <div className="text-sm text-text-primary">{e.reason}</div>
                    <div className="text-xs text-text-muted">{e.time} · {e.agentName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-text-muted">消耗 {e.amount} 积分</span>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                    <Play className="h-3 w-3" /> 成功
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  )
}
