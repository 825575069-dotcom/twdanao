import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

declare global {
  interface Window {
    __H5_MODE__?: boolean
  }
}

// —— 全局未捕获错误处理：显示在页面上，避免白屏 ——
window.addEventListener('error', (event) => {
  const el = document.getElementById('root')
  if (el && !el.innerHTML.trim().includes('text-accent')) {
    el.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1117;color:#e5e7eb;font-family:system-ui;padding:24px"><div style="max-width:640px"><div style="font-size:48px;text-align:center;margin-bottom:12px">⚠️</div><h1 style="font-size:20px;font-weight:700;color:#f87171;text-align:center;margin-bottom:8px">JS 运行时错误</h1><div style="background:#1a1d27;border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.05);margin-bottom:16px"><pre style="font-size:12px;color:#fca5a5;white-space:pre-wrap;word-break:break-word;line-height:1.6;margin:0">${event.message ?? '未知错误'}</pre><pre style="font-size:10px;color:#6b7280;white-space:pre-wrap;word-break:break-word;line-height:1.5;margin-top:8px">来源: ${event.filename ?? 'N/A'}${event.lineno ? ':' + event.lineno : ''}</pre></div><button onclick="localStorage.clear();location.reload()" style="background:#6366f1;color:white;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer">清除缓存并刷新</button></div></div>`
  }
})

window.addEventListener('unhandledrejection', (event) => {
  const el = document.getElementById('root')
  if (el && !el.innerHTML.trim().includes('text-accent')) {
    el.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1117;color:#e5e7eb;font-family:system-ui;padding:24px"><div style="max-width:640px"><div style="font-size:48px;text-align:center;margin-bottom:12px">⚠️</div><h1 style="font-size:20px;font-weight:700;color:#f87171;text-align:center;margin-bottom:8px">Promise 未捕获错误</h1><div style="background:#1a1d27;border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.05);margin-bottom:16px"><pre style="font-size:12px;color:#fca5a5;white-space:pre-wrap;word-break:break-word;line-height:1.6;margin:0">${String(event.reason?.message ?? event.reason ?? '未知错误')}</pre></div><button onclick="localStorage.clear();location.reload()" style="background:#6366f1;color:white;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer">清除缓存并刷新</button></div></div>`
  }
})

const isH5 = !!window.__H5_MODE__

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App isH5={isH5} />
    </ErrorBoundary>
  </React.StrictMode>
)
