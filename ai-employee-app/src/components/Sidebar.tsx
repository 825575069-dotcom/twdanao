import { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  Menu,
  LogOut
} from 'lucide-react'
import {
  IconSearch,
  IconPlusSquare,
  IconClock,
  IconBot,
  IconMessage,
  IconGrid,
  IconFile,
  IconImage,
  IconChart,
  IconUsers,
  IconCoins,
  IconCart,
  IconSettings
} from './SidebarIcons'
import type { ViewKey } from '../App'
import { useStore } from '../store/appStore'
import { hasAccess } from '../lib/permissions'

interface Props {
  active: ViewKey
  onChange: (v: ViewKey) => void
  /** 点击“新建对话”时创建并进入新会话 */
  onNewConversation?: () => void
}

/* ========== 导航分组（严格对齐用户 UI 稿） ========== */
interface NavGroup {
  label?: string
  items: NavItem[]
}

interface NavItem {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navGroups: NavGroup[] = [
  {
    items: [
      { key: 'chat', label: '营销对话', icon: IconPlusSquare },
      { key: 'tasks', label: '自动任务', icon: IconClock },
      { key: 'marketing', label: '营销跟客', icon: IconMessage },
      { key: 'pharmacyPurchase', label: '采购对话', icon: IconCart }
    ]
  },
  {
    label: '企业Ai能力',
    items: [
      { key: 'dataBase', label: '数据底座', icon: IconGrid },
      { key: 'knowledge', label: '知识文档', icon: IconFile },
      { key: 'media', label: '营销素材', icon: IconImage },
      { key: 'office', label: '智能体配置', icon: IconBot }
    ]
  },
  {
    label: '企业管理',
    items: [
      { key: 'data', label: '经营看板', icon: IconChart },
      { key: 'permissions', label: '权限管理', icon: IconUsers },
      { key: 'credits', label: '积分管理', icon: IconCoins },
      { key: 'settings', label: '系统设置', icon: IconSettings }
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

  // 按权限过滤导航项
  const userPerms = store.userPermissions
  const authorizedGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => hasAccess(userPerms, i.key))
    }))
    .filter((g) => g.items.length > 0)

  // 按搜索过滤
  const filteredGroups = authorizedGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    }))
    .filter((g) => g.items.length > 0)

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[180px]'

  return (
    <aside
      className={`drag-region flex shrink-0 flex-col overflow-hidden border-r border-border-subtle bg-white py-5 transition-all duration-300 ease-out ${sidebarWidth}`}
    >
      {/* Logo + 控制键 同行 */}
      <div className={`no-drag flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-4'} pt-4`}>
        {!collapsed && (
          <span className="text-[30px] font-bold tracking-tight text-text-primary">YesGo</span>
        )}
        <button
          onClick={toggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* 搜索框 */}
      {!collapsed && (
          <div className="no-drag mt-4 px-4">
          <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-white px-3 py-2 shadow-sm">
            <IconSearch className="h-5 w-5 shrink-0 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* 导航分组 */}
      <nav className="no-drag mt-4 flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-hidden px-3">
        {(search ? filteredGroups : authorizedGroups).map((group, gi) => (
          <div key={group.label ?? `group-${gi}`} className="flex flex-col gap-1">
            {group.label && !collapsed && (
              <div className="px-2 pb-1">
                <span className="text-[12px] font-medium uppercase tracking-wider text-text-muted/70">
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
                  <Icon className="h-5 w-5 shrink-0 text-black" />

                  {!collapsed && (
                    <>
                      <span className={`flex-1 text-left text-[15px] leading-tight truncate ${isActive ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
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

      {/* 底部：用户资料 */}
      <div className="no-drag mt-auto flex flex-col gap-2 px-3 pt-2">
        <div className={`yesgo-user ${collapsed ? 'justify-center' : 'justify-between gap-2'}`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent text-xs font-semibold text-white">
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
    </aside>
  )
}
