// ============================================================
// YesGo Admin — App Root
// ============================================================
import { useState } from 'react';
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

export default function App() {
  const { state } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');

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

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'tenants': return <Tenants />;
      case 'database': return <Database />;
      case 'models': return <Models />;
      case 'agents': return <Agents />;
      case 'workflows': return <Workflows />;
      case 'permissions-employees':
      case 'permissions-roles':
        return <Permissions />;
      case 'security': return <Security />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </Layout>
  );
}
