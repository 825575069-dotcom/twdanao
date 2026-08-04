import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  ChevronLeft,
  Image as ImageIcon,
  Video,
  Link2,
  Save,
  Clock,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Circle,
  Camera,
  BookOpen,
  Sparkles,
  PlayCircle,
  FolderOpen,
  Users,
} from 'lucide-react'
import { getApiClient } from '../lib/api'
import { API_BUSINESS_CODE } from '../lib/constants'
import type {
  WecomDevice,
  MomentsTask,
  MomentsContent,
  MomentsTaskPayload,
} from '../types'

// ============================================================
// 常量
// ============================================================

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '待执行' },
  { value: 'enabled', label: '执行中' },
  { value: 'disabled', label: '已关闭' },
  { value: 'approved', label: '审核通过' },
  { value: 'rejected', label: '审核拒绝' },
]

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: '待执行', cls: 'bg-gray-500/15 text-gray-400' },
  enabled: { label: '执行中', cls: 'bg-green-500/15 text-green-400' },
  disabled: { label: '已关闭', cls: 'bg-red-500/15 text-red-400' },
  approved: { label: '审核通过', cls: 'bg-blue-500/15 text-blue-400' },
  rejected: { label: '审核拒绝', cls: 'bg-orange-500/15 text-orange-400' },
}

const MEDIA_TYPES: Array<{ key: MomentsContent['media_type']; label: string; icon: typeof ImageIcon }> = [
  { key: 'image', label: '图片', icon: ImageIcon },
  { key: 'video', label: '视频', icon: Video },
  { key: 'link', label: '链接', icon: Link2 },
]

const TONE_OPTIONS = [
  { value: '', label: '请选择调色要求' },
  { value: 'professional', label: '专业正式' },
  { value: 'friendly', label: '亲切友好' },
  { value: 'lively', label: '活泼热情' },
  { value: 'calm', label: '稳重平和' },
]

const PROMPT_OPTIONS = [
  { value: '', label: '请选择提示词' },
  { value: 'rewrite', label: '重写文案' },
  { value: 'optimize', label: '优化文案' },
  { value: 'expand', label: '扩写文案' },
]

// ============================================================
// 主组件
// ============================================================

