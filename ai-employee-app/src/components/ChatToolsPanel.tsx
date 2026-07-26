import { useState, useMemo } from 'react'
import { Clock, Zap } from 'lucide-react'
import type { Conversation } from '../App'
import RabbitHead from './RabbitHead'

interface Props {
  conversation: Conversation
}

type TabKey = 'logs' | 'outputs' | 'history'

interface WorkLogItem {
  icon: 'clock' | 'zap'
  text: string
  time: string
}

export default function ChatToolsPanel({ conversation }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('logs')
  const logs = useMemo(() => buildWorkLogs(conversation), [conversation])

  const tabs = [
    { key: 'logs' as TabKey, label: '工作日志' },
    { key: 'outputs' as TabKey, label: '产出物' },
    { key: 'history' as TabKey, label: '历史对话' },
  ]

  return (
    <div className="flex h-full w-full flex-col border-l border-border-subtle bg-bg-elevated shadow-lg">
      {/* 团队头部：高度与聊天标题栏 h-14 对齐，公仔中线与标题文字中线同高 */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated">
          <RabbitHead agentId="control" className="h-full w-full" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <div className="truncate text-base font-semibold text-text-primary">YesGo团队</div>
          <div className="truncate text-xs text-text-muted">更懂你的数字员工</div>
        </div>
      </div>

      {/* 三个 Tab */}
      <div className="flex border-b border-border-subtle">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-purple-600'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-1/2 inline-block h-0.5 w-10 -translate-x-1/2 rounded-full bg-purple-600" />
            )}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'logs' && (
          <div className="space-y-5">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center pt-0.5">
                  {log.icon === 'zap' ? (
                    <Zap className="h-4 w-4 text-purple-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-text-muted" />
                  )}
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="text-sm leading-relaxed text-text-primary">{log.text}</div>
                  <div className="mt-1 text-xs text-text-muted">{log.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'outputs' && (
          <div className="space-y-3">
            {conversation.messages
              .filter((m) => m.role === 'assistant' && m.content.length > 50 && !m.content.includes('无权') && !m.content.includes('积分不足'))
              .map((m, i) => (
                <div key={i} className="rounded-xl border border-border-subtle bg-white p-3 shadow-sm">
                  <div className="mb-1 text-xs text-text-muted">{m.time}</div>
                  <div className="line-clamp-4 text-sm leading-relaxed text-text-primary">{m.content}</div>
                </div>
              ))}
            {conversation.messages.filter((m) => m.role === 'assistant' && m.content.length > 50).length === 0 && (
              <div className="text-sm text-text-muted">暂无产出物</div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {conversation.messages.map((m, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-xs">
                  {m.role === 'user' ? '我' : <RabbitHead agentId={m.dispatchAgent?.id ?? 'control'} className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-primary">
                      {m.role === 'user' ? '我' : (m.dispatchAgent?.name ?? 'YesGo')}
                    </span>
                    <span className="text-[10px] text-text-muted">{m.time}</span>
                  </div>
                  <div className="mt-1 line-clamp-3 text-xs leading-relaxed text-text-secondary">{m.content}</div>
                </div>
              </div>
            ))}
            {conversation.messages.length === 0 && (
              <div className="text-sm text-text-muted">暂无历史对话</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** 从当前会话消息生成工作日志时间线 */
function buildWorkLogs(conversation: Conversation): WorkLogItem[] {
  const logs: WorkLogItem[] = []

  for (const msg of conversation.messages) {
    if (msg.role === 'user') {
      logs.push({
        icon: 'clock',
        text: `收到${taskLabel(msg.content)}，正在解析意图...`,
        time: msg.time,
      })
      continue
    }

    // 助手消息：携带派发的智能体 → 生成“已派发”日志
    if (msg.dispatchAgent) {
      logs.push({
        icon: 'zap',
        text: `已派发${msg.dispatchAgent.name}，正在生成${msg.dispatchAgent.intent}方案`,
        time: msg.time,
      })
    }

    // 助手消息：内容较长且无错误提示 → 视为最终结果
    if (msg.content.length > 50 && !msg.content.includes('无权') && !msg.content.includes('积分不足')) {
      logs.push({
        icon: 'clock',
        text: '方案生成完毕，等待确认',
        time: msg.time,
      })
      logs.push({
        icon: 'clock',
        text: '空闲中，等待新任务',
        time: msg.time,
      })
    }
  }

  // 没有任何消息时，默认展示空闲状态
  if (logs.length === 0) {
    logs.push({
      icon: 'clock',
      text: '空闲中，等待新任务',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    })
  }

  return logs
}

/** 根据用户文案简单推断任务类型，匹配设计示例 */
function taskLabel(content: string): string {
  if (content.includes('采购') || content.includes('补货') || content.includes('订货')) return '采购任务'
  if (content.includes('客户') || content.includes('跟进') || content.includes('拜访')) return '客户跟进任务'
  if (content.includes('经营') || content.includes('分析') || content.includes('报告')) return '经营分析任务'
  if (content.includes('流向') || content.includes('渠道')) return '流向监控任务'
  if (content.includes('学术') || content.includes('文献') || content.includes('论文')) return '学术内容任务'
  return '任务'
}
