// ============================================================
// YesGo Admin — Layout Shell
// ============================================================
import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '@/store/authStore';

interface LayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}

export default function Layout({ activePage, onNavigate, children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { state, logout } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        onLogout={logout}
        userName={state.user?.username}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
