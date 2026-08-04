// ============================================================
// LoginView — 租户员工登录页（对齐第二层管理后台视觉风格）
// ============================================================
import { useState, useEffect, type FormEvent } from 'react'
import { LogIn, Eye, EyeOff, X, AlertCircle, ArrowLeft } from 'lucide-react'
import { updateApiConfig, createApiClient } from '../lib/api'
import RabbitHead from './RabbitHead'

interface LoginViewProps {
  onLogin: (username: string, password: string) => Promise<boolean>
}

const REMEMBER_KEY = 'yesgo_login_remember'

// 登录页主题跟随公仔围巾颜色
const LOGIN_SCARF_COLOR = 'purple'

const SCARF_THEME: Record<string, {
  gradientFrom: string
  gradientTo: string
  buttonBg: string
  buttonHover: string
  ring: string
  borderFocus: string
  text: string
  textHover: string
  checkbox: string
  accent: string
}> = {
  purple: {
    gradientFrom: 'from-purple-50',
    gradientTo: 'to-purple-50',
    buttonBg: 'bg-purple-600',
    buttonHover: 'hover:bg-purple-700',
    ring: 'focus:ring-purple-500',
    borderFocus: 'focus:border-purple-500',
    text: 'text-purple-600',
    textHover: 'hover:text-purple-700',
    checkbox: 'text-purple-600',
    accent: 'accent-purple-600'
  },
  indigo: {
    gradientFrom: 'from-indigo-50',
    gradientTo: 'to-indigo-50',
    buttonBg: 'bg-indigo-600',
    buttonHover: 'hover:bg-indigo-700',
    ring: 'focus:ring-indigo-500',
    borderFocus: 'focus:border-indigo-500',
    text: 'text-indigo-600',
    textHover: 'hover:text-indigo-700',
    checkbox: 'text-indigo-600',
    accent: 'accent-indigo-600'
  },
  red: {
    gradientFrom: 'from-rose-50',
    gradientTo: 'to-rose-50',
    buttonBg: 'bg-rose-600',
    buttonHover: 'hover:bg-rose-700',
    ring: 'focus:ring-rose-500',
    borderFocus: 'focus:border-rose-500',
    text: 'text-rose-600',
    textHover: 'hover:text-rose-700',
    checkbox: 'text-rose-600',
    accent: 'accent-rose-600'
  },
  orange: {
    gradientFrom: 'from-orange-50',
    gradientTo: 'to-orange-50',
    buttonBg: 'bg-orange-600',
    buttonHover: 'hover:bg-orange-700',
    ring: 'focus:ring-orange-500',
    borderFocus: 'focus:border-orange-500',
    text: 'text-orange-600',
    textHover: 'hover:text-orange-700',
    checkbox: 'text-orange-600',
    accent: 'accent-orange-600'
  },
  amber: {
    gradientFrom: 'from-amber-50',
    gradientTo: 'to-amber-50',
    buttonBg: 'bg-amber-600',
    buttonHover: 'hover:bg-amber-700',
    ring: 'focus:ring-amber-500',
    borderFocus: 'focus:border-amber-500',
    text: 'text-amber-600',
    textHover: 'hover:text-amber-700',
    checkbox: 'text-amber-600',
    accent: 'accent-amber-600'
  },
  yellow: {
    gradientFrom: 'from-yellow-50',
    gradientTo: 'to-yellow-50',
    buttonBg: 'bg-yellow-500',
    buttonHover: 'hover:bg-yellow-600',
    ring: 'focus:ring-yellow-500',
    borderFocus: 'focus:border-yellow-500',
    text: 'text-yellow-600',
    textHover: 'hover:text-yellow-700',
    checkbox: 'text-yellow-600',
    accent: 'accent-yellow-500'
  },
  lime: {
    gradientFrom: 'from-lime-50',
    gradientTo: 'to-lime-50',
    buttonBg: 'bg-lime-600',
    buttonHover: 'hover:bg-lime-700',
    ring: 'focus:ring-lime-500',
    borderFocus: 'focus:border-lime-500',
    text: 'text-lime-600',
    textHover: 'hover:text-lime-700',
    checkbox: 'text-lime-600',
    accent: 'accent-lime-600'
  },
  green: {
    gradientFrom: 'from-emerald-50',
    gradientTo: 'to-emerald-50',
    buttonBg: 'bg-emerald-600',
    buttonHover: 'hover:bg-emerald-700',
    ring: 'focus:ring-emerald-500',
    borderFocus: 'focus:border-emerald-500',
    text: 'text-emerald-600',
    textHover: 'hover:text-emerald-700',
    checkbox: 'text-emerald-600',
    accent: 'accent-emerald-600'
  },
  teal: {
    gradientFrom: 'from-teal-50',
    gradientTo: 'to-teal-50',
    buttonBg: 'bg-teal-600',
    buttonHover: 'hover:bg-teal-700',
    ring: 'focus:ring-teal-500',
    borderFocus: 'focus:border-teal-500',
    text: 'text-teal-600',
    textHover: 'hover:text-teal-700',
    checkbox: 'text-teal-600',
    accent: 'accent-teal-600'
  },
  cyan: {
    gradientFrom: 'from-cyan-50',
    gradientTo: 'to-cyan-50',
    buttonBg: 'bg-cyan-600',
    buttonHover: 'hover:bg-cyan-700',
    ring: 'focus:ring-cyan-500',
    borderFocus: 'focus:border-cyan-500',
    text: 'text-cyan-600',
    textHover: 'hover:text-cyan-700',
    checkbox: 'text-cyan-600',
    accent: 'accent-cyan-600'
  },
  sky: {
    gradientFrom: 'from-sky-50',
    gradientTo: 'to-sky-50',
    buttonBg: 'bg-sky-600',
    buttonHover: 'hover:bg-sky-700',
    ring: 'focus:ring-sky-500',
    borderFocus: 'focus:border-sky-500',
    text: 'text-sky-600',
    textHover: 'hover:text-sky-700',
    checkbox: 'text-sky-600',
    accent: 'accent-sky-600'
  },
  blue: {
    gradientFrom: 'from-blue-50',
    gradientTo: 'to-blue-50',
    buttonBg: 'bg-blue-600',
    buttonHover: 'hover:bg-blue-700',
    ring: 'focus:ring-blue-500',
    borderFocus: 'focus:border-blue-500',
    text: 'text-blue-600',
    textHover: 'hover:text-blue-700',
    checkbox: 'text-blue-600',
    accent: 'accent-blue-600'
  }
}

