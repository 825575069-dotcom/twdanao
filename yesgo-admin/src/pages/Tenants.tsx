// ============================================================
// YesGo Admin — Tenant Management
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Building2, Plus, Users, Shield, Package, Edit, Trash2, ChevronRight,
  X, Check, AlertCircle, RefreshCw, UserPlus, Save, Info,
} from 'lucide-react';
import type { TenantInfo, TenantMember, TenantRole, TenantPackage } from '@/types';

// ---- Helpers ---------------------------------------------------------------
function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusBadge(status: TenantInfo['status']) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    active:   { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: '活跃' },
    inactive: { bg: 'bg-gray-50',   text: 'text-gray-600',  dot: 'bg-gray-400',  label: '停用' },
    pending:  { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500', label: '待审核' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function memberStatusBadge(status: 'online' | 'offline') {
  return status === 'online'
    ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />在线</span>
    : <span className="inline-flex items-center gap-1 text-xs text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />离线</span>;
}

// ---- Toast -----------------------------------------------------------------
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  const bg = type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800';
  const Icon = type === 'success' ? Check : AlertCircle;
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm ${bg} animate-slide-up`}>
      <Icon size={16} />
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={14} /></button>
    </div>
  );
}

// ---- Skeleton --------------------------------------------------------------
function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} className="h-3" />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-3 border-b border-gray-50 grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, j) => <SkeletonBlock key={j} className="h-3" />)}
        </div>
      ))}
    </div>
  );
}

// ---- Create Tenant Modal ---------------------------------------------------
function CreateTenantModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [platformName, setPlatformName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setCode(''); setName(''); setPlatformName(''); setError(''); setFieldErrors({});
    }
  }, [open]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!code.trim()) errs.code = '请输入租户编码';
    if (!name.trim()) errs.name = '请输入租户名称';
    if (!platformName.trim()) errs.platformName = '请输入平台名称';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createTenant({ code: code.trim(), name: name.trim(), platform_name: platformName.trim() });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">创建租户</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">租户编码</label>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setFieldErrors(prev => ({ ...prev, code: '' })); }}
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary-500 ${fieldErrors.code ? 'border-red-300' : 'border-gray-300'}`}
              placeholder="例如: tenant_001"
              disabled={submitting}
            />
            {fieldErrors.code && <p className="text-xs text-red-500 mt-1">{fieldErrors.code}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">名称</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setFieldErrors(prev => ({ ...prev, name: '' })); }}
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary-500 ${fieldErrors.name ? 'border-red-300' : 'border-gray-300'}`}
              placeholder="例如: 总部运维中心"
              disabled={submitting}
            />
            {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">平台名称</label>
            <input
              value={platformName}
              onChange={(e) => { setPlatformName(e.target.value); setFieldErrors(prev => ({ ...prev, platformName: '' })); }}
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary-500 ${fieldErrors.platformName ? 'border-red-300' : 'border-gray-300'}`}
              placeholder="例如: 天网智能平台"
              disabled={submitting}
            />
            {fieldErrors.platformName && <p className="text-xs text-red-500 mt-1">{fieldErrors.platformName}</p>}
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5">
            {submitting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                创建中...
              </>
            ) : (
              <>
                <Check size={14} /> 确认创建
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Add Member Modal ------------------------------------------------------
function AddMemberModal({ open, onClose, onAdded, tenantId, roles }: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  tenantId: string;
  roles: { id: number; name: string }[];
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number>(roles[0]?.id || 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setUsername(''); setPassword(''); setRoleId(roles[0]?.id || 0); setError(''); setFieldErrors({});
    }
  }, [open, roles]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = '请输入用户名';
    if (!password.trim()) errs.password = '请输入密码';
    if (!roleId) errs.roleId = '请选择角色';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createMember(tenantId, { username: username.trim(), password: password.trim(), role_id: roleId });
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加成员失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">添加成员</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
            <input value={username} onChange={(e) => { setUsername(e.target.value); setFieldErrors(prev => ({ ...prev, username: '' })); }}
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.username ? 'border-red-300' : 'border-gray-300'}`} disabled={submitting} />
            {fieldErrors.username && <p className="text-xs text-red-500 mt-1">{fieldErrors.username}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })); }}
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.password ? 'border-red-300' : 'border-gray-300'}`} disabled={submitting} />
            {fieldErrors.password && <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">角色</label>
            <select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white" disabled={submitting}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              {roles.length === 0 && <option value={0} disabled>暂无可用角色</option>}
            </select>
            {fieldErrors.roleId && <p className="text-xs text-red-500 mt-1">{fieldErrors.roleId}</p>}
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">取消</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
            {submitting ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>添加中...</> : <><UserPlus size={14} />添加</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Detail Panel ----------------------------------------------------------
function TenantDetailPanel({ tenantId, onClose }: {
  tenantId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'info' | 'members' | 'roles' | 'package'>('info');

  // Info
  const [info, setInfo] = useState<TenantInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState('');
  const [infoEditing, setInfoEditing] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: '', platform_name: '' });
  const [infoSaving, setInfoSaving] = useState(false);

  // Members
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<number | null>(null);

  // Roles
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState('');

  // Package
  const [pkg, setPkg] = useState<TenantPackage | null>(null);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [pkgError, setPkgError] = useState('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchInfo = useCallback(async () => {
    setInfoLoading(true); setInfoError('');
    try {
      const res = await api.getTenantInfo(tenantId);
      setInfo(res.data);
      setInfoForm({ name: res.data.name, platform_name: res.data.platform_name });
    } catch (e) {
      setInfoError(e instanceof Error ? e.message : '获取租户信息失败');
    } finally { setInfoLoading(false); }
  }, [tenantId]);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true); setMembersError('');
    try {
      const res = await api.getTenantMembers(tenantId);
      setMembers(res.data);
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : '获取成员列表失败');
    } finally { setMembersLoading(false); }
  }, [tenantId]);

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true); setRolesError('');
    try {
      const res = await api.getTenantRoles(tenantId);
      setRoles(res.data);
    } catch (e) {
      setRolesError(e instanceof Error ? e.message : '获取角色列表失败');
    } finally { setRolesLoading(false); }
  }, [tenantId]);

  const fetchPackage = useCallback(async () => {
    setPkgLoading(true); setPkgError('');
    try {
      const res = await api.getTenantPackage(tenantId);
      setPkg(res.data);
    } catch (e) {
      setPkgError(e instanceof Error ? e.message : '获取套餐信息失败');
    } finally { setPkgLoading(false); }
  }, [tenantId]);

  useEffect(() => { fetchInfo(); fetchMembers(); fetchRoles(); fetchPackage(); }, [fetchInfo, fetchMembers, fetchRoles, fetchPackage]);

  const handleSaveInfo = async () => {
    setInfoSaving(true);
    try {
      await api.updateTenant(tenantId, infoForm);
      await fetchInfo();
      setInfoEditing(false);
      showToast('租户信息已更新', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '更新失败', 'error');
    } finally { setInfoSaving(false); }
  };

  const handleDeleteMember = async (memberId: number) => {
    setDeletingMemberId(memberId);
    try {
      await api.deleteMember(tenantId, memberId);
      await fetchMembers();
      showToast('成员已删除', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败', 'error');
    } finally { setDeletingMemberId(null); }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="fixed inset-0 z-40">
        <div className="absolute inset-0 bg-black/20" onClick={onClose} />
        <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl overflow-hidden flex flex-col animate-slide-left">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-primary-600" />
              <h3 className="font-semibold text-gray-900 text-sm">租户详情</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 shrink-0">
            {[
              { id: 'info' as const, label: '基本信息', icon: Info },
              { id: 'members' as const, label: '成员管理', icon: Users },
              { id: 'roles' as const, label: '角色权限', icon: Shield },
              { id: 'package' as const, label: '套餐配额', icon: Package },
            ].map(t => (
              <button key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
                  tab === t.id ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* ---- Info Tab ---- */}
            {tab === 'info' && (
              infoLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-10 w-full" />)}</div> :
              infoError ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{infoError}</div> :
              info ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700">租户信息</h4>
                    <button onClick={() => setInfoEditing(!infoEditing)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50">
                      {infoEditing ? <X size={13} /> : <Edit size={13} />}
                      {infoEditing ? '取消' : '编辑'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">租户编码</span>
                      <p className="text-gray-900 font-medium mt-0.5">{info.code}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">状态</span>
                      <p className="mt-0.5">{statusBadge(info.status)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">名称</span>
                      {infoEditing ? (
                        <input value={infoForm.name} onChange={e => setInfoForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      ) : <p className="text-gray-900 font-medium mt-0.5">{info.name}</p>}
                    </div>
                    <div>
                      <span className="text-gray-400">平台名称</span>
                      {infoEditing ? (
                        <input value={infoForm.platform_name} onChange={e => setInfoForm(f => ({ ...f, platform_name: e.target.value }))}
                          className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      ) : <p className="text-gray-900 font-medium mt-0.5">{info.platform_name}</p>}
                    </div>
                    <div>
                      <span className="text-gray-400">创建人</span>
                      <p className="text-gray-900 mt-0.5">{info.created_by || '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">创建时间</span>
                      <p className="text-gray-900 mt-0.5">{formatDateTime(info.created_at)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">更新时间</span>
                      <p className="text-gray-900 mt-0.5">{formatDateTime(info.updated_at)}</p>
                    </div>
                  </div>

                  {infoEditing && (
                    <button onClick={handleSaveInfo} disabled={infoSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50">
                      {infoSaving ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>保存中...</> : <><Save size={14} />保存</>}
                    </button>
                  )}
                </div>
              ) : null
            )}

            {/* ---- Members Tab ---- */}
            {tab === 'members' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">成员列表</h4>
                  <button onClick={() => setShowAddMember(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg">
                    <UserPlus size={13} /> 添加成员
                  </button>
                </div>

                {membersLoading ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-10 w-full" />)}</div> :
                 membersError ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{membersError}</div> :
                 members.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">暂无成员数据</p> : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">用户名</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">角色</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">积分</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">状态</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {members.map(m => (
                          <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2.5 font-medium text-gray-900">{m.username}</td>
                            <td className="px-3 py-2.5 text-gray-600">{m.role_name}</td>
                            <td className="px-3 py-2.5 text-gray-900">{m.credits}</td>
                            <td className="px-3 py-2.5">{memberStatusBadge(m.status)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <button onClick={() => handleDeleteMember(m.id)} disabled={deletingMemberId === m.id}
                                className="p-1 rounded hover:bg-red-50 text-red-500 disabled:opacity-50" title="删除成员">
                                {deletingMemberId === m.id ? <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <Trash2 size={14} />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)}
                  onAdded={fetchMembers} tenantId={tenantId}
                  roles={roles.map(r => ({ id: r.id, name: r.name }))} />
              </div>
            )}

            {/* ---- Roles Tab ---- */}
            {tab === 'roles' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">角色权限</h4>
                {rolesLoading ? <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <SkeletonBlock key={i} className="h-24 w-full" />)}</div> :
                 rolesError ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{rolesError}</div> :
                 roles.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">暂无角色数据</p> : (
                  <div className="space-y-3">
                    {roles.map(role => (
                      <div key={role.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h5 className="font-medium text-gray-900 text-sm">{role.name}</h5>
                            <p className="text-xs text-gray-400">{role.code}</p>
                          </div>
                          <span className="text-xs text-gray-500">{role.description}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${role.can_manage_members ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                            {role.can_manage_members ? <Check size={12} className="mr-0.5" /> : <X size={12} className="mr-0.5" />}
                            管理成员
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${role.can_assign_credits ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                            {role.can_assign_credits ? <Check size={12} className="mr-0.5" /> : <X size={12} className="mr-0.5" />}
                            分配积分
                          </span>
                        </div>
                        {role.agents.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-50">
                            <p className="text-xs text-gray-400 mb-1.5">可用智能体</p>
                            <div className="flex flex-wrap gap-1">
                              {role.agents.map(a => (
                                <span key={a} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">{a}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {role.views.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-400 mb-1.5">可见视图</p>
                            <div className="flex flex-wrap gap-1">
                              {role.views.map(v => (
                                <span key={v} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded">{v}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- Package Tab ---- */}
            {tab === 'package' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">套餐配额</h4>
                {pkgLoading ? <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1.5"><SkeletonBlock className="h-3 w-24" /><SkeletonBlock className="h-3 w-16" /></div>
                    <SkeletonBlock className="h-2.5 w-full rounded-full" />
                  </div>))}</div> :
                 pkgError ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{pkgError}</div> :
                 !pkg || pkg.quotas.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">暂无套餐数据</p> : (
                  <div className="space-y-5">
                    <div>
                      <span className="text-sm text-gray-900 font-medium">{pkg.name}</span>
                    </div>
                    {pkg.quotas.map(q => {
                      const pct = q.monthly > 0 ? Math.min((q.used / q.monthly) * 100, 100) : 0;
                      const barColor = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-green-500';
                      return (
                        <div key={q.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-gray-700 font-medium">{q.agent_code}</span>
                            <span className="text-xs text-gray-500">
                              {q.used.toLocaleString()}<span className="text-gray-300"> / </span>{q.monthly.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Tenants Page
// ============================================================
export default function Tenants() {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserName, setCurrentUserName] = useState<string>('当前用户');

  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await api.me();
      const user = res.data.user;
      setCurrentUserName(user?.name || '当前用户');
    } catch {
      // 忽略错误，使用默认值
    }
  }, []);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getTenants();
      setTenants(res.data.tenants);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取租户列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCurrentUser(); fetchTenants(); }, [fetchCurrentUser, fetchTenants]);

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="p-6 space-y-5">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">租户管理</h1>
            <p className="text-sm text-gray-500 mt-0.5">管理平台所有租户及其成员、角色和配额</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchTenants}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} /> 刷新
            </button>
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm">
              <Plus size={16} /> 创建租户
            </button>
          </div>
        </div>

        {/* Tenant List */}
        {loading ? (
          <TableSkeleton rows={5} />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700 flex items-center gap-3">
            <AlertCircle size={18} />
            <div>
              <p className="font-medium">{error}</p>
              <button onClick={fetchTenants} className="text-primary-600 hover:underline mt-1 text-xs">点击重试</button>
            </div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center justify-center text-gray-400">
            <Building2 size={40} className="mb-3" />
            <p className="text-sm font-medium">暂无租户数据</p>
            <p className="text-xs mt-1">点击右上角按钮创建第一个租户</p>
            <button onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg">
              <Plus size={14} /> 创建租户
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">租户编码</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">名称</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">平台名称</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">状态</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">创建人</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">创建时间</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tenants.map((t) => (
                    <tr key={t.id}
                      onClick={() => setSelectedId(String(t.id))}
                      className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-5 py-3 text-gray-900 font-mono text-xs">{t.code}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-5 py-3 text-gray-600">{t.platform_name}</td>
                      <td className="px-5 py-3">{statusBadge(t.status)}</td>
                      <td className="px-5 py-3 text-gray-700 text-xs">{t.created_by || '—'}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDateTime(t.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedId(String(t.id)); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors">
                          详情 <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateTenantModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { fetchTenants(); showToast('租户创建成功', 'success'); }} />

      {/* Detail Panel */}
      {selectedId && (
        <TenantDetailPanel tenantId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
