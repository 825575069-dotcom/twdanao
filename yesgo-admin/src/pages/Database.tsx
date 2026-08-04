// ============================================================
// YesGo Admin — 租户数据库管理
// 平台卡片视图 + 企业同步匹配 + 智能体绑定闭环
// ============================================================
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { api } from '@/lib/api';
import type { PlatformDatabase, PlatformEnterprise } from '@/types';
import {
  Database, Server, Plus, Edit, Trash2, RefreshCw,
  X, Check, AlertTriangle, Building2, Link2, Link2Off,
  Cloud, Globe, Wifi, WifiOff, Clock, ChevronRight,
  Settings, Users, Zap,
} from 'lucide-react';

// ---- Type badges ----
const TYPE_BADGE: Record<string, string> = {
  erp: 'bg-blue-100 text-blue-700',
  b2b: 'bg-purple-100 text-purple-700',
  b2c: 'bg-emerald-100 text-emerald-700',
  third_party: 'bg-orange-100 text-orange-700',
};

const TYPE_LABEL: Record<string, string> = {
  erp: 'ERP',
  b2b: 'B2B',
  b2c: 'B2C',
  third_party: '第三方',
};

const SYNC_STATUS: Record<string, { badge: string; label: string }> = {
  success: { badge: 'bg-green-100 text-green-700', label: '同步成功' },
  failed: { badge: 'bg-red-100 text-red-700', label: '同步失败' },
  '': { badge: 'bg-gray-100 text-gray-600', label: '未同步' },
};

const DB_TYPE_ICON: Record<string, string> = {
  mysql: 'MySQL',
  api: 'API',
};

