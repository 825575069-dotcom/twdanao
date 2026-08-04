// ============================================================
// YesGo Admin — Agent Management Page
// Unified 8-step create/edit modal + simplified agent cards
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/authStore';
import type {
  AgentConfigItem, AIModel, DifyConfig, AgentInfo,
  WorkflowTemplate, AgentRole, KnowledgeDoc, MediaAsset, DataConnector,
} from '@/types';
import {
  Bot, Settings, Save, Cpu,
  ChevronDown, ChevronUp, ChevronRight, X, AlertCircle, Loader2,
  CheckCircle2, XCircle, Workflow, Plus, Search, Trash2,
  Image as ImageIcon, FileText, Database, UserCheck,
  Video, Mic, FileBox, Link2, Smartphone, Tv, Zap,
  Key, Monitor, Building2,
} from 'lucide-react';

// ---- Rabbit avatar options (6 original scarf colors) ----
const RABBIT_AVATARS: { name: string; hex: string; label: string }[] = [
  { name: 'purple', hex: '#9333ea', label: '紫' },
  { name: 'red', hex: '#dc2626', label: '大红' },
  { name: 'orangered', hex: '#ea580c', label: '橘红' },
  { name: 'yellow', hex: '#eab308', label: '雌黄' },
  { name: 'darkgreen', hex: '#166534', label: '深绿' },
  { name: 'royalblue', hex: '#2563eb', label: '宝蓝' },
  { name: 'brown', hex: '#8b4513', label: '棕' },
  { name: 'magenta', hex: '#d946ef', label: '洋红' },
  { name: 'darkblue', hex: '#1e3a8a', label: '深蓝' },
  { name: 'springgreen', hex: '#84cc16', label: '青葱' },
  { name: 'bluegray', hex: '#64748b', label: '蓝灰' },
  { name: 'pink', hex: '#ec4899', label: '粉红' },
];

// 旧色值向后兼容映射
const LEGACY_COLOR_MAP: Record<string, string> = {
  orange: 'orangered',
  green: 'darkgreen',
  blue: 'royalblue',
  '#f97316': 'orangered',
  '#facc15': 'yellow',
  '#16a34a': 'darkgreen',
};

function getRabbitByColor(color?: string) {
  const c = (color || '').toLowerCase();
  // 检查旧色值映射
  const mapped = LEGACY_COLOR_MAP[c] || c;
  if (RABBIT_AVATARS.find(r => r.name === mapped)) return RABBIT_AVATARS.find(r => r.name === mapped)!;
  return RABBIT_AVATARS.find(r => r.hex.toLowerCase() === c) || RABBIT_AVATARS[0];
}

export function getRabbitImageUrl(color?: string) {
  const rabbit = getRabbitByColor(color);
  return `/rabbits/${rabbit.name}.png`;
}

const ROLE_CATEGORIES: Record<string, string> = {
  purchase: '采购', sales: '销售', ops: '运营', flow: '流向',
  academic: '学术', control: '中控', other: '其他',
};

// ---- Marketing material types (same as Workflows.tsx) ----
const MEDIA_TYPE_TABS = [
  { key: 'all', label: '全部', icon: ImageIcon },
  { key: 'image', label: '图片', icon: ImageIcon },
  { key: 'video', label: '视频', icon: Video },
  { key: 'audio', label: '语音', icon: Mic },
  { key: 'file', label: '文件', icon: FileBox },
  { key: 'link', label: '链接', icon: Link2 },
  { key: 'miniapp', label: '小程序', icon: Smartphone },
  { key: 'channel', label: '视频号', icon: Tv },
] as const;

// ---- Workflow code labels (Chinese) ----
const WORKFLOW_CODE_LABELS: Record<string, string> = {
  academic: '学术',
  distribution: '流通',
  marketing: '营销',
  operations: '运营',
  procurement: '采购',
};
const WORKFLOW_CODES = Object.keys(WORKFLOW_CODE_LABELS);

// ---- Steps: Builtin mode (8 steps) ----
const BUILTIN_STEPS = [
  { id: 1, name: '基础信息', icon: Bot, required: true },
  { id: 2, name: '角色绑定', icon: UserCheck, required: true },
  { id: 3, name: '工作流', icon: Workflow, required: false },
  { id: 4, name: '知识文档', icon: FileText, required: false },
  { id: 5, name: '营销素材', icon: ImageIcon, required: false },
  { id: 6, name: '公共数据库', icon: Database, required: false },
  { id: 7, name: '绑定大模型', icon: Cpu, required: true },
  { id: 8, name: '其他数据', icon: Settings, required: false },
] as const;

// ---- Steps: External mode (3 steps) ----
const EXTERNAL_STEPS = [
  { id: 1, name: '基础信息', icon: Bot, required: true },
  { id: 2, name: '外部平台', icon: Zap, required: true },
  { id: 3, name: '其他数据', icon: Settings, required: false },
] as const;

// ---- 8 Steps definition ---- (kept for reference, replaced by mode-specific above)
const STEPS = BUILTIN_STEPS;

