import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  ChevronLeft,
  Type,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  Link2,
  Smartphone,
  PlaySquare,
  Smile,
  Save,
  Users,
  Clock,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Circle,
  TrendingUp,
  Megaphone,
} from 'lucide-react'
import { getApiClient } from '../lib/api'
import { API_BUSINESS_CODE } from '../lib/constants'
import type {
  WecomDevice,
  MassSendTask,
  MassSendMaterial,
  MassSendTaskPayload,
} from '../types'

// ============================================================
// 常量
// ============================================================

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '待执行' },
  { value: 'enabled', label: '已开启' },
  { value: 'disabled', label: '已关闭' },
]

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: '待执行', cls: 'bg-gray-500/15 text-gray-400' },
  enabled: { label: '已开启', cls: 'bg-green-500/15 text-green-400' },
  disabled: { label: '已关闭', cls: 'bg-red-500/15 text-red-400' },
  approved: { label: '审核通过', cls: 'bg-blue-500/15 text-blue-400' },
  rejected: { label: '审核拒绝', cls: 'bg-orange-500/15 text-orange-400' },
}

const MSG_TYPES: Array<{ key: MassSendMaterial['msg_type']; label: string; icon: typeof Type }> = [
  { key: 'text', label: '文本', icon: Type },
  { key: 'image', label: '图片', icon: ImageIcon },
  { key: 'video', label: '视频', icon: Video },
  { key: 'audio', label: '语音', icon: Mic },
  { key: 'file', label: '文件', icon: FileText },
  { key: 'link', label: '链接', icon: Link2 },
  { key: 'miniprogram', label: '小程序', icon: Smartphone },
  { key: 'channel', label: '视频号', icon: PlaySquare },
]

const TARGET_TYPES = [
  { value: 'contact', label: '指定好友' },
  { value: 'group', label: '指定群聊' },
  { value: 'all', label: '全部好友' },
]

const TONE_OPTIONS = [
  { value: '', label: '请选择调色要求' },
  { value: 'professional', label: '专业正式' },
  { value: 'friendly', label: '亲切友好' },
  { value: 'lively', label: '活泼热情' },
  { value: 'calm', label: '稳重平和' },
]

// ============================================================
// 主组件
// ============================================================

export default function MassSendTab() {
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)

  if (view === 'edit') {
    return <TaskEditPage taskId={editingTaskId} onBack={() => { setView('list'); setEditingTaskId(null) }} />
  }
  return (
    <TaskListPage
      onEdit={(id) => { setEditingTaskId(id); setView('edit') }}
      onCreate={() => { setEditingTaskId(null); setView('edit') }}
    />
  )
}

// ============================================================
// 设备选择 Hook
// ============================================================

