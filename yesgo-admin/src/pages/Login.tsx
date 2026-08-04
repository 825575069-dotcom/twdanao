// ============================================================
// YesGo Admin — Login Page
// ============================================================
import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/store/authStore';
import { api } from '@/lib/api';
import { LogIn, Eye, EyeOff, X, ArrowLeft, AlertCircle } from 'lucide-react';

const REMEMBER_KEY = 'yesgo_admin_remember';

export default function Login() {
  const { state, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState('');

  // 找回密码分步状态
  const [showForgot, setShowForgot] = useState(false);
  type ForgotStep = 'phone' | 'code' | 'password' | 'success';
  const [forgotStep, setForgotStep] = useState<ForgotStep>('phone');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotCountdown, setForgotCountdown] = useState(0);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 加载记住的账号密码
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const { username: u, password: p } = JSON.parse(saved);
        if (u) setUsername(u);
        if (p) setPassword(p);
        setRememberMe(true);
      }
    } catch {
      // ignore parse error
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!username.trim() || !password.trim()) {
      setLocalError('请输入用户名和密码');
      return;
    }
    try {
      await login(username, password);
      // 登录成功后处理记住密码
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username, password }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch {
      setLocalError('用户名或密码错误');
    }
  };

  const resetForgot = () => {
    setForgotStep('phone');
    setForgotPhone('');
    setForgotCode('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotResetToken('');
    setForgotCountdown(0);
    setForgotMessage('');
    setForgotError('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const closeForgot = () => {
    setShowForgot(false);
    resetForgot();
  };

  const startCountdown = (seconds: number) => {
    setForgotCountdown(seconds);
    const timer = setInterval(() => {
      setForgotCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleForgotSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    if (!forgotPhone.trim()) {
      setForgotError('请输入手机号');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(forgotPhone.trim())) {
      setForgotError('手机号格式不正确');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.forgotPasswordSendCode(forgotPhone.trim());
      if (res.code !== 0) {
        setForgotError(res.msg || '发送失败');
        return;
      }
      setForgotStep('code');
      startCountdown(60);
      setForgotMessage(res.data.code ? `验证码：${res.data.code}` : '验证码已发送');
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    if (!forgotCode.trim()) {
      setForgotError('请输入验证码');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.forgotPasswordVerifyCode(forgotPhone.trim(), forgotCode.trim());
      if (res.code !== 0) {
        setForgotError(res.msg || '验证失败');
        return;
      }
      setForgotResetToken(res.data.reset_token);
      setForgotStep('password');
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotReset = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError('新密码长度不能少于 6 位');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('两次输入的密码不一致');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.forgotPasswordReset(forgotPhone.trim(), forgotResetToken, forgotNewPassword);
      if (res.code !== 0) {
        setForgotError(res.msg || '重置失败');
        return;
      }
      setForgotStep('success');
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-blue-50">
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

      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 shadow-lg shadow-primary-200 mb-4">
            <span className="text-white text-2xl font-bold">Y</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">YesGo 天网大脑</h1>
          <p className="text-sm text-gray-500 mt-1">第二层管理后台</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">管理员登录</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="login-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-white"
                placeholder="请输入用户名"
                autoFocus
                disabled={state.isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-white"
                  placeholder="请输入密码"
                  disabled={state.isLoading}
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
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                记住密码
              </label>
              <button
                type="button"
                onClick={() => {
                  resetForgot();
                  setShowForgot(true);
                }}
                className="text-primary-600 hover:text-primary-700 hover:underline"
              >
                忘记密码？
              </button>
            </div>

            {(localError || state.error) && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {localError || state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={state.isLoading}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {state.isLoading ? (
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
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          YesGo v1.0 · 天网大脑管理后台
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
                      if (forgotStep === 'code') setForgotStep('phone');
                      if (forgotStep === 'password') setForgotStep('code');
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
                const isActive = forgotStep === s.key || (forgotStep === 'success' && idx < 3);
                const isPast = ['code', 'password', 'success'].indexOf(forgotStep) > idx;
                return (
                  <div key={s.key} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        isActive || isPast ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span className={`text-xs ${isActive || isPast ? 'text-gray-700' : 'text-gray-400'}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>

            {forgotStep === 'phone' && (
              <form onSubmit={handleForgotSendCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">手机号</label>
                  <input
                    type="tel"
                    value={forgotPhone}
                    onChange={(e) => { setForgotPhone(e.target.value); setForgotError(''); }}
                    className="login-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-white"
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
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
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
                    onChange={(e) => { setForgotCode(e.target.value.replace(/\D/g, '')); setForgotError(''); }}
                    className="login-input w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-white"
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
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
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
                      className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
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
                      onChange={(e) => { setForgotNewPassword(e.target.value); setForgotError(''); }}
                      className="login-input w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-white"
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
                      onChange={(e) => { setForgotConfirmPassword(e.target.value); setForgotError(''); }}
                      className="login-input w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-white"
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
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
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
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                  返回登录
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
