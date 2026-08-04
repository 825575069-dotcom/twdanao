import { useState, useMemo } from 'react'
import { Clock, Zap, Download, Trash2, Plus, MessageSquare } from 'lucide-react'
import type { Conversation } from '../App'
import RabbitHead from './RabbitHead'

interface Props {
  conversation: Conversation
  conversations: Conversation[]
  onSwitch: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  /** 点击工作日志条目时，定位到聊天中对应的消息 */
  onJumpToMessage?: (msgId: string) => void
  /** 受控模式：外部传入当前激活的 Tab */
  activeTab?: TabKey
  /** 受控模式：Tab 切换回调 */
  onActiveTabChange?: (tab: TabKey) => void
}

type TabKey = 'logs' | 'outputs' | 'history'

interface WorkLogItem {
  icon: 'clock' | 'zap'
  text: string
  time: string
  /** 该日志条目对应的来源消息 id（用于点击定位） */
  msgId: string
}

interface OutputItem {
  id: string
  title: string
  type: string
  content: string
  time: string
  size: number
}

export default function ChatToolsPanel({
  conversation,
  conversations,
  onSwitch,
  onNew,
  onDelete,
  onJumpToMessage,
  activeTab: controlledTab,
  onActiveTabChange,
}: Props) {
  const [internalTab, setInternalTab] = useState<TabKey>('logs')
  const activeTab = controlledTab ?? internalTab
  const setActiveTab = (tab: TabKey) => {
    onActiveTabChange?.(tab)
    setInternalTab(tab)
  }
  const logs = useMemo(() => buildWorkLogs(conversation), [conversation])
  const outputs = useMemo(() => buildOutputs(conversation), [conversation])

  const tabs = [
    { key: 'logs' as TabKey, label: '工作日志' },
    { key: 'outputs' as TabKey, label: '产出物' },
    { key: 'history' as TabKey, label: '历史对话' },
  ]

  return (
    <div className="flex h-full w-full flex-col border-l border-border-subtle bg-bg-elevated shadow-lg">
      {/* 团队头部：高度与聊天标题栏 h-14 对齐 */}
      <div className="flex h-14 shrink-0 items-start gap-3 border-b border-border-subtle bg-bg-elevated px-4 pt-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated">
          <RabbitHead agentId="control" className="h-full w-full" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <div className="truncate text-base font-semibold text-text-primary">YesGo团队</div>
          <div className="truncate text-xs text-text-muted">更懂你的数字员工</div>
        </div>
      </div>

      {/* 三个 Tab */}
      <div className="flex border-b border-border-subtle bg-bg-elevated">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-1/2 inline-block h-0.5 w-10 -translate-x-1/2 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'logs' && (
          <div className="space-y-5">
            {logs.map((log, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onJumpToMessage?.(log.msgId)}
                title="点击定位到该条聊天消息"
                className="flex w-full gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-white"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center pt-0.5">
                  {log.icon === 'zap' ? (
                    <Zap className="h-4 w-4 text-accent" />
                  ) : (
                    <Clock className="h-4 w-4 text-text-muted" />
                  )}
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="text-sm leading-relaxed text-text-primary">{log.text}</div>
                  <div className="mt-1 text-xs text-text-muted">{log.time}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'outputs' && (
          <div className="space-y-3">
            {outputs.length > 0 ? (
              outputs.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border-subtle bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-text-primary">{item.title}</span>
                        <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">
                          {item.type}
                        </span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                        {item.content}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadOutput(item)}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
                      title="下载该产出物"
                    >
                      <Download className="h-3.5 w-3.5" />
                      下载
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                    <span>{item.time}</span>
                    <span>{formatSize(item.size)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-text-muted">暂无 AI 产出文件</div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onNew}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-subtle bg-white px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-default hover:text-text-primary"
            >
              <Plus className="h-4 w-4" />
              新建对话
            </button>
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => onSwitch(c.id)}
                className={`group flex cursor-pointer items-center gap-3 rounded-xl border border-border-subtle p-3 transition-colors hover:bg-white ${
                  c.id === conversation.id ? 'bg-white shadow-sm' : 'bg-transparent'
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-elevated">
                  <MessageSquare className="h-4 w-4 text-text-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text-primary">{c.title}</div>
                  <div className="mt-0.5 text-[11px] text-text-muted">
                    {new Date(c.updatedAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(c.id)
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                  title="删除该对话"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
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
        msgId: msg.id,
      })
      continue
    }

    if (msg.dispatchAgent) {
      // 经理兔的确认消息不计入工作日志，只记录业务兔的实际执行
      if (msg.dispatchAgent?.id === 'control') continue
      logs.push({
        icon: 'zap',
        text: `已派发${msg.dispatchAgent.name}，正在生成${msg.dispatchAgent.intent}方案`,
        time: msg.time,
        msgId: msg.id,
      })
    }

    if (msg.content.length > 50 && !msg.content.includes('无权') && !msg.content.includes('积分不足')) {
      logs.push({ icon: 'clock', text: '方案生成完毕，等待确认', time: msg.time, msgId: msg.id })
      logs.push({ icon: 'clock', text: '空闲中，等待新任务', time: msg.time, msgId: msg.id })
    }
  }

  if (logs.length === 0) {
    logs.push({
      icon: 'clock',
      text: '空闲中，等待新任务',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      msgId: '',
    })
  }

  return logs
}

/** 从助手消息生成可下载的 AI 产出物列表 */
function buildOutputs(conversation: Conversation): OutputItem[] {
  const outputs: OutputItem[] = []

  for (const msg of conversation.messages) {
    if (msg.role !== 'assistant') continue
    // 经理兔的意图确认消息不属于可下载产出物
    if (msg.dispatchAgent?.id === 'control') continue
    if (msg.content.length <= 50) continue
    if (msg.content.includes('无权') || msg.content.includes('积分不足')) continue

    outputs.push({
      id: msg.id,
      title: outputTitle(msg),
      type: 'Markdown',
      content: msg.content,
      time: msg.time,
      size: new Blob([msg.content]).size,
    })
  }

  return outputs.reverse()
}

/** 下载产出物为 Markdown 文件 */
function downloadOutput(item: OutputItem) {
  const blob = new Blob([`# ${item.title}\n\n${item.content}`], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${item.title}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 根据派发智能体与意图推断产出物标题 */
function outputTitle(msg: import('../App').Message): string {
  if (msg.dispatchAgent) {
    const intent = msg.dispatchAgent.intent
    if (intent.includes('客户跟进')) return '客户跟进计划'
    if (intent.includes('采购补货')) return '采购补货方案'
    if (intent.includes('经营分析')) return '经营分析报告'
    if (intent.includes('流向监控')) return '流向监控报告'
    if (intent.includes('学术内容')) return '学术内容方案'
    return `${msg.dispatchAgent.name}产出`
  }
  return 'AI 产出文档'
}

/** 根据用户文案简单推断任务类型 */
function taskLabel(content: string): string {
  if (content.includes('采购') || content.includes('补货') || content.includes('订货')) return '采购任务'
  if (content.includes('客户') || content.includes('跟进') || content.includes('拜访')) return '客户跟进任务'
  if (content.includes('经营') || content.includes('分析') || content.includes('报告')) return '经营分析任务'
  if (content.includes('流向') || content.includes('渠道')) return '流向监控任务'
  if (content.includes('学术') || content.includes('文献') || content.includes('论文')) return '学术内容任务'
  return '任务'
}

/** 格式化字节大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
