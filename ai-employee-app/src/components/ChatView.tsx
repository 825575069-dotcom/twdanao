import { useState } from 'react'
import { Copy, ThumbsUp, ThumbsDown, Brain, ChevronDown, ChevronRight, FileText, Check, Menu, Star } from 'lucide-react'
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
}

export default function ChatView({
  conversation,
  onSend,
  onToolsToggle,
  onFavorite
}: Props) {
  const hasMessages = conversation.messages.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* 聊天标题栏：三按钮与标题同一水平线 */}
      {hasMessages && (
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-6">
          <div className="w-9" />
          <h2 className="text-lg font-semibold text-black">与YesGo的对话</h2>
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
        <div className="flex-1 min-w-0 overflow-y-auto">
          {conversation.messages.length === 0 ? (
            <WelcomeScreen onPick={onSend} />
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-6">
              <div className="space-y-6">
              {conversation.messages.map((m) => (
                <MessageBubble key={m.id} msg={m} onFavorite={onFavorite} />
              ))}
              </div>
            </div>
          )}
        </div>
      </div>
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

function MessageBubble({ msg, onFavorite }: { msg: Message; onFavorite?: (text: string) => void }) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)
  const [faved, setFaved] = useState(false)
  const [memoryExpanded, setMemoryExpanded] = useState(false)

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
      <div className="flex flex-row-reverse items-start animate-slide-up">
        <div className="flex max-w-[80%] flex-col items-end">
          <div className="rounded-2xl rounded-br-md bg-purple-50 px-4 py-2.5 text-base leading-relaxed text-text-primary">
            {msg.content}
          </div>
          {/* 附件展示 */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {msg.attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-2 py-1 text-xs text-text-secondary">
                  <FileText className="h-3 w-3" />
                  <span>{att.name}</span>
                  <span className="text-text-muted">{(att.size / 1024).toFixed(1)}KB</span>
                </div>
              ))}
            </div>
          )}
          {/* 操作按钮：用户消息可复制 / 收藏到提示库 */}
          <div className="mt-1 flex items-center gap-1 self-end px-1">
            <button
              onClick={handleCopy}
              className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
              title="复制"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
            {onFavorite && (
              <button
                onClick={handleFavorite}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-bg-hover ${
                  faved ? 'text-amber-400' : 'text-text-muted hover:text-amber-400'
                }`}
                title={faved ? '已收藏到提示库' : '收藏到提示库'}
              >
                {faved ? <Star className="h-3 w-3 fill-amber-400" /> : <Star className="h-3 w-3" />}
              </button>
            )}
          </div>
          <span className="mt-1 px-1 text-[11px] text-text-muted">{msg.time}</span>
        </div>
      </div>
    )
  }

  // 助手消息
  const memory = msg.memory
  const hasMemory = memory && memory.strategy !== 'disabled' && (memory.summary_count > 0 || memory.fact_count > 0)

  return (
    <div className="flex items-start gap-3 animate-slide-up">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated p-0.5">
        <RabbitHead agentId="control" className="h-full w-full" />
      </div>
      <div className="flex max-w-[85%] flex-col items-start">
        <div className="text-xs text-text-muted mb-1">
          {msg.dispatchAgent ? `${msg.dispatchAgent.emoji} ${msg.dispatchAgent.name}` : 'Marvis'}
          {msg.dispatchAgent && <span className="ml-1.5 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">{msg.dispatchAgent.intent}</span>}
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
              <Brain className="h-3 w-3 text-purple-400" />
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
                        <span className="rounded bg-purple-400/10 px-1 text-purple-400">{f.category}</span> {f.key}: {f.value}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mt-1.5 flex items-center gap-1 px-1">
          <button
            onClick={handleCopy}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
            title="复制"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>
          <button className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary" title="赞同">
            <ThumbsUp className="h-3 w-3" />
          </button>
          <button className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary" title="不赞同">
            <ThumbsDown className="h-3 w-3" />
          </button>
          <span className="ml-auto text-[11px] text-text-muted">{msg.time}</span>
        </div>
      </div>
    </div>
  )
}
