// ============================================================
// YesGo Admin — Model Gateway Management
// ============================================================
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { api } from '@/lib/api';
import type { AIModel, ModelKey, TokenUsageStats, RoutingStrategy, CircuitBreakerState } from '@/types';
import {
  Cpu,
  Key,
  AlertCircle,
  Zap,
  BarChart3,
  Activity,
  Route,
  Plus,
  Trash2,
  RefreshCw,
  TestTube,
  Rocket,
  X,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Edit,
  Wifi,
  WifiOff,
  Circle,
} from 'lucide-react';

// ---- Constants ----
const VENDOR_BADGE: Record<string, string> = {
  openai: 'bg-emerald-100 text-emerald-700',
  anthropic: 'bg-orange-100 text-orange-700',
  google: 'bg-blue-100 text-blue-700',
  meta: 'bg-purple-100 text-purple-700',
  mistral: 'bg-indigo-100 text-indigo-700',
  deepseek: 'bg-teal-100 text-teal-700',
  qwen: 'bg-cyan-100 text-cyan-700',
  baichuan: 'bg-rose-100 text-rose-700',
  zhipu: 'bg-violet-100 text-violet-700',
  moonshot: 'bg-amber-100 text-amber-700',
};

const MODEL_TYPE_LABEL: Record<string, string> = {
  commercial: '商业',
  open: '开源',
};

const MODEL_TYPE_BADGE: Record<string, string> = {
  commercial: 'bg-blue-100 text-blue-700',
  open: 'bg-green-100 text-green-700',
};

const MODEL_STATUS_ICON: Record<string, { color: string; label: string }> = {
  ready: { color: 'text-green-500', label: '就绪' },
  deploying: { color: 'text-blue-500', label: '部署中' },
  offline: { color: 'text-gray-400', label: '离线' },
};

const KEY_STATUS: Record<string, { badge: string; label: string }> = {
  active: { badge: 'bg-green-100 text-green-700', label: '正常' },
  disabled: { badge: 'bg-gray-100 text-gray-600', label: '已禁用' },
  exhausted: { badge: 'bg-red-100 text-red-700', label: '额度用尽' },
  error: { badge: 'bg-amber-100 text-amber-700', label: '异常' },
};

const CB_STATE: Record<string, { badge: string; label: string; icon: React.ReactNode }> = {
  closed: { badge: 'bg-green-100 text-green-700', label: '关闭', icon: <Check size={12} /> },
  open: { badge: 'bg-red-100 text-red-700', label: '开启', icon: <AlertCircle size={12} /> },
  half_open: { badge: 'bg-yellow-100 text-yellow-700', label: '半开', icon: <AlertCircle size={12} /> },
};

// ---- Skeleton Components ----
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function ModelCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-28 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full mb-3" />
      <div className="flex flex-wrap gap-2 mb-4">
        <Skeleton className="h-5 w-14 rounded" />
        <Skeleton className="h-5 w-12 rounded" />
        <Skeleton className="h-5 w-16 rounded" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1 rounded-lg" />
        <Skeleton className="h-8 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// ---- Bar Chart Component ----
