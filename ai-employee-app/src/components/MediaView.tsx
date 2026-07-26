import { useMemo, useState } from 'react'
import {
  Upload,
  FolderPlus,
  Trash2,
  Move,
  CheckSquare,
  Search,
  ImageIcon,
  Video,
  Mic,
  FileText,
  Link2,
  Smartphone,
  PlaySquare,
  Smile,
  FileImage,
  HelpCircle,
  MoreVertical
} from 'lucide-react'
import { useStore } from '../store/appStore'

const TABS = [
  { key: 'image', label: '图片', icon: ImageIcon },
  { key: 'video', label: '视频', icon: Video },
  { key: 'audio', label: '语音', icon: Mic },
  { key: 'file', label: '文件', icon: FileText },
  { key: 'link', label: '链接', icon: Link2 },
  { key: 'miniapp', label: '小程序', icon: Smartphone },
  { key: 'channel', label: '视频号', icon: PlaySquare },
  { key: 'emoji', label: 'Emoji', icon: Smile }
] as const

const MOCK_ITEMS: Record<string, Array<{ id: string; name: string; size: string; date: string; hasError?: boolean }>> = {
  image: [
    { id: 'i1', name: '阿莫西林产品海报.png', size: '2.1 MB', date: '7/20' },
    { id: 'i2', name: 'Q3推广活动素材.jpg', size: '3.5 MB', date: '7/18' },
    { id: 'i3', name: '学术推广素材包.png', size: '8.2 MB', date: '7/15' },
    { id: 'i4', name: 'CMEF展会素材.jpg', size: '5.2 MB', date: '7/10' },
    { id: 'i5', name: '沙库巴曲产品详情图.jpg', size: '4.8 MB', date: '7/08' },
    { id: 'i6', name: '销售培训配图.png', size: '1.6 MB', date: '7/05' },
    { id: 'i7', name: '暑期促销海报.jpg', size: '3.2 MB', date: '7/02' },
    { id: 'i8', name: '品牌VI素材包.png', size: '12.8 MB', date: '6/28' },
    { id: 'i9', name: '学术会议配图.jpg', size: '6.1 MB', date: '6/25' },
    { id: 'i10', name: '产品宣传册设计.jpg', size: '9.4 MB', date: '6/20' }
  ],
  video: [
    { id: 'v1', name: '产品宣传短片.mp4', size: '28.5 MB', date: '7/18' },
    { id: 'v2', name: '展会现场花絮.mov', size: '45.2 MB', date: '7/12' }
  ],
  audio: [
    { id: 'a1', name: '客户回访录音.mp3', size: '4.2 MB', date: '7/15' },
    { id: 'a2', name: '产品培训语音.m4a', size: '8.7 MB', date: '7/08' }
  ],
  file: [
    { id: 'f1', name: 'Q3推广方案.pdf', size: '3.6 MB', date: '7/16' },
    { id: 'f2', name: '产品手册.docx', size: '1.2 MB', date: '7/02' }
  ],
  link: [
    { id: 'l1', name: '学术会议报名链接', size: '-', date: '7/14' },
    { id: 'l2', name: '企微活码链接', size: '-', date: '7/10' }
  ],
  miniapp: [
    { id: 'm1', name: '药品查询小程序', size: '-', date: '7/12' },
    { id: 'm2', name: '患者教育小程序', size: '-', date: '6/28' }
  ],
  channel: [
    { id: 'c1', name: '健康科普视频号', size: '-', date: '7/08' },
    { id: 'c2', name: '产品介绍视频号', size: '-', date: '6/30' }
  ],
  emoji: [
    { id: 'e1', name: '品牌表情包-1', size: '-', date: '7/05' },
    { id: 'e2', name: '节日祝福表情', size: '-', date: '6/20' }
  ]
}

const PASTEL_COLORS = [
  'bg-blue-100',
  'bg-emerald-100',
  'bg-amber-100',
  'bg-sky-100',
  'bg-rose-100',
  'bg-violet-100',
  'bg-orange-100',
  'bg-teal-100',
  'bg-indigo-100',
  'bg-pink-100'
]