// ---- Color mapping for card theming ----
const COLOR_MAP_BY_CODE: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  control: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
  ops: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  crm: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  purchase: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  flow: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
  academic: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-700' },
};
const DEFAULT_COLOR = { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' };

// ============================================================
// Unified Agent Edit Modal (8 Steps)
// ============================================================
interface AgentEditModalProps {
  mode: 'create' | 'edit';
  agent?: AgentInfo;
  config?: AgentConfigItem;
  roles: AgentRole[];
  workflowTemplates: WorkflowTemplate[];
  models: AIModel[];
  knowledgeDocs: KnowledgeDoc[];
  mediaAssets: MediaAsset[];
  connectors: DataConnector[];
  difyConfig: DifyConfig | null;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}

function AgentEditModal({
  mode, agent, config, roles, workflowTemplates, models,
  knowledgeDocs, mediaAssets, connectors, difyConfig, tenantId, onClose, onSaved,
}: AgentEditModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ---- AI Capability Mode ----
  const [capabilityMode, setCapabilityMode] = useState<'builtin' | 'external'>('builtin');
  const [externalWorkflowCode, setExternalWorkflowCode] = useState('');
  const [externalApiKey, setExternalApiKey] = useState('');
  const [externalBaseUrl, setExternalBaseUrl] = useState('');

  // Use appropriate steps based on capability mode
  const currentSteps = capabilityMode === 'external' ? EXTERNAL_STEPS : BUILTIN_STEPS;
  const maxStep = currentSteps.length;

  // 外部平台工作流编码从后端 DifyConfig 动态拉取
  const availableWorkflows = difyConfig?.workflows || [];
  const workflowCodeOptions = availableWorkflows.map(wf => ({
    code: wf.code,
    label: WORKFLOW_CODE_LABELS[wf.code] || wf.code,
    agentCode: wf.agent_code,
    hasKey: !!wf.api_key,
    api_key: wf.api_key,
    base_url: wf.base_url,
    id: wf.id,
  }));

  // 选择工作流编码时��动回填已有的 API Key 和 Base URL
  const handleWorkflowCodeChange = (code: string) => {
    setExternalWorkflowCode(code);
    const opt = workflowCodeOptions.find(o => o.code === code);
    if (opt) {
      setExternalApiKey(opt.api_key || '');
      setExternalBaseUrl(opt.base_url || '');
    } else {
      setExternalApiKey('');
      setExternalBaseUrl('');
    }
  };


  // ---- Step 1: Basic Info ----
  const [scarfColor, setScarfColor] = useState(RABBIT_AVATARS[0].hex);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accent, setAccent] = useState(RABBIT_AVATARS[0].hex);
  const [avatar, setAvatar] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError('仅支持 PNG、JPEG、WebP、SVG 格式的图片');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB');
      return;
    }

    setUploadingAvatar(true);
    setError('');
    try {
      const res = await api.uploadMediaAsset(tenantId, file, {
        type: 'image',
        folder: '头像',
        name: `${name.trim() || '智能体'}自定义头像`,
      });
      const asset = res.data;
      const url = asset.url || (asset as unknown as { file_url?: string }).file_url || '';
      if (url) {
        setAvatar(url);
      } else {
        setError('上传成功但未获取到图片地址');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '头像上传失败');
    } finally {
      setUploadingAvatar(false);
      // Reset file input so the same file can be re-uploaded
      if (e.target) e.target.value = '';
    }
  };

  // ---- Step 2: Role Binding ----
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCategory, setNewRoleCategory] = useState('other');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  // ---- Step 3: Workflow ----
  const [workflowTemplateId, setWorkflowTemplateId] = useState<string>('');

  // ---- Step 4: Knowledge Docs (optional) ----
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);

  // ---- Step 5: Media Assets (optional) ----
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);
  const [activeMediaType, setActiveMediaType] = useState<string>('all');

  // ---- Step 6: Public Databases (optional) ----
  const [selectedConnectorIds, setSelectedConnectorIds] = useState<number[]>([]);

  // ---- Step 7: Model Binding ----
  const [modelId, setModelId] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxRetry, setMaxRetry] = useState(3);
  const [fallbackModelId, setFallbackModelId] = useState('');
  const [takeoverThreshold, setTakeoverThreshold] = useState(0.8);

  // ---- Step 8: Other Data (custom JSON) ----
  const [customPairs, setCustomPairs] = useState<{ key: string; value: string }[]>([]);

  // Initialize state from agent/config in edit mode
  useEffect(() => {
    if (mode === 'edit' && agent) {
      setName(agent.name || '');
      setDescription(agent.description || '');
      setScarfColor(agent.scarf_color || RABBIT_AVATARS[0].hex);
      setAccent(agent.accent || agent.scarf_color || RABBIT_AVATARS[0].hex);
      setAvatar(agent.avatar || config?.custom_avatar || '');
      setCapabilityMode(agent.capability_mode === 'external' ? 'external' : 'builtin');
      setExternalWorkflowCode(agent.external_workflow_code || '');
      // 编辑模式：从 DifyConfig 回填 API Key 和 Base URL
      if (agent.external_workflow_code) {
        const wf = (difyConfig?.workflows || []).find(w => w.code === agent.external_workflow_code);
        if (wf) {
          setExternalApiKey(wf.api_key || '');
          setExternalBaseUrl(wf.base_url || '');
        }
      }
      setWorkflowTemplateId(
        agent.default_workflow_template_id ? String(agent.default_workflow_template_id) : ''
      );
      // Find role and populate editable form fields
      const boundRole = roles.find(r => r.agent_code === (agent.code || agent.agent_id));
      if (boundRole) {
        setSelectedRoleId(boundRole.id);
        setNewRoleName(boundRole.name || '');
        setNewRoleCategory(boundRole.category || 'other');
        setNewRoleDescription(boundRole.description || '');
      }
    }
    if (config) {
      setModelId(config.model_id || '');
      setTemperature(config.temperature ?? 0.7);
      setMaxRetry(config.max_retry ?? 3);
      setFallbackModelId(config.fallback_model_id || '');
      setTakeoverThreshold(config.human_takeover_threshold ?? 0.8);
      setSelectedDocIds(config.bound_docs || []);
      setSelectedImageIds(config.bound_images || []);
      setSelectedConnectorIds(config.bound_data_bases || []);
      // Parse custom JSON into key-value pairs
      const custom = config.custom || {};
      const pairs = Object.entries(custom).map(([key, value]) => ({
        key, value: typeof value === 'string' ? value : JSON.stringify(value),
      }));
      setCustomPairs(pairs);
    }
  }, [mode, agent, config, roles]);

  // ---- Validation ----
  const validateStep = (s: number): string => {
    if (s === 1) {
      if (!name.trim()) return '请输入智能体名称';
      if (!description.trim()) return '请输入智能体简介';
    }
    if (s === 2) {
      if (capabilityMode === 'builtin') {
        if (!newRoleName.trim()) return '请输入角色名称';
      } else {
        if (!externalWorkflowCode) return '请选择外部平台工作流';
      }
    }
    return '';
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError('');
    setStep(s => Math.min(s + 1, maxStep));
  };

  const handleStepClick = (targetStep: number) => {
    // Edit mode: freely jump to any step
    if (mode === 'edit') {
      setError('');
      setStep(targetStep);
      return;
    }
    // Create mode: allow going back freely, but validate when going forward
    if (targetStep <= step) {
      setError('');
      setStep(targetStep);
      return;
    }
    // Validate all steps between current and target
    for (let s = step; s < targetStep; s++) {
      const err = validateStep(s);
      if (err) { setError(err); return; }
    }
    setError('');
    setStep(targetStep);
  };

  // ---- Save handler ----
  const handleSave = async () => {
    // Validate required steps
    for (let s = 1; s <= maxStep; s++) {
      const err = validateStep(s);
      if (err) {
        setError(err);
        setStep(s);
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      // Step A: Create or update role (builtin mode only)
      let roleId = selectedRoleId;
      if (capabilityMode === 'builtin') {
        if (selectedRoleId) {
          await api.updateAgentRole(selectedRoleId, {
            name: newRoleName.trim(),
            category: newRoleCategory,
            description: newRoleDescription.trim(),
          });
        } else {
          const roleRes = await api.createAgentRole({
            name: newRoleName.trim(),
            code: 'role_' + Date.now().toString(36),
            category: newRoleCategory,
            description: newRoleDescription.trim(),
            enabled: true,
            sort: 0,
          });
          roleId = (roleRes.data as { id?: number })?.id || null;
        }
      }

      // Step B: Create or update Agent
      const agentData: Record<string, unknown> = {
        name: name.trim(),
        role: newRoleDescription || description,
        accent,
        scarf_color: scarfColor,
        avatar,
        description: description.trim(),
        capability_mode: capabilityMode,
        external_workflow_code: capabilityMode === 'external' ? externalWorkflowCode : '',
      };

      let finalAgentCode = '';
      if (mode === 'create') {
        finalAgentCode = 'agent_' + Date.now().toString(36);
        await api.createAgent({
          agent_id: finalAgentCode,
          code: finalAgentCode,
          emoji: '',
          capabilities: [],
          sort_order: 99,
          enabled: true,
          ...(capabilityMode === 'builtin' ? {
            agent_role_id: roleId,
            default_workflow_template_id: workflowTemplateId ? parseInt(workflowTemplateId) : null,
          } : {
            agent_role_id: null,
            default_workflow_template_id: null,
          }),
          ...agentData,
        });
      } else if (agent) {
        finalAgentCode = agent.code || agent.agent_id;
        await api.updateAgent(agent.id, {
          ...(capabilityMode === 'builtin' ? {
            agent_role_id: roleId,
            default_workflow_template_id: workflowTemplateId ? parseInt(workflowTemplateId) : null,
          } : {
            agent_role_id: null,
            default_workflow_template_id: null,
          }),
          ...agentData,
        });
      }

      // Step C: Save AgentConfig (model + all bindings + custom)
      const customObj: Record<string, unknown> = {};
      for (const pair of customPairs) {
        if (pair.key.trim()) {
          // Try to parse value as JSON, fallback to string
          try {
            customObj[pair.key.trim()] = JSON.parse(pair.value);
          } catch {
            customObj[pair.key.trim()] = pair.value;
          }
        }
      }

      const configData: Record<string, unknown> = {
        model_id: modelId,
        temperature,
        max_retry: maxRetry,
        fallback_model_id: fallbackModelId,
        human_takeover_threshold: takeoverThreshold,
        bound_docs: selectedDocIds,
        bound_images: selectedImageIds,
        bound_data_bases: selectedConnectorIds,
        custom_avatar: avatar,
        custom: customObj,
      };
      if (workflowTemplateId) {
        configData.custom_workflow_template_id = parseInt(workflowTemplateId);
      }
      await api.updateAgentConfig(tenantId, finalAgentCode, configData);

      // Step C2: Sync Dify workflow credentials (external mode only)
      if (capabilityMode === 'external' && externalWorkflowCode) {
        const selectedWorkflow = workflowCodeOptions.find(o => o.code === externalWorkflowCode);
        if (selectedWorkflow) {
          const updatedWorkflows = (difyConfig?.workflows || []).map(wf => {
            if (wf.id === selectedWorkflow.id) {
              return { ...wf, api_key: externalApiKey, base_url: externalBaseUrl };
            }
            return wf;
          });
          // Ensure the workflow exists in the list
          const exists = updatedWorkflows.some(wf => wf.id === selectedWorkflow.id);
          if (!exists) {
            updatedWorkflows.push({
              ...selectedWorkflow,
              api_key: externalApiKey,
              base_url: externalBaseUrl,
            } as any);
          }
          await api.updateDifyConfig({ workflows: updatedWorkflows.map(wf => ({
            id: wf.id,
            api_key: (wf as any).api_key || '',
            base_url: (wf as any).base_url || '',
          })) });
        }
      }

      // Step D: Update knowledge docs binding (bound_agents on each doc)
      // 统一使用 agent_id（平台预置 Agent 的 agent_id 与 code 不同）
      const bindingAgentId = mode === 'edit' && agent ? agent.agent_id : finalAgentCode;
      const prevDocIds = config?.bound_docs || [];
      const newDocIds = selectedDocIds;
      const toAdd = newDocIds.filter(id => !prevDocIds.includes(id));
      const toRemove = prevDocIds.filter(id => !newDocIds.includes(id));

      for (const docId of toAdd) {
        const doc = knowledgeDocs.find(d => d.id === docId);
        if (doc) {
          const updatedAgents = [...new Set([...(doc.bound_agents || []), bindingAgentId])];
          await api.updateKnowledgeDoc(tenantId, docId, { bound_agents: updatedAgents });
        }
      }
      for (const docId of toRemove) {
        const doc = knowledgeDocs.find(d => d.id === docId);
        if (doc) {
          const updatedAgents = (doc.bound_agents || []).filter((c: string) => c !== bindingAgentId);
          await api.updateKnowledgeDoc(tenantId, docId, { bound_agents: updatedAgents });
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // ---- Toggle helpers ----
  const toggleDoc = (id: number) => {
    setSelectedDocIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleImage = (id: number) => {
    setSelectedImageIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleConnector = (id: number) => {
    setSelectedConnectorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredDocs = knowledgeDocs.filter(d =>
    !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()
  ));
  const filteredAssets = mediaAssets.filter(a => {
    if (activeMediaType !== 'all' && a.type !== activeMediaType) return false;
    if (!searchQuery) return true;
    return a.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const currentStep = currentSteps.find(s => s.id === step) || currentSteps[0];
  const StepIcon = currentStep.icon;

  // ---- Reusable data-binding sections ----
  const renderKnowledgeDocsSection = (compact = false) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
          <FileText size={14} className="text-gray-400" />
          知识文档
        </h4>
        {selectedDocIds.length > 0 && <span className="text-xs text-primary-600">已选 {selectedDocIds.length} 个</span>}
      </div>
      <input
        type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="搜索知识文档..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
      />
      {filteredDocs.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-400">
          <FileText size={24} className="text-gray-300 mx-auto mb-1" />
          暂无知识文档
        </div>
      ) : (
        <div className={`space-y-1.5 overflow-y-auto ${compact ? 'max-h-40' : 'max-h-72'}`}>
          {filteredDocs.map(doc => (
            <button
              key={doc.id}
              onClick={() => toggleDoc(doc.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all text-left ${
                selectedDocIds.includes(doc.id)
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                selectedDocIds.includes(doc.id) ? 'bg-primary-600' : 'border border-gray-300'
              }`}>
                {selectedDocIds.includes(doc.id) && <CheckCircle2 size={14} className="text-white" />}
              </div>
              <FileText size={16} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{doc.name}</div>
                <div className="text-xs text-gray-400">{doc.type} · {doc.size}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderMediaAssetsSection = (compact = false) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
          <ImageIcon size={14} className="text-gray-400" />
          营销素材
        </h4>
        {selectedImageIds.length > 0 && <span className="text-xs text-primary-600">已选 {selectedImageIds.length} 个</span>}
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {MEDIA_TYPE_TABS.map(tab => {
          const Icon = tab.icon;
          const count = tab.key === 'all'
            ? mediaAssets.length
            : mediaAssets.filter(a => a.type === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveMediaType(tab.key)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                activeMediaType === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon size={12} />
              {tab.label}
              <span className={`ml-0.5 px-1 py-0.5 rounded-full text-[9px] ${
                activeMediaType === tab.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <input
        type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="搜索营销素材..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
      />
      {filteredAssets.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-400">
          <ImageIcon size={24} className="text-gray-300 mx-auto mb-1" />
          暂无营销素材
        </div>
      ) : (
        <div className={`grid grid-cols-2 gap-2 overflow-y-auto ${compact ? 'max-h-40' : 'max-h-72'}`}>
          {filteredAssets.map(asset => {
            const TypeIcon = MEDIA_TYPE_TABS.find(t => t.key === asset.type)?.icon || FileBox;
            return (
              <button
                key={asset.id}
                onClick={() => toggleImage(asset.id)}
                className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${
                  selectedImageIds.includes(asset.id)
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                  selectedImageIds.includes(asset.id) ? 'bg-primary-600' : 'border border-gray-300'
                }`}>
                  {selectedImageIds.includes(asset.id) && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <TypeIcon size={14} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">{asset.name}</div>
                  <div className="text-[10px] text-gray-400">{MEDIA_TYPE_TABS.find(t => t.key === asset.type)?.label || asset.type}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderPublicDatabasesSection = (compact = false) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
          <Database size={14} className="text-gray-400" />
          公共数据库
        </h4>
        {selectedConnectorIds.length > 0 && <span className="text-xs text-primary-600">已选 {selectedConnectorIds.length} 个</span>}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
        <p className="text-xs text-amber-700">
          注：租户私有数据库需在创建租户分配智能体时绑定。此处仅绑定公共数据库（数据连接器）。
        </p>
      </div>
      {connectors.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-400">
          <Database size={24} className="text-gray-300 mx-auto mb-1" />
          暂无公共数据库连接器
        </div>
      ) : (
        <div className={`space-y-1.5 overflow-y-auto ${compact ? 'max-h-40' : 'max-h-72'}`}>
          {connectors.map(conn => (
            <button
              key={conn.id}
              onClick={() => toggleConnector(conn.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all text-left ${
                selectedConnectorIds.includes(conn.id)
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                selectedConnectorIds.includes(conn.id) ? 'bg-primary-600' : 'border border-gray-300'
              }`}>
                {selectedConnectorIds.includes(conn.id) && <CheckCircle2 size={14} className="text-white" />}
              </div>
              <Database size={16} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{conn.name}</div>
                <div className="text-xs text-gray-400">{conn.type} · {conn.status}</div>
              </div>
              {conn.enabled && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">启用</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in overflow-y-auto py-8" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl flex flex-col"
        style={{ width: '900px', height: '640px', maxWidth: 'calc(100vw - 2rem)', maxHeight: 'calc(100vh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
              <Bot className="text-primary-600" size={18} />
            </div>
            <h3 className="font-semibold text-gray-900">
              {mode === 'create' ? '创建智能体' : '编辑智能体'}
            </h3>
            {agent && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {agent.code || agent.agent_id}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body: Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Step Sidebar */}
          <div className="w-48 border-r border-gray-100 py-3 px-2 flex-shrink-0 overflow-y-auto">
            {currentSteps.map(s => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isCompleted = step > s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleStepClick(s.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors mb-0.5 ${
                    isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                    isCompleted ? 'bg-primary-600 text-white' :
                    isActive ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isCompleted ? <CheckCircle2 size={12} /> : s.id}
                  </div>
                  <Icon size={14} className={isActive || isCompleted ? 'text-primary-600' : 'text-gray-400'} />
                  <span className="truncate">{s.name}</span>
                  {!s.required && (
                    <span className="text-[9px] text-gray-400 ml-auto">选填</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 mb-4">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* Step Title */}
            <div className="flex items-center gap-2 mb-4">
              <StepIcon size={18} className="text-primary-600" />
              <h4 className="font-medium text-gray-900">
                {currentStep.name}
                {!currentStep.required && (
                  <span className="ml-2 text-xs font-normal text-gray-400">（非必填）</span>
                )}
              </h4>
            </div>

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <div className="space-y-4">
                {/* AI Capability Mode Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">AI能力模式 <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { setCapabilityMode('builtin'); setStep(1); }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        capabilityMode === 'builtin'
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Bot size={18} className={capabilityMode === 'builtin' ? 'text-primary-600' : 'text-gray-400'} />
                        <span className={`font-medium text-sm ${capabilityMode === 'builtin' ? 'text-primary-700' : 'text-gray-700'}`}>
                          天网大脑AI能力
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        在天网大脑内配置角色、工作流、知识文档、数据底座与AI大模型
                      </p>
                    </button>
                    <button
                      onClick={() => { setCapabilityMode('external'); setStep(1); }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        capabilityMode === 'external'
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Zap size={18} className={capabilityMode === 'external' ? 'text-primary-600' : 'text-gray-400'} />
                        <span className={`font-medium text-sm ${capabilityMode === 'external' ? 'text-primary-700' : 'text-gray-700'}`}>
                          外部平台AI能力
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        对接 Dify 等外部平台，通过 API 转发请求到平台已有的智能体工作流
                      </p>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">头像（围巾颜色）</label>
                  <div className="grid grid-cols-6 gap-2">
                    {RABBIT_AVATARS.map(rabbit => (
                      <button
                        key={rabbit.name}
                        onClick={() => { setScarfColor(rabbit.hex); setAccent(rabbit.hex); }}
                        className={`relative aspect-square rounded-xl flex items-center justify-center overflow-hidden transition-all ${
                          scarfColor === rabbit.hex
                            ? 'ring-2 ring-primary-500 ring-offset-2 bg-primary-50'
                            : 'hover:bg-gray-100 bg-gray-50'
                        }`}
                        title={rabbit.label}
                      >
                        <img src={`/rabbits/${rabbit.name}.png`} alt={rabbit.label} className="w-10 h-10 object-contain" />
                      </button>
                    ))}
                  </div>
                </div>
                {/* Custom Avatar Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    自定义头像
                    <span className="text-xs text-gray-400 ml-2 font-normal">上传代替默认兔仔头像</span>
                  </label>
                  <div className="flex items-start gap-4">
                    {/* Preview */}
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                      {avatar ? (
                        <img src={avatar} alt="自定义头像" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={28} className="text-gray-300" />
                      )}
                    </div>
                    {/* Upload controls */}
                    <div className="flex-1 space-y-2">
                      <label
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          uploadingAvatar
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                        }`}
                      >
                        {uploadingAvatar ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            上传中...
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            选择图片
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleAvatarUpload}
                          disabled={uploadingAvatar}
                          className="hidden"
                        />
                      </label>
                      {avatar && (
                        <button
                          onClick={() => setAvatar('')}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 size={12} />
                          移除自定义头像
                        </button>
                      )}
                      <p className="text-xs text-gray-400">支持 PNG / JPEG / WebP / SVG，最大 5MB</p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称 <span className="text-red-500">*</span></label>
                  <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="请输入智能体名称"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">简介 <span className="text-red-500">*</span></label>
                  <textarea
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="请输入智能体简介" rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">主题色</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {RABBIT_AVATARS.map(r => (
                      <button
                        key={r.hex}
                        onClick={() => setAccent(r.hex)}
                        className={`w-8 h-8 rounded-full transition-all ${accent === r.hex ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                        style={{ backgroundColor: r.hex }}
                        title={r.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Role Binding (builtin) / External Platform (external) */}
            {step === 2 && capabilityMode === 'builtin' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">角色名称</label>
                  <input
                    type="text" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="如：采购专家"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">角色分类</label>
                  <select
                    value={newRoleCategory} onChange={(e) => setNewRoleCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                  >
                    {Object.entries(ROLE_CATEGORIES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">角色定位 / 专业能力</label>
                  <textarea
                    value={newRoleDescription} onChange={(e) => setNewRoleDescription(e.target.value)}
                    placeholder="描述该角色的专业能力和职责边界，AI 执行时会读取此描述注入 prompt" rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {step === 2 && capabilityMode === 'external' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    工作流编码 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={externalWorkflowCode}
                    onChange={(e) => handleWorkflowCodeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                    disabled={workflowCodeOptions.length === 0}
                  >
                    <option value="">
                      {workflowCodeOptions.length === 0 ? '暂无可选工作流，请先配置外部平台' : '请选择外部平台工作流'}
                    </option>
                    {workflowCodeOptions.map(opt => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label} ({opt.code}) {opt.hasKey ? '' : '(未配置密钥)'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    选择要绑定的外部平台（Dify）工作流编码，下方直接填写调用凭据
                  </p>
                </div>

                {externalWorkflowCode && (
                  <div className="space-y-3 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium">配置该工作流的调用凭据</p>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        密钥（API Key） <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={externalApiKey}
                        onChange={(e) => setExternalApiKey(e.target.value)}
                        placeholder="请输入 Dify 工作流 API Key"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">服务地址（Base URL）</label>
                      <input
                        type="text"
                        value={externalBaseUrl}
                        onChange={(e) => setExternalBaseUrl(e.target.value)}
                        placeholder="https://api.dify.ai/v1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                      />
                    </div>
                    <p className="text-xs text-gray-400">
                      填写凭据后，天网大脑将真实调用该 Dify 工作流。保存时凭据同步更新到外部平台配置。
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Workflow (builtin only) */}
            {step === 3 && capabilityMode === 'builtin' && (
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                    <Workflow size={14} />
                    工作流模板
                  </label>
                  <select
                    value={workflowTemplateId} onChange={(e) => setWorkflowTemplateId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                  >
                    <option value="">暂不绑定</option>
                    {workflowTemplates.map(t => (
                      <option key={t.id} value={String(t.id)}>{t.name}</option>
                    ))}
                  </select>
                </div>
                {workflowTemplateId && (() => {
                  const tpl = workflowTemplates.find(t => String(t.id) === workflowTemplateId);
                  return tpl ? (
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="text-sm font-medium text-gray-900">{tpl.name}</div>
                      {tpl.description && <p className="text-xs text-gray-500 mt-1">{tpl.description}</p>}
                      <div className="text-xs text-gray-400 mt-2">{tpl.steps?.length || 0} 个步骤</div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Step 4: Knowledge Docs (builtin only) */}
            {step === 4 && capabilityMode === 'builtin' && renderKnowledgeDocsSection()}

            {/* Step 5: Media Assets (builtin only) */}
            {step === 5 && capabilityMode === 'builtin' && renderMediaAssetsSection()}

            {/* Step 6: Public Databases (builtin only) */}
            {step === 6 && capabilityMode === 'builtin' && renderPublicDatabasesSection()}

            {/* Step 7: Model Binding (builtin only) */}
            {step === 7 && capabilityMode === 'builtin' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">绑定模型 <span className="text-red-500">*</span></label>
                  <select
                    value={modelId} onChange={(e) => setModelId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                  >
                    <option value="">请选择模型</option>
                    {models.map(m => (
                      <option key={m.id} value={m.name}>{m.name} ({m.vendor})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center justify-between text-xs font-medium text-gray-700 mb-1">
                    <span>Temperature</span>
                    <span className="text-primary-600 font-mono">{temperature.toFixed(1)}</span>
                  </label>
                  <input
                    type="range" min={0} max={2} step={0.1} value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0</span><span>1</span><span>2</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">最大重试次数</label>
                  <input
                    type="number" min={0} max={10} value={maxRetry}
                    onChange={(e) => setMaxRetry(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">兜底模型</label>
                  <select
                    value={fallbackModelId} onChange={(e) => setFallbackModelId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  >
                    <option value="">无兜底</option>
                    {models.filter(m => m.name !== modelId).map(m => (
                      <option key={m.id} value={m.name}>{m.name} ({m.vendor})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center justify-between text-xs font-medium text-gray-700 mb-1">
                    <span>人工接管阈值</span>
                    <span className="text-primary-600 font-mono">{takeoverThreshold.toFixed(2)}</span>
                  </label>
                  <input
                    type="range" min={0} max={1} step={0.05} value={takeoverThreshold}
                    onChange={(e) => setTakeoverThreshold(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0</span><span>0.5</span><span>1</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 8: Other Data — Custom JSON (builtin only) */}
            {step === 8 && capabilityMode === 'builtin' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  添加自定义键值对数据，这些数据会存储在智能体配置中，可在工作流中通过 <code className="text-xs bg-gray-100 px-1 rounded">custom</code> 字段访问。
                </p>
                {customPairs.map((pair, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text" value={pair.key}
                      onChange={(e) => setCustomPairs(prev => prev.map((p, i) => i === index ? { ...p, key: e.target.value } : p))}
                      placeholder="键名" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <input
                      type="text" value={pair.value}
                      onChange={(e) => setCustomPairs(prev => prev.map((p, i) => i === index ? { ...p, value: e.target.value } : p))}
                      placeholder="值" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <button
                      onClick={() => setCustomPairs(prev => prev.filter((_, i) => i !== index))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setCustomPairs(prev => [...prev, { key: '', value: '' }])}
                  className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 text-gray-600 text-sm rounded-lg w-full justify-center transition-colors"
                >
                  <Plus size={14} />
                  添加键值对
                </button>
                {customPairs.length === 0 && (
                  <div className="text-center py-6 text-sm text-gray-400">
                    暂无自定义数据，可点击上方按钮添加
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Other Data — docs + media + DB + custom JSON (external only) */}
            {step === 3 && capabilityMode === 'external' && (
              <div className="space-y-4 overflow-y-auto max-h-[420px] pr-1">
                <p className="text-sm text-gray-500">
                  配置天网大脑侧的知识文档、营销素材、公共数据库，这些数据会通过 <code className="text-xs bg-gray-100 px-1 rounded">inputs</code> 注入到外部 Dify 工作流中。
                </p>
                {renderKnowledgeDocsSection(true)}
                <div className="border-t border-gray-100" />
                {renderMediaAssetsSection(true)}
                <div className="border-t border-gray-100" />
                {renderPublicDatabasesSection(true)}
                <div className="border-t border-gray-100" />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <Settings size={14} className="text-gray-400" />
                    自定义数据
                  </h4>
                  <p className="text-xs text-gray-500">
                    添加自定义键值对，会合并到智能体配置的 <code className="text-xs bg-gray-100 px-1 rounded">custom</code> 字段中。
                  </p>
                  {customPairs.map((pair, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text" value={pair.key}
                        onChange={(e) => setCustomPairs(prev => prev.map((p, i) => i === index ? { ...p, key: e.target.value } : p))}
                        placeholder="键名" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                      <input
                        type="text" value={pair.value}
                        onChange={(e) => setCustomPairs(prev => prev.map((p, i) => i === index ? { ...p, value: e.target.value } : p))}
                        placeholder="值" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                      <button
                        onClick={() => setCustomPairs(prev => prev.filter((_, i) => i !== index))}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setCustomPairs(prev => [...prev, { key: '', value: '' }])}
                    className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 text-gray-600 text-sm rounded-lg w-full justify-center transition-colors"
                  >
                    <Plus size={14} />
                    添加键值对
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-white">
          <div className="text-xs text-gray-400">
            步骤 {step} / {maxStep}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {step === 1 ? '取消' : '上一步'}
            </button>
            {step < maxStep ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                下一步
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {mode === 'create' ? '创建智能体' : '保存修改'}
              </button>
            )}
            {/* Quick save button (available on all steps) */}
            {step < maxStep && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                保存
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Agent Card (simplified — click to edit)
// ============================================================
interface AgentCardProps {
  agent: AgentInfo;
  config: AgentConfigItem | undefined;
  models: AIModel[];
  workflowTemplates: WorkflowTemplate[];
  difyConfig: DifyConfig | null;
  onClick: () => void;
  onDelete?: (agentDbId: number) => Promise<void>;
  onShowTip?: (message: string) => void;
  showTenantCount?: boolean;
}

function AgentCard({
  agent, config, models, workflowTemplates, difyConfig,
  onClick, onDelete, onShowTip, showTenantCount = true,
}: AgentCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isExternal = agent.capability_mode === 'external';
  const isCustom = agent.code.startsWith('agent_') || !COLOR_MAP_BY_CODE[agent.code];
  const tenantCount = agent.tenant_count ?? 0;
  const isAssigned = tenantCount > 0;

  const boundModel = models.find(m => m.name === config?.model_id);
  const boundTemplateName = agent.default_workflow_template_name || workflowTemplates.find(t => t.id === agent.default_workflow_template_id)?.name;
  const externalWf = difyConfig?.workflows?.find(w => w.code === agent.external_workflow_code);
  const hasApiKey = !!externalWf?.api_key;

  const docCount = config?.bound_docs?.length ?? 0;
  const imageCount = config?.bound_images?.length ?? 0;
  const dbCount = config?.bound_data_bases?.length ?? 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-primary-300 transition-all group flex flex-col h-[152px]">
      <button onClick={onClick} className="w-full flex-1 p-4 pb-2 flex items-start gap-3 text-left">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-gray-50 border border-gray-100">
          <img
            src={config?.custom_avatar || agent.avatar || getRabbitImageUrl(agent.scarf_color)}
            alt={agent.name}
            className="w-12 h-12 object-contain"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col h-full">
          <h3 className="font-semibold text-sm text-gray-900 truncate">{agent.name}</h3>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-5" style={{ minHeight: '40px' }}>
            {agent.description || agent.role || '暂无简介'}
          </p>
          <div className="flex items-center gap-3 mt-2">
            {isExternal ? (
              <>
                <span className={`inline-flex items-center gap-1 text-[11px] whitespace-nowrap ${hasApiKey ? 'text-emerald-600' : 'text-red-500'}`} title="API Key">
                  <Key size={11} />
                  {hasApiKey ? '已配置' : '未配置'}
                </span>
                {showTenantCount && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap" title="已分配租户">
                    <Building2 size={11} className="text-gray-400" />
                    {tenantCount}家
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap" title="模型配置">
                  <Monitor size={11} className="text-gray-400" />
                  {boundModel ? boundModel.name : '未配置'}
                </span>
                {showTenantCount && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap" title="已分配租户">
                    <Building2 size={11} className="text-gray-400" />
                    {tenantCount}家
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </button>

      <div className="px-4 pb-3 pt-0">
        <div className="border-t border-gray-100" />
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 overflow-hidden">
            {isExternal ? (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap" title="外部工作流">
                <Zap size={12} className="text-gray-400" />
                {agent.external_workflow_code || '未配置'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap" title="工作流">
                <Workflow size={12} className="text-gray-400" />
                {boundTemplateName ? '已配置' : '未配置'}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap" title="知识文档">
              <FileText size={12} className="text-gray-400" />
              {docCount > 0 ? `${docCount}篇` : '未配置'}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap" title="营销素材">
              <ImageIcon size={12} className="text-gray-400" />
              {imageCount > 0 ? `${imageCount}个` : '未配置'}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap" title="数据底座">
              <Database size={12} className="text-gray-400" />
              {dbCount > 0 ? `${dbCount}个` : '未配置'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 pl-2">
            {onDelete && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 rounded"
                    >取消</button>
                    <button
                      onClick={async () => { setShowDeleteConfirm(false); await onDelete(agent.id); }}
                      className="px-1.5 py-0.5 text-[10px] bg-red-600 text-white rounded hover:bg-red-700"
                    >删除</button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (isAssigned) {
                        onShowTip?.(`该智能体已分配给 ${tenantCount} 个租户，需先在租户端收回才能删除`);
                      } else {
                        setShowDeleteConfirm(true);
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </>
            )}
            <button
              onClick={onClick}
              className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
              title="设置"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function Agents() {
  const { state } = useAuth();
  const tenantId = state.tenant?.id ? String(state.tenant.id) : '';

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [configs, setConfigs] = useState<AgentConfigItem[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [difyConfig, setDifyConfig] = useState<DifyConfig | null>(null);
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [connectors, setConnectors] = useState<DataConnector[]>([]);

  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [loadingModels, setLoadingModels] = useState(true);
  const [errorAgents, setErrorAgents] = useState('');
  const [errorConfigs, setErrorConfigs] = useState('');
  const [tip, setTip] = useState<{ message: string; type: 'warning' | 'info' } | null>(null);

  const showTip = useCallback((message: string, type: 'warning' | 'info' = 'warning') => {
    setTip({ message, type });
    setTimeout(() => setTip(null), 4000);
  }, []);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<{ agent: AgentInfo; config?: AgentConfigItem } | null>(null);

  // Fetch all data
  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    setErrorAgents('');
    try {
      const res = await api.getAgents(true);
      setAgents(res.data || []);
    } catch (err) {
      setErrorAgents(err instanceof Error ? err.message : '获取智能体列表失败');
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  const fetchWorkflowTemplates = useCallback(async () => {
    try {
      const res = await api.getWorkflowTemplates(true);
      setWorkflowTemplates(res.data || []);
    } catch { /* Non-critical */ }
  }, []);

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
    } catch { /* Non-critical */ }
    finally { setLoadingModels(false); }
  }, []);

  const fetchDify = useCallback(async () => {
    try {
      const res = await api.getDifyConfig();
      setDifyConfig(res.data);
    } catch { /* Non-critical */ }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await api.getAgentRoles(true);
      setRoles(res.data || []);
    } catch { /* Non-critical */ }
  }, []);

  const fetchKnowledgeDocs = useCallback(async () => {
    try {
      const res = await api.getKnowledgeDocs(tenantId);
      setKnowledgeDocs(res.data || []);
    } catch { /* Non-critical */ }
  }, [tenantId]);

  const fetchMediaAssets = useCallback(async () => {
    try {
      const res = await api.getMediaAssets(tenantId);
      setMediaAssets(res.data || []);
    } catch { /* Non-critical */ }
  }, [tenantId]);

  const fetchConnectors = useCallback(async () => {
    try {
      const res = await api.getConnectors();
      setConnectors(res.data || []);
    } catch { /* Non-critical */ }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchWorkflowTemplates();
    fetchConfigs();
    fetchModels();
    fetchDify();
    fetchRoles();
    fetchKnowledgeDocs();
    fetchMediaAssets();
    fetchConnectors();
  }, [fetchAgents, fetchWorkflowTemplates, fetchConfigs, fetchModels, fetchDify, fetchRoles, fetchKnowledgeDocs, fetchMediaAssets, fetchConnectors]);

  // Refresh data after modal save
  const handleModalSaved = () => {
    fetchAgents();
    fetchConfigs();
    fetchRoles();
    fetchKnowledgeDocs();
  };

  // Delete agent
  const handleDeleteAgent = async (agentDbId: number) => {
    try {
      await api.deleteAgent(agentDbId);
      setAgents(prev => prev.filter(a => a.id !== agentDbId));
    } catch (err) {
      setErrorAgents(err instanceof Error ? err.message : '删除智能体失败');
    }
  };

  const getConfigFor = (code: string) => configs.find(c => c.agent_id === code);

  const builtinAgents = agents.filter(a => a.capability_mode !== 'external');
  const externalAgents = agents.filter(a => a.capability_mode === 'external');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="text-primary-600" size={22} />
            智能体管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">配置与管理 AI 智能体</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          创建智能体
        </button>
      </div>

      {/* Floating tip */}
      {tip && (
        <div className={`rounded-xl p-4 flex items-start gap-2 ${tip.type === 'warning' ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
          <AlertCircle size={18} className={`flex-shrink-0 mt-0.5 ${tip.type === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
          <div>
            <p className={`text-sm font-medium ${tip.type === 'warning' ? 'text-amber-800' : 'text-blue-800'}`}>
              {tip.type === 'warning' ? '无法删除' : '提示'}
            </p>
            <p className={`text-xs mt-0.5 ${tip.type === 'warning' ? 'text-amber-700' : 'text-blue-700'}`}>{tip.message}</p>
          </div>
        </div>
      )}

      {/* Agent Cards Grid */}
      {errorAgents || errorConfigs ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700 font-medium">加载失败</p>
            <p className="text-xs text-red-600 mt-0.5">{errorAgents || errorConfigs}</p>
            <button onClick={() => { fetchAgents(); fetchConfigs(); }} className="mt-2 text-xs text-red-700 underline hover:text-red-800">重试</button>
          </div>
        </div>
      ) : (
        <>
          {loadingAgents && loadingConfigs && loadingModels ? (
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
            <div className="space-y-8">
              {/* 天网大脑智能体 */}
              {builtinAgents.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Bot size={18} className="text-gray-700" />
                    <h2 className="text-base font-semibold text-gray-900">天网大脑智能体</h2>
                    <span className="text-xs text-gray-400">({builtinAgents.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {builtinAgents.map(agent => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        config={getConfigFor(agent.code || agent.agent_id)}
                        models={models}
                        workflowTemplates={workflowTemplates}
                        difyConfig={difyConfig}
                        onClick={() => setEditingAgent({
                          agent,
                          config: getConfigFor(agent.code || agent.agent_id),
                        })}
                        onDelete={handleDeleteAgent}
                        onShowTip={showTip}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 外部平台智能体 */}
              {externalAgents.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={18} className="text-gray-700" />
                    <h2 className="text-base font-semibold text-gray-900">外部平台智能体</h2>
                    <span className="text-xs text-gray-400">({externalAgents.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {externalAgents.map(agent => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        config={getConfigFor(agent.code || agent.agent_id)}
                        models={models}
                        workflowTemplates={workflowTemplates}
                        difyConfig={difyConfig}
                        onClick={() => setEditingAgent({
                          agent,
                          config: getConfigFor(agent.code || agent.agent_id),
                        })}
                        onDelete={handleDeleteAgent}
                        onShowTip={showTip}
                      />
                    ))}
                  </div>
                </section>
              )}

              {builtinAgents.length === 0 && externalAgents.length === 0 && (
                <div className="text-center py-12">
                  <Bot size={48} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">暂无智能体</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                    创建智能体
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Agent Modal */}
      {showCreateModal && (
        <AgentEditModal
          mode="create"
          roles={roles}
          workflowTemplates={workflowTemplates}
          models={models}
          knowledgeDocs={knowledgeDocs}
          mediaAssets={mediaAssets}
          connectors={connectors}
          difyConfig={difyConfig}
          tenantId={tenantId}
          onClose={() => setShowCreateModal(false)}
          onSaved={handleModalSaved}
        />
      )}

      {/* Edit Agent Modal */}
      {editingAgent && (
        <AgentEditModal
          mode="edit"
          agent={editingAgent.agent}
          config={editingAgent.config}
          roles={roles}
          workflowTemplates={workflowTemplates}
          models={models}
          knowledgeDocs={knowledgeDocs}
          mediaAssets={mediaAssets}
          connectors={connectors}
          difyConfig={difyConfig}
          tenantId={tenantId}
          onClose={() => setEditingAgent(null)}
          onSaved={handleModalSaved}
        />
      )}
    </div>
  );
}
