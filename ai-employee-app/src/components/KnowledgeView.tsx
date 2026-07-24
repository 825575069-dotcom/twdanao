import { useState } from 'react'
import { BookOpen, FileText, Upload, Search, Folder, Trash2, Lock, X } from 'lucide-react'
import { PageTitle, Section } from './SkillsView'
import { useStore, type KnowledgeDoc } from '../store/appStore'
import { businessAgents } from '../data/mockAgents'
import { createKnowledgeDoc, deleteKnowledgeDoc } from '../lib/backend'

const agentName = (id: string) => businessAgents.find((a) => a.id === id)?.name ?? id
const agentEmoji = (id: string) => businessAgents.find((a) => a.id === id)?.emoji ?? '🤖'

export default function KnowledgeView() {
  const store = useStore()
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFolder, setNewFolder] = useState('产品资料')

  const docs = store.knowledge.filter(
    (d) => !query || d.name.toLowerCase().includes(query.toLowerCase()) || d.folder.includes(query)
  )

  const folders = Array.from(new Set(store.knowledge.map((d) => d.folder))).map((name) => ({
    name,
    count: store.knowledge.filter((d) => d.folder === name).length
  }))

  const addDoc = async () => {
    const name = newName.trim() || `新文档-${Date.now().toString().slice(-4)}.pdf`
    const ext = name.split('.').pop()?.toUpperCase() ?? 'PDF'
    const doc: KnowledgeDoc = {
      id: `k${Date.now()}`,
      name,
      type: ['PDF', 'DOC', 'XLS', 'MD', 'TXT'].includes(ext) ? ext : 'PDF',
      size: `${(Math.random() * 4 + 0.2).toFixed(1)} MB`,
      time: '刚刚',
      folder: newFolder,
      boundAgents: []
    }
    // 先调后端，成功后更新 store
    if (store.backendConnected) {
      const ok = await createKnowledgeDoc({
        name: doc.name, type: doc.type, size: doc.size, folder: doc.folder, boundAgents: doc.boundAgents
      })
      if (!ok) return
    }
    store.addDoc(doc)
    setNewName('')
    setShowAdd(false)
  }

  const handleRemove = async (id: string) => {
    if (store.backendConnected) {
      const ok = await deleteKnowledgeDoc(id)
      if (!ok) return
    }
    store.removeDoc(id)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle
        icon={BookOpen}
        title="私有知识库"
        desc="上传企业文档并绑定到智能体，检索增强其专业回答。数据按租户私有隔离，不参与公网训练。"
      />

      {/* 隔离标识 + 搜索 */}
      <div className="mb-5 flex items-center gap-3">
        <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-xs text-emerald-300">
          <Lock className="h-3.5 w-3.5" /> 私有隔离
        </span>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文档名称或分类…"
            className="w-full rounded-xl border border-border-subtle bg-bg-surface/70 py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* 上传区 */}
      <div className="mb-8 flex items-center gap-3 rounded-xl border border-dashed border-border bg-bg-surface/40 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft">
          <Upload className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-text-primary">拖拽文件到此处，或点击上传</div>
          <div className="text-xs text-text-muted">
            支持 PDF / Word / Excel / Markdown，单文件最大 50 MB（模拟入库，接真后自动向量化）
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          选择文件
        </button>
      </div>

      {showAdd && (
        <div className="mb-6 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-text-primary">模拟上传文档</span>
            <button onClick={() => setShowAdd(false)} className="icon-btn h-6 w-6">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="文档名，如 医保目录2026.pdf"
              className="flex-1 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
            <select
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              className="rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-2 text-sm text-text-primary outline-none focus:border-accent"
            >
              {['产品资料', '内部制度', '经营分析', '行业知识'].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <button onClick={addDoc} className="btn-primary">
              入库
            </button>
          </div>
        </div>
      )}

      <Section title="知识库分类">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {folders.map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-surface/60 p-3"
            >
              <Folder className="h-5 w-5 text-amber-300" />
              <div className="min-w-0">
                <div className="truncate text-sm text-text-primary">{f.name}</div>
                <div className="text-xs text-text-muted">{f.count} 篇</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={query ? `搜索结果（${docs.length}）` : '全部文档'}>
        <div className="overflow-hidden rounded-xl border border-border-subtle">
          {docs.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-muted">未找到匹配的文档</div>
          ) : (
            docs.map((d, i) => (
              <div
                key={d.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i !== docs.length - 1 ? 'border-b border-border-subtle' : ''
                } bg-bg-surface/40 transition-colors hover:bg-bg-hover`}
              >
                <FileText className="h-4 w-4 shrink-0 text-text-secondary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text-primary">{d.name}</div>
                  <div className="mt-0.5 flex items-center gap-1">
                    {d.boundAgents.length === 0 ? (
                      <span className="text-[10px] text-text-muted">未绑定智能体</span>
                    ) : (
                      d.boundAgents.map((a) => (
                        <span
                          key={a}
                          title={agentName(a)}
                          className="rounded bg-bg-elevated px-1 py-0.5 text-[10px] text-text-secondary"
                        >
                          {agentEmoji(a)} {agentName(a)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                  {d.type}
                </span>
                <span className="hidden w-16 text-right text-xs text-text-muted sm:block">{d.size}</span>
                <span className="hidden w-16 text-right text-xs text-text-muted sm:block">{d.time}</span>
                <button
                  onClick={() => handleRemove(d.id)}
                  className="icon-btn -mr-1 h-7 w-7 text-text-muted hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  )
}
