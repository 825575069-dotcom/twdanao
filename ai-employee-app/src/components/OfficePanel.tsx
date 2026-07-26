import { useState } from 'react'
import { Bot, Clock, Zap } from 'lucide-react'
import { useStore } from '../store/appStore'
import RabbitHead from './RabbitHead'

type TabKey = 'logs' | 'outputs' | 'preview'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'logs', label: '工作日志' },
  { key: 'outputs', label: '产出物' },
  { key: 'preview', label: '预览' }
]

export default function OfficePanel() {
  const [activeTab, setActiveTab] = useState<TabKey>('logs')
  const store = useStore()

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-border-subtle bg-bg-surface">
      {/* 顶部 Agent 信息 */}
      <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-gradient-to-br from-bg-elevated to-bg-hover p-1 text-lg text-text-primary shadow-sm">
          <RabbitHead agentId="control" className="h-full w-full" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary">YesGo 经理兔</div>
          <div className="text-[11px] text-text-muted">AI 数字员工 · 在线</div>
        </div>
      </div>

      {/* 状态卡片 */}
      <div className="border-b border-border-subtle px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-bg-elevated p-3">
            <div className="text-[10px] text-text-muted">令牌余额</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-lg font-bold text-text-primary">
                {store?.creditBalance ?? 4850}
              </span>
              <span className="text-[10px] text-text-muted">T</span>
            </div>
          </div>
          <div className="rounded-xl bg-bg-elevated p-3">
            <div className="text-[10px] text-text-muted">今日任务</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-lg font-bold text-text-primary">3</span>
              <span className="text-[10px] text-text-muted">个</span>
            </div>
          </div>
        </div>
      </div>

      {/* 标签页切换 */}
      <div className="flex border-b border-border-subtle">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`relative flex-1 py-2.5 text-center text-xs font-medium transition-colors ${
              activeTab === t.key
                ? 'text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t.label}
            {activeTab === t.key && (
              <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* 标签页内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeTab === 'logs' && <LogsTab />}
        {activeTab === 'outputs' && <OutputsTab />}
        {activeTab === 'preview' && <PreviewTab />}
      </div>

      {/* 底部署名 */}
      <div className="border-t border-border-subtle px-5 py-3">
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>YesGo AI Office</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            运行中
          </span>
        </div>
      </div>
    </aside>
  )
}

function LogsTab() {
  return (
    <div className="space-y-3">
      {[
        { icon: Clock, text: '收到采购任务，正在解析意图…', time: '14:32' },
        { icon: Zap, text: '已派发采购兔，正在生成补货方案', time: '14:32' },
        { icon: Clock, text: '方案生成完毕，等待确认', time: '14:33' },
        { icon: Clock, text: '空闲中，等待新任务', time: '14:35' }
      ].map((log, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <log.icon className="mt-0.5 h-3 w-3 shrink-0 text-text-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-text-primary leading-relaxed">{log.text}</div>
            <div className="mt-0.5 text-[10px] text-text-muted">{log.time}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function OutputsTab() {
  return (
    <div className="space-y-2">
      {[
        { name: '采购方案 A（最优）', type: '方案', time: '今天' },
        { name: '阿莫西林库存告警', type: '预警', time: '昨天' },
        { name: 'Q2 经营简报', type: '报告', time: '07/18' }
      ].map((o, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg bg-bg-elevated p-3 cursor-pointer hover:bg-bg-hover transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-[10px] font-medium text-accent">
            {o.type}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] text-text-secondary">{o.name}</div>
            <div className="text-[10px] text-text-muted">{o.time}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function PreviewTab() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated">
        <Bot className="h-7 w-7 text-text-muted" />
      </div>
      <div className="mt-3 text-xs text-text-muted">无预览内容</div>
      <div className="mt-1 text-[10px] text-text-muted/70">
        选择产出物查看详情
      </div>
    </div>
  )
}
