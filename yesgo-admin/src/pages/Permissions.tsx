// ============================================================
// YesGo Admin — 权限管理（员工管理 + 角色权限）
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, UserCog, Search, Plus, Pencil, Trash2, Shield, CheckCircle2,
  XCircle, Loader2, X, AlertCircle, Check, ChevronDown, Building2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { TenantInfo, TenantMember, TenantRole, PermissionItem } from '@/types';

// ---- Helpers ---------------------------------------------------------------
function statusBadge(enabled: boolean) {
  return enabled
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700"><CheckCircle2 size={12} />启用</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><XCircle size={12} />禁用</span>;
}

function memberStatusBadge(status: 'online' | 'offline') {
  return status === 'online'
    ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />在线</span>
    : <span className="inline-flex items-center gap-1 text-xs text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />离线</span>;
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  const bg = type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800';
  const Icon = type === 'success' ? Check : AlertCircle;
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm ${bg}`}>
      <Icon size={16} />
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={14} /></button>
    </div>
  );
}

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ---- Permission Map --------------------------------------------------------
function groupByCategory(items: PermissionItem[]) {
  return items.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PermissionItem[]>);
}

// ---- Role Modal ------------------------------------------------------------
function RoleModal({ open, onClose, onSaved, tenantId, role, permissions }: {
  open: boolean; onClose: () => void; onSaved: () => void; tenantId: string;
  role?: TenantRole | null; permissions: PermissionItem[];
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(role?.name ?? '');
      setCode(role?.code ?? '');
      setDescription(role?.description ?? '');
      setSelectedPerms(role?.permissions ?? []);
      setError('');
    }
  }, [open, role]);

  const togglePerm = (code: string) => {
    setSelectedPerms(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('请输入角色名称'); return; }
    if (!code.trim()) { setError('请输入角色编码'); return; }
    setSubmitting(true); setError('');
    try {
      const payload = { name: name.trim(), code: code.trim(), description: description.trim(), permissions: selectedPerms };
      if (role) {
        await api.updateRole(tenantId, role.id, payload);
      } else {
        await api.createRole(tenantId, payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = useMemo(() => groupByCategory(permissions), [permissions]);

  return (
    <Modal open={open} title={role ? '编辑角色' : '新增角色'} onClose={onClose}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">角色名称</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder="如：采购专员" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">角色编码</label>
          <input value={code} onChange={e => setCode(e.target.value)} disabled={!!role} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:bg-gray-50" placeholder="如：purchase_specialist" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder="角色职责说明" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">功能权限</label>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-4">
              <div className="text-xs font-medium text-gray-400 mb-2">{category}</div>
              <div className="grid grid-cols-2 gap-2">
                {items.map(p => (
                  <label key={p.code} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedPerms.includes(p.code)} onChange={() => togglePerm(p.code)} className="rounded text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm text-gray-700">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error && <div className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-60">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Member Modal ----------------------------------------------------------
function MemberModal({ open, onClose, onSaved, tenantId, member, roles }: {
  open: boolean; onClose: () => void; onSaved: () => void; tenantId: string;
  member?: TenantMember | null; roles: TenantRole[];
}) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number>(0);
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUsername(member?.username ?? '');
      setName(member?.name ?? '');
      setPassword('');
      setRoleId(roles.find(r => r.name === member?.role_name)?.id ?? roles[0]?.id ?? 0);
      setEnabled(member?.enabled ?? true);
      setError('');
    }
  }, [open, member, roles]);

  const handleSubmit = async () => {
    if (!username.trim()) { setError('请输入账号'); return; }
    if (!member && !password.trim()) { setError('请输入密码'); return; }
    if (!roleId) { setError('请选择角色'); return; }
    setSubmitting(true); setError('');
    try {
      if (member) {
        const payload: Record<string, unknown> = { role_id: roleId, enabled };
        if (password.trim()) payload.password = password.trim();
        await api.updateMember(tenantId, member.id, payload);
      } else {
        await api.createMember(tenantId, { username: username.trim(), password: password.trim(), role_id: roleId });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title={member ? '编辑员工' : '新增员工'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">账号</label>
          <input value={username} onChange={e => setUsername(e.target.value)} disabled={!!member} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:bg-gray-50" placeholder="登录用户名" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder="显示姓名（可选）" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">密码{member && '（留空则不修改）'}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder={member ? '不修改请留空' : '初始密码'} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
          <select value={roleId} onChange={e => setRoleId(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded text-primary-600" />
          <span className="text-sm text-gray-700">账号启用</span>
        </label>
        {error && <div className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-60">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Main Page -------------------------------------------------------------
export default function Permissions() {
  const [activeTab, setActiveTab] = useState<'employees' | 'roles'>('employees');
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  const [members, setMembers] = useState<TenantMember[]>([]);
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [memberKeyword, setMemberKeyword] = useState('');
  const [roleKeyword, setRoleKeyword] = useState('');

  const [roleModal, setRoleModal] = useState<{ open: boolean; role: TenantRole | null }>({ open: false, role: null });
  const [memberModal, setMemberModal] = useState<{ open: boolean; member: TenantMember | null }>({ open: false, member: null });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load tenants
  useEffect(() => {
    api.getTenants().then(res => {
      const list = res.data.tenants || [];
      setTenants(list);
      if (list.length) setSelectedTenantId(String(list[0].id));
    }).catch(() => showToast('加载租户列表失败', 'error'));
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedTenantId) return;
    setLoading(true);
    try {
      const [mRes, rRes, pRes] = await Promise.all([
        api.getTenantMembers(selectedTenantId),
        api.getTenantRoles(selectedTenantId),
        api.getPermissions(selectedTenantId),
      ]);
      setMembers(mRes.data || []);
      setRoles(rRes.data || []);
      setPermissions(pRes.data || []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载数据失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredMembers = members.filter(m =>
    (m.name || m.username).toLowerCase().includes(memberKeyword.toLowerCase()) ||
    m.role_name.toLowerCase().includes(memberKeyword.toLowerCase())
  );
  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(roleKeyword.toLowerCase()) ||
    r.description.toLowerCase().includes(roleKeyword.toLowerCase())
  );

  const permNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    permissions.forEach(p => map[p.code] = p.name);
    return map;
  }, [permissions]);

  const handleDeleteRole = async (role: TenantRole) => {
    if (!confirm(`确定删除角色「${role.name}」？`)) return;
    try {
      await api.deleteRole(selectedTenantId, role.id);
      showToast('角色已删除', 'success');
      fetchData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败', 'error');
    }
  };

  const handleDeleteMember = async (member: TenantMember) => {
    if (!confirm(`确定删除员工「${member.name || member.username}」？`)) return;
    try {
      await api.deleteMember(selectedTenantId, member.id);
      showToast('员工已删除', 'success');
      fetchData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败', 'error');
    }
  };

  const selectedTenant = tenants.find(t => String(t.id) === selectedTenantId);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-primary-600" size={28} />
            权限管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理租户下的员工账号与角色权限配置</p>
        </div>
        <div className="relative">
          <button className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50">
            <Building2 size={16} className="text-gray-400" />
            <span>{selectedTenant?.name || '选择租户'}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          <select
            value={selectedTenantId}
            onChange={e => setSelectedTenantId(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          >
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'employees'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={16} />
          员工管理
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserCog size={16} />
          角色权限
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> 加载中...
        </div>
      ) : activeTab === 'employees' ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="搜索姓名、账号、角色"
                value={memberKeyword}
                onChange={(e) => setMemberKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <button onClick={() => setMemberModal({ open: true, member: null })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
              <Plus size={16} /> 新增员工
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">姓名/账号</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">角色</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">积分</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">状态</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">在线</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">加入时间</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{m.name || m.username}</div>
                      <div className="text-xs text-gray-400">{m.username}</div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{m.role_name}</td>
                    <td className="px-5 py-3 text-gray-600">{m.credits}</td>
                    <td className="px-5 py-3">{statusBadge(m.enabled)}</td>
                    <td className="px-5 py-3">{memberStatusBadge(m.status)}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{m.created_at ? new Date(m.created_at).toLocaleString('zh-CN') : '-'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => setMemberModal({ open: true, member: m })} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"><Pencil size={16} /></button>
                        <button onClick={() => handleDeleteMember(m)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMembers.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">暂无员工</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="搜索角色名称"
                value={roleKeyword}
                onChange={(e) => setRoleKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <button onClick={() => setRoleModal({ open: true, role: null })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
              <Plus size={16} /> 新增角色
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">角色名称</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">描述</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">权限清单</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">成员数</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRoles.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{r.description}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {r.permissions?.length ? r.permissions.map((p, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-xs">{permNameMap[p] || p}</span>
                        )) : <span className="text-xs text-gray-400">无权限</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{members.filter(m => m.role_name === r.name).length} 人</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => setRoleModal({ open: true, role: r })} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"><Pencil size={16} /></button>
                        <button onClick={() => handleDeleteRole(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRoles.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">暂无角色</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RoleModal
        open={roleModal.open}
        role={roleModal.role}
        tenantId={selectedTenantId}
        permissions={permissions}
        onClose={() => setRoleModal({ open: false, role: null })}
        onSaved={() => { showToast('角色已保存', 'success'); fetchData(); }}
      />
      <MemberModal
        open={memberModal.open}
        member={memberModal.member}
        tenantId={selectedTenantId}
        roles={roles}
        onClose={() => setMemberModal({ open: false, member: null })}
        onSaved={() => { showToast('员工已保存', 'success'); fetchData(); }}
      />
    </div>
  );
}
