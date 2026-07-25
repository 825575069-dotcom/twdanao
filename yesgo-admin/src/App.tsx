// ============================================================
// YesGo Admin — App Root
// ============================================================
import { useState, useMemo } from 'react';
import { useAuth } from '@/store/authStore';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Tenants from '@/pages/Tenants';
import Database from '@/pages/Database';
import Models from '@/pages/Models';
import Agents from '@/pages/Agents';
import Workflows from '@/pages/Workflows';
import Security from '@/pages/Security';
import Permissions from '@/pages/Permissions';
import Prompts from '@/pages/Prompts';
import { NAV_ITEMS, hasPermission } from '@/components/Sidebar';
import type { ReactNode } from 'react';

// 页面 → 权限码映射
const PAGE_PERMISSION_MAP: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map(item => [item.id, item.permission || ''])
);

export default function App() {
  const { state } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');

  // 用户有效权限列表
  const userPerms = state.user?.permissions;

  // 计算第一个有权限的页面
  const firstAccessiblePage = useMemo(() => {
    if (!userPerms) return 'dashboard';
    if (userPerms.includes('*')) return 'dashboard';
    const item = NAV_ITEMS.find(item => hasPermission(userPerms, item.permission));
    return item?.id || 'dashboard';
  }, [userPerms]);

  // 当前页面是否有权限
  const canAccessPage = hasPermission(userPerms, PAGE_PERMISSION_MAP[activePage]);

  // 如果无权限，自动跳到第一个有权限的页面
  const effectivePage = canAccessPage ? activePage : firstAccessiblePage;

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-primary-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return <Login />;
  }

  const renderPage = (): ReactNode => {
    if (!canAccessPage && firstAccessiblePage === 'dashboard' && !hasPermission(userPerms, 'data.view')) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <ShieldIcon />
          <p className="mt-3 text-sm">暂无可用页面，请联系管理员分配权限</p>
        </div>
      );
    }
    switch (effectivePage) {
      case 'dashboard': return <Dashboard />;
      case 'tenants': return <Tenants />;
      case 'database': return <Database />;
      case 'models': return <Models />;
      case 'agents': return <Agents />;
      case 'workflows': return <Workflows />;
      case 'permissions': return <Permissions />;
      case 'security': return <Security />;
      case 'prompts': return <Prompts />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activePage={effectivePage} onNavigate={setActivePage}>
      {renderPage()}
    </Layout>
  );
}

function ShieldIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
