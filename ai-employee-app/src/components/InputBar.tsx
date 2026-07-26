import { useRef, useState, useEffect, useLayoutEffect, type KeyboardEvent, type ChangeEvent, type DragEvent } from 'react'
import { X, FileText, Zap } from 'lucide-react'
import type { FileAttachment } from '../types'
import { fetchChatPrompts } from '../lib/backend'

interface Props {
  onSend: (text: string, attachments?: FileAttachment[]) => void
  /** 用户自己收藏的提示词（从已发送文案收藏进提示库） */
  favorites: string[]
}

export default function InputBar({ onSend, favorites }: Props) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [chatPrompts, setChatPrompts] = useState<string[]>([])
  const [quickInputOpen, setQuickInputOpen] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const quickBtnRef = useRef<HTMLButtonElement>(null)
  const quickPopRef = useRef<HTMLDivElement>(null)

  // 点击快捷输入弹框外部时关闭
  useEffect(() => {
    if (!quickInputOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        (quickBtnRef.current && quickBtnRef.current.contains(t)) ||
        (quickPopRef.current && quickPopRef.current.contains(t))
      ) {
        return
      }
      setQuickInputOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [quickInputOpen])

  // 第二层发布提示词：供「快捷输入」弹框拉取展示
  useEffect(() => {
    fetchChatPrompts().then((data) => {
      if (data && data.length > 0) setChatPrompts(data)
    })
  }, [])

  // 自适应高度：保持最小 60px，输入时不缩小，超过时向上展开（最大 200px）
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.max(60, Math.min(ta.scrollHeight, 200)) + 'px'
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
      <div className="mx-auto max-w-3xl">
        {/* 快捷输入弹框：第二层发布的提示词 + 用户收藏的提示词 */}
        {quickInputOpen && (
          <div ref={quickPopRef} className="mb-3 max-h-[320px] overflow-y-auto rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-lg">
            <div className="mb-2 text-xs font-semibold text-text-secondary">第二层发布的提示词</div>
            {chatPrompts.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {chatPrompts.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setValue(p)
                      setQuickInputOpen(false)
                      taRef.current?.focus()
                    }}
                    className="max-w-[280px] truncate rounded-full border border-border-subtle bg-bg-elevated px-3 py-1 text-xs text-text-secondary transition-colors hover:border-border-default hover:text-text-primary"
                    title={p}
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mb-4 text-xs text-text-muted">暂无发布提示词</div>
            )}

            <div className="mb-2 text-xs font-semibold text-text-secondary">我收藏的提示词</div>
            {favorites.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {favorites.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setValue(p)
                      setQuickInputOpen(false)
                      taRef.current?.focus()
                    }}
                    className="max-w-[280px] truncate rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs text-purple-700 transition-colors hover:border-purple-300 hover:bg-purple-100"
                    title={p}
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs text-text-muted">暂无收藏，可在对话中点击「收藏」把常用文案加入提示库</div>
            )}
          </div>
        )}

        <div
          className="rounded-2xl border border-border-subtle bg-white p-4 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-border-default"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
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
            className="block min-h-[60px] w-full resize-none overflow-hidden bg-transparent px-1 py-1 text-base leading-6 text-text-primary placeholder:text-text-muted focus:outline-none"
          />

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* 快捷输入 */}
              <button
                ref={quickBtnRef}
                onClick={() => setQuickInputOpen(v => !v)}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  quickInputOpen
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                title="快捷输入：从发布提示词与我的收藏中快速选取"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>快捷输入</span>
              </button>
              {/* 选择文件 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-200"
                title="上传文件"
              >
                <span>+</span>
                <span>选择文件</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.png,.jpg,.jpeg,.gif,.webp"
            />

            {/* Go 按钮：有内容时高亮 */}
            <button
              onClick={submit}
              disabled={(!value.trim() && attachments.filter(a => a.status === 'done').length === 0) || sending}
              className={`flex h-9 items-center justify-center rounded-lg px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                value.trim() || attachments.filter(a => a.status === 'done').length > 0
                  ? 'bg-black text-white shadow-md hover:bg-gray-800'
                  : 'bg-gray-100 text-gray-500 disabled:bg-gray-100 disabled:text-gray-300'
              }`}
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
