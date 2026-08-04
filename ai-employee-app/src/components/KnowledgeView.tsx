import { useState, useRef, useEffect } from 'react'
import {
  BookOpen, FileText, Upload, Search, Trash2, X,
  FileSpreadsheet, FileCode, FileType, FolderOpen,
  Pencil, Eye, Clock, Loader2, CheckCircle2, AlertCircle,
  Link2, Folder,
} from 'lucide-react'
import RabbitHead from './RabbitHead'
import { PageTitle } from './SkillsView'
import { useStore, type KnowledgeDoc } from '../store/appStore'
import {
  createKnowledgeDoc, deleteKnowledgeDoc,
  updateKnowledgeDoc, getKnowledgeDocContent,
  syncExtendedFromBackend,
} from '../lib/backend'

// —— 文件类型图标映射 ——
function getFileIcon(type: string) {
  const t = type.toUpperCase()
  if (t === 'PDF') return FileText
  if (t === 'XLS' || t === 'XLSX') return FileSpreadsheet
  if (t === 'MD') return FileCode
  if (t === 'DOC' || t === 'DOCX') return FileType
  return FileText
}

function getFileTypeColor(type: string): string {
  const t = type.toUpperCase()
  if (t === 'PDF') return 'text-red-400'
  if (t === 'XLS' || t === 'XLSX') return 'text-emerald-400'
  if (t === 'MD') return 'text-blue-400'
  if (t === 'DOC' || t === 'DOCX') return 'text-blue-400'
  return 'text-text-muted'
}

function normalizeFileType(ext: string): string {
  const t = ext.toUpperCase()
  if (t === 'DOCX') return 'DOC'
  if (t === 'XLSX') return 'XLS'
  if (t === 'PPTX') return 'PPT'
  return t
}

// ============================================================
// 绑定智能体弹窗
// ============================================================
interface BindAgentsModalProps {
  open: boolean
  doc: KnowledgeDoc | null
  agents: { id: string; name: string; role: string }[]
  onClose: () => void
  onSave: (docId: string, agentIds: string[]) => Promise<void>
}

