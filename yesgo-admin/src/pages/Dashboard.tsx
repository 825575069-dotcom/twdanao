// ============================================================
// YesGo Admin — System Overview Dashboard
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Activity, Server, Users, Cpu, AlertTriangle, TrendingUp, Shield,
  TrendingDown, Minus, RefreshCw, Clock,
} from 'lucide-react';
import type { SystemHealth, DashboardOverview, DashboardKPI, DashboardAlert } from '@/types';

// ---- Skeleton Placeholders -------------------------------------------------
function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function HealthCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <SkeletonBlock className="w-8 h-8 rounded-lg" />
        <div>
          <SkeletonBlock className="h-4 w-24 mb-1" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SkeletonBlock className="h-10 rounded-lg" />
        <SkeletonBlock className="h-10 rounded-lg" />
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <SkeletonBlock className="w-10 h-10 rounded-lg" />
        <SkeletonBlock className="w-6 h-6 rounded" />
      </div>
      <SkeletonBlock className="h-3 w-16 mb-2" />
      <SkeletonBlock className="h-7 w-20 mb-1" />
      <SkeletonBlock className="h-3 w-12" />
    </div>
  );
}

// ---- Severity Helpers ------------------------------------------------------
const severityConfig: Record<string, { bg: string; text: string; dot: string }> = {
  high: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
};

const severityLabels: Record<string, string> = {
  high: '高危',
  medium: '中危',
  low: '低危',
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function renderTrend(growth: number) {
  if (growth > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
        <TrendingUp size={12} /> +{growth}%
      </span>
    );
  }
  if (growth < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-red-600">
        <TrendingDown size={12} /> {growth}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
      <Minus size={12} /> 持平
    </span>
  );
}

