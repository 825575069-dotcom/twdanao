// ============================================================
// YesGo Admin — 提示词管理（首页提示词 / 普通提示词）
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { PromptItem } from '@/types';
import {
  Megaphone, Users, Search, GraduationCap, BarChart3, TrendingDown,
  Package, Truck, BookOpen, Sparkles, FileText, MessageCircle, Bot,
  Target, Lightbulb, Brain, type LucideIcon,
  Plus, Pencil, Trash2, Save, X, AlertCircle, Loader2, CheckCircle2,
} from 'lucide-react';

// 可选图标（与前端图标注册表 key 对齐）
const PROMPT_ICONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'megaphone', label: '喇叭', icon: Megaphone },
  { key: 'users', label: '客户', icon: Users },
  { key: 'search', label: '搜索', icon: Search },
  { key: 'graduation-cap', label: '学术', icon: GraduationCap },
  { key: 'bar-chart-3', label: '分析', icon: BarChart3 },
  { key: 'trending-down', label: '滞销', icon: TrendingDown },
  { key: 'package', label: '采购', icon: Package },
  { key: 'truck', label: '流向', icon: Truck },
  { key: 'book-open', label: '书籍', icon: BookOpen },
  { key: 'sparkles', label: '灵感', icon: Sparkles },
  { key: 'file-text', label: '文档', icon: FileText },
  { key: 'message-circle', label: '对话', icon: MessageCircle },
  { key: 'bot', label: '机器人', icon: Bot },
  { key: 'target', label: '目标', icon: Target },
  { key: 'lightbulb', label: '灯泡', icon: Lightbulb },
  { key: 'brain', label: '大脑', icon: Brain },
];

// 内置分类标签映射（同时用于首页 Tab 显示，自定义分类直接显示字符串值）
const CATEGORY_LABEL_MAP: Record<string, string> = {
  recommend: '推荐',
  platform: '平台运营',
  marketing: '营销跟客',
  flow: '流向管控',
  purchase: '智能采购',
  academic: '学术培训',
  quick: '快采',
  collective: '集采',
  search: '找品',
};

// 默认分类建议（首页/采购兔首页使用）
const HOME_CATEGORY_SUGGESTIONS = ['recommend', 'platform', 'marketing', 'flow', 'purchase', 'academic'];
// 采购对话三库分类
const PURCHASE_CHAT_CATEGORIES = ['quick', 'collective', 'search'];

const TYPE_TABS = [
  { k: 'home', label: '首页提示词' },
  { k: 'chat', label: '普通提示词' },
  { k: 'purchase_chat', label: '采购兔提示词' },
  { k: 'purchase_home', label: '采购兔首页提示词' },
] as const;

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  PROMPT_ICONS.map((i) => [i.key, i.icon]),
);

type PromptType = 'home' | 'chat' | 'purchase_chat' | 'purchase_home';

function emptyForm(type: PromptType, category?: string): Record<string, unknown> {
  const isPurchaseChat = type === 'purchase_chat';
  const isPurchaseHome = type === 'purchase_home';
  return {
    prompt_type: type,
    category: category || (isPurchaseChat ? 'quick' : 'recommend'),
    title: '',
    icon: isPurchaseHome ? 'package' : 'megaphone',
    content: '',
    enabled: true,
    sort: 0,
  };
}

