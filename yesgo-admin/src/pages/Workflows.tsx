// ============================================================
// YesGo Admin — Workflows & Knowledge Documents Page
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { KnowledgeDoc } from '@/types';
import {
  Workflow, FileText, FolderOpen, Upload, Search, Trash2,
  GitBranch, Clock, ChevronDown, ChevronUp, AlertCircle, Loader2,
  CheckCircle2, X, FileSpreadsheet, FileType, FileCode,
} from 'lucide-react';

// ---- Static Workflow Templates ----
const WORKFLOW_TEMPLATES = [
  {
    id: 1,
    name: '采购闭环流程',
    description: '缺货检测→供应商比价→下单→物流跟踪',
    agent_code: 'purchase',
    steps: [
      { order: 1, name: '缺货检测', type: 'trigger', config: { threshold: 10, check_interval: '5m' } },
      { order: 2, name: '供应商比价', type: 'enrichment', config: { max_suppliers: 5, auto_select: true } },
      { order: 3, name: '自动下单', type: 'action', config: { require_approval: false, timeout: '30s' } },
      { order: 4, name: '物流跟踪', type: 'monitor', config: { track_interval: '1h', notify_on: ['shipped', 'delivered'] } },
    ],
    enabled: true,
  },
  {
    id: 2,
    name: '客户跟进流程',
    description: '客户分级→回访提醒→商机识别→成交跟进',
    agent_code: 'crm',
    steps: [
      { order: 1, name: '客户分级', type: 'classification', config: { dimensions: ['value', 'activity', 'potential'] } },
      { order: 2, name: '回访提醒', type: 'notification', config: { channels: ['sms', 'email'], lead_time: '1d' } },
      { order: 3, name: '商机识别', type: 'analysis', config: { signals: ['inquiry', 'reorder', 'complaint'] } },
      { order: 4, name: '成交跟进', type: 'action', config: { auto_assign: true, sla: '2h' } },
    ],
    enabled: true,
  },
  {
    id: 3,
    name: '经营日报流程',
    description: '数据采集→指标计算→异常检测→日报生成',
    agent_code: 'ops',
    steps: [
      { order: 1, name: '数据采集', type: 'collection', config: { sources: ['erp', 'b2b', 'pos'], window: '24h' } },
      { order: 2, name: '指标计算', type: 'computation', config: { metrics: ['revenue', 'orders', 'conversion'] } },
      { order: 3, name: '异常检测', type: 'detection', config: { method: 'zscore', threshold: 2.0 } },
      { order: 4, name: '日报生成', type: 'output', config: { format: 'pdf', recipients: ['ops_team'] } },
    ],
    enabled: true,
  },
  {
    id: 4,
    name: '窜货预警流程',
    description: '流向采集→区域匹配→异常识别→预警推送',
    agent_code: 'flow',
    steps: [
      { order: 1, name: '流向采集', type: 'collection', config: { sources: ['logistics', 'sales'] } },
      { order: 2, name: '区域匹配', type: 'matching', config: { geo_db: 'region_v2', fuzzy: true } },
      { order: 3, name: '异常识别', type: 'detection', config: { rules: ['cross_region', 'price_deviation'] } },
      { order: 4, name: '预警推送', type: 'notification', config: { channels: ['dingtalk', 'sms'], severity: 'high' } },
    ],
    enabled: false,
  },
] as const;

// ---- Agent name lookup ----
const AGENT_NAMES: Record<string, string> = {
  control: '中控 A',
  ops: '运营智能体',
  crm: '跟客智能体',
  purchase: '采购智能体',
  flow: '流向智能体',
  academic: '学术智能体',
};

// ---- File type icon mapping ----
function getFileIcon(type: string) {
  const t = type.toUpperCase();
  if (t === 'PDF') return FileText;
  if (t === 'XLS' || t === 'XLSX') return FileSpreadsheet;
  if (t === 'MD') return FileCode;
  if (t === 'DOC' || t === 'DOCX') return FileType;
  return FileText;
}

function getFileTypeColor(type: string): string {
  const t = type.toUpperCase();
  if (t === 'PDF') return 'text-red-500';
  if (t === 'XLS' || t === 'XLSX') return 'text-emerald-500';
  if (t === 'MD') return 'text-blue-500';
  if (t === 'DOC' || t === 'DOCX') return 'text-blue-600';
  return 'text-gray-400';
}

// ---- Step type colors ----
const STEP_TYPE_COLORS: Record<string, string> = {
  trigger: 'bg-orange-100 text-orange-700',
  collection: 'bg-blue-100 text-blue-700',
  enrichment: 'bg-purple-100 text-purple-700',
  analysis: 'bg-cyan-100 text-cyan-700',
  detection: 'bg-rose-100 text-rose-700',
  action: 'bg-emerald-100 text-emerald-700',
  notification: 'bg-amber-100 text-amber-700',
  monitor: 'bg-indigo-100 text-indigo-700',
  classification: 'bg-teal-100 text-teal-700',
  matching: 'bg-violet-100 text-violet-700',
  computation: 'bg-sky-100 text-sky-700',
  output: 'bg-pink-100 text-pink-700',
};

