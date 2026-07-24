// ============================================================
// YesGo Admin — Public Database Management
// ============================================================
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { api } from '@/lib/api';
import type { DataConnector, DatabaseRecord } from '@/types';
import {
  Database,
  HardDrive,
  Link,
  Server,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';

// ---- Icon mapping ----
const ICON_OPTIONS = [
  'Database', 'HardDrive', 'Server', 'Globe', 'Cloud',
  'Link', 'Box', 'Package', 'FolderTree', 'Shield',
] as const;

const iconMap: Record<string, React.ReactNode> = {
  database: <Database size={20} />,
  harddrive: <HardDrive size={20} />,
  server: <Server size={20} />,
  globe: <Database size={20} />,
  cloud: <HardDrive size={20} />,
  link: <Link size={20} />,
  box: <Server size={20} />,
  package: <HardDrive size={20} />,
  foldertree: <Server size={20} />,
  shield: <Database size={20} />,
};

const TYPE_BADGE: Record<string, string> = {
  erp: 'bg-blue-100 text-blue-700',
  b2b: 'bg-purple-100 text-purple-700',
  b2c: 'bg-emerald-100 text-emerald-700',
  'third-party': 'bg-orange-100 text-orange-700',
};

const TYPE_LABEL: Record<string, string> = {
  erp: 'ERP',
  b2b: 'B2B',
  b2c: 'B2C',
  'third-party': '第三方',
};

const STATUS_BADGE: Record<string, string> = {
  connected: 'bg-green-100 text-green-700',
  disconnected: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
};

const STATUS_LABEL: Record<string, string> = {
  connected: '已连接',
  disconnected: '已断开',
  pending: '连接中',
};

// ---- Mock Tenant DB Data ----
const MOCK_TENANT_DBS: DatabaseRecord[] = [
  { id: 1, name: 'ERP生产库', type: 'PostgreSQL', host: '10.0.1.100', port: 5432, status: 'connected', size: '256 GB', tables_count: 128, created_at: '2025-01-15' },
  { id: 2, name: 'B2B订单库', type: 'MySQL', host: '10.0.1.101', port: 3306, status: 'connected', size: '128 GB', tables_count: 64, created_at: '2025-02-20' },
  { id: 3, name: 'B2C用户库', type: 'MongoDB', host: '10.0.2.50', port: 27017, status: 'disconnected', size: '512 GB', tables_count: 256, created_at: '2025-03-10' },
  { id: 4, name: '分析数据仓库', type: 'ClickHouse', host: '10.0.3.10', port: 8123, status: 'connected', size: '1.2 TB', tables_count: 48, created_at: '2025-04-05' },
  { id: 5, name: '日志归档库', type: 'Elasticsearch', host: '10.0.4.20', port: 9200, status: 'pending', size: '768 GB', tables_count: 12, created_at: '2025-05-18' },
  { id: 6, name: '缓存实例', type: 'Redis', host: '10.0.5.30', port: 6379, status: 'connected', size: '64 GB', tables_count: 0, created_at: '2025-06-01' },
];

const TENANT_DB_STATUS: Record<string, { badge: string; label: string }> = {
  connected: { badge: 'bg-green-100 text-green-700', label: '已连接' },
  disconnected: { badge: 'bg-red-100 text-red-700', label: '已断开' },
  pending: { badge: 'bg-yellow-100 text-yellow-700', label: '连接中' },
};

interface ConnectorFormData {
  name: string;
  type: string;
  description: string;
  icon_name: string;
}

const EMPTY_FORM: ConnectorFormData = {
  name: '',
  type: 'erp',
  description: '',
  icon_name: 'Database',
};

// ---- Skeleton Components ----
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function ConnectorCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-28 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-5 w-8" />
      </div>
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-3/4 mb-4" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----
export default function DatabasePage() {
  // Connectors state
  const [connectors, setConnectors] = useState<DataConnector[]>([]);
  const [connectorsLoading, setConnectorsLoading] = useState(true);
  const [connectorsError, setConnectorsError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingConnector, setEditingConnector] = useState<DataConnector | null>(null);
  const [formData, setFormData] = useState<ConnectorFormData>(EMPTY_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<DataConnector | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle state
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  // ---- Fetch connectors ----
  const fetchConnectors = useCallback(async () => {
    try {
      setConnectorsError('');
      const res = await api.getConnectors();
      setConnectors(res.data || []);
    } catch (e: unknown) {
      setConnectorsError(e instanceof Error ? e.message : '加载连接器失败');
    } finally {
      setConnectorsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConnectors();
  };

  // ---- Stats ----
  const enabledCount = connectors.filter((c) => c.enabled).length;
  const lastSync = connectors
    .map((c) => c.last_sync)
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] || '—';

  // ---- Toggle enabled ----
  const handleToggle = async (connector: DataConnector) => {
    setTogglingIds((prev) => new Set(prev).add(connector.id));
    try {
      await api.updateConnector(connector.id, { enabled: !connector.enabled });
      setConnectors((prev) =>
        prev.map((c) => (c.id === connector.id ? { ...c, enabled: !c.enabled } : c))
      );
    } catch (e: unknown) {
      // Revert on error — silently show the old state
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(connector.id);
        return next;
      });
    }
  };

  // ---- Open modal ----
  const openAddModal = () => {
    setEditingConnector(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (connector: DataConnector) => {
    setEditingConnector(connector);
    setFormData({
      name: connector.name,
      type: connector.type,
      description: connector.description,
      icon_name: connector.icon_name,
    });
    setFormError('');
    setShowModal(true);
  };

  // ---- Submit form ----
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('请输入连接器名称');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingConnector) {
        await api.updateConnector(editingConnector.id, formData as unknown as Record<string, unknown>);
      } else {
        await api.createConnector(formData as unknown as Record<string, unknown>);
      }
      setShowModal(false);
      fetchConnectors();
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
      await api.deleteConnector(deleteTarget.id);
      setDeleteTarget(null);
      fetchConnectors();
    } catch (e: unknown) {
      // Error handled silently
    } finally {
      setDeleting(false);
    }
  };

  // ---- Utility ----
  const formatSyncTime = (time: string | null) => {
    if (!time) return '从未同步';
    const d = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} 小时前`;
    return d.toLocaleDateString('zh-CN');
  };

  // ---- Render ----
  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">数据库管理</h1>
        <p className="text-sm text-gray-500 mt-1">公共数据库与数据连接器管理</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <Link size={20} className="text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{connectors.length}</p>
              <p className="text-sm text-gray-500">数据连接器总数</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Wifi size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{enabledCount}</p>
              <p className="text-sm text-gray-500">已启用数</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">最后同步时间</p>
              <p className="text-base font-semibold text-gray-900 mt-0.5">
                {typeof lastSync === 'string' && lastSync !== '—'
                  ? formatSyncTime(lastSync)
                  : lastSync}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Connectors Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">数据连接器</h2>
            <p className="text-sm text-gray-500 mt-0.5">管理外部数据源连接</p>
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
              添加连接器
            </button>
          </div>
        </div>

        {/* Connectors List */}
        {connectorsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <ConnectorCardSkeleton key={i} />
            ))}
          </div>
        ) : connectorsError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-red-700 text-sm mb-3">{connectorsError}</p>
            <button
              onClick={handleRefresh}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              重试
            </button>
          </div>
        ) : connectors.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Link size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-sm mb-4">暂无连接器</p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
            >
              <Plus size={16} />
              添加第一个连接器
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectors.map((connector) => (
              <div
                key={connector.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow animate-slide-up"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                      {iconMap[connector.icon_name?.toLowerCase()] || <Link size={20} />}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 text-sm">{connector.name}</h3>
                      <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-0.5 ${TYPE_BADGE[connector.type] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABEL[connector.type] || connector.type}
                      </span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[connector.status] || 'bg-gray-100 text-gray-600'}`}>
                    {connector.status === 'connected' ? <Wifi size={12} /> : connector.status === 'disconnected' ? <WifiOff size={12} /> : null}
                    {STATUS_LABEL[connector.status] || connector.status}
                  </span>
                </div>

                <p className="text-xs text-gray-500 mb-4 line-clamp-2">{connector.description || '暂无描述'}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock size={12} />
                    <span>{formatSyncTime(connector.last_sync)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Enabled Toggle */}
                    <button
                      onClick={() => handleToggle(connector)}
                      disabled={togglingIds.has(connector.id)}
                      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors disabled:opacity-50 ${
                        connector.enabled ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                      title={connector.enabled ? '禁用' : '启用'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          connector.enabled ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => openEditModal(connector)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="编辑"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(connector)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tenant Database List */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">租户数据库</h2>
          <p className="text-sm text-gray-500 mt-0.5">各���户独立数据库概览</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">数据库名称</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">类型</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">主机</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">端口</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">状态</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">大小</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">表数量</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">创建时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {MOCK_TENANT_DBS.map((db) => {
                  const st = TENANT_DB_STATUS[db.status] || { badge: 'bg-gray-100 text-gray-600', label: db.status };
                  return (
                    <tr key={db.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{db.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">{db.type}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">{db.host}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">{db.port}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.badge}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{db.size}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{db.tables_count}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{db.created_at}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---- Add/Edit Connector Modal ---- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingConnector ? '编辑连接器' : '添加连接器'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                  placeholder="请输入连接器名称"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-white"
                >
                  <option value="erp">ERP</option>
                  <option value="b2b">B2B</option>
                  <option value="b2c">B2C</option>
                  <option value="third-party">第三方</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow resize-none"
                  placeholder="请输入连接器描述"
                />
              </div>

              {/* Icon Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">图标</label>
                <select
                  value={formData.icon_name}
                  onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-white"
                >
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      提交中...
                    </>
                  ) : editingConnector ? (
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
      )}

      {/* ---- Delete Confirmation Modal ---- */}
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
                  确定要删除连接器 &ldquo;{deleteTarget.name}&rdquo; 吗？此操作不可撤销。
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
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    删除中...
                  </>
                ) : (
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
