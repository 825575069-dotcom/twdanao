import { useState, useEffect, useCallback, useRef } from 'react'
import { Menu, X, MessageSquare, Bot, BookOpen, BarChart3, Settings, Loader2, ShieldAlert } from 'lucide-react'
import LoginView from './components/LoginView'
import Sidebar from './components/Sidebar'
import InputBar from './components/InputBar'
import CommandPalette from './components/CommandPalette'
import AgentOfficeView from './components/AgentOfficeView'
import KnowledgeView from './components/KnowledgeView'
import DataView from './components/DataView'
import SettingsView from './components/SettingsView'
import ChatView from './components/ChatView'
import CreditsView from './components/CreditsView'
import TasksView from './components/TasksView'
import DataBaseView from './components/DataBaseView'
import MediaView from './components/MediaView'
import PermissionsView from './components/PermissionsView'
import ModelsView from './components/ModelsView'
import SkillsView from './components/SkillsView'
import ClientsView from './components/ClientsView'
import ConfigView from './components/ConfigView'
import SecurityView from './components/SecurityView'
import OfficePanel from './components/OfficePanel'
import ChatToolsPanel from './components/ChatToolsPanel'
import { StoreProvider, useStore } from './store/appStore'
import { ThemeProvider, useTheme, getBodyClass } from './lib/theme'
import { dispatch } from './lib/dispatch'
import { sendChatToBackend } from './lib/backend'
import { businessAgents, controlAgent } from './data/mockAgents'
import { hasAccess, canUseAgent } from './lib/permissions'

export type ViewKey =
  | 'office'
  | 'chat'
  | 'marketing'
  | 'tasks'
  | 'knowledge'
  | 'dataBase'
  | 'media'
  | 'data'
  | 'clients'
  | 'permissions'
  | 'credits'
  | 'models'
  | 'skills'
  | 'config'
  | 'settings'
  | 'security'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  time: string
  /** 派发到的智能体（如有） */
  dispatchAgent?: {
    id: string
    name: string
    emoji: string
    intent: string
  }
  /** 智能体执行结果回报 */
  resultText?: string
  /** 记忆召回信息 */
  memory?: {
    strategy: string
    short_term_count: number
    summary_count: number
    fact_count: number
    total_tokens: number
    recalled_summaries?: Array<{ id: string; title: string; date: string }>
    recalled_facts?: Array<{ id: string; key: string; value: string; category: string }>
  } | null
  /** 附件列表 */
  attachments?: Array<{ id: string; name: string; type: string; size: number }>
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  updatedAt: number
}

export default function App({ isH5 = false }: { isH5?: boolean }) {
  return (
    <ThemeProvider>
      <StoreProvider>
        <AppShell isH5={isH5} />
      </StoreProvider>
    </ThemeProvider>
  )
}

function AppShell({ isH5 }: { isH5: boolean }) {
  const { mode, colorTheme } = useTheme()
  const store = useStore()

  // 应用主题到 body（CSS 变量 + class 切换深浅色 / 品牌色）
  useEffect(() => {
    document.body.className = getBodyClass(mode, colorTheme)
  }, [mode, colorTheme])

  // 未认证时显示登录页
  if (!store.isAuthenticated) {
    return <LoginView onLogin={store.login} />
  }

  // 后端同步中显示加载动画
  if (store.backendSyncing && !store.backendConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="text-sm text-gray-400">正在连接天网大脑...</p>
        </div>
      </div>
    )
  }

  // 已认证且同步完成 → 渲染主应用
  return <AuthenticatedApp isH5={isH5} />
}

