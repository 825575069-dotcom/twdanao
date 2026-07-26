import { useState, useEffect } from 'react'
import { Building2, Plug, RefreshCw, ArrowLeftRight, Circle, MessageCircle, Search, X, Phone, MapPin, ShoppingBag, TrendingUp, Send } from 'lucide-react'
import { PageTitle, Section } from './SkillsView'
import { useStore, type SaaSConn } from '../store/appStore'
import { getCustomers } from '../data/mockSaaS'
import { fetchCustomers, updateSaasConnection } from '../lib/backend'

const connMap = {
  connected: { label: '已连接', color: 'text-emerald-300', dot: 'bg-emerald-400' },
  pending: { label: '待授权', color: 'text-amber-300', dot: 'bg-amber-400' },
  disconnected: { label: '未连接', color: 'text-text-muted', dot: 'bg-gray-600' }
} as const

const typeColor: Record<string, string> = {
  药店: 'text-emerald-300',
  诊所: 'text-sky-300',
  商业公司: 'text-violet-300'
}

export default function ClientsView() {
  const store = useStore()
  const [allCustomers, setAllCustomers] = useState(getCustomers())
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('全部')
  const [selectedCustomer, setSelectedCustomer] = useState<typeof allCustomers[0] | null>(null)

  // 从后端加载客户数据
  useEffect(() => {
    if (!store.backendConnected) return
    fetchCustomers().then((data) => {
      if (data && Array.isArray(data) && data.length > 0) {
        // 后端返回的客户数据格式与前端不同，这里做兼容处理
        const items = (data as Array<Record<string, unknown>>).map((c) => ({
          id: (c.id ?? c.code ?? '') as string,
          name: (c.name ?? '') as string,
          type: (c.type ?? '药店') as '药店' | '诊所' | '商业公司',
          region: (c.region ?? c.contact ?? '') as string,
          ownerAgent: (c.ownerAgent ?? 'crm') as 'crm' | 'ops',
          contact: (c.contact ?? c.phone ?? '') as string,
          phone: (c.phone ?? '') as string,
          level: (c.level ?? 'B') as string,
          monthlyAmount: (c.monthlyAmount ?? c.monthly ?? 0) as number,
          orders: (c.orders ?? 0) as number,
          address: (c.address ?? '') as string,
        }))
        if (items.length > 0) setAllCustomers(items)
      }
    }).catch(() => {})
  }, [store.backendConnected])

  const customers = allCustomers.filter((c) => {
    const matchQuery = !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.region.includes(query)
    const matchType = typeFilter === '全部' || c.type === typeFilter
    return matchQuery && matchType
  })

  const authorize = async (s: SaaSConn) => {
    if (s.status === 'pending' || s.status === 'disconnected') {
      if (store.backendConnected) {
        await updateSaasConnection(s.id, { status: 'connected' })
      }
      store.setSaasStatus(s.id, 'connected')
    }
  }

  const types = ['全部', ...Array.from(new Set(allCustomers.map((c) => c.type)))]

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle
        icon={Building2}
        title="客户 / B2B · SaaS 双向打通"
        desc="连接医药 SaaS 数据底座，智能体可直接读取客户 / 订单 / 库存，并将结果双向回写业务系统。"
      />

      <Section title="SaaS 数据源连接">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {store.saas.map((s) => {
            const c = connMap[s.status]
            return (
              <div
                key={s.id}
                className="rounded-xl border border-border-subtle bg-bg-surface/60 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated">
                    <Plug className="h-4.5 w-4.5 text-text-secondary" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary">{s.name}</div>
                    <div className="text-xs text-text-muted">{s.desc}</div>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs ${c.color}`}>
                    <Circle className={`h-2 w-2 fill-current ${c.dot}`} />
                    {c.label}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" /> {s.lastSync}
                    </span>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <ArrowLeftRight className="h-3 w-3" /> 双向回写
                      <button
                        onClick={async () => {
                          if (store.backendConnected) await updateSaasConnection(s.id, { twoWay: !s.twoWay })
                          store.toggleSaasTwoWay(s.id)
                        }}
                        disabled={s.status !== 'connected'}
                        className={`relative h-4 w-7 rounded-full transition-colors disabled:opacity-40 ${
                          s.twoWay ? 'bg-accent' : 'bg-bg-hover'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                            s.twoWay ? 'left-3.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                  {s.status !== 'connected' && (
                    <button
                      onClick={() => authorize(s)}
                      className="rounded-lg border border-border-subtle px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
                    >
                      去授权
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="字段映射（SaaS ↔ 数字员工）">
        <div className="overflow-hidden rounded-xl border border-border-subtle">
          {[
            { saas: 'product.sku', field: '商品编码', agent: '采购 / 运营' },
            { saas: 'inventory.stock', field: '库存数量', agent: '采购 / 流向' },
            { saas: 'order.status', field: '订单状态', agent: '采购' },
            { saas: 'customer.profile', field: '客户档案', agent: '跟客' }
          ].map((m, i, arr) => (
            <div
              key={m.saas}
              className={`flex items-center gap-3 px-4 py-2.5 text-xs ${
                i !== arr.length - 1 ? 'border-b border-border-subtle' : ''
              } bg-bg-surface/30`}
            >
              <code className="w-40 font-mono text-text-muted">{m.saas}</code>
              <ArrowLeftRight className="h-3 w-3 text-text-muted" />
              <span className="flex-1 text-text-primary">{m.field}</span>
              <span className="text-text-secondary">{m.agent}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`客户列表（${customers.length}）`}>
        {/* 搜索 + 筛选 */}
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索客户名称或区域…"
              className="w-full rounded-xl border border-border-subtle bg-bg-surface/70 py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  typeFilter === t
                    ? 'bg-accent text-white'
                    : 'border border-border-subtle bg-bg-surface/60 text-text-secondary hover:border-border hover:text-text-primary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border-subtle">
          <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-surface/60 px-4 py-2.5 text-xs text-text-muted">
            <div className="flex-1">客户名称</div>
            <div className="w-20">类型</div>
            <div className="w-20">区域</div>
            <div className="w-24 text-right">操作</div>
          </div>
          {customers.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-muted">未找到匹配的客户</div>
          ) : (
            customers.map((c, i) => (
              <div
                key={c.id}
                className={`flex cursor-pointer items-center gap-3 px-4 py-3 ${
                  i !== customers.length - 1 ? 'border-b border-border-subtle' : ''
                } bg-bg-surface/30 transition-colors hover:bg-bg-hover`}
                onClick={() => setSelectedCustomer(c)}
              >
                <div className="flex flex-1 items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-accent/30 to-purple-500/30 text-xs font-medium text-accent">
                    {c.name[0]}
                  </div>
                  <span className="text-sm text-text-primary">{c.name}</span>
                </div>
                <div className={`w-20 text-xs ${typeColor[c.type] ?? 'text-text-secondary'}`}>{c.type}</div>
                <div className="w-20 text-xs text-text-secondary">{c.region}</div>
                <div className="flex w-24 justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedCustomer(c)
                    }}
                    className="flex items-center gap-1 rounded-lg border border-border-subtle px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
                  >
                    <MessageCircle className="h-3 w-3" /> 详情
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* 客户详情抽屉 */}
      {selectedCustomer && (
        <CustomerDetailDrawer
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  )
}

function CustomerDetailDrawer({
  customer,
  onClose
}: {
  customer: ReturnType<typeof getCustomers>[0]
  onClose: () => void
}) {
  // 生成 mock 跟进记录
  const followUps = [
    { time: '2026-07-18', agent: '跟客兔', action: '电话回访', note: '客户反馈库存充足，暂不需补货' },
    { time: '2026-07-10', agent: '跟客兔', action: '上门拜访', note: '介绍新品学术活动，客户表示有兴趣' },
    { time: '2026-06-28', agent: '跟客兔', action: '微信沟通', note: '确认本月订单需求' }
  ]
  const orders = [
    { id: 'ORD-2026-0715', product: '阿莫西林胶囊', qty: 500, status: '已发货' },
    { id: 'ORD-2026-0620', product: '布洛芬缓释胶囊', qty: 300, status: '已完成' },
    { id: 'ORD-2026-0518', product: '头孢克肟分散片', qty: 200, status: '已完成' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-border-subtle bg-bg-surface shadow-xl animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/30 to-purple-500/30 text-sm font-medium text-accent">
              {customer.name[0]}
            </div>
            <div>
              <div className="text-base font-semibold text-text-primary">{customer.name}</div>
              <div className="text-xs text-text-muted">{customer.type} · {customer.region}</div>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn h-8 w-8">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* 基本信息 */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            <InfoCard icon={Phone} label="联系电话" value="138-****-6789" />
            <InfoCard icon={MapPin} label="地址" value={`${customer.region}·详细地址`} />
            <InfoCard icon={ShoppingBag} label="历史订单" value={`${orders.length} 笔`} />
            <InfoCard icon={TrendingUp} label="年度交易额" value="¥186,500" />
          </div>

          {/* 快捷操作 */}
          <div className="mb-5 flex gap-2">
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-xs text-white transition hover:opacity-90">
              <Send className="h-3.5 w-3.5" /> 派发跟客
            </button>
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-subtle py-2 text-xs text-text-secondary transition hover:border-accent hover:text-accent">
              <ShoppingBag className="h-3.5 w-3.5" /> 创建订单
            </button>
          </div>

          {/* 跟进记录 */}
          <div className="mb-5">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">跟进记录</div>
            <div className="space-y-2.5">
              {followUps.map((f, i) => (
                <div key={i} className="rounded-xl border border-border-subtle bg-bg-elevated p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-accent">{f.action}</span>
                    <span className="text-[10px] text-text-muted">{f.time}</span>
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">{f.note}</div>
                  <div className="mt-1 text-[10px] text-text-muted">由 {f.agent} 执行</div>
                </div>
              ))}
            </div>
          </div>

          {/* 订单记录 */}
          <div>
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">订单记录</div>
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-text-primary">{o.product}</div>
                    <div className="text-[10px] text-text-muted">{o.id}</div>
                  </div>
                  <div className="text-xs text-text-secondary">×{o.qty}</div>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                    o.status === '已发货' ? 'bg-sky-500/15 text-sky-300' : 'bg-emerald-500/15 text-emerald-300'
                  }`}>
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-text-muted">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-sm font-medium text-text-primary">{value}</div>
    </div>
  )
}
