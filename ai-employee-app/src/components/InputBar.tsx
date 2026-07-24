import { useRef, useState, useLayoutEffect, type KeyboardEvent, type ChangeEvent, type DragEvent } from 'react'
import { Send, Paperclip, X, FileText } from 'lucide-react'
import type { FileAttachment } from '../types'

interface Props {
  onSend: (text: string, attachments?: FileAttachment[]) => void
}

export default function InputBar({ onSend }: Props) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 自适应高度
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    if (!value.trim() && attachments.length === 0) {
      ta.style.height = '100px'
      return
    }
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [value, attachments])

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    addFiles(Array.from(files))
    e.target.value = '' // 重置以便重复选择
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

    // 模拟上传进度（后续替换为真实 API 调用）
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
    <div className="bg-bg-base px-6 py-4">
      <div className="mx-auto max-w-4xl">
        <div
          className="rounded-2xl border border-border-subtle bg-bg-surface p-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-border-default"
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
                  {/* 上传进度条 */}
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

          <div className="flex items-end gap-2">
            {/* 附件按钮 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
              title="上传文件"
            >
              <Paperclip className="h-4 w-4" strokeWidth={2} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.png,.jpg,.jpeg,.gif,.webp"
            />

            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入任务，交给我来帮你完成 · 支持拖拽上传文件"
              className="block h-[100px] flex-1 resize-none overflow-hidden bg-transparent px-3 py-2 text-sm leading-5 text-text-primary placeholder:text-text-muted focus:outline-none"
            />

            <button
              onClick={submit}
              disabled={(!value.trim() && attachments.filter(a => a.status === 'done').length === 0) || sending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:bg-bg-hover disabled:text-text-muted border border-border-subtle/50"
              title="发送"
            >
              <Send className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
