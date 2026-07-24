import { useState } from 'react'
import { SlidersHorizontal, RotateCcw, Factory, Building2, ShieldAlert, Save, Zap, Wifi, WifiOff, Brain, Clock, Hash } from 'lucide-react'
import { PageTitle, Section } from './SkillsView'
import { useStore, FACTORY_CONFIG } from '../store/appStore'
import { businessAgents } from '../data/mockAgents'
import { AGENT_CODES, AGENT_LABELS } from '../lib/constants'
import { updateSysConfig, updateDifyConfig } from '../lib/backend'
import { getMemoryStats, runMemoryMaintenance } from '../lib/local_memory'
import type { RetentionMonths } from '../types'

export default function ConfigView() {
  const store = useStore()
  const [selected, setSelected] = useState(businessAgents[0].id)
  const [saved, setSaved] = useState(false)

  const agent = businessAgents.find((a) => a.id === selected)!
  const cfg = store.configs.find((c) => c.agentId === selected)!
  const factory = FACTORY_CONFIG[selected]

  const resetToFactory = () => {
    store.updateConfig({
      agentId: selected,
      ...factory,
      custom: false
    })
  }

  const save = async () => {
    // 调后端持久化配置
    if (store.backendConnected) {
      await Promise.all([
        updateSysConfig({ agents: store.configs }),
        updateDifyConfig({ workflows: store.dify.workflows, configured: store.dify.configured })
      ])
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle
        icon={SlidersHorizontal}
        title="配置中心"
        desc="双层配置体系：出厂默认基线（只读）+ 企业自定义覆盖。含每个智能体的模型、参数、权限与异常兜底策略。"
      />

      {/* 双层配置说明 */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-surface/60 p-4">
          <Factory className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
          <div>
            <div className="text-sm text-text-primary">出厂默认配置</div>
            <div className="text-xs text-text-muted">平台内置基线，只读，作为兜底</div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <div className="text-sm text-text-primary">企业自定义配置</div>
            <div className="text-xs text-text-muted">按租户覆盖，可随时一键恢复出厂</div>
          </div>
        </div>
      </div>

      <Section title="选择智能体">
        <div className="flex flex-wrap gap-2">
          {businessAgents.map((a) => {
            const c = store.configs.find((x) => x.agentId === a.id)!
            return (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition ${
                  selected === a.id
                    ? 'border-accent bg-accent/10 text-text-primary'
                    : 'border-border-subtle bg-bg-surface/60 text-text-secondary hover:border-border'
                }`}
              >
                <span>{a.emoji}</span>
                {a.name}
                {c.custom && (
                  <span className="rounded bg-accent-soft px-1 py-0.5 text-[9px] text-accent">已定制</span>
                )}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title={`${agent.name} · 参数配置`}>
        <div className="space-y-4 rounded-xl border border-border-subtle bg-bg-surface/60 p-5">
          {/* 绑定模型 */}
          <Row label="绑定模型" hint={`出厂默认：${store.modelById(factory.modelId)?.name ?? factory.modelId}`}>
            <select
              value={cfg.modelId}
              onChange={(e) => store.setDefaultModel(selected, e.target.value)}
              className="rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
            >
              {store.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Row>

          {/* 温度 */}
          <Row label="生成温度" hint={`出厂默认：${factory.temperature} · 越低越严谨`}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={cfg.temperature}
                onChange={(e) =>
                  store.updateConfig({ agentId: selected, temperature: Number(e.target.value) })
                }
                className="w-32 accent-accent"
              />
              <span className="w-8 text-right text-xs text-text-primary">{cfg.temperature}</span>
            </div>
          </Row>
        </div>
      </Section>

      <Section title="异常兜底机制">
        <div className="space-y-4 rounded-xl border border-border-subtle bg-bg-surface/60 p-5">
          <div className="mb-1 flex items-center gap-2 text-xs text-amber-300">
            <ShieldAlert className="h-3.5 w-3.5" />
            保障单点失败不影响整体任务链
          </div>
          <Row label="超时重试次数" hint={`出厂默认：${factory.maxRetry} 次`}>
            <Stepper
              value={cfg.maxRetry}
              min={0}
              max={5}
              onChange={(v) => store.updateConfig({ agentId: selected, maxRetry: v })}
            />
          </Row>
          <Row label="失败降级备用模型" hint={`出厂默认：${store.modelById(factory.fallbackModelId)?.name ?? factory.fallbackModelId}`}>
            <select
              value={cfg.fallbackModelId}
              onChange={(e) =>
                store.updateConfig({ agentId: selected, fallbackModelId: e.target.value })
              }
              className="rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
            >
              {store.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="人工接管阈值" hint={`置信度低于此值转人工 · 出厂默认 ${factory.humanTakeoverThreshold}%`}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={cfg.humanTakeoverThreshold}
                onChange={(e) =>
                  store.updateConfig({
                    agentId: selected,
                    humanTakeoverThreshold: Number(e.target.value)
                  })
                }
                className="w-32 accent-accent"
              />
              <span className="w-10 text-right text-xs text-text-primary">
                {cfg.humanTakeoverThreshold}%
              </span>
            </div>
          </Row>
        </div>
      </Section>

      {/* Dify 工作流连接（对齐 AGENTS.md：5 个平台级工作流，独立 API Key） */}
      <Section title="Dify 智能体引擎">
        <div className="space-y-3 rounded-xl border border-border-subtle bg-bg-surface/60 p-5">
          <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
            <Zap className="h-3.5 w-3.5" />
            每个工作流独立 API Key，租户个性化通过参数注入（tenant_code / role_code / tenant_config）
          </div>
          {Object.values(AGENT_CODES).map((code) => {
            const wf = store.dify.workflows[code]
            return (
              <div key={code} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-sm text-text-primary">
                  {AGENT_LABELS[code]}
                  <div className="text-[10px] text-text-muted">{code}</div>
                </div>
                <input
                  type="password"
                  value={wf?.apiKey || ''}
                  onChange={(e) => store.setDifyWorkflow(code, e.target.value)}
                  placeholder="app-xxx..."
                  className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                />
                <button
                  onClick={() => store.testDifyConnection(code)}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition ${
                    wf?.apiKey
                      ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                      : 'border-border-subtle text-text-muted'
                  }`}
                  title="测试连接"
                >
                  {wf?.apiKey ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  测试
                </button>
              </div>
            )
          })}
          {store.dify.connectionStatus === 'connected' && (
            <p className="text-xs text-emerald-400">✅ 连接成功 · {store.dify.lastTest}</p>
          )}
          {store.dify.connectionStatus === 'error' && store.dify.error && (
            <p className="text-xs text-rose-400">❌ {store.dify.error}</p>
          )}
        </div>
      </Section>

      {/* 记忆参数配置（需求文档第 9.3 章） */}
      <Section title="记忆参数配置">
        <div className="space-y-4 rounded-xl border border-border-subtle bg-bg-surface/60 p-5">
          <div className="mb-1 flex items-center gap-2 text-xs text-text-muted">
            <Brain className="h-3.5 w-3.5" />
            双层持久记忆引擎 — 控制账号长期记忆的存储周期与容量上限
          </div>

          <Row label="记忆存储周期" hint={`到期自动清理 · 当前：${store.memoryConfig.retentionMonths === 6 ? '6个月' : store.memoryConfig.retentionMonths === 12 ? '1年' : '2年'}`}>
            <div className="flex gap-1">
              {([6, 12, 24] as RetentionMonths[]).map((months) => (
                <button
                  key={months}
                  onClick={() => store.setMemoryConfig({ retentionMonths: months })}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    store.memoryConfig.retentionMonths === months
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border-subtle bg-bg-elevated text-text-secondary hover:border-border'
                  }`}
                >
                  {months === 6 ? '6个月' : months === 12 ? '1年' : '2年'}
                </button>
              ))}
            </div>
          </Row>

          <Row label="单账号 Token 上限" hint={`超出后按 LRU 淘汰最久未访问记忆 · 当前：${store.memoryConfig.tokenCap.toLocaleString()} Tokens`}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={10000}
                max={200000}
                step={10000}
                value={store.memoryConfig.tokenCap}
                onChange={(e) => store.setMemoryConfig({ tokenCap: Number(e.target.value) })}
                className="w-32 accent-accent"
              />
              <span className="w-16 text-right text-xs text-text-primary">
                {(store.memoryConfig.tokenCap / 1000).toFixed(0)}K
              </span>
            </div>
          </Row>

          {store.localMemorySwitch && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  <Clock className="inline h-3 w-3 mr-1" />
                  本地摘要统计：{getMemoryStats().count} 条 · {getMemoryStats().totalTokens} Tokens
                </span>
                <button
                  onClick={() => {
                    runMemoryMaintenance(
                      store.memoryConfig.retentionMonths,
                      store.memoryConfig.tokenCap
                    )
                  }}
                  className="rounded border border-border-subtle px-2 py-1 text-[10px] text-text-muted hover:text-accent hover:border-accent/50 transition-colors"
                >
                  执行清理
                </button>
              </div>
              <p className="mt-1 text-[10px] text-text-muted/60">
                范围：{getMemoryStats().oldestDate} ~ {getMemoryStats().newestDate}
              </p>
            </div>
          )}

          {!store.localMemorySwitch && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-xs text-emerald-300/80">
                <Hash className="inline h-3 w-3 mr-1" />
                SaaS 标准模式 — 记忆由天网大脑 memory_engine 统一管理，配置将同步至后端。
                当前为本地仅展示配置，实际清理策略由天网大脑执行。
              </p>
            </div>
          )}
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button onClick={save} className="btn-primary">
          <Save className="h-4 w-4" />
          {saved ? '已保存' : '保存企业配置'}
        </button>
        <button
          onClick={resetToFactory}
          className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          <RotateCcw className="h-4 w-4" /> 恢复出厂默认
        </button>
        {cfg.custom && <span className="text-xs text-accent">当前为企业自定义</span>}
      </div>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm text-text-primary">{label}</div>
        {hint && <div className="text-xs text-text-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-6 w-6 items-center justify-center rounded-md bg-bg-elevated text-text-secondary hover:text-accent"
      >
        −
      </button>
      <span className="w-6 text-center text-xs text-text-primary">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-6 w-6 items-center justify-center rounded-md bg-bg-elevated text-text-secondary hover:text-accent"
      >
        +
      </button>
    </div>
  )
}
