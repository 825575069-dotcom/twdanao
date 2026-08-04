// ============================================================
// YesGo Admin — 权限管理（总部员工 + 平台角色）
// 管理第二层平台权限：platform.* 体系
// ============================================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck, Plus, Trash2, Edit2, Search, X,
  Users, UserPlus, Shield,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { PlatformRole, PlatformStaff, PermissionItem } from '@/types';

/* ---------- 通用组件 ---------- */

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  if (!message) return null;
  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
        type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
      }`}
    >
      {message}
    </div>
  );
}

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function groupByCategory(list: PermissionItem[]): Record<string, PermissionItem[]> {
  const map: Record<string, PermissionItem[]> = {};
  list.forEach((p) => {
    const cat = p.category || '其他';
    if (!map[cat]) map[cat] = [];
    map[cat].push(p);
  });
  return map;
}

/* ---------- 平台角色弹窗 ---------- */

function RoleModal({
  open, role, permissions, onClose, onSave,
}: {
  open: boolean;
  role: PlatformRole | null;
  permissions: PermissionItem[];
  onClose: () => void;
  onSave: (data: { name: string; code: string; description: string; permissions: string[] }) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(role?.name || '');
      setCode(role?.code || '');
      setDesc(role?.description || '');
      setSelectedPerms(role?.permissions || []);
      setError('');
    }
  }, [open, role]);

  const grouped = useMemo(() => groupByCategory(permissions), [permissions]);

  const toggle = (perm: string) => {
    setSelectedPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('角色名称不能为空'); return; }
    if (!code.trim()) { setError('角色编码不能为空'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSave({ name: name.trim(), code: code.trim(), description: desc.trim(), permissions: selectedPerms });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title={role ? '编辑平台角色' : '新增平台角色'} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">角色名称 *</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="如：超级管理员" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">角色编码 *</label>
          <input value={code} onChange={e => setCode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="如：super_admin" disabled={!!role} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="角色职责说明" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">权限</label>
          <div className="max-h-60 overflow-y-auto space-y-3">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="text-xs font-medium text-gray-400 mb-1">{cat}</div>
                <div className="grid grid-cols-2 gap-1">
                  {items.map(p => (
                    <label key={p.code} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${selectedPerms.includes(p.code) ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-600'}`}>
                      <input type="checkbox" checked={selectedPerms.includes(p.code)} onChange={() => toggle(p.code)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- 总部员工弹窗 ---------- */

function StaffModal({
  open, staff, roles, onClose, onSave,
}: {
  open: boolean;
  staff: PlatformStaff | null;
  roles: PlatformRole[];
  onClose: () => void;
  onSave: (data: { username: string; password?: string; name: string; phone: string; role_id: number }) => void;
}) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUsername(staff?.username || '');
      setName(staff?.name || '');
      setPhone(staff?.phone || '');
      setPassword('');
      setRoleId(staff?.role_id || roles[0]?.id || 0);
      setError('');
    }
  }, [open, staff, roles]);

  const handleSubmit = async () => {
    if (!username.trim()) { setError('用户名不能为空'); return; }
    if (!name.trim()) { setError('姓名不能为空'); return; }
    if (!staff && !phone.trim()) { setError('手机号不能为空'); return; }
    if (!roleId) { setError('请选择角色'); return; }
    if (!staff && !password.trim()) { setError('密码不能为空'); return; }
    setSubmitting(true);
    setError('');
    try {
      const data: Parameters<typeof onSave>[0] = { username: username.trim(), name: name.trim(), phone: phone.trim(), role_id: roleId };
      if (password.trim()) data.password = password.trim();
      await onSave(data);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title={staff ? '编辑总部员工' : '新增总部员工'} onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">用户名 *</label>
          <input value={username} onChange={e => setUsername(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="登录账号" disabled={!!staff} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="真实姓名" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">手机号 {!staff && '*'}</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="用于密码找回" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">密码 {!staff && '*'}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={staff ? '留空则不修改密码' : '设置登录密码'} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">平台角色 *</label>
          <select value={roleId} onChange={e => setRoleId(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value={0} disabled>请选择角色</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- 主页面 ---------- */

export default function Permissions() {
  const [activeTab, setActiveTab] = useState<'staff' | 'roles'>('staff');

  // 数据
  const [staffList, setStaffList] = useState<PlatformStaff[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [perms, setPerms] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 搜索
  const [search, setSearch] = useState('');

  // 弹窗
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<PlatformRole | null>(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<PlatformStaff | null>(null);

  // Toast
  const [toast, setToast] = useState({ msg: '', type: 'success' as 'success' | 'error' });
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, rRes, pRes] = await Promise.all([
        api.getPlatformStaff(),
        api.getPlatformRoles(),
        api.getPlatformPermissions(),
      ]);
      setStaffList(sRes.data || []);
      setRoles(rRes.data || []);
      setPerms(pRes.data || []);
    } catch {
      showToast('加载数据失败', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 筛选
  const filteredStaff = useMemo(() => {
    if (!search) return staffList;
    const q = search.toLowerCase();
    return staffList.filter(s =>
      s.username.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.role_name.toLowerCase().includes(q)
    );
  }, [staffList, search]);

  const filteredRoles = useMemo(() => {
    if (!search) return roles;
    const q = search.toLowerCase();
    return roles.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    );
  }, [roles, search]);

  // 角色 CRUD
  const handleSaveRole = async (data: { name: string; code: string; description: string; permissions: string[] }) => {
    if (editingRole) {
      await api.updatePlatformRole(editingRole.id, data);
      showToast('角色已更新');
    } else {
      await api.createPlatformRole(data);
      showToast('角色已创建');
    }
    fetchData();
  };

  const handleDeleteRole = async (role: PlatformRole) => {
    if (!confirm(`确定删除角色「${role.name}」？`)) return;
    try {
      await api.deletePlatformRole(role.id);
      showToast('角色已删除');
      fetchData();
    } catch {
      showToast('删除失败', 'error');
    }
  };

  // 员工 CRUD
  const handleSaveStaff = async (data: { username: string; password?: string; name: string; phone: string; role_id: number }) => {
    if (editingStaff) {
      await api.updatePlatformStaff(editingStaff.id, data);
      showToast('员工已更新');
    } else {
      await api.createPlatformStaff(data);
      showToast('员工已创建');
    }
    fetchData();
  };

  const handleDeleteStaff = async (s: PlatformStaff) => {
    if (!confirm(`确定删除员工「${s.name}(${s.username})」？`)) return;
    try {
      await api.deletePlatformStaff(s.id);
      showToast('员工已删除');
      fetchData();
    } catch {
      showToast('删除失败', 'error');
    }
  };

  // 权限码→名称映射
  const permNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    perms.forEach(p => { m[p.code] = p.name; });
    return m;
  }, [perms]);

  // 角色名映射
  const roleNameMap = useMemo(() => {
    const m: Record<number, string> = {};
    roles.forEach(r => { m[r.id] = r.name; });
    return m;
  }, [roles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Toast message={toast.msg} type={toast.type} />

      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">权限管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理总部员工与平台角色权限</p>
        </div>
      </div>

      {/* Tab 切换 + 搜索 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setActiveTab('staff'); setSearch(''); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'staff' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Users size={16} />
            总部员工
          </button>
          <button
            onClick={() => { setActiveTab('roles'); setSearch(''); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'roles' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Shield size={16} />
            平台角色
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`搜索${activeTab === 'staff' ? '员工' : '角色'}...`}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          {activeTab === 'staff' ? (
            <button
              onClick={() => { setEditingStaff(null); setShowStaffModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
            >
              <UserPlus size={16} />
              新增员工
            </button>
          ) : (
            <button
              onClick={() => { setEditingRole(null); setShowRoleModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
            >
              <Plus size={16} />
              新增角色
            </button>
          )}
        </div>
      </div>

      {/* ========== 员工列表 ========== */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">姓名 / 账号</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">手机号</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">平台角色</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">加入时间</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStaff.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">暂无数据</td></tr>
              ) : filteredStaff.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.username}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                      {s.role_name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {s.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.created_at?.slice(0, 10) || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditingStaff(s); setShowStaffModal(true); }}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-primary-600"
                        title="编辑"
                      ><Edit2 size={14} /></button>
                      <button
                        onClick={() => handleDeleteStaff(s)}
                        className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600"
                        title="删除"
                      ><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========== 角色列表 ========== */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">角色</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">描述</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">权限清单</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRoles.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">暂无数据</td></tr>
              ) : filteredRoles.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.code}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{r.description || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {r.permissions.map(p => (
                        <span key={p} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                          {permNameMap[p] || p}
                        </span>
                      ))}
                      {r.permissions.length === 0 && <span className="text-xs text-gray-400">-</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditingRole(r); setShowRoleModal(true); }}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-primary-600"
                        title="编辑"
                      ><Edit2 size={14} /></button>
                      <button
                        onClick={() => handleDeleteRole(r)}
                        className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600"
                        title="删除"
                      ><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 弹窗 */}
      <RoleModal open={showRoleModal} role={editingRole} permissions={perms} onClose={() => { setShowRoleModal(false); setEditingRole(null); }} onSave={handleSaveRole} />
      <StaffModal open={showStaffModal} staff={editingStaff} roles={roles} onClose={() => { setShowStaffModal(false); setEditingStaff(null); }} onSave={handleSaveStaff} />
    </div>
  );
}