// ============================================================
// Dashboard Page
// ============================================================
export default function Dashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState('');

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');

  const [kpis, setKpis] = useState<DashboardKPI[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState('');

  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [alertLoading, setAlertLoading] = useState(true);
  const [alertError, setAlertError] = useState('');

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    // Health
    setHealthLoading(true);
    setHealthError('');
    try {
      const res = await api.health();
      setHealth(res.data);
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : '获取健康状态失败');
    } finally {
      setHealthLoading(false);
    }

    // Overview
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const res = await api.getDashboardOverview();
      setOverview(res.data);
    } catch (e) {
      setOverviewError(e instanceof Error ? e.message : '获取概览数据失败');
    } finally {
      setOverviewLoading(false);
    }

    // KPI
    setKpiLoading(true);
    setKpiError('');
    try {
      const res = await api.getDashboardKPI();
      setKpis(res.data);
    } catch (e) {
      setKpiError(e instanceof Error ? e.message : '获取KPI数据失败');
    } finally {
      setKpiLoading(false);
    }

    // Alerts
    setAlertLoading(true);
    setAlertError('');
    try {
      const res = await api.getDashboardAlerts();
      setAlerts(res.data);
    } catch (e) {
      setAlertError(e instanceof Error ? e.message : '获取告警数据失败');
    } finally {
      setAlertLoading(false);
    }

    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, 30_000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  // ---- Stats Data ----------------------------------------------------------
  const stats = overview
    ? [
        {
          label: '总租户数',
          value: overview.tenants.total,
          sub: `活跃 ${overview.tenants.active}`,
          icon: Users,
          growth: null,
          iconBg: 'bg-blue-50',
          iconColor: 'text-blue-600',
        },
        {
          label: '活跃模型数',
          value: overview.agents.active,
          sub: `总计 ${overview.agents.total}`,
          icon: Cpu,
          growth: null,
          iconBg: 'bg-purple-50',
          iconColor: 'text-purple-600',
        },
        {
          label: 'API 调用量',
          value: overview.orders.total,
          sub: null,
          icon: Activity,
          growth: overview.orders.growth,
          iconBg: 'bg-emerald-50',
          iconColor: 'text-emerald-600',
        },
        {
          label: '系统告警',
          value: overview.inventory.alerts,
          sub: `总计 ${overview.inventory.total}`,
          icon: AlertTriangle,
          growth: null,
          iconBg: 'bg-orange-50',
          iconColor: 'text-orange-600',
        },
      ]
    : [];

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">系统概览</h1>
          <p className="text-sm text-gray-500 mt-0.5">天网大脑运行状态</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock size={13} />
              <span>更新于 {lastUpdated.toLocaleTimeString('zh-CN')}</span>
            </div>
          )}
          <button
            onClick={fetchAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={13} />
            刷新
          </button>
        </div>
      </div>

      {/* System Health Card */}
      {healthLoading ? (
        <HealthCardSkeleton />
      ) : healthError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {healthError}
        </div>
      ) : health ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
              <Server size={18} className="text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">{health.service}</h3>
              <p className="text-xs text-gray-500">v{health.version} · {health.layer}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5">
              <span className={`w-2 h-2 rounded-full ${health.database === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-600">数据库</span>
              <span className={`text-xs font-medium ml-auto ${health.database === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                {health.database === 'connected' ? '正常' : '异常'}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5">
              <span className={`w-2 h-2 rounded-full ${health.redis === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-600">Redis</span>
              <span className={`text-xs font-medium ml-auto ${health.redis === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                {health.redis === 'connected' ? '正常' : '异常'}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5">
              <Shield size={14} className="text-gray-400" />
              <span className="text-xs text-gray-600">状态</span>
              <span className="text-xs font-medium ml-auto text-green-600">{health.status}</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5">
              <Clock size={14} className="text-gray-400" />
              <span className="text-xs text-gray-600">运行</span>
              <span className="text-xs font-medium ml-auto text-gray-700">{health.uptime}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Stats Grid */}
      {overviewLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : overviewError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {overviewError}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.iconBg}`}>
                  <stat.icon size={20} className={stat.iconColor} />
                </div>
                {stat.growth !== null && renderTrend(stat.growth)}
              </div>
              <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
              {stat.sub && <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>}
            </div>
          ))}
        </div>
      ) : null}

      {/* KPI / Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPI Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-primary-600" />
            KPI 指标
          </h3>
          {kpiLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1.5">
                    <SkeletonBlock className="h-3 w-20" />
                    <SkeletonBlock className="h-3 w-24" />
                  </div>
                  <SkeletonBlock className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : kpiError ? (
            <p className="text-sm text-red-600">{kpiError}</p>
          ) : kpis.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">暂无 KPI 数据</p>
          ) : (
            <div className="space-y-5">
              {kpis.map((kpi, idx) => {
                const pct = kpi.target > 0 ? Math.min((kpi.current / kpi.target) * 100, 100) : 0;
                const barColor =
                  pct >= 90 ? 'bg-red-500' :
                  pct >= 60 ? 'bg-green-500' :
                  'bg-blue-500';
                return (
                  <div key={idx}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm text-gray-700 font-medium">{kpi.name}</span>
                      <span className="text-xs text-gray-500">
                        {typeof kpi.current === 'number' ? kpi.current.toLocaleString() : kpi.current}
                        <span className="text-gray-300"> / </span>
                        {typeof kpi.target === 'number' ? kpi.target.toLocaleString() : kpi.target}
                        {' '}{kpi.unit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alerts Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            系统告警
          </h3>
          {alertLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <SkeletonBlock className="w-2 h-2 rounded-full mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <SkeletonBlock className="h-3 w-full mb-1" />
                    <SkeletonBlock className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : alertError ? (
            <p className="text-sm text-red-600">{alertError}</p>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Shield size={36} className="mb-2" />
              <p className="text-sm">暂无系统告警</p>
              <p className="text-xs mt-0.5">系统运行正常</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {alerts.map((alert) => {
                const sev = severityConfig[alert.severity] || severityConfig.low;
                return (
                  <div key={alert.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sev.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${sev.bg} ${sev.text}`}>
                          {severityLabels[alert.severity] || alert.severity}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto shrink-0">{formatTime(alert.time)}</span>
                      </div>
                      <p className="text-sm text-gray-700 truncate">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{alert.type}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
