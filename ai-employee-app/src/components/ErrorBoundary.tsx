// ============================================================
// ErrorBoundary — 全局错误边界，捕获 React 渲染异常
// 生产环境下避免白屏，直接显示错误信息在页面上
// ============================================================
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  stack: string
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, stack: '' }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, stack: error.stack ?? '' }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f1117',
          color: '#e5e7eb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '24px'
        }}>
          <div style={{ maxWidth: '640px', width: '100%' }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '12px',
              textAlign: 'center'
            }}>
              🚨
            </div>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#f87171',
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              应用崩溃
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#9ca3af',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              如果刚刷新过，请尝试清除缓存后重试
            </p>
            <div style={{
              background: '#1a1d27',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#f59e0b',
                marginBottom: '8px'
              }}>
                错误信息：
              </div>
              <pre style={{
                fontSize: '12px',
                color: '#fca5a5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                lineHeight: 1.6
              }}>
                {this.state.error?.message ?? '未知错误'}
              </pre>
              {this.state.stack && (
                <details style={{ marginTop: '12px' }}>
                  <summary style={{
                    fontSize: '11px',
                    color: '#6b7280',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}>
                    完整堆栈
                  </summary>
                  <pre style={{
                    fontSize: '10px',
                    color: '#6b7280',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    marginTop: '8px',
                    lineHeight: 1.5,
                    maxHeight: '300px',
                    overflow: 'auto'
                  }}>
                    {this.state.stack}
                  </pre>
                </details>
              )}
            </div>
            <div style={{
              marginTop: '16px',
              textAlign: 'center'
            }}>
              <button
                onClick={() => {
                  localStorage.clear()
                  window.location.reload()
                }}
                style={{
                  background: '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                清除缓存并刷新
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
