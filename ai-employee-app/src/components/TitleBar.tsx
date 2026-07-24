import { useState } from 'react'
import { Search, Bell, Command, Sun, Moon, Palette, Check } from 'lucide-react'
import { useTheme, COLOR_THEMES } from '../lib/theme'

interface Props {
  title: string
  onOpenPalette: () => void
}

export default function TitleBar({ title, onOpenPalette }: Props) {
  const { mode, toggleMode, colorTheme, setColorTheme } = useTheme()
  const [colorOpen, setColorOpen] = useState(false)

  return (
    <header className="drag-region relative flex h-12 shrink-0 items-center justify-between border-b border-border-subtle/60 px-4 glass">
      {/* 左：标题 */}
      <div className="flex items-center gap-3 pl-[148px]">
        <h1 className="selectable text-sm font-semibold text-text-primary">
          {title}
        </h1>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
          v0.1 · 内测
        </span>
      </div>

      {/* 中：搜索触发 */}
      <button
        onClick={onOpenPalette}
        className="no-drag group flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated/60 px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-border hover:text-text-secondary"
      >
        <Search className="h-3.5 w-3.5" />
        <span>搜索或输入命令</span>
        <span className="ml-6 flex items-center gap-0.5 rounded border border-border-subtle px-1 py-0.5 text-[10px] text-text-muted">
          <Command className="h-2.5 w-2.5" />K
        </span>
      </button>

      {/* 右：操作 + 主题切换 */}
      <div className="no-drag flex items-center gap-1">
        {/* 品牌色切换 */}
        <div className="relative">
          <button
            onClick={() => setColorOpen((v) => !v)}
            className="icon-btn"
            title="切换品牌色"
          >
            <Palette className="h-4 w-4" />
          </button>
          {colorOpen && (
            <div
              className="absolute right-0 top-11 z-50 w-44 rounded-xl border border-border-subtle bg-bg-surface/95 p-2 shadow-card backdrop-blur-xl"
              onMouseLeave={() => setColorOpen(false)}
            >
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                品牌色
              </p>
              <div className="flex flex-col gap-0.5">
                {COLOR_THEMES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => {
                      setColorTheme(c.key)
                      setColorOpen(false)
                    }}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                  >
                    <span
                      className="h-4 w-4 rounded-full ring-1 ring-black/10"
                      style={{ background: c.hex }}
                    />
                    <span className="flex-1 text-left">{c.label}</span>
                    {colorTheme === c.key && (
                      <Check className="h-3.5 w-3.5 text-accent" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 深色 / 浅色切换 */}
        <button
          onClick={toggleMode}
          className="icon-btn"
          title={mode === 'dark' ? '切换浅色模式' : '切换深色模式'}
        >
          {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button className="icon-btn" title="通知">
          <Bell className="h-4 w-4" />
        </button>
        <div className="ml-2 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
        <span className="text-[11px] text-text-muted">已连接</span>
      </div>
    </header>
  )
}
