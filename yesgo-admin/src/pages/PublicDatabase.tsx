// ============================================================
// 公共数据库 — 供应商产品 + 采购报价 + 集采 + 订单 + 统计
// ============================================================
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type {
  PdbSupplier, PdbProduct, PdbOrder, PdbCollectiveBatch, PdbQuote,
  CollectiveAnnouncement, SupplierDeliveryRule, AggregateItem, SupplierAccount, SalesRegion,
} from '@/types';
import {
  PackageSearch, Search, Plus, Building2, Package, ShoppingCart,
  TrendingUp, FileText, CheckCircle2, XCircle, Clock,
  Truck, Shield, Banknote, RefreshCw, ChevronRight, X, Store,
  Factory, Pill, DollarSign, Layers, AlertCircle, Inbox, Loader2,
  CreditCard, BarChart3, ArrowUpRight, Filter, Megaphone, MapPin,
  Edit3, Trash2, PlayCircle, Send, Users, Calendar, Key, Eye, EyeOff,
} from 'lucide-react';

type TabId = 'suppliers' | 'products' | 'orders' | 'collective' | 'announcements' | 'delivery-rules' | 'accounts' | 'stats';

export default function PublicDatabase() {
  const [tab, setTab] = useState<TabId>('suppliers');
  const [suppliers, setSuppliers] = useState<PdbSupplier[]>([]);
  const [products, setProducts] = useState<PdbProduct[]>([]);
  const [orders, setOrders] = useState<PdbOrder[]>([]);
  const [batches, setBatches] = useState<PdbCollectiveBatch[]>([]);
  const [quotes, setQuotes] = useState<PdbQuote[]>([]);
  const [announcements, setAnnouncements] = useState<CollectiveAnnouncement[]>([]);
  const [deliveryRules, setDeliveryRules] = useState<SupplierDeliveryRule[]>([]);
  const [accounts, setAccounts] = useState<SupplierAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const searchQueryRef = useRef(searchQuery);
  const supplierSearchRef = useRef(supplierSearch);
  searchQueryRef.current = searchQuery;
  supplierSearchRef.current = supplierSearch;
  const [selectedProduct, setSelectedProduct] = useState<PdbProduct | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showDeliveryRuleModal, setShowDeliveryRuleModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const loadData = useCallback(async (tabId: TabId) => {
    setLoading(true);
    setError(null);
    try {
      if (tabId === 'suppliers') {
        const res = await api.getPdbSuppliers({ search: supplierSearchRef.current || undefined });
        setSuppliers(res.data || []);
      } else if (tabId === 'products') {
        const res = await api.getPdbProducts({ search: searchQueryRef.current, page_size: 50 });
        setProducts(res.data?.results || []);
      } else if (tabId === 'orders') {
        const res = await api.getPdbOrders();
        setOrders(res.data || []);
      } else if (tabId === 'collective') {
        const [batchRes, quoteRes] = await Promise.all([
          api.getPdbCollectiveBatches(),
          api.getPdbQuotes(),
        ]);
        setBatches(batchRes.data || []);
        setQuotes(quoteRes.data || []);
      } else if (tabId === 'announcements') {
        const res = await api.getAnnouncements();
        setAnnouncements(res.data || []);
      } else if (tabId === 'delivery-rules') {
        const [ruleRes, supplierRes] = await Promise.all([
          api.getDeliveryRules(),
          api.getPdbSuppliers(),
        ]);
        setDeliveryRules(ruleRes.data || []);
        setSuppliers(supplierRes.data || []);
      } else if (tabId === 'accounts') {
        const [accRes, supplierRes] = await Promise.all([
          api.getSupplierAccounts(),
          api.getPdbSuppliers(),
        ]);
        setAccounts(accRes.data || []);
        setSuppliers(supplierRes.data || []);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载失败';
      setError(msg);
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(tab);
    }, 350);
    return () => clearTimeout(timer);
  }, [tab, searchQuery, supplierSearch, loadData]);

  const TABS: { id: TabId; label: string; icon: typeof Building2; count?: number }[] = [
    { id: 'suppliers', label: '供应商', icon: Building2, count: suppliers.length },
    { id: 'products', label: '产品目录', icon: Package, count: products.length },
    { id: 'orders', label: '采购订单', icon: ShoppingCart, count: orders.length },
    { id: 'collective', label: '集采管理', icon: Layers, count: batches.length },
    { id: 'announcements', label: '集采公告', icon: Megaphone, count: announcements.length },
    { id: 'delivery-rules', label: '配送规则', icon: Truck, count: deliveryRules.length },
    { id: 'accounts', label: '供应商账号', icon: Key, count: accounts.length },
    { id: 'stats', label: '交易统计', icon: TrendingUp },
  ];

  return (
    <div className="h-full flex flex-col p-6 bg-gray-50 gap-5">
      {/* 页面标题 + 概览 */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <PackageSearch className="w-6 h-6 text-blue-600" />
              公共数据库
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              供应商产品聚合 · 采购报价 · 集采 · 订单流转 · 支付分账
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(tab)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        {/* 概览卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard icon={Building2} label="入驻供应商" value={suppliers.length} color="blue" />
          <SummaryCard icon={Package} label="产品目录" value={products.length} color="indigo" />
          <SummaryCard icon={ShoppingCart} label="采购订单" value={orders.length} color="amber" />
          <SummaryCard icon={Layers} label="集采批次" value={batches.length} color="green" />
        </div>
      </div>

      {/* 主内容区 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col min-h-0">
        {/* Tabs */}
        <div className="flex items-center justify-between px-5 border-b border-gray-200">
          <div className="flex gap-1">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {typeof t.count === 'number' && (
                    <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {tab === 'suppliers' && (
            <button
              onClick={() => setShowSupplierModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> 添加供应商
            </button>
          )}
          {tab === 'announcements' && (
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> 创建公告
            </button>
          )}
          {tab === 'delivery-rules' && (
            <button
              onClick={() => setShowDeliveryRuleModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> 添加规则
            </button>
          )}
          {tab === 'accounts' && (
            <button
              onClick={() => setShowAccountModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> 创建账号
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={() => loadData(tab)} />
          ) : tab === 'suppliers' ? (
            <SupplierTab
              suppliers={suppliers}
              searchQuery={supplierSearch}
              onSearch={setSupplierSearch}
              onCreate={() => setShowSupplierModal(true)}
            />
          ) : tab === 'products' ? (
            <ProductTab
              products={products}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              onProductClick={setSelectedProduct}
            />
          ) : tab === 'orders' ? (
            <OrderTab orders={orders} />
          ) : tab === 'collective' ? (
            <CollectiveTab batches={batches} quotes={quotes} />
          ) : tab === 'announcements' ? (
            <AnnouncementTab announcements={announcements} onRefresh={() => loadData('announcements')} />
          ) : tab === 'delivery-rules' ? (
            <DeliveryRuleTab rules={deliveryRules} suppliers={suppliers} onRefresh={() => loadData('delivery-rules')} />
          ) : tab === 'accounts' ? (
            <AccountsTab
              accounts={accounts}
              suppliers={suppliers}
              onRefresh={() => loadData('accounts')}
            />
          ) : (
            <StatsTab />
          )}
        </div>
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}

      {/* Supplier Create Modal */}
      {showSupplierModal && (
        <SupplierCreateModal
          onClose={() => setShowSupplierModal(false)}
          onCreated={() => { setShowSupplierModal(false); loadData('suppliers'); }}
        />
      )}

      {/* Announcement Create Modal */}
      {showAnnouncementModal && (
        <AnnouncementCreateModal
          onClose={() => setShowAnnouncementModal(false)}
          onCreated={() => { setShowAnnouncementModal(false); loadData('announcements'); }}
        />
      )}

      {/* Delivery Rule Create Modal */}
      {showDeliveryRuleModal && (
        <DeliveryRuleCreateModal
          suppliers={suppliers}
          onClose={() => setShowDeliveryRuleModal(false)}
          onCreated={() => { setShowDeliveryRuleModal(false); loadData('delivery-rules'); }}
        />
      )}

      {/* Account Create Modal */}
      {showAccountModal && (
        <AccountCreateModal
          suppliers={suppliers}
          onClose={() => setShowAccountModal(false)}
          onCreated={() => { setShowAccountModal(false); loadData('accounts'); }}
        />
      )}
    </div>
  );
}

// ========== 概览卡片 ==========
function SummaryCard({ icon: Icon, label, value, color }: { icon: typeof Building2; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    green: 'bg-green-50 text-green-600 border-green-100',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colors[color] || colors.blue}`}>
      <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-600">{label}</div>
      </div>
    </div>
  );
}

// ========== 加载/空/错误状态 ==========
function LoadingState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
      <Loader2 className="w-8 h-8 animate-spin mb-3" />
      <p className="text-sm">数据加载中...</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-12">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertCircle className="w-7 h-7 text-red-500" />
      </div>
      <h3 className="text-base font-medium text-gray-900">加载失败</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
      >
        <RefreshCw className="w-4 h-4" /> 重新加载
      </button>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }: {
  icon: typeof Building2; title: string; description: string; action?: ReactNode;
}) {
  return (
    <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center py-12">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-300" />
      </div>
      <h3 className="text-base font-medium text-gray-700">{title}</h3>
      <p className="text-sm text-gray-400 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ========== 供应商 Tab — 表格列表 ==========
function SupplierTab({ suppliers, searchQuery, onSearch, onCreate }: {
  suppliers: PdbSupplier[];
  searchQuery: string;
  onSearch: (v: string) => void;
  onCreate: () => void;
}) {
  if (suppliers.length === 0 && !searchQuery) {
    return (
      <EmptyState
        icon={Building2}
        title="暂无供应商"
        description="公共数据库通过 API 接入多家供应商的产品数据，供采购智能体读取报价。点击下方按钮添加第一家供应商。"
        action={
          <button
            onClick={onCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> 添加供应商
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 搜索 + 统计 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="搜索供应商名称、编码、联系人..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => onSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500 whitespace-nowrap">
          <span>共 {suppliers.length} 家</span>
          <span className="text-xs text-gray-400">点击「同步产品」可从供应商 API 拉取最新产品目录</span>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={Search} title="未找到匹配供应商" description={`没有符合「${searchQuery}」的供应商，请尝试其他关键词。`} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-medium">供应商</th>
                <th className="text-left px-4 py-3 font-medium">编码</th>
                <th className="text-left px-4 py-3 font-medium">类型</th>
                <th className="text-left px-4 py-3 font-medium">联系人</th>
                <th className="text-left px-4 py-3 font-medium">电话</th>
                <th className="text-center px-4 py-3 font-medium">资质</th>
                <th className="text-center px-4 py-3 font-medium">产品数</th>
                <th className="text-center px-4 py-3 font-medium">佣金</th>
                <th className="text-center px-4 py-3 font-medium">状态</th>
                <th className="text-center px-4 py-3 font-medium w-32">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-blue-50/50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center border border-blue-100 flex-shrink-0">
                        <Store className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate max-w-[180px]" title={s.name}>{s.name}</div>
                        {s.address && <div className="text-xs text-gray-400 truncate max-w-[180px]" title={s.address}>{s.address}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.code}</td>
                  <td className="px-4 py-3 text-gray-600">{s.supplier_type_display || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.contact_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.contact_phone || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <QualificationBadge status={s.qualification_status} display={s.qualification_status_display} />
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-gray-700">{s.product_count ?? 0}</td>
                  <td className="px-4 py-3 text-center font-medium text-gray-700">
                    {s.active_protocol
                      ? (s.active_protocol.protocol_type === 'percentage' ? `${s.active_protocol.value}%` : `¥${s.active_protocol.value}`)
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${s.enabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                      {s.enabled ? '已启用' : '已禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={async () => {
                          try { await api.syncPdbSupplierProducts(s.id); alert('同步完成'); } catch { alert('同步失败'); }
                        }}
                        className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> 同步
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const status = s.qualification_status === 'approved' ? 'pending' : 'approved';
                            await api.verifyPdbSupplier(s.id, { approved: status === 'approved', remark: '' });
                            window.location.reload();
                          } catch { alert('操作失败'); }
                        }}
                        className={`text-xs px-2 py-1 rounded-md transition-colors ${
                          s.qualification_status === 'approved'
                            ? 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                            : 'text-green-600 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {s.qualification_status === 'approved' ? '取消' : '审核'}
                      </button>
                    </div>
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

// ========== 产品目录 Tab ==========
function ProductTab({ products, searchQuery, onSearch, onProductClick }: {
  products: PdbProduct[];
  searchQuery: string;
  onSearch: (v: string) => void;
  onProductClick: (p: PdbProduct) => void;
}) {
  if (products.length === 0 && !searchQuery) {
    return (
      <EmptyState
        icon={Package}
        title="暂无产品数据"
        description="产品目录为空。请先在「供应商」页添加供应商并点击「同步产品」，或手动录入产品。"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="搜索产品名称、厂家、规格、批准文号..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => onSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500 whitespace-nowrap">
          共 {products.length} 条结果
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState icon={Search} title="未找到匹配产品" description={`没有符合「${searchQuery}」的产品，请尝试其他关键词。`} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-medium">产品名称</th>
                <th className="text-left px-4 py-3 font-medium">规格/剂型</th>
                <th className="text-left px-4 py-3 font-medium">厂家</th>
                <th className="text-left px-4 py-3 font-medium">供应商</th>
                <th className="text-right px-4 py-3 font-medium">单价</th>
                <th className="text-center px-4 py-3 font-medium">分类</th>
                <th className="text-center px-4 py-3 font-medium">状态</th>
                <th className="text-center px-4 py-3 font-medium w-16">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map(p => (
                <tr
                  key={p.id}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  onClick={() => onProductClick(p)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Pill className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{p.name}</div>
                        {p.trade_name && <div className="text-xs text-gray-400 truncate">商品名: {p.trade_name}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{p.specification || '-'}</div>
                    {p.dosage_form && <div className="text-xs text-gray-400">{p.dosage_form}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-[140px]" title={p.manufacturer}>{p.manufacturer || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]" title={p.supplier_name}>{p.supplier_name || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">¥{p.price}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600">{p.category || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ProductStatusBadge status={p.status} display={p.status_display} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 inline transition-colors" />
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

function ProductStatusBadge({ status, display }: { status: string; display?: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-50 text-green-600',
    inactive: 'bg-gray-100 text-gray-500',
    out_of_stock: 'bg-red-50 text-red-500',
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${colors[status] || colors.inactive}`}>
      {display || status}
    </span>
  );
}

// ========== 采购订单 Tab ==========
function OrderTab({ orders }: { orders: PdbOrder[] }) {
  const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', submitted: 'bg-blue-50 text-blue-600',
    qualifying: 'bg-amber-50 text-amber-600', qualified: 'bg-teal-50 text-teal-600',
    paying: 'bg-purple-50 text-purple-600', paid: 'bg-green-50 text-green-600',
    splitting: 'bg-purple-50 text-purple-600', split: 'bg-green-50 text-green-600',
    delivering: 'bg-cyan-50 text-cyan-600', completed: 'bg-green-50 text-green-700',
    cancelled: 'bg-red-50 text-red-500', refunded: 'bg-red-50 text-red-500',
  };

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="暂无采购订单"
        description="第三层租户通过智能体报价后提交提单，订单将在此集中展示。"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>共 {orders.length} 笔订单</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
            <tr>
              <th className="text-left px-4 py-3 font-medium">订单编号</th>
              <th className="text-left px-4 py-3 font-medium">买方</th>
              <th className="text-left px-4 py-3 font-medium">供应商</th>
              <th className="text-left px-4 py-3 font-medium">类型</th>
              <th className="text-right px-4 py-3 font-medium">金额</th>
              <th className="text-left px-4 py-3 font-medium">佣金/供应商到账</th>
              <th className="text-left px-4 py-3 font-medium">状态</th>
              <th className="text-left px-4 py-3 font-medium">支付</th>
              <th className="text-left px-4 py-3 font-medium">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{o.order_number}</td>
                <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]" title={o.tenant_name}>{o.tenant_name || '-'}</td>
                <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]" title={o.supplier_name}>{o.supplier_name || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${o.order_type === 'quick' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                    {o.order_type_display}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">¥{o.total_amount}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  <div>佣金 ¥{o.commission_amount}</div>
                  <div className="text-green-600">供应商 ¥{o.supplier_amount}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-500'}`}>
                    {o.status_display || o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{o.payment_method_display || '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{new Date(o.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ========== 集采管理 Tab ==========
function CollectiveTab({ batches, quotes }: { batches: PdbCollectiveBatch[]; quotes: PdbQuote[] }) {
  const STATUS_COLORS: Record<string, string> = {
    collecting: 'bg-amber-50 text-amber-600', notifying_supplier: 'bg-blue-50 text-blue-600',
    quoted: 'bg-purple-50 text-purple-600', distributed: 'bg-green-50 text-green-600',
    closed: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-sm text-gray-500">
          共 {batches.length} 个集采批次 · {quotes.length} 条报价记录
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => { try { await api.notifyCollectiveBatches(); alert('已通知供应商'); } catch { alert('操作失败'); } }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors"
          >
            <BellIcon className="w-4 h-4" /> 通知供应商报价
          </button>
          <button
            onClick={async () => { try { await api.distributeCollectiveBatches(); alert('已分发报价'); } catch { alert('操作失败'); } }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" /> 分发集采报价
          </button>
        </div>
      </div>

      {batches.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="暂无集采批次"
          description="当租户选择集采模式并提交需求后，系统会按产品+供应商自动聚合生成集采批次。"
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-medium">集采日期</th>
                <th className="text-left px-4 py-3 font-medium">产品</th>
                <th className="text-left px-4 py-3 font-medium">供应商</th>
                <th className="text-right px-4 py-3 font-medium">需求量</th>
                <th className="text-right px-4 py-3 font-medium">报价</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-left px-4 py-3 font-medium">通知方式</th>
                <th className="text-left px-4 py-3 font-medium">参与方</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches.map(b => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600">{b.batch_date}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{b.product_name}</td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]" title={b.supplier_name}>{b.supplier_name}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">{b.total_quantity}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{b.quoted_price ? `¥${b.quoted_price}` : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-500'}`}>
                      {b.status_display || b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{b.notify_method_display || b.notify_method}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{b.quote_count ?? 0} 家租户</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {quotes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-medium text-gray-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" /> 报价明细
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">类型</th>
                <th className="text-left px-4 py-2.5 font-medium">租户</th>
                <th className="text-left px-4 py-2.5 font-medium">产品</th>
                <th className="text-right px-4 py-2.5 font-medium">数量</th>
                <th className="text-right px-4 py-2.5 font-medium">单价</th>
                <th className="text-right px-4 py-2.5 font-medium">总价</th>
                <th className="text-left px-4 py-2.5 font-medium">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.slice(0, 20).map(q => (
                <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${q.quote_type === 'quick' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                      {q.quote_type_display}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{q.tenant_name || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-700">{q.product_name}</td>
                  <td className="px-4 py-2.5 text-right">{q.quantity}</td>
                  <td className="px-4 py-2.5 text-right">{q.unit_price ? `¥${q.unit_price}` : '-'}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{q.total_price ? `¥${q.total_price}` : '-'}</td>
                  <td className="px-4 py-2.5">
                    <QuoteStatusBadge status={q.status} display={q.status_display} />
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

function QuoteStatusBadge({ status, display }: { status: string; display?: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-500', quoted: 'bg-blue-50 text-blue-600',
    accepted: 'bg-green-50 text-green-600', rejected: 'bg-red-50 text-red-500',
    expired: 'bg-gray-100 text-gray-400', ordered: 'bg-purple-50 text-purple-600',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || colors.pending}`}>
      {display || status}
    </span>
  );
}

function BellIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// ========== 交易统计 Tab ==========
function StatsTab() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPdbStatistics().then(res => {
      setStats(res.data || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (!stats) return <EmptyState icon={BarChart3} title="暂无统计数据" description=" statistics 接口暂无数据返回。" />;

  const payment = stats.payment as Record<string, string>;
  const orders = stats.orders as { total: number; by_status: Record<string, { label: string; count: number }> };
  const suppliers = stats.suppliers as Array<{ id: number; name: string; product_count: number; order_count: number; total_amount: string; commission: string }>;
  const trend = (stats.trend || []) as Array<{ date: string; amount: string }>;

  return (
    <div className="space-y-5">
      {/* 核心指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Banknote} label="交易总额" value={`¥${payment.total_amount || '0'}`} color="blue" />
        <StatCard icon={DollarSign} label="佣金收入" value={`¥${payment.total_commission || '0'}`} color="green" />
        <StatCard icon={ShoppingCart} label="订单总数" value={`${orders.total || 0}`} color="purple" />
        <StatCard icon={CreditCard} label="分账笔数" value={`${payment.total_count || 0}`} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 订单状态分布 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-gray-400" /> 订单状态分布
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(orders.by_status || {}).map(([key, val]) => (
              <div key={key} className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="text-xl font-bold text-gray-900">{val.count}</div>
                <div className="text-xs text-gray-500 mt-1">{val.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 近 7 天趋势 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400" /> 近 7 天交易趋势
          </h3>
          {trend.length > 0 ? (
            <div className="flex items-end gap-2 h-32">
              {trend.map((t, i) => {
                const max = Math.max(...trend.map(x => parseFloat(x.amount) || 0)) || 1;
                const val = parseFloat(t.amount) || 0;
                const pct = (val / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-blue-100 rounded-t-md relative" style={{ height: `${Math.max(pct, 8)}%` }}>
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 whitespace-nowrap">¥{val}</div>
                    </div>
                    <div className="text-[10px] text-gray-400">{t.date}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-sm text-gray-400 bg-gray-50 rounded-lg">
              暂无趋势数据
            </div>
          )}
        </div>
      </div>

      {/* 供应商排行 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrophyIcon className="w-4 h-4 text-gray-400" /> 供应商交易排行
        </h3>
        {suppliers?.length > 0 ? (
          <div className="space-y-2">
            {suppliers.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{s.name}</div>
                  <div className="text-xs text-gray-400">{s.product_count} 个产品 · {s.order_count} 笔订单</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">¥{s.total_amount}</div>
                  <div className="text-xs text-green-600">佣金 ¥{s.commission}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-gray-400">暂无供应商交易数据</div>
        )}
      </div>

      {/* 预留接口提示 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">预留接口说明</p>
          <p className="mt-1 text-xs text-amber-700/80">
            聚合支付服务商（后续选定）· 电子签章服务（后续选定）· 当前支付和签章为模拟实现，接口已预留，后续可直接对接。
          </p>
        </div>
      </div>
    </div>
  );
}

function PieIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

function TrophyIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

// ========== 通用组件 ==========
function QualificationBadge({ status, display }: { status: string; display?: string }) {
  const colors: Record<string, string> = {
    approved: 'bg-green-50 text-green-600 border-green-100',
    pending: 'bg-amber-50 text-amber-600 border-amber-100',
    rejected: 'bg-red-50 text-red-500 border-red-100',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[status] || 'bg-gray-50 text-gray-500 border-gray-100'}`}>
      {display || status}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Building2; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600', amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function ProductDetailModal({ product, onClose }: { product: PdbProduct; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Pill className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-lg">{product.name}</h2>
              {product.trade_name && <p className="text-xs text-gray-400">商品名: {product.trade_name}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 基本信息 */}
          <Section title="基本信息">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InfoItem icon={Package} label="规格" value={product.specification} />
              <InfoItem icon={Factory} label="厂家" value={product.manufacturer} />
              <InfoItem icon={FileText} label="剂型" value={product.dosage_form} />
              <InfoItem icon={DollarSign} label="单价" value={`¥${product.price}/${product.unit}`} />
              <InfoItem icon={Package} label="分类" value={product.category} />
              <InfoItem icon={FileText} label="批准文号" value={product.approval_number} />
              <InfoItem icon={Package} label="最小起订量" value={`${product.min_order_quantity} ${product.unit}`} />
              <InfoItem icon={Shield} label="储存条件" value={product.storage_condition} />
              <InfoItem icon={FileText} label="条形码" value={product.barcode} />
            </div>
          </Section>

          {/* 知识图谱 */}
          {product.knowledge_graph && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> 产品知识图谱（供智能体搜索）
              </div>
              <p className="text-sm text-blue-900 leading-relaxed">{product.knowledge_graph}</p>
            </div>
          )}

          {/* 配送信息 */}
          <Section title="配送与库存">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoItem icon={Truck} label="配送信息" value={product.delivery_info} />
              <InfoItem icon={Truck} label="配送区域" value={product.delivery_areas} />
            </div>
          </Section>

          {/* 可销设置 */}
          <Section title="可销设置">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1.5">可销区域</div>
                {product.sales_regions?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {product.sales_regions.map((r, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">
                        <MapPin className="w-3 h-3 inline mr-0.5" />
                        {r.province}{r.cities?.length ? ` (${r.cities.join('、')})` : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">全国</span>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1.5">可销渠道</div>
                {product.sales_channels?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {product.sales_channels.map((ch) => (
                      <span key={ch} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg">
                        {ch === 'clinic' ? '诊所' : ch === 'pharmacy' ? '药店' : ch === 'hospital' ? '医院' : ch}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">全渠道</span>
                )}
              </div>
            </div>
          </Section>

          {/* 供应商信息 */}
          {product.supplier_info && (
            <Section title="供应商信息">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-gray-400">名称:</span> <span className="text-gray-700">{product.supplier_info.name}</span></div>
                  <div><span className="text-gray-400">编码:</span> <span className="text-gray-700">{product.supplier_info.code}</span></div>
                  <div><span className="text-gray-400">资质:</span> <QualificationBadge status={product.supplier_info.qualification_status} display={product.supplier_info.qualification_status_display} /></div>
                  <div><span className="text-gray-400">联系人:</span> <span className="text-gray-700">{product.supplier_info.contact_name || '-'}</span></div>
                </div>
                {product.supplier_info.qualifications?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">资质文件:</div>
                    <div className="flex flex-wrap gap-2">
                      {product.supplier_info.qualifications.map(q => (
                        <span key={q.id} className="text-xs px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg">
                          {q.qualification_type_display}: {q.qualification_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-sm text-gray-800 truncate" title={value || '-'}>{value || '-'}</div>
      </div>
    </div>
  );
}

function SupplierCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', code: '', supplier_type: 'independent', enterprise_id: '',
    contact_name: '', contact_phone: '', address: '',
    api_base_url: '', api_token: '', payment_account_id: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createPdbSupplier(form);
      onCreated();
    } catch {
      alert('创建失败');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-semibold text-gray-900">添加供应商</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="供应商名称" required value={form.name} onChange={v => setForm({ ...form, name: v })} />
            <FormField label="供应商编码" required value={form.code} onChange={v => setForm({ ...form, code: v })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">供应商类型</label>
              <select
                value={form.supplier_type}
                onChange={e => setForm({ ...form, supplier_type: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="independent">独立供应商</option>
                <option value="saas_platform">SaaS平台</option>
              </select>
            </div>
            <FormField label="统一信用代码" value={form.enterprise_id} onChange={v => setForm({ ...form, enterprise_id: v })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="联系人" value={form.contact_name} onChange={v => setForm({ ...form, contact_name: v })} />
            <FormField label="联系电话" value={form.contact_phone} onChange={v => setForm({ ...form, contact_phone: v })} />
          </div>
          <FormField label="地址" value={form.address} onChange={v => setForm({ ...form, address: v })} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="API地址" value={form.api_base_url} onChange={v => setForm({ ...form, api_base_url: v })} />
            <FormField label="API Token" value={form.api_token} onChange={v => setForm({ ...form, api_token: v })} />
          </div>
          <FormField label="平台收款账户ID" value={form.payment_account_id} onChange={v => setForm({ ...form, payment_account_id: v })} />
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}{required && <span className="text-red-500"> *</span>}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

// ========== 集采公告 Tab ==========

const ANNOUNCEMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
  announced: { label: '已公告', color: 'bg-blue-50 text-blue-600' },
  collecting: { label: '收集中', color: 'bg-amber-50 text-amber-600' },
  quoting: { label: '报价中', color: 'bg-purple-50 text-purple-600' },
  distributed: { label: '已分发', color: 'bg-green-50 text-green-600' },
  ordering: { label: '下单中', color: 'bg-indigo-50 text-indigo-600' },
  closed: { label: '已关闭', color: 'bg-gray-100 text-gray-500' },
  cancelled: { label: '已取消', color: 'bg-red-50 text-red-500' },
};

function AnnouncementTab({ announcements, onRefresh }: {
  announcements: CollectiveAnnouncement[];
  onRefresh: () => void;
}) {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<CollectiveAnnouncement | null>(null);
  const [aggregateData, setAggregateData] = useState<AggregateItem[] | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async (id: number, action: string) => {
    setActionLoading(true);
    try {
      if (action === 'publish') await api.publishAnnouncement(id);
      else if (action === 'aggregate') {
        const res = await api.aggregateAnnouncement(id);
        setAggregateData(res.data || []);
      }
      else if (action === 'push') await api.pushAnnouncementToSuppliers(id);
      else if (action === 'distribute') await api.distributeAnnouncement(id);
      else if (action === 'close') await api.closeAnnouncement(id);
      else if (action === 'cancel') await api.cancelAnnouncement(id);
      onRefresh();
      if (selectedAnnouncement?.id === id) {
        const res = await api.getAnnouncement(id);
        setSelectedAnnouncement(res.data || null);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (announcements.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="暂无集采公告"
        description="创建集采公告后，系统将通知所有租户参与集采。租户提交需求后，平台汇总并推送供应商报价。"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>共 {announcements.length} 个公告</span>
        <button onClick={onRefresh} className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
          <RefreshCw className="w-3.5 h-3.5" /> 刷新
        </button>
      </div>
      <div className="space-y-3">
        {announcements.map(a => {
          const cfg = ANNOUNCEMENT_STATUS_CONFIG[a.status] || { label: a.status, color: 'bg-gray-100 text-gray-500' };
          return (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{a.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  {a.description && <p className="mt-1 text-sm text-gray-500 line-clamp-2">{a.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> 公告：{new Date(a.announce_time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 报价截止：{new Date(a.quote_deadline).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> 下单截止：{new Date(a.order_deadline).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {a.product_keywords && <span className="text-blue-600">关键词：{a.product_keywords}</span>}
                    <span className="flex items-center gap-1 text-gray-500"><Users className="w-3 h-3" /> {a.participation_count ?? 0} 家租户参与</span>
                    <span className="text-gray-500">总需求量：{a.total_quantity ?? 0}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => { setSelectedAnnouncement(a); setAggregateData(null); }}
                    className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
                  >
                    <ChevronRight className="w-3 h-3" /> 详情
                  </button>
                </div>
              </div>
              {/* 状态操作按钮 */}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                {a.status === 'draft' && (
                  <button onClick={() => handleAction(a.id, 'publish')} disabled={actionLoading}
                    className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50">
                    <PlayCircle className="w-3 h-3" /> 发布公告
                  </button>
                )}
                {a.status === 'collecting' && (
                  <>
                    <button onClick={() => handleAction(a.id, 'aggregate')} disabled={actionLoading}
                      className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50">
                      <BarChart3 className="w-3 h-3" /> 汇总需求
                    </button>
                    <button onClick={() => handleAction(a.id, 'push')} disabled={actionLoading}
                      className="text-xs text-white bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50">
                      <Send className="w-3 h-3" /> 推送供应商
                    </button>
                  </>
                )}
                {a.status === 'quoting' && (
                  <button onClick={() => handleAction(a.id, 'distribute')} disabled={actionLoading}
                    className="text-xs text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50">
                    <ArrowUpRight className="w-3 h-3" /> 分发报价
                  </button>
                )}
                {['collecting', 'quoting', 'distributed', 'ordering'].includes(a.status) && (
                  <button onClick={() => handleAction(a.id, 'close')} disabled={actionLoading}
                    className="text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50">
                    <CheckCircle2 className="w-3 h-3" /> 关闭
                  </button>
                )}
                {['draft', 'collecting'].includes(a.status) && (
                  <button onClick={() => handleAction(a.id, 'cancel')} disabled={actionLoading}
                    className="text-xs text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50">
                    <XCircle className="w-3 h-3" /> 取消
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 公告详情弹窗 */}
      {selectedAnnouncement && (
        <AnnouncementDetailModal
          announcement={selectedAnnouncement}
          aggregateData={aggregateData}
          onClose={() => { setSelectedAnnouncement(null); setAggregateData(null); }}
          onRefresh={async () => {
            onRefresh();
            const res = await api.getAnnouncement(selectedAnnouncement.id);
            setSelectedAnnouncement(res.data || null);
          }}
        />
      )}
    </div>
  );
}

function AnnouncementDetailModal({ announcement, aggregateData, onClose, onRefresh }: {
  announcement: CollectiveAnnouncement;
  aggregateData: AggregateItem[] | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleAggregate = async () => {
    setLoading(true);
    try {
      const res = await api.aggregateAnnouncement(announcement.id);
      // Since aggregate returns data in the response, we need to pass it up
      // But the parent manages aggregateData state, so we just refresh
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '汇总失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{announcement.title}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${ANNOUNCEMENT_STATUS_CONFIG[announcement.status]?.color || 'bg-gray-100 text-gray-500'}`}>
                {ANNOUNCEMENT_STATUS_CONFIG[announcement.status]?.label || announcement.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {announcement.description && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">{announcement.description}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">公告时间</div>
              <div className="text-sm font-medium text-gray-900 mt-1">{new Date(announcement.announce_time).toLocaleString('zh-CN')}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">报价截止</div>
              <div className="text-sm font-medium text-gray-900 mt-1">{new Date(announcement.quote_deadline).toLocaleString('zh-CN')}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">下单截止</div>
              <div className="text-sm font-medium text-gray-900 mt-1">{new Date(announcement.order_deadline).toLocaleString('zh-CN')}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">参与情况</div>
              <div className="text-sm font-medium text-gray-900 mt-1">{announcement.participation_count ?? 0} 家租户 · 总需求 {announcement.total_quantity ?? 0}</div>
            </div>
          </div>
          {announcement.product_keywords && (
            <div>
              <div className="text-xs text-gray-500 mb-1">产品关键词</div>
              <div className="flex flex-wrap gap-1">
                {announcement.product_keywords.split(',').map((kw, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{kw.trim()}</span>
                ))}
              </div>
            </div>
          )}
          {/* 汇总需求 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">汇总需求</h3>
              <button onClick={handleAggregate} disabled={loading}
                className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md flex items-center gap-1 disabled:opacity-50">
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />} 重新汇总
              </button>
            </div>
            {aggregateData && aggregateData.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">产品</th>
                      <th className="text-left px-3 py-2 font-medium">供应商</th>
                      <th className="text-right px-3 py-2 font-medium">需求量</th>
                      <th className="text-center px-3 py-2 font-medium">租户数</th>
                      <th className="text-right px-3 py-2 font-medium">库存</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {aggregateData.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{item.product_name}</td>
                        <td className="px-3 py-2 text-gray-600">{item.supplier_name}</td>
                        <td className="px-3 py-2 text-right font-medium">{item.total_quantity}</td>
                        <td className="px-3 py-2 text-center text-gray-500">{item.tenant_count}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{item.stock_quantity ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-gray-400 bg-gray-50 rounded-lg">
                {announcement.participation_count ? '点击"重新汇总"查看需求聚合' : '暂无租户参与'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnnouncementCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', quote_deadline: '', order_deadline: '',
    product_keywords: '', supplier_ids: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.quote_deadline || !form.order_deadline) {
      alert('请填写报价截止时间和下单截止时间');
      return;
    }
    setSaving(true);
    try {
      await api.createAnnouncement(form);
      onCreated();
    } catch (e) {
      alert(e instanceof Error ? e.message : '创建失败');
      setSaving(false);
    }
  };

  const formatDatetimeLocal = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600" /> 创建集采公告
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <FormField label="公告标题" required value={form.title} onChange={v => setForm({ ...form, title: v })} />
          <div>
            <label className="text-xs text-gray-500">公告描述</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="描述本次集采的目的和范围..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">报价截止时间 <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={form.quote_deadline}
                onChange={e => setForm({ ...form, quote_deadline: e.target.value })}
                defaultValue={formatDatetimeLocal(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">下单截止时间 <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={form.order_deadline}
                onChange={e => setForm({ ...form, order_deadline: e.target.value })}
                defaultValue={formatDatetimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="产品关键词（逗号分隔，空=全部）" value={form.product_keywords} onChange={v => setForm({ ...form, product_keywords: v })} />
            <FormField label="指定供应商ID（逗号分隔，空=全部）" value={form.supplier_ids} onChange={v => setForm({ ...form, supplier_ids: v })} />
          </div>
          <FormField label="备注" value={form.notes} onChange={v => setForm({ ...form, notes: v })} />
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? '创建中...' : '创建公告'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== 配送规则 Tab ==========

function DeliveryRuleTab({ rules, suppliers, onRefresh }: {
  rules: SupplierDeliveryRule[];
  suppliers: PdbSupplier[];
  onRefresh: () => void;
}) {
  const [editingRule, setEditingRule] = useState<SupplierDeliveryRule | null>(null);
  const [filterSupplier, setFilterSupplier] = useState('');

  const filteredRules = filterSupplier
    ? rules.filter(r => r.supplier === parseInt(filterSupplier))
    : rules;

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这条配送规则吗？')) return;
    try {
      await api.deleteDeliveryRule(id);
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleToggle = async (rule: SupplierDeliveryRule) => {
    try {
      await api.updateDeliveryRule(rule.id, { enabled: !rule.enabled });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
    }
  };

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="暂无配送规则"
        description="为供应商设置不同省市的配送时长和起订金额。系统将根据租户所在区域自动匹配最优配送规则。"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={filterSupplier}
          onChange={e => setFilterSupplier(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部供应商</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="text-sm text-gray-500 whitespace-nowrap">共 {filteredRules.length} 条规则</div>
        <button onClick={onRefresh} className="ml-auto flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
          <RefreshCw className="w-3.5 h-3.5" /> 刷新
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
            <tr>
              <th className="text-left px-4 py-3 font-medium">供应商</th>
              <th className="text-left px-4 py-3 font-medium">省份</th>
              <th className="text-left px-4 py-3 font-medium">城市</th>
              <th className="text-center px-4 py-3 font-medium">配送时长</th>
              <th className="text-right px-4 py-3 font-medium">起订金额</th>
              <th className="text-center px-4 py-3 font-medium">状态</th>
              <th className="text-center px-4 py-3 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRules.map(r => (
              <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Store className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-medium text-gray-900 truncate max-w-[160px]" title={r.supplier_name || ''}>{r.supplier_name || `供应商#${r.supplier}`}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {r.province ? (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400" />{r.province}</span>
                  ) : <span className="text-gray-400">全国</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">{r.city || <span className="text-gray-400">全省</span>}</td>
                <td className="px-4 py-3 text-center">
                  <span className="flex items-center justify-center gap-1 text-blue-600">
                    <Clock className="w-3.5 h-3.5" />
                    {r.delivery_hours}h
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">¥{r.min_order_amount}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggle(r)}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${r.enabled ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {r.enabled ? '已启用' : '已禁用'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => setEditingRule(r)}
                      className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> 编辑
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> 删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 编辑弹窗 */}
      {editingRule && (
        <DeliveryRuleEditModal
          rule={editingRule}
          suppliers={suppliers}
          onClose={() => setEditingRule(null)}
          onSaved={() => { setEditingRule(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

function DeliveryRuleCreateModal({ suppliers, onClose, onCreated }: {
  suppliers: PdbSupplier[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    supplier: '', province: '', city: '',
    delivery_hours: '48', min_order_amount: '0', enabled: true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier) { alert('请选择供应商'); return; }
    setSaving(true);
    try {
      await api.createDeliveryRule({
        supplier: parseInt(form.supplier),
        province: form.province,
        city: form.city,
        delivery_hours: parseInt(form.delivery_hours) || 48,
        min_order_amount: form.min_order_amount,
        enabled: form.enabled,
      });
      onCreated();
    } catch (e) {
      alert(e instanceof Error ? e.message : '创建失败');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" /> 添加配送规则
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500">供应商 <span className="text-red-500">*</span></label>
            <select
              value={form.supplier}
              onChange={e => setForm({ ...form, supplier: e.target.value })}
              required
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择供应商</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="省份（空=全国）" value={form.province} onChange={v => setForm({ ...form, province: v })} />
            <FormField label="城市（空=全省）" value={form.city} onChange={v => setForm({ ...form, city: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">配送时长（小时）</label>
              <input
                type="number"
                value={form.delivery_hours}
                onChange={e => setForm({ ...form, delivery_hours: e.target.value })}
                min={1}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">起订金额（元）</label>
              <input
                type="text"
                value={form.min_order_amount}
                onChange={e => setForm({ ...form, min_order_amount: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="text-sm text-gray-600">启用此规则</label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? '创建中...' : '创建规则'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeliveryRuleEditModal({ rule, suppliers, onClose, onSaved }: {
  rule: SupplierDeliveryRule;
  suppliers: PdbSupplier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    supplier: String(rule.supplier),
    province: rule.province,
    city: rule.city,
    delivery_hours: String(rule.delivery_hours),
    min_order_amount: rule.min_order_amount,
    enabled: rule.enabled,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateDeliveryRule(rule.id, {
        province: form.province,
        city: form.city,
        delivery_hours: parseInt(form.delivery_hours) || 48,
        min_order_amount: form.min_order_amount,
        enabled: form.enabled,
      });
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-600" /> 编辑配送规则
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500">供应商</label>
            <div className="mt-1 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
              {rule.supplier_name || `供应商#${rule.supplier}`}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="省份（空=全国）" value={form.province} onChange={v => setForm({ ...form, province: v })} />
            <FormField label="城市（空=全省）" value={form.city} onChange={v => setForm({ ...form, city: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">配送时长（小时）</label>
              <input
                type="number"
                value={form.delivery_hours}
                onChange={e => setForm({ ...form, delivery_hours: e.target.value })}
                min={1}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">起订金额（元）</label>
              <input
                type="text"
                value={form.min_order_amount}
                onChange={e => setForm({ ...form, min_order_amount: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="text-sm text-gray-600">启用此规则</label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== 供应商账号管理 ==========
function AccountsTab({ accounts, suppliers, onRefresh }: {
  accounts: SupplierAccount[];
  suppliers: PdbSupplier[];
  onRefresh: () => void;
}) {
  const [editingAccount, setEditingAccount] = useState<SupplierAccount | null>(null);
  const [showToken, setShowToken] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);

  const toggleToken = (id: number) => setShowToken(prev => ({ ...prev, [id]: !prev[id] }));

  const handleToggleEnabled = async (account: SupplierAccount) => {
    try {
      await api.updateSupplierAccount(account.id, { enabled: !account.enabled });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该供应商账号吗？此操作不可撤销。')) return;
    try {
      await api.deleteSupplierAccount(id);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleResetPassword = async (account: SupplierAccount) => {
    const newPwd = prompt('请输入新密码（至少6位）：');
    if (!newPwd) return;
    if (newPwd.length < 6) { alert('密码至少6位'); return; }
    try {
      await api.updateSupplierAccount(account.id, { password: newPwd });
      alert('密码重置成功');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '重置失败');
    }
  };

  const handleRegenToken = async (account: SupplierAccount) => {
    if (!confirm('重新生成 Token 后，旧 Token 将立即失效，供应商需要重新登录。确定继续？')) return;
    try {
      const res = await api.updateSupplierAccount(account.id, { regenerate_token: true });
      alert(`Token 已重新生成: ${res.data.api_token}`);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleUpdateInfo = async () => {
    if (!editingAccount) return;
    setSaving(true);
    try {
      await api.updateSupplierAccount(editingAccount.id, {
        contact_name: editingAccount.contact_name,
        contact_phone: editingAccount.contact_phone,
      });
      setEditingAccount(null);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '更新失败');
    } finally {
      setSaving(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <EmptyState icon={Key} title="暂无供应商账号" description="创建一个供应商账号，供应商即可登录门户管理产品、订单等" />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 text-xs uppercase">
              <th className="py-3 px-3 font-medium">供应商</th>
              <th className="py-3 px-3 font-medium">用户名</th>
              <th className="py-3 px-3 font-medium">联系人</th>
              <th className="py-3 px-3 font-medium">联系电话</th>
              <th className="py-3 px-3 font-medium">Token</th>
              <th className="py-3 px-3 font-medium">状态</th>
              <th className="py-3 px-3 font-medium">最后登录</th>
              <th className="py-3 px-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(account => (
              <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${account.enabled ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                      {(account.supplier_name || 'S').charAt(0)}
                    </div>
                    <span className="font-medium text-gray-900">{account.supplier_name}</span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{account.username}</code>
                </td>
                <td className="py-3 px-3 text-gray-600">{account.contact_name || '-'}</td>
                <td className="py-3 px-3 text-gray-600">{account.contact_phone || '-'}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1">
                    <code className="text-xs text-gray-400 max-w-[120px] truncate">
                      {showToken[account.id] ? account.api_token : account.api_token ? account.api_token.slice(0, 12) + '...' : '-'}
                    </code>
                    {account.api_token && (
                      <button onClick={() => toggleToken(account.id)} className="p-1 hover:bg-gray-100 rounded" title={showToken[account.id] ? '隐藏' : '显示'}>
                        {showToken[account.id] ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <button
                    onClick={() => handleToggleEnabled(account)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                      account.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {account.enabled ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {account.enabled ? '已启用' : '已禁用'}
                  </button>
                </td>
                <td className="py-3 px-3 text-gray-500 text-xs">
                  {account.last_login_at ? new Date(account.last_login_at).toLocaleString('zh-CN') : '从未登录'}
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditingAccount(account)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑信息">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleResetPassword(account)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="重置密码">
                      <Key className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleRegenToken(account)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="重新生成 Token">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(account.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="删除账号">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Info Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingAccount(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">编辑账号信息</h3>
              <button onClick={() => setEditingAccount(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">供应商</label>
                <div className="mt-1 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
                  {editingAccount.supplier_name}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">用户名</label>
                <div className="mt-1 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
                  {editingAccount.username}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">联系人</label>
                <input
                  type="text"
                  value={editingAccount.contact_name}
                  onChange={e => setEditingAccount({ ...editingAccount, contact_name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">联系电话</label>
                <input
                  type="text"
                  value={editingAccount.contact_phone}
                  onChange={e => setEditingAccount({ ...editingAccount, contact_phone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setEditingAccount(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleUpdateInfo} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== 创建供应商账号模态框 ==========
function AccountCreateModal({ suppliers, onClose, onCreated }: {
  suppliers: PdbSupplier[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ supplier_id: 0, username: '', password: '', contact_name: '', contact_phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id || !form.username.trim() || !form.password.trim()) {
      setError('供应商、用户名、密码不能为空');
      return;
    }
    if (form.password.trim().length < 6) {
      setError('密码至少6位');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createSupplierAccount({
        supplier_id: form.supplier_id,
        username: form.username.trim(),
        password: form.password.trim(),
        contact_name: form.contact_name.trim(),
        contact_phone: form.contact_phone.trim(),
      });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">创建供应商账号</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">关联供应商 <span className="text-red-400">*</span></label>
            <select
              value={form.supplier_id}
              onChange={e => setForm({ ...form, supplier_id: Number(e.target.value) })}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>请选择供应商</option>
              {suppliers.filter(s => s.enabled).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">登录用户名 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              placeholder="例如：jzt"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">登录密码 <span className="text-red-400">*</span></label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="至少6位"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">联系人</label>
              <input
                type="text"
                value={form.contact_name}
                onChange={e => setForm({ ...form, contact_name: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">联系电话</label>
              <input
                type="text"
                value={form.contact_phone}
                onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? '创建中...' : '创建账号'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
