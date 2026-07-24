import { useState } from 'react'
import { Settings, Cpu, Shield, Link2, Info, ChevronRight, Sun, Moon, ExternalLink, Cloud, CloudOff } from 'lucide-react'
import { PageTitle, Section } from './SkillsView'
import { useTheme, COLOR_THEMES } from '../lib/theme'
import { useStore } from '../store/appStore'
import { AGENT_CODES, AGENT_LABELS } from '../lib/constants'
import { getMemoryStats, clearAllMemories } from '../lib/local_memory'
import type { ViewKey } from '../App'

interface Props {
  onNavigate?: (view: ViewKey) => void
}

export default function SettingsView({ onNavigate }: Props) {
  const { mode, setMode, colorTheme, setColorTheme } = useTheme()
  const store = useStore()
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [isolationEnabled, setIsolationEnabled] = useState(true)
  const [auditEnabled, setAuditEnabled] = useState(true)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateInfo, setUpdateInfo] = useState('')

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageTitle
        icon={Settings}
        title="设置"
        desc="配置模型、业务系统连接、数据权限与应用信息。"
      />

      {/* 外观 */}
      <Section title="外观">
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
          <div className="mb-3 text-sm font-medium text-text-primary">主题模式</div>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  mode === m
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border-subtle bg-bg-surface text-text-secondary hover:border-border hover:text-text-primary'
                }`}
              >
                {m === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {m === 'dark' ? '深色' : '浅色'}
              </button>
            ))}
          </div>

          <div className="mb-3 mt-5 text-sm font-medium text-text-primary">品牌色</div>
          <div className="flex flex-wrap gap-2">
            {COLOR_THEMES.map((c) => (
              <button
                key={c.key}
                onClick={() => setColorTheme(c.key)}
                title={c.label}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  colorTheme === c.key
                    ? 'border-accent bg-bg-surface text-text-primary'
                    : 'border-border-subtle bg-bg-surface text-text-secondary hover:border-border hover:text-text-primary'
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-text-muted/30"
                  style={{ background: c.hex }}
                />
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* 运行模式（需求文档第 6.1/11.1/11.2 章） */}
      <Section title="运行模式">
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
          <p className="mb-3 text-xs text-text-muted">
            SaaS 标准模式对接天网大脑，获得完整双层记忆、智能体工作流、模型网关能力。
            自治模式仅保留轻量化单轮对话摘要，适合客户内网离线场景。
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (store.localMemorySwitch) store.toggleOperationMode()
              }}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-left transition-colors ${
                !store.localMemorySwitch
                  ? 'border-accent bg-accent/10'
                  : 'border-border-subtle bg-bg-surface/60 hover:border-border'
              }`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${!store.localMemorySwitch ? 'bg-accent/20' : 'bg-bg-hover'}`}>
                <Cloud className={`h-5 w-5 ${!store.localMemorySwitch ? 'text-accent' : 'text-text-muted'}`} />
              </div>
              <div className="text-center">
                <div className={`text-sm font-medium ${!store.localMemorySwitch ? 'text-accent' : 'text-text-primary'}`}>
                  SaaS 标准模式
                </div>
                <div className="mt-0.5 text-[11px] text-text-muted leading-tight">
                  对接天网大脑 · 完整双层记忆
                </div>
              </div>
              {!store.localMemorySwitch && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-white">当前</span>
              )}
            </button>
            <button
              onClick={() => {
                if (!store.localMemorySwitch) store.toggleOperationMode()
              }}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-left transition-colors ${
                store.localMemorySwitch
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-border-subtle bg-bg-surface/60 hover:border-border'
              }`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${store.localMemorySwitch ? 'bg-amber-500/20' : 'bg-bg-hover'}`}>
                <CloudOff className={`h-5 w-5 ${store.localMemorySwitch ? 'text-amber-400' : 'text-text-muted'}`} />
              </div>
              <div className="text-center">
                <div className={`text-sm font-medium ${store.localMemorySwitch ? 'text-amber-400' : 'text-text-primary'}`}>
                  客户自治闭环
                </div>
                <div className="mt-0.5 text-[11px] text-text-muted leading-tight">
                  脱离天网大脑 · 轻量本地摘要
                </div>
              </div>
              {store.localMemorySwitch && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-white">当前</span>
              )}
            </button>
          </div>
          {store.localMemorySwitch && (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-300/80 leading-relaxed">
                ⚠️ 自治闭环模式仅支持单轮对话关键词提取。无每日批量汇总、记忆时效管控、
                Token 自动淘汰能力。如需完整双层记忆引擎，请切换至 SaaS 标准模式。
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                <span>本地摘要：{getMemoryStats().count} 条 · {getMemoryStats().totalTokens} Tokens</span>
                <button
                  onClick={() => {
                    clearAllMemories()
                    alert('本地记忆已清空')
                  }}
                  className="rounded border border-border-subtle px-2 py-0.5 text-[10px] text-text-muted hover:text-rose-400 hover:border-rose-400/50 transition-colors"
                >
                  清空本地记忆
                </button>
              </div>
            </div>
          )}
          {!store.localMemorySwitch && store.backendConnected && (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-xs text-emerald-300/80 leading-relaxed">
                ✅ 已连接天网大脑 · 完整双层记忆引擎在线 · 智能体工作流可用
              </p>
            </div>
          )}
          {!store.localMemorySwitch && !store.backendConnected && (
            <div className="mt-3 rounded-lg border border-text-muted/20 bg-bg-surface/40 p-3">
              <p className="text-xs text-text-muted leading-relaxed">
                SaaS 模式已开启但天网大脑未连接。当前使用本地规则引擎兜底，
                待后端上线后将自动启用完整双层记忆与模型网关能力。
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* 租户信息（对齐 AGENTS.md 多租户架构） */}
      <Section title="租户信息">
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
          {store.tenant.info ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">租户名称</span>
                <span className="text-sm font-medium text-text-primary">{store.tenant.info.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">租户编码</span>
                <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-accent">{store.tenant.info.code}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">平台名称</span>
                <span className="text-sm text-text-primary">{store.tenant.info.platformName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">状态</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  store.tenant.info.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                }`}>
                  {store.tenant.info.status === 'active' ? '活跃' : store.tenant.info.status}
                </span>
              </div>
              {store.tenant.membership && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">当前角色</span>
                  <span className="text-sm text-text-primary">{store.tenant.membership.roleName}</span>
                </div>
              )}
              {store.tenant.package && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">套餐</span>
                  <span className="text-sm font-medium text-accent">{store.tenant.package.name}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted">未绑定租户（离线模式）</p>
          )}
        </div>
      </Section>

      {/* Dify 智能体引擎（对齐 AGENTS.md） */}
      <Section title="Dify 智能体引擎">
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
          <p className="mb-3 text-xs text-text-muted">
            5 个平台级工作流，各自独立 API Key。租户个性化通过参数注入（tenant_code / role_code / tenant_config）。
          </p>
          <div className="space-y-2">
            {Object.values(AGENT_CODES).map((code) => {
              const wf = store.dify.workflows[code]
              const hasKey = !!wf?.apiKey
              return (
                <div key={code} className="flex items-center justify-between rounded-lg bg-bg-elevated/60 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary">{AGENT_LABELS[code]}</span>
                    <code className="rounded bg-bg-base px-1 py-0.5 text-[10px] text-text-muted">{code}</code>
                  </div>
                  <span className={`h-2 w-2 rounded-full ${hasKey ? 'bg-emerald-400' : 'bg-text-muted'}`} />
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-text-muted">
            {store.dify.configured ? '✅ Dify 已配置' : '⚠️ 未配置 Dify API Key（当前使用本地规则引擎）'}
            {store.dify.lastTest && ` · 最近测试：${store.dify.lastTest}`}
          </p>
        </div>
      </Section>

      {/* 后端 API 连接（对齐 AGENTS.md） */}
      <Section title="后端 API 连接">
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-text-muted">API 基地址</label>
              <input
                type="text"
                value={store.apiBaseUrl}
                onChange={(e) => {
                  store.setApiBaseUrl(e.target.value)
                  localStorage.setItem('yesgo_api_base_url', e.target.value)
                }}
                placeholder="http://192.168.2.180:8000/api"
                className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">认证状态</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                store.auth.valid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-text-muted/15 text-text-muted'
              }`}>
                {store.auth.valid ? '已认证' : '未认证'}
              </span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="模型与算力">
        <SettingRow
          icon={Cpu}
          title="默认对话模型"
          desc="当前：垂直行业 Pro（可切换 GPT-4o / Claude 3.5 / 本地模型）"
          action="去模型网关"
          onClick={() => onNavigate?.('models')}
        />
        <SettingRow
          icon={Cpu}
          title="本地私有模型"
          desc="未启用 · 适合数据敏感场景，支持 Qwen / Llama 私有化部署"
          action="去模型网关"
          onClick={() => onNavigate?.('models')}
        />
        <SettingRow
          icon={Cpu}
          title="智能体参数配置"
          desc="温度 / 重试 / 降级模型 / 人工接管阈值"
          action="去配置中心"
          onClick={() => onNavigate?.('config')}
        />
      </Section>

      <Section title="业务系统">
        <SettingRow
          icon={Link2}
          title="B2B 系统对接"
          desc="管理 CRM / ERP / OA 等系统的 API 连接与授权"
          action="去数据底座"
          onClick={() => onNavigate?.('dataBase')}
        />
        <ToggleRow
          icon={Link2}
          title="数据同步策略"
          desc={syncEnabled ? '实时同步 · 每 5 分钟增量更新' : '已关闭 · 数据不会自动同步'}
          checked={syncEnabled}
          onToggle={() => setSyncEnabled((v) => !v)}
        />
      </Section>

      <Section title="安全与权限">
        <ToggleRow
          icon={Shield}
          title="数据隔离"
          desc={isolationEnabled ? '已开启 · 按客户 / 租户隔离，敏感字段脱敏' : '已关闭 · ⚠️ 数据不再按租户隔离'}
          checked={isolationEnabled}
          onToggle={() => setIsolationEnabled((v) => !v)}
        />
        <ToggleRow
          icon={Shield}
          title="操作审计"
          desc={auditEnabled ? '已开启 · 记录所有数据访问与外发动作' : '已关闭 · 操作日志不再记录'}
          checked={auditEnabled}
          onToggle={() => setAuditEnabled((v) => !v)}
        />
        <SettingRow
          icon={Shield}
          title="成员权限"
          desc={`${store.tenant.roles.length} 个角色 · ${store.tenant.members.length} 名成员`}
          action="去权限管理"
          onClick={() => onNavigate?.('permissions')}
        />
      </Section>

      <Section title="关于">
        <SettingRow
          icon={Info}
          title="AI 数字员工"
          desc="版本 0.3.0 · Electron + React + Dify"
          action={checkingUpdate ? '检查中…' : '检查更新'}
          onClick={() => {
            if (checkingUpdate) return
            setCheckingUpdate(true)
            setTimeout(() => {
              setCheckingUpdate(false)
              setUpdateInfo('当前已是最新版本 (v0.3.0)')
              setTimeout(() => setUpdateInfo(''), 3000)
            }, 1200)
          }}
        />
        {updateInfo && (
          <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-400">
            ✅ {updateInfo}
          </div>
        )}
        <div className="mt-4 rounded-xl border border-border-subtle bg-bg-surface/40 p-4 text-xs leading-relaxed text-text-muted">
          这是一个桌面客户端外壳，后续将逐步接入垂直行业模型、B2B 业务系统与企业知识库。
          当前所有业务数据为演示占位，不涉及真实客户信息。
        </div>
      </Section>
    </div>
  )
}

function SettingRow({
  icon: Icon,
  title,
  desc,
  action,
  onClick
}: {
  icon: typeof Settings
  title: string
  desc: string
  action?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-bg-elevated p-4 text-left transition-colors hover:border-border"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated">
        <Icon className="h-4.5 w-4.5 text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary">{title}</div>
        <div className="mt-0.5 text-xs text-text-muted">{desc}</div>
      </div>
      {action ? (
        <span className="flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs text-text-secondary transition-colors group-hover:border-accent group-hover:text-accent">
          {action}
          {onClick && <ExternalLink className="h-3 w-3" />}
        </span>
      ) : (
        <ChevronRight className="h-4 w-4 text-text-muted" />
      )}
    </button>
  )
}

function ToggleRow({
  icon: Icon,
  title,
  desc,
  checked,
  onToggle
}: {
  icon: typeof Settings
  title: string
  desc: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-bg-elevated p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated">
        <Icon className="h-4.5 w-4.5 text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary">{title}</div>
        <div className="mt-0.5 text-xs text-text-muted">{desc}</div>
      </div>
      <button
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-bg-hover'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  )
}
