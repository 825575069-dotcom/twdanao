import { useMemo, useState, useEffect, useCallback } from 'react'
import { Wallet, RefreshCcw, Check, Plus, X, ShoppingCart } from 'lucide-react'
import { useStore, type CreditEntry } from '../store/appStore'
import {
  rechargeCredits,
  fetchCreditPackages,
  createCreditOrder,
  fetchCreditOrders,
  type CreditPackageInfo,
  type CreditOrderInfo,
} from '../lib/backend'
import RabbitHead from './RabbitHead'
import { AGENT_LABELS, type AgentCode } from '../lib/constants'

// 降级套餐（后端未连接时显示）
const FALLBACK_PACKAGES = [
  { id: 0, credits: 1000, price: '99', bonus_credits: 0, name: '体验包', is_popular: false, enabled: true },
  { id: 0, credits: 5000, price: '449', bonus_credits: 0, name: '标准包', is_popular: true, enabled: true },
  { id: 0, credits: 20000, price: '1599', bonus_credits: 0, name: '企业包', is_popular: false, enabled: true },
]

const CREDIT_PRICE = 0.1 // 降级显示价格

const TYPE_META: Record<EntryType, { label: string; color: string }> = {
  chat: { label: '对话推理', color: '#3b82f6' },
  data: { label: '数据查询', color: '#8b5cf6' },
  doc: { label: '文档解析', color: '#22c55e' },
  training: { label: '模型训练', color: '#f59e0b' },
}

type Period = 'current' | 'last' | 'all'

function getAgentDisplayName(agentId: string, agentName: string) {
  if (agentId === 'control') return '中控 A Agent'
  const code = agentId as AgentCode
  return AGENT_LABELS[code] ?? agentName ?? agentId
}

type EntryType = 'chat' | 'data' | 'doc' | 'training'

function normalizeType(entry: CreditEntry): EntryType {
  if (entry.type) return entry.type
  const reasonLower = entry.reason.toLowerCase()
  if (reasonLower.includes('查询') || reasonLower.includes('数据') || reasonLower.includes('拉取')) return 'data'
  if (reasonLower.includes('文档') || reasonLower.includes('解析') || reasonLower.includes('知识库')) return 'doc'
  if (reasonLower.includes('训练') || reasonLower.includes('模型') || reasonLower.includes('微调')) return 'training'
  return 'chat'
}

function parseTime(time: string): Date {
  return new Date(time.replace(/-/g, '/'))
}