export default function MediaView() {
  const store = useStore()
  const [activeTab, setActiveTab] = useState<string>('image')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [usedGB] = useState(12.6)
  const [totalGB] = useState(30)

  const baseItems = MOCK_ITEMS[activeTab] || []
  const filteredItems = useMemo(() => {
    if (!search.trim()) return baseItems
    return baseItems.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
  }, [baseItems, search])

  const allSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id))

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds)
      filteredItems.forEach((item) => next.delete(item.id))
      setSelectedIds(next)
    } else {
      const next = new Set(selectedIds)
      filteredItems.forEach((item) => next.add(item.id))
      setSelectedIds(next)
    }
  }

  const handleUpload = () => {
    const names = ['新品宣传图.jpg', '促销活动海报.png', '产品详情图.jpg', '企业风采.jpg']
    const name = names[Math.floor(Math.random() * names.length)]
    store.addMediaAsset({
      id: `m_${Date.now()}`,
      name,
      type: 'image',
      size: `${(Math.random() * 3 + 0.5).toFixed(1)} MB`,
      time: '刚刚'
    })
  }

  const progressPercent = Math.min(100, Math.round((usedGB / totalGB) * 100))
  const activeTabObj = TABS.find((t) => t.key === activeTab) || TABS[0]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-body">
      {/* 顶部标题区 */}
      <div className="border-b border-border-subtle bg-bg-surface px-6 py-5">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft/50 text-accent">
            <ImageIcon className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-semibold text-text-primary">营销素材</h1>
        </div>
        <p className="text-sm text-text-secondary">按类型管理营销素材，支持上传与分发</p>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Tab 栏 */}
        <div className="border-b border-border-subtle bg-bg-surface px-6 pt-3">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key)
                  setSelectedIds(new Set())
                  setSearch('')
                }}
                className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-accent'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-accent" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90"
            >
              <Upload className="h-4 w-4" />
              上传素材
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:text-text-primary">
              <FolderPlus className="h-4 w-4" />
              新建文件夹
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:text-text-primary">
              <Trash2 className="h-4 w-4" />
              删除
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:text-text-primary">
              <Move className="h-4 w-4" />
              移动到
            </button>
            <button
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:text-text-primary"
            >
              <CheckSquare className="h-4 w-4" />
              全选
            </button>
          </div>

          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索素材..."
              className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
          </div>
        </div>

        {/* 存储空间 */}
        <div className="flex items-center gap-4 border-b border-border-subtle bg-bg-surface px-6 py-3">
          <span className="text-sm font-medium text-text-primary">存储空间</span>
          <div className="relative h-2 flex-1 max-w-md rounded-full bg-bg-elevated">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-accent transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm text-text-secondary">
            {usedGB.toFixed(1)} GB / {totalGB} GB
          </span>
        </div>

        {/* 素材网格 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {filteredItems.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong bg-bg-surface/40">
              <activeTabObj.icon className="h-10 w-10 text-text-muted/40" />
              <div className="text-sm text-text-muted">暂无{activeTabObj.label}素材</div>
              <button
                onClick={handleUpload}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
              >
                <Upload className="h-4 w-4" />
                上传素材
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredItems.map((item, idx) => {
                const selected = selectedIds.has(item.id)
                const bgClass = PASTEL_COLORS[idx % PASTEL_COLORS.length]
                return (
                  <div
                    key={item.id}
                    className={`group relative flex flex-col rounded-xl border bg-bg-surface p-3 transition hover:shadow-sm ${
                      selected ? 'border-accent ring-1 ring-accent' : 'border-border-subtle hover:border-border-strong'
                    }`}
                  >
                    {/* 缩略图 */}
                    <div
                      className={`relative mb-3 flex aspect-square items-center justify-center rounded-lg ${bgClass}`}
                    >
                      {item.hasError ? (
                        <HelpCircle className="h-10 w-10 text-text-muted/60" />
                      ) : (
                        <FileImage className="h-10 w-10 text-text-muted/60" />
                      )}

                      {/* 悬浮操作 */}
                      <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSelect(item.id)
                          }}
                          className={`flex h-6 w-6 items-center justify-center rounded-md border transition ${
                            selected
                              ? 'border-accent bg-accent text-white'
                              : 'border-white/80 bg-white/80 text-text-muted hover:text-text-primary'
                          }`}
                        >
                          <CheckSquare className="h-3.5 w-3.5" />
                        </button>
                        <button className="flex h-6 w-6 items-center justify-center rounded-md border border-white/80 bg-white/80 text-text-muted hover:text-text-primary">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 文件信息 */}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text-primary" title={item.name}>
                        {item.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                        <span>{item.size}</span>
                        <span>·</span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
