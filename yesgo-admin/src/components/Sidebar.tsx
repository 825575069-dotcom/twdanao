// ============================================================
// YesGo Admin — Sidebar Navigation
// ============================================================
import { useState, useMemo } from 'react';
import {
  LayoutDashboard, Building2, Database, Cpu, Bot,
  Workflow, Shield, LogOut, ChevronLeft, ChevronRight,
  ShieldCheck, ChevronDown, MessageSquareText, PackageSearch,
  Coins, Wallet, Smartphone, Settings, UserPlus,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** 后端权限码；拥有该权限或 '*' 才可见 */
  permission?: string;
  children?: { id: string; label: string; icon: LucideIcon; permission?: string }[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: '系统概览', icon: LayoutDashboard, permission: 'platform.dashboard.view' },
  { id: 'tenants', label: '租户管理', icon: Building2, permission: 'platform.tenants.view' },
  { id: 'database', label: '租户数据库', icon: Database, permission: 'platform.database.view' },
  { id: 'public-database', label: '公共数据库', icon: PackageSearch, permission: 'platform.database.view' },
  { id: 'models', label: '模型网关', icon: Cpu, permission: 'platform.models.view' },
  { id: 'agents', label: '智能体管理', icon: Bot, permission: 'platform.agents.view' },
  { id: 'workflows', label: '工作流/知识库', icon: Workflow, permission: 'platform.workflows.view' },
  { id: 'prompts', label: '提示词管理', icon: MessageSquareText, permission: 'platform.prompts.manage' },
  { id: 'credits', label: '积分管理', icon: Coins, permission: 'platform.credits.view' },
  { id: 'withdrawals', label: '提现管理', icon: Wallet, permission: 'platform.publicDatabase.manage' },
  { id: 'permissions', label: '权限管理', icon: ShieldCheck, permission: 'platform.permissions.view' },
  {
    id: 'wecom',
    label: '企微管理',
    icon: Smartphone,
    permission: 'platform.wecom.manage',
    children: [
      { id: 'wecom-config', label: '企微设置', icon: Settings, permission: 'platform.wecom.manage' },
      { id: 'wecom-numbers', label: '企微创建', icon: UserPlus, permission: 'platform.wecom.manage' },
    ],
  },
  { id: 'security', label: '安全审计', icon: Shield, permission: 'platform.security.view' },
];

/** 检查权限：拥有 '*' 或具体权限码即通过 */
export function hasPermission(userPerms: string[] | undefined, code: string | undefined): boolean {
  if (!code) return true;
  if (!userPerms || userPerms.length === 0) return false;
  return userPerms.includes('*') || userPerms.includes(code);
}

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  userName?: string;
  permissions?: string[];
}

export default function Sidebar({ activePage, onNavigate, collapsed, onToggle, onLogout, userName, permissions }: SidebarProps) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(() => new Set(['permissions']));

  const toggleMenu = (id: string) => {
    setOpenMenus(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isChildActive = (item: NavItem) => item.children?.some(c => c.id === activePage) ?? false;

  // 按权限过滤可见导航项
  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter(item => hasPermission(permissions, item.permission));
  }, [permissions]);

  return (
    <aside
      className={`h-screen bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-gray-100">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">Y</span>
            </div>
            <span className="font-semibold text-sm text-gray-900">YesGo 中台</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center mx-auto">
            <span className="text-white text-xs font-bold">Y</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {visibleItems.map((item) => {
          const hasChildren = !!item.children?.length;
          const isParentActive = isChildActive(item);
          const isOpen = openMenus.has(item.id) || isParentActive;

          if (!hasChildren) {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-medium border-r-2 border-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          }

          return (
            <div key={item.id}>
              <button
                onClick={() => (collapsed ? onNavigate(item.children![0].id) : toggleMenu(item.id))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  isParentActive || activePage === item.id
                    ? 'bg-primary-50 text-primary-700 font-medium border-r-2 border-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </>
                )}
              </button>
              {!collapsed && isOpen && (
                <div className="bg-gray-50/50">
                  {item.children!.map((child) => {
                    const isActive = activePage === child.id;
                    return (
                      <button
                        key={child.id}
                        onClick={() => onNavigate(child.id)}
                        className={`w-full flex items-center gap-3 pl-10 pr-3 py-2 text-sm transition-colors ${
                          isActive
                            ? 'text-primary-700 font-medium border-r-2 border-primary-600 bg-primary-50/70'
                            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <child.icon size={16} />
                        <span>{child.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-gray-100 p-3">
        {!collapsed && userName && (
          <div className="text-xs text-gray-500 mb-2 truncate">{userName}</div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? '退出登录' : undefined}
        >
          <LogOut size={16} />
          {!collapsed && <span>退出登录</span>}
        </button>
      </div>
    </aside>
  );
}
