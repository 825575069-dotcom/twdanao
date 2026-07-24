// ============================================================
// LoginView — 租户员工登录页
// ============================================================
import { useState } from 'react'
import { Bot, Lock, User, Loader2, AlertCircle, Server } from 'lucide-react'
import { updateApiConfig } from '../lib/api'

interface LoginViewProps {
  onLogin: (username: string, password: string) => Promise<boolean>
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [apiUrl, setApiUrl] = useState(
    localStorage.getItem('yesgo_api_base_url') ||
    (import.meta.env.PROD ? 'https://twdanaob.88yldh.com/api/v1' : 'http://localhost:8000/api/v1')
  )
  const [showApiConfig, setShowApiConfig] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 更新 API 配置
      updateApiConfig({ baseUrl: apiUrl })
      localStorage.setItem('yesgo_api_base_url', apiUrl)

      const success = await onLogin(username.trim(), password.trim())
      if (!success) {
        setError('登录失败，请检查用户名和密码')
      }
      // 成功时 store 内部会触发 isAuthenticated=true，App 自动重新渲染
    } catch {
      setError('无法连接到服务器，请检查网络或 API 地址')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleLogin()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117] p-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30">
            <Bot size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">YesGo 数字员工</h1>
          <p className="text-sm text-gray-400 mt-1">医药行业 AI 智能体平台</p>
        </div>

        {/* 登录卡片 */}
        <div className="bg-[#1a1d27] rounded-2xl border border-white/5 shadow-xl p-8">
          {/* 用户名 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">用户名</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError('') }}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0f1117] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                placeholder="请输入用户名"
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          {/* 密码 */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">密码</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0f1117] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                placeholder="请输入密码"
                disabled={loading}
              />
            </div>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                登录中...
              </>
            ) : (
              '登录'
            )}
          </button>

          {/* API 地址配置 */}
          <div className="mt-5 pt-4 border-t border-white/5">
            <button
              onClick={() => setShowApiConfig(!showApiConfig)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Server size={12} />
              {showApiConfig ? '隐藏' : '显示'} API 地址配置
            </button>
            {showApiConfig && (
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="mt-2 w-full px-3 py-1.5 bg-[#0f1117] border border-white/10 rounded-lg text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
                placeholder="https://twdanaob.88yldh.com/api/v1"
                disabled={loading}
              />
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          YesGo AI 数字员工平台 v1.0.0
        </p>
      </div>
    </div>
  )
}