// ---- Skeleton ----
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-32 mb-1.5" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-2/3 mb-4" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// ---- Platform Card ----
function PlatformCard({
  db,
  onSync,
  onEdit,
  onDelete,
  onView,
  syncing,
}: {
  db: PlatformDatabase;
  onSync: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  syncing: boolean;
}) {
  const syncInfo = SYNC_STATUS[db.last_sync_status] || SYNC_STATUS[''];
  const formatTime = (time: string | null) => {
    if (!time) return '从未同步';
    const d = new Date(time);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} 小时前`;
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
            <Server size={22} className="text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-base">{db.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[db.type] || 'bg-gray-100 text-gray-600'}`}>
                {TYPE_LABEL[db.type] || db.type}
              </span>
              <span className="text-xs text-gray-400">{db.code}</span>
            </div>
          </div>
        </div>
        {/* Sync status */}
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${syncInfo.badge}`}>
          {db.last_sync_status === 'success' ? <Wifi size={12} /> : db.last_sync_status === 'failed' ? <WifiOff size={12} /> : null}
          {syncInfo.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 mb-3 line-clamp-1">{db.description || '暂无描述'}</p>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Building2 size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500">同步企业</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{db.total_enterprises}</p>
        </div>
        <div className="bg-green-50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Link2 size={14} className="text-green-500" />
            <span className="text-xs text-green-600">已匹配租户</span>
          </div>
          <p className="text-lg font-bold text-green-700">{db.linked_tenant_count}</p>
        </div>
      </div>

      {/* Last sync time */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <Clock size={12} />
        <span>{formatTime(db.last_synced_at)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSync}
          disabled={syncing || !db.sync_enabled}
          className="flex-1 flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? '同步中...' : '同步企业'}
        </button>
        <button
          onClick={onView}
          className="flex items-center justify-center gap-1 text-gray-600 hover:bg-gray-100 text-xs font-medium py-2 px-3 rounded-lg transition-colors"
          title="查看企业列表"
        >
          <Users size={14} />
          详情
        </button>
        <button
          onClick={onEdit}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="编辑"
        >
          <Edit size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="删除"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Sync error display */}
      {db.last_sync_error && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <div className="flex items-start gap-1.5">
            <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600 line-clamp-2">{db.last_sync_error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Enterprise Detail Modal ----
function EnterpriseDetailModal({
  db,
  onClose,
  onMatch,
}: {
  db: PlatformDatabase;
  onClose: () => void;
  onMatch: (ent: PlatformEnterprise) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <Server size={20} className="text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{db.name}</h3>
              <p className="text-xs text-gray-500">
                {TYPE_LABEL[db.type] || db.type} · {db.enterprises?.length || 0} 家企业
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Enterprise List */}
        <div className="flex-1 overflow-y-auto p-4">
          {db.enterprises && db.enterprises.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-2">企业名称</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-2">统一信用代码</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-2">数据库类型</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-2">匹配状态</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {db.enterprises.map((ent) => (
                  <tr key={ent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900">
                      {ent.enterprise_name || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 font-mono">
                      {ent.enterprise_id}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {DB_TYPE_ICON[ent.db_type] || ent.db_type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {ent.matched_tenant ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          <Link2 size={12} />
                          {ent.matched_tenant_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          <Link2Off size={12} />
                          未匹配
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => onMatch(ent)}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {ent.matched_tenant ? '重新匹配' : '匹配租户'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <Building2 size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">暂无同步企业，请先点击「同步企业」</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Platform Database Form Modal ----
function PlatformFormModal({
  editing,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  editing: PlatformDatabase | null;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
  error: string;
}) {
  const [form, setForm] = useState({
    code: editing?.code || '',
    name: editing?.name || '',
    type: editing?.type || 'erp',
    description: editing?.description || '',
    icon_name: editing?.icon_name || 'Database',
    api_base_url: editing?.api_base_url || '',
    api_token: editing?.api_token || '',
    sync_enabled: editing?.sync_enabled ?? true,
    enabled: editing?.enabled ?? true,
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, type: form.type as 'erp' | 'b2b' | 'b2c' | 'third_party' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-900">
            {editing ? '编辑平台数据库' : '添加平台数据库'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">平台编码 *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="如 erp_platform"
                disabled={!!editing}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">平台名称 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="如 ERP 供应链平台"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">平台类型 *</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as 'erp' | 'b2b' | 'b2c' | 'third_party' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
            >
              <option value="erp">ERP</option>
              <option value="b2b">B2B</option>
              <option value="b2c">B2C</option>
              <option value="third_party">第三方</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              placeholder="平台描述"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              同步 API 地址
              <span className="ml-1 text-xs text-gray-400">（标准协议：/api/brain/enterprises/）</span>
            </label>
            <input
              type="text"
              value={form.api_base_url}
              onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono"
              placeholder="https://erp.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">API Token (Bearer)</label>
            <input
              type="password"
              value={form.api_token}
              onChange={(e) => setForm({ ...form, api_token: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono"
              placeholder="Bearer Token"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.sync_enabled}
                onChange={(e) => setForm({ ...form, sync_enabled: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">启用同步</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">启用平台</span>
            </label>
          </div>

          {/* Protocol Info */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <div className="flex items-start gap-2">
              <Zap size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <p className="font-medium mb-1">标准同步协议</p>
                <p className="text-blue-600">
                  天网大脑将通过 <code className="bg-blue-100 px-1 rounded">GET /api/brain/enterprises/</code> 从您的 SaaS 平台拉取企业列表及数据库连接信息。
                  响应格式：{'{ code: 0, data: { total, enterprises: [{ enterprise_id, enterprise_name, db_type, db_config }] }}'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  提交中...
                </>
              ) : editing ? (
                <>
                  <Check size={16} />
                  保存
                </>
              ) : (
                <>
                  <Plus size={16} />
                  添加
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Match Modal ----
function MatchModal({
  enterprise,
  onClose,
  onMatch,
  submitting,
}: {
  enterprise: PlatformEnterprise;
  onClose: () => void;
  onMatch: (tenantId: number) => void;
  submitting: boolean;
}) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md animate-slide-up p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">匹配租户</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-900">{enterprise.enterprise_name || '未命名企业'}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{enterprise.enterprise_id}</p>
        </div>

        {enterprise.matched_tenant && (
          <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg">
            <div className="flex items-center gap-2">
              <Link2 size={16} className="text-green-600" />
              <div>
                <p className="text-xs text-green-600">当前已匹配</p>
                <p className="text-sm font-medium text-green-800">
                  {enterprise.matched_tenant_name}
                  <span className="text-xs text-green-600 ml-1">({enterprise.matched_tenant_code})</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600 mb-4">
          系统将使用统一社会信用代码 <code className="bg-gray-100 px-1 rounded text-xs">{enterprise.enterprise_id}</code> 自动匹配对应租户。
          匹配成功后，将自动创建数据连接器供该租户的智能体使用。
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onMatch(0)}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                匹配中...
              </>
            ) : (
              <>
                <Link2 size={16} />
                自动匹配
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----
export default function DatabasePage() {
  const [databases, setDatabases] = useState<PlatformDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingDb, setEditingDb] = useState<PlatformDatabase | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [detailDb, setDetailDb] = useState<PlatformDatabase | null>(null);
  const [matchTarget, setMatchTarget] = useState<PlatformEnterprise | null>(null);
  const [matchSubmitting, setMatchSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PlatformDatabase | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---- Fetch ----
  const fetchDatabases = useCallback(async () => {
    try {
      setError('');
      const res = await api.getPlatformDatabases();
      setDatabases(res.data?.databases || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载平台数据库失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDatabases();
  };

  // ---- Sync ----
  const handleSync = async (db: PlatformDatabase) => {
    setSyncingIds(prev => new Set(prev).add(db.id));
    try {
      await api.syncPlatformDatabase(db.id);
      // 重新加载
      fetchDatabases();
    } catch (e: unknown) {
      // 错误会在下次加载时显示
      console.error('Sync failed:', e);
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(db.id);
        return next;
      });
    }
  };

  // ---- View Detail ----
  const handleViewDetail = async (db: PlatformDatabase) => {
    try {
      const res = await api.getPlatformDatabase(db.id);
      setDetailDb(res.data);
    } catch {
      // 如果获取详情失败，用列表数据
      setDetailDb(db);
    }
  };

  // ---- Form ----
  const openAddModal = () => {
    setEditingDb(null);
    setFormError('');
    setShowForm(true);
  };

  const openEditModal = (db: PlatformDatabase) => {
    setEditingDb(db);
    setFormError('');
    setShowForm(true);
  };

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    setFormError('');
    setFormSubmitting(true);
    try {
      if (editingDb) {
        await api.updatePlatformDatabase(editingDb.id, data);
      } else {
        await api.createPlatformDatabase(data);
      }
      setShowForm(false);
      fetchDatabases();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setFormSubmitting(false);
    }
  };

  // ---- Delete ----
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deletePlatformDatabase(deleteTarget.id);
      setDeleteTarget(null);
      fetchDatabases();
    } catch {
      // Error handled silently
    } finally {
      setDeleting(false);
    }
  };

  // ---- Match ----
  const handleMatch = async (tenantId: number) => {
    if (!matchTarget) return;
    setMatchSubmitting(true);
    try {
      await api.matchEnterprise(matchTarget.id, {
        enterprise_id: matchTarget.enterprise_id,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      });
      setMatchTarget(null);
      // 重新加载详情
      if (detailDb) {
        const res = await api.getPlatformDatabase(detailDb.id);
        setDetailDb(res.data);
      }
      fetchDatabases();
    } catch {
      // Error handled silently
    } finally {
      setMatchSubmitting(false);
    }
  };

  // ---- Stats ----
  const totalEnterprises = databases.reduce((sum, db) => sum + db.total_enterprises, 0);
  const totalLinked = databases.reduce((sum, db) => sum + db.linked_tenant_count, 0);

  // ---- Render ----
  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">租户数据库</h1>
        <p className="text-sm text-gray-500 mt-1">
          管理第一层 SaaS 平台对接，通过统一社会信用代码自动匹配租户企业数据库
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <Server size={20} className="text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{databases.length}</p>
              <p className="text-sm text-gray-500">已对接平台数</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalEnterprises}</p>
              <p className="text-sm text-gray-500">同步企业总数</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Link2 size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalLinked}</p>
              <p className="text-sm text-gray-500">已匹配租户数</p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Cards Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">平台数据库</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              每个平台代表一个第一层 SaaS 系统（ERP / B2B / B2C），同步后自动按统一信用代码匹配租户
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
            >
              <Plus size={16} />
              添加平台
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-red-700 text-sm mb-3">{error}</p>
            <button onClick={handleRefresh} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              重试
            </button>
          </div>
        ) : databases.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Database size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-sm mb-4">暂无平台数据库</p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
            >
              <Plus size={16} />
              添加第一个平台
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {databases.map(db => (
              <PlatformCard
                key={db.id}
                db={db}
                onSync={() => handleSync(db)}
                onEdit={() => openEditModal(db)}
                onDelete={() => setDeleteTarget(db)}
                onView={() => handleViewDetail(db)}
                syncing={syncingIds.has(db.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Matching Flow Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Settings size={20} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">数据匹配与绑定流程</h3>
            <div className="flex items-center gap-2 text-xs text-blue-700 flex-wrap">
              <span className="bg-blue-100 px-2 py-1 rounded">1. 配置 SaaS 平台 API</span>
              <ChevronRight size={14} className="text-blue-400" />
              <span className="bg-blue-100 px-2 py-1 rounded">2. 同步企业列表</span>
              <ChevronRight size={14} className="text-blue-400" />
              <span className="bg-blue-100 px-2 py-1 rounded">3. 统一信用代码匹配租户</span>
              <ChevronRight size={14} className="text-blue-400" />
              <span className="bg-blue-100 px-2 py-1 rounded">4. 自动创建数据连接器</span>
              <ChevronRight size={14} className="text-blue-400" />
              <span className="bg-blue-100 px-2 py-1 rounded">5. 绑定给租户智能体</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <PlatformFormModal
          editing={editingDb}
          onClose={() => setShowForm(false)}
          onSubmit={handleFormSubmit}
          submitting={formSubmitting}
          error={formError}
        />
      )}

      {detailDb && (
        <EnterpriseDetailModal
          db={detailDb}
          onClose={() => setDetailDb(null)}
          onMatch={(ent) => setMatchTarget(ent)}
        />
      )}

      {matchTarget && (
        <MatchModal
          enterprise={matchTarget}
          onClose={() => setMatchTarget(null)}
          onMatch={handleMatch}
          submitting={matchSubmitting}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm animate-slide-up p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
                <p className="text-sm text-gray-500">
                  确定要删除平台 &ldquo;{deleteTarget.name}&rdquo; 吗？关联的企业缓存将一并删除，此操作不可撤销。
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {deleting ? '删除中...' : (
                  <>
                    <Trash2 size={16} />
                    删除
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
