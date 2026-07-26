import { useState, useEffect } from 'react'
import { CalendarClock, Search, Plus, Clock, Trash2, Play, History } from 'lucide-react'
import { useStore } from '../store/appStore'
import { businessAgents } from '../data/mockAgents'
import { createTask, updateTask, deleteTask } from '../lib/backend'
import { getApiClient } from '../lib/api'
import type { CreditEntry } from '../store/appStore'
import { Section } from './SkillsView'

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
  { id: 't1', name: '每日采购报表', schedule: '每天 09:00', agentId: 'purchase', enabled: true },
  { id: 't2', name: '库存预警检查', schedule: '每天 08:00', agentId: 'purchase', enabled: true },
  { id: 't3', name: '客户回访提醒', schedule: '每周一 10:00', agentId: 'crm', enabled: true },
  { id: 't4', name: '流向异常巡检', schedule: '每天 14:00', agentId: 'flow', enabled: true },
  { id: 't5', name: '月度经营报告', schedule: '每月1日 09:00', agentId: 'ops', enabled: true }
]

const DEFAULT_HISTORY: CreditEntry[] = [
  { id: 'h1', agentId: 'purchase', agentName: '采购兔', amount: 12, reason: '采购补货', time: '2026/7/26 12:15:24', balanceAfter: 188 },
  { id: 'h2', agentId: 'purchase', agentName: '采购兔', amount: 12, reason: '采购补货', time: '2026/7/26 12:15:24', balanceAfter: 176 }
]

export default function TasksView() {
  const store = useStore()
  const [tasks, setTasks] = useState<ScheduledTask[]>(DEFAULT_TASKS)
  const [search, setSearch] = useState('')
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

  const filteredTasks = tasks.filter((t) => t.name.toLowerCase().includes(search.toLowerCase().trim()))

  const addTask = async () => {
    if (!formName.trim() || !formSchedule.trim()) return
    const newTask: ScheduledTask = {
      id: `t_${Date.now()}`,
      name: formName.trim(),
      schedule: formSchedule.trim(),
      agentId: formAgent,
      enabled: true
    }
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

  const history = store.creditLedger.length > 0 ? store.creditLedger : DEFAULT_HISTORY

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* 页面头部：标题与操作区 */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
            <CalendarClock className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">自动任务</h2>
            <p className="mt-0.5 text-sm text-text-secondary">定时任务、工作流编排与执行记录</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索"
              className="h-9 w-52 rounded-lg border border-border-subtle bg-bg-surface pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            新建任务
          </button>
        </div>
      </div>

      {/* 新建任务表单 */}
      {showForm && (
        <div className="mb-5 rounded-xl border border-border-subtle bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
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
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="h-8 rounded-lg border border-border-subtle px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover"
            >
              取消
            </button>
            <button
              onClick={addTask}
              disabled={!formName.trim() || !formSchedule.trim()}
              className="h-8 rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              创建
            </button>
          </div>
        </div>
      )}

      {/* 定时任务卡片列表 */}
      <div className="mb-8 space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="rounded-xl border border-border-subtle bg-white py-10 text-center text-sm text-text-muted shadow-sm">
            暂无定时任务
          </div>
        ) : (
          filteredTasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-border-subtle bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-elevated">
                  <Clock className="h-5 w-5 text-text-muted" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-primary">{t.name}</div>
                  <div className="mt-0.5 text-xs text-text-muted">{t.schedule}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleTask(t.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    t.enabled
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-bg-elevated text-text-muted'
                  }`}
                >
                  {t.enabled ? '已启用' : '已停用'}
                </button>
                <button
                  onClick={() => removeTask(t.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50"
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 执行历史 */}
      <Section title="执行历史">
        <div className="rounded-xl border border-border-subtle bg-white shadow-sm">
          {history.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">暂无执行记录</div>
          ) : (
            history.map((e, i) => (
              <div
                key={e.id}
                className={`flex items-center justify-between px-4 py-3 ${i !== history.length - 1 ? 'border-b border-border-subtle' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-elevated">
                    <History className="h-4 w-4 text-text-muted" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text-primary">{e.reason}</div>
                    <div className="mt-0.5 text-xs text-text-muted">{e.time} · {e.agentName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted">消耗 {e.amount} 积分</span>
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <Play className="h-3 w-3 fill-current" /> 成功
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
