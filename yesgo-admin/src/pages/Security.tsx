// ============================================================
// YesGo Admin — Security & Audit Page
// ============================================================
import { useState, useEffect, useCallback, Fragment } from 'react';
import { api } from '@/lib/api';
import type { SecurityOverview, AuditLog, SecurityEvent } from '@/types';
import {
  Shield, AlertTriangle, FileSearch, ShieldAlert, CheckCircle,
  Filter, Eye, Plus, Trash2, ChevronDown, ChevronUp,
  AlertCircle, Loader2, X, Clock, User, Globe, Activity,
} from 'lucide-react';

// ---- Risk level colors ----
const RISK_COLORS: Record<string, { badge: string; dot: string }> = {
  low: { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  medium: { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  high: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  critical: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

const RISK_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

// ---- Severity colors (for events) ----
const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const SEVERITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

// ---- Event type labels ----
const EVENT_TYPE_LABELS: Record<string, string> = {
  login_anomaly: '登录异常',
  permission_change: '权限变更',
  api_abuse: 'API 滥用',
  data_leak: '数据泄露',
  config_change: '配置变更',
  brute_force: '暴力破解',
  sensitive_op: '敏感操作',
};

// ============================================================
// Stats Card
// ============================================================
interface StatsCardProps {
  icon: typeof Shield;
  label: string;
  value: number | string;
  color: 'blue' | 'amber' | 'red' | 'emerald';
  loading?: boolean;
}

function StatsCard({ icon: Icon, label, value, color, loading }: StatsCardProps) {
  const colorMap = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
    red: { bg: 'bg-red-50', text: 'text-red-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  };
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={c.text} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          {loading ? (
            <div className="h-6 w-16 bg-gray-100 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Audit Logs Tab
// ============================================================
interface AccessRule {
  id: number;
  name: string;
  type: string;
  pattern: string;
  action: string;
  enabled: boolean;
}

function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState('7days');
  const [actionFilter, setActionFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (dateRange === 'today') params.start_date = new Date().toISOString().split('T')[0];
      if (dateRange === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.start_date = d.toISOString().split('T')[0];
      }
      if (dateRange === '30days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.start_date = d.toISOString().split('T')[0];
      }
      if (actionFilter) params.action = actionFilter;
      if (riskFilter) params.risk_level = riskFilter;
      const res = await api.getAuditLogs(params);
      setLogs(res.data || []);
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取审计日志失败');
    } finally {
      setLoading(false);
    }
  }, [dateRange, actionFilter, riskFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(logs.length / pageSize);
  const pageLogs = logs.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-gray-400" />
        {/* Date Range */}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="today">今天</option>
          <option value="7days">最近 7 天</option>
          <option value="30days">最近 30 天</option>
        </select>
        {/* Action Type */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="">全部操作</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
        {/* Risk Level */}
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="">全部风险等级</option>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="critical">严重</option>
        </select>
        {(actionFilter || riskFilter || dateRange !== '7days') && (
          <button
            onClick={() => { setActionFilter(''); setRiskFilter(''); setDateRange('7days'); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={fetchLogs} className="ml-auto text-xs text-red-700 underline">重试</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : pageLogs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FileSearch size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">暂无审计日志</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 bg-gray-50">
                  <th className="text-left py-2.5 px-3 font-medium">时间</th>
                  <th className="text-left py-2.5 px-3 font-medium">用户</th>
                  <th className="text-left py-2.5 px-3 font-medium">操作</th>
                  <th className="text-left py-2.5 px-3 font-medium">资源类型</th>
                  <th className="text-left py-2.5 px-3 font-medium">描述</th>
                  <th className="text-left py-2.5 px-3 font-medium">方法</th>
                  <th className="text-left py-2.5 px-3 font-medium">路径</th>
                  <th className="text-left py-2.5 px-3 font-medium">IP</th>
                  <th className="text-left py-2.5 px-3 font-medium">风险等级</th>
                  <th className="text-center py-2.5 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pageLogs.map(log => {
                  const rc = RISK_COLORS[log.risk_level] || RISK_COLORS.low;
                  const isExpanded = expandedId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="py-2.5 px-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 text-gray-700 text-xs">{log.user_name}</td>
                        <td className="py-2.5 px-3">
                          <code className="text-xs font-mono text-gray-600">{log.action}</code>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 text-xs">{log.resource_type}</td>
                        <td className="py-2.5 px-3 text-gray-600 text-xs max-w-[200px] truncate" title={log.description}>{log.description}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs font-mono text-gray-500">{log.method}</span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 text-xs font-mono max-w-[150px] truncate" title={log.path}>{log.path}</td>
                        <td className="py-2.5 px-3 text-gray-500 text-xs font-mono">{log.ip_address}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${rc.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                            {RISK_LABELS[log.risk_level] || log.risk_level}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isExpanded ? <ChevronUp size={14} className="text-gray-400 mx-auto" /> : <ChevronDown size={14} className="text-gray-400 mx-auto" />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={10} className="px-6 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-gray-400">Request Body</span>
                                <p className="text-gray-600 mt-0.5 font-mono break-all">—</p>
                              </div>
                              <div>
                                <span className="text-gray-400">User Agent</span>
                                <p className="text-gray-600 mt-0.5">—</p>
                              </div>
                              <div>
                                <span className="text-gray-400">Duration (ms)</span>
                                <p className="text-gray-600 mt-0.5">—</p>
                              </div>
                              <div>
                                <span className="text-gray-400">Response Status</span>
                                <p className="text-gray-600 mt-0.5">—</p>
                              </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                              <Eye size={12} className="inline mr-1" />
                              完整请求详情（如有）
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                共 {logs.length} 条，第 {page + 1}/{totalPages} 页
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Security Events Tab
// ============================================================
function SecurityEventsTab() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getSecurityEvents();
      setEvents(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取安全事件失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleResolve = async (eventId: number) => {
    setResolvingId(eventId);
    try {
      await api.resolveSecurityEvent(eventId);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, resolved: true } : e));
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理事件失败');
    } finally {
      setResolvingId(null);
    }
  };

  const filtered = events.filter(e => {
    if (severityFilter && e.severity !== severityFilter) return false;
    if (resolvedFilter === 'resolved' && !e.resolved) return false;
    if (resolvedFilter === 'unresolved' && e.resolved) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-gray-400" />
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="">全部严重程度</option>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="critical">严重</option>
        </select>
        <select
          value={resolvedFilter}
          onChange={(e) => setResolvedFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="">全部状态</option>
          <option value="unresolved">未处理</option>
          <option value="resolved">已处理</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Events */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <ShieldAlert size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">暂无安全事件</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(event => (
            <div
              key={event.id}
              className={`bg-white rounded-xl shadow-sm border-l-4 p-4 ${
                event.severity === 'critical' ? 'border-l-red-500'
                : event.severity === 'high' ? 'border-l-orange-500'
                : event.severity === 'medium' ? 'border-l-yellow-500'
                : 'border-l-gray-300'
              } border-y border-r border-gray-200`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.low}`}>
                    {SEVERITY_LABELS[event.severity] || event.severity}
                  </span>
                </div>
                {event.resolved ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle size={12} />
                    已处理
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={12} />
                    待处理
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mb-3">{event.description}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                <span className="inline-flex items-center gap-1">
                  <User size={12} />
                  {event.user_name}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Globe size={12} />
                  {event.ip_address}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(event.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {!event.resolved && (
                <button
                  onClick={() => handleResolve(event.id)}
                  disabled={resolvingId === event.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {resolvingId === event.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  处理
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Access Control Rules Section
// ============================================================
interface AccessRuleForm {
  name: string;
  type: string;
  pattern: string;
  action: string;
}

function AccessRulesSection() {
  const [rules, setRules] = useState<AccessRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AccessRuleForm>({ name: '', type: 'ip', pattern: '', action: 'deny' });

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAccessRules();
      setRules((res.data as unknown as AccessRule[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取访问控制规则失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded) fetchRules();
  }, [expanded, fetchRules]);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.pattern.trim()) return;
    setAdding(true);
    try {
      await api.createAccessRule(form as unknown as Record<string, unknown>);
      await fetchRules();
      setForm({ name: '', type: 'ip', pattern: '', action: 'deny' });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加规则失败');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await api.deleteAccessRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
      setDeletingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除规则失败');
      setDeletingId(null);
    }
  };

  const toggleEnabled = (id: number) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const ACTION_COLORS: Record<string, string> = {
    allow: 'bg-emerald-100 text-emerald-700',
    deny: 'bg-red-100 text-red-700',
    warn: 'bg-amber-100 text-amber-700',
  };

  const ACTION_LABELS: Record<string, string> = {
    allow: '允许',
    deny: '拒绝',
    warn: '警告',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Shield className="text-primary-600" size={18} />
          <h2 className="font-semibold text-gray-900">访问控制规则</h2>
          {!loading && rules.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{rules.length}</span>
          )}
        </div>
        {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 animate-fade-in">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 mb-3">
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
              <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
                <X size={14} />
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-6">
              <Shield size={24} className="text-gray-300 mx-auto mb-1" />
              <p className="text-sm text-gray-400 mb-3">暂无访问控制规则</p>
            </div>
          ) : (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500">
                    <th className="text-left py-2 px-3 font-medium">规则名称</th>
                    <th className="text-left py-2 px-3 font-medium">类型</th>
                    <th className="text-left py-2 px-3 font-medium">匹配模式</th>
                    <th className="text-left py-2 px-3 font-medium">动作</th>
                    <th className="text-center py-2 px-3 font-medium">启用</th>
                    <th className="text-right py-2 px-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(rule => (
                    <tr key={rule.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-900 font-medium text-sm">{rule.name}</td>
                      <td className="py-2 px-3 text-gray-600 text-xs">{rule.type}</td>
                      <td className="py-2 px-3 text-gray-500 text-xs font-mono">{rule.pattern}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ACTION_COLORS[rule.action] || 'bg-gray-100 text-gray-600'}`}>
                          {ACTION_LABELS[rule.action] || rule.action}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => toggleEnabled(rule.id)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${rule.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${rule.enabled ? 'translate-x-4' : ''}`} />
                        </button>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => handleDelete(rule.id)}
                          disabled={deletingId === rule.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                        >
                          {deletingId === rule.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Form */}
          {showForm ? (
            <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="规则名称"
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value="ip">IP</option>
                  <option value="path">路径</option>
                  <option value="user">用户</option>
                  <option value="role">角色</option>
                </select>
                <input
                  type="text"
                  value={form.pattern}
                  onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                  placeholder="匹配模式 (如 192.168.*.*)"
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
                <select
                  value={form.action}
                  onChange={(e) => setForm({ ...form, action: e.target.value })}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value="allow">允许</option>
                  <option value="deny">拒绝</option>
                  <option value="warn">警告</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowForm(false); setForm({ name: '', type: 'ip', pattern: '', action: 'deny' }); }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAdd}
                  disabled={adding || !form.name.trim() || !form.pattern.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  添加
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={14} />
              添加规则
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function Security() {
  const [activeTab, setActiveTab] = useState<'audit' | 'events'>('audit');
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingOverview(true);
      try {
        const res = await api.getSecurityOverview();
        if (mounted) setOverview(res.data);
      } catch {
        // Non-critical
      } finally {
        if (mounted) setLoadingOverview(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="text-primary-600" size={22} />
          安全审计
        </h1>
        <p className="text-sm text-gray-500 mt-1">审计日志、安全事件与访问控制</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          icon={FileSearch}
          label="审计日志总数"
          value={overview?.total_audit_logs ?? '—'}
          color="blue"
          loading={loadingOverview}
        />
        <StatsCard
          icon={ShieldAlert}
          label="安全事件总数"
          value={overview?.total_events ?? '—'}
          color="amber"
          loading={loadingOverview}
        />
        <StatsCard
          icon={AlertTriangle}
          label="未处理事件"
          value={overview?.unresolved_events ?? '—'}
          color="red"
          loading={loadingOverview}
        />
        <StatsCard
          icon={Activity}
          label="严重事件"
          value={overview?.critical_events ?? '—'}
          color="emerald"
          loading={loadingOverview}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'audit'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileSearch size={16} />
          审计日志
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'events'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldAlert size={16} />
          安全事件
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'audit' ? <AuditLogsTab /> : <SecurityEventsTab />}

      {/* Access Control Rules */}
      <AccessRulesSection />
    </div>
  );
}