// ============================================================
// Main Page
// ============================================================
export default function Prompts() {
  const [type, setType] = useState<PromptType>('home');
  const [purchaseCategory, setPurchaseCategory] = useState<string>('quick');
  const [purchaseHomeCategory, setPurchaseHomeCategory] = useState<string>('purchase');
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PromptItem | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm('home'));
  const [saving, setSaving] = useState(false);
  const [savedTip, setSavedTip] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const activeCategory =
    type === 'purchase_chat' ? purchaseCategory
    : type === 'purchase_home' ? purchaseHomeCategory
    : undefined;

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getPrompts(type, activeCategory, true);
      setPrompts(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取提示词失败');
    } finally {
      setLoading(false);
    }
  }, [type, activeCategory]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const openCreate = () => {
    setEditing(null);
    const initCategory =
      type === 'purchase_chat' ? purchaseCategory
      : type === 'purchase_home' ? purchaseHomeCategory
      : undefined;
    setForm(emptyForm(type, initCategory));
    setShowModal(true);
  };

  const openEdit = (p: PromptItem) => {
    setEditing(p);
    setForm({
      prompt_type: p.prompt_type,
      category: p.category,
      title: p.title,
      icon: p.icon,
      content: p.content,
      enabled: p.enabled,
      sort: p.sort,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.content || (type !== 'chat' && !form.title)) {
      setError(type === 'chat' ? '请填写提示词内容' : '请填写标题与提示词内容');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.updatePrompt(editing.id, form);
      } else {
        await api.createPrompt(form);
      }
      setSavedTip(true);
      setTimeout(() => setSavedTip(false), 2000);
      setShowModal(false);
      await fetchPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deletePrompt(id);
      setConfirmId(null);
      await fetchPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleToggleEnabled = async (p: PromptItem) => {
    setTogglingId(p.id);
    setError('');
    const nextEnabled = !p.enabled;
    // 乐观更新：立即切换本地状态，避免整表刷新导致页面抖动
    setPrompts((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, enabled: nextEnabled } : item))
    );
    try {
      await api.updatePrompt(p.id, { enabled: nextEnabled });
    } catch (err) {
      // 失败时回滚
      setPrompts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, enabled: p.enabled } : item))
      );
      setError(err instanceof Error ? err.message : '状态更新失败');
    } finally {
      setTogglingId(null);
    }
  };

  const setField = (k: string, v: unknown) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="text-primary-600" size={22} />
            提示词管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            首页提示词展示在客户端欢迎页卡片；普通提示词跟随在聊天输入框上方
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          新增提示词
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TYPE_TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setType(t.k)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              type === t.k
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 采购对话提示词三库子 Tab */}
      {type === 'purchase_chat' && (
        <div className="flex items-center gap-2 pt-2">
          {PURCHASE_CHAT_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setPurchaseCategory(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                purchaseCategory === c
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {CATEGORY_LABEL_MAP[c] || c}
            </button>
          ))}
        </div>
      )}

      {/* 采购兔首页提示词分类子 Tab（动态筛选已有分类） */}
      {type === 'purchase_home' && (
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          {(() => {
            // 从已有数据中提取采购兔首页的所有分类
            const cats = [...new Set(prompts.map((p) => p.category).filter(Boolean))];
            if (cats.length === 0) {
              cats.push(...HOME_CATEGORY_SUGGESTIONS);
            }
            return cats.map((c) => (
              <button
                key={c}
                onClick={() => setPurchaseHomeCategory(c)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  purchaseHomeCategory === c
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {CATEGORY_LABEL_MAP[c] || c}
              </button>
            ));
          })()}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">
          暂无{type === 'home' ? '首页' : type === 'chat' ? '普通' : type === 'purchase_home' ? '采购兔首页' : '采购兔'}提示词，点击右上角「新增提示词」
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500 bg-gray-50">
                {type !== 'chat' && <th className="text-left py-2.5 px-4 font-medium">图标</th>}
                {type !== 'chat' && <th className="text-left py-2.5 px-4 font-medium">标题</th>}
                {type !== 'chat' && <th className="text-left py-2.5 px-4 font-medium">分类</th>}
                <th className="text-left py-2.5 px-4 font-medium">提示词内容</th>
                <th className="text-left py-2.5 px-4 font-medium w-16">排序</th>
                <th className="text-left py-2.5 px-4 font-medium w-16">启用</th>
                <th className="text-right py-2.5 px-4 font-medium w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {prompts.map((p) => {
                const Icon = ICON_MAP[p.icon] || FileText;
                const categoryLabel = CATEGORY_LABEL_MAP[p.category] || p.category;
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${
                      !p.enabled ? 'bg-gray-50/80' : ''
                    }`}
                  >
                    {type !== 'chat' && (
                      <td className="py-2.5 px-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!p.enabled ? 'bg-gray-200' : 'bg-gray-100'}`}>
                          <Icon size={16} className={`${!p.enabled ? 'text-gray-400' : 'text-gray-600'}`} />
                        </div>
                      </td>
                    )}
                    {type !== 'chat' && (
                      <td className={`py-2.5 px-4 font-medium ${!p.enabled ? 'text-gray-400' : 'text-gray-900'}`}>
                        {p.title || '-'}
                        {!p.enabled && <span className="ml-2 text-xs text-gray-400 font-normal">(已停用)</span>}
                      </td>
                    )}
                    {type !== 'chat' && (
                      <td className={`py-2.5 px-4 ${!p.enabled ? 'text-gray-400' : 'text-gray-500'}`}>{categoryLabel}</td>
                    )}
                    <td className={`py-2.5 px-4 max-w-md truncate ${!p.enabled ? 'text-gray-400' : 'text-gray-600'}`} title={p.content}>
                      {p.content}
                    </td>
                    <td className={`py-2.5 px-4 ${!p.enabled ? 'text-gray-400' : 'text-gray-500'}`}>{p.sort}</td>
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleEnabled(p)}
                        disabled={togglingId === p.id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          p.enabled ? 'bg-primary-600' : 'bg-gray-300'
                        } ${togglingId === p.id ? 'opacity-70 cursor-wait' : 'hover:opacity-90'}`}
                        title={p.enabled ? '点击停用' : '点击启用'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            p.enabled ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          title="编辑"
                        >
                          <Pencil size={15} />
                        </button>
                        {confirmId === p.id ? (
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="px-2 py-1 rounded-md text-xs text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            确认删除
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmId(p.id)}
                            className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={() => setShowModal(false)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                {editing ? '编辑提示词' : '新增提示词'}
                <span className="ml-2 text-xs font-normal text-gray-400">
                  {type === 'home' ? '首页提示词' : type === 'chat' ? '普通提示词' : type === 'purchase_home' ? '采购兔首页提示词' : '采购兔提示词'}
                </span>
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-md text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {type !== 'chat' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">标题</label>
                    <input
                      value={(form.title as string) || ''}
                      onChange={(e) => setField('title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      placeholder={type === 'purchase_chat' ? '如：补货推荐' : type === 'purchase_home' ? '如：比价选品' : '如：平台活动策划'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {type === 'purchase_chat' ? '分类（对应采购兔快捷输入库）' : '分类（对应首页 Tab，支持自定义输入）'}
                    </label>
                    <input
                      list="category-list"
                      value={(form.category as string) || ''}
                      onChange={(e) => setField('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      placeholder="选择或输入自定义分类…"
                    />
                    <datalist id="category-list">
                      {/* 从已有提示词中提取不重复的分类作为建议 */}
                      {[...new Set(prompts.map((p) => p.category).filter(Boolean))].map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">图标</label>
                    <div className="grid grid-cols-8 gap-1.5">
                      {PROMPT_ICONS.map((opt) => {
                        const Active = opt.icon;
                        const selected = (form.icon as string) === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setField('icon', opt.key)}
                            title={opt.label}
                            className={`flex items-center justify-center h-9 w-9 rounded-lg border transition-colors ${
                              selected
                                ? 'border-primary-500 bg-primary-50 text-primary-600'
                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            <Active size={16} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {type === 'home'
                    ? '提示词内容（点击卡片发送给 AI）'
                    : type === 'purchase_chat'
                    ? '提示词内容（点击填充到采购聊天框）'
                    : '提示词内容（点击填充到聊天框）'}
                </label>
                <textarea
                  value={(form.content as string) || ''}
                  onChange={(e) => setField('content', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                  placeholder="输入提示词内容…"
                />
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">排序</label>
                  <input
                    type="number"
                    value={(form.sort as number) ?? 0}
                    onChange={(e) => setField('sort', parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 mt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.enabled}
                    onChange={(e) => setField('enabled', e.target.checked)}
                    className="h-4 w-4 rounded accent-primary-600"
                  />
                  <span className="text-sm text-gray-700">启用</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
              {savedTip && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 size={14} /> 已保存
                </span>
              )}
              <button
                onClick={() => setShowModal(false)}
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
      )}
    </div>
  );
}
