// ============================================================
// YesGo Admin — 提现管理
// 提现审核 / 确认到账 / 钱包概览
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import {
  Wallet, CheckCircle2, XCircle, Clock, Banknote,
  Search, X, AlertCircle, RefreshCw, ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { AdminWithdrawalRecord, AdminWalletItem } from '@/lib/api';

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

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
};

const STATUS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'processing', label: '处理中' },
  { value: 'completed', label: '已完成' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'cancelled', label: '已取消' },
];

function formatMoney(s: string | number): string {
  const n = typeof s === 'number' ? s : parseFloat(s);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ============================================================
 * 主组件
 * ============================================================ */
export default function Withdrawals() {
  const [activeTab, setActiveTab] = useState<'records' | 'wallets'>('records');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' }>({ message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type }), 3000);
  };

  return (
    <div className="p-6 space-y-4">
      <Toast {...toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">提现管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">审核供应商提现申请 · 确认到账 · 钱包概览</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'records' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          提现审核
        </button>
        <button
          onClick={() => setActiveTab('wallets')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'wallets' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          钱包概览
        </button>
      </div>

      {activeTab === 'records' && <WithdrawalRecordsTab showToast={showToast} />}
      {activeTab === 'wallets' && <WalletOverviewTab showToast={showToast} />}
    </div>
  );
}

/* ============================================================
 * Tab 1: 提现审核
 * ============================================================ */
function WithdrawalRecordsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AdminWithdrawalRecord[]>([]);
  const [stats, setStats] = useState<{
    pending: number; processing: number; completed: number; rejected: number; cancelled: number;
    pending_amount: string; completed_amount: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [actionModal, setActionModal] = useState<{ type: 'approve' | 'reject' | 'complete'; record: AdminWithdrawalRecord } | null>(null);
  const [adminRemark, setAdminRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminWithdrawals({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchTerm || undefined,
      });
      setRecords(res.data.records);
      setStats(res.data.stats);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => {
    setSearchTerm(searchInput.trim());
  };

  const openModal = (type: 'approve' | 'reject' | 'complete', record: AdminWithdrawalRecord) => {
    setActionModal({ type, record });
    setAdminRemark('');
  };

  const handleSubmit = async () => {
    if (!actionModal) return;
    if (actionModal.type === 'reject' && !adminRemark.trim()) {
      showToast('拒绝原因不能为空', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const { record, type } = actionModal;
      if (type === 'approve') {
        await api.approveWithdrawal(record.id, adminRemark);
        showToast(`已通过 ${record.withdrawal_number} 的提现申请`);
      } else if (type === 'reject') {
        await api.rejectWithdrawal(record.id, adminRemark);
        showToast(`已拒绝 ${record.withdrawal_number} 的提现申请`);
      } else {
        await api.completeWithdrawal(record.id, adminRemark);
        showToast(`已确认 ${record.withdrawal_number} 到账`);
      }
      setActionModal(null);
      setAdminRemark('');
      fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '操作失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="待审核"
            value={stats.pending}
            amount={stats.pending_amount}
            icon={Clock}
            color="amber"
            onClick={() => setStatusFilter('pending')}
          />
          <StatCard
            label="处理中"
            value={stats.processing}
            icon={RefreshCw}
            color="blue"
            onClick={() => setStatusFilter('processing')}
          />
          <StatCard
            label="已完成"
            value={stats.completed}
            amount={stats.completed_amount}
            icon={CheckCircle2}
            color="emerald"
            onClick={() => setStatusFilter('completed')}
          />
          <StatCard
            label="已拒绝"
            value={stats.rejected}
            icon={XCircle}
            color="red"
            onClick={() => setStatusFilter('rejected')}
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="搜索供应商 / 编号 / 提现单号"
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-1.5 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 transition-colors flex items-center gap-1"
          >
            <Search size={14} />
            搜索
          </button>
          {(searchTerm || statusFilter !== 'all') && (
            <button
              onClick={() => { setStatusFilter('all'); setSearchTerm(''); setSearchInput(''); }}
              className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-sm"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">加载中...</div>
        ) : records.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
            <AlertCircle size={32} className="text-gray-300" />
            <span>暂无提现记录</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-medium">提现单号</th>
                  <th className="px-4 py-3 text-left font-medium">供应商</th>
                  <th className="px-4 py-3 text-right font-medium">金额</th>
                  <th className="px-4 py-3 text-right font-medium">手续费</th>
                  <th className="px-4 py-3 text-right font-medium">到账金额</th>
                  <th className="px-4 py-3 text-left font-medium">收款账户</th>
                  <th className="px-4 py-3 text-center font-medium">状态</th>
                  <th className="px-4 py-3 text-left font-medium">申请时间</th>
                  <th className="px-4 py-3 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-xs">{r.withdrawal_number}</div>
                      {r.remark && <div className="text-xs text-gray-400 mt-0.5 max-w-[150px] truncate" title={r.remark}>{r.remark}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-700">{r.supplier_name}</div>
                      <div className="text-xs text-gray-400">{r.supplier_code}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">¥{formatMoney(r.amount)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">¥{formatMoney(r.fee)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">¥{formatMoney(r.net_amount)}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700 text-xs">{r.bank_name}</div>
                      <div className="text-xs text-gray-400">{r.bank_holder} · {r.bank_account}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {r.status_display}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <ActionButtons record={r} onAction={openModal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Modal */}
      <Modal
        open={!!actionModal}
        title={
          actionModal?.type === 'approve' ? '审核通过提现申请' :
          actionModal?.type === 'reject' ? '拒绝提现申请' :
          '确认提现到账'
        }
        onClose={() => setActionModal(null)}
      >
        {actionModal && (
          <div className="space-y-4">
            {/* Record summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">提现单号</span>
                <span className="font-medium text-gray-900">{actionModal.record.withdrawal_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">供应商</span>
                <span className="font-medium text-gray-900">{actionModal.record.supplier_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">提现金额</span>
                <span className="font-semibold text-gray-900">¥{formatMoney(actionModal.record.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">到账金额</span>
                <span className="font-semibold text-emerald-600">¥{formatMoney(actionModal.record.net_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">收款账户</span>
                <span className="text-gray-700 text-xs">{actionModal.record.bank_name} · {actionModal.record.bank_holder}</span>
              </div>
            </div>

            {/* Admin remark */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {actionModal.type === 'reject' ? '拒绝原因' : '备注（可选）'}
              </label>
              <textarea
                value={adminRemark}
                onChange={e => setAdminRemark(e.target.value)}
                placeholder={actionModal.type === 'reject' ? '请输入拒绝原因，将通知供应商' : '可填写处理备注'}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 ${
                  actionModal.type === 'reject' && !adminRemark.trim()
                    ? 'border-red-300 focus:border-red-400'
                    : 'border-gray-200 focus:border-primary-400'
                }`}
              />
              {actionModal.type === 'reject' && !adminRemark.trim() && (
                <p className="text-xs text-red-500 mt-1">拒绝操作必须填写原因</p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-4 py-2 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || (actionModal.type === 'reject' && !adminRemark.trim())}
                className={`px-4 py-2 rounded-md text-sm text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  actionModal.type === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : actionModal.type === 'approve'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {submitting ? '处理中...' : actionModal.type === 'approve' ? '确认通过' : actionModal.type === 'reject' ? '确认拒绝' : '确认到账'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------- 操作按钮 ---------- */
function ActionButtons({ record, onAction }: { record: AdminWithdrawalRecord; onAction: (type: 'approve' | 'reject' | 'complete', record: AdminWithdrawalRecord) => void }) {
  if (record.status === 'pending') {
    return (
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => onAction('approve', record)}
          className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
        >
          通过
        </button>
        <button
          onClick={() => onAction('reject', record)}
          className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100 transition-colors"
        >
          拒绝
        </button>
      </div>
    );
  }
  if (record.status === 'processing') {
    return (
      <button
        onClick={() => onAction('complete', record)}
        className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-medium hover:bg-emerald-100 transition-colors"
      >
        确认到账
      </button>
    );
  }
  return <span className="text-xs text-gray-300">-</span>;
}

/* ---------- 统计卡片 ---------- */
function StatCard({ label, value, amount, icon: Icon, color, onClick }: {
  label: string;
  value: number;
  amount?: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  color: 'amber' | 'blue' | 'emerald' | 'red';
  onClick?: () => void;
}) {
  const colors = {
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
  };
  const c = colors[color];
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-xl border ${c.border} p-4 text-left hover:shadow-md transition-shadow w-full`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon size={18} className={c.text} />
        </div>
        <span className={`text-2xl font-bold ${c.text}`}>{value}</span>
      </div>
      <div className="text-sm font-medium text-gray-700">{label}</div>
      {amount && <div className="text-xs text-gray-400 mt-0.5">¥{formatMoney(amount)}</div>}
    </button>
  );
}

/* ============================================================
 * Tab 2: 钱包概览
 * ============================================================ */
function WalletOverviewTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<AdminWalletItem[]>([]);

  useEffect(() => {
    api.getAdminWallets()
      .then(res => setWallets(res.data))
      .catch(err => showToast(err instanceof Error ? err.message : '加载失败', 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">加载中...</div>
      ) : wallets.length === 0 ? (
        <div className="py-20 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
          <Wallet size={32} className="text-gray-300" />
          <span>暂无供应商钱包数据</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">供应商</th>
                <th className="px-4 py-3 text-right font-medium">累计收入</th>
                <th className="px-4 py-3 text-right font-medium">累计退款</th>
                <th className="px-4 py-3 text-right font-medium">已提现</th>
                <th className="px-4 py-3 text-right font-medium">提现中</th>
                <th className="px-4 py-3 text-right font-medium">可用余额</th>
                <th className="px-4 py-3 text-left font-medium">绑定银行账户</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {wallets.map(w => (
                <tr key={w.supplier_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{w.supplier_name}</div>
                    <div className="text-xs text-gray-400">{w.supplier_code}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">¥{formatMoney(w.total_earned)}</td>
                  <td className="px-4 py-3 text-right text-red-500">¥{formatMoney(w.total_refunded)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">¥{formatMoney(w.total_withdrawn)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">¥{formatMoney(w.pending_withdrawal)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">¥{formatMoney(w.available_balance)}</td>
                  <td className="px-4 py-3">
                    {w.bank_name ? (
                      <div className="text-xs">
                        <div className="text-gray-700">{w.bank_name}</div>
                        <div className="text-gray-400">{w.bank_holder} · {w.bank_account}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">未绑定</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
