import { useState, useEffect, useCallback } from 'react'
import {
  X, RefreshCw, Package, Users, Clock, TrendingDown, Store, Loader2,
  ShoppingCart, CheckCircle, AlertCircle, Megaphone,
} from 'lucide-react'
import { getApiClient } from '../lib/api'

// ========== 类型定义 ==========

interface Announcement {
  id: number
  title: string
  description: string
  status: string
  status_display?: string
  quote_deadline: string
  order_deadline: string
  product_keywords?: string
  notes?: string
  created_at: string
}

interface Participation {
  id: number
  announcement: number
  announcement_title?: string
  product_id: number
  product_name: string
  product_spec?: string
  product_manufacturer?: string
  product_unit?: string
  supplier_id: number
  supplier_name?: string
  quantity: number
  final_quantity?: number
  quoted_unit_price?: string
  total_price?: string
  status: string
  status_display?: string
  notes?: string
  created_at: string
}

interface AggregateItem {
  product_id: number
  product_name: string
  supplier_id: number
  supplier_name: string
  total_quantity: number
  tenant_count: number
  quoted_unit_price?: string
}

const ANNOUNCEMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
  collecting: { label: '需求收集中', color: 'bg-blue-100 text-blue-600' },
  quoting: { label: '供应商报价中', color: 'bg-orange-100 text-orange-600' },
  distributed: { label: '报价已分发', color: 'bg-emerald-100 text-emerald-600' },
  ordering: { label: '下单中', color: 'bg-purple-100 text-purple-600' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-600' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600' },
}

const PARTICIPATION_STATUS_MAP: Record<string, { label: string; color: string }> = {
  registered: { label: '已登记', color: 'bg-blue-100 text-blue-600' },
  quoted: { label: '已报价', color: 'bg-orange-100 text-orange-600' },
  adjusted: { label: '已调整', color: 'bg-purple-100 text-purple-600' },
  ordered: { label: '已下单', color: 'bg-emerald-100 text-emerald-600' },
  declined: { label: '已拒绝', color: 'bg-red-100 text-red-600' },
}

// ========== 集采面板主组件 ==========

