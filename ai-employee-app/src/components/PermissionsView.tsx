import { useMemo, useState } from 'react'
import {
  ShieldCheck,
  UserCog,
  Users,
  Plus,
  Search,
  Trash2,
  Edit3,
  Check,
  X,
  User,
  Coins,
  Crown,
  Calendar,
  CalendarDays,
  Eye,
  EyeOff,
  Infinity as InfinityIcon,
} from 'lucide-react'
import { PageTitle, Section } from './SkillsView'
import { useStore } from '../store/appStore'
import type { TenantMember, Role, CreditAllocationType } from '../types'
import { CREDIT_ALLOCATION_OPTIONS } from '../types'
import { createMember, updateMember, deleteMember, createRole, updateRole, deleteRole } from '../lib/backend'
import { AGENT_CODES, AGENT_LABELS } from '../lib/constants'
import type { ViewKey } from '../App'

const ROLE_ICONS: Record<string, typeof UserCog> = {
  admin: ShieldCheck,
  procurement_manager: UserCog,
  sales_supervisor: Users,
  member: User
}

/** 主要功能（视图）选项 —— 对齐侧边栏导航 */
const VIEW_OPTIONS: { key: ViewKey; label: string }[] = [
  { key: 'chat', label: '新建对话' },
  { key: 'tasks', label: '自动任务' },
  { key: 'marketing', label: '营销跟客' },
  { key: 'office', label: '智能体配置' },
  { key: 'dataBase', label: '数据底座' },
  { key: 'knowledge', label: '知识文档' },
  { key: 'media', label: '营销素材' },
  { key: 'data', label: '经营看板' },
  { key: 'permissions', label: '权限管理' },
  { key: 'credits', label: '积分管理' },
  { key: 'settings', label: '系统设置' }
]

/** 智能体选项 */
const AGENT_OPTIONS = Object.values(AGENT_CODES).map((code) => ({
  code,
  label: AGENT_LABELS[code]
}))

const ALLOCATION_ICONS: Record<CreditAllocationType, typeof InfinityIcon> = {
  unlimited: InfinityIcon,
  monthly: Calendar,
  daily: CalendarDays,
  fixed: Coins,
}

/** 积分分配显示文本 */
function allocationText(type: CreditAllocationType, value?: number): string {
  if (type === 'unlimited') return '无限'
  const v = value ?? 0
  if (type === 'monthly') return `${v.toLocaleString()}/月`
  if (type === 'daily') return `${v.toLocaleString()}/日`
  return v.toLocaleString()
}

