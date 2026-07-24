import { useState } from 'react'
import { Cpu, Wallet, TrendingUp, Plus, Sparkles, Check } from 'lucide-react'
import { PageTitle, Section } from './SkillsView'
import { useStore } from '../store/appStore'
import { businessAgents } from '../data/mockAgents'
import { rechargeCredits } from '../lib/backend'

const packages = [
  { credits: 1000, price: 99, tag: '体验包' },
  { credits: 5000, price: 449, tag: '标准包', hot: true },
  { credits: 20000, price: 1599, tag: '企业包' }
]

export default function CreditsView() {
  const store = useStore()
  const [bought, setBought] = useState<number | null>(null)

  // 按智能体聚合消耗
  const byAgent = businessAgents
    .map((a) => ({
      name: a.name,
      emoji: a.emoji,
      total: store.creditLedger.filter((e) => e.agentId === a.id).reduce((s, e) => s + e.amount, 0)
    }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)

  const maxAgent = Math.max(1, ...byAgent.map((a) => a.total))
  const totalConsumed = store.creditLedger.reduce((s, e) => s + e.amount, 0)

  const buy = async (credits: number) => {
    // 先调后端充值 API
    if (store.backendConnected) {
      const newBalance = await rechargeCredits(credits)
      if (newBalance !== null) {
        // 后端返回新余额，直接更新 store
        store.recharge(credits)
      }
    } else {
      store.recharge(credits)
    }
    setBought(credits)
    setTimeout(() => setBought(null), 1500)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle
        icon={Cpu}
        title="算力积分中心"
        desc="以算力积分统一计量模型消耗，规避 Token 计费的牌照风险。任务执行按积分扣减，明细全程可追溯。"
      />

      {/* 余额卡 */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
            <Wallet className="h-3.5 w-3.5 text-accent" /> 当前余额
          </div>
          <div className="text-2xl font-semibold text-text-primary">
            {store.creditBalance.toLocaleString()}
          </div>
          <div className="text-xs text-text-muted">算力积分</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-surface/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-300" /> 累计消耗
          </div>
          <div className="text-2xl font-semibold text-text-primary">{totalConsumed.toLocaleString()}</div>
          <div className="text-xs text-text-muted">{store.creditLedger.length} 条记录</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-surface/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" /> 计费方式
          </div>
          <div className="text-sm font-medium text-text-primary">积分制</div>
          <div className="text-xs text-text-muted">出厂内置额度 + 企业充值</div>
        </div>
      </div>

      <Section title="充值套餐">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {packages.map((p) => (
            <div
              key={p.credits}
              className={`relative rounded-xl border p-4 ${
                p.hot ? 'border-accent bg-accent/5' : 'border-border-subtle bg-bg-surface/60'
              }`}
            >
              {p.hot && (
                <span className="absolute -top-2 right-3 rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">
                  热门
                </span>
              )}
              <div className="text-xs text-text-muted">{p.tag}</div>
              <div className="mt-1 text-xl font-semibold text-text-primary">
                {p.credits.toLocaleString()} <span className="text-xs text-text-muted">积分</span>
              </div>
              <div className="mt-0.5 text-sm text-accent">¥{p.price}</div>
              <button
                onClick={() => buy(p.credits)}
                className={`mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs transition ${
                  bought === p.credits
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-accent text-white hover:opacity-90'
                }`}
              >
                {bought === p.credits ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> 充值成功
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> 立即充值
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </Section>

      {byAgent.length > 0 && (
        <Section title="按智能体消耗占比">
          <div className="space-y-2.5 rounded-xl border border-border-subtle bg-bg-surface/60 p-4">
            {byAgent.map((a) => (
              <div key={a.name} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-xs text-text-secondary">
                  {a.emoji} {a.name}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(a.total / maxAgent) * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right text-xs text-text-muted">{a.total}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="消耗明细">
        <div className="overflow-hidden rounded-xl border border-border-subtle">
          <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-surface/60 px-4 py-2.5 text-xs text-text-muted">
            <div className="flex-1">智能体 / 事由</div>
            <div className="w-32 text-right">时间</div>
            <div className="w-16 text-right">消耗</div>
            <div className="w-20 text-right">余额</div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {store.creditLedger.map((e, i) => (
              <div
                key={e.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  i !== store.creditLedger.length - 1 ? 'border-b border-border-subtle' : ''
                } bg-bg-surface/30`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text-primary">{e.agentName}</div>
                  <div className="truncate text-xs text-text-muted">{e.reason}</div>
                </div>
                <div className="w-32 text-right text-xs text-text-muted">{e.time}</div>
                <div className="w-16 text-right text-sm text-rose-300">-{e.amount}</div>
                <div className="w-20 text-right text-xs text-text-secondary">
                  {e.balanceAfter.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  )
}