function useDevices() {
  const api = getApiClient()
  const [devices, setDevices] = useState<WecomDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const res = await api.wecom.devices.list()
      if (res.code === API_BUSINESS_CODE.SUCCESS) {
        const list = res.data as unknown as WecomDevice[]
        setDevices(list)
        if (list.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(list[0].id)
        }
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { devices, selectedDeviceId, setSelectedDeviceId, loading }
}

// ============================================================
// 任务列表页
// ============================================================

function TaskListPage({ onEdit, onCreate }: { onEdit: (id: number) => void; onCreate: () => void }) {
  const api = getApiClient()
  const { devices, selectedDeviceId, setSelectedDeviceId, loading: loadingDevices } = useDevices()

  const [tasks, setTasks] = useState<MassSendTask[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // 筛选
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [creatorFilter, setCreatorFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const loadTasks = useCallback(async () => {
    if (!selectedDeviceId) return
    setLoading(true)
    const res = await api.marketing.massSendTasks.list({
      search,
      status: statusFilter,
      created_by: creatorFilter,
      start_date: startDate,
      end_date: endDate,
    })
    if (res.code === API_BUSINESS_CODE.SUCCESS) {
      const list = (res.data as { list: MassSendTask[] }).list
      setTasks(list.filter(t => t.device === selectedDeviceId))
    }
    setLoading(false)
  }, [selectedDeviceId, search, statusFilter, creatorFilter, startDate, endDate])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleToggle = async (taskId: number, currentEnabled: boolean) => {
    const action = currentEnabled ? 'disable' : 'enable'
    const res = await api.marketing.massSendTasks.toggle(taskId, action)
    if (res.code === API_BUSINESS_CODE.SUCCESS) {
      loadTasks()
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`确认删除选中的 ${selectedIds.size} 个任务？`)) return
    const res = await api.marketing.massSendTasks.batchDelete(Array.from(selectedIds))
    if (res.code === API_BUSINESS_CODE.SUCCESS) {
      setSelectedIds(new Set())
      loadTasks()
    }
  }

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(tasks.map(t => t.id)))
    }
  }

  if (loadingDevices) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部：设备选择 + 筛选 */}
      <div className="space-y-3 border-b border-border-subtle px-6 py-4">
        {/* 设备选择 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-muted">企微设备：</span>
          <select
            value={selectedDeviceId ?? ''}
            onChange={e => setSelectedDeviceId(Number(e.target.value))}
            className="rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          >
            {devices.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* 筛选行 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索任务名称"
              className="w-44 rounded-lg border border-border-subtle bg-bg-base py-1.5 pl-8 pr-3 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            value={creatorFilter}
            onChange={e => setCreatorFilter(e.target.value)}
            placeholder="创建者"
            className="w-32 rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          />
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          />
          <span className="text-text-muted">~</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          />
          <button
            onClick={loadTasks}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/80"
          >
            查询
          </button>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setCreatorFilter(''); setStartDate(''); setEndDate('') }}
            className="rounded-lg border border-border-subtle px-4 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
          >
            重置
          </button>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-text-muted">
            <Megaphone className="h-8 w-8 opacity-30" />
            <span className="text-sm">暂无精准群发任务</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 全选 */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
              >
                {selectedIds.size === tasks.length && tasks.length > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                全选
              </button>
            </div>

            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                selected={selectedIds.has(task.id)}
                onToggleSelect={() => toggleSelect(task.id)}
                onEdit={() => onEdit(task.id)}
                onToggleEnabled={() => handleToggle(task.id, task.is_enabled)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between border-t border-border-subtle px-6 py-3">
        <button
          onClick={handleBatchDelete}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 transition-colors enabled:hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          批量删除 {selectedIds.size > 0 && `(${selectedIds.size})`}
        </button>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80"
        >
          <Plus className="h-4 w-4" />
          新增任务
        </button>
      </div>
    </div>
  )
}

// ============================================================
// 任务卡片
// ============================================================

function TaskCard({
  task,
  selected,
  onToggleSelect,
  onEdit,
  onToggleEnabled,
}: {
  task: MassSendTask
  selected: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onToggleEnabled: () => void
}) {
  const badge = STATUS_BADGE[task.status] ?? STATUS_BADGE.draft
  const steps = [
    { label: '群发素材', done: task.materials.length > 0 },
    { label: '发送对象', done: task.target != null },
    { label: '任务执行时间', done: task.schedule != null },
  ]

  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      selected ? 'border-accent bg-accent/5' : 'border-border-subtle bg-bg-card hover:border-border-default'
    }`}>
      <div className="flex items-start gap-3">
        {/* 复选框 */}
        <button onClick={onToggleSelect} className="mt-0.5 flex-shrink-0">
          {selected ? (
            <CheckCircle2 className="h-5 w-5 text-accent" />
          ) : (
            <Circle className="h-5 w-5 text-text-muted" />
          )}
        </button>

        {/* 主体 */}
        <div className="min-w-0 flex-1">
          {/* 第一行：任务名 + 状态 + 编辑 */}
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 hover:text-accent">
              <span className="font-medium text-text-primary">{task.name}</span>
              <Pencil className="h-3.5 w-3.5 text-text-muted" />
            </button>
            <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
          </div>

          {/* 第二行：创建者 / 创建时间 / 开启人 */}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-text-muted">
            <span>创建者：{task.created_by || '—'}</span>
            <span>创建时间：{task.created_at?.slice(0, 16).replace('T', ' ') || '—'}</span>
            {task.started_by && <span>开启人：{task.started_by}</span>}
          </div>

          {/* 第三行：执行准备 3 步 */}
          <div className="mt-3 flex items-center gap-4">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {step.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-text-muted" />
                )}
                <span className={`text-xs ${step.done ? 'text-text-secondary' : 'text-text-muted'}`}>
                  {i + 1}. {step.label}
                </span>
              </div>
            ))}
            {/* 每日循环 */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">每日循环执行</span>
              <span className={task.daily_loop ? 'text-green-500' : 'text-text-muted'}>
                {task.daily_loop ? '✓' : '✗'}
              </span>
            </div>
          </div>

          {/* 第四行：统计 */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            <StatItem label="计划总人数" value={task.planned_total} />
            <StatItem label="计划成功数" value={task.planned_success} color="text-green-400" />
            <StatItem label="计划待执行数" value={task.planned_pending} color="text-blue-400" />
            <StatItem label="计划失败数" value={task.planned_failed} color="text-red-400" />
            <StatItem label="网络异常数" value={task.planned_network_error} color="text-orange-400" />
            <StatItem label="已禁用" value={task.disabled_count} color="text-gray-400" />
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-purple-400" />
              <span className="text-text-muted">好友回复率</span>
              <span className="text-purple-400">{(task.reply_rate * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* 开关 */}
        <button onClick={onToggleEnabled} className="flex-shrink-0">
          {task.is_enabled ? (
            <ToggleRight className="h-8 w-8 text-green-500" />
          ) : (
            <ToggleLeft className="h-8 w-8 text-text-muted" />
          )}
        </button>
      </div>
    </div>
  )
}

function StatItem({ label, value, color = 'text-text-primary' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-text-muted">{label}</span>
      <span className={color}>{value}</span>
    </div>
  )
}

// ============================================================
// 任务编辑页
// ============================================================

function TaskEditPage({ taskId, onBack }: { taskId: number | null; onBack: () => void }) {
  const api = getApiClient()
  const { devices, selectedDeviceId, setSelectedDeviceId, loading: loadingDevices } = useDevices()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [dailyLoop, setDailyLoop] = useState(false)

  // 素材
  const [materials, setMaterials] = useState<Array<{
    id?: number
    order: number
    msg_type: MassSendMaterial['msg_type']
    content: MassSendMaterial['content']
  }>>([])
  const [activeMsgType, setActiveMsgType] = useState<MassSendMaterial['msg_type']>('text')

  // 文本编辑
  const [textContent, setTextContent] = useState('')
  const [insertGreeting, setInsertGreeting] = useState(false)
  const [fallbackText, setFallbackText] = useState('')
  const [toneOption, setToneOption] = useState('')

  // 发送对象
  const [targetType, setTargetType] = useState<'contact' | 'group' | 'all'>('contact')
  const [tagIds, setTagIds] = useState<number[]>([])
  const [contactIds, setContactIds] = useState<number[]>([])
  const [groupIds, setGroupIds] = useState<number[]>([])

  // 执行时间
  const [scheduledAt, setScheduledAt] = useState('')
  const [dailyStartTime, setDailyStartTime] = useState('')
  const [dailyEndTime, setDailyEndTime] = useState('')
  const [dailyInterval, setDailyInterval] = useState(0)

  // 加载已有任务
  useEffect(() => {
    if (taskId) {
      const load = async () => {
        setLoading(true)
        const res = await api.marketing.massSendTasks.get(taskId)
        if (res.code === API_BUSINESS_CODE.SUCCESS) {
          const task = res.data as MassSendTask
          setTaskName(task.name)
          setDailyLoop(task.daily_loop)
          setSelectedDeviceId(task.device)
          if (task.materials?.length > 0) {
            setMaterials(task.materials.map(m => ({ id: m.id, order: m.order, msg_type: m.msg_type, content: m.content })))
            const first = task.materials[0]
            setActiveMsgType(first.msg_type)
            if (first.msg_type === 'text') {
              setTextContent(first.content.text || '')
              setInsertGreeting(first.content.insert_greeting ?? false)
              setFallbackText(first.content.fallback_text || '')
            }
          }
          if (task.target) {
            setTargetType(task.target.target_type)
            setTagIds(task.target.tag_ids || [])
            setContactIds(task.target.contact_ids || [])
            setGroupIds(task.target.group_ids || [])
          }
          if (task.schedule) {
            setScheduledAt(task.schedule.scheduled_at?.slice(0, 16) || '')
            setDailyStartTime(task.schedule.daily_start_time || '')
            setDailyEndTime(task.schedule.daily_end_time || '')
            setDailyInterval(task.schedule.daily_interval || 0)
          }
        }
        setLoading(false)
      }
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  // 添加并预览
  const handleAddMaterial = () => {
    const content: MassSendMaterial['content'] = {}
    if (activeMsgType === 'text') {
      content.text = textContent
      content.insert_greeting = insertGreeting
      content.fallback_text = fallbackText
    }
    setMaterials(prev => [...prev, { order: prev.length, msg_type: activeMsgType, content }])
    setTextContent('')
    setInsertGreeting(false)
    setFallbackText('')
  }

  // 保存
  const handleSave = async () => {
    if (!taskName.trim()) { alert('请输入任务名称'); return }
    if (!selectedDeviceId) { alert('请选择企微设备'); return }
    if (materials.length === 0) { alert('请至少添加一条群发素材'); return }

    setSaving(true)
    const payload: MassSendTaskPayload = {
      device: selectedDeviceId,
      name: taskName.trim(),
      daily_loop: dailyLoop,
      materials: materials.map((m, i) => ({
        order: i,
        msg_type: m.msg_type,
        content: m.content,
      })),
      target: {
        target_type: targetType,
        tag_ids: tagIds,
        contact_ids: contactIds,
        group_ids: groupIds,
      },
      schedule: {
        scheduled_at: scheduledAt || null,
        daily_start_time: dailyStartTime || null,
        daily_end_time: dailyEndTime || null,
        daily_interval: dailyInterval,
      },
    }

    const res = taskId
      ? await api.marketing.massSendTasks.update(taskId, payload)
      : await api.marketing.massSendTasks.create(payload)

    setSaving(false)
    if (res.code === API_BUSINESS_CODE.SUCCESS) {
      onBack()
    } else {
      alert(res.msg || '保存失败')
    }
  }

  if (loadingDevices || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3 border-b border-border-subtle px-6 py-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ChevronLeft className="h-4 w-4" />
          返回列表
        </button>
        <span className="text-text-muted">|</span>
        <span className="text-sm font-medium text-text-primary">{taskId ? '编辑任务' : '新建任务'}</span>
      </div>

      {/* 任务名称 + 设备 */}
      <div className="flex items-center gap-4 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">任务名称</span>
          <input
            value={taskName}
            onChange={e => setTaskName(e.target.value)}
            placeholder="请输入任务名称"
            className="w-64 rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">企微设备</span>
          <select
            value={selectedDeviceId ?? ''}
            onChange={e => setSelectedDeviceId(Number(e.target.value))}
            className="rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          >
            {devices.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 主体：左编辑器 + 右预览 */}
      <div className="flex flex-1 gap-4 overflow-hidden px-6 pb-4">
        {/* 左侧：内容编辑器 */}
        <div className="flex w-1/2 flex-col rounded-xl border border-border-subtle bg-bg-card p-4">
          {/* 消息类型 Tab */}
          <div className="flex flex-wrap gap-1 border-b border-border-subtle pb-2">
            {MSG_TYPES.map(mt => (
              <button
                key={mt.key}
                onClick={() => setActiveMsgType(mt.key)}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeMsgType === mt.key
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-bg-hover'
                }`}
              >
                <mt.icon className="h-3.5 w-3.5" />
                {mt.label}
              </button>
            ))}
          </div>

          {/* 编辑区 */}
          <div className="flex-1 overflow-y-auto py-3">
            {activeMsgType === 'text' && (
              <div className="space-y-3">
                {/* 插入称呼 */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <button
                      onClick={() => setInsertGreeting(!insertGreeting)}
                      className={insertGreeting ? 'text-green-500' : 'text-text-muted'}
                    >
                      {insertGreeting ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                    </button>
                    <span className="text-sm text-text-secondary">插入称呼</span>
                  </label>
                  {insertGreeting && (
                    <input
                      value={fallbackText}
                      onChange={e => setFallbackText(e.target.value)}
                      placeholder="无称呼时兜底文案"
                      className="flex-1 rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                    />
                  )}
                </div>

                {/* 文本输入 */}
                <div className="relative">
                  <textarea
                    value={textContent}
                    onChange={e => setTextContent(e.target.value.slice(0, 500))}
                    placeholder="请输入消息内容..."
                    className="h-40 w-full resize-none rounded-lg border border-border-subtle bg-bg-base p-3 text-sm text-text-primary outline-none focus:border-accent"
                  />
                  <div className="absolute bottom-2 right-3 text-xs text-text-muted">
                    {textContent.length}/500
                  </div>
                </div>

                {/* 工具栏 */}
                <div className="flex items-center gap-2">
                  <button className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover">
                    <Smile className="h-4 w-4" />
                  </button>
                  <select
                    value={toneOption}
                    onChange={e => setToneOption(e.target.value)}
                    className="rounded-lg border border-border-subtle bg-bg-base px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                  >
                    {TONE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button className="text-xs text-accent hover:underline">管理模板</button>
                  <button className="text-xs text-accent hover:underline">立即润色</button>
                </div>

                {/* 添加并预览 */}
                <button
                  onClick={handleAddMaterial}
                  className="w-full rounded-lg border border-accent/30 bg-accent/5 py-2 text-sm font-medium text-accent hover:bg-accent/10"
                >
                  添加并预览
                </button>
              </div>
            )}

            {activeMsgType !== 'text' && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
                {(() => {
                  const Icon = MSG_TYPES.find(m => m.key === activeMsgType)?.icon
                  return Icon ? <Icon className="h-10 w-10 opacity-30" /> : null
                })()}
                <span className="text-sm">{MSG_TYPES.find(m => m.key === activeMsgType)?.label}素材上传（开发中）</span>
                <button
                  onClick={handleAddMaterial}
                  className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-1.5 text-sm text-accent hover:bg-accent/10"
                >
                  添加并预览
                </button>
              </div>
            )}
          </div>

          {/* 已添加素材列表 */}
          {materials.length > 0 && (
            <div className="border-t border-border-subtle pt-2">
              <div className="mb-1.5 text-xs text-text-muted">已添加素材（{materials.length}条）</div>
              <div className="max-h-24 space-y-1 overflow-y-auto">
                {materials.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-bg-base px-2 py-1 text-xs">
                    <span className="text-text-muted">{i + 1}.</span>
                    <span className="text-text-secondary">{MSG_TYPES.find(mt => mt.key === m.msg_type)?.label}</span>
                    <span className="flex-1 truncate text-text-muted">
                      {m.msg_type === 'text' ? m.content.text : '(素材)'}
                    </span>
                    <button
                      onClick={() => setMaterials(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：手机预览 */}
        <div className="flex w-1/2 flex-col items-center rounded-xl border border-border-subtle bg-bg-card p-4">
          <div className="mb-2 text-sm text-text-muted">消息预览</div>
          <div className="relative flex h-[480px] w-[280px] flex-col overflow-hidden rounded-[2rem] border-4 border-gray-700 bg-white">
            {/* 状态栏 */}
            <div className="flex items-center justify-between bg-gray-800 px-4 py-1 text-[10px] text-white">
              <span>9:41</span>
              <span>企微</span>
              <span>100%</span>
            </div>
            {/* 聊天区域 */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
              {materials.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">
                  暂无内容
                </div>
              ) : (
                <div className="space-y-2">
                  {materials.map((m, i) => (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[200px] rounded-lg bg-green-500 px-3 py-2 text-xs text-white">
                        {m.msg_type === 'text' ? (
                          <span className="whitespace-pre-wrap">
                            {insertGreeting && m.content.insert_greeting && '[称呼] '}
                            {m.content.text}
                          </span>
                        ) : (
                          <span className="italic">[{MSG_TYPES.find(mt => mt.key === m.msg_type)?.label}]</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部：3 步执行准备 + 保存 */}
      <div className="space-y-3 border-t border-border-subtle px-6 py-3">
        {/* 步骤 2：发送对象 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">发送对象</span>
          </div>
          <select
            value={targetType}
            onChange={e => setTargetType(e.target.value as typeof targetType)}
            className="rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          >
            {TARGET_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {targetType !== 'all' && (
            <span className="text-xs text-text-muted">
              已选 {targetType === 'contact' ? `${contactIds.length} 位好友` : `${groupIds.length} 个群聊`}
            </span>
          )}
        </div>

        {/* 步骤 3：执行时间 */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">执行时间</span>
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="rounded-lg border border-border-subtle bg-bg-base px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <button
              onClick={() => setDailyLoop(!dailyLoop)}
              className={dailyLoop ? 'text-green-500' : 'text-text-muted'}
            >
              {dailyLoop ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
            </button>
            <span className="text-sm text-text-secondary">每日循环执行</span>
          </label>
          {dailyLoop && (
            <>
              <input
                type="time"
                value={dailyStartTime}
                onChange={e => setDailyStartTime(e.target.value)}
                className="rounded-lg border border-border-subtle bg-bg-base px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              />
              <span className="text-text-muted">~</span>
              <input
                type="time"
                value={dailyEndTime}
                onChange={e => setDailyEndTime(e.target.value)}
                className="rounded-lg border border-border-subtle bg-bg-base px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              />
              <span className="text-xs text-text-muted">间隔</span>
              <input
                type="number"
                value={dailyInterval}
                onChange={e => setDailyInterval(Number(e.target.value))}
                className="w-16 rounded-lg border border-border-subtle bg-bg-base px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              />
              <span className="text-xs text-text-muted">分钟</span>
            </>
          )}
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent/80 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存当前配置
          </button>
        </div>
      </div>
    </div>
  )
}