export default function CollectivePurchasePanel({ onClose, onSelectOrder }: {
  onClose: () => void
  onSelectOrder: (orderId: number) => void
}) {
  const [tab, setTab] = useState<'announcements' | 'participations'>('announcements')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [participations, setParticipations] = useState<Participation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const client = getApiClient()
      const tenantId = (client as any).tenantId || localStorage.getItem('yesgo_tenant_id') || '1'

      const [annResp, partResp] = await Promise.all([
        client.pdb.announcements(),
        client.pdb.participations({ tenant_id: String(tenantId) }),
      ])

      if (annResp.code === 0 && annResp.data) {
        const raw = annResp.data
        setAnnouncements(Array.isArray(raw) ? raw : (raw as any)?.items || [])
      }
      if (partResp.code === 0 && partResp.data) {
        const raw = partResp.data
        setParticipations(Array.isArray(raw) ? raw : (raw as any)?.items || [])
      }
    } catch {
      // 静默
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl animate-slide-in-right">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-text-primary">集采中心</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover"
              title="刷新"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-border-subtle">
          <button
            onClick={() => setTab('announcements')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === 'announcements'
                ? 'border-b-2 border-purple-500 text-purple-600'
                : 'text-text-muted hover:bg-bg-hover'
            }`}
          >
            集采公告 ({announcements.length})
          </button>
          <button
            onClick={() => setTab('participations')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === 'participations'
                ? 'border-b-2 border-purple-500 text-purple-600'
                : 'text-text-muted hover:bg-bg-hover'
            }`}
          >
            我的参与 ({participations.length})
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : tab === 'announcements' ? (
            announcements.length === 0 ? (
              <EmptyState icon={Megaphone} text="暂无集采公告" subtext="平台发布集采公告后将显示在这里" />
            ) : (
              <div className="space-y-2">
                {announcements.map((ann) => {
                  const statusCfg = ANNOUNCEMENT_STATUS_MAP[ann.status] || { label: ann.status, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <button
                      key={ann.id}
                      onClick={() => setSelectedAnnouncementId(ann.id)}
                      className="w-full rounded-xl border border-border-subtle bg-white p-3 text-left transition-all hover:border-purple-300 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-text-primary truncate">{ann.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      {ann.description && (
                        <p className="mt-1 text-xs text-text-muted line-clamp-2">{ann.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                        {ann.product_keywords && (
                          <span className="flex items-center gap-0.5">
                            <Package className="h-3 w-3" />
                            {ann.product_keywords}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          报价截止 {new Date(ann.quote_deadline).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          ) : participations.length === 0 ? (
            <EmptyState icon={ShoppingCart} text="暂无集采参与" subtext="加入集采后您的参与记录将显示在这里" />
          ) : (
            <div className="space-y-2">
              {participations.map((part) => (
                <ParticipationCard
                  key={part.id}
                  participation={part}
                  onUpdate={loadData}
                  onSelectOrder={onSelectOrder}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 公告详情弹窗 */}
      {selectedAnnouncementId && (
        <AnnouncementDetailModal
          announcementId={selectedAnnouncementId}
          onClose={() => setSelectedAnnouncementId(null)}
          onParticipated={loadData}
        />
      )}
    </div>
  )
}

// ========== 空状态 ==========

function EmptyState({ icon: Icon, text, subtext }: { icon: typeof Package; text: string; subtext: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="mb-3 h-12 w-12 text-text-muted/30" />
      <p className="text-sm text-text-muted">{text}</p>
      <p className="mt-1 text-xs text-text-muted/70">{subtext}</p>
    </div>
  )
}

// ========== 公告详情弹窗 ==========

function AnnouncementDetailModal({ announcementId, onClose, onParticipated }: {
  announcementId: number
  onClose: () => void
  onParticipated: () => void
}) {
  const [detail, setDetail] = useState<any>(null)
  const [aggregate, setAggregate] = useState<AggregateItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<number>(0)
  const [selectedSupplierId, setSelectedSupplierId] = useState<number>(0)
  const [quantity, setQuantity] = useState(10)
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: string }>({ show: false, msg: '', type: 'info' })

  const showToast = (msg: string, type: string = 'info') => {
    setToast({ show: true, msg, type })
    setTimeout(() => setToast({ show: false, msg: '', type: 'info' }), 3000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const client = getApiClient()
      const [detailResp, aggResp] = await Promise.all([
        client.pdb.announcementDetail(announcementId),
        client.pdb.aggregateDemand(announcementId),
      ])
      if (detailResp.code === 0 && detailResp.data) {
        setDetail(detailResp.data)
      }
      if (aggResp.code === 0 && aggResp.data) {
        const raw = aggResp.data
        setAggregate(Array.isArray(raw) ? raw : (raw as any)?.items || (raw as any)?.aggregates || [])
      }

      // 加载产品列表供选择
      const prodResp = await client.pdb.products({ page_size: 20 })
      if (prodResp.code === 0 && prodResp.data) {
        const rawProd = prodResp.data
        const prodList = Array.isArray(rawProd) ? rawProd : (rawProd as any)?.items || (rawProd as any)?.results || []
        setProducts(prodList)
        if (prodList.length > 0) {
          setSelectedProductId(prodList[0].id)
          setSelectedSupplierId(prodList[0].supplier_id || 0)
        }
      }
    } catch {
      // 静默
    } finally {
      setLoading(false)
    }
  }, [announcementId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleJoin = async () => {
    if (!selectedProductId || !selectedSupplierId || quantity < 1) {
      showToast('请选择产品和供应商，并输入有效数量', 'error')
      return
    }
    setJoining(true)
    try {
      const client = getApiClient()
      const tenantId = (client as any).tenantId || localStorage.getItem('yesgo_tenant_id') || '1'
      const resp = await client.pdb.registerParticipation({
        announcement_id: announcementId,
        tenant_id: String(tenantId),
        product_id: selectedProductId,
        supplier_id: selectedSupplierId,
        quantity,
      })
      if (resp.code === 0) {
        showToast('成功加入集采！', 'success')
        onParticipated()
        loadData()
      } else {
        showToast(`加入失败：${resp.msg}`, 'error')
      }
    } catch {
      showToast('操作失败，请稍后重试', 'error')
    } finally {
      setJoining(false)
    }
  }

  const statusCfg = detail ? (ANNOUNCEMENT_STATUS_MAP[detail.status] || { label: detail.status, color: 'bg-gray-100 text-gray-600' }) : null
  const canJoin = detail && ['collecting', 'quoting'].includes(detail.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      {toast.show && (
        <div className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
          'bg-gray-800 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h3 className="text-lg font-semibold text-text-primary">集采公告详情</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : !detail ? (
            <div className="py-12 text-center text-sm text-text-muted">公告不存在或加载失败</div>
          ) : (
            <div className="space-y-4">
              {/* 公告信息 */}
              <div className="rounded-xl bg-purple-50 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-text-primary">{detail.title}</h2>
                  {statusCfg && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  )}
                </div>
                {detail.description && (
                  <p className="mt-2 text-sm text-text-secondary">{detail.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                  {detail.product_keywords && (
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {detail.product_keywords}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    报价截止：{new Date(detail.quote_deadline).toLocaleString('zh-CN')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    下单截止：{new Date(detail.order_deadline).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>

              {/* 汇总需求 */}
              {aggregate.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <Users className="h-4 w-4" />
                    需求汇总
                  </div>
                  <div className="space-y-2">
                    {aggregate.map((agg, i) => (
                      <div key={i} className="rounded-lg border border-border-subtle p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-text-primary">{agg.product_name}</div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-muted">
                              <Store className="h-3 w-3" />
                              {agg.supplier_name}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className="text-sm font-bold text-purple-600">{agg.total_quantity} 件</span>
                            <span className="text-[10px] text-text-muted">{agg.tenant_count} 家租户</span>
                          </div>
                        </div>
                        {agg.quoted_unit_price && (
                          <div className="mt-1.5 flex items-center justify-between border-t border-border-subtle pt-1.5">
                            <span className="flex items-center gap-1 text-xs text-orange-500">
                              <TrendingDown className="h-3 w-3" />
                              报价：¥{agg.quoted_unit_price}/件
                            </span>
                            <span className="text-xs font-medium text-red-500">
                              合计 ¥{(parseFloat(agg.quoted_unit_price) * agg.total_quantity).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 加入集采表单 */}
              {canJoin && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4">
                  <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <ShoppingCart className="h-4 w-4 text-purple-500" />
                    加入集采
                  </div>
                  <div className="space-y-3">
                    {/* 产品选择 */}
                    <div>
                      <label className="text-xs text-text-muted">选择产品</label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => {
                          const prodId = parseInt(e.target.value)
                          setSelectedProductId(prodId)
                          const prod = products.find(p => p.id === prodId)
                          if (prod) setSelectedSupplierId(prod.supplier_id || 0)
                        }}
                        className="mt-1 w-full rounded-lg border border-border-subtle px-3 py-2 text-sm"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.specification ? `(${p.specification})` : ''} - {p.supplier_name || '供应商'}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* 数量 */}
                    <div>
                      <label className="text-xs text-text-muted">采购数量</label>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 10))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-text-muted hover:bg-bg-hover"
                        >-</button>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20 rounded-lg border border-border-subtle px-3 py-1.5 text-center text-sm"
                          min={1}
                        />
                        <button
                          onClick={() => setQuantity(quantity + 10)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-text-muted hover:bg-bg-hover"
                        >+</button>
                        <div className="ml-2 flex gap-1">
                          {[10, 50, 100, 500].map(n => (
                            <button
                              key={n}
                              onClick={() => setQuantity(n)}
                              className="rounded-full bg-white px-2 py-0.5 text-[10px] text-text-muted hover:bg-bg-hover"
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleJoin}
                      disabled={joining || !selectedProductId}
                      className="w-full rounded-xl bg-purple-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-600 disabled:opacity-50"
                    >
                      {joining ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : '加入集采'}
                    </button>
                  </div>
                </div>
              )}

              {!canJoin && detail.status === 'distributed' && (
                <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
                  <CheckCircle className="mb-1 inline h-4 w-4 mr-1" />
                  报价已分发，请在"我的参与"中查看报价并调整数量
                </div>
              )}

              {!canJoin && ['ordering', 'completed'].includes(detail.status) && (
                <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-600">
                  <AlertCircle className="mb-1 inline h-4 w-4 mr-1" />
                  {detail.status === 'completed' ? '集采已完成' : '集采下单中，请在"我的参与"中完成下单'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ========== 参与记录卡片 ==========

function ParticipationCard({ participation, onUpdate, onSelectOrder }: {
  participation: Participation
  onUpdate: () => void
  onSelectOrder: (orderId: number) => void
}) {
  const [adjusting, setAdjusting] = useState(false)
  const [adjustQty, setAdjustQty] = useState(participation.final_quantity || participation.quantity)
  const [ordering, setOrdering] = useState(false)
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: string }>({ show: false, msg: '', type: 'info' })

  const showToast = (msg: string, type: string = 'info') => {
    setToast({ show: true, msg, type })
    setTimeout(() => setToast({ show: false, msg: '', type: 'info' }), 3000)
  }

  const statusCfg = PARTICIPATION_STATUS_MAP[participation.status] || { label: participation.status, color: 'bg-gray-100 text-gray-600' }
  const canAdjust = participation.status === 'quoted' || participation.status === 'distributed' || participation.status === 'adjusted'
  const canOrder = ['quoted', 'adjusted', 'distributed'].includes(participation.status)
  const hasQuote = participation.quoted_unit_price != null

  const handleAdjust = async () => {
    setAdjusting(true)
    try {
      const client = getApiClient()
      const resp = await client.pdb.adjustParticipation(participation.id, adjustQty)
      if (resp.code === 0) {
        showToast('数量已调整', 'success')
        onUpdate()
      } else {
        showToast(`调整失败：${resp.msg}`, 'error')
      }
    } catch {
      showToast('操作失败', 'error')
    } finally {
      setAdjusting(false)
    }
  }

  const handleOrder = async () => {
    setOrdering(true)
    try {
      const client = getApiClient()
      const resp = await client.pdb.orderFromParticipation(participation.id, 'wechat')
      if (resp.code === 0 && resp.data) {
        const orderId = (resp.data as any)?.id || (resp.data as any)?.order?.id || 0
        showToast('订单已创建！', 'success')
        if (orderId) {
          setTimeout(() => onSelectOrder(orderId), 1000)
        }
        onUpdate()
      } else {
        showToast(`下单失败：${resp.msg}`, 'error')
      }
    } catch {
      showToast('操作失败', 'error')
    } finally {
      setOrdering(false)
    }
  }

  const handleDecline = async () => {
    try {
      const client = getApiClient()
      const resp = await client.pdb.declineParticipation(participation.id)
      if (resp.code === 0) {
        showToast('已拒绝报价', 'success')
        onUpdate()
      } else {
        showToast(`操作失败：${resp.msg}`, 'error')
      }
    } catch {
      showToast('操作失败', 'error')
    }
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-white p-3">
      {toast.show && (
        <div className={`mb-2 rounded-lg px-3 py-1.5 text-xs ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
          toast.type === 'error' ? 'bg-red-50 text-red-600' :
          'bg-gray-50 text-gray-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* 产品信息 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary">{participation.product_name}</div>
          {participation.product_spec && (
            <div className="mt-0.5 text-[11px] text-text-secondary">{participation.product_spec}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-muted">
            {participation.supplier_name && (
              <span className="flex items-center gap-0.5">
                <Store className="h-3 w-3" />
                {participation.supplier_name}
              </span>
            )}
            <span>登记数量：{participation.quantity}{participation.product_unit || '件'}</span>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* 报价信息 */}
      {hasQuote && (
        <div className="mt-2 rounded-lg bg-orange-50 p-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-orange-600">
              <TrendingDown className="h-3 w-3" />
              报价单价
            </span>
            <span className="text-sm font-bold text-red-500">¥{participation.quoted_unit_price}/{participation.product_unit || '件'}</span>
          </div>
          {participation.total_price && (
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-text-muted">
              <span>合计</span>
              <span className="font-medium text-text-primary">¥{participation.total_price}</span>
            </div>
          )}
        </div>
      )}

      {/* 调整数量 */}
      {canAdjust && hasQuote && (
        <div className="mt-2 flex items-center gap-2 border-t border-border-subtle pt-2">
          <span className="text-xs text-text-muted">调整数量：</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAdjustQty(Math.max(1, adjustQty - 5))}
              className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-bg-hover"
            >-</button>
            <input
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 rounded border border-border-subtle px-2 py-0.5 text-center text-xs"
              min={1}
            />
            <button
              onClick={() => setAdjustQty(adjustQty + 5)}
              className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-bg-hover"
            >+</button>
          </div>
          <button
            onClick={handleAdjust}
            disabled={adjusting}
            className="ml-auto rounded-lg bg-purple-100 px-3 py-1 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-200 disabled:opacity-50"
          >
            {adjusting ? <Loader2 className="h-3 w-3 animate-spin" /> : '确认调整'}
          </button>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="mt-2 flex items-center gap-2">
        {canOrder && hasQuote && (
          <button
            onClick={handleOrder}
            disabled={ordering}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            {ordering ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
            下单支付
          </button>
        )}
        {canOrder && hasQuote && (
          <button
            onClick={handleDecline}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100"
          >
            拒绝
          </button>
        )}
        {participation.status === 'ordered' && (
          <div className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-50 py-1.5 text-xs text-emerald-600">
            <CheckCircle className="h-3 w-3" />
            已下单
          </div>
        )}
        {participation.status === 'declined' && (
          <div className="flex w-full items-center justify-center gap-1 rounded-lg bg-red-50 py-1.5 text-xs text-red-500">
            <X className="h-3 w-3" />
            已拒绝
          </div>
        )}
        {!hasQuote && participation.status === 'registered' && (
          <div className="flex w-full items-center justify-center gap-1 rounded-lg bg-blue-50 py-1.5 text-xs text-blue-500">
            <Clock className="h-3 w-3" />
            等待供应商报价
          </div>
        )}
      </div>
    </div>
  )
}