function BindAgentsModal({ open, doc, agents, onClose, onSave }: BindAgentsModalProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && doc) {
      setSelected(doc.boundAgents || [])
    }
  }, [open, doc])

  if (!open || !doc) return null

  const toggleAgent = (agentId: string) => {
    setSelected(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(doc.id, selected)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="bg-bg-surface rounded-xl shadow-xl border border-border-subtle max-w-md w-full mx-4 p-5" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-text-primary mb-1 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-accent" />
          绑定智能体
        </h3>
        <p className="text-xs text-text-muted mb-4">
          选择可读取「{doc.name}」的智能体（多选）。绑定后，智能体在回答问题时会自动检索该文档。
        </p>

        {agents.length === 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
            当前暂无可选智能体，请先联系管理员分配智能体。
          </div>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {agents.map(agent => (
              <label
                key={agent.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selected.includes(agent.id)
                    ? 'border-accent/50 bg-accent/10'
                    : 'border-border-subtle hover:bg-bg-hover'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(agent.id)}
                  onChange={() => toggleAgent(agent.id)}
                  className="rounded border-border-subtle text-accent focus:ring-accent"
                />
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-bg-elevated">
                  <RabbitHead agentId={agent.id} className="h-full w-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary">{agent.name}</div>
                  <div className="text-xs text-text-muted truncate">{agent.role}</div>
                </div>
                {selected.includes(agent.id) && (
                  <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0" />
                )}
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || agents.length === 0}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 文档预览弹窗
// ============================================================
interface DocPreviewModalProps {
  open: boolean
  doc: KnowledgeDoc | null
  onClose: () => void
}

function DocPreviewModal({ open, doc, onClose }: DocPreviewModalProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !doc) return
    setLoading(true)
    setError('')
    setContent('')
    getKnowledgeDocContent(doc.id)
      .then(text => {
        setContent(text || '')
      })
      .catch(() => {
        setError('获取文档内容失败')
      })
      .finally(() => setLoading(false))
  }, [open, doc])

  if (!open || !doc) return null

  const FileIcon = getFileIcon(doc.type)
  const iconColor = getFileTypeColor(doc.type)

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-accent animate-spin" />
          <span className="ml-2 text-sm text-text-muted">加载文档内容...</span>
        </div>
      )
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )
    }
    if (!content.trim()) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <FileText className="h-8 w-8 text-text-muted mb-2" />
          <p className="text-sm text-text-muted">该文档暂无可预览的文本内容</p>
          <p className="text-xs text-text-muted mt-1">文档可能尚未完成文本提取</p>
        </div>
      )
    }
    return (
      <pre className="whitespace-pre-wrap break-words text-sm text-text-primary font-mono leading-relaxed p-4 bg-bg-elevated rounded-lg">
        {content}
      </pre>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in" onClick={onClose}>
      <div
        className="bg-bg-surface rounded-xl shadow-2xl border border-border-subtle max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-border-subtle">
          <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center flex-shrink-0">
            <FileIcon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary truncate">{doc.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
              <span className="px-1.5 py-0.5 rounded-full bg-bg-elevated text-text-secondary">{doc.type}</span>
              <span>{doc.size}</span>
              {doc.time && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {doc.time}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors flex-shrink-0"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle bg-bg-elevated/50 rounded-b-xl">
          <span className="text-xs text-text-muted">
            {content ? `共 ${content.length} 字符` : ''}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 知识文档主视图（表格布局，对齐天网大脑交互）
// ============================================================
export default function KnowledgeView() {
  const store = useStore()
  const [query, setQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bindDoc, setBindDoc] = useState<KnowledgeDoc | null>(null)
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDoc | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 从 store 获取智能体列表（已同步的租户智能体）
  const agents = store.agents.filter(a => a.id !== 'control')

  // 智能体名称查找
  const getAgentName = (agentId: string): string => {
    const agent = store.agents.find(a => a.id === agentId)
    return agent?.name || agentId
  }

  // 搜索过滤
  const filtered = store.knowledge.filter(d => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      d.name.toLowerCase().includes(q) ||
      d.folder.toLowerCase().includes(q) ||
      d.boundAgents?.some(a => a.toLowerCase().includes(q) || getAgentName(a).toLowerCase().includes(q))
    )
  })

  // —— 上传文档 ——
  const handleUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadSuccess(false)
    setError('')
    try {
      const ext = file.name.split('.').pop() || ''
      const type = normalizeFileType(ext)
      const sizeKBNum = file.size / 1024
      const sizeStr = sizeKBNum > 1024 ? `${(sizeKBNum / 1024).toFixed(1)} MB` : `${sizeKBNum.toFixed(1)} KB`

      const payload: Record<string, unknown> = {
        name: file.name,
        type,
        size: sizeStr,
        folder: 'root',
        bound_agents: [],
      }

      // 文本类文件读取内容用于在线预览
      const textExts = ['md', 'txt', 'csv', 'json', 'xml', 'html', 'js', 'ts', 'py', 'sql']
      if (textExts.includes(ext.toLowerCase()) && file.size < 512 * 1024) {
        const text = await file.text()
        payload.content_text = text
      }

      // 调后端创建
      const ok = await createKnowledgeDoc(payload)
      if (!ok) {
        setError('上传失败，请检查网络或权限')
        return
      }

      // 刷新列表（重新同步知识库）
      const extResult = await syncExtendedFromBackend()
      if (extResult.knowledge) {
        store.syncExtendedFromBackend({
          knowledge: extResult.knowledge,
          media: null,
          tasks: null,
          creditBalance: null,
          creditLedger: null,
          skills: null,
          saas: null,
          connectors: null,
          workflowTemplates: null,
        })
      }

      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 2000)
    } catch {
      setError('上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // —— 绑定智能体保存 ——
  const handleBindSave = async (docId: string, agentIds: string[]) => {
    const updated = await updateKnowledgeDoc(docId, { bound_agents: agentIds })
    if (updated) {
      store.updateDoc(docId, { boundAgents: agentIds })
    } else {
      setError('绑定智能体失败')
    }
  }

  // —— 删除文档 ——
  const handleDelete = async () => {
    if (deleteId === null) return
    setDeleting(true)
    try {
      const ok = await deleteKnowledgeDoc(deleteId)
      if (ok) {
        store.removeDoc(deleteId)
        setDeleteId(null)
      } else {
        setError('删除失败')
      }
    } catch {
      setError('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const openBind = (doc: KnowledgeDoc) => {
    if (agents.length === 0) {
      setError('当前暂无可选智能体，请先联系管理员分配智能体。')
      return
    }
    setBindDoc(doc)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageTitle
        icon={BookOpen}
        title="私有知识库"
        desc="上传企业文档并绑定到智能体，检索增强其专业回答。数据按租户私有隔离，不参与公网训练。"
      />

      {/* 搜索 + 上传 */}
      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索文档名称、文件夹、智能体..."
            className="w-full rounded-xl border border-border-subtle bg-bg-surface/70 py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {uploadSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-300 animate-fade-in">
              <CheckCircle2 className="h-3.5 w-3.5" />
              上传成功
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.csv,.json"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            上传文档
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm text-red-300">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 文档表格 */}
      {store.backendSyncing ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-bg-surface/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-surface/40 py-12 text-center">
          <FolderOpen className="h-8 w-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted">暂无知识文档</p>
          <p className="text-xs text-text-muted mt-1">点击右上角「上传文档」添加企业知识</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-xs text-text-muted bg-bg-elevated/50">
                  <th className="text-left py-2.5 px-3 font-medium">文档名称</th>
                  <th className="text-left py-2.5 px-3 font-medium">类型</th>
                  <th className="text-left py-2.5 px-3 font-medium">大小</th>
                  <th className="text-left py-2.5 px-3 font-medium">文件夹</th>
                  <th className="text-left py-2.5 px-3 font-medium">绑定智能体</th>
                  <th className="text-left py-2.5 px-3 font-medium">上传时间</th>
                  <th className="text-right py-2.5 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => {
                  const FileIcon = getFileIcon(doc.type)
                  const iconColor = getFileTypeColor(doc.type)
                  return (
                    <tr key={doc.id} className="border-b border-border-subtle/50 hover:bg-bg-hover/30 transition-colors">
                      {/* 文档名称 */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <FileIcon className={`h-4 w-4 ${iconColor} flex-shrink-0`} />
                          <span className="text-text-primary font-medium text-sm truncate max-w-[200px]">{doc.name}</span>
                        </div>
                      </td>
                      {/* 类型 */}
                      <td className="py-2.5 px-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary">{doc.type}</span>
                      </td>
                      {/* 大小 */}
                      <td className="py-2.5 px-3 text-text-muted text-xs">{doc.size}</td>
                      {/* 文件夹 */}
                      <td className="py-2.5 px-3 text-text-muted text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Folder className="h-3 w-3 text-text-muted" />
                          {doc.folder}
                        </span>
                      </td>
                      {/* 绑定智能体 */}
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => openBind(doc)}
                          className="group inline-flex items-center gap-1 text-xs transition-colors"
                          title="编辑绑定智能体"
                        >
                          {doc.boundAgents && doc.boundAgents.length > 0 ? (
                            doc.boundAgents.length === 1 ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                                <span className="h-4 w-4 overflow-hidden rounded-full">
                                  <RabbitHead agentId={doc.boundAgents[0]} className="h-full w-full" />
                                </span>
                                {getAgentName(doc.boundAgents[0])}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                                <span className="flex -space-x-1">
                                  {doc.boundAgents.slice(0, 3).map(code => (
                                    <span key={code} className="h-4 w-4 overflow-hidden rounded-full border border-accent/10">
                                      <RabbitHead agentId={code} className="h-full w-full" />
                                    </span>
                                  ))}
                                </span>
                                绑定智能体{doc.boundAgents.length}
                              </span>
                            )
                          ) : (
                            <span className="text-text-muted">未绑定</span>
                          )}
                          <Pencil className="h-3 w-3 text-text-muted group-hover:text-accent" />
                        </button>
                      </td>
                      {/* 上传时间 */}
                      <td className="py-2.5 px-3 text-text-muted text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-text-muted" />
                          {doc.time || '—'}
                        </span>
                      </td>
                      {/* 操作 */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-md transition-colors"
                            title="在线预览"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(doc.id)}
                            className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                            title="删除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 绑定智能体弹窗 */}
      <BindAgentsModal
        open={bindDoc !== null}
        doc={bindDoc}
        agents={agents}
        onClose={() => setBindDoc(null)}
        onSave={handleBindSave}
      />

      {/* 文档预览弹窗 */}
      <DocPreviewModal
        open={previewDoc !== null}
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {/* 删除确认弹窗 */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={() => setDeleteId(null)}>
          <div className="bg-bg-surface rounded-xl shadow-xl border border-border-subtle max-w-sm w-full mx-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="h-4.5 w-4.5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">确认删除</h3>
                <p className="text-xs text-text-muted">此操作不可撤销</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-4">确定要删除此文档吗？删除后无法恢复。</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