function AuthenticatedApp({ isH5 }: { isH5: boolean }) {
  const { mode } = useTheme()
  const store = useStore()
  const [activeView, setActiveView] = useState<ViewKey>('chat')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [chatToolsOpen, setChatToolsOpen] = useState(false)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('yesgo_favorite_prompts') || '[]')
    } catch {
      return []
    }
  })
  const [conversations, setConversations] = useState<Conversation[]>(() => [
    { id: crypto.randomUUID(), title: '新对话', messages: [], updatedAt: Date.now() }
  ])
  const [activeConversationId, setActiveConversationId] = useState<string>(conversations[0].id)
  const consumingResultRef = useRef(false)
  const lastDispatchedAgentRef = useRef<Message['dispatchAgent'] | null>(null)
  // 聊天视图注册的「定位到指定消息」方法（供右侧工作日志点击调用）
  const scrollToMessageRef = useRef<((msgId: string) => void) | null>(null)

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? conversations[0]

  const addFavorite = useCallback((text: string) => {
    setFavorites((prev) => {
      if (prev.includes(text)) return prev
      const next = [text, ...prev].slice(0, 50)
      localStorage.setItem('yesgo_favorite_prompts', JSON.stringify(next))
      return next
    })
  }, [])

  // ⌘K / Ctrl+K 呼出命令面板
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setPaletteOpen((v) => !v)
    }
    if (e.key === 'Escape') setPaletteOpen(false)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // 监听办公室回传的执行结果 → 自动追加到当前对话
  useEffect(() => {
    if (store.lastResult && !consumingResultRef.current) {
      consumingResultRef.current = true
      const result = store.lastResult
      const dispatchedAgent = lastDispatchedAgentRef.current
      store.clearPendingTask()
      setTimeout(() => {
        const reply: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          dispatchAgent: dispatchedAgent ?? undefined
        }
        appendMessageToActive(reply)
        consumingResultRef.current = false
      }, 300)
    }
  }, [store.lastResult]) // eslint-disable-line react-hooks/exhaustive-deps

  // 经理兔意图确认话术（经理兔称用户为老板）
  const managerAck = (intent: string, agentName?: string) =>
    `老板，我已理解您的需求：${intent}。现在派出${agentName ?? '业务兔'}为您处理。`

  const handleSend = async (text: string, attachments?: import('./types').FileAttachment[]) => {
    if (!text.trim()) return
    const now = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      time: now,
      attachments: attachments?.map(a => ({ id: a.id, name: a.name, type: a.type, size: a.size })),
    }
    appendMessageToActive(userMsg)

    // —— 尝试走后端 chat API（第二层天网大脑）——
    const backendResp = await sendChatToBackend(text, activeConversationId)

    if (backendResp) {
      // ===== 后端路径 =====
      // 后端已完成：意图识别 → 智能体派发 → LLM 生成回复
      const agent = businessAgents.find((a) => a.code === backendResp.agentCode)

      // 权限与积分校验（客户端侧，后端 mock 未强制）
      const currentUserId = store.tenant.membership?.userId
      const member = currentUserId ? store.tenant.members.find((m) => m.id === currentUserId) : undefined
      const agentId = agent?.id ?? backendResp.agentCode
      const isAllowed = canUseAgent(store.userPermissions, backendResp.agentCode)
      const creditCost = agent?.credits ?? 5
      const hasCredits = (member?.credits ?? 0) >= creditCost && store.creditBalance >= creditCost

      if (!isAllowed) {
        appendMessageToActive({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `当前角色无权使用 ${backendResp.agent}，请联系管理员开通权限。`,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        })
        return
      }

      if (!hasCredits) {
        appendMessageToActive({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `积分不足：本次需要 ${creditCost} 积分，当前余额 ${member?.credits ?? 0}。请联系管理员分配积分。`,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        })
        return
      }

      // 扣除积分
      store.consumeCredits(agentId, agent?.name ?? backendResp.agent, creditCost, backendResp.intent)

      // 经理兔先进行意图识别与调度确认
      const managerMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: managerAck(backendResp.intent, agent?.name ?? backendResp.agent),
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        dispatchAgent: {
          id: controlAgent.id,
          name: controlAgent.name,
          emoji: controlAgent.emoji,
          intent: '意图识别'
        }
      }
      appendMessageToActive(managerMsg)

      // 展示后端返回的业务兔回复
      const replyMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: backendResp.reply,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        dispatchAgent: agent
          ? { id: agent.id, name: agent.name, emoji: agent.emoji, intent: backendResp.intent }
          : { id: backendResp.agentCode, name: backendResp.agent, emoji: '🤖', intent: backendResp.intent },
        memory: (backendResp as { memory?: Message['memory'] }).memory ?? null,
      }
      appendMessageToActive(replyMsg)

      // 派发到办公室视图（视觉动画执行）
      store.dispatchTask(text)
      return
    }

    // ===== 降级路径：后端不可达，回退本地规则引擎 =====
    dispatch(text).then((d) => {
      const agent = businessAgents.find((a) => a.id === d.agentId)

      // 权限与积分校验
      const currentUserId = store.tenant.membership?.userId
      const member = currentUserId ? store.tenant.members.find((m) => m.id === currentUserId) : undefined
      const isAllowed = canUseAgent(store.userPermissions, d.agentId)
      const creditCost = agent?.credits ?? 5
      const hasCredits = (member?.credits ?? 0) >= creditCost && store.creditBalance >= creditCost

      if (!isAllowed) {
        appendMessageToActive({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `当前角色无权使用 ${agent?.name ?? '该智能体'}，请联系管理员开通权限。`,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        })
        return
      }

      if (!hasCredits) {
        appendMessageToActive({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `积分不足：本次需要 ${creditCost} 积分，当前余额 ${member?.credits ?? 0}。请联系管理员分配积分。`,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        })
        return
      }

      // 第一步：经理兔进行意图识别与调度确认（~400ms 后弹出）
      setTimeout(() => {
        const managerMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: managerAck(d.intent, agent?.name),
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          dispatchAgent: {
            id: controlAgent.id,
            name: controlAgent.name,
            emoji: controlAgent.emoji,
            intent: '意图识别'
          }
        }
        appendMessageToActive(managerMsg)

        // 记住派发的业务兔，供办公室执行结果回写时使用
        lastDispatchedAgentRef.current = agent
          ? { id: agent.id, name: agent.name, emoji: agent.emoji, intent: d.intent }
          : null

        // 第二步：把任务写入全局通道 → 办公室视图自动接手执行
        store.dispatchTask(text)
      }, 400)
    })
  }

  /** 追加消息到当前激活会话 */
  const appendMessageToActive = (msg: Message) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConversationId) return c
        const isFirstUser = msg.role === 'user' && c.messages.length === 0
        const newTitle = isFirstUser
          ? msg.content.length > 20
            ? msg.content.slice(0, 20) + '…'
            : msg.content
          : c.title
        return {
          ...c,
          title: newTitle,
          messages: [...c.messages, msg],
          updatedAt: Date.now()
        }
      })
    )
  }

  /** 新建会话 */
  const createConversation = () => {
    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: '新对话',
      messages: [],
      updatedAt: Date.now()
    }
    setConversations((prev) => [newConv, ...prev])
    setActiveConversationId(newConv.id)
  }

  /** 切换会话 */
  const switchConversation = (id: string) => {
    setActiveConversationId(id)
  }

  /** 删除会话 */
  const deleteConversation = (id: string) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === id)
      const filtered = prev.filter((c) => c.id !== id)
      if (filtered.length === 0) {
        const newConv: Conversation = {
          id: crypto.randomUUID(),
          title: '新对话',
          messages: [],
          updatedAt: Date.now()
        }
        setActiveConversationId(newConv.id)
        return [newConv]
      }
      if (id === activeConversationId) {
        const next = filtered[idx >= filtered.length ? filtered.length - 1 : idx]
        setActiveConversationId(next.id)
      }
      return filtered
    })
  }

  const renderMain = () => {
    // 权限检查：无权限的视图显示 "无权限访问" 页面
    if (!hasAccess(store.userPermissions, activeView)) {
      return (
        <div className="flex h-full flex-col items-center justify-center text-text-muted">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated">
            <ShieldAlert size={32} className="text-text-muted/50" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-text-primary">无权限访问</h3>
          <p className="text-sm text-text-muted">
            当前角色没有访问「{mobileTitleMap[activeView]}」的权限，请联系管理员开通
          </p>
        </div>
      )
    }

    switch (activeView) {
      case 'marketing':
        return <AgentOfficeView />
      case 'chat':
        return (
          <ChatView
            conversation={activeConversation}
            conversations={conversations}
            onNew={createConversation}
            onSwitch={switchConversation}
            onDelete={deleteConversation}
            onSend={handleSend}
            onToolsToggle={() => setChatToolsOpen(v => !v)}
            onFavorite={addFavorite}
            registerScrollToMessage={(fn) => { scrollToMessageRef.current = fn }}
          />
        )
      case 'tasks':
        return <TasksView />
      case 'knowledge':
        return <KnowledgeView />
      case 'dataBase':
        return <DataBaseView />
      case 'media':
        return <MediaView />
      case 'data':
        return <DataView />
      case 'clients':
        return <ClientsView />
      case 'permissions':
        return <PermissionsView />
      case 'credits':
        return <CreditsView />
      case 'models':
        return <ModelsView />
      case 'skills':
        return <SkillsView />
      case 'config':
        return <ConfigView />
      case 'security':
        return <SecurityView />
      case 'settings':
        return <SettingsView onNavigate={setActiveView} />
      default:
        return null
    }
  }

  // 首页聊天视图不显示右侧 OfficePanel（按图二设计为纯净欢迎页）
  const showOfficePanel = activeView === 'office' || activeView === 'marketing'

  // H5 移动端底部导航 Tab 定义
  const mobileTabs: { key: ViewKey; label: string; icon: typeof MessageSquare }[] = [
    { key: 'chat', label: '对话', icon: MessageSquare },
    { key: 'office', label: '办公室', icon: Bot },
    { key: 'knowledge', label: '知识库', icon: BookOpen },
    { key: 'data', label: '看板', icon: BarChart3 },
    { key: 'settings', label: '设置', icon: Settings }
  ]

  const mobileTitleMap: Record<ViewKey, string> = {
    chat: 'AI 智能对话',
    office: 'AI 办公室',
    marketing: '营销跟客',
    tasks: '自动任务',
    knowledge: '企业知识库',
    dataBase: '数据底座',
    media: '营销素材',
    data: '经营看板',
    clients: '客户管理',
    permissions: '权限管理',
    credits: '积分管理',
    models: '模型网关',
    skills: '技能市场',
    config: '配置中心',
    security: '安全审计',
    settings: '系统设置'
  }

  // ========== H5 移动端布局 ==========
  if (isH5) {
    return (
      <div className={`flex h-screen w-screen flex-col bg-bg-base text-text-primary ${mode === 'light' ? 'bg-light' : ''}`}>
        {/* 顶部导航栏 */}
        <header className="flex h-12 shrink-0 items-center border-b border-border-subtle bg-bg-surface px-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold text-text-primary">YesGo</h1>
          <span className="ml-2 text-xs text-text-muted">| {mobileTitleMap[activeView]}</span>
        </header>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto">{renderMain()}</main>

        {/* 底部输入栏（对话视图） */}
        {activeView === 'chat' && <InputBar onSend={handleSend} favorites={favorites} />}

        {/* 底部导航 Tab 栏 */}
        <nav className="flex h-14 shrink-0 items-center border-t border-border-subtle bg-bg-surface pb-safe">
          {mobileTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeView === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveView(tab.key); setMobileMenuOpen(false) }}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'text-accent' : 'text-text-muted'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] ${isActive ? 'font-semibold' : ''}`}>{tab.label}</span>
              </button>
            )
          })}
        </nav>

        {/* 侧边菜单抽屉（slide-over） */}
        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col bg-bg-surface shadow-xl">
              {/* 抽屉头部 */}
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle px-4">
                <span className="text-sm font-semibold text-text-primary">YesGo</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* 抽屉内容：复用 Sidebar 组件 */}
              <div className="flex-1 overflow-y-auto">
                <Sidebar
                  active={activeView}
                  onChange={(v) => { setActiveView(v); setMobileMenuOpen(false) }}
                />
              </div>
            </aside>
          </>
        )}

        {/* 后台常驻 AgentOfficeView */}
        {activeView !== 'office' && (
          <div className="hidden" aria-hidden="true">
            <AgentOfficeView />
          </div>
        )}
      </div>
    )
  }

  // ========== 桌面端布局（不变） ==========

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden bg-bg-base ${
        mode === 'light' ? 'bg-light' : ''
      } text-text-primary`}
    >
      <Sidebar active={activeView} onChange={setActiveView} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* macOS 标题栏拖动区（hiddenInset 下窗口按钮在左上角） */}
        <div className="drag-region flex h-8 w-full shrink-0 items-center justify-end px-3" />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            <main className="min-h-0 flex-1 overflow-y-auto animate-fade-in">{renderMain()}</main>

            {activeView === 'chat' && <InputBar onSend={handleSend} favorites={favorites} />}
          </div>

          {/* 右侧工具栏：按设计实现为团队面板 + 工作日志/产出物/历史对话 */}
          {activeView === 'chat' && chatToolsOpen && (
            <div className="w-72 shrink-0 overflow-hidden">
              <ChatToolsPanel
              conversation={activeConversation}
              conversations={conversations}
              onSwitch={switchConversation}
              onNew={createConversation}
              onDelete={deleteConversation}
              onJumpToMessage={(msgId) => scrollToMessageRef.current?.(msgId)}
            />
            </div>
          )}
        </div>
      </div>

      {/* 后台常驻 AgentOfficeView — 确保跨视图任务通道始终在线 */}
      {activeView !== 'office' && (
        <div className="hidden" aria-hidden="true">
          <AgentOfficeView />
        </div>
      )}

      {/* 后台常驻 AgentOfficeView — 确保跨视图任务通道始终在线 */}
      {activeView !== 'office' && activeView !== 'marketing' && (
        <div className="hidden" aria-hidden="true">
          <AgentOfficeView />
        </div>
      )}

      {/* 右侧 Office 面板 */}
      {showOfficePanel && <OfficePanel />}

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onNavigate={(v) => {
            setActiveView(v)
            setPaletteOpen(false)
          }}
        />
      )}
    </div>
  )
}