const theme = SCARF_THEME[LOGIN_SCARF_COLOR]

export default function LoginView({ onLogin }: LoginViewProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  // 根据当前域名自动推断 API 地址（保留 localStorage 覆盖能力供调试）
  const apiUrl = (() => {
    const saved = localStorage.getItem('yesgo_api_base_url')
    // 过滤掉 Electron 打包后可能写入的 file:// 无效地址
    if (saved && !saved.startsWith('file:')) return saved
    const host = window.location.host
    if (host.includes('twdanao.88yldh.com')) return 'https://twdanaob.88yldh.com/api/v1'
    // Electron 打包后使用 file:// 协议，window.location.origin 为 file://，必须回退到生产后端
    if (window.location.protocol === 'file:') return 'https://twdanaob.88yldh.com/api/v1'
    return `${window.location.origin}/api/v1`
  })()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 找回密码分步状态
  const [showForgot, setShowForgot] = useState(false)
  type ForgotStep = 'phone' | 'code' | 'password' | 'success'
  const [forgotStep, setForgotStep] = useState<ForgotStep>('phone')
  const [forgotPhone, setForgotPhone] = useState('')
  const [forgotCode, setForgotCode] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [forgotResetToken, setForgotResetToken] = useState('')
  const [forgotCountdown, setForgotCountdown] = useState(0)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMessage, setForgotMessage] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // 加载记住的账号密码
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY)
      if (saved) {
        const { username: u, password: p } = JSON.parse(saved)
        if (u) setUsername(u)
        if (p) setPassword(p)
        setRememberMe(true)
      }
    } catch {
      // ignore parse error
    }
  }, [])

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      updateApiConfig({ baseUrl: apiUrl })
      localStorage.setItem('yesgo_api_base_url', apiUrl)

      const success = await onLogin(username.trim(), password.trim())
      if (!success) {
        setError('登录失败，请检查用户名和密码')
        return
      }

      // 登录成功后处理记住密码
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username, password }))
      } else {
        localStorage.removeItem(REMEMBER_KEY)
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

  const apiClient = createApiClient({ baseUrl: apiUrl })

  const resetForgot = () => {
    setForgotStep('phone')
    setForgotPhone('')
    setForgotCode('')
    setForgotNewPassword('')
    setForgotConfirmPassword('')
    setForgotResetToken('')
    setForgotCountdown(0)
    setForgotMessage('')
    setForgotError('')
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }

  const closeForgot = () => {
    setShowForgot(false)
    resetForgot()
  }

  const startCountdown = (seconds: number) => {
    setForgotCountdown(seconds)
    const timer = setInterval(() => {
      setForgotCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleForgotSendCode = async (e: FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotMessage('')
    if (!forgotPhone.trim()) {
      setForgotError('请输入手机号')
      return
    }
    if (!/^1[3-9]\d{9}$/.test(forgotPhone.trim())) {
      setForgotError('手机号格式不正确')
      return
    }

    setForgotLoading(true)
    try {
      const res = await apiClient.auth.forgotPasswordSendCode(forgotPhone.trim())
      if (res.code !== 0) {
        setForgotError(res.msg || '发送失败')
        return
      }
      setForgotStep('code')
      startCountdown(60)
      setForgotMessage(res.data.code ? `验证码：${res.data.code}` : '验证码已发送')
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleForgotVerifyCode = async (e: FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotMessage('')
    if (!forgotCode.trim()) {
      setForgotError('请输入验证码')
      return
    }

    setForgotLoading(true)
    try {
      const res = await apiClient.auth.forgotPasswordVerifyCode(forgotPhone.trim(), forgotCode.trim())
      if (res.code !== 0) {
        setForgotError(res.msg || '验证失败')
        return
      }
      setForgotResetToken(res.data.reset_token)
      setForgotStep('password')
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleForgotReset = async (e: FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotMessage('')
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError('新密码长度不能少于 6 位')
      return
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('两次输入的密码不一致')
      return
    }

    setForgotLoading(true)
    try {
      const res = await apiClient.auth.forgotPasswordReset(forgotPhone.trim(), forgotResetToken, forgotNewPassword)
      if (res.code !== 0) {
        setForgotError(res.msg || '重置失败')
        return
      }
      setForgotStep('success')
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${theme.gradientFrom} via-white ${theme.gradientTo} p-4`}>
      {/* 覆盖浏览器自动填充背景色 */}
      <style>{`
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus,
        .login-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px white inset !important;
          -webkit-text-fill-color: #111827 !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <RabbitHead scarfColor={LOGIN_SCARF_COLOR} className="h-[168px] w-[168px]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">YesGo 数字员工</h1>
          <p className="text-sm text-gray-500 mt-1">更懂医药营销的 AI 原生智能体平台</p>
        </div>

        {/* 登录卡片 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">租户登录</h2>

          <div className="space-y-4">
            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError('') }}
                onKeyDown={handleKeyDown}
                className={`login-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 ${theme.ring} ${theme.borderFocus} outline-none transition-shadow bg-white placeholder-gray-400`}
                placeholder="请输入用户名"
                disabled={loading}
                autoFocus
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  onKeyDown={handleKeyDown}
                className={`login-input w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 ${theme.ring} ${theme.borderFocus} outline-none transition-shadow bg-white placeholder-gray-400`}
                placeholder="请输入密码"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 记住密码 & 忘记密码 */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none text-gray-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className={`h-4 w-4 rounded border-gray-300 ${theme.checkbox} ${theme.accent} ${theme.ring}`}
                />
                记住密码
              </label>
              <button
                type="button"
                onClick={() => {
                  resetForgot()
                  setShowForgot(true)
                }}
                className={`${theme.text} ${theme.textHover} hover:underline`}
              >
                忘记密码？
              </button>
            </div>

            {/* 错误信息 */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* 登录按钮 */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 ${theme.buttonBg} ${theme.buttonHover} text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  登录中...
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  登录
                </>
              )}
            </button>
          </div>

        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          YesGo AI 数字员工平台 v1.0.0
        </p>
      </div>

      {/* 找回密码弹窗 */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {forgotStep !== 'phone' && forgotStep !== 'success' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (forgotStep === 'code') setForgotStep('phone')
                      if (forgotStep === 'password') setForgotStep('code')
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h3 className="text-lg font-semibold text-gray-900">
                  {forgotStep === 'phone' && '找回密码'}
                  {forgotStep === 'code' && '输入验证码'}
                  {forgotStep === 'password' && '设置新密码'}
                  {forgotStep === 'success' && '重置成功'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeForgot}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* 步骤指示器 */}
            <div className="flex items-center justify-between mb-6 px-2">
              {[
                { key: 'phone', label: '手机号' },
                { key: 'code', label: '验证码' },
                { key: 'password', label: '新密码' },
              ].map((s, idx) => {
                const isActive = forgotStep === s.key || (forgotStep === 'success' && idx < 3)
                const isPast = ['code', 'password', 'success'].indexOf(forgotStep) > idx
                return (
                  <div key={s.key} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        isActive || isPast
                          ? `${theme.buttonBg} text-white`
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span className={`text-xs ${isActive || isPast ? 'text-gray-700' : 'text-gray-400'}`}>{s.label}</span>
                  </div>
                )
              })}
            </div>

            {forgotStep === 'phone' && (
              <form onSubmit={handleForgotSendCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">手机号</label>
                  <input
                    type="tel"
                    value={forgotPhone}
                    onChange={(e) => { setForgotPhone(e.target.value); setForgotError('') }}
                    className={`login-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 ${theme.ring} ${theme.borderFocus} outline-none transition-shadow bg-white placeholder-gray-400`}
                    placeholder="请输入手机号"
                    autoFocus
                  />
                </div>
                {forgotError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle size={14} />
                    <span>{forgotError}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className={`w-full ${theme.buttonBg} ${theme.buttonHover} text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50`}
                >
                  {forgotLoading ? '发送中...' : '获取验证码'}
                </button>
              </form>
            )}

            {forgotStep === 'code' && (
              <form onSubmit={handleForgotVerifyCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">验证码</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={forgotCode}
                    onChange={(e) => { setForgotCode(e.target.value.replace(/\D/g, '')); setForgotError('') }}
                    className={`login-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 ${theme.ring} ${theme.borderFocus} outline-none transition-shadow bg-white placeholder-gray-400`}
                    placeholder="请输入 6 位验证码"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    验证码已发送至 {forgotPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
                  </p>
                </div>
                {forgotMessage && (
                  <div className="text-sm rounded-lg px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200">
                    {forgotMessage}
                  </div>
                )}
                {forgotError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle size={14} />
                    <span>{forgotError}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className={`w-full ${theme.buttonBg} ${theme.buttonHover} text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50`}
                >
                  {forgotLoading ? '验证中...' : '下一步'}
                </button>
                <div className="text-center">
                  {forgotCountdown > 0 ? (
                    <span className="text-xs text-gray-500">{forgotCountdown}s 后可重新获取</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleForgotSendCode}
                      disabled={forgotLoading}
                      className={`text-xs ${theme.text} ${theme.textHover} hover:underline`}
                    >
                      重新获取验证码
                    </button>
                  )}
                </div>
              </form>
            )}

            {forgotStep === 'password' && (
              <form onSubmit={handleForgotReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">新密码</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={forgotNewPassword}
                      onChange={(e) => { setForgotNewPassword(e.target.value); setForgotError('') }}
                      className={`login-input w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 ${theme.ring} ${theme.borderFocus} outline-none transition-shadow bg-white placeholder-gray-400`}
                      placeholder="请输入新密码"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">确认新密码</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={forgotConfirmPassword}
                      onChange={(e) => { setForgotConfirmPassword(e.target.value); setForgotError('') }}
                      className={`login-input w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 ${theme.ring} ${theme.borderFocus} outline-none transition-shadow bg-white placeholder-gray-400`}
                      placeholder="请再次输入新密码"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {forgotError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle size={14} />
                    <span>{forgotError}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className={`w-full ${theme.buttonBg} ${theme.buttonHover} text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50`}
                >
                  {forgotLoading ? '重置中...' : '重置密码'}
                </button>
              </form>
            )}

            {forgotStep === 'success' && (
              <div className="space-y-4 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">密码重置成功，请使用新密码登录</p>
                <button
                  type="button"
                  onClick={closeForgot}
                  className={`w-full ${theme.buttonBg} ${theme.buttonHover} text-white font-medium py-2.5 rounded-lg text-sm transition-colors`}
                >
                  返回登录
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
