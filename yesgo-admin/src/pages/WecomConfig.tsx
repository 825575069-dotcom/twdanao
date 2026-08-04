// ============================================================
// YesGo Admin — 企微设置
// SDK 地址 / SDK Token / 回调 Token
// ============================================================
import { useState, useEffect } from 'react';
import { Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import type { WecomGlobalConfig } from '@/types';

export default function WecomConfig() {
  const [config, setConfig] = useState<WecomGlobalConfig | null>(null);
  const [form, setForm] = useState({ sdk_url: '', sdk_token: '', callback_token: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' }>({ message: '', type: 'success' });
  const [showSdkToken, setShowSdkToken] = useState(false);
  const [showCallbackToken, setShowCallbackToken] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type }), 3000);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await api.getWecomConfig();
      setConfig(res.data);
      setForm({
        sdk_url: res.data.sdk_url || '',
        sdk_token: res.data.sdk_token || '',
        callback_token: res.data.callback_token || '',
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载配置失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.sdk_url.trim()) {
      showToast('请填写企微 SDK 地址', 'error');
      return;
    }
    if (!form.sdk_token.trim()) {
      showToast('请填写 SDK Token', 'error');
      return;
    }
    try {
      setSaving(true);
      const res = await api.updateWecomConfig(form);
      setConfig(res.data);
      showToast('配置已保存');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary-500" size={24} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Toast */}
      {toast.message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">企微设置</h1>
        <p className="text-sm text-gray-500 mt-1">配置企微 SDK 全局参数，所有企微号共享此配置</p>
      </div>

      {/* Config Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 max-w-2xl">
        {/* SDK URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            企微 SDK 地址 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.sdk_url}
            onChange={e => setForm({ ...form, sdk_url: e.target.value })}
            placeholder="https://manager.qiweapi.com/qiwe"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">
            QiWei 网关 API 基础地址（可填写域名或完整路径，系统会自动补全 <code className="text-gray-500">/api/qw/doApi</code> 端点）
          </p>
        </div>

        {/* SDK Token */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            SDK Token <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showSdkToken ? 'text' : 'password'}
              value={form.sdk_token}
              onChange={e => setForm({ ...form, sdk_token: e.target.value })}
              placeholder="请输入 SDK Token"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowSdkToken(!showSdkToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showSdkToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">用于调用 QiWei API 的认证 Token</p>
        </div>

        {/* Callback Token */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            回调 Token
          </label>
          <div className="relative">
            <input
              type={showCallbackToken ? 'text' : 'password'}
              value={form.callback_token}
              onChange={e => setForm({ ...form, callback_token: e.target.value })}
              placeholder="请输入回调 Token（可选）"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowCallbackToken(!showCallbackToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCallbackToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">用于验证 QiWei Webhook 回调请求的 Token</p>
        </div>

        {/* Updated at */}
        {config?.updated_at && (
          <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            最后更新：{new Date(config.updated_at).toLocaleString('zh-CN')}
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
}
