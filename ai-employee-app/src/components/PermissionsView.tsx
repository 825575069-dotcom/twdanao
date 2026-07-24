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
  User
} from 'lucide-react'
import { PageTitle, Section } from './SkillsView'
import { useStore } from '../store/appStore'
import type { TenantMember, Role } from '../types'
import { createMember, updateMember, deleteMember } from '../lib/backend'

const ROLE_ICONS: Record<string, typeof UserCog> = {
  admin: ShieldCheck,
  procurement_manager: UserCog,
  sales_supervisor: Users,
  member: User
}

export default function PermissionsView() {
  const store = useStore()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TenantMember | null>(null)

  const roles = store.tenant.roles
  const members = store.tenant.members

  const filteredMembers = useMemo(() => {
    return members.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
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
      // 先调后端更新
      if (store.backendConnected) {
        await updateMember(member.id, { roleId: member.roleId, roleName: member.roleName, credits: member.credits, enabled: member.enabled })
      }
      store.updateMemberRole(member.id, member.roleId, member.roleName)
      store.updateMemberCredits(member.id, member.credits)
      if (member.enabled !== editing.enabled) store.toggleMemberStatus(member.id)
    } else {
      // 先调后端创建
      if (store.backendConnected) {
        const created = await createMember({ name: member.name, roleId: member.roleId, roleName: member.roleName, credits: member.credits })
        if (created) {
          member.id = (created as Record<string, unknown>).id as string
        }
      }
      store.addMember(member)
    }
    setModalOpen(false)
    setEditing(null)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle icon={ShieldCheck} title="权限管理" desc="租户成员、角色与智能体访问控制" />

      <Section title="角色权限">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roles.map((r) => {
            const Icon = ROLE_ICONS[r.id] || UserCog
            return (
              <div
                key={r.id}
                className="group flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-surface/80 p-4 shadow-card transition-colors hover:border-border"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text-primary">{r.name}</div>
                  <div className="mt-0.5 text-xs text-text-muted">{r.desc}</div>
                  <div className="mt-3 text-[11px] text-text-secondary">
                    {roleStats.get(r.id) ?? 0} 人
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title={`成员列表（${members.length}）`}>
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索成员"
              className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
          </div>
          <button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
            className="btn-primary h-9 px-3 text-xs"
          >
            <Plus className="h-4 w-4" /> 添加成员
          </button>
        </div>

        <div className="card overflow-hidden">
          {filteredMembers.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">未找到匹配成员</div>
          ) : (
            filteredMembers.map((m, i) => (
              <div
                key={m.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i !== filteredMembers.length - 1 ? 'border-b border-border-subtle' : ''
                } ${!m.enabled ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent">
                    {m.avatar ? (
                      <img src={m.avatar} alt={m.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      m.name[0]
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{m.name}</span>
                      {!m.enabled && (
                        <span className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-muted">已停用</span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted">
                      {m.roleName} · 积分 {m.credits.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${m.status === 'online' ? 'bg-emerald-500' : 'bg-text-muted'}`}
                    />
                    <span className="text-xs text-text-muted">{m.status === 'online' ? '在线' : '离线'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditing(m)
                        setModalOpen(true)
                      }}
                      className="icon-btn h-8 w-8"
                      title="编辑"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => store.toggleMemberStatus(m.id)}
                      className="icon-btn h-8 w-8"
                      title={m.enabled ? '停用' : '启用'}
                    >
                      {m.enabled ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={async () => {
                        if (store.backendConnected) await deleteMember(m.id)
                        store.removeMember(m.id)
                      }}
                      className="icon-btn h-8 w-8 text-rose-500 hover:text-rose-600"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Section>

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
    </div>
  )
}

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
  const [roleId, setRoleId] = useState(member?.roleId ?? roles[roles.length - 1]?.id ?? '')
  const [credits, setCredits] = useState(member?.credits ?? 500)
  const [enabled, setEnabled] = useState(member?.enabled ?? true)

  const role = roleById.get(roleId)

  const submit = () => {
    if (!name.trim() || !role) return
    onSave({
      id: member?.id ?? `u_${Date.now()}`,
      name: name.trim(),
      roleId,
      roleName: role.name,
      credits,
      status: 'offline',
      enabled
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">{member ? '编辑成员' : '添加成员'}</h3>
          <button onClick={onClose} className="icon-btn h-8 w-8">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">姓名</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入成员姓名"
              className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
          </div>

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

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">分配积分</label>
            <input
              type="number"
              min={0}
              value={credits}
              onChange={(e) => setCredits(Math.max(0, Number(e.target.value)))}
              className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm text-text-primary outline-none focus:border-accent"
            />
            <div className="mt-1 text-[11px] text-text-muted">员工使用 AI 聊天时将从该余额中扣除积分</div>
          </div>

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
