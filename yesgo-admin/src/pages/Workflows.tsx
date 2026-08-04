// ============================================================
// YesGo Admin — Workflows & Knowledge Documents Page
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/authStore';
import type { AgentInfo, KnowledgeDoc, WorkflowTemplate, MediaAsset } from '@/types';
import WorkflowEditor from '@/components/workflow/WorkflowEditor';
import {
  Workflow, FileText, FolderOpen, Upload, Search, Trash2,
  GitBranch, Clock, ChevronDown, ChevronUp, AlertCircle, Loader2,
  CheckCircle2, X, FileSpreadsheet, FileType, FileCode,
  Plus, Pencil, Bot, Link2, Eye, Image as ImageIcon, Video, Mic, FileBox,
  Smartphone, Tv, FolderPlus, ExternalLink, Folder,
} from 'lucide-react';
import { getRabbitImageUrl } from './Agents';

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

function normalizeFileType(ext: string): string {
  const t = ext.toUpperCase();
  if (t === 'DOCX') return 'DOC';
  if (t === 'XLSX') return 'XLS';
  if (t === 'PPTX') return 'PPT';
  return t;
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
  template: WorkflowTemplate;
  onEdit: (t: WorkflowTemplate) => void;
  onDelete: (t: WorkflowTemplate) => void;
  onToggle: (t: WorkflowTemplate, enabled: boolean) => void;
}