function isInCurrentMonth(time: string): boolean {
  const d = parseTime(time)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function isInLastMonth(time: string): boolean {
  const d = parseTime(time)
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return d.getFullYear() === last.getFullYear() && d.getMonth() === last.getMonth()
}

export default function CreditsView() {
  const store = useStore()
  const [period, setPeriod] = useState<Period>('current')
  const [showRecharge, setShowRecharge] = useState(false)
  const [showExchange, setShowExchange] = useState(false)
  const [bought, setBought] = useState<number | null>(null)
  const [packages, setPackages] = useState<CreditPackageInfo[]>(FALLBACK_PACKAGES)
  const [orders, setOrders] = useState<CreditOrderInfo[]>([])
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [orderMsg, setOrderMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // 加载套餐
  const loadPackages = useCallback(async () => {
    const res = await fetchCreditPackages()
    if (res.packages.length > 0) {
      setPackages(res.packages)
    }
  }, [])

  // 加载订单
  const loadOrders = useCallback(async () => {
    const res = await fetchCreditOrders()
    setOrders(res)
  }, [])

  useEffect(() => {
    loadPackages()
    loadOrders()
  }, [loadPackages, loadOrders, store.backendConnected])

  // 展示余额：真实余额优先；无真实数据时使用 mock 示例额度
  const displayBalance = store.creditBalance > 0 ? store.creditBalance : 128450

  // 使用真实流水（不再混合 mock 数据）
  const ledger = useMemo<CreditEntry[]>(() => {
    return store.creditLedger.map((e) => ({ ...e, type: normalizeType(e), status: e.status ?? 'success' }))
  }, [store.creditLedger])

  const filteredLedger = useMemo(() => {
    if (period === 'all') return ledger
    if (period === 'current') return ledger.filter((e) => isInCurrentMonth(e.time))
    return ledger.filter((e) => isInLastMonth(e.time))
  }, [ledger, period])

  const overview = useMemo(() => {
    const currentItems = ledger.filter((e) => isInCurrentMonth(e.time))
    const totals: Record<EntryType, number> = { chat: 0, data: 0, doc: 0, training: 0 }
    currentItems.forEach((e) => {
      totals[normalizeType(e)] += e.amount
    })
    const max = Math.max(1, ...Object.values(totals))
    return (Object.keys(TYPE_META) as EntryType[]).map((key) => ({
      key,
      label: TYPE_META[key].label,
      value: totals[key],
      percent: (totals[key] / max) * 100,
      color: TYPE_META[key].color,
    }))
  }, [ledger])

  const totalConsumed = useMemo(
    () => ledger.filter((e) => isInCurrentMonth(e.time)).reduce((s, e) => s + e.amount, 0),
    [ledger],
  )

  // 购买积分 — 创建订单
  const buy = async (pkg: CreditPackageInfo) => {
    setCreatingOrder(true)
    setOrderMsg(null)
    try {
      if (store.backendConnected && pkg.id > 0) {
        // 真实创建订单
        const order = await createCreditOrder({
          package_id: pkg.id,
          payment_method: 'offline',
        })
        if (order) {
          setOrderMsg({ text: `订单已创建（${order.order_no}），请通过公对公转账后联系管理员确认`, type: 'success' })
          setBought(pkg.credits)
          loadOrders() // 刷新订单列表
        } else {
          setOrderMsg({ text: '订单创建失败，请稍后重试', type: 'error' })
        }
      } else {
        // 降级：直接模拟充值
        if (store.backendConnected) {
          const newBalance = await rechargeCredits(pkg.credits)
          if (newBalance !== null) store.recharge(pkg.credits)
        } else {
          store.recharge(pkg.credits)
        }
        setBought(pkg.credits)
      }
      setTimeout(() => {
        setBought(null)
        setShowRecharge(false)
      }, 1500)
    } catch {
      setOrderMsg({ text: '操作失败，请稍后重试', type: 'error' })
    } finally {
      setCreatingOrder(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* 标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">积分管理</h1>
        <p className="mt-1 text-sm text-text-muted">余额、充值与消耗明细</p>
      </div>

      {/* 订单提示 */}
      {orderMsg && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            orderMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {orderMsg.text}
          <button
            onClick={() => setOrderMsg(null)}
            className="ml-2 text-xs underline hover:opacity-70"
          >
            关闭
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        {/* 左侧：余额 + 消耗概览 */}
        <div className="space-y-6">
          {/* 余额卡片 */}
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
            <div className="text-sm text-text-muted">当前余额</div>
            <div className="mt-2 text-5xl font-bold tracking-tight text-blue-500">
              {displayBalance.toLocaleString()}
            </div>
            <div className="mt-1 text-sm text-text-muted">
              积分 ≈ ¥{(displayBalance * CREDIT_PRICE).toLocaleString(undefined, { minimumFractionDigits: 1 })}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowRecharge((v) => !v)}
                className="flex items-center justify-center gap-1 rounded-lg bg-blue-500 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
              >
                <Wallet className="h-4 w-4" /> 充值
              </button>
              <button
                onClick={() => setShowExchange(true)}
                className="flex items-center justify-center gap-1 rounded-lg border border-border-subtle bg-bg-elevated py-2 text-sm font-medium text-text-secondary transition hover:bg-bg-hover"
              >
                <RefreshCcw className="h-4 w-4" /> 购买记录
              </button>
            </div>
          </div>

          {/* 充值套餐展开区 */}
          {showRecharge && (
            <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">充值套餐</span>
                <button onClick={() => setShowRecharge(false)} className="text-text-muted hover:text-text-primary">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                {packages.map((p) => (
                  <div
                    key={`${p.id}-${p.credits}`}
                    className={`relative rounded-xl border p-3 ${
                      p.is_popular ? 'border-accent bg-accent/5' : 'border-border-subtle bg-bg-elevated/50'
                    }`}
                  >
                    {p.is_popular && (
                      <span className="absolute -top-2 right-3 rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">
                        热门
                      </span>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-text-muted">{p.name}</div>
                        <div className="text-lg font-semibold text-text-primary">
                          {p.credits.toLocaleString()} <span className="text-xs text-text-muted">积分</span>
                        </div>
                        {p.bonus_credits > 0 && (
                          <div className="text-xs text-emerald-500">+赠送 {p.bonus_credits.toLocaleString()} 积分</div>
                        )}
                        <div className="text-sm text-accent">¥{p.price}</div>
                      </div>
                      <button
                        onClick={() => buy(p)}
                        disabled={bought === p.credits || creatingOrder}
                        className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition ${
                          bought === p.credits
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-accent text-white hover:opacity-90'
                        } disabled:opacity-50`}
                      >
                        {bought === p.credits ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> 成功
                          </>
                        ) : creatingOrder ? (
                          '创建中...'
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" /> 购买
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {store.backendConnected && packages[0]?.id > 0 && (
                <div className="mt-3 text-xs text-text-muted">
                  购买后请通过公对公转账，转账完成后联系管理员确认到账
                </div>
              )}
            </div>
          )}

          {/* 本月消耗概览 */}
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
            <div className="text-sm font-medium text-text-primary">本月消耗概览</div>
            <div className="mt-5 space-y-4">
              {overview.map((item) => (
                <div key={item.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">{item.label}</span>
                    <span className="font-medium text-text-primary">{item.value.toLocaleString()}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg-elevated">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-border-subtle pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">本月累计消耗</span>
                <span className="font-semibold text-text-primary">{totalConsumed.toLocaleString()} 积分</span>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：消耗明细 */}
        <div className="flex min-h-[520px] flex-col rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-medium text-text-primary">消耗明细</div>
            <div className="flex rounded-lg bg-bg-elevated p-1">
              {([
                { key: 'current', label: '本月' },
                { key: 'last', label: '上月' },
                { key: 'all', label: '全部' },
              ] as { key: Period; label: string }[]).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setPeriod(item.key)}
                  className={`rounded-md px-3 py-1 text-xs transition ${
                    period === item.key
                      ? 'bg-text-primary font-medium text-white'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-hidden rounded-xl border border-border-subtle">
            <div className="grid grid-cols-[110px_100px_1fr_90px_72px] items-center gap-2 border-b border-border-subtle bg-bg-elevated/50 px-4 py-2.5 text-xs text-text-muted">
              <div>时间</div>
              <div>类型</div>
              <div>智能体</div>
              <div className="text-right">消耗积分</div>
              <div className="text-right">状态</div>
            </div>
            <div className="max-h-[460px] overflow-y-auto">
              {filteredLedger.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center text-text-muted">
                  <div className="mb-2 text-sm">暂无消耗记录</div>
                  <div className="text-xs">该时间段内没有积分消耗</div>
                </div>
              ) : (
                filteredLedger.map((e, i) => {
                  const type = normalizeType(e)
                  const meta = TYPE_META[type as EntryType] || TYPE_META.chat
                  const agentName = getAgentDisplayName(e.agentId, e.agentName)
                  const isControl = e.agentId === 'control'
                  const agentCode = isControl
                    ? undefined
                    : (e.agentId as AgentCode) in AGENT_LABELS
                      ? (e.agentId as AgentCode)
                      : undefined
                  return (
                    <div
                      key={e.id}
                      className={`grid grid-cols-[110px_100px_1fr_90px_72px] items-center gap-2 px-4 py-3 text-sm ${
                        i !== filteredLedger.length - 1 ? 'border-b border-border-subtle' : ''
                      }`}
                    >
                      <div className="text-xs text-text-muted">{e.time.slice(5, 16)}</div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                        <span className="text-text-secondary">{meta.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-bg-elevated">
                          {isControl ? (
                            <span className="text-[10px] text-text-muted">A</span>
                          ) : (
                            <RabbitHead agentId={agentCode ? e.agentId : 'control'} className="h-full w-full" />
                          )}
                        </span>
                        <span className="truncate text-text-primary">{agentName}</span>
                      </div>
                      <div className="text-right font-medium text-rose-300">-{e.amount.toLocaleString()}</div>
                      <div className="text-right">
                        {e.status === 'running' ? (
                          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">进行中</span>
                        ) : (
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">成功</span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 购买记录弹窗 */}
      {showExchange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary">购买记录</h3>
              <button onClick={() => setShowExchange(false)} className="text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-text-muted">
                <ShoppingCart className="mb-2 h-8 w-8 opacity-30" />
                <div className="text-sm">暂无购买记录</div>
                <div className="mt-1 text-xs">购买积分后将在此显示订单状态</div>
              </div>
            ) : (
              <div className="max-h-[60vh] space-y-3 overflow-y-auto">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-border-subtle bg-bg-elevated/50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">
                            +{(order.credits + order.bonus_credits).toLocaleString()} 积分
                          </span>
                          {order.bonus_credits > 0 && (
                            <span className="text-xs text-emerald-500">含赠送 {order.bonus_credits}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-text-muted">
                          {order.payment_method_display} · {order.order_no}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-text-primary">¥{order.amount}</div>
                        <span
                          className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${
                            order.status === 'confirmed'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : order.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-500'
                                : order.status === 'cancelled'
                                  ? 'bg-gray-500/10 text-gray-500'
                                  : 'bg-blue-500/10 text-blue-500'
                          }`}
                        >
                          {order.status_display}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-text-muted">
                      {new Date(order.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
