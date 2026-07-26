import { useState, useRef, useEffect } from 'react'
import { Copy, ThumbsUp, ThumbsDown, Brain, ChevronDown, ChevronRight, FileText, Check, Menu, Star, ArrowDown } from 'lucide-react'
import type { Message, Conversation } from '../App'
import WelcomeScreen from './WelcomeScreen'
import RabbitHead from './RabbitHead'

interface Props {
  conversation: Conversation
  conversations: Conversation[]
  onNew: () => void
  onSwitch: (id: string) => void
  onDelete: (id: string) => void
  onSend: (text: string) => void
  onToolsToggle?: () => void
  onFavorite?: (text: string) => void
  /** 向父组件注册「滚动并定位到指定消息」的方法 */
  registerScrollToMessage?: (fn: (msgId: string) => void) => void
}

export default function ChatView({
  conversation,
  onSend,
  onToolsToggle,
  onFavorite,
  registerScrollToMessage
}: Props) {
  const hasMessages = conversation.messages.length > 0
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [atBottom, setAtBottom] = useState(true)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
    setAtBottom(nearBottom)
  }

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setAtBottom(true)
  }

  // 滚动并定位到指定消息：平滑滚动到可视区域中央，并临时高亮
  const scrollToMessage = (msgId: string) => {
    const el = messageRefs.current.get(msgId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(msgId)
    window.setTimeout(() => {
      setHighlightId((cur) => (cur === msgId ? null : cur))
    }, 2000)
  }

  // 向父组件注册定位方法（供右侧工作日志点击调用）
  useEffect(() => {
    registerScrollToMessage?.(scrollToMessage)
  }, [registerScrollToMessage])

  // 切换会话时清空消息 ref 映射，避免残留旧 id
  useEffect(() => {
    messageRefs.current.clear()
  }, [conversation.id])

  // 新消息到达时：若用户在底部，则自动上滚到底；若用户已上滑，则显示「回到最新」按钮
  useEffect(() => {
    if (atBottom && hasMessages) {
      scrollToBottom()
    }
  }, [conversation.id, conversation.messages.length, atBottom, hasMessages])

  return (
    <div className="flex h-full flex-col">
      {/* 聊天标题栏：三按钮与标题同一水平线 */}
      {hasMessages && (
        <div className="flex h-14 shrink-0 items-center justify-between px-6">
          <div className="w-9" />
          <h2 className="text-2xl font-semibold text-black">与YesGo的对话</h2>
          {onToolsToggle && (
            <button
              onClick={onToolsToggle}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              title="工具栏"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* 消息区 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="relative flex-1 min-w-0 overflow-y-auto"
        >
          {conversation.messages.length === 0 ? (
            <WelcomeScreen onPick={onSend} onToggleTools={onToolsToggle} />
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-6">
              <div className="space-y-6">
              {conversation.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  highlighted={highlightId === m.id}
                  onFavorite={onFavorite}
                  registerRef={(el) => {
                    if (el) messageRefs.current.set(m.id, el)
                    else messageRefs.current.delete(m.id)
                  }}
                />
              ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 用户上滑后显示「回到最新」快捷按钮，固定于输入框上方 */}
      {hasMessages && !atBottom && (
        <div className="flex shrink-0 justify-center border-t border-border-subtle bg-bg-base py-2">
          <button
            type="button"
            onClick={scrollToBottom}
            className="flex items-center gap-1 rounded-full border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-primary shadow-sm transition-colors hover:bg-bg-hover"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            回到最新
          </button>
        </div>
      )}
    </div>
  )
}

/** 简易 Markdown 渲染 */
function renderMarkdown(content: string) {
  const lines = content.split('\n')
  return lines.map((line, i) => {
    // 空行
    if (!line.trim()) return <div key={i} className="h-2" />

    // 标题
    if (line.startsWith('### ')) return <h3 key={i} className="mt-2 mb-1 text-base font-semibold text-text-primary">{line.slice(4)}</h3>
    if (line.startsWith('## ')) return <h2 key={i} className="mt-2 mb-1 text-lg font-semibold text-text-primary">{line.slice(3)}</h2>

    // 分割线
    if (line.trim() === '---') return <hr key={i} className="my-2 border-border-subtle" />

    // 列表项
    if (line.match(/^\d+\.\s/)) return <div key={i} className="ml-4 text-base leading-relaxed text-text-primary">{line}</div>
    if (line.startsWith('- ') || line.startsWith('• ')) return <div key={i} className="ml-4 text-base leading-relaxed text-text-primary">• {line.slice(2)}</div>

    // 代码块（简单处理）
    if (line.startsWith('```')) return <div key={i} className="my-1 rounded bg-black/10 px-3 py-1 font-mono text-sm text-text-secondary">{line.replace(/```/g, '')}</div>

    // 普通文本（处理加粗和行内代码）
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
    return (
      <p key={i} className="text-base leading-relaxed text-text-primary">
        {parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
          if (part.startsWith('`') && part.endsWith('`')) return <code key={j} className="rounded bg-black/10 px-1 py-0.5 font-mono text-xs">{part.slice(1, -1)}</code>
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={j}>{part.slice(1, -1)}</em>
          return <span key={j}>{part}</span>
        })}
      </p>
    )
  })
}

function MessageBubble({
  msg,
  onFavorite,
  highlighted,
  registerRef
}: {
  msg: Message
  onFavorite?: (text: string) => void
  highlighted?: boolean
  registerRef?: (el: HTMLDivElement | null) => void
}) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)
  const [faved, setFaved] = useState(false)
  const [memoryExpanded, setMemoryExpanded] = useState(false)

  const highlightClass = highlighted
    ? 'bg-accent/10 ring-2 ring-accent/30 rounded-2xl'
    : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleFavorite = () => {
    if (!onFavorite) return
    onFavorite(msg.content)
    setFaved(true)
    setTimeout(() => setFaved(false), 2000)
  }

  if (isUser) {
    return (
      <div ref={registerRef} className={`flex flex-row-reverse items-start animate-slide-up px-1.5 py-1 ${highlightClass}`}>
        <div className="flex max-w-[80%] flex-col items-end">
          <div className="rounded-2xl rounded-br-md bg-accent-soft px-4 py-2.5 text-base leading-relaxed text-text-primary">
            {msg.content}
          </div>
          {/* 附件展示 */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {msg.attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-1.5 rounded-lg bg-accent-soft px-2 py-1 text-xs text-text-secondary">
                  <FileText className="h-3 w-3" />
                  <span>{att.name}</span>
                  <span className="text-text-muted">{(att.size / 1024).toFixed(1)}KB</span>
                </div>
              ))}
            </div>
          )}
          {/* 操作按钮：用户消息可复制 / 收藏到提示库；时间与图标同水平线 */}
          <div className="mt-1 flex items-center gap-1 self-end px-1">
            <button
              onClick={handleCopy}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
              title="复制"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
            {onFavorite && (
              <button
                onClick={handleFavorite}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-bg-hover ${
                  faved ? 'text-amber-400' : 'text-text-muted hover:text-amber-400'
                }`}
                title={faved ? '已收藏到提示库' : '收藏到提示库'}
              >
                {faved ? <Star className="h-4 w-4 fill-amber-400" /> : <Star className="h-4 w-4" />}
              </button>
            )}
            <span className="ml-1 text-[11px] text-text-muted">{msg.time}</span>
          </div>
        </div>
      </div>
    )
  }

  // 助手消息
  const memory = msg.memory
  const hasMemory = memory && memory.strategy !== 'disabled' && (memory.summary_count > 0 || memory.fact_count > 0)

  return (
    <div ref={registerRef} className={`flex items-start gap-3 animate-slide-up px-1.5 py-1 ${highlightClass}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated p-0.5">
        <RabbitHead agentId={msg.dispatchAgent?.id ?? 'control'} className="h-full w-full" />
      </div>
      <div className="flex max-w-[85%] flex-col items-start">
        <div className="text-xs text-text-muted mb-1">
          {msg.dispatchAgent ? msg.dispatchAgent.name : 'YesGo 经理兔'}
        </div>
        <div className="rounded-2xl rounded-bl-md bg-white px-4 py-2.5">
          {renderMarkdown(msg.content)}
        </div>

        {/* 记忆召回面板 */}
        {hasMemory && (
          <div className="mt-1.5 w-full rounded-lg border border-border-subtle bg-bg-surface/50">
            <button
              onClick={() => setMemoryExpanded(v => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary"
            >
              {memoryExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Brain className="h-3 w-3 text-accent/70" />
              <span>记忆召回</span>
              <span className="text-text-muted">
                短期{memory.short_term_count}条 · 摘要{memory.summary_count}篇 · 事实{memory.fact_count}条 · {memory.total_tokens}tokens
              </span>
            </button>
            {memoryExpanded && (
              <div className="space-y-2 px-3 pb-2.5">
                {memory.recalled_summaries && memory.recalled_summaries.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-medium text-text-muted">📋 历史摘要</div>
                    {memory.recalled_summaries.map((s) => (
                      <div key={s.id} className="rounded bg-bg-hover px-2 py-1 text-[11px] text-text-secondary">
                        <span className="text-text-muted">{s.date}</span> {s.title}
                      </div>
                    ))}
                  </div>
                )}
                {memory.recalled_facts && memory.recalled_facts.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-medium text-text-muted">💡 关键事实</div>
                    {memory.recalled_facts.map((f) => (
                      <div key={f.id} className="rounded bg-bg-hover px-2 py-1 text-[11px] text-text-secondary">
                        <span className="rounded bg-accent/10 px-1 text-accent/70">{f.category}</span> {f.key}: {f.value}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮：图标大一号，时间与积分消耗同水平线 */}
        <div className="mt-1.5 flex items-center gap-1 px-1">
          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
            title="复制"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary" title="赞同">
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary" title="不赞同">
            <ThumbsDown className="h-4 w-4" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            {msg.creditCost != null && (
              <span className="text-[11px] text-text-muted">
                积分消耗 <span className="font-semibold text-text-secondary">{msg.creditCost}</span>
              </span>
            )}
            <span className="text-[11px] text-text-muted">{msg.time}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
