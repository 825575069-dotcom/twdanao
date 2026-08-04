// ============================================================
// YesGo Admin — Tenant Management
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Building2, Plus, Users, Shield, Package, Edit, Trash2, ChevronRight,
  X, Check, AlertCircle, RefreshCw, UserPlus, Save, Info, Bot, Coins,
  Database, Zap,
} from 'lucide-react';
import type { TenantInfo, TenantMember, TenantRole, TenantPackage, AgentInfo, TenantCreditRecord, TenantAgentsData } from '@/types';

// ---- Helpers ---------------------------------------------------------------
function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusBadge(status: TenantInfo['status']) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    active:   { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: '活跃' },
    inactive: { bg: 'bg-gray-50',   text: 'text-gray-600',  dot: 'bg-gray-400',  label: '停用' },
    pending:  { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500', label: '待审核' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function memberStatusBadge(status: 'online' | 'offline') {
  return status === 'online'
    ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />在线</span>
    : <span className="inline-flex items-center gap-1 text-xs text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />离线</span>;
}

// ---- Toast -----------------------------------------------------------------
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  const bg = type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800';
  const Icon = type === 'success' ? Check : AlertCircle;
  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm ${bg} animate-slide-up`}>
      <Icon size={16} />
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={14} /></button>
    </div>
  );
}

// ---- Skeleton --------------------------------------------------------------
function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 grid grid-cols-8 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonBlock key={i} className="h-3" />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-3 border-b border-gray-50 grid grid-cols-8 gap-4">
          {Array.from({ length: 8 }).map((_, j) => <SkeletonBlock key={j} className="h-3" />)}
        </div>
      ))}
    </div>
  );
}

// ---- Database Binding Editor ------------------------------------------------
interface DatabaseBinding {
  name: string;
  type: string;
  description?: string;
  api_url?: string;
  api_key?: string;
}

function DatabaseBindingEditor({ agentId, bindings, onChange }: {
  agentId: string;
  bindings: DatabaseBinding[];
  onChange: (bindings: DatabaseBinding[]) => void;
}) {
  const addBinding = () => {
    onChange([...bindings, { name: '', type: 'erp', api_url: '', api_key: '' }]);
  };

  const removeBinding = (index: number) => {
    onChange(bindings.filter((_, i) => i !== index));
  };

  const updateBinding = (index: number, field: keyof DatabaseBinding, value: string) => {
    const updated = [...bindings];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {bindings.length === 0 && (
        <p className="text-xs text-gray-400 italic">未绑定数据库API（非必绑）</p>
      )}
      {bindings.map((b, i) => (
        <div key={i} className="flex gap-2 items-start bg-gray-50 rounded-lg p-2">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <input
              value={b.name}
              onChange={(e) => updateBinding(i, 'name', e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs"
              placeholder="数据库名称"
            />
            <select
              value={b.type}
              onChange={(e) => updateBinding(i, 'type', e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
            >
              <option value="erp">ERP</option>
              <option value="b2b">B2B</option>
              <option value="b2c">B2C</option>
              <option value="third-party">第三方</option>
            </select>
            <input
              value={b.api_url || ''}
              onChange={(e) => updateBinding(i, 'api_url', e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs col-span-2"
              placeholder="API URL（如 https://api.example.com/v1）"
            />
          </div>
          <button
            onClick={() => removeBinding(i)}
            className="p-1.5 text-red-400 hover:bg-red-50 rounded shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={addBinding}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary-600 border border-primary-200 rounded hover:bg-primary-50"
      >
        <Plus size={12} /> 绑定数据库API
      </button>
    </div>
  );
}

// ---- Create Tenant Modal ---------------------------------------------------
function CreateTenantModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (adminUsername: string, adminPassword: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [platformName, setPlatformName] = useState('');
  const [enterpriseId, setEnterpriseId] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [initialCredits, setInitialCredits] = useState(0);

  // Agent assignment
  const [availableAgents, setAvailableAgents] = useState<AgentInfo[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [agentDbBindings, setAgentDbBindings] = useState<Record<string, DatabaseBinding[]>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setStep(1);
      setCode(''); setName(''); setPlatformName(''); setEnterpriseId('');
      setAdminUsername('admin'); setAdminPassword('admin123'); setAdminPhone('');
      setInitialCredits(0);
      setSelectedAgents([]);
      setAgentDbBindings({});
      setError(''); setFieldErrors({});
      // 加载可用智能体列表
      api.getAgents(true).then(res => {
        setAvailableAgents(res.data.filter(a => a.enabled));
      }).catch(() => {});
    }
  }, [open]);

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!code.trim()) errs.code = '请输入租户编码';
    if (!name.trim()) errs.name = '请输入租户名称';
    if (!platformName.trim()) errs.platformName = '请输入平台名称';
    if (!enterpriseId.trim()) errs.enterpriseId = '请输入企业ID（统一信用代码）';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!adminUsername.trim()) errs.adminUsername = '请输入管理员账号';
    if (!adminPassword.trim()) errs.adminPassword = '请输入管理员密码';
    else if (adminPassword.length < 6) errs.adminPassword = '密码至少 6 位';
    if (!adminPhone.trim()) errs.adminPhone = '请输入管理员手机号';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev => {
      if (prev.includes(agentId)) {
        // 取消选择，清除绑定
        const newBindings = { ...agentDbBindings };
        delete newBindings[agentId];
        setAgentDbBindings(newBindings);
        return prev.filter(id => id !== agentId);
      } else {
        return [...prev, agentId];
      }
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      // 构建 database_bindings 格式
      const databaseBindings: Record<string, Array<{ name: string; type: string; description?: string; config: Record<string, unknown> }>> = {};
      for (const [agentId, bindings] of Object.entries(agentDbBindings)) {
        const valid = bindings.filter(b => b.name.trim());
        if (valid.length > 0) {
          databaseBindings[agentId] = valid.map(b => ({
            name: b.name.trim(),
            type: b.type,
            description: b.description || '',
            config: {
              api_url: b.api_url || '',
              api_key: b.api_key || '',
            },
          }));
        }
      }

      await api.createTenant({
        code: code.trim(),
        name: name.trim(),
        platform_name: platformName.trim(),
        enterprise_id: enterpriseId.trim(),
        admin_username: adminUsername.trim(),
        admin_password: adminPassword,
        admin_phone: adminPhone.trim(),
        initial_credits: initialCredits || undefined,
        agent_codes: selectedAgents.length > 0 ? selectedAgents : undefined,
        database_bindings: Object.keys(databaseBindings).length > 0 ? databaseBindings : undefined,
      });
      onCreated(adminUsername.trim(), adminPassword);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const steps = [
    { num: 1, label: '基础信息' },
    { num: 2, label: '管理员账号' },
    { num: 3, label: '分配智能体' },
    { num: 4, label: '积分设置' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-900">创建租户</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50 shrink-0">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              {i > 0 && <div className={`w-6 h-px ${step > s.num ? 'bg-primary-500' : 'bg-gray-200'}`} />}
              <div className={`flex items-center gap-1.5 ${step === s.num ? 'text-primary-700' : step > s.num ? 'text-green-600' : 'text-gray-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step === s.num ? 'bg-primary-600 text-white' : step > s.num ? 'bg-green-500 text-white' : 'bg-gray-100'
                }`}>
                  {step > s.num ? <Check size={14} /> : s.num}
                </span>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Step 1: 基础信息 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">租户编码</label>
                <input value={code} onChange={(e) => { setCode(e.target.value); setFieldErrors(prev => ({ ...prev, code: '' })); }}
                  className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.code ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="例如: tenant_001" disabled={submitting} />
                {fieldErrors.code && <p className="text-xs text-red-500 mt-1">{fieldErrors.code}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">租户名称</label>
                <input value={name} onChange={(e) => { setName(e.target.value); setFieldErrors(prev => ({ ...prev, name: '' })); }}
                  className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.name ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="例如: 总部运维中心" disabled={submitting} />
                {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">平台名称</label>
                <input value={platformName} onChange={(e) => { setPlatformName(e.target.value); setFieldErrors(prev => ({ ...prev, platformName: '' })); }}
                  className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.platformName ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="例如: 天网智能平台" disabled={submitting} />
                {fieldErrors.platformName && <p className="text-xs text-red-500 mt-1">{fieldErrors.platformName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">企业ID（统一信用代码）</label>
                <input value={enterpriseId} onChange={(e) => { setEnterpriseId(e.target.value); setFieldErrors(prev => ({ ...prev, enterpriseId: '' })); }}
                  className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.enterpriseId ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="例如: 91440101MA5xxxx" disabled={submitting} />
                {fieldErrors.enterpriseId && <p className="text-xs text-red-500 mt-1">{fieldErrors.enterpriseId}</p>}
              </div>
            </div>
          )}

          {/* Step 2: 管理员账号 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">管理员账号</label>
                  <input value={adminUsername} onChange={(e) => { setAdminUsername(e.target.value); setFieldErrors(prev => ({ ...prev, adminUsername: '' })); }}
                    className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.adminUsername ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="admin" disabled={submitting} />
                  {fieldErrors.adminUsername && <p className="text-xs text-red-500 mt-1">{fieldErrors.adminUsername}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">管理员密码</label>
                  <input type="password" value={adminPassword} onChange={(e) => { setAdminPassword(e.target.value); setFieldErrors(prev => ({ ...prev, adminPassword: '' })); }}
                    className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.adminPassword ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="默认 admin123" disabled={submitting} />
                  {fieldErrors.adminPassword && <p className="text-xs text-red-500 mt-1">{fieldErrors.adminPassword}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">管理员手机号</label>
                <input value={adminPhone} onChange={(e) => { setAdminPhone(e.target.value); setFieldErrors(prev => ({ ...prev, adminPhone: '' })); }}
                  className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.adminPhone ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="用于密码找回" disabled={submitting} />
                {fieldErrors.adminPhone && <p className="text-xs text-red-500 mt-1">{fieldErrors.adminPhone}</p>}
              </div>
              <p className="text-xs text-gray-400 bg-blue-50 rounded-lg px-3 py-2 flex items-start gap-2">
                <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <span>创建成功后，可使用该账号登录第三层 YesGo。租户管理员拥有除智能体数量外的所有权限。</span>
              </p>
            </div>
          )}

          {/* Step 3: 分配智能体 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">分配智能体</h4>
                <span className="text-xs text-gray-400">已选 {selectedAgents.length} 个</span>
              </div>
              <p className="text-xs text-gray-400 bg-amber-50 rounded-lg px-3 py-2 flex items-start gap-2">
                <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <span>勾选要分配给此租户的智能体。每个智能体可绑定租户私有数据库API（非必绑）。租户登录后只能看到已分配的智能体。</span>
              </p>
              {availableAgents.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">暂无可用智能体，请先在智能体管理中创建</p>
              ) : (
                <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                  {availableAgents.map(agent => {
                    const isSelected = selectedAgents.includes(agent.agent_id);
                    const bindings = agentDbBindings[agent.agent_id] || [];
                    return (
                      <div key={agent.agent_id} className={`border rounded-lg transition-all ${isSelected ? 'border-primary-300 bg-primary-50/30' : 'border-gray-200'}`}>
                        <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAgent(agent.agent_id)}
                            className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{agent.name}</span>
                              <span className="text-xs text-gray-400 font-mono">{agent.agent_id}</span>
                            </div>
                            {agent.role && <p className="text-xs text-gray-500">{agent.role}</p>}
                          </div>
                        </label>
                        {isSelected && (
                          <div className="px-3 pb-3 border-t border-primary-100 pt-3">
                            <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-gray-600">
                              <Database size={12} /> 绑定租户私有数据库API
                            </div>
                            <DatabaseBindingEditor
                              agentId={agent.agent_id}
                              bindings={bindings}
                              onChange={(newBindings) => setAgentDbBindings(prev => ({ ...prev, [agent.agent_id]: newBindings }))}
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

          {/* Step 4: 积分设置 */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">初始积分余额</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={initialCredits}
                    onChange={(e) => setInitialCredits(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    min={0}
                    disabled={submitting}
                  />
                  <span className="text-sm text-gray-400">积分</span>
                </div>
                <p className="text-xs text-gray-400 mt-2 flex items-start gap-1.5">
                  <Coins size={12} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>租户积分用于智能体调用消费。可后续在租户详情中充值。填 0 则不分配初始积分。</span>
                </p>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <h5 className="font-medium text-gray-700 mb-2">创建摘要</h5>
                <div className="flex justify-between"><span className="text-gray-500">租户编码</span><span className="text-gray-900 font-medium">{code || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">租户名称</span><span className="text-gray-900 font-medium">{name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">管理员</span><span className="text-gray-900 font-medium">{adminUsername || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">分配智能体</span><span className="text-gray-900 font-medium">{selectedAgents.length} 个</span></div>
                <div className="flex justify-between"><span className="text-gray-500">初始积分</span><span className="text-gray-900 font-medium">{initialCredits.toLocaleString()}</span></div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100 shrink-0">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {step > 1 ? '上一步' : '取消'}
          </button>
          {step < 4 ? (
            <button
              onClick={() => {
                if (step === 1 && !validateStep1()) return;
                if (step === 2 && !validateStep2()) return;
                setStep(step + 1);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              下一步 <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  创建中...
                </>
              ) : (
                <>
                  <Check size={14} /> 确认创建
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Add Member Modal ------------------------------------------------------
function AddMemberModal({ open, onClose, onAdded, tenantId, roles }: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  tenantId: string;
  roles: { id: number; name: string }[];
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState<number>(roles[0]?.id || 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setUsername(''); setPassword(''); setPhone(''); setRoleId(roles[0]?.id || 0); setError(''); setFieldErrors({});
    }
  }, [open, roles]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = '请输入用户名';
    if (!password.trim()) errs.password = '请输入密码';
    if (!phone.trim()) errs.phone = '请输入手机号';
    if (!roleId) errs.roleId = '请选择角色';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createMember(tenantId, { username: username.trim(), password: password.trim(), phone: phone.trim(), role_id: roleId });
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加成员失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">添加成员</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
            <input value={username} onChange={(e) => { setUsername(e.target.value); setFieldErrors(prev => ({ ...prev, username: '' })); }}
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.username ? 'border-red-300' : 'border-gray-300'}`} disabled={submitting} />
            {fieldErrors.username && <p className="text-xs text-red-500 mt-1">{fieldErrors.username}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })); }}
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.password ? 'border-red-300' : 'border-gray-300'}`} disabled={submitting} />
            {fieldErrors.password && <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">手机号</label>
            <input value={phone} onChange={(e) => { setPhone(e.target.value); setFieldErrors(prev => ({ ...prev, phone: '' })); }}
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 ${fieldErrors.phone ? 'border-red-300' : 'border-gray-300'}`}
              placeholder="用于密码找回" disabled={submitting} />
            {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">角色</label>
            <select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white" disabled={submitting}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              {roles.length === 0 && <option value={0} disabled>暂无可用角色</option>}
            </select>
            {fieldErrors.roleId && <p className="text-xs text-red-500 mt-1">{fieldErrors.roleId}</p>}
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">取消</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
            {submitting ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>添加中...</> : <><UserPlus size={14} />添加</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Edit Member Modal ------------------------------------------------------
function EditMemberModal({ open, onClose, onUpdated, tenantId, member, roles }: {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  tenantId: string;
  member: TenantMember | null;
  roles: { id: number; name: string; code: string }[];
}) {
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && member) {
      setPassword('');
      setPhone(member.phone || '');
      const currentRole = roles.find(r => r.code === member.role_code);
      setRoleId(currentRole?.id || roles[0]?.id || 0);
      setError('');
    }
  }, [open, member, roles]);

  if (!open || !member) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const data: Record<string, unknown> = { role_id: roleId, phone: phone.trim() };
      if (password.trim()) {
        data.password = password.trim();
      }
      await api.updateMember(tenantId, member.id, data);
      onUpdated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新成员失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">编辑成员</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
            <input value={member.username} readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">新密码 <span className="text-gray-400 font-normal">（留空则不修改）</span></label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="留空则不修改密码"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" disabled={submitting} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">手机号</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="用于密码找回"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" disabled={submitting} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">角色</label>
            <select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white" disabled={submitting}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              {roles.length === 0 && <option value={0} disabled>暂无可用角色</option>}
            </select>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">取消</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
            {submitting ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>保存中...</> : <><Save size={14} />保存</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Recharge Modal --------------------------------------------------------
function RechargeModal({ open, onClose, onRecharged, tenantId, currentBalance }: {
  open: boolean;
  onClose: () => void;
  onRecharged: () => void;
  tenantId: string;
  currentBalance: number;
}) {
  const [amount, setAmount] = useState(1000);
  const [reason, setReason] = useState('管理员充值');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setAmount(1000);
      setReason('管理员充值');
      setError('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (amount <= 0) {
      setError('充值金额必须为正整数');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.rechargeTenantCredits(tenantId, amount, reason);
      onRecharged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '充值失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">积分充值</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-2">
            <Coins size={16} className="text-amber-500" />
            <span className="text-sm text-amber-700">当前余额：{currentBalance.toLocaleString()} 积分</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">充值金额</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
              min={1}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">充值说明</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="充值说明"
              disabled={submitting}
            />
          </div>
          <div className="flex gap-2">
            {[1000, 5000, 10000, 50000].map(v => (
              <button key={v} onClick={() => setAmount(v)} disabled={submitting}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600">
                {v.toLocaleString()}
              </button>
            ))}
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">取消</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
            {submitting ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>充值中...</> : <><Zap size={14} />确认充值</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Detail Panel ----------------------------------------------------------
function TenantDetailPanel({ tenantId, onClose }: {
  tenantId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'info' | 'agents' | 'members' | 'roles' | 'package' | 'credits'>('info');

  // Info
  const [info, setInfo] = useState<TenantInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState('');
  const [infoEditing, setInfoEditing] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: '', platform_name: '', province: '', city: '', channel: '' });
  const [infoSaving, setInfoSaving] = useState(false);

  // Agents
  const [agentsData, setAgentsData] = useState<TenantAgentsData | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [agentDbBindings, setAgentDbBindings] = useState<Record<string, DatabaseBinding[]>>({});
  const [agentsSaving, setAgentsSaving] = useState(false);

  // Members
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditMember, setShowEditMember] = useState(false);
  const [editingMember, setEditingMember] = useState<TenantMember | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<number | null>(null);

  // Roles
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState('');

  // Package
  const [pkg, setPkg] = useState<TenantPackage | null>(null);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [pkgError, setPkgError] = useState('');

  // Credits
  const [creditsData, setCreditsData] = useState<{ balance: number; ledger: TenantCreditRecord[] } | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsError, setCreditsError] = useState('');
  const [showRecharge, setShowRecharge] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchInfo = useCallback(async () => {
    setInfoLoading(true); setInfoError('');
    try {
      const res = await api.getTenantInfo(tenantId);
      setInfo(res.data);
      setInfoForm({ name: res.data.name, platform_name: res.data.platform_name, province: res.data.province || '', city: res.data.city || '', channel: res.data.channel || '' });
    } catch (e) {
      setInfoError(e instanceof Error ? e.message : '获取租户信息失败');
    } finally { setInfoLoading(false); }
  }, [tenantId]);

  const fetchAgents = useCallback(async () => {
    setAgentsLoading(true); setAgentsError('');
    try {
      const res = await api.getTenantAgents(tenantId);
      setAgentsData(res.data);
      setSelectedAgents(res.data.assigned);
      // 初始化数据底座绑定（兼容后端未返回 bindings 的旧数据）
      const bindings = res.data.bindings || {};
      setAgentDbBindings(
        Object.fromEntries(
          Object.entries(bindings).map(([agentId, list]) => [
            agentId,
            (list || []).map(b => ({
              name: b.name || '',
              type: b.type || 'erp',
              description: b.description || '',
              api_url: b.api_url || '',
              api_key: b.api_key || '',
            })),
          ])
        )
      );
    } catch (e) {
      setAgentsError(e instanceof Error ? e.message : '获取智能体列表失败');
    } finally { setAgentsLoading(false); }
  }, [tenantId]);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true); setMembersError('');
    try {
      const res = await api.getTenantMembers(tenantId);
      setMembers(res.data);
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : '获取成员列表失败');
    } finally { setMembersLoading(false); }
  }, [tenantId]);

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true); setRolesError('');
    try {
      const res = await api.getTenantRoles(tenantId);
      setRoles(res.data);
    } catch (e) {
      setRolesError(e instanceof Error ? e.message : '获取角色列表失败');
    } finally { setRolesLoading(false); }
  }, [tenantId]);

  const fetchPackage = useCallback(async () => {
    setPkgLoading(true); setPkgError('');
    try {
      const res = await api.getTenantPackage(tenantId);
      setPkg(res.data);
    } catch (e) {
      setPkgError(e instanceof Error ? e.message : '获取套餐信息失败');
    } finally { setPkgLoading(false); }
  }, [tenantId]);

  const fetchCredits = useCallback(async () => {
    setCreditsLoading(true); setCreditsError('');
    try {
      const res = await api.getTenantCredits(tenantId);
      setCreditsData(res.data);
    } catch (e) {
      setCreditsError(e instanceof Error ? e.message : '获取积分信息失败');
    } finally { setCreditsLoading(false); }
  }, [tenantId]);

  useEffect(() => { fetchInfo(); fetchAgents(); fetchMembers(); fetchRoles(); fetchPackage(); fetchCredits(); }, [fetchInfo, fetchAgents, fetchMembers, fetchRoles, fetchPackage, fetchCredits]);

  const handleSaveInfo = async () => {
    setInfoSaving(true);
    try {
      await api.updateTenant(tenantId, infoForm);
      await fetchInfo();
      setInfoEditing(false);
      showToast('租户信息已更新', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '更新失败', 'error');
    } finally { setInfoSaving(false); }
  };

  const handleSaveAgents = async () => {
    setAgentsSaving(true);
    try {
      // 仅提交已分配智能体的数据底座绑定
      const databaseBindings: Record<string, Array<{ name: string; type: string; description?: string; config: Record<string, unknown> }>> = {};
      for (const agentId of selectedAgents) {
        const bindings = (agentDbBindings[agentId] || []).filter(b => b.name.trim());
        if (bindings.length > 0) {
          databaseBindings[agentId] = bindings.map(b => ({
            name: b.name.trim(),
            type: b.type,
            description: b.description || '',
            config: {
              api_url: b.api_url || '',
              api_key: b.api_key || '',
            },
          }));
        }
      }

      await api.updateTenantAgents(
        tenantId,
        selectedAgents,
        Object.keys(databaseBindings).length > 0 ? databaseBindings : undefined
      );
      await fetchAgents();
      showToast('智能体分配已更新', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '更新失败', 'error');
    } finally { setAgentsSaving(false); }
  };

  const handleDeleteMember = async (memberId: number) => {
    setDeletingMemberId(memberId);
    try {
      await api.deleteMember(tenantId, memberId);
      await fetchMembers();
      showToast('成员已删除', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败', 'error');
    } finally { setDeletingMemberId(null); }
  };

  const handleEditMember = (member: TenantMember) => {
    setEditingMember(member);
    setShowEditMember(true);
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev => {
      if (prev.includes(agentId)) {
        // 取消分配时同步清理该智能体的数据底座绑定
        setAgentDbBindings(b => {
          const next = { ...b };
          delete next[agentId];
          return next;
        });
        return prev.filter(id => id !== agentId);
      }
      // 新分配时确保该 key 存在（空数组即可）
      setAgentDbBindings(b => ({ ...b, [agentId]: b[agentId] || [] }));
      return [...prev, agentId];
    });
  };

  const tabs = [
    { id: 'info' as const, label: '基本信息', icon: Info },
    { id: 'agents' as const, label: '智能体', icon: Bot },
    { id: 'members' as const, label: '成员管理', icon: Users },
    { id: 'roles' as const, label: '角色权限', icon: Shield },
    { id: 'package' as const, label: '套餐配额', icon: Package },
    { id: 'credits' as const, label: '积分管理', icon: Coins },
  ];

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <RechargeModal
        open={showRecharge}
        onClose={() => setShowRecharge(false)}
        onRecharged={() => { fetchCredits(); fetchInfo(); }}
        tenantId={tenantId}
        currentBalance={creditsData?.balance || 0}
      />
      <div className="fixed inset-0 z-40">
        <div className="absolute inset-0 bg-black/20" onClick={onClose} />
        <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl overflow-hidden flex flex-col animate-slide-left">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-primary-600" />
              <h3 className="font-semibold text-gray-900 text-sm">租户详情</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 shrink-0 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* ---- Info Tab ---- */}
            {tab === 'info' && (
              infoLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-10 w-full" />)}</div> :
              infoError ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{infoError}</div> :
              info ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700">租户信息</h4>
                    <button onClick={() => setInfoEditing(!infoEditing)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50">
                      {infoEditing ? <X size={13} /> : <Edit size={13} />}
                      {infoEditing ? '取消' : '编辑'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">租户编码</span>
                      <p className="text-gray-900 font-medium mt-0.5">{info.code}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">状态</span>
                      <p className="mt-0.5">{statusBadge(info.status)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">名称</span>
                      {infoEditing ? (
                        <input value={infoForm.name} onChange={e => setInfoForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      ) : <p className="text-gray-900 font-medium mt-0.5">{info.name}</p>}
                    </div>
                    <div>
                      <span className="text-gray-400">平台名称</span>
                      {infoEditing ? (
                        <input value={infoForm.platform_name} onChange={e => setInfoForm(f => ({ ...f, platform_name: e.target.value }))}
                          className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      ) : <p className="text-gray-900 font-medium mt-0.5">{info.platform_name}</p>}
                    </div>
                    <div>
                      <span className="text-gray-400">企业ID</span>
                      <p className="text-gray-900 font-medium mt-0.5 font-mono text-xs">{info.enterprise_id || '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">省份</span>
                      {infoEditing ? (
                        <input value={infoForm.province} onChange={e => setInfoForm(f => ({ ...f, province: e.target.value }))}
                          className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="如：广东" />
                      ) : <p className="text-gray-900 font-medium mt-0.5">{info.province || '—'}</p>}
                    </div>
                    <div>
                      <span className="text-gray-400">城市</span>
                      {infoEditing ? (
                        <input value={infoForm.city} onChange={e => setInfoForm(f => ({ ...f, city: e.target.value }))}
                          className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="如：广州" />
                      ) : <p className="text-gray-900 font-medium mt-0.5">{info.city || '—'}</p>}
                    </div>
                    <div>
                      <span className="text-gray-400">客户渠道</span>
                      {infoEditing ? (
                        <select value={infoForm.channel} onChange={e => setInfoForm(f => ({ ...f, channel: e.target.value }))}
                          className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                          <option value="">未设置</option>
                          <option value="clinic">诊所</option>
                          <option value="pharmacy">药店</option>
                          <option value="hospital">医院</option>
                        </select>
                      ) : (
                        <p className="text-gray-900 font-medium mt-0.5">
                          {info.channel_display || (info.channel === 'clinic' ? '诊所' : info.channel === 'pharmacy' ? '药店' : info.channel === 'hospital' ? '医院' : '—')}
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-400">积分余额</span>
                      <p className="text-gray-900 font-medium mt-0.5 flex items-center gap-1">
                        <Coins size={14} className="text-amber-500" />
                        {(info.credits ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">创建人</span>
                      <p className="text-gray-900 mt-0.5">{info.created_by || '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">创建时间</span>
                      <p className="text-gray-900 mt-0.5">{formatDateTime(info.created_at)}</p>
                    </div>
                  </div>

                  {infoEditing && (
                    <button onClick={handleSaveInfo} disabled={infoSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50">
                      {infoSaving ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>保存中...</> : <><Save size={14} />保存</>}
                    </button>
                  )}
                </div>
              ) : null
            )}

            {/* ---- Agents Tab ---- */}
            {tab === 'agents' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">智能体分配</h4>
                  <button onClick={handleSaveAgents} disabled={agentsSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50">
                    {agentsSaving ? <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>保存中</> : <><Save size={13} />保存分配</>}
                  </button>
                </div>
                {agentsLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-16 w-full" />)}</div> :
                 agentsError ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{agentsError}</div> :
                 !agentsData || agentsData.available.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">暂无可用智能体</p> : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">已选 {selectedAgents.length} / {agentsData.available.length} 个智能体</p>
                    {agentsData.available.map(agent => {
                      const isSelected = selectedAgents.includes(agent.agent_id);
                      return (
                        <div key={agent.agent_id} className={`border rounded-lg transition-all ${isSelected ? 'border-primary-300 bg-primary-50/30' : 'border-gray-200 hover:bg-gray-50'}`}>
                          <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAgent(agent.agent_id)}
                              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Bot size={14} className="text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">{agent.name}</span>
                                <span className="text-xs text-gray-400 font-mono">{agent.agent_id}</span>
                              </div>
                              {agent.role && <p className="text-xs text-gray-500 mt-0.5">{agent.role}</p>}
                            </div>
                          </label>
                          {isSelected && (
                            <div className="px-3 pb-3 pt-0">
                              <div className="border-t border-primary-100 my-2" />
                              <DatabaseBindingEditor
                                agentId={agent.agent_id}
                                bindings={agentDbBindings[agent.agent_id] || []}
                                onChange={(newBindings) => setAgentDbBindings(prev => ({ ...prev, [agent.agent_id]: newBindings }))}
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

            {/* ---- Members Tab ---- */}
            {tab === 'members' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">成员列表</h4>
                  <button onClick={() => setShowAddMember(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg">
                    <UserPlus size={13} /> 添加成员
                  </button>
                </div>

                {membersLoading ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-10 w-full" />)}</div> :
                 membersError ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{membersError}</div> :
                 members.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">暂无成员数据</p> : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">用户名</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">手机号</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">角色</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">积分</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">状态</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {members.map(m => (
                          <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2.5 font-medium text-gray-900">{m.username}</td>
                            <td className="px-3 py-2.5 text-gray-500">{m.phone || '-'}</td>
                            <td className="px-3 py-2.5 text-gray-600">{m.role_name}</td>
                            <td className="px-3 py-2.5 text-gray-900">{m.credits}</td>
                            <td className="px-3 py-2.5">{memberStatusBadge(m.status)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                <button onClick={() => handleEditMember(m)}
                                  className="p-1 rounded hover:bg-blue-50 text-blue-500" title="编辑成员">
                                  <Edit size={14} />
                                </button>
                                <button onClick={() => handleDeleteMember(m.id)} disabled={deletingMemberId === m.id}
                                  className="p-1 rounded hover:bg-red-50 text-red-500 disabled:opacity-50" title="删除成员">
                                  {deletingMemberId === m.id ? <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <Trash2 size={14} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)}
                  onAdded={fetchMembers} tenantId={tenantId}
                  roles={roles.map(r => ({ id: r.id, name: r.name }))} />
                <EditMemberModal open={showEditMember} onClose={() => setShowEditMember(false)}
                  onUpdated={fetchMembers} tenantId={tenantId} member={editingMember}
                  roles={roles.map(r => ({ id: r.id, name: r.name, code: r.code }))} />
              </div>
            )}

            {/* ---- Roles Tab ---- */}
            {tab === 'roles' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">角色权限</h4>
                {rolesLoading ? <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <SkeletonBlock key={i} className="h-24 w-full" />)}</div> :
                 rolesError ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{rolesError}</div> :
                 roles.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">暂无角色数据</p> : (
                  <div className="space-y-3">
                    {roles.map(role => (
                      <div key={role.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h5 className="font-medium text-gray-900 text-sm">{role.name}</h5>
                            <p className="text-xs text-gray-400">{role.code}</p>
                          </div>
                          <span className="text-xs text-gray-500">{role.description}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${role.can_manage_members ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                            {role.can_manage_members ? <Check size={12} className="mr-0.5" /> : <X size={12} className="mr-0.5" />}
                            管理成员
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${role.can_assign_credits ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                            {role.can_assign_credits ? <Check size={12} className="mr-0.5" /> : <X size={12} className="mr-0.5" />}
                            分配积分
                          </span>
                        </div>
                        {role.agents.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-50">
                            <p className="text-xs text-gray-400 mb-1.5">可用智能体</p>
                            <div className="flex flex-wrap gap-1">
                              {role.agents.map(a => (
                                <span key={a} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">{a}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- Package Tab ---- */}
            {tab === 'package' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">套餐配额</h4>
                {pkgLoading ? <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1.5"><SkeletonBlock className="h-3 w-24" /><SkeletonBlock className="h-3 w-16" /></div>
                    <SkeletonBlock className="h-2.5 w-full rounded-full" />
                  </div>))}</div> :
                 pkgError ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{pkgError}</div> :
                 !pkg || pkg.quotas.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">暂无套餐数据</p> : (
                  <div className="space-y-5">
                    <div>
                      <span className="text-sm text-gray-900 font-medium">{pkg.name}</span>
                    </div>
                    {pkg.quotas.map(q => {
                      const pct = q.monthly > 0 ? Math.min((q.used / q.monthly) * 100, 100) : 0;
                      const barColor = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-green-500';
                      return (
                        <div key={q.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-gray-700 font-medium">{q.agent_code}</span>
                            <span className="text-xs text-gray-500">
                              {q.used.toLocaleString()}<span className="text-gray-300"> / </span>{q.monthly.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---- Credits Tab ---- */}
            {tab === 'credits' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">积分管理</h4>
                  <button onClick={() => setShowRecharge(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg">
                    <Zap size={13} /> 积分充值
                  </button>
                </div>
                {creditsLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-10 w-full" />)}</div> :
                 creditsError ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{creditsError}</div> :
                 !creditsData ? null : (
                  <>
                    {/* Balance Card */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-amber-600 font-medium">积分余额</p>
                          <p className="text-3xl font-bold text-amber-900 mt-1">{creditsData.balance.toLocaleString()}</p>
                        </div>
                        <Coins size={36} className="text-amber-400" />
                      </div>
                    </div>

                    {/* Ledger */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">充值/消费记录</h5>
                      {creditsData.ledger.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">暂无记录</p>
                      ) : (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-3 py-2 text-gray-500 font-medium">时间</th>
                                <th className="text-left px-3 py-2 text-gray-500 font-medium">说明</th>
                                <th className="text-right px-3 py-2 text-gray-500 font-medium">变动</th>
                                <th className="text-right px-3 py-2 text-gray-500 font-medium">余额</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {creditsData.ledger.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-gray-500 text-xs">{formatDateTime(r.created_at)}</td>
                                  <td className="px-3 py-2 text-gray-700">{r.reason}</td>
                                  <td className={`px-3 py-2 text-right font-medium ${r.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {r.amount > 0 ? '-' : '+'}{Math.abs(r.amount).toLocaleString()}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-600">{r.balance_after.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Tenants Page
// ============================================================
export default function Tenants() {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserName, setCurrentUserName] = useState<string>('当前用户');

  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await api.me();
      const user = res.data.user;
      setCurrentUserName(user?.name || '当前用户');
    } catch {
      // 忽略错误，使用默认值
    }
  }, []);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getTenants();
      setTenants(res.data.tenants);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取租户列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCurrentUser(); fetchTenants(); }, [fetchCurrentUser, fetchTenants]);

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="p-6 space-y-5">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">租户管理</h1>
            <p className="text-sm text-gray-500 mt-0.5">管理平台所有租户及其智能体、成员、积分和配额</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchTenants}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} /> 刷新
            </button>
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm">
              <Plus size={16} /> 创建租户
            </button>
          </div>
        </div>

        {/* Tenant List */}
        {loading ? (
          <TableSkeleton rows={5} />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700 flex items-center gap-3">
            <AlertCircle size={18} />
            <div>
              <p className="font-medium">{error}</p>
              <button onClick={fetchTenants} className="text-primary-600 hover:underline mt-1 text-xs">点击重试</button>
            </div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center justify-center text-gray-400">
            <Building2 size={40} className="mb-3" />
            <p className="text-sm font-medium">暂无租户数据</p>
            <p className="text-xs mt-1">点击右上角按钮创建第一个租户</p>
            <button onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg">
              <Plus size={14} /> 创建租户
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">租户编码</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">名称</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">企业ID</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">智能体</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">积分余额</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">状态</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">创建人</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">创建时间</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tenants.map((t) => (
                    <tr key={t.id}
                      onClick={() => setSelectedId(String(t.id))}
                      className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-5 py-3 text-gray-900 font-mono text-xs">{t.code}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{t.enterprise_id || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <Bot size={13} className="text-gray-400" />
                          {t.agent_count ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 text-gray-900">
                          <Coins size={13} className="text-amber-500" />
                          {(t.credits ?? 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-3">{statusBadge(t.status)}</td>
                      <td className="px-5 py-3 text-gray-700 text-xs">{t.created_by || '—'}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDateTime(t.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedId(String(t.id)); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors">
                          详情 <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateTenantModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(adminUsername, adminPassword) => {
          fetchTenants();
          showToast(`租户创建成功，管理员：${adminUsername} / ${adminPassword}`, 'success');
        }}
      />

      {/* Detail Panel */}
      {selectedId && (
        <TenantDetailPanel tenantId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
