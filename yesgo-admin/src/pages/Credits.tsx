// ============================================================
// YesGo Admin — 积分管理
// 基础设置 / 套餐管理 / 智能体消耗配置 / 购买记录 / 租户充值 / 收入统计
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import {
  Coins, Plus, Trash2, Edit2, X, Check, XCircle,
  TrendingUp, Package, Settings, ShoppingCart, Wallet, BarChart3,
  AlertCircle, Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import type {
  CreditConfig, CreditPackage, AgentCreditRule,
  CreditOrder, CreditStats, TenantInfo,
} from '@/types';

/* ---------- 通用组件 ---------- */

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  if (!message) return null;
  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
        type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
      }`}
    >
      {message}
    </div>
  );
}

function Modal({ open, title, onClose, children, maxWidth }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; maxWidth?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-xl w-full ${maxWidth || 'max-w-lg'} mx-4 max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-blue-50 text-blue-700 border-blue-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

/* ---------- Tab 定义 ---------- */

const TABS = [
  { id: 'config', label: '基础设置', icon: Settings },
  { id: 'packages', label: '套餐管理', icon: Package },
  { id: 'agent-rules', label: '智能体消耗配置', icon: Coins },
  { id: 'orders', label: '购买记录', icon: ShoppingCart },
  { id: 'recharge', label: '租户充值', icon: Wallet },
  { id: 'stats', label: '收入统计', icon: BarChart3 },
];

/* ============================================================
 * 主组件
 * ============================================================ */
export default function Credits() {
  const [activeTab, setActiveTab] = useState('config');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' }>({ message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type }), 3000);
  };

  return (
    <div className="p-6 space-y-4">
      <Toast {...toast} />

      {/* 页头 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
          <Coins size={22} className="text-primary-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">积分管理</h1>
          <p className="text-sm text-gray-500">配置积分消耗规则、销售价格、收入管理与租户充值</p>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {activeTab === 'config' && <ConfigTab showToast={showToast} />}
        {activeTab === 'packages' && <PackagesTab showToast={showToast} />}
        {activeTab === 'agent-rules' && <AgentRulesTab showToast={showToast} />}
        {activeTab === 'orders' && <OrdersTab showToast={showToast} />}
        {activeTab === 'recharge' && <RechargeTab showToast={showToast} />}
        {activeTab === 'stats' && <StatsTab showToast={showToast} />}
      </div>
    </div>
  );
}

/* ============================================================
 * Tab 1: 基础设置
 * ============================================================ */
function ConfigTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [config, setConfig] = useState<CreditConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CreditConfig>>({});

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCreditConfig();
      setConfig(res.data);
      setForm(res.data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateCreditConfig(form);
      showToast('配置已保存');
      loadConfig();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">积分兑换规则</h3>
        <p className="text-sm text-gray-500 mb-4">配置积分与 Token 的兑换比例及基础参数</p>
      </div>

      {/* 积分兑换 Token */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">1 积分 = ? Token</label>
          <input
            type="number"
            value={form.tokens_per_credit ?? ''}
            onChange={e => setForm({ ...form, tokens_per_credit: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">租户每次调用消耗 Token 数 ÷ 此值 = 扣除积分数</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">积分单价（元/积分）</label>
          <input
            type="number"
            step="0.01"
            value={form.unit_price ?? ''}
            onChange={e => setForm({ ...form, unit_price: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">自定义购买数量时的单价</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">注册赠送积分</label>
          <input
            type="number"
            value={form.free_credits_on_register ?? ''}
            onChange={e => setForm({ ...form, free_credits_on_register: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">最小购买积分</label>
          <input
            type="number"
            value={form.min_purchase_credits ?? ''}
            onChange={e => setForm({ ...form, min_purchase_credits: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 支付方式 */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">支付方式</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enable_offline_pay ?? false}
              onChange={e => setForm({ ...form, enable_offline_pay: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">公对公转账</span>
              <p className="text-xs text-gray-400">租户线下转账后由管理员确认到账</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enable_online_pay ?? false}
              onChange={e => setForm({ ...form, enable_online_pay: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">在线支付</span>
              <p className="text-xs text-gray-400">接入微信/支付宝等在线支付渠道（后续开放）</p>
            </div>
          </label>
        </div>
      </div>

      {/* 说明卡片 */}
      <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
        <div className="flex gap-2">
          <AlertCircle size={16} className="text-primary-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-primary-700">
            <p className="font-medium mb-1">积分扣减逻辑</p>
            <p>智能体每次调用消耗的积分 = Token 消耗量 ÷ {form.tokens_per_credit || 1000} × 智能体消耗系数</p>
            <p>免扣积分的智能体调用不消耗积分（如采购兔默认免扣）</p>
            <p>租户积分余额不足时，将拦截调用请求</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存配置'}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
 * Tab 2: 套餐管理
 * ============================================================ */
function PackagesTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<CreditPackage | null>(null);
  const [form, setForm] = useState<Partial<CreditPackage>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCreditPackages();
      setPackages(res.data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingPkg(null);
    setForm({ credits: 1000, price: '100', bonus_credits: 0, is_popular: false, enabled: true, sort_order: 0 });
    setModalOpen(true);
  };

  const openEdit = (pkg: CreditPackage) => {
    setEditingPkg(pkg);
    setForm({ ...pkg });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.credits || !form.price) {
      showToast('请填写名称、积分数量和价格', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingPkg) {
        await api.updateCreditPackage(editingPkg.id, form);
        showToast('套餐已更新');
      } else {
        await api.createCreditPackage(form);
        showToast('套餐已创建');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此套餐？')) return;
    try {
      await api.deleteCreditPackage(id);
      showToast('套餐已删除');
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败', 'error');
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">积分套餐</h3>
          <p className="text-sm text-gray-500">配置租户可购买的积分套餐包</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} /> 新增套餐
        </button>
      </div>

      {packages.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无套餐，点击「新增套餐」创建</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map(pkg => (
            <div
              key={pkg.id}
              className={`relative border-2 rounded-xl p-4 transition-all ${
                pkg.is_popular ? 'border-primary-300 bg-primary-50/30' : 'border-gray-200'
              } ${!pkg.enabled ? 'opacity-50' : ''}`}
            >
              {pkg.is_popular && (
                <span className="absolute -top-2 left-4 px-2 py-0.5 bg-primary-600 text-white text-xs font-medium rounded-full">
                  热门
                </span>
              )}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">{pkg.name}</h4>
                  <p className="text-2xl font-bold text-primary-600 mt-1">¥{pkg.price}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(pkg)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(pkg.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">积分数量</span>
                  <span className="font-medium text-gray-900">{pkg.credits.toLocaleString()}</span>
                </div>
                {pkg.bonus_credits > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">赠送积分</span>
                    <span className="font-medium text-emerald-600">+{pkg.bonus_credits.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">合计</span>
                  <span className="font-medium text-gray-900">{(pkg.credits + pkg.bonus_credits).toLocaleString()}</span>
                </div>
              </div>
              {!pkg.enabled && (
                <div className="mt-2 text-xs text-gray-400">已停用</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 套餐编辑弹窗 */}
      <Modal open={modalOpen} title={editingPkg ? '编辑套餐' : '新增套餐'} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">套餐名称</label>
            <input
              type="text"
              value={form.name ?? ''}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="如：基础版"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">积分数量</label>
              <input
                type="number"
                value={form.credits ?? ''}
                onChange={e => setForm({ ...form, credits: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">价格（元）</label>
              <input
                type="number"
                step="0.01"
                value={form.price ?? ''}
                onChange={e => setForm({ ...form, price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">赠送积分</label>
              <input
                type="number"
                value={form.bonus_credits ?? 0}
                onChange={e => setForm({ ...form, bonus_credits: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">排序</label>
              <input
                type="number"
                value={form.sort_order ?? 0}
                onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_popular ?? false}
                onChange={e => setForm({ ...form, is_popular: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">标记为热门</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled ?? true}
                onChange={e => setForm({ ...form, enabled: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">启用</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================
 * Tab 3: 智能体消耗配置
 * ============================================================ */
function AgentRulesTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [rules, setRules] = useState<AgentCreditRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAgentCreditRules();
      setRules(res.data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const updateRule = async (id: number, data: Partial<AgentCreditRule>) => {
    setSavingId(id);
    try {
      await api.updateAgentCreditRule(id, data);
      showToast('规则已更新');
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '更新失败', 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>;

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">智能体积分消耗规则</h3>
        <p className="text-sm text-gray-500">配置各智能体的消耗系数及是否免扣积分</p>
      </div>

      {/* 说明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
        <div className="flex gap-2">
          <AlertCircle size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700">
            <span className="font-medium">消耗公式：</span>
            扣除积分 = Token 消耗量 ÷ 兑换比例 × 消耗系数。
            系数 1.0 = 标准，0.5 = 半价，2.0 = 双倍。免扣积分的智能体不消耗积分。
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">智能体</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">说明</th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase">消耗系数</th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase">免扣积分</th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(rule => (
              <AgentRuleRow key={rule.id} rule={rule} saving={savingId === rule.id} onUpdate={updateRule} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AgentRuleRow({
  rule, saving, onUpdate,
}: {
  rule: AgentCreditRule;
  saving: boolean;
  onUpdate: (id: number, data: Partial<AgentCreditRule>) => void;
}) {
  const [coefficient, setCoefficient] = useState(String(rule.coefficient));
  const [freeDeduction, setFreeDeduction] = useState(rule.free_deduction);
  const [enabled, setEnabled] = useState(rule.enabled);
  const [dirty, setDirty] = useState(false);

  const checkDirty = (field: string, value: unknown) => {
    const orig = { coefficient: String(rule.coefficient), freeDeduction: rule.free_deduction, enabled: rule.enabled };
    const curr = { coefficient: field === 'coefficient' ? value as string : coefficient, freeDeduction: field === 'freeDeduction' ? value as boolean : freeDeduction, enabled: field === 'enabled' ? value as boolean : enabled };
    setDirty(curr.coefficient !== orig.coefficient || curr.freeDeduction !== orig.freeDeduction || curr.enabled !== orig.enabled);
  };

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="py-3 px-3">
        <div className="font-medium text-sm text-gray-900">{rule.agent_name}</div>
        <div className="text-xs text-gray-400">{rule.agent_code}</div>
      </td>
      <td className="py-3 px-3 text-sm text-gray-500 max-w-xs">{rule.description}</td>
      <td className="py-3 px-3 text-center">
        <input
          type="number"
          step="0.1"
          min="0"
          value={coefficient}
          onChange={e => { setCoefficient(e.target.value); checkDirty('coefficient', e.target.value); }}
          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </td>
      <td className="py-3 px-3 text-center">
        <button
          onClick={() => { const v = !freeDeduction; setFreeDeduction(v); checkDirty('freeDeduction', v); }}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${freeDeduction ? 'bg-primary-600' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${freeDeduction ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      </td>
      <td className="py-3 px-3 text-center">
        <button
          onClick={() => { const v = !enabled; setEnabled(v); checkDirty('enabled', v); }}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      </td>
      <td className="py-3 px-3 text-center">
        <button
          onClick={() => {
            onUpdate(rule.id, { coefficient: Number(coefficient), free_deduction: freeDeduction, enabled });
            setDirty(false);
          }}
          disabled={!dirty || saving}
          className="px-3 py-1 bg-primary-600 text-white text-xs font-medium rounded hover:bg-primary-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? '保存中' : '保存'}
        </button>
      </td>
    </tr>
  );
}

/* ============================================================
 * Tab 4: 购买记录
 * ============================================================ */
function OrdersTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [data, setData] = useState<{ items: CreditOrder[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCreditOrders({
        status: statusFilter || undefined,
        page,
        page_size: 15,
      });
      setData(res.data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const handleConfirm = async (orderId: number) => {
    if (!confirm('确认此订单已到账？确认后将自动为租户增加积分。')) return;
    setActionId(orderId);
    try {
      await api.confirmCreditOrder(orderId);
      showToast('订单已确认，积分已到账');
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (orderId: number) => {
    if (!confirm('确认取消此订单？')) return;
    setActionId(orderId);
    try {
      await api.cancelCreditOrder(orderId);
      showToast('订单已取消');
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error');
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>;

  const totalPages = Math.ceil(data.total / 15);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">购买记录</h3>
          <p className="text-sm text-gray-500">共 {data.total} 条订单</p>
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">全部状态</option>
          <option value="pending">待支付</option>
          <option value="paid">已支付</option>
          <option value="confirmed">已确认到账</option>
          <option value="cancelled">已取消</option>
          <option value="failed">失败</option>
        </select>
      </div>

      {data.items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无订单</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">订单号</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">租户</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase">积分</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase">金额</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase">支付方式</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">时间</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(order => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-3">
                      <div className="text-sm font-mono text-gray-700">{order.order_no}</div>
                      {order.remark && <div className="text-xs text-gray-400 mt-0.5">{order.remark}</div>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm font-medium text-gray-900">{order.tenant_name}</div>
                      <div className="text-xs text-gray-400">{order.tenant_code}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="text-sm font-medium text-gray-900">{order.credits.toLocaleString()}</div>
                      {order.bonus_credits > 0 && <div className="text-xs text-emerald-600">+{order.bonus_credits}</div>}
                    </td>
                    <td className="py-3 px-3 text-center text-sm text-gray-700">¥{order.amount}</td>
                    <td className="py-3 px-3 text-center text-sm text-gray-500">{order.payment_method_display}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_COLORS[order.status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {order.status_display}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {order.status === 'pending' || order.status === 'paid' ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleConfirm(order.id)}
                            disabled={actionId === order.id}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            <Check size={12} /> 确认
                          </button>
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={actionId === order.id}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={12} /> 取消
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30"
              >
                上一页
              </button>
              <span className="text-sm text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
 * Tab 5: 租户充值
 * ============================================================ */
function RechargeTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('管理员手动充值');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.getTenants();
        setTenants(res.data.tenants);
      } catch (e) {
        showToast(e instanceof Error ? e.message : '加载租户失败', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [showToast]);

  const handleSubmit = async () => {
    if (!selectedTenant) { showToast('请选择租户', 'error'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { showToast('请输入有效的积分数量', 'error'); return; }
    setSubmitting(true);
    try {
      const res = await api.manualRechargeCredits({
        tenant_id: Number(selectedTenant),
        amount: amt,
        reason,
      });
      showToast(`已充值 ${amt} 积分，当前余额 ${res.data.tenant_credits}`);
      setAmount('');
      setReason('管理员手动充值');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '充值失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>;

  const filtered = tenants.filter(t =>
    !search || t.name.includes(search) || t.code.includes(search)
  );
  const selectedTenantInfo = tenants.find(t => String(t.id) === selectedTenant);

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">租户手动充值</h3>
        <p className="text-sm text-gray-500">直接为租户充值积分，无需经过订单流程</p>
      </div>

      <div className="space-y-4">
        {/* 选择租户 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">选择租户</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索租户名称或编码"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
            />
          </div>
          <select
            value={selectedTenant}
            onChange={e => setSelectedTenant(e.target.value)}
            size={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {filtered.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code}) — 余额: {t.credits ?? 0}
              </option>
            ))}
          </select>
        </div>

        {/* 当前余额 */}
        {selectedTenantInfo && (
          <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">当前积分余额</span>
              <div className="text-xl font-bold text-primary-700">{selectedTenantInfo.credits ?? 0}</div>
            </div>
            <Coins size={24} className="text-primary-400" />
          </div>
        )}

        {/* 充值数量 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">充值积分数量</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="输入积分数量"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* 备注 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">充值备注</label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="充值原因"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedTenant}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Wallet size={16} />
            {submitting ? '充值中...' : '确认充值'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Tab 6: 收入统计
 * ============================================================ */
function StatsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCreditStats();
      setStats(res.data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">积分收入统计</h3>
        <p className="text-sm text-gray-500">积分销售与消耗概览</p>
      </div>

      {/* 顶部数据卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="总收入" value={`¥${stats.total_revenue}`} icon={<TrendingUp size={18} />} color="text-emerald-600 bg-emerald-50" />
        <StatCard label="已售积分" value={stats.total_credits_sold.toLocaleString()} icon={<Coins size={18} />} color="text-primary-600 bg-primary-50" />
        <StatCard label="已确认订单" value={String(stats.total_orders)} icon={<Check size={18} />} color="text-blue-600 bg-blue-50" />
        <StatCard label="待处理订单" value={String(stats.pending_orders)} icon={<AlertCircle size={18} />} color="text-amber-600 bg-amber-50" />
      </div>

      {/* 租户余额 */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">租户积分余额</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">租户</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">编码</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">积分余额</th>
              </tr>
            </thead>
            <tbody>
              {stats.tenant_balances.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-4 text-sm text-gray-400">暂无数据</td></tr>
              ) : (
                stats.tenant_balances.map(t => (
                  <tr key={t.id} className="border-b border-gray-50">
                    <td className="py-2 px-3 text-sm font-medium text-gray-900">{t.name}</td>
                    <td className="py-2 px-3 text-sm text-gray-500">{t.code}</td>
                    <td className="py-2 px-3 text-sm text-right font-medium text-primary-600">{t.credits.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 智能体消耗 */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">智能体消耗统计</h4>
        {stats.agent_consumption.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-400">暂无消耗记录</div>
        ) : (
          <div className="space-y-2">
            {stats.agent_consumption.map((item, idx) => {
              const maxConsumed = stats.agent_consumption[0]?.total_consumed || 1;
              const pct = (item.total_consumed / maxConsumed) * 100;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-20 text-sm font-medium text-gray-700 flex-shrink-0">{item.agent_name}</div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-32 text-right text-sm text-gray-500 flex-shrink-0">
                    {item.total_consumed.toLocaleString()} 积分
                    <span className="text-xs text-gray-400 ml-1">({item.count} 次)</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
