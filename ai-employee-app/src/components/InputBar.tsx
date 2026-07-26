import { useRef, useState, useEffect, useLayoutEffect, useMemo, type KeyboardEvent, type ChangeEvent, type DragEvent } from 'react'
import { X, FileText } from 'lucide-react'
import type { FileAttachment } from '../types'
import { fetchChatPrompts } from '../lib/backend'

interface MessageLike {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  onSend: (text: string, attachments?: FileAttachment[]) => void
  messages: MessageLike[]
}

/** 简单中文停用词表：用于从提示词/对话中提取关键词做关联匹配 */
const STOP_WORDS = new Set([
  '帮我', '一份', '几款', '的', '了', '和', '与', '或', '在', '是', '有', '可以', '一下', '一些', '一个',
  '需要', '请', '给', '来', '把', '让', '做', '完成', '进行', '为', '对', '向', '从', '到', '由', '将', '被'
])

/** 提取关键词（去掉非中文字符、去停用词、取 bigram） */
function extractTerms(text: string): string[] {
  const cleaned = text.replace(/[^\u4e00-\u9fa5]/g, ' ')
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2)
  const terms: string[] = []
  for (const token of tokens) {
    if (token.length === 2) {
      if (!STOP_WORDS.has(token)) terms.push(token)
    } else {
      for (let i = 0; i < token.length - 1; i++) {
        const bigram = token.slice(i, i + 2)
        if (!STOP_WORDS.has(bigram)) terms.push(bigram)
      }
    }
  }
  return [...new Set(terms)]
}

/** 根据对话上下文从提示库中挑选最相关的提示词 */
function getRelatedPrompts(prompts: string[], messages: MessageLike[], max = 5): string[] {
  if (messages.length === 0 || prompts.length === 0) return []
  const context = messages.map((m) => m.content).join(' ')
  const contextTerms = extractTerms(context)
  const scored = prompts.map((p) => ({
    prompt: p,
    score: contextTerms.length === 0 ? 0 : extractTerms(p).filter((t) => contextTerms.includes(t)).length
  }))
  scored.sort((a, b) => b.score - a.score)
  // 如果完全无匹配，fallback 展示前 3 条，避免功能空白
  if (scored[0]?.score === 0) return scored.slice(0, 3).map((s) => s.prompt)
  return scored.slice(0, max).map((s) => s.prompt)
}

export default function InputBar({ onSend, messages }: Props) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [chatPrompts, setChatPrompts] = useState<string[]>([])
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 普通提示词：进入正式聊天（有消息记录）后，根据当前话题从提示库关联展示
  useEffect(() => {
    fetchChatPrompts().then((data) => {
      if (data && data.length > 0) setChatPrompts(data)
    })
  }, [])

  const relatedPrompts = useMemo(() => getRelatedPrompts(chatPrompts, messages), [chatPrompts, messages])

  // 自适应高度
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    if (!value.trim() && attachments.length === 0) {
      ta.style.height = '80px'
      return
    }
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [value, attachments])

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    addFiles(Array.from(files))
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) addFiles(files)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
  }

  const addFiles = (files: File[]) => {
    const newAttachments: FileAttachment[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      status: 'uploading',
      progress: 0,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    setAttachments((prev) => [...prev, ...newAttachments])

    newAttachments.forEach((att) => {
      simulateUpload(att.id)
    })
  }

  const simulateUpload = (attId: string) => {
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 30
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        setAttachments((prev) =>
          prev.map((a) => (a.id === attId ? { ...a, progress: 100, status: 'done' } : a))
        )
      } else {
        setAttachments((prev) =>
          prev.map((a) => (a.id === attId ? { ...a, progress: Math.floor(progress) } : a))
        )
      }
    }, 200)
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id)
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl)
      return prev.filter((a) => a.id !== id)
    })
  }

  const submit = () => {
    if ((!value.trim() && attachments.length === 0) || sending) return
    const validAttachments = attachments.filter((a) => a.status === 'done')
    onSend(value, validAttachments.length > 0 ? validAttachments : undefined)
    setValue('')
    setAttachments([])
    setSending(true)
    setTimeout(() => setSending(false), 800)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <div className="bg-transparent px-6 pb-6 pt-2">
      <div className="mx-auto max-w-4xl">
        <div
          className="rounded-2xl border border-border-subtle bg-white p-4 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-border-default"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {/* 普通提示词：正式聊天时根据话题关联展示 */}
          {relatedPrompts.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {relatedPrompts.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setValue(p)
                    taRef.current?.focus()
                  }}
                  className="max-w-[280px] truncate rounded-full border border-border-subtle bg-bg-elevated px-3 py-1 text-xs text-text-secondary transition-colors hover:border-border-default hover:text-text-primary"
                  title={p}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* 附件预览区 */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="relative flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5"
                >
                  {att.previewUrl ? (
                    <img src={att.previewUrl} alt={att.name} className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-bg-hover">
                      <FileText className="h-4 w-4 text-text-muted" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="max-w-[150px] truncate text-xs text-text-primary">{att.name}</span>
                    <span className="text-[10px] text-text-muted">
                      {att.status === 'uploading' ? `${att.progress}%` : att.status === 'done' ? formatSize(att.size) : '失败'}
                    </span>
                  </div>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-bg-hover text-text-muted hover:text-rose-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {att.status === 'uploading' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-lg">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${att.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入任务，交给我来帮你完成"
            className="block h-[80px] w-full resize-none overflow-hidden bg-transparent px-1 py-1 text-sm leading-5 text-text-primary placeholder:text-text-muted focus:outline-none"
          />

          <div className="mt-2 flex items-center justify-between">
            {/* 选择文件 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-200"
              title="上传文件"
            >
              <span>+</span>
              <span>选择文件</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.png,.jpg,.jpeg,.gif,.webp"
            />

            {/* Go 按钮 */}
            <button
              onClick={submit}
              disabled={(!value.trim() && attachments.filter(a => a.status === 'done').length === 0) || sending}
              className="flex h-9 items-center justify-center rounded-lg bg-gray-100 px-5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-300"
              title="发送"
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