function WorkflowTemplateCard({ template, onEdit, onDelete, onToggle }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false);

  const steps = template.steps || [];
  const stepCount = steps.length;

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
            {template.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {template.category}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <GitBranch size={12} className="text-gray-400" />
              {stepCount} 步骤
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Edit */}
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
            title="编辑"
          >
            <Pencil size={14} />
          </button>
          {/* Delete */}
          <button
            onClick={() => onDelete(template)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
          {/* Toggle */}
          <button
            onClick={() => onToggle(template, !template.enabled)}
            className={`relative w-9 h-5 rounded-full transition-colors ${template.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${template.enabled ? 'translate-x-4' : ''}`} />
          </button>
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {/* Expanded: Timeline */}
      {expanded && stepCount > 0 && (
        <div className="border-t border-gray-100 p-4 animate-fade-in">
          <h4 className="text-xs font-medium text-gray-500 mb-3">流程步骤</h4>
          <div className="space-y-0">
            {steps.map((step, idx) => (
              <div key={step.id || idx} className="flex gap-3">
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-primary-50 border-2 border-primary-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-primary-600">{step.order || idx + 1}</span>
                  </div>
                  {idx < stepCount - 1 && (
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
                  {step.config && Object.keys(step.config).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(step.config).filter(([k]) => k !== 'position').map(([k, v]) => (
                        <span key={k} className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                          {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </span>
                      ))}
                    </div>
                  )}
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
// Bind Agents Modal
// ============================================================
interface BindAgentsModalProps {
  open: boolean;
  doc: KnowledgeDoc | null;
  agents: AgentInfo[];
  onClose: () => void;
  onSave: (docId: number, agentIds: string[]) => Promise<void>;
}

function BindAgentsModal({ open, doc, agents, onClose, onSave }: BindAgentsModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && doc) {
      setSelected(doc.bound_agents || []);
    }
  }, [open, doc]);

  if (!open || !doc) return null;

  const toggleAgent = (agentId: string) => {
    setSelected(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(doc.id, selected);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Link2 size={18} className="text-primary-600" />
          绑定智能体
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          选择可读取「{doc.name}」的智能体（多选）
        </p>

        {agents.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            当前暂无可选智能体，请先前往「智能体管理」创建智能体。
          </div>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {agents.map(agent => (
              <label
                key={agent.agent_id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selected.includes(agent.agent_id)
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(agent.agent_id)}
                  onChange={() => toggleAgent(agent.agent_id)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: agent.accent ? `${agent.accent}20` : '#f3f4f6' }}
                >
                  {agent.emoji || '🤖'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                  <div className="text-xs text-gray-500 truncate">{agent.role}</div>
                </div>
                {selected.includes(agent.agent_id) && (
                  <CheckCircle2 size={16} className="text-primary-600 flex-shrink-0" />
                )}
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || agents.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Document Preview Modal
// ============================================================
interface DocPreviewModalProps {
  open: boolean;
  doc: KnowledgeDoc | null;
  tenantId: string;
  onClose: () => void;
}

function DocPreviewModal({ open, doc, tenantId, onClose }: DocPreviewModalProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !doc) return;
    setLoading(true);
    setError('');
    setContent('');
    api.getKnowledgeDocContent(tenantId, doc.id)
      .then((res) => {
        setContent(res.data?.content_text || '');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '获取文档内容失败');
      })
      .finally(() => setLoading(false));
  }, [open, doc, tenantId]);

  if (!open || !doc) return null;

  const FileIcon = getFileIcon(doc.type);
  const iconColor = getFileTypeColor(doc.type);

  // Render content based on type
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-primary-500 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">加载文档内容...</span>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle size={32} className="text-red-400 mb-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      );
    }
    if (!content.trim()) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <FileText size={32} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">该文档暂无可预览的文本内容</p>
          <p className="text-xs text-gray-300 mt-1">文档可能尚未完成文本提取</p>
        </div>
      );
    }

    // For Markdown, render as preformatted
    if (doc.type.toUpperCase() === 'MD') {
      return (
        <pre className="whitespace-pre-wrap break-words text-sm text-gray-700 font-mono leading-relaxed p-4 bg-gray-50 rounded-lg">
          {content}
        </pre>
      );
    }

    // For other text types, render with basic line breaks
    return (
      <div className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg">
        <pre className="whitespace-pre-wrap break-words text-sm text-gray-700 leading-relaxed m-0 font-sans">
          {content}
        </pre>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-100">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
            <FileIcon size={20} className={iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{doc.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{doc.type}</span>
              <span>{doc.size}</span>
              <span className="inline-flex items-center gap-1">
                <Clock size={11} />
                {new Date(doc.created_at).toLocaleDateString('zh-CN')}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <span className="text-xs text-gray-400">
            {content ? `共 ${content.length} 字符` : ''}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Knowledge Documents Table
// ============================================================
function KnowledgeDocsTab() {
  const { state } = useAuth();
  const tenantId = state.tenant?.id ? String(state.tenant.id) : '';

  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [bindDoc, setBindDoc] = useState<KnowledgeDoc | null>(null);
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDoc | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agent rabbit avatar lookup by agent_id code
  const getAgentImageUrl = (agentCode: string): string => {
    const agent = agents.find(a => a.agent_id === agentCode);
    return getRabbitImageUrl(agent?.scarf_color);
  };

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getKnowledgeDocs(tenantId);
      const list = (res.data || []) as KnowledgeDoc[];
      // 最新上传的文档置顶
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setDocs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取知识文档失败');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const fetchAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const res = await api.getAgents(true);
      setAgents(res.data || []);
    } catch {
      setAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
    fetchAgents();
  }, [fetchDocs, fetchAgents]);

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

  // Upload
  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadSuccess(false);
    setError('');
    try {
      const ext = file.name.split('.').pop() || '';
      const type = normalizeFileType(ext);
      const sizeKBNum = file.size / 1024;
      const payload: Record<string, unknown> = {
        name: file.name,
        type,
        size: sizeKBNum > 1024 ? `${(sizeKBNum / 1024).toFixed(1)} MB` : `${sizeKBNum.toFixed(1)} KB`,
        folder: '/root',
        bound_agents: [],
      };

      // For text-based files, read content for online preview
      const textExts = ['md', 'txt', 'csv', 'json', 'xml', 'html', 'js', 'ts', 'py', 'sql'];
      if (textExts.includes(ext.toLowerCase()) && file.size < 512 * 1024) {
        const text = await file.text();
        payload.content_text = text;
      }

      const res = await api.createKnowledgeDoc(tenantId, payload);
      const created = res.data as KnowledgeDoc;
      setDocs(prev => [created, ...prev]);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Bind agents
  const handleBindSave = async (docId: number, agentIds: string[]) => {
    const res = await api.updateKnowledgeDoc(tenantId, docId, { bound_agents: agentIds });
    const updated = res.data as KnowledgeDoc;
    setDocs(prev => prev.map(d => (d.id === docId ? updated : d)));
  };

  // Delete doc
  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await api.deleteKnowledgeDoc(tenantId, deleteId);
      setDocs(prev => prev.filter(d => d.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const openBind = (doc: KnowledgeDoc) => {
    if (agents.length === 0) {
      setError('当前暂无可选智能体，请先前往「智能体管理」创建智能体。');
      return;
    }
    setBindDoc(doc);
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
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.csv,.json"
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
      {loading || agentsLoading ? (
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
                        <button
                          onClick={() => openBind(doc)}
                          className="group inline-flex items-center gap-1 text-xs transition-colors"
                          title="编辑绑定智能体"
                        >
                          {doc.bound_agents && doc.bound_agents.length > 0 ? (
                            doc.bound_agents.length === 1 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-700">
                                <img
                                  src={getAgentImageUrl(doc.bound_agents[0])}
                                  alt=""
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                                {AGENT_NAMES[doc.bound_agents[0]] || doc.bound_agents[0]}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-700">
                                <span className="flex -space-x-1">
                                  {doc.bound_agents.slice(0, 3).map((code: string) => (
                                    <img
                                      key={code}
                                      src={getAgentImageUrl(code)}
                                      alt=""
                                      className="w-4 h-4 rounded-full object-cover border border-white"
                                    />
                                  ))}
                                </span>
                                绑定智能体{doc.bound_agents.length}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-300">未绑定</span>
                          )}
                          <Pencil size={12} className="text-gray-300 group-hover:text-primary-600" />
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} className="text-gray-400" />
                          {new Date(doc.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                            title="在线预览"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(doc.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bind Agents Modal */}
      <BindAgentsModal
        open={bindDoc !== null}
        doc={bindDoc}
        agents={agents}
        onClose={() => setBindDoc(null)}
        onSave={handleBindSave}
      />

      {/* Document Preview Modal */}
      <DocPreviewModal
        open={previewDoc !== null}
        doc={previewDoc}
        tenantId={tenantId}
        onClose={() => setPreviewDoc(null)}
      />

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
// Marketing Materials Tab (营销素材)
// ============================================================
const MATERIAL_TABS = [
  { key: 'image', label: '图片', icon: ImageIcon, accept: 'image/*' },
  { key: 'video', label: '视频', icon: Video, accept: 'video/*' },
  { key: 'audio', label: '语音', icon: Mic, accept: 'audio/*' },
  { key: 'file', label: '文件', icon: FileBox, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv' },
  { key: 'link', label: '链接', icon: Link2, accept: '' },
  { key: 'miniapp', label: '小程序', icon: Smartphone, accept: '' },
  { key: 'channel', label: '视频号', icon: Tv, accept: '' },
] as const;

const PASTEL_COLORS = [
  'bg-blue-100', 'bg-emerald-100', 'bg-amber-100', 'bg-sky-100',
  'bg-rose-100', 'bg-violet-100', 'bg-orange-100', 'bg-teal-100',
  'bg-indigo-100', 'bg-pink-100',
];

// ---- Add Link Modal (for link/miniapp/channel types) ----
interface AddLinkModalProps {
  open: boolean;
  type: string;
  onClose: () => void;
  onAdd: (data: { name: string; type: string; url: string; description?: string }) => Promise<void>;
}

function AddLinkModal({ open, type, onClose, onAdd }: AddLinkModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setUrl('');
      setDescription('');
    }
  }, [open]);

  if (!open) return null;

  const typeLabel = MATERIAL_TABS.find(t => t.key === type)?.label || type;
  const isLinkType = type === 'link' || type === 'miniapp' || type === 'channel';

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    try {
      await onAdd({ name: name.trim(), type, url: url.trim(), description: description.trim() || undefined });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={18} className="text-primary-600" />
          添加{typeLabel}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`输入${typeLabel}名称`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{isLinkType ? '链接地址 *' : 'URL *'}</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">描述（选填）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="素材描述..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !url.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            添加
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Bind Media to Agents Modal ----
interface BindMediaAgentsModalProps {
  open: boolean;
  asset: MediaAsset | null;
  agents: AgentInfo[];
  agentConfigs: import('@/types').AgentConfigItem[];
  onClose: () => void;
  onSave: (assetId: number, selectedAgentCodes: string[]) => Promise<void>;
}

function BindMediaAgentsModal({ open, asset, agents, agentConfigs, onClose, onSave }: BindMediaAgentsModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && asset) {
      // Check which agents have this asset ID in their bound_images
      const boundAgents: string[] = [];
      for (const config of agentConfigs) {
        if (config.bound_images?.includes(asset.id)) {
          boundAgents.push(config.agent_id);
        }
      }
      setSelected(boundAgents);
    }
  }, [open, asset, agentConfigs]);

  if (!open || !asset) return null;

  const toggleAgent = (agentId: string) => {
    setSelected(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(asset.id, selected);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Bot size={18} className="text-primary-600" />
          绑定智能体
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          选择可学习「{asset.name}」的智能体（多选），绑定后智能体可在工作中参考此素材
        </p>

        {agents.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            当前暂无可选智能体，请先前往「智能体管理」创建智能体。
          </div>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {agents.map(agent => {
              const isChecked = selected.includes(agent.agent_id);
              return (
                <label
                  key={agent.agent_id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isChecked ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleAgent(agent.agent_id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: agent.accent ? `${agent.accent}20` : '#f3f4f6' }}
                  >
                    {agent.emoji || agent.scarf_color
                      ? <img src={getRabbitImageUrl(agent.scarf_color)} alt={agent.name} className="w-full h-full object-cover" />
                      : '🤖'
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                    <div className="text-xs text-gray-500 truncate">{agent.role}</div>
                  </div>
                  {isChecked && <CheckCircle2 size={16} className="text-primary-600 flex-shrink-0" />}
                </label>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || agents.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketingMaterialsTab() {
  const { state } = useAuth();
  const tenantId = state.tenant?.id?.toString() || '';
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<string>('image');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string>('全部');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [bindAsset, setBindAsset] = useState<MediaAsset | null>(null);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentConfigs, setAgentConfigs] = useState<import('@/types').AgentConfigItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.getMediaAssets(tenantId);
      const data = res.data as unknown;
      // 防御性处理：兼容 {items, total} 和直接数组两种格式
      const list: MediaAsset[] = Array.isArray(data) ? data : ((data as { items?: MediaAsset[] })?.items || []);
      setAssets(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取素材列表失败');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const fetchAgentsAndConfigs = useCallback(async () => {
    try {
      const [agentsRes, configsRes] = await Promise.all([
        api.getAgents(true),
        api.getAgentConfigs(),
      ]);
      setAgents(agentsRes.data || []);
      setAgentConfigs(configsRes.data || []);
    } catch {
      setAgents([]);
      setAgentConfigs([]);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
    fetchAgentsAndConfigs();
  }, [fetchAssets, fetchAgentsAndConfigs]);

  // Extract unique folders from assets
  const folders = Array.from(new Set(assets.map(a => a.folder || '全部')));

  // Filter assets: by tab type, folder, and search
  const filtered = assets.filter(a => {
    if (a.type !== activeTab) return false;
    if (activeFolder !== '全部' && (a.folder || '全部') !== activeFolder) return false;
    if (!search.trim()) return true;
    return a.name.toLowerCase().includes(search.toLowerCase());
  });

  // Count per type for tab badges
  const typeCounts: Record<string, number> = {};
  assets.forEach(a => {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  });

  const activeTabObj = MATERIAL_TABS.find(t => t.key === activeTab) || MATERIAL_TABS[0];
  const isLinkType = activeTab === 'link' || activeTab === 'miniapp' || activeTab === 'channel';

  // Upload file
  const handleUploadClick = () => {
    if (isLinkType) {
      setAddLinkOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadSuccess(false);
    setError('');
    try {
      await api.uploadMediaAsset(tenantId, file, {
        type: activeTab,
        folder: activeFolder,
      });
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
      await fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Add link/miniapp/channel
  const handleAddLink = async (data: { name: string; type: string; url: string; description?: string }) => {
    await api.createMediaAsset(tenantId, {
      name: data.name,
      type: data.type,
      size: '-',
      url: data.url,
      folder: activeFolder,
      description: data.description || '',
    });
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 2000);
    await fetchAssets();
  };

  // Delete
  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await api.deleteMediaAsset(tenantId, deleteId);
      setAssets(prev => prev.filter(a => a.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  // Bind to agents — update each changed agent's config
  const handleBindSave = async (assetId: number, selectedAgentCodes: string[]) => {
    // For each agent, check if its config's bound_images includes assetId
    // If newly selected: add assetId to bound_images
    // If newly deselected: remove assetId from bound_images
    const updates: Promise<unknown>[] = [];
    for (const agent of agents) {
      const config = agentConfigs.find(c => c.agent_id === agent.agent_id);
      const currentBound = config?.bound_images || [];
      const hasIt = currentBound.includes(assetId);
      const shouldBe = selectedAgentCodes.includes(agent.agent_id);

      if (hasIt !== shouldBe) {
        const newBound = shouldBe
          ? [...currentBound, assetId]
          : currentBound.filter((id: number) => id !== assetId);
        updates.push(api.updateAgentConfig(tenantId, agent.agent_id, { bound_images: newBound }));
      }
    }
    await Promise.all(updates);
    // Refresh configs
    const configsRes = await api.getAgentConfigs();
    setAgentConfigs(configsRes.data || []);
  };

  // Create folder
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    setActiveFolder(newFolderName.trim());
    setShowNewFolder(false);
    setNewFolderName('');
  };

  // Get agents bound to an asset (for display)
  const getBoundAgentCount = (assetId: number): number => {
    return agentConfigs.filter(c => c.bound_images?.includes(assetId)).length;
  };

  // Get agent emojis for an asset
  const getBoundAgentEmojis = (assetId: number): string[] => {
    const codes: string[] = [];
    for (const config of agentConfigs) {
      if (config.bound_images?.includes(assetId)) {
        codes.push(config.agent_id);
      }
    }
    return codes.slice(0, 3);
  };

  // Render asset preview based on type
  const renderAssetPreview = (asset: MediaAsset, bgClass: string) => {
    // For images, show thumbnail if file_url is available
    if (asset.type === 'image' && asset.file_url) {
      return (
        <img
          src={asset.file_url}
          alt={asset.name}
          className="absolute inset-0 w-full h-full object-cover rounded-lg"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      );
    }
    // For link types, show external link icon
    if (asset.type === 'link' || asset.type === 'miniapp' || asset.type === 'channel') {
      return <activeTabObj.icon className="h-10 w-10 text-gray-400" />;
    }
    // Default: show file icon
    return <FileBox className="h-10 w-10 text-gray-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Type tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        {MATERIAL_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearch(''); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {typeCounts[tab.key] > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {typeCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Folder chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActiveFolder('全部')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeFolder === '全部'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Folder size={12} />
          全部
        </button>
        {folders.filter(f => f !== '全部').map(folder => (
          <button
            key={folder}
            onClick={() => setActiveFolder(folder)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeFolder === folder
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FolderOpen size={12} />
            {folder}
          </button>
        ))}
        {showNewFolder ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
              placeholder="文件夹名称"
              autoFocus
              className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none w-24"
            />
            <button onClick={handleCreateFolder} className="p-1 text-primary-600 hover:bg-primary-50 rounded">
              <CheckCircle2 size={14} />
            </button>
            <button onClick={() => setShowNewFolder(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <FolderPlus size={12} />
            新建文件夹
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {uploadSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 animate-fade-in">
              <CheckCircle2 size={14} />
              操作成功
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept={activeTabObj.accept}
          />
          <button
            onClick={handleUploadClick}
            disabled={uploading || !tenantId}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : isLinkType ? <Plus size={14} /> : <Upload size={14} />}
            {isLinkType ? `添加${activeTabObj.label}` : '上传素材'}
          </button>
        </div>
        <div className="relative w-56">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索素材..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
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

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 animate-pulse">
              <div className="aspect-square bg-gray-100 rounded-lg mb-3" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
              <div className="h-3 bg-gray-50 rounded w-1/2 mt-1" />
            </div>
          ))}
        </div>
      ) : !tenantId ? (
        <div className="text-center py-12 text-sm text-gray-400">
          请先选择租户
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50/40">
          <activeTabObj.icon className="h-10 w-10 text-gray-300" />
          <div className="text-sm text-gray-400">暂无{activeTabObj.label}素材</div>
          <button
            onClick={handleUploadClick}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            {isLinkType ? <Plus size={14} /> : <Upload size={14} />}
            {isLinkType ? `添加${activeTabObj.label}` : '上传素材'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item, idx) => {
            const bgClass = PASTEL_COLORS[idx % PASTEL_COLORS.length];
            const boundCount = getBoundAgentCount(item.id);
            const boundEmojis = getBoundAgentEmojis(item.id);
            const isLink = item.type === 'link' || item.type === 'miniapp' || item.type === 'channel';
            return (
              <div
                key={item.id}
                className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-3 transition hover:shadow-sm"
              >
                <div className={`relative mb-3 flex aspect-square items-center justify-center rounded-lg ${bgClass} overflow-hidden`}>
                  {renderAssetPreview(item, bgClass)}
                  {/* Hover actions */}
                  <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {isLink && item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-white bg-white/80 text-blue-500 hover:bg-blue-50"
                        title="打开链接"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => setBindAsset(item)}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-white bg-white/80 text-primary-600 hover:bg-primary-50"
                      title="绑定智能体"
                    >
                      <Bot className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-white bg-white/80 text-red-500 hover:bg-red-50"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Type badge */}
                  <span className="absolute left-2 top-2 text-[10px] px-1.5 py-0.5 rounded-full bg-white/80 text-gray-600">
                    {MATERIAL_TABS.find(t => t.key === item.type)?.label || item.type}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900" title={item.name}>
                    {item.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                    <span>{item.size}</span>
                    <span>·</span>
                    <span>{new Date(item.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span>
                  </div>
                  {/* Bound agents */}
                  <div className="mt-1.5 flex items-center gap-1">
                    {boundCount > 0 ? (
                      <button
                        onClick={() => setBindAsset(item)}
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
                      >
                        <Bot size={10} />
                        已绑定{boundCount}个智能体
                      </button>
                    ) : (
                      <button
                        onClick={() => setBindAsset(item)}
                        className="text-[10px] text-gray-400 hover:text-primary-600 transition-colors"
                      >
                        + 绑定智能体
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Link Modal */}
      <AddLinkModal
        open={addLinkOpen}
        type={activeTab}
        onClose={() => setAddLinkOpen(false)}
        onAdd={handleAddLink}
      />

      {/* Bind Agents Modal */}
      <BindMediaAgentsModal
        open={bindAsset !== null}
        asset={bindAsset}
        agents={agents}
        agentConfigs={agentConfigs}
        onClose={() => setBindAsset(null)}
        onSave={handleBindSave}
      />

      {/* Delete confirmation */}
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
            <p className="text-sm text-gray-600 mb-4">确定要删除此素材吗？删除后无法恢复。</p>
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
function WorkflowTemplatesTab() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getWorkflowTemplates(true);
      setTemplates(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取工作流模板失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openCreate = () => {
    setEditingTemplate(null);
    setEditorMode('create');
  };

  const openEdit = (t: WorkflowTemplate) => {
    setEditingTemplate(t);
    setEditorMode('edit');
  };

  const closeEditor = () => {
    setEditorMode(null);
    setEditingTemplate(null);
  };

  const handleSaved = () => {
    closeEditor();
    fetchTemplates();
  };

  const handleToggle = async (t: WorkflowTemplate, enabled: boolean) => {
    // 乐观更新
    setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, enabled } : x)));
    try {
      await api.updateWorkflowTemplate(t.id, { enabled });
    } catch (err) {
      // 回滚
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, enabled: !enabled } : x)));
      setError(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteWorkflowTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
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
        <p className="text-sm text-gray-500">
          共 {templates.length} 个模板{loading && ' · 加载中...'}
        </p>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={14} />
          新建工作流
        </button>
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

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Workflow size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">暂无工作流模板</p>
          <button
            onClick={openCreate}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            创建第一个工作流
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <WorkflowTemplateCard
              key={template.id}
              template={template}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {editorMode && (
        <WorkflowEditor
          mode={editorMode}
          template={editingTemplate}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={() => setDeleteTarget(null)}>
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
            <p className="text-sm text-gray-600 mb-4">确定要删除工作流模板「{deleteTarget.name}」吗？删除后无法恢复。</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
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

export default function Workflows() {
  const [activeTab, setActiveTab] = useState<'templates' | 'docs' | 'materials'>('templates');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Workflow className="text-primary-600" size={22} />
          工作流与知识库
        </h1>
        <p className="text-sm text-gray-500 mt-1">管理工作流模板、知识文档与营销素材</p>
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
        <button
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'materials'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ImageIcon size={16} />
          营销素材
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'templates' ? (
        <WorkflowTemplatesTab />
      ) : activeTab === 'docs' ? (
        <KnowledgeDocsTab />
      ) : (
        <MarketingMaterialsTab />
      )}
    </div>
  );
}
