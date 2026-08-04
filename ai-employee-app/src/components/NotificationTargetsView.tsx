import { useState } from 'react'
import {
  Bell,
  Plus,
  Trash2,
  Edit3,
  X,
  Save,
  Phone,
  Mail,
  User,
  Building,
} from 'lucide-react'

interface NotificationTarget {
  id: string
  name: string
  role: string
  phone: string
  email: string
  department: string
  channels: string[]
  enabled: boolean
}

const channelLabels: Record<string, string> = {
  wecom: '企微消息',
  sms: '短信',
  email: '邮件',
  inApp: '应用内通知',
}

const channelColors: Record<string, string> = {
  wecom: 'bg-green-100 text-green-700',
  sms: 'bg-blue-100 text-blue-700',
  email: 'bg-orange-100 text-orange-700',
  inApp: 'bg-purple-100 text-purple-700',
}

const defaultTargets: NotificationTarget[] = [
  {
    id: '1',
    name: '张经理',
    role: '运营经理',
    phone: '138****8888',
    email: 'zhang@example.com',
    department: '运营部',
    channels: ['wecom', 'inApp'],
    enabled: true,
  },
  {
    id: '2',
    name: '李客服',
    role: '客服主管',
    phone: '139****6666',
    email: 'li@example.com',
    department: '客服部',
    channels: ['wecom', 'sms'],
    enabled: true,
  },
  {
    id: '3',
    name: '王总监',
    role: '销售总监',
    phone: '137****9999',
    email: 'wang@example.com',
    department: '销售部',
    channels: ['email'],
    enabled: false,
  },
]

export default function NotificationTargetsView() {
  const [targets, setTargets] = useState<NotificationTarget[]>(defaultTargets)
  const [editingTarget, setEditingTarget] = useState<NotificationTarget | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const toggleEnabled = (id: string) => {
    setTargets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    )
  }

  const deleteTarget = (id: string) => {
    setTargets((prev) => prev.filter((t) => t.id !== id))
  }

  const saveTarget = (target: NotificationTarget) => {
    if (editingTarget) {
      setTargets((prev) => prev.map((t) => (t.id === target.id ? target : t)))
    } else {
      setTargets((prev) => [...prev, { ...target, id: String(Date.now()) }])
    }
    setEditingTarget(null)
    setShowAddModal(false)
  }

  return (
    <div className="h-full overflow-y-auto bg-bg-base p-6">
      {/* 页头 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-text-primary">
            <Bell className="h-6 w-6 text-[#07c160]" />
            通知对象
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            管理人工介入、系统告警等事件的通知接收人
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTarget(null)
            setShowAddModal(true)
          }}
          className="flex items-center gap-1.5 rounded-lg bg-[#07c160] px-4 py-2 text-sm font-medium text-white hover:bg-[#06ad56]"
        >
          <Plus className="h-4 w-4" />
          添加通知对象
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border-subtle bg-white p-4">
          <p className="text-xs text-text-muted">通知对象总数</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{targets.length}</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-white p-4">
          <p className="text-xs text-text-muted">已启用</p>
          <p className="mt-1 text-2xl font-bold text-[#07c160]">
            {targets.filter((t) => t.enabled).length}
          </p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-white p-4">
          <p className="text-xs text-text-muted">已停用</p>
          <p className="mt-1 text-2xl font-bold text-gray-400">
            {targets.filter((t) => !t.enabled).length}
          </p>
        </div>
      </div>

      {/* 通知对象列表 */}
      <div className="rounded-xl border border-border-subtle bg-white">
        <div className="border-b border-border-subtle px-5 py-3">
          <h2 className="text-sm font-semibold text-text-primary">通知对象列表</h2>
        </div>
        <div className="divide-y divide-border-subtle">
          {targets.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm text-text-muted">暂无通知对象</p>
              <p className="mt-1 text-xs text-text-muted">点击右上角"添加通知对象"创建</p>
            </div>
          ) : (
            targets.map((target) => (
              <div
                key={target.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50"
              >
                {/* 头像 */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#07c160] to-[#06ad56] text-sm font-semibold text-white">
                  {target.name[0]}
                </div>

                {/* 信息 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{target.name}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                      {target.role}
                    </span>
                    <span className="text-xs text-text-muted">{target.department}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {target.phone || '未设置'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {target.email || '未设置'}
                    </span>
                  </div>
                </div>

                {/* 通知渠道 */}
                <div className="flex items-center gap-1.5">
                  {target.channels.map((ch) => (
                    <span
                      key={ch}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${channelColors[ch]}`}
                    >
                      {channelLabels[ch]}
                    </span>
                  ))}
                </div>

                {/* 操作 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleEnabled(target.id)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      target.enabled ? 'bg-[#07c160]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        target.enabled ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => {
                      setEditingTarget(target)
                      setShowAddModal(true)
                    }}
                    className="text-gray-400 hover:text-[#07c160]"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteTarget(target.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 添加/编辑弹窗 */}
      {showAddModal && (
        <TargetEditModal
          target={editingTarget}
          onSave={saveTarget}
          onClose={() => {
            setEditingTarget(null)
            setShowAddModal(false)
          }}
        />
      )}
    </div>
  )
}

/** 通知对象编辑弹窗 */
function TargetEditModal({
  target,
  onSave,
  onClose,
}: {
  target: NotificationTarget | null
  onSave: (target: NotificationTarget) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<NotificationTarget>(
    target || {
      id: '',
      name: '',
      role: '',
      phone: '',
      email: '',
      department: '',
      channels: ['wecom'],
      enabled: true,
    }
  )

  const toggleChannel = (ch: string) => {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter((c) => c !== ch)
        : [...prev.channels, ch],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-[460px] rounded-xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            {target ? '编辑通知对象' : '添加通知对象'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs text-text-muted">
                <User className="h-3 w-3" /> 姓名
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="通知对象姓名"
                className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm outline-none focus:border-[#07c160]"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs text-text-muted">
                <Building className="h-3 w-3" /> 部门
              </label>
              <input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="所属部门"
                className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm outline-none focus:border-[#07c160]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">角色/职务</label>
            <input
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="如：运营经理、客服主管"
              className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm outline-none focus:border-[#07c160]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs text-text-muted">
                <Phone className="h-3 w-3" /> 手机号
              </label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="手机号码"
                className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm outline-none focus:border-[#07c160]"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs text-text-muted">
                <Mail className="h-3 w-3" /> 邮箱
              </label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="电子邮箱"
                className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm outline-none focus:border-[#07c160]"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs text-text-muted">通知渠道</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(channelLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleChannel(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.channels.includes(key)
                      ? channelColors[key]
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-4 py-1.5 text-sm text-text-secondary hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={() => form.name.trim() && onSave(form)}
            disabled={!form.name.trim()}
            className="flex items-center gap-1 rounded-lg bg-[#07c160] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#06ad56] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
