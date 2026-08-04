// ============================================================
// YesGo Admin — 企微创建
// 企微号列表 + 创建弹窗（选租户 + 选省份 + 备注 + 有效期 + 收费）
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Loader2, Trash2, Search, Smartphone,
  CheckCircle2, Clock, AlertCircle, XCircle, Copy,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { WecomNumber, WecomAreaCode, TenantInfo } from '@/types';

/* ---------- Status badge ---------- */
const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  created: { label: '已创建', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
  bound: { label: '已绑定', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  expired: { label: '已过期', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle },
  offline: { label: '已离线', cls: 'bg-gray-50 text-gray-500 border-gray-200', icon: XCircle },
};

function StatusBadge({ status, display }: { status: string; display?: string }) {
  const cfg = STATUS_CONFIG[status] || { label: display || status, cls: 'bg-gray-50 text-gray-500 border-gray-200', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      <Icon size={12} />
      {display || cfg.label}
    </span>
  );
}

export default function WecomNumbers() {
  const [numbers, setNumbers] = useState<WecomNumber[]>([]);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [areaCodes, setAreaCodes] = useState<WecomAreaCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' }>({ message: '', type: 'success' });
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdNumber, setCreatedNumber] = useState<WecomNumber | null>(null);
  const [copiedGuid, setCopiedGuid] = useState(false);

  // Create form
  const [form, setForm] = useState({
    tenant_id: '' as string,
    province_code: '' as string,
    remark: '',
    expires_at: '',
    price: '',
    device_name: '',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type }), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [numbersRes, tenantsRes, areaRes] = await Promise.all([
        api.getWecomNumbers(),
        api.getTenants(),
        api.getWecomAreaCodes(),
      ]);
      setNumbers(numbersRes.data);
      setTenants(tenantsRes.data.tenants);
      setAreaCodes(areaRes.data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载数据失败', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({ tenant_id: '', province_code: '', remark: '', expires_at: '', price: '', device_name: '' });
    setCreatedNumber(null);
  };

  const handleCreate = async () => {
    if (!form.province_code) {
      showToast('请选择设备归属省', 'error');
      return;
    }
    const province = areaCodes.find(a => a.code === form.province_code);
    if (!province) {
      showToast('省份信息无效', 'error');
      return;
    }
    try {
      setCreating(true);
      const payload: Record<string, unknown> = {
        province_code: form.province_code,
        province_name: province.name,
        remark: form.remark,
      };
      if (form.tenant_id) payload.tenant_id = Number(form.tenant_id);
      if (form.expires_at) payload.expires_at = form.expires_at;
      if (form.price) payload.price = form.price;
      if (form.device_name) payload.device_name = form.device_name;

      const res = await api.createWecomNumber(payload as Parameters<typeof api.createWecomNumber>[0]);
      setCreatedNumber(res.data);
      showToast(`企微号创建成功，GUID: ${res.data.guid}`);
      // Refresh list
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '创建失败', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, hasDevice: boolean) => {
    if (hasDevice) {
      showToast('该企微号已绑定设备，请先解绑再删除', 'error');
      return;
    }
    if (!confirm('确认删除此企微号？此操作不可撤销。')) return;
    try {
      await api.deleteWecomNumber(id);
      showToast('企微号已删除');
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  };

  const handleCopyGuid = (guid: string) => {
    navigator.clipboard.writeText(guid);
    setCopiedGuid(true);
    setTimeout(() => setCopiedGuid(false), 2000);
  };

  // Filtered list
  const filtered = numbers.filter(n => {
    const matchSearch = !search ||
      n.guid.toLowerCase().includes(search.toLowerCase()) ||
      n.remark.toLowerCase().includes(search.toLowerCase()) ||
      n.province_name.includes(search) ||
      (n.tenant_name || '').includes(search);
    const matchStatus = !statusFilter || n.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-4">
      {/* Toast */}
      {toast.message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">企微创建</h1>
          <p className="text-sm text-gray-500 mt-1">创建企微号并生成 GUID，租户通过 GUID 绑定设备</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          创建企微号
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索 GUID / 备注 / 省份 / 租户"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">全部状态</option>
          <option value="created">已创建</option>
          <option value="bound">已绑定</option>
          <option value="expired">已过期</option>
          <option value="offline">已离线</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-primary-500" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Smartphone size={40} />
            <p className="mt-3 text-sm">暂无企微号，点击右上角创建</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-medium">GUID</th>
                  <th className="px-4 py-3 text-left font-medium">归属租户</th>
                  <th className="px-4 py-3 text-left font-medium">省份</th>
                  <th className="px-4 py-3 text-left font-medium">备注</th>
                  <th className="px-4 py-3 text-left font-medium">有效期</th>
                  <th className="px-4 py-3 text-left font-medium">收费</th>
                  <th className="px-4 py-3 text-left font-medium">状态</th>
                  <th className="px-4 py-3 text-left font-medium">创建时间</th>
                  <th className="px-4 py-3 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-mono text-primary-600">{n.guid}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(n.guid); showToast('已复制 GUID'); }}
                          className="text-gray-300 hover:text-primary-500"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{n.tenant_name || <span className="text-gray-400">未分配</span>}</td>
                    <td className="px-4 py-3 text-gray-700">{n.province_name}</td>
                    <td className="px-4 py-3 text-gray-700">{n.remark || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {n.expires_at ? new Date(n.expires_at).toLocaleDateString('zh-CN') : <span className="text-gray-400">长期</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {n.price && n.price !== '0' ? `¥${n.price}/月` : '-'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={n.status} display={n.status_display} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(n.created_at).toLocaleString('zh-CN')}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(n.id, !!n.bound_device)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title={n.bound_device ? '已绑定设备，无法删除' : '删除'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => !creating && !createdNumber && setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {createdNumber ? '企微号创建成功' : '创建企微号'}
              </h3>
              <button
                onClick={() => { if (!creating) { setShowCreate(false); resetForm(); } }}
                className="p-1 rounded-md hover:bg-gray-100 text-gray-400"
                disabled={creating}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4">
              {createdNumber ? (
                /* ---- Success: Show GUID ---- */
                <div className="space-y-4">
                  <div className="flex items-center justify-center py-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 size={32} className="text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600">企微号已成功创建，请将以下 GUID 提供给租户进行绑定</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">GUID 号</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-lg font-mono font-semibold text-primary-600 break-all">{createdNumber.guid}</code>
                      <button
                        onClick={() => handleCopyGuid(createdNumber.guid)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-600 text-xs font-medium rounded-md hover:bg-primary-100"
                      >
                        <Copy size={14} />
                        {copiedGuid ? '已复制' : '复制'}
                      </button>
                    </div>
                  </div>
                  {createdNumber.tenant_name && (
                    <div className="text-sm text-gray-600">
                      归属租户：<span className="font-medium text-gray-900">{createdNumber.tenant_name}</span>
                    </div>
                  )}
                  <div className="text-sm text-gray-600">
                    归属省份：<span className="font-medium text-gray-900">{createdNumber.province_name}</span>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => { setShowCreate(false); resetForm(); }}
                      className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      关闭
                    </button>
                    <button
                      onClick={() => { resetForm(); }}
                      className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                    >
                      继续创建
                    </button>
                  </div>
                </div>
              ) : (
                /* ---- Form ---- */
                <div className="space-y-4">
                  {/* Tenant */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">归属租户</label>
                    <select
                      value={form.tenant_id}
                      onChange={e => setForm({ ...form, tenant_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">不分配（租户自行绑定）</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">备注该企微号的归属企业</p>
                  </div>

                  {/* Province */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      设备归属省 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.province_code}
                      onChange={e => setForm({ ...form, province_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">请选择省份</option>
                      {areaCodes.map(a => (
                        <option key={a.code} value={a.code}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Remark */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
                    <input
                      type="text"
                      value={form.remark}
                      onChange={e => setForm({ ...form, remark: e.target.value })}
                      placeholder="如：归属企业名称"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Expires at + Price */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">有效期</label>
                      <input
                        type="date"
                        value={form.expires_at}
                        onChange={e => setForm({ ...form, expires_at: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">留空表示长期有效</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">收费标准</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={form.price}
                          onChange={e => setForm({ ...form, price: e.target.value })}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">元/月</span>
                      </div>
                    </div>
                  </div>

                  {/* Device name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">设备名称（选填）</label>
                    <input
                      type="text"
                      value={form.device_name}
                      onChange={e => setForm({ ...form, device_name: e.target.value })}
                      placeholder="留空自动生成"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => { setShowCreate(false); resetForm(); }}
                      className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                      disabled={creating}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={creating || !form.province_code}
                      className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      {creating ? '创建中...' : '下一步'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