export default function PermissionsView() {
  const store = useStore()
  const [activeTab, setActiveTab] = useState<'staff' | 'roles'>('staff')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TenantMember | null>(null)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)

  const roles = store.tenant.roles
  const members = store.tenant.members

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase()
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.username ?? '').toLowerCase().includes(q) ||
        (m.phone ?? '').includes(q)
    )
  }, [members, search])

  const roleStats = useMemo(() => {
    const map = new Map<string, number>()
    members.forEach((m) => {
      if (!m.enabled) return
      map.set(m.roleId, (map.get(m.roleId) || 0) + 1)
    })
    return map
  }, [members])

  const roleById = useMemo(() => {
    const map = new Map<string, Role>()
    roles.forEach((r) => map.set(r.id, r))
    return map
  }, [roles])

  const handleSave = async (member: TenantMember) => {
    if (editing) {
      if (store.backendConnected) {
        await updateMember(member.id, {
          roleId: member.roleId,
          roleName: member.roleName,
          credits: member.credits,
          enabled: member.enabled,
          credit_allocation_type: member.creditAllocationType,
          credit_allocation_value: member.creditAllocationValue,
          phone: member.phone ?? '',
          password: member.password,
        })
      }
      store.updateMemberRole(member.id, member.roleId, member.roleName)
      store.updateMemberCredits(
        member.id,
        member.credits,
        member.creditAllocationType,
        member.creditAllocationValue
      )
      if (member.enabled !== editing.enabled) store.toggleMemberStatus(member.id)
    } else {
      if (store.backendConnected) {
        const created = await createMember({
          username: member.username || member.name,
          password: member.password || '',
          name: member.name,
          role_id: Number(member.roleId),
          phone: member.phone ?? '',
          credit_allocation_type: member.creditAllocationType,
          credit_allocation_value: member.creditAllocationValue ?? 0,
          credits: member.credits,
        })
        if (created) {
          member.id = (created as Record<string, unknown>).id as string
        }
      }
      store.addMember(member)
    }
    setModalOpen(false)
    setEditing(null)
  }

  const handleRoleSave = async (role: Role) => {
    if (editingRole) {
      if (store.backendConnected) {
        await updateRole(role.id, {
          name: role.name,
          description: role.desc,
          agents: role.agents,
          views: role.views,
          can_manage_members: role.canManageMembers,
          can_assign_credits: role.canAssignCredits
        })
      }
      store.updateRole(role)
    } else {
      if (store.backendConnected) {
        const created = await createRole({
          name: role.name,
          code: role.code,
          description: role.desc,
          agents: role.agents,
          views: role.views,
          can_manage_members: role.canManageMembers,
          can_assign_credits: role.canAssignCredits
        })
        if (created) {
          role.id = String(created.id ?? '')
          role.code = String(created.code ?? role.code)
        }
      }
      store.addRole(role)
    }
    setRoleModalOpen(false)
    setEditingRole(null)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageTitle icon={ShieldCheck} title="权限管理" desc="租户成员、角色与智能体访问控制" />

      {/* Tab 切换 */}
      <div className="mb-5 flex gap-1 rounded-lg bg-bg-hover p-1">
        <button
          onClick={() => {
            setActiveTab('staff')
            setSearch('')
          }}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            activeTab === 'staff' ? 'bg-bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Users size={16} />
          员工列表
        </button>
        <button
          onClick={() => {
            setActiveTab('roles')
            setSearch('')
          }}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            activeTab === 'roles' ? 'bg-bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <ShieldCheck size={16} />
          角色权限
        </button>
      </div>

      {activeTab === 'staff' ? (
        <Section title={`员工列表（${members.length}）`}>
          {/* 搜索 + 添加 */}
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索姓名 / 账号 / 手机号"
                className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
              />
            </div>
            <button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
              className="btn-primary h-9 px-3 text-xs whitespace-nowrap"
            >
              <Plus className="h-4 w-4" /> 添加员工
            </button>
          </div>

          {/* 表格 */}
          <div className="card overflow-hidden">
            {/* 表头 */}
            <div className="hidden grid-cols-12 gap-2 border-b border-border-subtle bg-bg-hover/50 px-4 py-2.5 text-xs font-medium text-text-muted md:grid">
              <div className="col-span-3">姓名 / 账号</div>
              <div className="col-span-2">手机号</div>
              <div className="col-span-2">角色</div>
              <div className="col-span-2">积分分配</div>
              <div className="col-span-1 text-center">状态</div>
              <div className="col-span-2 text-right">操作</div>
            </div>

            {filteredMembers.length === 0 ? (
              <div className="py-10 text-center text-sm text-text-muted">未找到匹配的员工</div>
            ) : (
              filteredMembers.map((m, i) => {
                const AllocIcon = ALLOCATION_ICONS[m.creditAllocationType] || Coins
                return (
                  <div
                    key={m.id}
                    className={`grid grid-cols-12 items-center gap-2 px-4 py-3 transition-colors hover:bg-bg-hover/30 ${
                      i !== filteredMembers.length - 1 ? 'border-b border-border-subtle' : ''
                    } ${!m.enabled ? 'opacity-60' : ''} md:grid`}
                  >
                    {/* 姓名/账号 */}
                    <div className="col-span-3 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent">
                        {m.avatar ? (
                          <img src={m.avatar} alt={m.name} className="h-full w-full rounded-full object-cover" />
                        ) : (
                          m.name[0]
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-text-primary">{m.name}</span>
                          {!m.enabled && (
                            <span className="shrink-0 rounded bg-bg-hover px-1 py-0.5 text-[10px] text-text-muted">停用</span>
                          )}
                        </div>
                        {m.username && (
                          <div className="truncate text-[11px] text-text-muted">@{m.username}</div>
                        )}
                      </div>
                    </div>

                    {/* 手机号 */}
                    <div className="col-span-2 text-xs text-text-secondary">
                      {m.phone || <span className="text-text-muted">—</span>}
                    </div>

                    {/* 角色 */}
                    <div className="col-span-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft/60 px-2 py-0.5 text-xs text-accent">
                        {m.roleName}
                      </span>
                    </div>

                    {/* 积分分配 */}
                    <div className="col-span-2 flex items-center gap-1.5">
                      <AllocIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <span className="text-xs font-medium text-text-primary">
                        {allocationText(m.creditAllocationType, m.creditAllocationValue)}
                      </span>
                    </div>

                    {/* 状态 */}
                    <div className="col-span-1 flex items-center justify-center">
                      <span
                        className={`h-2 w-2 rounded-full ${m.status === 'online' ? 'bg-emerald-500' : 'bg-text-muted'}`}
                        title={m.status === 'online' ? '在线' : '离线'}
                      />
                    </div>

                    {/* 操作 */}
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditing(m)
                          setModalOpen(true)
                        }}
                        className="icon-btn h-7 w-7"
                        title="编辑"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => store.toggleMemberStatus(m.id)}
                        className="icon-btn h-7 w-7"
                        title={m.enabled ? '停用' : '启用'}
                      >
                        {m.enabled ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={async () => {
                          if (store.backendConnected) await deleteMember(m.id)
                          store.removeMember(m.id)
                        }}
                        className="icon-btn h-7 w-7 text-rose-500 hover:text-rose-600"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Section>
      ) : (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-wider text-text-muted">角色权限</div>
            <button
              onClick={() => {
                setEditingRole(null)
                setRoleModalOpen(true)
              }}
              className="btn-primary h-8 px-3 text-xs whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" /> 新增角色
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => {
              const Icon = ROLE_ICONS[r.id] || UserCog
              const count = roleStats.get(r.id) ?? 0
              return (
                <div
                  key={r.id}
                  onClick={() => {
                    setEditingRole(r)
                    setRoleModalOpen(true)
                  }}
                  className="group flex h-[168px] cursor-pointer items-start gap-3 rounded-xl border border-border-subtle bg-bg-surface/80 p-4 shadow-card transition-colors hover:border-accent hover:bg-bg-elevated"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-text-primary">{r.name}</span>
                      {r.canManageMembers && (
                        <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )}
                    </div>
                    <div className="mt-0.5 line-clamp-2 min-h-[2.25rem] text-xs text-text-muted">
                      {r.desc}
                    </div>
                    <div className="mt-auto flex items-center gap-3 text-[11px] text-text-secondary">
                      <span>{count} 人</span>
                      <span>·</span>
                      <span>{r.agents.length} 个智能体</span>
                    </div>
                    {/* 权限标签 */}
                    <div className="mt-2 flex flex-wrap gap-1 overflow-hidden">
                      {r.agents.slice(0, 3).map((id) => (
                        <span
                          key={id}
                          className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-muted"
                        >
                          {id === 'control' ? '中控' : id}
                        </span>
                      ))}
                      {r.agents.length > 3 && (
                        <span className="text-[10px] text-text-muted">+{r.agents.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {modalOpen && (
        <MemberModal
          roles={roles}
          roleById={roleById}
          member={editing}
          onClose={() => {
            setModalOpen(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      )}

      {roleModalOpen && (
        <RoleModal
          role={editingRole}
          onClose={() => {
            setRoleModalOpen(false)
            setEditingRole(null)
          }}
          onSave={handleRoleSave}
        />
      )}
    </div>
  )
}

// ============================================================
// 成员编辑弹窗 — 含积分分配选择器
// ============================================================

function MemberModal({
  roles,
  roleById,
  member,
  onClose,
  onSave
}: {
  roles: Role[]
  roleById: Map<string, Role>
  member: TenantMember | null
  onClose: () => void
  onSave: (m: TenantMember) => void
}) {
  const [name, setName] = useState(member?.name ?? '')
  const [username, setUsername] = useState(member?.username ?? '')
  const [phone, setPhone] = useState(member?.phone ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [roleId, setRoleId] = useState(member?.roleId ?? roles[roles.length - 1]?.id ?? '')
  const [allocationType, setAllocationType] = useState<CreditAllocationType>(
    member?.creditAllocationType ?? 'fixed'
  )
  const [allocationValue, setAllocationValue] = useState<number>(
    member?.creditAllocationValue ?? 500
  )
  const [enabled, setEnabled] = useState(member?.enabled ?? true)

  const role = roleById.get(roleId)

  const submit = () => {
    if (!name.trim() || !role) return
    onSave({
      id: member?.id ?? `u_${Date.now()}`,
      name: name.trim(),
      username: username.trim() || name.trim(),
      phone: phone.trim(),
      password: password.trim() || undefined,
      roleId,
      roleName: role.name,
      credits: allocationType === 'unlimited' ? 999999 : allocationValue,
      creditAllocationType: allocationType,
      creditAllocationValue: allocationType === 'unlimited' ? undefined : allocationValue,
      status: 'offline',
      enabled
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">{member ? '编辑员工' : '添加员工'}</h3>
          <button onClick={onClose} className="icon-btn h-8 w-8">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 姓名 + 账号 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">姓名</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入姓名"
                className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                账号{member ? '' : '（默认同姓名）'}
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={name || '登录账号'}
                className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
              />
            </div>
          </div>

          {/* 手机号 + 密码 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">手机号</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号"
                className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                密码{member ? '（留空则不修改）' : ''}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={member ? '••••••' : '请输入登录密码'}
                  className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 pr-9 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* 角色 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">角色</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary outline-none focus:border-accent"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.desc}
                </option>
              ))}
            </select>
            {role && (
              <div className="mt-1.5 text-[11px] text-text-muted">
                可访问：{role.agents.map((id) => (id === 'control' ? '中控' : id)).join('、')}
              </div>
            )}
          </div>

          {/* 积分分配 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-text-secondary">积分分配</label>
            <div className="grid grid-cols-4 gap-2">
              {CREDIT_ALLOCATION_OPTIONS.map((opt) => {
                const Icon = ALLOCATION_ICONS[opt.value]
                const active = allocationType === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setAllocationType(opt.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-all ${
                      active
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-border-subtle bg-bg-elevated text-text-secondary hover:border-border'
                    }`}
                    title={opt.desc}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] font-medium">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 积分值（unlimited 时隐藏） */}
          {allocationType !== 'unlimited' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                {allocationType === 'monthly' && '每月积分额度'}
                {allocationType === 'daily' && '每日积分额度'}
                {allocationType === 'fixed' && '固定积分总量'}
              </label>
              <input
                type="number"
                min={0}
                value={allocationValue}
                onChange={(e) => setAllocationValue(Math.max(0, Number(e.target.value)))}
                className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary outline-none focus:border-accent"
              />
              <div className="mt-1 text-[11px] text-text-muted">
                {allocationType === 'monthly' && '每月 1 号自动重置为该额度'}
                {allocationType === 'daily' && '每日 0 点自动重置为该额度'}
                {allocationType === 'fixed' && '消耗后不自动补充，需手动调整'}
              </div>
            </div>
          )}

          {/* 当前余额（仅编辑时显示） */}
          {member && (
            <div className="flex items-center justify-between rounded-lg bg-bg-hover/50 px-3 py-2">
              <span className="text-xs text-text-muted">当前积分余额</span>
              <span className="text-sm font-medium text-text-primary">{member.credits.toLocaleString()}</span>
            </div>
          )}

          {/* 启用 */}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-accent"
            />
            <span className="text-sm text-text-primary">启用账号</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost px-4">
            取消
          </button>
          <button onClick={submit} disabled={!name.trim()} className="btn-primary px-4 disabled:opacity-50">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 角色编辑弹窗 — 含主要功能使用 + 智能体配置
// ============================================================

function RoleModal({
  role,
  onClose,
  onSave
}: {
  role: Role | null
  onClose: () => void
  onSave: (r: Role) => void
}) {
  const store = useStore()
  const [name, setName] = useState(role?.name ?? '')
  const [desc, setDesc] = useState(role?.desc ?? '')
  const [selectedAgents, setSelectedAgents] = useState<string[]>(role?.agents ?? [])
  const [selectedViews, setSelectedViews] = useState<ViewKey[]>(
    (role?.views as ViewKey[]) ?? []
  )
  const [canManageMembers, setCanManageMembers] = useState(role?.canManageMembers ?? false)
  const [canAssignCredits, setCanAssignCredits] = useState(role?.canAssignCredits ?? false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const toggleAgent = (code: string) => {
    setSelectedAgents((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const toggleView = (key: ViewKey) => {
    setSelectedViews((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const submit = () => {
    if (!name.trim()) return
    onSave({
      id: role?.id ?? `role_${Date.now()}`,
      code: role?.code ?? `code_${Date.now()}`,
      name: name.trim(),
      desc: desc.trim(),
      agents: selectedAgents,
      views: selectedViews,
      permissions: role?.permissions ?? [],
      canManageMembers,
      canAssignCredits
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">{role ? '编辑角色' : '新增角色'}</h3>
          <button onClick={onClose} className="icon-btn h-8 w-8">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 角色名称 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">角色名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入角色名称"
              className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">角色描述</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="请输入角色描述（显示在角色卡片上）"
              rows={2}
              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
          </div>

          {/* 主要功能使用 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-text-secondary">主要功能使用</label>
            <div className="grid grid-cols-2 gap-2">
              {VIEW_OPTIONS.map((v) => {
                const checked = selectedViews.includes(v.key)
                return (
                  <label
                    key={v.key}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                      checked
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-border-subtle bg-bg-elevated text-text-secondary hover:border-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleView(v.key)}
                      className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-accent"
                    />
                    <span className="text-xs font-medium">{v.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* 智能体配置 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-text-secondary">智能体配置</label>
            <div className="grid grid-cols-2 gap-2">
              {AGENT_OPTIONS.map((a) => {
                const checked = selectedAgents.includes(a.code)
                return (
                  <label
                    key={a.code}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                      checked
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-border-subtle bg-bg-elevated text-text-secondary hover:border-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAgent(a.code)}
                      className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-accent"
                    />
                    <span className="text-xs font-medium">{a.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* 权限开关 */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2">
              <input
                type="checkbox"
                checked={canManageMembers}
                onChange={(e) => setCanManageMembers(e.target.checked)}
                className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-accent"
              />
              <span className="text-xs text-text-primary">可管理成员</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2">
              <input
                type="checkbox"
                checked={canAssignCredits}
                onChange={(e) => setCanAssignCredits(e.target.checked)}
                className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-accent"
              />
              <span className="text-xs text-text-primary">可分配积分</span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          {role ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> 删除角色
            </button>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-ghost px-4">
              取消
            </button>
            <button onClick={submit} disabled={!name.trim()} className="btn-primary px-4 disabled:opacity-50">
              保存
            </button>
          </div>
        </div>

        {/* 删除确认 */}
        {showDeleteConfirm && role && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-xl">
              <h4 className="text-sm font-semibold text-text-primary">确认删除角色？</h4>
              <p className="mt-1 text-xs text-text-muted">
                删除后，已分配该角色的成员将暂时失去权限。此操作不可撤销。
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-ghost px-3 py-1.5 text-xs">
                  取消
                </button>
                <button
                  onClick={async () => {
                    if (store.backendConnected) await deleteRole(role.id)
                    store.removeRole(role.id)
                    onClose()
                  }}
                  className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
