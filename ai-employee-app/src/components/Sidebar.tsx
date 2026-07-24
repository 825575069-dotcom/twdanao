import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquarePlus,
  History,
  Bot,
  LayoutGrid,
  FileText,
  Image,
  BarChart3,
  ShieldCheck,
  Coins,
  Settings,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Sparkles,
  Building2,
  SlidersHorizontal,
  ShieldAlert,
  LogOut
} from 'lucide-react'
import type { ViewKey } from '../App'
import { useStore } from '../store/appStore'

interface Props {
  active: ViewKey
  onChange: (v: ViewKey) => void
}

/* ========== 导航分组（严格对齐用户 UI 稿） ========== */
interface NavGroup {
  label?: string
  items: NavItem[]
}

interface NavItem {
  key: ViewKey
  label: string
  icon: typeof MessageSquarePlus
  badge?: string
}

const navGroups: NavGroup[] = [
  {
    items: [
      { key: 'chat', label: '新建对话', icon: MessageSquarePlus },
      { key: 'tasks', label: '自动任务', icon: History },
      { key: 'office', label: 'AI办公室', icon: Bot }
    ]
  },
  {
    label: '企业知识库',
    items: [
      { key: 'dataBase', label: '数据底座', icon: LayoutGrid },
      { key: 'knowledge', label: '知识文档', icon: FileText },
      { key: 'media', label: '宣传图片', icon: Image },
      { key: 'skills', label: '技能市场', icon: Sparkles }
    ]
  },
  {
    label: '企业管理',
    items: [
      { key: 'data', label: '经营看板', icon: BarChart3 },
      { key: 'clients', label: '客户管理', icon: Building2 },
      { key: 'permissions', label: '权限管理', icon: ShieldCheck },
      { key: 'credits', label: '积分管理', icon: Coins },
      { key: 'models', label: '模型网关', icon: Cpu },
      { key: 'config', label: '配置中心', icon: SlidersHorizontal },
      { key: 'security', label: '安全审计', icon: ShieldAlert },
      { key: 'settings', label: '系统设置', icon: Settings }
    ]
  }
]

const STORAGE_KEY = 'yesgo-sidebar-collapsed'

export default function Sidebar({ active, onChange }: Props) {
  const store = useStore()
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch { /* ignore */ }
  }, [collapsed])

  const toggleCollapse = useCallback(() => setCollapsed((v) => !v), [])

  const currentUserId = store.tenant.membership?.userId
  const currentMember = currentUserId ? store.tenant.members.find((m) => m.id === currentUserId) : undefined

  const getBadge = (key: ViewKey): string | undefined => {
    if (key === 'credits') {
      const bal = currentMember?.credits ?? store?.creditBalance
      if (bal === undefined || bal === null) return undefined
      if (bal >= 10000) return `${(bal / 10000).toFixed(1)}万`
      return String(bal)
    }
    return undefined
  }

  // 按搜索过滤
  const filteredGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    }))
    .filter((g) => g.items.length > 0)

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[220px]'

  return (
    <aside
      className={`drag-region flex shrink-0 flex-col border-r border-border-subtle bg-bg-surface py-5 transition-all duration-300 ease-out ${sidebarWidth}`}
    >
      {/* Logo */}
      <div className={`no-drag flex items-center pt-3 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
        <span className="text-xl font-bold tracking-tight text-text-primary">YesGo</span>
      </div>

      {/* 搜索框 */}
      {!collapsed && (
        <div className="no-drag mt-4 px-4">
          <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 shadow-sm">
            <Search className="h-3.5 w-3.5 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索"
              className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* 导航分组 */}
      <nav className="no-drag mt-4 flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-3">
        {(search ? filteredGroups : navGroups).map((group, gi) => (
          <div key={group.label ?? `group-${gi}`} className="flex flex-col gap-1">
            {group.label && !collapsed && (
              <div className="px-2 pb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted/70">
                  {group.label}
                </span>
              </div>
            )}

            {group.items.map((item) => {
              const Icon = item.icon
              const badge = getBadge(item.key)
              const isActive = active === item.key

              return (
                <button
                  key={item.key}
                  title={collapsed ? item.label : undefined}
                  onClick={() => onChange(item.key)}
                  className={`
                    yesgo-nav-item group
                    ${collapsed ? 'justify-center px-0' : 'px-3'}
                    ${isActive ? 'yesgo-nav-active' : ''}
                  `}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-accent' : 'text-text-secondary'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />

                  {!collapsed && (
                    <>
                      <span className={`flex-1 text-left text-[13px] leading-tight truncate ${isActive ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                        {item.label}
                      </span>

                      {badge && (
                        <span className={`yesgo-nav-badge ${isActive ? 'bg-accent-soft text-accent' : 'bg-bg-hover text-text-muted'}`}>
                          {badge}
                        </span>
                      )}
                    </>
                  )}

                  {collapsed && badge && (
                    <span className="yesgo-nav-dot">{badge.length <= 2 ? badge : ''}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* 底部：折叠按钮 + 用户资料 */}
      <div className="no-drag mt-auto flex flex-col gap-2 px-3 pt-2">
        {!collapsed && (
          <button
            onClick={toggleCollapse}
            className="yesgo-collapse-btn"
            title="收起侧边栏"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}

        <div className={`yesgo-user ${collapsed ? 'justify-center' : 'justify-between gap-2'}`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-semibold text-white">
              {currentMember?.name?.[0] ?? '陈'}
            </div>
            {!collapsed && (
              <span className="truncate text-[12px] text-text-primary">{currentMember?.name ?? '用户'}</span>
            )}
          </div>
          {!collapsed && (
            <div className="flex items-center gap-1">
              <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary">
                <Bell className="h-4 w-4" />
              </button>
              <button
                onClick={() => store.logout()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 折叠态：展开按钮 */}
      {collapsed && (
        <button
          onClick={toggleCollapse}
          className="no-drag mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
          title="展开侧边栏"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </aside>
  )
}