export default function MomentsTab() {
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

  const [tasks, setTasks] = useState<MomentsTask[]>([])
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
    const res = await api.marketing.momentsTasks.list({
      search,
      status: statusFilter,
      created_by: creatorFilter,
      start_date: startDate,
      end_date: endDate,
    })
    if (res.code === API_BUSINESS_CODE.SUCCESS) {
      const data = res.data as { list: MomentsTask[] }
      setTasks(data.list.filter(t => t.device === selectedDeviceId))
    }
    setLoading(false)
  }, [selectedDeviceId, search, statusFilter, creatorFilter, startDate, endDate])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleToggle = async (taskId: number, currentEnabled: boolean) => {
    const action = currentEnabled ? 'disable' : 'enable'
    const res = await api.marketing.momentsTasks.toggle(taskId, action)
    if (res.code === API_BUSINESS_CODE.SUCCESS) {
      loadTasks()
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`确认删除选中的 ${selectedIds.size} 个任务？`)) return
    const res = await api.marketing.momentsTasks.batchDelete(Array.from(selectedIds))
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
      {/* 顶部：标题 + 设备选择 + 筛选 */}
      <div className="space-y-3 border-b border-border-subtle px-6 py-4">
        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold text-text-primary">朋友圈</h2>
          </div>
          <button className="flex items-center gap-1 text-sm text-accent hover:underline">
            <BookOpen className="h-3.5 w-3.5" />
            查看教程
          </button>
        </div>

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
            <Camera className="h-8 w-8 opacity-30" />
            <span className="text-sm">暂无朋友圈任务</span>
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
  task: MomentsTask
  selected: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onToggleEnabled: () => void
}) {
  const badge = STATUS_BADGE[task.status] ?? STATUS_BADGE.draft
  const steps = [
    { label: '配置内容', done: task.contents.length > 0 },
    { label: '选择微信', done: task.target != null && task.target.device_ids.length > 0 },
    { label: '任务执行时间', done: task.schedule != null },
  ]

  // 计算执行时长
  const execDuration = task.is_enabled && task.started_by ? '1分钟' : null

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
          {/* 第一行：任务名 + 编辑 + 状态 + 执行时长 */}
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 hover:text-accent">
              <span className="font-medium text-text-primary">{task.name}</span>
              <Pencil className="h-3.5 w-3.5 text-text-muted" />
            </button>
            <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
            {execDuration && (
              <span className="text-xs text-text-muted">执行时长：{execDuration}</span>
            )}
          </div>

          {/* 第二行：创建者 */}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-text-muted">
            <span>创建者：{task.created_by || '—'}</span>
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
            <StatItem label="微信总数" value={task.wechat_total} />
            <StatItem label="成功发送" value={task.success_sent} color="text-green-400" />
            <StatItem label="待执行" value={task.pending} color="text-blue-400" />
            <StatItem label="发送失败" value={task.failed} color="text-red-400" />
            <StatItem label="网络异常" value={task.network_error} color="text-orange-400" />
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

  // 内容编辑
  const [textContent, setTextContent] = useState('')
  const [randomEmoji, setRandomEmoji] = useState(false)
  const [activeMediaType, setActiveMediaType] = useState<MomentsContent['media_type']>('image')
  const [mediaUrls, setMediaUrls] = useState<string[]>([])

  // AI 润色
  const [aiPolishEnabled, setAiPolishEnabled] = useState(false)
  const [toneTemplate, setToneTemplate] = useState('')
  const [promptTemplate, setPromptTemplate] = useState('')

  // 链接内容
  const [linkTitle, setLinkTitle] = useState('')
  const [linkDesc, setLinkDesc] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkPicUrl, setLinkPicUrl] = useState('')

  // 执行时间
  const [scheduledAt, setScheduledAt] = useState('')
  const [dailyStartTime, setDailyStartTime] = useState('')
  const [dailyEndTime, setDailyEndTime] = useState('')
  const [dailyInterval, setDailyInterval] = useState(0)

  // 已添加内容列表
  const [contents, setContents] = useState<Array<{
    order: number
    text: string
    random_emoji: boolean
    media_type: MomentsContent['media_type']
    media_urls: string[]
    link_title: string
    link_desc: string
    link_url: string
    link_pic_url: string
    ai_polish_enabled: boolean
    tone_template: string
    prompt_template: string
  }>>([])

  // 加载已有任务
  useEffect(() => {
    if (taskId) {
      const load = async () => {
        setLoading(true)
        const res = await api.marketing.momentsTasks.get(taskId)
        if (res.code === API_BUSINESS_CODE.SUCCESS) {
          const task = res.data as MomentsTask
          setTaskName(task.name)
          setDailyLoop(task.daily_loop)
          setSelectedDeviceId(task.device)
          if (task.contents?.length > 0) {
            const first = task.contents[0]
            setTextContent(first.text)
            setRandomEmoji(first.random_emoji)
            setActiveMediaType(first.media_type)
            setMediaUrls(first.media_urls || [])
            setAiPolishEnabled(first.ai_polish_enabled)
            setToneTemplate(first.tone_template)
            setPromptTemplate(first.prompt_template)
            setLinkTitle(first.link_title)
            setLinkDesc(first.link_desc)
            setLinkUrl(first.link_url)
            setLinkPicUrl(first.link_pic_url)
            setContents(task.contents.map(c => ({
              order: c.order,
              text: c.text,
              random_emoji: c.random_emoji,
              media_type: c.media_type,
              media_urls: c.media_urls || [],
              link_title: c.link_title,
              link_desc: c.link_desc,
              link_url: c.link_url,
              link_pic_url: c.link_pic_url,
              ai_polish_enabled: c.ai_polish_enabled,
              tone_template: c.tone_template,
              prompt_template: c.prompt_template,
            })))
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

  // 添加内容
  const handleAddContent = () => {
    setContents(prev => [...prev, {
      order: prev.length,
      text: textContent,
      random_emoji: randomEmoji,
      media_type: activeMediaType,
      media_urls: mediaUrls,
      link_title: linkTitle,
      link_desc: linkDesc,
      link_url: linkUrl,
      link_pic_url: linkPicUrl,
      ai_polish_enabled: aiPolishEnabled,
      tone_template: toneTemplate,
      prompt_template: promptTemplate,
    }])
    setTextContent('')
    setMediaUrls([])
    setLinkTitle('')
    setLinkDesc('')
    setLinkUrl('')
    setLinkPicUrl('')
  }

  // 保存
  const handleSave = async () => {
    if (!taskName.trim()) { alert('请输入任务名称'); return }
    if (!selectedDeviceId) { alert('请选择企微设备'); return }

    // 如果没有已添加内容，将当前编辑区内容也保存
    const allContents = contents.length > 0 ? contents : [{
      order: 0,
      text: textContent,
      random_emoji: randomEmoji,
      media_type: activeMediaType,
      media_urls: mediaUrls,
      link_title: linkTitle,
      link_desc: linkDesc,
      link_url: linkUrl,
      link_pic_url: linkPicUrl,
      ai_polish_enabled: aiPolishEnabled,
      tone_template: toneTemplate,
      prompt_template: promptTemplate,
    }]

    setSaving(true)
    const payload: MomentsTaskPayload = {
      device: selectedDeviceId,
      name: taskName.trim(),
      daily_loop: dailyLoop,
      contents: allContents.map((c, i) => ({
        order: i,
        text: c.text,
        random_emoji: c.random_emoji,
        media_type: c.media_type,
        media_urls: c.media_urls,
        link_title: c.link_title,
        link_desc: c.link_desc,
        link_url: c.link_url,
        link_pic_url: c.link_pic_url,
        ai_polish_enabled: c.ai_polish_enabled,
        tone_template: c.tone_template,
        prompt_template: c.prompt_template,
      })),
      target: {
        device_ids: [selectedDeviceId],
      },
      schedule: {
        scheduled_at: scheduledAt || null,
        daily_start_time: dailyStartTime || null,
        daily_end_time: dailyEndTime || null,
        daily_interval: dailyInterval,
      },
    }

    const res = taskId
      ? await api.marketing.momentsTasks.update(taskId, payload)
      : await api.marketing.momentsTasks.create(payload)

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
      {/* 顶部导航：面包屑 + 返回 + 保存 */}
      <div className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
            <ChevronLeft className="h-4 w-4" />
            返回
          </button>
          <span className="text-text-muted">|</span>
          <span className="text-sm text-text-muted">朋友圈</span>
          <span className="text-text-muted">/</span>
          <span className="text-sm font-medium text-text-primary">配置发送内容</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          保存内容
        </button>
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
        <div className="flex w-1/2 flex-col gap-3 overflow-y-auto">
          {/* 执行发送前润色卡片 */}
          <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/15">
                  <Sparkles className="h-4 w-4 text-green-500" />
                </div>
                <span className="text-sm font-medium text-text-primary">执行发送前润色</span>
              </div>
              <button
                onClick={() => setAiPolishEnabled(!aiPolishEnabled)}
                className={aiPolishEnabled ? 'text-green-500' : 'text-text-muted'}
              >
                {aiPolishEnabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
              </button>
            </div>
            {aiPolishEnabled && (
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={toneTemplate}
                  onChange={e => setToneTemplate(e.target.value)}
                  className="flex-1 rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                >
                  {TONE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button className="text-xs text-accent hover:underline whitespace-nowrap">管理要求模板</button>
              </div>
            )}
          </div>

          {/* 朋友圈文案 */}
          <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">朋友圈文案</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <button
                  onClick={() => setRandomEmoji(!randomEmoji)}
                  className={randomEmoji ? 'text-green-500' : 'text-text-muted'}
                >
                  {randomEmoji ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                </button>
                <span className="text-sm text-text-secondary">随机表情</span>
              </label>
            </div>
            <div className="relative">
              <textarea
                value={textContent}
                onChange={e => setTextContent(e.target.value.slice(0, 1000))}
                placeholder="请输入朋友圈文案..."
                className="h-32 w-full resize-none rounded-lg border border-border-subtle bg-bg-base p-3 text-sm text-text-primary outline-none focus:border-accent"
              />
              <div className="absolute bottom-2 right-3 text-xs text-text-muted">
                {textContent.length}/1000
              </div>
            </div>

            {/* 此刻立即润色操作条 */}
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-bg-base px-3 py-2">
              <select
                value={promptTemplate}
                onChange={e => setPromptTemplate(e.target.value)}
                className="rounded-lg border border-border-subtle bg-bg-card px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
              >
                {PROMPT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button className="text-xs text-accent hover:underline">管理提示词</button>
              <button className="text-xs text-accent hover:underline">立即润色</button>
              <button className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary">
                <PlayCircle className="h-3.5 w-3.5" />
                观看视频
              </button>
            </div>

            {/* 添加并预览 */}
            <button
              onClick={handleAddContent}
              className="mt-3 w-full rounded-lg border border-accent/30 bg-accent/5 py-2 text-sm font-medium text-accent hover:bg-accent/10"
            >
              添加并预览
            </button>
          </div>

          {/* 媒体内容 */}
          <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">媒体内容</span>
              <button className="flex items-center gap-1 text-xs text-accent hover:underline">
                <FolderOpen className="h-3.5 w-3.5" />
                选择资源库
              </button>
            </div>
            {/* 媒体类型 Tab */}
            <div className="flex gap-1 border-b border-border-subtle pb-2">
              {MEDIA_TYPES.map(mt => (
                <button
                  key={mt.key}
                  onClick={() => setActiveMediaType(mt.key)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeMediaType === mt.key
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  <mt.icon className="h-3.5 w-3.5" />
                  {mt.label}
                </button>
              ))}
            </div>

            {/* 媒体编辑区 */}
            <div className="mt-3">
              {activeMediaType === 'image' && (
                <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-subtle text-text-muted">
                  <ImageIcon className="h-8 w-8 opacity-30" />
                  <span className="text-xs">点击或拖拽上传图片</span>
                </div>
              )}
              {activeMediaType === 'video' && (
                <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-subtle text-text-muted">
                  <Video className="h-8 w-8 opacity-30" />
                  <span className="text-xs">点击或拖拽上传视频</span>
                </div>
              )}
              {activeMediaType === 'link' && (
                <div className="space-y-2">
                  <input
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="链接地址"
                    className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                  />
                  <input
                    value={linkTitle}
                    onChange={e => setLinkTitle(e.target.value)}
                    placeholder="链接标题"
                    className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                  />
                  <input
                    value={linkDesc}
                    onChange={e => setLinkDesc(e.target.value)}
                    placeholder="链接描述"
                    className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                  />
                  <input
                    value={linkPicUrl}
                    onChange={e => setLinkPicUrl(e.target.value)}
                    placeholder="缩略图 URL"
                    className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 已添加内容列表 */}
          {contents.length > 0 && (
            <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
              <div className="mb-1.5 text-xs text-text-muted">已添加内容（{contents.length}条）</div>
              <div className="max-h-24 space-y-1 overflow-y-auto">
                {contents.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-bg-base px-2 py-1 text-xs">
                    <span className="text-text-muted">{i + 1}.</span>
                    <span className="text-text-secondary">{MEDIA_TYPES.find(mt => mt.key === c.media_type)?.label}</span>
                    <span className="flex-1 truncate text-text-muted">{c.text || '(空文案)'}</span>
                    <button
                      onClick={() => setContents(prev => prev.filter((_, idx) => idx !== i))}
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
          <div className="mb-2 text-sm text-text-muted">朋友圈预览</div>
          <div className="relative flex h-[520px] w-[300px] flex-col overflow-hidden rounded-[2rem] border-4 border-gray-700 bg-white">
            {/* 状态栏 */}
            <div className="flex items-center justify-between bg-gray-800 px-4 py-1 text-[10px] text-white">
              <span>9:41</span>
              <span>企微</span>
              <span>100%</span>
            </div>
            {/* 朋友圈标题栏 */}
            <div className="flex items-center justify-between bg-gray-100 px-4 py-2">
              <span className="text-xs text-gray-600">朋友圈</span>
              <Camera className="h-3.5 w-3.5 text-gray-600" />
            </div>
            {/* 朋友圈内容区域 */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
              {/* 发文卡片 */}
              <div className="flex gap-2.5">
                {/* 头像 */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-400 to-green-600 text-xs text-white">
                  企微
                </div>
                {/* 内容 */}
                <div className="min-w-0 flex-1">
                  {/* 名称 */}
                  <div className="text-xs font-medium text-green-600">企微账号</div>
                  {/* 文案 */}
                  {(() => {
                    const previewText = textContent || (contents.length > 0 ? contents[0].text : '')
                    const showEmoji = randomEmoji || (contents.length > 0 && contents[0].random_emoji)
                    if (!previewText) {
                      return <div className="mt-0.5 text-xs text-gray-400 italic">暂无文案</div>
                    }
                    return (
                      <div className="mt-0.5 text-xs text-gray-800 leading-relaxed">
                        {previewText}
                        {showEmoji && <span className="ml-0.5">😊</span>}
                      </div>
                    )
                  })()}
                  {/* 媒体内容 */}
                  {(() => {
                    const mt = activeMediaType
                    const hasMedia = mediaUrls.length > 0 || (contents.length > 0 && contents[0].media_urls.length > 0)
                    if (mt === 'link' && linkUrl) {
                      return (
                        <div className="mt-2 flex gap-2 rounded-lg bg-gray-100 p-2">
                          {linkPicUrl ? (
                            <img src={linkPicUrl} alt="" className="h-12 w-12 rounded object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-300">
                              <Link2 className="h-4 w-4 text-gray-500" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-gray-700">{linkTitle || '链接标题'}</div>
                            <div className="truncate text-[10px] text-gray-500">{linkDesc || '链接描述'}</div>
                          </div>
                        </div>
                      )
                    }
                    if (mt === 'image' && hasMedia) {
                      return (
                        <div className="mt-2 grid grid-cols-3 gap-1">
                          {mediaUrls.slice(0, 6).map((url, i) => (
                            <img key={i} src={url} alt="" className="aspect-square rounded object-cover" />
                          ))}
                        </div>
                      )
                    }
                    if (mt === 'video' && hasMedia) {
                      return (
                        <div className="mt-2 relative aspect-video rounded-lg bg-gray-800">
                          <video src={mediaUrls[0]} className="h-full w-full rounded-lg object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <PlayCircle className="h-8 w-8 text-white/80" />
                          </div>
                        </div>
                      )
                    }
                    if (mt === 'image' && !hasMedia && contents.length === 0) {
                      return (
                        <div className="mt-2 flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-[10px] text-gray-400">
                          预览图片区域
                        </div>
                      )
                    }
                    return null
                  })()}
                  {/* 时间戳 */}
                  <div className="mt-1.5 text-[10px] text-gray-400">1秒钟前</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部：执行时间配置 */}
      <div className="space-y-3 border-t border-border-subtle px-6 py-3">
        {/* 步骤 2：选择微信 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">选择微信</span>
          </div>
          <span className="text-xs text-text-muted">
            已选 {selectedDeviceId ? '1' : '0'} 个微信号
          </span>
        </div>

        {/* 步骤 3：执行时间 */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">任务执行时间</span>
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
      </div>
    </div>
  )
}
