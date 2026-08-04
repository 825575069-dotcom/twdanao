// 主题切换系统：深色/浅色模式 + 多色主题
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export type ColorTheme =
  | 'indigo'    // 默认靛蓝（对标当前 accent）
  | 'emerald'   // 翠绿
  | 'rose'      // 玫红
  | 'amber'     // 琥珀金
  | 'cyan'      // 青蓝
  | 'white'     // 白色

export type ThemeMode = 'dark' | 'light'

export const COLOR_THEMES: { key: ColorTheme; label: string; hex: string }[] = [
  { key: 'indigo', label: '靛蓝', hex: '#6366f1' },
  { key: 'emerald', label: '翠绿', hex: '#10b981' },
  { key: 'rose', label: '玫红', hex: '#f43f5e' },
  { key: 'amber', label: '琥珀', hex: '#f59e0b' },
  { key: 'cyan', label: '青蓝', hex: '#06b6d4' },
  { key: 'white', label: '白色', hex: '#ffffff' }
]

/** 经理兔围巾颜色 → 平台品牌色主题映射（12 色体系） */
export const SCARF_TO_COLOR_THEME: Record<string, ColorTheme> = {
  purple: 'indigo',
  red: 'rose',
  orangered: 'amber',
  yellow: 'amber',
  darkgreen: 'emerald',
  springgreen: 'emerald',
  royalblue: 'cyan',
  darkblue: 'indigo',
  magenta: 'rose',
  pink: 'rose',
  brown: 'amber',
  bluegray: 'indigo',
  // 旧色值向后兼容
  orange: 'amber',
  green: 'emerald',
  blue: 'cyan',
}

export function scarfColorToColorTheme(scarfColor?: string): ColorTheme {
  return SCARF_TO_COLOR_THEME[scarfColor ?? 'purple'] ?? 'indigo'
}

interface ThemeCtx {
  mode: ThemeMode
  colorTheme: ColorTheme
  setMode: (m: ThemeMode) => void
  setColorTheme: (c: ColorTheme) => void
  /** 切换深色/浅色 */
  toggleMode: () => void
}

const STORAGE_KEY = 'yesgo-theme'

const Ctx = createContext<ThemeCtx | null>(null)

function loadInitial(): { mode: ThemeMode; colorTheme: ColorTheme } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const v = JSON.parse(raw)
      // 当前设计稿为浅色，强制默认浅色；用户仍可手动切换
      const mode: ThemeMode = 'light'
      const colorTheme: ColorTheme =
        COLOR_THEMES.find((c) => c.key === v.colorTheme)?.key ?? 'indigo'
      return { mode, colorTheme }
    }
  } catch {
    /* ignore */
  }
  return { mode: 'light', colorTheme: 'indigo' }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = loadInitial()
  const [mode, setMode] = useState<ThemeMode>(initial.mode)
  const [colorTheme, setColorTheme] = useState<ColorTheme>(initial.colorTheme)

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  // 持久化用户选择（桌面端 renderer localStorage 随用户数据保留）
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, colorTheme }))
    } catch {
      /* ignore */
    }
  }, [mode, colorTheme])

  return (
    <Ctx.Provider value={{ mode, colorTheme, setMode, setColorTheme, toggleMode }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/** 颜色主题 → body class 映射（用于 CSS 变量切换） */
export function getBodyClass(mode: ThemeMode, colorTheme: ColorTheme): string {
  return `theme-${mode} color-${colorTheme}`
}