function BarChart<T extends { label: string; value: number; maxValue: number }>({
  data,
  valueFormatter,
  className = '',
}: {
  data: T[];
  valueFormatter?: (v: number) => string;
  className?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">暂无数据</p>;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 truncate max-w-[60%]">{item.label}</span>
            <span className="text-xs font-medium text-gray-900">
              {valueFormatter ? valueFormatter(item.value) : item.value.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((item.value / item.maxValue) * 100, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Simple Trend Chart ----
function TrendChart({ data }: { data: { date: string; value: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-gray-400 py-8 text-center">暂无数据</p>;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barWidth = `${Math.max(6, Math.floor(100 / data.length) - 2)}px`;

  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => {
        const height = `${(d.value / maxVal) * 100}%`;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
            <div
              className="w-full bg-primary-400 hover:bg-primary-500 rounded-t-sm transition-colors cursor-pointer"
              style={{ height, minWidth: barWidth }}
              title={`${d.date}: ${d.value.toLocaleString()}`}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---- Main Component ----
export default function ModelsPage() {
  // Models grid state
  const [models, setModels] = useState<AIModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState('');

  // Selected model detail
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [detailTab, setDetailTab] = useState<'keys' | 'test' | 'deploy'>('keys');

  // API Keys state
  const [keys, setKeys] = useState<ModelKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState('');

  // Key form
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [editingKey, setEditingKey] = useState<ModelKey | null>(null);
  const [keyForm, setKeyForm] = useState({
    key_alias: '',
    api_key: '',
    endpoint: '',
    priority: 1,
    daily_quota: 100000,
  });
  const [keyFormError, setKeyFormError] = useState('');
  const [keyFormSubmitting, setKeyFormSubmitting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Key delete
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<ModelKey | null>(null);
  const [deletingKey, setDeletingKey] = useState(false);

  // Test state
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState('');
  const [testing, setTesting] = useState(false);

  // Deploy state
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState('');

  // Token usage
  const [tokenStats, setTokenStats] = useState<TokenUsageStats | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState('');

  // Routing
  const [routingStrategies, setRoutingStrategies] = useState<RoutingStrategy[]>([]);
  const [routingLoading, setRoutingLoading] = useState(true);
  const [routingError, setRoutingError] = useState('');
  const [togglingRouteIds, setTogglingRouteIds] = useState<Set<number>>(new Set());

  // Circuit breakers
  const [breakers, setBreakers] = useState<CircuitBreakerState[]>([]);
  const [breakersLoading, setBreakersLoading] = useState(true);
  const [breakersError, setBreakersError] = useState('');
  const [resettingBreakers, setResettingBreakers] = useState<Set<number>>(new Set());

  // Refreshing
  const [refreshing, setRefreshing] = useState(false);

  // ---- Fetch functions ----
  const fetchModels = useCallback(async () => {
    try {
      setModelsError('');
      const res = await api.getModels();
      setModels(res.data || []);
    } catch (e: unknown) {
      setModelsError(e instanceof Error ? e.message : '加载模型失败');
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const fetchKeys = useCallback(async (modelId: number) => {
    setKeysLoading(true);
    setKeysError('');
    try {
      const res = await api.getModelKeys(modelId);
      setKeys(res.data || []);
    } catch (e: unknown) {
      setKeysError(e instanceof Error ? e.message : '加载密钥失败');
    } finally {
      setKeysLoading(false);
    }
  }, []);

  const fetchTokenStats = useCallback(async () => {
    try {
      setTokenError('');
      const res = await api.getTokenUsage();
      setTokenStats(res.data);
    } catch (e: unknown) {
      setTokenError(e instanceof Error ? e.message : '加载用量统计失败');
    } finally {
      setTokenLoading(false);
    }
  }, []);

  const fetchRouting = useCallback(async () => {
    try {
      setRoutingError('');
      const res = await api.getRoutingStrategies();
      setRoutingStrategies(res.data || []);
    } catch (e: unknown) {
      setRoutingError(e instanceof Error ? e.message : '加载路由策略失败');
    } finally {
      setRoutingLoading(false);
    }
  }, []);

  const fetchBreakers = useCallback(async () => {
    try {
      setBreakersError('');
      const res = await api.getCircuitBreakers();
      setBreakers(res.data || []);
    } catch (e: unknown) {
      setBreakersError(e instanceof Error ? e.message : '加载熔断器状态失败');
    } finally {
      setBreakersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
    fetchTokenStats();
    fetchRouting();
    fetchBreakers();
  }, [fetchModels, fetchTokenStats, fetchRouting, fetchBreakers]);

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchModels(), fetchTokenStats(), fetchRouting(), fetchBreakers()]).finally(() =>
      setRefreshing(false)
    );
  };

  // ---- Model selection ----
  const handleSelectModel = (model: AIModel) => {
    if (selectedModel?.id === model.id) {
      setSelectedModel(null);
      setKeys([]);
    } else {
      setSelectedModel(model);
      setDetailTab('keys');
      fetchKeys(model.id);
    }
  };

  // ---- Key form ----
  const openAddKeyForm = () => {
    setEditingKey(null);
    setKeyForm({ key_alias: '', api_key: '', endpoint: '', priority: 1, daily_quota: 100000 });
    setKeyFormError('');
    setShowApiKey(false);
    setShowKeyForm(true);
  };

  const openEditKeyForm = (key: ModelKey) => {
    setEditingKey(key);
    setKeyForm({
      key_alias: key.key_alias,
      api_key: key.api_key,
      endpoint: key.endpoint,
      priority: key.priority,
      daily_quota: key.daily_quota,
    });
    setKeyFormError('');
    setShowApiKey(false);
    setShowKeyForm(true);
  };

  const handleKeyFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setKeyFormError('');

    if (!keyForm.key_alias.trim() || !keyForm.api_key.trim()) {
      setKeyFormError('请填写密钥别名和 API Key');
      return;
    }
    if (!selectedModel) return;

    setKeyFormSubmitting(true);
    try {
      if (editingKey) {
        await api.updateModelKey(editingKey.id, keyForm as Record<string, unknown>);
      } else {
        await api.addModelKey({ ...keyForm, model_id: selectedModel.id });
      }
      setShowKeyForm(false);
      fetchKeys(selectedModel.id);
    } catch (e: unknown) {
      setKeyFormError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setKeyFormSubmitting(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteKeyTarget) return;
    setDeletingKey(true);
    try {
      await api.deleteModelKey(deleteKeyTarget.id);
      setDeleteKeyTarget(null);
      if (selectedModel) fetchKeys(selectedModel.id);
    } catch {
      // handled silently
    } finally {
      setDeletingKey(false);
    }
  };

  // ---- Test ----
  const handleTest = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedModel || !testPrompt.trim()) return;

    setTesting(true);
    setTestError('');
    setTestResult(null);
    try {
      const res = await api.testModel({ model_id: selectedModel.id, prompt: testPrompt });
      setTestResult(JSON.stringify(res.data, null, 2));
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : '测试失败');
    } finally {
      setTesting(false);
    }
  };

  // ---- Deploy ----
  const handleDeploy = async () => {
    if (!selectedModel) return;
    setDeploying(true);
    setDeployMsg('');
    try {
      await api.deployModel(selectedModel.id);
      setDeployMsg('部署成功');
      fetchModels();
    } catch (e: unknown) {
      setDeployMsg(e instanceof Error ? e.message : '部署失败');
    } finally {
      setDeploying(false);
    }
  };

  // ---- Route toggle ----
  const handleRouteToggle = async (route: RoutingStrategy) => {
    setTogglingRouteIds((prev) => new Set(prev).add(route.id));
    try {
      await api.updateRoutingStrategy(route.id, { enabled: !route.enabled });
      setRoutingStrategies((prev) =>
        prev.map((r) => (r.id === route.id ? { ...r, enabled: !r.enabled } : r))
      );
    } catch {
      // revert silently
    } finally {
      setTogglingRouteIds((prev) => {
        const next = new Set(prev);
        next.delete(route.id);
        return next;
      });
    }
  };

  // ---- Breaker reset ----
  const handleResetBreaker = async (breaker: CircuitBreakerState) => {
    setResettingBreakers((prev) => new Set(prev).add(breaker.id));
    try {
      await api.resetCircuitBreaker(breaker.id);
      fetchBreakers();
    } catch {
      // handled silently
    } finally {
      setResettingBreakers((prev) => {
        const next = new Set(prev);
        next.delete(breaker.id);
        return next;
      });
    }
  };

  // ---- Helpers ----
  const maskKey = (key: string) => {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // ---- Render ----
  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">模型网关</h1>
          <p className="text-sm text-gray-500 mt-1">大模型接入与管理</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Models Grid */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">已接入模型</h2>
          <p className="text-sm text-gray-500 mt-0.5">当前可用的 AI 模型列表</p>
        </div>

        {modelsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ModelCardSkeleton key={i} />
            ))}
          </div>
        ) : modelsError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-red-700 text-sm mb-3">{modelsError}</p>
            <button
              onClick={() => { setModelsLoading(true); fetchModels(); }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              重试
            </button>
          </div>
        ) : models.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Cpu size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">暂无已接入的模型</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {models.map((model) => {
              const st = MODEL_STATUS_ICON[model.status] || MODEL_STATUS_ICON.offline;
              const vBadge = VENDOR_BADGE[model.vendor?.toLowerCase()] || 'bg-gray-100 text-gray-600';
              const isSelected = selectedModel?.id === model.id;

              return (
                <div
                  key={model.id}
                  className={`bg-white rounded-xl border p-5 transition-all cursor-pointer animate-slide-up ${
                    isSelected ? 'border-primary-400 shadow-md ring-1 ring-primary-200' : 'border-gray-200 hover:shadow-sm'
                  }`}
                  onClick={() => handleSelectModel(model)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Cpu size={20} className="text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 text-sm">{model.name}</h3>
                        <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-0.5 ${vBadge}`}>
                          {model.vendor}
                        </span>
                      </div>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-medium ${st.color}`}>
                      <Circle size={8} fill="currentColor" />
                      {st.label}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                    {model.description || '暂无描述'}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${MODEL_TYPE_BADGE[model.type] || 'bg-gray-100 text-gray-600'}`}>
                      {MODEL_TYPE_LABEL[model.type] || model.type}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {model.context_k >= 1000
                        ? `${Math.round(model.context_k / 1000)}K`
                        : model.context_k}
                    </span>
                  </div>

                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        handleSelectModel(model);
                        if (selectedModel?.id !== model.id) {
                          setDetailTab('keys');
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Key size={14} />
                      管理密钥
                    </button>
                    <button
                      onClick={() => {
                        handleSelectModel(model);
                        setDetailTab('keys');
                        if (selectedModel?.id !== model.id) {
                          setDetailTab('keys');
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <AlertCircle size={14} />
                      熔断器状态
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Model Detail Panel */}
      {selectedModel && (
        <div className="bg-white rounded-xl border border-gray-200 mb-8 animate-slide-up overflow-hidden">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                <Cpu size={20} className="text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{selectedModel.name}</h3>
                <p className="text-xs text-gray-500">
                  {selectedModel.vendor} · {MODEL_TYPE_LABEL[selectedModel.type]} · {selectedModel.context_k >= 1000 ? `${Math.round(selectedModel.context_k / 1000)}K` : selectedModel.context_k} 上下文
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedModel(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(['keys', 'test', 'deploy'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  detailTab === tab
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'keys' && (
                  <span className="flex items-center gap-1.5">
                    <Key size={14} />
                    API 密钥
                  </span>
                )}
                {tab === 'test' && (
                  <span className="flex items-center gap-1.5">
                    <TestTube size={14} />
                    模型测试
                  </span>
                )}
                {tab === 'deploy' && (
                  <span className="flex items-center gap-1.5">
                    <Rocket size={14} />
                    部署与管理
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* === API Keys Tab === */}
            {detailTab === 'keys' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">API 密钥管理</h4>
                  <button
                    onClick={openAddKeyForm}
                    className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors"
                  >
                    <Plus size={14} />
                    添加密钥
                  </button>
                </div>

                {/* Key Form */}
                {showKeyForm && (
                  <form onSubmit={handleKeyFormSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3 animate-slide-up">
                    {keyFormError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                        {keyFormError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">密钥别名</label>
                        <input
                          type="text"
                          value={keyForm.key_alias}
                          onChange={(e) => setKeyForm({ ...keyForm, key_alias: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                          placeholder="例如：生产环境"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={keyForm.api_key}
                            onChange={(e) => setKeyForm({ ...keyForm, api_key: e.target.value })}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow font-mono"
                            placeholder="sk-..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Endpoint</label>
                        <input
                          type="text"
                          value={keyForm.endpoint}
                          onChange={(e) => setKeyForm({ ...keyForm, endpoint: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                          placeholder="https://api.openai.com/v1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">优先级</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={keyForm.priority}
                          onChange={(e) => setKeyForm({ ...keyForm, priority: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">每日配额</label>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={keyForm.daily_quota}
                          onChange={(e) => setKeyForm({ ...keyForm, daily_quota: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowKeyForm(false)}
                        className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={keyFormSubmitting}
                        className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {keyFormSubmitting ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            提交中...
                          </>
                        ) : editingKey ? '更新' : '添加'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Keys List */}
                {keysLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Skeleton className="h-5 w-28" />
                          <Skeleton className="h-5 w-14 rounded" />
                        </div>
                        <Skeleton className="h-3 w-64 mb-2" />
                        <div className="flex gap-3">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : keysError ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p className="text-red-700 text-sm mb-2">{keysError}</p>
                    <button
                      onClick={() => fetchKeys(selectedModel.id)}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      重试
                    </button>
                  </div>
                ) : keys.length === 0 ? (
                  <div className="text-center py-8">
                    <Key size={36} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-3">暂无 API 密钥</p>
                    <button
                      onClick={openAddKeyForm}
                      className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      <Plus size={14} />
                      添加第一个密钥
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {keys.map((key) => {
                      const kst = KEY_STATUS[key.status] || KEY_STATUS.exhausted;
                      return (
                        <div key={key.id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{key.key_alias}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${kst.badge}`}>
                                {kst.label}
                              </span>
                              <span className="text-xs text-gray-400">优先级 {key.priority}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditKeyForm(key)}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="编辑"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteKeyTarget(key)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="删除"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="text-xs text-gray-500 font-mono mb-3">{maskKey(key.api_key)}</div>

                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span>今日用量: <span className="font-medium text-gray-900">{formatNumber(key.daily_used)}</span> / {formatNumber(key.daily_quota)}</span>
                            <span>总用量: <span className="font-medium text-gray-900">{formatNumber(key.total_used)}</span></span>
                          </div>

                          {/* Usage Bar */}
                          {key.daily_quota > 0 && (
                            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  key.daily_used / key.daily_quota > 0.9
                                    ? 'bg-red-500'
                                    : key.daily_used / key.daily_quota > 0.7
                                    ? 'bg-amber-500'
                                    : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min((key.daily_used / key.daily_quota) * 100, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* === Test Tab === */}
            {detailTab === 'test' && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">模型测试</h4>
                <form onSubmit={handleTest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">测试提示词</label>
                    <textarea
                      value={testPrompt}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow resize-none"
                      placeholder="请输入测试用的提示词..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={testing || !testPrompt.trim()}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    {testing ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        测试中...
                      </>
                    ) : (
                      <>
                        <TestTube size={16} />
                        发送测试
                      </>
                    )}
                  </button>
                </form>

                {testError && (
                  <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                    {testError}
                  </div>
                )}

                {testResult && (
                  <div className="mt-4">
                    <h5 className="text-xs font-medium text-gray-700 mb-2">响应结果</h5>
                    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono text-gray-700 overflow-auto max-h-64 whitespace-pre-wrap">
                      {testResult}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* === Deploy Tab === */}
            {detailTab === 'deploy' && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">部署与管理</h4>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        状态: <span className={`font-semibold ${MODEL_STATUS_ICON[selectedModel.status]?.color}`}>
                          {MODEL_STATUS_ICON[selectedModel.status]?.label}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedModel.status === 'ready'
                          ? '模型已部署并处于就绪状态'
                          : selectedModel.status === 'deploying'
                          ? '模型正在部署中...'
                          : '模型处于离线状态'}
                      </p>
                    </div>
                    <button
                      onClick={handleDeploy}
                      disabled={deploying || selectedModel.status === 'deploying'}
                      className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {deploying ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          部署中...
                        </>
                      ) : (
                        <>
                          <Rocket size={16} />
                          {selectedModel.status === 'ready' ? '重新部署' : '部署启动'}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {deployMsg && (
                  <div className={`text-sm rounded-lg px-3 py-2 ${
                    deployMsg.includes('成功') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {deployMsg}
                  </div>
                )}

                {/* Model Config Info */}
                <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                  <h5 className="text-xs font-medium text-gray-700 mb-3">模型配置</h5>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">厂商:</span>
                      <span className="ml-2 text-gray-900 font-medium">{selectedModel.vendor}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">类型:</span>
                      <span className="ml-2 text-gray-900">{MODEL_TYPE_LABEL[selectedModel.type]}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">上下文窗口:</span>
                      <span className="ml-2 text-gray-900">{selectedModel.context_k >= 1000 ? `${Math.round(selectedModel.context_k / 1000)}K` : selectedModel.context_k}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Endpoint:</span>
                      <span className="ml-2 text-gray-900 text-xs font-mono">{selectedModel.endpoint || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Token Usage Stats */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Token 用量统计</h2>
          <p className="text-sm text-gray-500 mt-0.5">模型调用消耗概览</p>
        </div>

        {tokenLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-40 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        ) : tokenError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-red-700 text-sm mb-3">{tokenError}</p>
            <button
              onClick={() => { setTokenLoading(true); fetchTokenStats(); }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              重试
            </button>
          </div>
        ) : tokenStats ? (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={16} className="text-amber-500" />
                  <span className="text-xs text-gray-500">总 Token 数</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(tokenStats.total_tokens)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 size={16} className="text-emerald-500" />
                  <span className="text-xs text-gray-500">总费用</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ¥{tokenStats.total_cost.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* By Model */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="text-xs font-semibold text-gray-700 uppercase mb-4">按模型统计</h4>
                <BarChart
                  data={tokenStats.by_model.map((m) => ({
                    label: m.model_name,
                    value: m.tokens,
                    maxValue: Math.max(...tokenStats.by_model.map((x) => x.tokens), 1),
                  }))}
                  valueFormatter={formatNumber}
                />
              </div>

              {/* By Agent */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="text-xs font-semibold text-gray-700 uppercase mb-4">按 Agent 统计</h4>
                <BarChart
                  data={tokenStats.by_agent.map((a) => ({
                    label: a.agent_code,
                    value: a.tokens,
                    maxValue: Math.max(...tokenStats.by_agent.map((x) => x.tokens), 1),
                  }))}
                  valueFormatter={formatNumber}
                />
              </div>

              {/* 7-day Trend */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="text-xs font-semibold text-gray-700 uppercase mb-4">7日趋势</h4>
                <TrendChart
                  data={tokenStats.trend.map((t) => ({
                    date: t.date,
                    value: t.tokens,
                  }))}
                />
                <div className="mt-3 space-y-0.5">
                  {tokenStats.trend.map((t, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-500">
                      <span>{t.date}</span>
                      <span className="font-mono">{formatNumber(t.tokens)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Routing Strategies */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">路由策略</h2>
            <p className="text-sm text-gray-500 mt-0.5">模型请求路由与负载均衡配置</p>
          </div>
          <button
            onClick={() => {/* TODO: implement add routing strategy */}}
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-1.5 px-3 rounded-lg transition-colors"
          >
            <Plus size={14} />
            添加策略
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {routingLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">策略名称</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Agent</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">主模型</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">备用模型</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">策略类型</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[1, 2, 3].map((i) => (
                    <TableRowSkeleton key={i} cols={6} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : routingError ? (
            <div className="p-6 text-center">
              <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
              <p className="text-red-700 text-sm mb-3">{routingError}</p>
              <button
                onClick={() => { setRoutingLoading(true); fetchRouting(); }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                重试
              </button>
            </div>
          ) : routingStrategies.length === 0 ? (
            <div className="p-12 text-center">
              <Route size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">暂无路由策略</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">策略名称</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Agent</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">主模型</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">备用模型</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">策略类型</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {routingStrategies.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Route size={14} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{route.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                          {route.agent_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{route.primary_model_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <ChevronRight size={12} />
                          {route.fallback_model_name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {route.strategy_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRouteToggle(route)}
                          disabled={togglingRouteIds.has(route.id)}
                          className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors disabled:opacity-50 ${
                            route.enabled ? 'bg-primary-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              route.enabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Circuit Breakers */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">熔断器状态</h2>
          <p className="text-sm text-gray-500 mt-0.5">模型调用故障自动熔断保护</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {breakersLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">模型名称</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">状态</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">失败次数</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">失败阈值</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[1, 2, 3].map((i) => (
                    <TableRowSkeleton key={i} cols={5} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : breakersError ? (
            <div className="p-6 text-center">
              <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
              <p className="text-red-700 text-sm mb-3">{breakersError}</p>
              <button
                onClick={() => { setBreakersLoading(true); fetchBreakers(); }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                重试
              </button>
            </div>
          ) : breakers.length === 0 ? (
            <div className="p-12 text-center">
              <Activity size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">暂无熔断器记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">模型名称</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">状态</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">失败次数 / 阈值</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">最后失败时间</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {breakers.map((breaker) => {
                    const cst = CB_STATE[breaker.state] || CB_STATE.closed;
                    const isOverThreshold = breaker.failure_count >= breaker.failure_threshold;
                    return (
                      <tr key={breaker.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{breaker.model_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cst.badge}`}>
                            {cst.icon}
                            {cst.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isOverThreshold ? 'text-red-600' : 'text-gray-900'}`}>
                              {breaker.failure_count}
                            </span>
                            <span className="text-xs text-gray-400">/</span>
                            <span className="text-sm text-gray-500">{breaker.failure_threshold}</span>
                            {breaker.failure_count > 0 && (
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${isOverThreshold ? 'bg-red-500' : 'bg-amber-400'}`}
                                  style={{ width: `${Math.min((breaker.failure_count / breaker.failure_threshold) * 100, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {breaker.last_failure
                            ? new Date(breaker.last_failure).toLocaleString('zh-CN')
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleResetBreaker(breaker)}
                            disabled={resettingBreakers.has(breaker.id)}
                            className="flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw size={12} className={resettingBreakers.has(breaker.id) ? 'animate-spin' : ''} />
                            重置
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ---- Delete Key Modal ---- */}
      {deleteKeyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteKeyTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm animate-slide-up p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
                <p className="text-sm text-gray-500">
                  确定要删除密钥 &ldquo;{deleteKeyTarget.key_alias}&rdquo; 吗？此操作不可撤销。
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteKeyTarget(null)}
                disabled={deletingKey}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteKey}
                disabled={deletingKey}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {deletingKey ? (
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