// ============================================================
// Workflow Template Card
// ============================================================
interface TemplateCardProps {
  template: typeof WORKFLOW_TEMPLATES[number];
}

function WorkflowTemplateCard({ template }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(template.enabled);

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 transition-all ${expanded ? 'border-primary-200' : 'border-gray-200'}`}>
      {/* Card Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-start gap-3 text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
          <Workflow className="text-primary-600" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900">{template.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {AGENT_NAMES[template.agent_code] || template.agent_code}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <GitBranch size={12} className="text-gray-400" />
              {template.steps.length} 步骤
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Toggle */}
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${enabled ? 'translate-x-4' : ''}`} />
          </button>
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {/* Expanded: Timeline */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 animate-fade-in">
          <h4 className="text-xs font-medium text-gray-500 mb-3">流程步骤</h4>
          <div className="space-y-0">
            {template.steps.map((step, idx) => (
              <div key={step.order} className="flex gap-3">
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-primary-50 border-2 border-primary-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-primary-600">{step.order}</span>
                  </div>
                  {idx < template.steps.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gray-200 my-1 min-h-[24px]" />
                  )}
                </div>
                {/* Step content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{step.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STEP_TYPE_COLORS[step.type] || 'bg-gray-100 text-gray-600'}`}>
                      {step.type}
                    </span>
                  </div>
                  {/* Config preview */}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(step.config).map(([k, v]) => (
                      <span key={k} className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                        {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Knowledge Documents Table
// ============================================================
function KnowledgeDocsTab() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getKnowledgeDocs();
      setDocs(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取知识文档失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // Filtered docs
  const filtered = docs.filter(d => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.folder.toLowerCase().includes(q) ||
      d.bound_agents?.some((a: string) => a.toLowerCase().includes(q))
    );
  });

  // Mock upload
  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadSuccess(false);
    try {
      // Simulate upload
      await new Promise(resolve => setTimeout(resolve, 1000));
      const type = file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN';
      const sizeKBNum = file.size / 1024;
      const newDoc: KnowledgeDoc = {
        id: Date.now(),
        name: file.name,
        type,
        size: sizeKBNum > 1024 ? `${(sizeKBNum / 1024).toFixed(1)} MB` : `${sizeKBNum.toFixed(1)} KB`,
        folder: '/root',
        bound_agents: [],
        created_at: new Date().toISOString(),
      };
      setDocs(prev => [newDoc, ...prev]);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
    } catch {
      setError('上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete doc
  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await api.deleteKnowledgeDoc('', deleteId);
      setDocs(prev => prev.filter(d => d.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文档名称、文件夹、智能体..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          {uploadSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 animate-fade-in">
              <CheckCircle2 size={14} />
              上传成功
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.md"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            上传文档
          </button>
        </div>
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

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FolderOpen size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">暂无知识文档</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 bg-gray-50">
                  <th className="text-left py-2.5 px-3 font-medium">文档名称</th>
                  <th className="text-left py-2.5 px-3 font-medium">类型</th>
                  <th className="text-left py-2.5 px-3 font-medium">大小</th>
                  <th className="text-left py-2.5 px-3 font-medium">文件夹</th>
                  <th className="text-left py-2.5 px-3 font-medium">绑定智能体</th>
                  <th className="text-left py-2.5 px-3 font-medium">上传时间</th>
                  <th className="text-right py-2.5 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => {
                  const FileIcon = getFileIcon(doc.type);
                  const iconColor = getFileTypeColor(doc.type);
                  return (
                    <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <FileIcon size={16} className={iconColor} />
                          <span className="text-gray-900 font-medium text-sm">{doc.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{doc.type}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">{doc.size}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <FolderOpen size={12} className="text-gray-400" />
                          {doc.folder}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {doc.bound_agents && doc.bound_agents.length > 0 ? (
                            doc.bound_agents.map(agent => (
                              <span key={agent} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-700">
                                {AGENT_NAMES[agent] || agent}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-300">未绑定</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} className="text-gray-400" />
                          {new Date(doc.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setDeleteId(doc.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">确认删除</h3>
                <p className="text-xs text-gray-500">此操作不可撤销</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">确定要删除此文档吗？删除后无法恢复。</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function Workflows() {
  const [activeTab, setActiveTab] = useState<'templates' | 'docs'>('templates');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Workflow className="text-primary-600" size={22} />
          工作流与知识库
        </h1>
        <p className="text-sm text-gray-500 mt-1">管理工作流模板与知识文档</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'templates'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Workflow size={16} />
          工作流模板
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'docs'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText size={16} />
          知识文档
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'templates' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WORKFLOW_TEMPLATES.map(template => (
            <WorkflowTemplateCard key={template.id} template={template} />
          ))}
        </div>
      ) : (
        <KnowledgeDocsTab />
      )}
    </div>
  );
}
