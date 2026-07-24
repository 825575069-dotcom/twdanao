// ============================================================
// YesGo Admin — Agent Management Page
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { AgentConfigItem, AIModel, DifyConfig, DifyWorkflow } from '@/types';
import {
  Bot, Settings, Sliders, Save, Link, TestTube, Cpu, Zap,
  ChevronDown, ChevronUp, X, AlertCircle, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';

// ---- Static Agent Definitions ----
const AGENT_DEFS = [
  { code: 'control', name: '中控 A', category: '统筹', description: '统一调度与任务分发', color: 'indigo' },
  { code: 'ops', name: '运营智能体', category: '业务', description: '经营分析与促销管理', color: 'emerald' },
  { code: 'crm', name: '跟客智能体', category: '业务', description: '客户关系与回访跟进', color: 'blue' },
  { code: 'purchase', name: '采购智能体', category: '业务', description: '智能采购与库存补货', color: 'amber' },
  { code: 'flow', name: '流向智能体', category: '业务', description: '流向监控与窜货预警', color: 'rose' },
  { code: 'academic', name: '学术智能体', category: '业务', description: '学术内容与合规审查', color: 'cyan' },
] as const;

// ---- Color mapping ----
const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-700' },
};

// ---- Helper: mask API key ----
function maskApiKey(key: string): string {
  if (!key) return '—';
  if (key.length <= 8) return key.slice(0, 2) + '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

// ============================================================
// Agent Card Component
// ============================================================
interface AgentCardProps {
  def: typeof AGENT_DEFS[number];
  config: AgentConfigItem | undefined;
  models: AIModel[];
  onSave: (config: AgentConfigItem) => Promise<void>;
  saving: boolean;
}

function AgentCard({ def, config, models, onSave, saving }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = COLOR_MAP[def.color] || COLOR_MAP.indigo;

  const [modelId, setModelId] = useState(config?.model_id || '');
  const [temperature, setTemperature] = useState(config?.temperature ?? 0.7);
  const [maxRetry, setMaxRetry] = useState(config?.max_retry ?? 3);
  const [fallbackModelId, setFallbackModelId] = useState(config?.fallback_model_id || '');
  const [takeoverThreshold, setTakeoverThreshold] = useState(config?.human_takeover_threshold ?? 0.8);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync when config changes externally
  useEffect(() => {
    if (config) {
      setModelId(config.model_id || '');
      setTemperature(config.temperature ?? 0.7);
      setMaxRetry(config.max_retry ?? 3);
      setFallbackModelId(config.fallback_model_id || '');
      setTakeoverThreshold(config.human_takeover_threshold ?? 0.8);
    }
  }, [config]);

  const boundModel = models.find(m => String(m.id) === modelId);
  const isActive = !!config;

  const handleSave = async () => {
    const newConfig: AgentConfigItem = {
      id: config?.id || 0,
      agent_id: def.code,
      model_id: modelId,
      temperature,
      max_retry: maxRetry,
      fallback_model_id: fallbackModelId,
      human_takeover_threshold: takeoverThreshold,
      custom: config?.custom || {},
    };
    await onSave(newConfig);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 transition-all ${expanded ? colors.border : 'border-gray-200'}`}>
      {/* Card Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-start gap-3 text-left"
      >
        <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
          <Bot className={colors.text} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900">{def.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>{def.category}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{def.description}</p>
          <div className="flex items-center gap-3 mt-2">
            {boundModel ? (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                <Cpu size={12} className="text-gray-400" />
                {boundModel.name}
              </span>
            ) : (
              <span className="text-xs text-gray-400">未绑定模型</span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Sliders size={12} className="text-gray-400" />
              温度: {temperature.toFixed(1)}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              {isActive ? '已配置' : '未配置'}
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />}
      </button>

      {/* Expanded Config Panel */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4 animate-fade-in">
          {/* Model Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">绑定模型</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">请选择模型</option>
              {models.map(m => (
                <option key={m.id} value={String(m.id)}>{m.name} ({m.vendor})</option>
              ))}
            </select>
          </div>

          {/* Temperature */}
          <div>
            <label className="flex items-center justify-between text-xs font-medium text-gray-700 mb-1">
              <span>Temperature</span>
              <span className="text-primary-600 font-mono">{temperature.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0</span><span>1</span><span>2</span>
            </div>
          </div>

          {/* Max Retry */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">最大重试次数</label>
            <input
              type="number"
              min={0}
              max={10}
              value={maxRetry}
              onChange={(e) => setMaxRetry(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* Fallback Model */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">兜底模型</label>
            <select
              value={fallbackModelId}
              onChange={(e) => setFallbackModelId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">无兜底</option>
              {models.filter(m => String(m.id) !== modelId).map(m => (
                <option key={m.id} value={String(m.id)}>{m.name} ({m.vendor})</option>
              ))}
            </select>
          </div>

          {/* Human Takeover Threshold */}
          <div>
            <label className="flex items-center justify-between text-xs font-medium text-gray-700 mb-1">
              <span>人工接管阈值</span>
              <span className="text-primary-600 font-mono">{takeoverThreshold.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={takeoverThreshold}
              onChange={(e) => setTakeoverThreshold(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0</span><span>0.5</span><span>1</span>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              保存配置
            </button>
            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 animate-fade-in">
                <CheckCircle2 size={14} />
                保存成功
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Dify Config Modal
// ============================================================
interface DifyModalProps {
  workflows: DifyWorkflow[];
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}

function DifyConfigModal({ workflows, onClose, onSave, saving }: DifyModalProps) {
  const [formData, setFormData] = useState<Record<number, { api_key: string; base_url: string }>>({});

  useEffect(() => {
    const init: Record<number, { api_key: string; base_url: string }> = {};
    workflows.forEach(w => {
      init[w.id] = { api_key: w.api_key, base_url: w.base_url };
    });
    setFormData(init);
  }, [workflows]);

  const handleFieldChange = (id: number, field: 'api_key' | 'base_url', value: string) => {
    setFormData(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      workflows: Object.entries(formData).map(([id, val]) => ({
        id: parseInt(id),
        ...val,
      })),
    };
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">编辑 Dify 工作流配置</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md text-gray-400">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {workflows.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">暂无工作流配置</div>
          ) : (
            workflows.map(wf => (
              <div key={wf.id} className="border border-gray-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Code:</span>
                  <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{wf.code}</code>
                  <span className="text-xs text-gray-400">→</span>
                  <span className="text-xs text-gray-600">{wf.agent_code}</span>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">API Key</label>
                  <input
                    type="text"
                    value={formData[wf.id]?.api_key || ''}
                    onChange={(e) => handleFieldChange(wf.id, 'api_key', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="请输入 API Key"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={formData[wf.id]?.base_url || ''}
                    onChange={(e) => handleFieldChange(wf.id, 'base_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="https://api.dify.ai/v1"
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function Agents() {
  const [configs, setConfigs] = useState<AgentConfigItem[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [difyConfig, setDifyConfig] = useState<DifyConfig | null>(null);

  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingDify, setLoadingDify] = useState(true);
  const [errorConfigs, setErrorConfigs] = useState('');
  const [errorDify, setErrorDify] = useState('');

  const [savingAgent, setSavingAgent] = useState(false);
  const [savingDify, setSavingDify] = useState(false);
  const [showDifyModal, setShowDifyModal] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Fetch all data
  const fetchConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    setErrorConfigs('');
    try {
      const res = await api.getAgentConfigs();
      setConfigs(res.data || []);
    } catch (err) {
      setErrorConfigs(err instanceof Error ? err.message : '获取智能体配置失败');
    } finally {
      setLoadingConfigs(false);
    }
  }, []);

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const res = await api.getModels();
      setModels(res.data || []);
    } catch {
      // Non-critical: models are optional for display
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const fetchDify = useCallback(async () => {
    setLoadingDify(true);
    setErrorDify('');
    try {
      const res = await api.getDifyConfig();
      setDifyConfig(res.data);
    } catch (err) {
      setErrorDify(err instanceof Error ? err.message : '获取 Dify 配置失败');
    } finally {
      setLoadingDify(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchModels();
    fetchDify();
  }, [fetchConfigs, fetchModels, fetchDify]);

  // Save agent config
  const handleSaveAgent = async (config: AgentConfigItem) => {
    setSavingAgent(true);
    try {
      // Merge with existing configs
      const existing = configs.filter(c => c.agent_id !== config.agent_id);
      const updated = [...existing, config];
      await api.updateAgentConfigs(updated);
      setConfigs(updated);
    } catch (err) {
      throw err;
    } finally {
      setSavingAgent(false);
    }
  };

  // Save Dify config
  const handleSaveDify = async (data: Record<string, unknown>) => {
    setSavingDify(true);
    try {
      await api.updateDifyConfig(data);
      await fetchDify();
      setShowDifyModal(false);
    } catch (err) {
      setErrorDify(err instanceof Error ? err.message : '保存 Dify 配置失败');
    } finally {
      setSavingDify(false);
    }
  };

  // Test Dify connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      await api.getDifyConfig();
      setTestResult({ success: true, msg: '连接测试成功' });
    } catch (err) {
      setTestResult({ success: false, msg: err instanceof Error ? err.message : '连接测试失败' });
    } finally {
      setTestingConnection(false);
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  // Find config for a given agent code
  const getConfigFor = (code: string) => configs.find(c => c.agent_id === code);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bot className="text-primary-600" size={22} />
          智能体管理
        </h1>
        <p className="text-sm text-gray-500 mt-1">配置与管理 AI 智能体</p>
      </div>

      {/* Agent Cards Grid */}
      {errorConfigs ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700 font-medium">加载失败</p>
            <p className="text-xs text-red-600 mt-0.5">{errorConfigs}</p>
            <button onClick={fetchConfigs} className="mt-2 text-xs text-red-700 underline hover:text-red-800">重试</button>
          </div>
        </div>
      ) : (
        <>
          {loadingConfigs && loadingModels ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AGENT_DEFS.map(def => (
                <AgentCard
                  key={def.code}
                  def={def}
                  config={getConfigFor(def.code)}
                  models={models}
                  onSave={handleSaveAgent}
                  saving={savingAgent}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Dify Workflow Config Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link className="text-primary-600" size={18} />
              <h2 className="font-semibold text-gray-900">Dify 工作流配置</h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Connection Status */}
              {loadingDify ? (
                <span className="text-xs text-gray-400">加载中...</span>
              ) : difyConfig?.configured ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  已配置
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  未配置
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
          {errorDify && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 mb-3">
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-sm text-red-700">{errorDify}</span>
            </div>
          )}

          {loadingDify ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !difyConfig || !difyConfig.workflows || difyConfig.workflows.length === 0 ? (
            <div className="text-center py-8">
              <Link size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">暂无 Dify 工作流配置</p>
              <button
                onClick={() => setShowDifyModal(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs rounded-lg transition-colors"
              >
                <Settings size={14} />
                添加配置
              </button>
            </div>
          ) : (
            <>
              {/* Workflow List Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500">
                      <th className="text-left py-2 px-3 font-medium">Code</th>
                      <th className="text-left py-2 px-3 font-medium">绑定智能体</th>
                      <th className="text-left py-2 px-3 font-medium">API Key</th>
                      <th className="text-left py-2 px-3 font-medium">Base URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {difyConfig.workflows.map((wf) => (
                      <tr key={wf.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{wf.code}</code>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">{wf.agent_code}</td>
                        <td className="py-2.5 px-3 text-gray-600 font-mono text-xs">{maskApiKey(wf.api_key)}</td>
                        <td className="py-2.5 px-3 text-gray-600 text-xs">{wf.base_url || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => setShowDifyModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Settings size={14} />
                  编辑配置
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {testingConnection ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
                  测试连接
                </button>
                {testResult && (
                  <span className={`flex items-center gap-1 text-xs animate-fade-in ${testResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                    {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {testResult.msg}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dify Modal */}
      {showDifyModal && difyConfig && (
        <DifyConfigModal
          workflows={difyConfig.workflows}
          onClose={() => setShowDifyModal(false)}
          onSave={handleSaveDify}
          saving={savingDify}
        />
      )}
    </div>
  );
}
