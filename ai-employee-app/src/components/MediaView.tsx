import { useState } from 'react'
import { PageTitle, Section } from './SkillsView'
import { Image as ImageIcon, Upload, FileImage, Trash2, Search } from 'lucide-react'
import { useStore } from '../store/appStore'
import type { MediaAsset } from '../types'
import { createMediaAsset, deleteMediaAsset } from '../lib/backend'

export default function MediaView() {
  const store = useStore()
  const [search, setSearch] = useState('')

  const filtered = store.media.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))

  const handleUpload = async () => {
    const names = ['新品宣传图.jpg', '促销活动海报.png', '产品详情图.jpg', '企业风采.jpg']
    const name = names[Math.floor(Math.random() * names.length)]
    const asset: MediaAsset = {
      id: `m_${Date.now()}`,
      name,
      type: 'image',
      size: `${(Math.random() * 3 + 0.5).toFixed(1)} MB`,
      time: '刚刚'
    }
    if (store.backendConnected) {
      const ok = await createMediaAsset({ name: asset.name, type: asset.type, size: asset.size })
      if (!ok) return
    }
    store.addMediaAsset(asset)
  }

  const handleDelete = async (id: string) => {
    if (store.backendConnected) {
      const ok = await deleteMediaAsset(id)
      if (!ok) return
    }
    store.removeMediaAsset(id)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle icon={ImageIcon} title="宣传图片" desc="企业营销物料与 AI 生成素材库，可绑定到智能体使用" />

      <Section title={`素材库（${store.media.length}）`}>
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索素材"
              className="h-9 w-full rounded-lg border border-border-subtle bg-bg-elevated pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
          </div>
          <button onClick={handleUpload} className="btn-primary h-9 px-3 text-xs">
            <Upload className="h-4 w-4" /> 上传图片
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="card flex flex-col items-center justify-center gap-2 border-dashed border-border-strong bg-bg-surface/40 p-8">
            <FileImage className="h-8 w-8 text-text-muted/40" />
            <div className="text-sm text-text-muted">暂无素材，点击上方按钮上传</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((img) => (
              <div
                key={img.id}
                className="group card relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden"
              >
                <FileImage className="h-8 w-8 text-text-muted/40 transition-colors group-hover:text-text-muted" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="truncate text-[11px] text-white">{img.name}</div>
                  <div className="text-[10px] text-white/70">{img.size} · {img.time}</div>
                </div>
                <button
                    onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(img.id)
                  }}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500"
                  title="删除"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="上传">
        <div className="card flex flex-col items-center justify-center gap-2 border-dashed border-border-strong bg-bg-surface/40 p-8">
          <Upload className="h-6 w-6 text-text-muted" />
          <div className="text-sm text-text-secondary">拖拽图片到此处，或点击上传</div>
          <button onClick={handleUpload} className="btn-primary mt-2 text-xs">
            选择图片
          </button>
        </div>
      </Section>
    </div>
  )
}
