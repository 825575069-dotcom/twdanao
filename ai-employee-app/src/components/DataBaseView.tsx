import { useState } from 'react'
import { useStore, ICON_OPTIONS, ICON_REGISTRY } from '../store/appStore'
import type { DataBaseConnector, ConnectorType } from '../types'
import {
  Database,
  RefreshCw,
  Link2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  X,
  RotateCcw,
  Settings2,
  Search
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createConnector, updateConnector, deleteConnector } from '../lib/backend'

// 默认图标（用于新创建的系统）
import { Database as DefaultIcon } from 'lucide-react'

export default function DataBaseView() {
  const store = useStore()
  const connectors = store.dataBaseConnectors
  const linkedCount = connectors.filter((c) => c.enabled).length

  // 数据校验：可链接 = 已链接 + 未链接
  const totalCount = connectors.length
  const unlinkedCount = totalCount - linkedCount

  // 已启用的置顶，未启用的排在下面
  const sortedConnectors = [...connectors].sort((a, b) => Number(b.enabled) - Number(a.enabled))

  // 判断当前用户是否管理员（仅管理员可发布/编辑/删除）
  const currentUserId = store.tenant.membership?.userId
  const currentMember = currentUserId ? store.tenant.members.find((m) => m.id === currentUserId) : undefined
  const isAdmin = currentMember?.roleId === 'admin'

  // 发布/编辑弹窗状态
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const handleAdd = () => {
    setEditingId(null)
    setShowForm(true)
  }

  const handleEdit = (id: string) => {
    setEditingId(id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('确定删除此数据系统？删除后租户将无法链接该系统。')) {
      if (store.backendConnected) await deleteConnector(id)
      store.removeDataBaseConnector(id)
    }
  }

  const handleReset = () => {
    if (confirm('确定恢复出厂默认数据系统？所有自定义发布和租户链接配置将丢失。')) {
      store.resetDataBaseConnectors()
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageTitle
        icon={Database}
        title="数据底座"
        desc="总后台发布可链接系统 → 租户链接数据系统 → 智能体读取数据做决策。系统打通后，智能体可根据工作流自动读取数据。"
      />

      {/* 概览统计：可链接 / 已链接 / 未链接 —— 数据校验：可链接 = 已链接 + 未链接 */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs text-text-muted">可链接系统</div>
          <div className="mt-1 text-2xl font-semibold text-text-primary">{totalCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-text-muted">已链接系统</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-600">{linkedCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-text-muted">未链接系统</div>
          <div className="mt-1 text-2xl font-semibold text-text-primary">{unlinkedCount}</div>
        </div>
      </div>

      {/* 管理员操作栏 */}
      {isAdmin && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border-subtle bg-bg-surface/60 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Settings2 className="h-3.5 w-3.5" />
            管理员模式：可发布、编辑、删除可链接系统。发布后系统会持久化保存，刷新不会丢失。
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-amber-500/50 hover:text-amber-500"
              title="恢复出厂默认"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              恢复默认
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-xs text-bg-surface transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              发布系统
            </button>
          </div>
        </div>
      )}

      {/* 所有卡片平铺：已启用置顶，每行三个 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortedConnectors.map((c) => (
          <ConnectorCard
            key={c.id}
            connector={c}
            isAdmin={isAdmin}
            onToggle={async () => {
              if (store.backendConnected) await updateConnector(c.id, { enabled: !c.enabled })
              store.toggleDataBaseConnector(c.id)
            }}
            onRefresh={() => {
              store.setDataBaseConnectorStatus(c.id, 'pending')
              setTimeout(() => store.setDataBaseConnectorStatus(c.id, 'connected'), 800)
            }}
            onEdit={() => handleEdit(c.id)}
            onDelete={() => handleDelete(c.id)}
          />
        ))}
      </div>

      {/* 空状态 */}
      {connectors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Database className="h-12 w-12 text-text-muted/40" />
          <p className="mt-3 text-sm text-text-muted">暂无可链接系统</p>
          {isAdmin && (
            <button
              onClick={handleAdd}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-2 text-xs text-bg-surface"
            >
              <Plus className="h-3.5 w-3.5" />
              发布第一个系统
            </button>
          )}
        </div>
      )}

      {/* 发布/编辑弹窗 */}
      {showForm && (
        <ConnectorForm
          editingId={editingId}
          onClose={() => {
            setShowForm(false)
            setEditingId(null)
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// 连接器卡片
// ============================================================
function ConnectorCard({
  connector,
  isAdmin,
  onToggle,
  onRefresh,
  onEdit,
  onDelete
}: {
  connector: DataBaseConnector
  isAdmin: boolean
  onToggle: () => void
  onRefresh: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const Icon = connector.icon
  const statusMeta = getStatusMeta(connector.status, connector.enabled)

  return (
    <div
      className={`card relative flex flex-col p-4 transition-all ${
        connector.enabled ? '' : 'opacity-60'
      }`}
    >
      {/* 管理员编辑/删除按钮 */}
      {isAdmin && (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <button
            onClick={onEdit}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted opacity-0 transition-all hover:bg-bg-hover hover:text-text-secondary group-hover:opacity-100"
            title="编辑"
            style={{ opacity: 0.5 }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-all hover:bg-rose-500/10 hover:text-rose-500"
            title="删除"
            style={{ opacity: 0.5 }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-elevated">
          <Icon className="h-5 w-5 text-text-secondary" />
        </div>
        {/* 租户开关：开启=链接此系统 */}
        <button
          onClick={onToggle}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            connector.enabled ? 'bg-text-primary' : 'bg-bg-hover'
          }`}
          title={connector.enabled ? '关闭数据底座' : '开启数据底座'}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg-surface transition-all ${
              connector.enabled ? 'left-4' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary">{connector.name}</div>
        <div className="mt-1 text-xs leading-relaxed text-text-muted">{connector.desc}</div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
        <div className="flex items-center gap-1.5">
          <statusMeta.Icon className={`h-3.5 w-3.5 ${statusMeta.color}`} />
          <span className={`text-xs ${statusMeta.color}`}>{statusMeta.label}</span>
        </div>

        {connector.enabled && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-secondary"
            title="立即同步"
          >
            <RefreshCw className="h-3 w-3" />
            {connector.lastSync}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 发布/编辑系统弹窗
// ============================================================
function ConnectorForm({
  editingId,
  onClose
}: {
  editingId: string | null
  onClose: () => void
}) {
  const store = useStore()
  const existing = editingId ? store.dataBaseConnectors.find((c) => c.id === editingId) : null

  const [name, setName] = useState(existing?.name ?? '')
  const [desc, setDesc] = useState(existing?.desc ?? '')
  const [type, setType] = useState<ConnectorType>(existing?.type ?? 'third-party')
  const [iconName, setIconName] = useState(existing?.iconName ?? 'Database')
  const [iconSearch, setIconSearch] = useState('')

  const filteredIcons = ICON_OPTIONS.filter((n) =>
    n.toLowerCase().includes(iconSearch.toLowerCase())
  )

  const handleSubmit = async () => {
    // 数据校验：名称和描述不能为空
    if (!name.trim()) {
      alert('请输入系统名称')
      return
    }
    if (!desc.trim()) {
      alert('请输入系统说明')
      return
    }

    const icon = ICON_REGISTRY[iconName] ?? DefaultIcon

    if (editingId && existing) {
      // 编辑模式：更新已有系统
      if (store.backendConnected) {
        await updateConnector(editingId, { name: name.trim(), desc: desc.trim(), type, iconName })
      }
      store.updateDataBaseConnector(editingId, {
        name: name.trim(),
        desc: desc.trim(),
        type,
        iconName
      })
    } else {
      // 发布模式：新增系统
      const newConnector: DataBaseConnector = {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        desc: desc.trim(),
        type,
        iconName,
        icon,
        enabled: false,
        status: 'disconnected',
        lastSync: '未连接'
      }
      // 先调后端创建
      if (store.backendConnected) {
        const created = await createConnector({
          name: newConnector.name, desc: newConnector.desc, type: newConnector.type, iconName: newConnector.iconName
        })
        if (created) {
          newConnector.id = (created as Record<string, unknown>).id as string
        }
      }
      store.addDataBaseConnector(newConnector)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">
            {editingId ? '编辑数据系统' : '发布可链接系统'}
          </h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-bg-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 系统名称 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">系统名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：企业 ERP 中间库"
              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>

          {/* 系统说明 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">系统说明</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="描述此系统提供哪些数据，智能体可以读取做什么决策"
              rows={3}
              className="w-full resize-none rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>

          {/* 系统类型 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">系统类型</label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'erp', label: 'ERP' },
                { value: 'b2b', label: 'B2B 平台' },
                { value: 'b2c', label: 'B2C 商城' },
                { value: 'third-party', label: '三方系统' }
              ] as { value: ConnectorType; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                    type === opt.value
                      ? 'border-accent bg-accent/10 text-text-primary'
                      : 'border-border-subtle text-text-secondary hover:border-border'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 图标选择 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">选择图标</label>
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                placeholder="搜索图标"
                className="flex-1 bg-transparent text-xs text-text-primary outline-none"
              />
            </div>
            <div className="grid max-h-32 grid-cols-8 gap-1.5 overflow-y-auto rounded-lg border border-border-subtle bg-bg-elevated p-2">
              {filteredIcons.map((iconNameOpt) => {
                const IconComp = ICON_REGISTRY[iconNameOpt]
                return (
                  <button
                    key={iconNameOpt}
                    onClick={() => setIconName(iconNameOpt)}
                    title={iconNameOpt}
                    className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                      iconName === iconNameOpt
                        ? 'bg-accent/20 ring-1 ring-accent'
                        : 'hover:bg-bg-hover'
                    }`}
                  >
                    {IconComp && <IconComp className="h-4 w-4 text-text-secondary" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 当前选中图标预览 */}
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>当前图标：</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated">
              {(() => {
                const IconComp = ICON_REGISTRY[iconName] ?? DefaultIcon
                return <IconComp className="h-4 w-4 text-text-secondary" />
              })()}
            </div>
            <span className="font-mono">{iconName}</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-text-primary px-4 py-2 text-sm text-bg-surface transition-opacity hover:opacity-90"
          >
            {editingId ? '保存修改' : '发布系统'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 辅助函数
// ============================================================
function getStatusMeta(status: DataBaseConnector['status'], enabled: boolean) {
  if (!enabled) {
    return { label: '未启用', color: 'text-text-muted', Icon: AlertCircle }
  }
  switch (status) {
    case 'connected':
      return { label: '已连接', color: 'text-emerald-600', Icon: CheckCircle2 }
    case 'pending':
      return { label: '连接中', color: 'text-amber-500', Icon: RefreshCw }
    case 'disconnected':
      return { label: '未连接', color: 'text-text-muted', Icon: Link2 }
  }
}

function PageTitle({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-elevated">
        <Icon className="h-5 w-5 text-text-secondary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="text-xs text-text-muted">{desc}</p>
      </div>
    </div>
  )
}
