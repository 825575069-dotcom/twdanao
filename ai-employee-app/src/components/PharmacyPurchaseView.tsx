import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Copy, Check, ShoppingBag, Search, Package, Zap, Loader2, Store,
  Mic, X, Clock, TrendingDown, Scale, ShoppingCart,
  Truck, Shield, ChevronDown, ChevronRight, ClipboardList, Wallet,
  FileCheck, Phone, MapPin, RefreshCw, ArrowLeft, CreditCard,
  Plus, Trash2, QrCode, ShieldCheck, Sparkles, BarChart3, DollarSign, Lightbulb,
  ArrowUpRight, ArrowDown, FileText, Menu, ChevronUp, Upload, History,
  Megaphone, Users, GraduationCap, BookOpen, MessageCircle, Bot, Target, Brain,
} from 'lucide-react'
import RabbitHead from './RabbitHead'
import { QualificationsTab, FirstOpsTab, type QualificationsTabHandle, type FirstOpsTabHandle } from './QualificationView'
import PurchaseToolsPanel from './PurchaseToolsPanel'
import CollectivePurchasePanel from './CollectivePurchasePanel'
import type { Message } from '../App'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import {
  sendPharmacyChat,
  type PharmacyProduct,
  type QuickPurchaseSolutions,
  type PurchaseSolution,
  type SolutionItem,
  type OrderFullStatus,
  type OrderListItem,
  fetchPurchaseChatPrompts,
  fetchPurchaseHomePrompts,
  type PurchaseChatPromptGroup,
} from '../lib/backend'
import { getApiClient } from '../lib/api'

type PharmacyMode = 'quick' | 'collective' | 'search'

export interface PharmacyMessage extends Message {
  products?: PharmacyProduct[]
  solutions?: QuickPurchaseSolutions | null
  mode?: PharmacyMode
  images?: string[]
}

export interface PharmacyConversation {
  id: string
  title: string
  messages: PharmacyMessage[]
  sessionId: string
  updatedAt: number
}

const MODE_CONFIG: Record<PharmacyMode, { label: string; icon: typeof Zap; desc: string }> = {
  quick: { label: '快采', icon: Zap, desc: '快速下单，现货速发' },
  collective: { label: '集采', icon: Package, desc: '拼单集采，更优价格' },
  search: { label: '找品', icon: Search, desc: '搜索产品，查看详情' },
}

// 分类标签映射（已知分类用中文名，自定义分类直接显示原始值）
const PURCHASE_CATEGORY_LABEL_MAP: Record<string, string> = {
  recommend: '推荐',
  collective: '集采',
  quick: '快采',
  controlled: '找控销品',
  summary: '采购总结',
  savings: '省钱攻略',
  purchase: '智能采购',
  platform: '平台运营',
  marketing: '营销跟客',
  flow: '流向管控',
  academic: '学术培训',
}

interface PharmacyPromptCard {
  icon: typeof Sparkles
  title: string
  desc: string
  prompt: string
  mode: PharmacyMode
  iconBg: string
  iconColor: string
}

// 采购兔首页卡片后端图标映射（与 WelcomeScreen PROMPT_ICON_MAP 对齐）
const PURCHASE_ICON_MAP: Record<string, typeof Sparkles> = {
  megaphone: Megaphone,
  users: Users,
  search: Search,
  'graduation-cap': GraduationCap,
  'bar-chart-3': BarChart3,
  'trending-down': TrendingDown,
  package: Package,
  truck: Truck,
  'book-open': BookOpen,
  sparkles: Sparkles,
  'file-text': FileText,
  'message-circle': MessageCircle,
  bot: Bot,
  target: Target,
  lightbulb: Lightbulb,
  brain: Brain
}

// 采购对话快捷输入三库标签（与后端 category / 采购模式对齐）
const QUICK_TAB_CONFIG: Record<PharmacyMode, { label: string; empty: string }> = {
  quick: { label: '快采', empty: '暂无快采提示词' },
  collective: { label: '集采', empty: '暂无集采提示词' },
  search: { label: '找品', empty: '暂无找品提示词' },
}

// ========== Toast ==========
interface ToastState { show: boolean; message: string; type: 'success' | 'error' | 'info' }

// 采购对话状态持久化：点击侧边栏“采购对话”始终显示最后一次对话
const PHARMACY_CONVERSATIONS_KEY = 'yesgo-pharmacy-conversations'
const PHARMACY_ACTIVE_ID_KEY = 'yesgo-pharmacy-active-conversation'

function loadInitialPharmacyState(): { conversations: PharmacyConversation[]; activeId: string } {
  try {
    const raw = localStorage.getItem(PHARMACY_CONVERSATIONS_KEY)
    const stored: PharmacyConversation[] | null = raw ? JSON.parse(raw) : null
    if (stored && stored.length > 0) {
      const activeRaw = localStorage.getItem(PHARMACY_ACTIVE_ID_KEY)
      const activeId = activeRaw && stored.some((c) => c.id === activeRaw) ? activeRaw : stored[0].id
      return { conversations: stored, activeId }
    }
  } catch {
    // ignore corrupted storage
  }
  const first: PharmacyConversation = {
    id: crypto.randomUUID(),
    title: '新对话',
    messages: [],
    sessionId: '',
    updatedAt: Date.now(),
  }
  return { conversations: [first], activeId: first.id }
}

export default function PharmacyPurchaseView() {
  const initialStateRef = useRef(loadInitialPharmacyState())
  const [conversations, setConversations] = useState<PharmacyConversation[]>(initialStateRef.current.conversations)
  const [activeConversationId, setActiveConversationId] = useState<string>(initialStateRef.current.activeId)
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? conversations[0],
    [conversations, activeConversationId]
  )

  // 持久化会话列表与当前会话 ID
  useEffect(() => {
    try {
      localStorage.setItem(PHARMACY_CONVERSATIONS_KEY, JSON.stringify(conversations))
    } catch {}
  }, [conversations])

  useEffect(() => {
    try {
      localStorage.setItem(PHARMACY_ACTIVE_ID_KEY, activeConversationId)
    } catch {}
  }, [activeConversationId])

  // 拉取采购对话三库提示词（仅用于底部快捷输入）
  useEffect(() => {
    fetchPurchaseChatPrompts().then((data) => {
      if (data) {
        setPurchasePrompts(data)
      }
    })
  }, [])

  // 拉取采购兔首页提示词（purchase_home 类型，驱动首页 Tab 和卡片）
  useEffect(() => {
    fetchPurchaseHomePrompts().then((data) => {
      if (data) {
        const map: Record<string, PharmacyPromptCard[]> = {}
        const seenCategories = new Set<string>()
        // 为首页卡片提供默认配色
        const colorPalette = [
          { bg: 'bg-blue-50', color: 'text-blue-500' },
          { bg: 'bg-purple-50', color: 'text-purple-500' },
          { bg: 'bg-emerald-50', color: 'text-emerald-500' },
          { bg: 'bg-orange-50', color: 'text-orange-500' },
          { bg: 'bg-yellow-50', color: 'text-yellow-500' },
          { bg: 'bg-pink-50', color: 'text-pink-500' },
        ]
        let colorIndex = 0
        data.forEach((p) => {
          if (!p.category) return
          const cat = p.category
          seenCategories.add(cat)
          if (!map[cat]) map[cat] = []
          const style = colorPalette[colorIndex % colorPalette.length]
          colorIndex++
          const IconComponent = PURCHASE_ICON_MAP[p.icon] || Sparkles
          map[cat].push({
            icon: IconComponent,
            title: p.title,
            desc: (p.desc || '').slice(0, 80),
            prompt: p.prompt,
            mode: 'quick' as PharmacyMode,
            iconBg: style.bg,
            iconColor: style.color,
          })
        })
        // 生成有序分类列表（预定义顺序优先，自定义排后面）
        const predefinedOrder = ['recommend', 'collective', 'quick', 'controlled', 'summary', 'savings', 'purchase']
        const orderedCats = [
          ...predefinedOrder.filter((c) => seenCategories.has(c)),
          ...[...seenCategories].filter((c) => !predefinedOrder.includes(c)),
        ]
        setPharmacyBackendCards(map)
        setPharmacyCategoryOrder(orderedCats)
        if (orderedCats.length > 0 && !seenCategories.has(activePharmTab)) {
          setActivePharmTab(orderedCats[0])
        }
      }
    })
  }, [])

  const [input, setInput] = useState('')
  const [mode, setMode] = useState<PharmacyMode>('quick')
  const [sending, setSending] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 订单面板 & 详情
  const [showOrderPanel, setShowOrderPanel] = useState(false)
  const [showCollectivePanel, setShowCollectivePanel] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<PharmacyProduct | null>(null)
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' })

  // 首页提示词 tab & 底部快捷录入下拉
  const [activePharmTab, setActivePharmTab] = useState<string>('recommend')
  const [showQuickDropdown, setShowQuickDropdown] = useState(false)
  const [quickTab, setQuickTab] = useState<PharmacyMode>('quick')
  const [purchasePrompts, setPurchasePrompts] = useState<PurchaseChatPromptGroup>({ quick: [], collective: [], search: [] })
  // 后端采购兔首页提示词卡片（null=加载中/未成功，不展示）
  const [pharmacyBackendCards, setPharmacyBackendCards] = useState<Record<string, PharmacyPromptCard[]> | null>(null)
  // 动态分类 Tab 列表（来源：purchase_home 提示词中出现的所有分类）
  const [pharmacyCategoryOrder, setPharmacyCategoryOrder] = useState<string[]>([])

  // 快捷输入当前 Tab 与采购模式保持一致
  useEffect(() => {
    setQuickTab(mode)
  }, [mode])

  // 资质面板（顶部右侧按钮触发）
  const [showQualPanel, setShowQualPanel] = useState(false)
  // 右侧工具栏（工作日志/产出物/历史对话）
  const [showSidePanel, setShowSidePanel] = useState(false)
  const [toolsActiveTab, setToolsActiveTab] = useState<'logs' | 'outputs' | 'history'>('logs')

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }, [])

  // 语音录制 + 后端 STT 转写
  const { listening, transcribing, toggleListening } = useVoiceRecorder({
    onTranscript: (text) => {
      setInput(text)
      taRef.current?.focus()
    },
    onError: (msg) => showToast(msg, 'error'),
  })

  const hasMessages = activeConversation.messages.length > 0

  /** 追加消息到当前激活会话 */
  const appendMessageToActive = useCallback((msg: PharmacyMessage) => {
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
  }, [activeConversationId])

  /** 新建会话 */
  const createConversation = useCallback(() => {
    if (activeConversation.title === '新对话' && activeConversation.messages.length === 0) {
      showToast('已在新对话页')
      return
    }
    const newConv: PharmacyConversation = {
      id: crypto.randomUUID(),
      title: '新对话',
      messages: [],
      sessionId: '',
      updatedAt: Date.now()
    }
    setConversations((prev) => [newConv, ...prev])
    setActiveConversationId(newConv.id)
  }, [activeConversation, showToast])

  /** 切换会话 */
  const switchConversation = useCallback((id: string) => {
    setActiveConversationId(id)
  }, [])

  /** 删除会话 */
  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === id)
      const filtered = prev.filter((c) => c.id !== id)
      if (filtered.length === 0) {
        const newConv: PharmacyConversation = {
          id: crypto.randomUUID(),
          title: '新对话',
          messages: [],
          sessionId: '',
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
  }, [activeConversationId])

  /** 打开右侧历史对话面板 */
  const openHistory = useCallback(() => {
    setToolsActiveTab('history')
    setShowSidePanel(true)
  }, [])

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
    setAtBottom(nearBottom)
  }

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setAtBottom(true)
  }

  useEffect(() => {
    if (atBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activeConversation.messages, atBottom])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.max(60, Math.min(ta.scrollHeight, 200)) + 'px'
  }, [input])

  // 图片粘贴支持
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const newImages: string[] = []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const reader = new FileReader()
            reader.onload = () => {
              newImages.push(reader.result as string)
              setImages(prev => [...prev, ...newImages])
            }
            reader.readAsDataURL(file)
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        setImages(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSend = async (text?: string, overrideMode?: PharmacyMode) => {
    const content = (text ?? input).trim()
    if (!content && images.length === 0) return
    if (sending) return

    const sendMode = overrideMode ?? mode
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

    const userMsg: PharmacyMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content || '[图片消息]',
      time: now,
      mode: sendMode,
      images: images.length > 0 ? images : undefined,
    }
    appendMessageToActive(userMsg)
    setInput('')
    setImages([])
    setSending(true)

    try {
      const resp = await sendPharmacyChat(content, activeConversation.sessionId || undefined, sendMode)
      if (resp) {
        if (resp.session_id) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId ? { ...c, sessionId: resp.session_id ?? c.sessionId } : c
            )
          )
        }

        const replyMsg: PharmacyMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: resp.reply || '抱歉，采购智能体暂时无法响应。',
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          dispatchAgent: { id: 'purchase', name: '采购兔', intent: '药房采购' },
          products: resp.products || [],
          solutions: resp.solutions || null,
          mode: sendMode,
          creditCost: 0,
        }
        appendMessageToActive(replyMsg)
      } else {
        appendMessageToActive({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '抱歉，采购服务暂时不可用，请稍后重试。',
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          dispatchAgent: { id: 'purchase', name: '采购兔', intent: '药房采购' },
          mode: sendMode,
        })
      }
    } catch {
      appendMessageToActive({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '网络错误，请检查网络连接后重试。',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        dispatchAgent: { id: 'purchase', name: '采购兔', intent: '药房采购' },
      })
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 下单成功后打开订单详情
  const handleOrderSuccess = useCallback((orderId: number, orderNumber: string) => {
    showToast(`订单创建成功！订单号：${orderNumber}`, 'success')
    setSelectedOrderId(orderId)
  }, [showToast])

  return (
    <div className="flex h-full flex-col">
      {/* Toast */}
      {toast.show && (
        <div className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
          'bg-gray-800 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          {hasMessages && (
            <div className="flex h-14 shrink-0 items-center justify-between px-6">
              <div className="flex-1" />
              <h2 className="flex-none text-lg font-semibold text-black">与采购兔的对话</h2>
              <div className="flex flex-1 items-center justify-end gap-2">
                <button
                  onClick={() => setShowOrderPanel(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                >
                  <ClipboardList className="h-4 w-4" />
                  订单
                </button>
                <button
                  onClick={() => setShowCollectivePanel(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                >
                  <Package className="h-4 w-4" />
                  集采
                </button>
                <button
                  onClick={() => setShowQualPanel(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                  title="查看和管理我的企业资质"
                >
                  <FileCheck className="h-4 w-4" />
                  资质
                </button>
                <button
                  onClick={() => setShowSidePanel(v => !v)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-bg-hover hover:text-text-primary ${
                    showSidePanel ? 'bg-bg-hover text-text-primary' : 'text-text-secondary'
                  }`}
                  title="打开右侧工具栏"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          <div ref={scrollRef} onScroll={checkScroll} className="relative flex-1 min-w-0 overflow-y-auto">

          {activeConversation.messages.length === 0 ? (
            <div className="flex h-full flex-col overflow-y-auto">
              {/* 顶部工具栏：与 WelcomeScreen 同一高度，右侧放采购相关按钮 */}
              <div className="flex h-14 shrink-0 items-center justify-end gap-2 px-6">
                <button
                  onClick={() => setShowOrderPanel(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                >
                  <ClipboardList className="h-4 w-4" />
                  订单
                </button>
                <button
                  onClick={() => setShowCollectivePanel(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                >
                  <Package className="h-4 w-4" />
                  集采
                </button>
                <button
                  onClick={() => setShowQualPanel(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                  title="查看和管理我的企业资质"
                >
                  <FileCheck className="h-4 w-4" />
                  资质
                </button>
                <button
                  onClick={() => setShowSidePanel(v => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                  title="打开右侧工具栏"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>

              {/* 主内容区：与 WelcomeScreen 同宽（max-w-3xl） */}
              <div className="flex-1 px-6 pb-6 pt-8">
                <div className="mx-auto max-w-3xl">
                  {/* 头部：公仔 + 问候（与 WelcomeScreen 一致） */}
                  <div className="mb-8 flex items-end gap-4">
                    <div className="h-20 w-20 shrink-0">
                      <RabbitHead agentId="purchase" className="h-full w-full" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                        老板好！我是您的数字员工 <span className="text-text-primary">采购兔</span>
                      </h1>
                      <p className="mt-1 max-w-2xl whitespace-nowrap text-sm leading-relaxed text-text-secondary">
                        通过语音、图片、表格、API向我发采购计划，我为您出采购方案：送货最快/价格最优/综合建议
                      </p>
                    </div>
                  </div>

                  {/* 提示词分类 Tab（动态生成） */}
                  <div className="mb-6 flex items-center gap-6 overflow-x-auto border-b border-border-subtle">
                    {pharmacyCategoryOrder.map((cat) => {
                      const isActive = activePharmTab === cat
                      return (
                        <button
                          key={cat}
                          onClick={() => setActivePharmTab(cat)}
                          className={`relative shrink-0 pb-3 text-sm font-medium transition-colors ${
                            isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
                          }`}
                        >
                          {PURCHASE_CATEGORY_LABEL_MAP[cat] || cat}
                          {isActive && (
                            <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-text-primary" />
                          )}
                        </button>
                      )
                    })}
                    {pharmacyCategoryOrder.length === 0 && (
                      <span className="pb-3 text-sm text-text-muted">暂无提示词分类，请在管理后台配置</span>
                    )}
                  </div>

                  {/* 卡片网格（默认 3 列） */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {(() => {
                      const sourceCards =
                        pharmacyBackendCards !== null && activePharmTab in pharmacyBackendCards
                          ? pharmacyBackendCards[activePharmTab]
                          : []
                      if (sourceCards.length === 0) {
                        return <div className="col-span-full py-12 text-center text-sm text-text-muted">当前分类暂无可用提示词</div>
                      }
                      return sourceCards.map((card) => {
                        const Icon = card.icon
                        return (
                          <button
                            key={`${activePharmTab}-${card.title}`}
                            onClick={() => {
                              setMode(card.mode)
                              handleSend(card.prompt, card.mode)
                            }}
                            className="group relative flex h-[120px] flex-col rounded-2xl border border-border-subtle bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-default hover:shadow-md"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
                                <Icon className={`h-[18px] w-[18px] ${card.iconColor}`} strokeWidth={2} />
                              </div>
                              <h3 className="flex-1 truncate text-sm font-semibold text-text-primary">{card.title}</h3>
                              <ArrowUpRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">{card.desc}</p>
                          </button>
                        )
                      })
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-6">
              <div className="space-y-6">
                {activeConversation.messages.map((m) => (
                  <PharmacyMessageBubble key={m.id} msg={m} onOrderSuccess={handleOrderSuccess} showToast={showToast} onSelectProduct={setSelectedProduct} />
                ))}
                {sending && (
                  <div className="flex items-center gap-3 px-1.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated p-0.5">
                      <RabbitHead agentId="purchase" className="h-full w-full" />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      采购兔正在为您查找...
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 输入框容器：与新建对话 InputBar 同宽同高 */}
        <div className="bg-transparent px-6 pb-6 pt-2">
        <div className="mx-auto max-w-3xl">
          {/* 快捷输入下拉弹框：快采 / 集采 / 找品 三库 */}
          {showQuickDropdown && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowQuickDropdown(false)}
              />
              <div className="relative z-30 mb-3 w-72 overflow-hidden rounded-xl border border-border-subtle bg-white shadow-xl">
                {/* 三库 Tab */}
                <div className="flex border-b border-border-subtle">
                  {(Object.keys(QUICK_TAB_CONFIG) as PharmacyMode[]).map((m) => {
                    const active = quickTab === m
                    return (
                      <button
                        key={m}
                        onClick={() => setQuickTab(m)}
                        className={`relative flex-1 py-2.5 text-xs font-medium transition-colors ${
                          active ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {QUICK_TAB_CONFIG[m].label}
                        {active && (
                          <span className="absolute bottom-0 left-1/2 inline-block h-0.5 w-10 -translate-x-1/2 rounded-full bg-accent" />
                        )}
                      </button>
                    )
                  })}
                </div>
                {/* 当前库提示词列表 */}
                <div className="max-h-72 overflow-y-auto">
                  {purchasePrompts[quickTab].length > 0 ? (
                    purchasePrompts[quickTab].map((q) => (
                      <button
                        key={q.id}
                        onClick={() => {
                          setInput(q.content)
                          setShowQuickDropdown(false)
                          taRef.current?.focus()
                        }}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs hover:bg-bg-hover"
                      >
                        <span className="font-medium text-text-primary">{q.title || q.content.slice(0, 16)}</span>
                        <span className="line-clamp-2 text-[11px] text-text-muted">{q.content}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-xs text-text-muted text-center">
                      {QUICK_TAB_CONFIG[quickTab].empty}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 采购模式切换：放在输入框线外左上角 */}
          <div className="relative mb-2 flex items-center gap-2">
            {(Object.keys(MODE_CONFIG) as PharmacyMode[]).map((m) => {
              const cfg = MODE_CONFIG[m]
              const Icon = cfg.icon
              const isActive = mode === m
              return (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m)
                    if (m === 'collective') setActivePharmTab('collective')
                    else if (m === 'search') setActivePharmTab('controlled')
                    else setActivePharmTab('quick')
                  }}
                  className={`flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-bg-hover text-text-secondary hover:bg-bg-elevated'
                  }`}
                  title={cfg.desc}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                </button>
              )
            })}
            {/* 用户上滑后显示「回到最新」按钮，居中于输入框上方 */}
            {hasMessages && !atBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute left-1/2 top-1/2 flex h-9 -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-border-subtle bg-bg-surface px-3 text-xs font-medium text-text-primary shadow-sm transition-colors hover:bg-bg-hover"
                title="回到最新消息"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                回到最新
              </button>
            )}
          </div>

          {/* 输入框容器：与新建对话 InputBar 同宽同高 */}
          <div className="rounded-2xl border border-border-subtle bg-white p-4 shadow-sm transition-shadow focus-within:border-border-default focus-within:shadow-md">
            {/* 图片预览区 */}
            {images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative h-16 w-16 shrink-0">
                    <img src={img} alt={`上传图片${i + 1}`} className="h-full w-full rounded-lg object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 文本输入区：高度与 InputBar 一致（min-h-[60px]） */}
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listening ? '正在聆听...' : transcribing ? '语音识别中...' : '请输入任务，交给我来帮你完成'}
              className="block min-h-[60px] w-full resize-none overflow-hidden bg-transparent px-1 py-1 text-base leading-6 text-text-primary placeholder:text-text-muted focus:outline-none"
            />

            {/* 底部工具栏：快捷输入 + 选择文件 + 模式切换 + 语音/发送 */}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* 快捷输入 */}
                <button
                  onClick={() => setShowQuickDropdown(v => !v)}
                  className={`flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-colors ${
                    showQuickDropdown
                      ? 'bg-accent text-white'
                      : 'bg-bg-hover text-text-secondary hover:bg-bg-elevated'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  快捷输入
                  <ChevronUp className={`h-3 w-3 transition-transform ${showQuickDropdown ? '' : 'rotate-180'}`} />
                </button>

                {/* 选择文件 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-9 items-center gap-1 rounded-lg bg-bg-hover px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-elevated"
                  title="上传图片或表格"
                >
                  <Plus className="h-3.5 w-3.5" />
                  选择文件
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {/* 新建对话 */}
                <button
                  onClick={createConversation}
                  className="flex h-9 items-center gap-1 rounded-lg bg-bg-hover px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-elevated"
                  title="新建对话"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新建对话
                </button>

                {/* 历史对话 */}
                <button
                  onClick={openHistory}
                  className="flex h-9 items-center gap-1 rounded-lg bg-bg-hover px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-elevated"
                  title="打开历史对话"
                >
                  <History className="h-3.5 w-3.5" />
                  历史对话
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* 语音输入按钮 */}
                <button
                  onClick={toggleListening}
                  disabled={transcribing}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                    listening
                      ? 'bg-red-50 text-red-500 animate-pulse'
                      : transcribing
                      ? 'bg-blue-50 text-blue-500'
                      : 'text-text-muted hover:bg-bg-hover hover:text-accent'
                  }`}
                  title={transcribing ? '识别中...' : listening ? '停止录音' : '语音输入'}
                >
                  {transcribing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </button>

                {/* 发送按钮 */}
                <button
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && images.length === 0) || sending}
                  className="flex h-9 items-center justify-center rounded-lg bg-black px-5 text-base font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                  title="发送"
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Go'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>

    </div>

      {/* 右侧工具栏：采购兔工作日志 / 产出物 / 历史对话（Portal 到 App 层级以贴顶对齐） */}
      {showSidePanel && (() => {
        const anchor = document.getElementById('pharmacy-tools-anchor')
        if (!anchor) return null
        return createPortal(
          <div className="h-full w-72 shrink-0 overflow-hidden bg-bg-elevated">
            <PurchaseToolsPanel
              conversation={activeConversation}
              conversations={conversations}
              onNew={createConversation}
              onSwitch={switchConversation}
              onDelete={deleteConversation}
              onClose={() => setShowSidePanel(false)}
              activeTab={toolsActiveTab}
              onActiveTabChange={setToolsActiveTab}
              onJumpToMessage={(msgId) => {
                const el = document.getElementById(`purchase-msg-${msgId}`)
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }}
            />
          </div>,
          anchor
        )
      })()}

      {/* 我的订单面板 */}
      {showOrderPanel && (
        <OrderPanel
          onClose={() => setShowOrderPanel(false)}
          onSelectOrder={(id) => {
            setShowOrderPanel(false)
            setSelectedOrderId(id)
          }}
        />
      )}

      {/* 订单详情弹窗 */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          showToast={showToast}
        />
      )}

      {/* 产品详情弹窗 */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onOrderSuccess={(orderId, orderNumber) => {
            setSelectedProduct(null)
            handleOrderSuccess(orderId, orderNumber)
          }}
          showToast={showToast}
        />
      )}

      {/* 集采面板 */}
      {showCollectivePanel && (
        <CollectivePurchasePanel
          onClose={() => setShowCollectivePanel(false)}
          onSelectOrder={(id) => {
            setShowCollectivePanel(false)
            setSelectedOrderId(id)
          }}
        />
      )}

      {/* 资质面板（简版：在订单的资质交换尚未发起时使用） */}
      {showQualPanel && <TenantQualificationPanel onClose={() => setShowQualPanel(false)} />}
    </div>
  )
}

// ========== 租户资质面板 ==========
function TenantQualificationPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'qualifications' | 'firstOps'>('qualifications')
  const qualRef = useRef<QualificationsTabHandle>(null)
  const firstOpsRef = useRef<FirstOpsTabHandle>(null)

  const handleRefresh = () => {
    if (activeTab === 'qualifications') qualRef.current?.refresh()
    else firstOpsRef.current?.refresh()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('qualifications')}
              className={`flex items-center gap-1.5 border-b-2 px-1 py-2 text-sm font-medium transition-all ${
                activeTab === 'qualifications'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <FileText size={16} />
              企业资质
            </button>
            <button
              onClick={() => setActiveTab('firstOps')}
              className={`flex items-center gap-1.5 border-b-2 px-1 py-2 text-sm font-medium transition-all ${
                activeTab === 'firstOps'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <FileCheck size={16} />
              首营交换记录
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="icon-btn flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
            >
              <RefreshCw size={14} /> 刷新
            </button>
            {activeTab === 'qualifications' && (
              <button
                onClick={() => qualRef.current?.openUpload()}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
              >
                <Upload size={16} /> 上传资质
              </button>
            )}
            <button
              onClick={onClose}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden px-5 py-4">
          <div className="h-[calc(90vh-200px)] overflow-y-auto">
            {activeTab === 'qualifications' ? <QualificationsTab ref={qualRef} /> : <FirstOpsTab ref={firstOpsRef} />}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 从助手回复中提取「深度思考」块 */
function extractReasoning(content: string): { reasoning: string[]; main: string } {
  const reasoningPattern = /\[[^\]]+\]\s*已分析您的请求[：:](?:(?!\[[^\]]+\]\s*已分析您的请求)[\s\S])*?基于当前数据，这是我的建议方案。/g
  const reasoning: string[] = []
  let main = content
    .replace(reasoningPattern, (match) => {
      reasoning.push(match.trim())
      return '\n\n'
    })
    .replace(/^(\s*\n)+|(\s*\n)+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
  return { reasoning, main }
}

/** 简易 Markdown 渲染 */
function renderMarkdown(content: string) {
  const lines = content.split('\n')
  return lines.map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />
    if (line.startsWith('### ')) return <h3 key={i} className="mt-2 mb-1 text-base font-semibold text-text-primary">{line.slice(4)}</h3>
    if (line.startsWith('## ')) return <h2 key={i} className="mt-2 mb-1 text-lg font-semibold text-text-primary">{line.slice(3)}</h2>
    if (line.trim() === '---') return <hr key={i} className="my-2 border-border-subtle" />
    if (line.match(/^\d+\.\s/)) return <div key={i} className="ml-4 text-base leading-relaxed text-text-primary">{line}</div>
    if (line.startsWith('- ') || line.startsWith('• ')) return <div key={i} className="ml-4 text-base leading-relaxed text-text-primary">• {line.slice(2)}</div>
    if (line.startsWith('```')) return <div key={i} className="my-1 rounded bg-black/10 px-3 py-1 font-mono text-sm text-text-secondary">{line.replace(/```/g, '')}</div>
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
    return (
      <p key={i} className="text-base leading-relaxed text-text-primary">
        {parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
          if (part.startsWith('`') && part.endsWith('`')) return <code key={j} className="rounded bg-black/10 px-1 py-0.5 font-mono text-xs">{part.slice(1, -1)}</code>
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={j}>{part.slice(1, -1)}</em>
          return <span key={j}>{part}</span>
        })}
      </p>
    )
  })
}

function PharmacyMessageBubble({ msg, onOrderSuccess, showToast, onSelectProduct }: {
  msg: PharmacyMessage
  onOrderSuccess: (orderId: number, orderNumber: string) => void
  showToast: (msg: string, type?: ToastState['type']) => void
  onSelectProduct: (product: PharmacyProduct) => void
}) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)
  const { reasoning, main } = extractReasoning(msg.content)
  const hasReasoning = reasoning.length > 0
  const [reasoningExpanded, setReasoningExpanded] = useState(!main)

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (isUser) {
    return (
      <div id={`purchase-msg-${msg.id}`} className="flex flex-row-reverse items-start animate-slide-up px-1.5 py-1">
        <div className="flex max-w-[80%] flex-col items-end">
          {msg.mode && (
            <div className="mb-1 flex items-center gap-1">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                {MODE_CONFIG[msg.mode].label}
              </span>
            </div>
          )}
          {/* 图片展示 */}
          {msg.images && msg.images.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 justify-end">
              {msg.images.map((img, i) => (
                <img key={i} src={img} alt={`图片${i}`} className="h-24 w-24 rounded-lg object-cover" />
              ))}
            </div>
          )}
          {msg.content !== '[图片消息]' && (
            <div className="rounded-2xl rounded-br-md bg-emerald-50 px-4 py-2.5 text-base leading-relaxed text-text-primary">
              {msg.content}
            </div>
          )}
          <div className="mt-1 flex items-center gap-1 self-end px-1">
            <button
              onClick={handleCopy}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
              title="复制"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
            <span className="ml-1 text-[11px] text-text-muted">{msg.time}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div id={`purchase-msg-${msg.id}`} className="flex items-start gap-3 animate-slide-up px-1.5 py-1">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated p-0.5">
        <RabbitHead agentId="purchase" className="h-full w-full" />
      </div>
      <div className="flex max-w-[85%] flex-col items-start">
        <div className="text-xs text-text-muted mb-1">
          {msg.dispatchAgent?.name ?? '采购兔'}
        </div>
        <div className="rounded-2xl rounded-bl-md bg-white px-4 py-2.5">
          {hasReasoning && (
            <div className="mb-3 rounded-lg border border-border-subtle bg-bg-surface/60">
              <button
                onClick={() => setReasoningExpanded((v) => !v)}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary"
              >
                {reasoningExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <Brain className="h-3 w-3 text-accent/70" />
                <span>深度思考</span>
                <span className="text-text-muted">{reasoning.length} 步</span>
              </button>
              {reasoningExpanded && (
                <div className="max-h-40 overflow-y-auto px-3 pb-2.5">
                  <div className="space-y-2">
                    {reasoning.map((block, idx) => (
                      <div
                        key={idx}
                        className="rounded bg-bg-hover px-2.5 py-1.5 text-[11px] leading-relaxed text-text-secondary"
                      >
                        {block}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {main ? renderMarkdown(main) : hasReasoning ? null : renderMarkdown(msg.content)}
        </div>

        {/* 快采三方案卡片 */}
        {msg.solutions && <SolutionCards solutions={msg.solutions} onOrderSuccess={onOrderSuccess} showToast={showToast} />}

        {/* 产品卡片 */}
        {msg.products && msg.products.length > 0 && !msg.solutions && (
          <div className="mt-2 w-full space-y-2">
            <ProductListHeader products={msg.products} />
            {msg.products.map((p, i) => (
              <ProductCard key={i} product={p} onOrderSuccess={onOrderSuccess} showToast={showToast} onSelectProduct={onSelectProduct} />
            ))}
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-1 px-1">
          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
            title="复制"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
              免扣积分
            </span>
            <span className="text-[11px] text-text-muted">{msg.time}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ========== 快采三方案卡片 ==========

const STRATEGY_CONFIG = {
  fastest: { label: '送货最快', icon: Clock, color: 'blue', desc: '优先配送时效' },
  cheapest: { label: '价格最低', icon: TrendingDown, color: 'red', desc: '优先采购成本' },
  comprehensive: { label: '综合建议', icon: Scale, color: 'purple', desc: '价格+时效+库存+资质' },
} as const

function SolutionCards({ solutions, onOrderSuccess, showToast }: {
  solutions: QuickPurchaseSolutions
  onOrderSuccess: (orderId: number, orderNumber: string) => void
  showToast: (msg: string, type?: ToastState['type']) => void
}) {
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>('comprehensive')

  const cards: { key: string; solution: PurchaseSolution | null }[] = [
    { key: 'fastest', solution: solutions.fastest },
    { key: 'cheapest', solution: solutions.cheapest },
    { key: 'comprehensive', solution: solutions.comprehensive },
  ]

  return (
    <div className="mt-3 w-full space-y-2">
      <div className="text-xs font-medium text-text-muted">
        为您找到 {solutions.total_products_found} 个产品，生成 {cards.filter(c => c.solution).length} 套采购方案：
      </div>
      {cards.map(({ key, solution }) => {
        if (!solution) return null
        const cfg = STRATEGY_CONFIG[key as keyof typeof STRATEGY_CONFIG]
        const Icon = cfg.icon
        const isExpanded = expandedStrategy === key
        const colorClass = {
          blue: 'border-blue-200 bg-blue-50/50 text-blue-600',
          red: 'border-red-200 bg-red-50/50 text-red-600',
          purple: 'border-purple-200 bg-purple-50/50 text-purple-600',
        }[cfg.color]

        return (
          <div key={key} className={`rounded-xl border ${colorClass} overflow-hidden`}>
            {/* 方案头部 */}
            <button
              onClick={() => setExpandedStrategy(isExpanded ? null : key)}
              className="flex w-full items-center gap-3 p-3 text-left"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorClass}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{cfg.label}</span>
                  <span className="text-[10px] text-text-muted">{cfg.desc}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-text-secondary">
                  <span>总价 ¥{solution.total_price}</span>
                  <span>均配 {solution.avg_delivery_hours}h</span>
                  <span>{solution.supplier_count} 家供应商</span>
                </div>
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
            </button>

            {/* 方案详情 */}
            {isExpanded && (
              <div className="space-y-1.5 px-3 pb-3">
                {(solution.items || []).map((item, i) => (
                  <SolutionItemCard key={i} item={item} onOrderSuccess={onOrderSuccess} showToast={showToast} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SolutionItemCard({ item, onOrderSuccess, showToast }: {
  item: SolutionItem
  onOrderSuccess: (orderId: number, orderNumber: string) => void
  showToast: (msg: string, type?: ToastState['type']) => void
}) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className="w-full rounded-lg border border-border-subtle bg-white p-2.5 text-left transition-colors hover:border-accent/30 hover:bg-accent-soft/30"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary truncate">{item.product_name}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-text-secondary">
              {item.product_spec && <span>{item.product_spec}</span>}
              {item.product_manufacturer && <span>{item.product_manufacturer}</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
              <span className="flex items-center gap-0.5 text-blue-500">
                <Truck className="h-3 w-3" />
                {item.delivery_hours}h
              </span>
              <span className="flex items-center gap-0.5 text-text-muted">
                <Store className="h-3 w-3" />
                {item.supplier_name}
              </span>
              <span className="flex items-center gap-0.5 text-emerald-500">
                <Shield className="h-3 w-3" />
                库存 {item.stock_quantity}{item.product_unit || '件'}
              </span>
              {item.settlement_method && (
                <span className="flex items-center gap-0.5 text-purple-500">
                  <Wallet className="h-3 w-3" />
                  {item.settlement_method}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-sm font-bold text-red-500">¥{item.product_price}</span>
            <span className="text-[10px] text-text-muted">/{item.product_unit || '件'}</span>
            <span className="text-[10px] text-text-muted">x{item.quantity}</span>
          </div>
        </div>
      </button>

      {showDetail && (
        <SolutionItemDetailModal
          item={item}
          onClose={() => setShowDetail(false)}
          onOrderSuccess={onOrderSuccess}
          showToast={showToast}
        />
      )}
    </>
  )
}

// ========== 快采方案产品明细+下单弹窗 ==========

function SolutionItemDetailModal({ item, onClose, onOrderSuccess, showToast }: {
  item: SolutionItem
  onClose: () => void
  onOrderSuccess: (orderId: number, orderNumber: string) => void
  showToast: (msg: string, type?: ToastState['type']) => void
}) {
  const [qty, setQty] = useState(item.quantity || 1)
  const [ordering, setOrdering] = useState(false)
  const [orderResult, setOrderResult] = useState<{ orderId: number; orderNumber: string; totalAmount: string } | null>(null)
  const [payMethod, setPayMethod] = useState<string>('wechat')
  const [linkCopied, setLinkCopied] = useState(false)

  const unitPrice = parseFloat(item.product_price) || 0
  const totalPrice = (unitPrice * qty).toFixed(2)

  const handleSubmitOrder = async () => {
    setOrdering(true)
    const result = await handleQuickOrder(item.product_id, item.supplier_id, qty, onOrderSuccess, showToast, payMethod)
    setOrdering(false)
    if (result) {
      setOrderResult(result)
    }
  }

  const handleCopyLink = () => {
    const payUrl = `${window.location.origin}/pay?order=${orderResult?.orderNumber || ''}&method=${payMethod}`
    navigator.clipboard.writeText(payUrl).then(() => {
      setLinkCopied(true)
      showToast('支付链接已复制', 'success')
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  const handleForward = (target: string) => {
    showToast(`已转发支付链接给${target}`, 'success')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h3 className="text-lg font-semibold text-text-primary">
            {orderResult ? '订单已创建' : '产品明细'}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          {!orderResult ? (
            <div className="space-y-4">
              {/* 产品信息 */}
              <div className="rounded-xl border border-border-subtle p-4">
                <div className="text-base font-semibold text-text-primary">{item.product_name}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary">
                  {item.product_spec && <span>规格：{item.product_spec}</span>}
                  {item.product_manufacturer && <span>厂家：{item.product_manufacturer}</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {/* 供应商名称 */}
                  <div className="rounded-lg bg-bg-hover p-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-text-muted">
                      <Store className="h-3 w-3" /> 供应商
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-text-primary">{item.supplier_name}</div>
                  </div>
                  {/* 配送时效 */}
                  <div className="rounded-lg bg-bg-hover p-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-text-muted">
                      <Truck className="h-3 w-3" /> 配送时效
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-blue-500">{item.delivery_hours} 小时</div>
                  </div>
                  {/* 产品价格 */}
                  <div className="rounded-lg bg-bg-hover p-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-text-muted">
                      <DollarSign className="h-3 w-3" /> 产品价格
                    </div>
                    <div className="mt-0.5 text-sm font-bold text-red-500">¥{item.product_price}<span className="text-[10px] font-normal text-text-muted">/{item.product_unit || '件'}</span></div>
                  </div>
                  {/* 结算方式 */}
                  <div className="rounded-lg bg-bg-hover p-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-text-muted">
                      <Wallet className="h-3 w-3" /> 结算方式
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-purple-500">{item.settlement_method || '在线支付'}</div>
                  </div>
                </div>
                {/* 库存 & 起订 */}
                <div className="mt-2 flex items-center gap-4 text-[11px] text-text-muted">
                  <span className="flex items-center gap-0.5">
                    <Shield className="h-3 w-3 text-emerald-500" />
                    库存 {item.stock_quantity}{item.product_unit || '件'}
                  </span>
                  {parseFloat(item.min_order_amount) > 0 && (
                    <span>最低起订：¥{item.min_order_amount}</span>
                  )}
                </div>
              </div>

              {/* 数量修改 */}
              <div className="rounded-xl border border-border-subtle p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-text-primary">采购数量</div>
                    <div className="text-[11px] text-text-muted">最小起订 {item.quantity} {item.product_unit || '件'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-text-muted transition-colors hover:bg-bg-hover"
                    >-</button>
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 rounded-lg border border-border-subtle px-3 py-1.5 text-center text-sm"
                      min={1}
                    />
                    <button
                      onClick={() => setQty(qty + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-text-muted transition-colors hover:bg-bg-hover"
                    >+</button>
                  </div>
                </div>
                {/* 合计 */}
                <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
                  <span className="text-xs text-text-muted">合计金额</span>
                  <span className="text-xl font-bold text-red-500">¥{totalPrice}</span>
                </div>
              </div>

              {/* 支付方式预选 */}
              <div>
                <div className="mb-2 text-sm font-semibold text-text-primary">选择支付方式</div>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const isSelected = payMethod === m.id
                    const cfg = {
                      green: isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-border-subtle bg-white text-text-secondary',
                      blue: isSelected ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-border-subtle bg-white text-text-secondary',
                      orange: isSelected ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-border-subtle bg-white text-text-secondary',
                    }[m.color]
                    return (
                      <button
                        key={m.id}
                        onClick={() => setPayMethod(m.id)}
                        className={`rounded-xl border-2 p-3 text-center transition-all ${cfg}`}
                      >
                        <div className="text-xs font-semibold">{m.label}</div>
                        <div className="mt-0.5 text-[10px] opacity-70">{m.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* 订单创建成功 — 支付/转发面板 */
            <div className="space-y-4">
              {/* 成功提示 */}
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-blue-50 p-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-6 w-6 text-emerald-500" />
                </div>
                <div className="mt-2 text-sm font-medium text-text-primary">订单创建成功</div>
                <div className="mt-1 font-mono text-xs text-text-muted">{orderResult.orderNumber}</div>
                <div className="mt-2 text-2xl font-bold text-red-500">¥{orderResult.totalAmount}</div>
              </div>

              {/* 支付方式 */}
              <div>
                <div className="mb-2 text-sm font-semibold text-text-primary">选择支付方式</div>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((m) => {
                    const isSelected = payMethod === m.id
                    const cfg = {
                      green: { bg: 'bg-emerald-50', text: 'text-emerald-600', active: 'border-emerald-500 bg-emerald-50' },
                      blue: { bg: 'bg-blue-50', text: 'text-blue-600', active: 'border-blue-500 bg-blue-50' },
                      orange: { bg: 'bg-orange-50', text: 'text-orange-600', active: 'border-orange-500 bg-orange-50' },
                    }[m.color]
                    return (
                      <button
                        key={m.id}
                        onClick={() => setPayMethod(m.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                          isSelected ? cfg.active : 'border-border-subtle bg-white hover:bg-bg-hover'
                        }`}
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cfg.bg}`}>
                          {m.id === 'wechat' && (
                            <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9.5 4C5.36 4 2 6.69 2 10c0 1.89 1.08 3.56 2.78 4.66L4 17l2.83-1.48c.84.23 1.74.36 2.67.36.26 0 .51-.01.76-.03C9.9 15.27 9.75 14.66 9.75 14c0-2.88 2.77-5.25 6.25-5.25.26 0 .51.02.76.05C16.05 5.7 13.05 4 9.5 4zM7 8.5c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm5 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm3 2.25c-3.17 0-5.75 2.13-5.75 4.75S11.83 20 15 20c.67 0 1.33-.1 1.95-.29L19 21l-.6-1.86C19.7 18.2 20.75 16.8 20.75 15.25c0-2.62-2.58-4.5-5.75-4.5zm-2 3c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75zm4 0c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75z"/>
                            </svg>
                          )}
                          {m.id === 'alipay' && (
                            <svg className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M2 12c0-5.52 4.48-10 10-10s10 4.48 10 10c0 1.46-.32 2.85-.89 4.09-.65-.23-1.53-.55-2.55-.89.32-.64.49-1.36.49-2.12 0-2.76-2.24-5-5-5s-5 2.24-5 5c0 2.76 2.24 5 5 5 .46 0 .91-.06 1.33-.19-.34.86-.95 1.59-1.84 2.17 3.56-.24 6.92-2.08 8.21-5.36C21.34 18.2 22 15.18 22 12c0-5.52-4.48-10-10-10S2 6.48 2 12zm5.5-1c0-2.49 2.01-4.5 4.5-4.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5S7.5 13.49 7.5 11zm3 0c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5z"/>
                            </svg>
                          )}
                          {m.id === 'bank_transfer' && (
                            <Wallet className={`h-5 w-5 ${cfg.text}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-text-primary">{m.label}</div>
                          <div className="text-[11px] text-text-muted">{m.desc}</div>
                        </div>
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                          isSelected ? `${cfg.active.split(' ')[0]} ${cfg.bg}` : 'border-border-subtle'
                        }`}>
                          {isSelected && <Check className={`h-3 w-3 ${cfg.text}`} />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 复制支付链接 */}
              <button
                onClick={handleCopyLink}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border-subtle py-3 text-sm font-medium text-text-primary transition-colors hover:border-accent/30 hover:bg-accent-soft/30"
              >
                {linkCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {linkCopied ? '已复制支付链接' : '复制支付链接'}
              </button>

              {/* 转发 */}
              <div>
                <div className="mb-2 text-xs font-medium text-text-muted">转发支付链接</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleForward('上级领导')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    转发给上级领导
                  </button>
                  <button
                    onClick={() => handleForward('财务')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                  >
                    <Wallet className="h-4 w-4" />
                    转发给财务
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="border-t border-border-subtle px-5 py-3">
          {!orderResult ? (
            <button
              onClick={handleSubmitOrder}
              disabled={ordering}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {ordering ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              提交订单 · ¥{totalPrice}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-bg-hover py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  if (orderResult.orderId) {
                    onClose()
                  }
                }}
                className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                查看订单
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ========== 快采一键下单 ==========

async function handleQuickOrder(
  productId: number,
  _supplierId: number,
  quantity: number,
  onOrderSuccess: (orderId: number, orderNumber: string) => void,
  showToast: (msg: string, type?: ToastState['type']) => void,
  paymentMethod?: string,
): Promise<{ orderId: number; orderNumber: string; totalAmount: string } | null> {
  try {
    const client = getApiClient()
    const tenantId = (client as any).tenantId || localStorage.getItem('yesgo_tenant_id') || '1'
    const resp = await client.pdb.quickOrder({
      tenant_id: String(tenantId),
      product_id: productId,
      quantity,
      payment_method: paymentMethod || 'wechat',
    })
    if (resp.code === 0 && resp.data) {
      const orderData = resp.data as { id?: number; order?: { id?: number; order_number?: string; total_amount?: string } }
      const orderId = orderData.id || orderData.order?.id || 0
      const orderNumber = orderData.order?.order_number || '未知'
      const totalAmount = orderData.order?.total_amount || '0'
      showToast(`订单创建成功！总额 ¥${totalAmount}`, 'success')
      if (orderId) {
        onOrderSuccess(orderId, orderNumber)
      }
      return { orderId, orderNumber, totalAmount }
    } else {
      showToast(`下单失败：${resp.msg || '未知错误'}`, 'error')
    }
  } catch {
    showToast('下单失败，请稍后重试', 'error')
  }
  return null
}

function ProductCard({ product, onOrderSuccess, showToast, onSelectProduct }: {
  product: PharmacyProduct
  onOrderSuccess: (orderId: number, orderNumber: string) => void
  showToast: (msg: string, type?: ToastState['type']) => void
  onSelectProduct: (product: PharmacyProduct) => void
}) {
  const [qty, setQty] = useState(1)
  const [ordering, setOrdering] = useState(false)

  const handleOrder = async () => {
    setOrdering(true)
    await handleQuickOrder(product.id, product.supplier_id || 0, qty, onOrderSuccess, showToast)
    setOrdering(false)
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-white p-3 transition-colors hover:border-accent/30">
      <button
        onClick={() => onSelectProduct(product)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary truncate">{product.name}</span>
            {product.trade_name && <span className="text-xs text-text-muted">（{product.trade_name}）</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary">
            {product.specification && <span>规格：{product.specification}</span>}
            {product.manufacturer && <span>厂家：{product.manufacturer}</span>}
            {product.category && <span>分类：{product.category}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
            {product.approval_number && <span>批准文号：{product.approval_number}</span>}
            {product.stock_quantity != null && (
              <span className={product.stock_quantity > 100 ? 'text-emerald-500' : 'text-orange-500'}>
                库存：{product.stock_quantity}{product.unit || '件'}
              </span>
            )}
          </div>
          {product.match_type && (
            <div className="mt-1">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-500">
                {product.match_type}
                {product.score != null && ` · 匹配度 ${Math.round(product.score * 100)}%`}
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {product.price && <div className="text-sm font-bold text-red-500">¥{product.price}</div>}
          {product.supplier_name && (
            <div className="flex items-center gap-0.5 text-[10px] text-text-muted">
              <Store className="h-2.5 w-2.5" />
              {product.supplier_name}
            </div>
          )}
        </div>
      </button>
      {/* 下单操作 */}
      <div className="mt-2 flex items-center gap-2 border-t border-border-subtle pt-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-bg-hover"
          >-</button>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 rounded border border-border-subtle px-2 py-0.5 text-center text-xs"
            min={1}
          />
          <button
            onClick={() => setQty(qty + 1)}
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-bg-hover"
          >+</button>
        </div>
        <button
          onClick={handleOrder}
          disabled={ordering}
          className="ml-auto flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {ordering ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
          快采下单
        </button>
      </div>
    </div>
  )
}

// ========== 我的订单面板 ==========

const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
  submitted: { label: '已提交', color: 'bg-blue-100 text-blue-600' },
  qualified: { label: '资质通过', color: 'bg-cyan-100 text-cyan-600' },
  paying: { label: '待支付', color: 'bg-orange-100 text-orange-600' },
  paid: { label: '已支付', color: 'bg-emerald-100 text-emerald-600' },
  split: { label: '分账中', color: 'bg-purple-100 text-purple-600' },
  delivering: { label: '配送中', color: 'bg-indigo-100 text-indigo-600' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-600' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600' },
}

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  unpaid: { label: '未支付', color: 'text-orange-500' },
  partial: { label: '部分支付', color: 'text-yellow-500' },
  paid: { label: '已支付', color: 'text-emerald-500' },
  refunded: { label: '已退款', color: 'text-red-500' },
}

function OrderPanel({ onClose, onSelectOrder }: {
  onClose: () => void
  onSelectOrder: (id: number) => void
}) {
  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const client = getApiClient()
      const tenantId = (client as any).tenantId || localStorage.getItem('yesgo_tenant_id') || '1'
      const resp = await client.pdb.orders({ tenant_id: String(tenantId) })
      if (resp.code === 0 && resp.data) {
        const raw = resp.data
        const list: OrderListItem[] = Array.isArray(raw) ? raw : (raw as any)?.items || []
        setOrders(list)
      }
    } catch {
      // 静默
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl animate-slide-in-right">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-text-primary">我的订单</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadOrders}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover"
              title="刷新"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 筛选 */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-border-subtle px-5 py-2">
          <button
            onClick={() => setFilter('all')}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === 'all' ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:bg-bg-elevated'
            }`}
          >
            全部 ({orders.length})
          </button>
          {Object.entries(ORDER_STATUS_MAP).filter(([k]) => orders.some(o => o.status === k)).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === k ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              {v.label} ({orders.filter(o => o.status === k).length})
            </button>
          ))}
        </div>

        {/* 订单列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="mb-3 h-12 w-12 text-text-muted/30" />
              <p className="text-sm text-text-muted">暂无订单</p>
              <p className="mt-1 text-xs text-text-muted/70">快采下单后订单将显示在这里</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map((order) => {
                const statusCfg = ORDER_STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-600' }
                const payCfg = PAYMENT_STATUS_MAP[order.payment_status] || { label: order.payment_status, color: 'text-text-muted' }
                return (
                  <button
                    key={order.id}
                    onClick={() => onSelectOrder(order.id)}
                    className="w-full rounded-xl border border-border-subtle bg-white p-3 text-left transition-all hover:border-accent/50 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-text-secondary">{order.order_number}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Store className="h-3 w-3" />
                        {order.supplier_name || '供应商'}
                      </div>
                      <span className="text-sm font-bold text-red-500">¥{order.total_amount}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-muted">
                      <span className={`font-medium ${payCfg.color}`}>{payCfg.label}</span>
                      <span>{new Date(order.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ========== 订单详情弹窗 ==========

function OrderDetailModal({ orderId, onClose, showToast }: {
  orderId: number
  onClose: () => void
  showToast: (msg: string, type?: ToastState['type']) => void
}) {
  const [detail, setDetail] = useState<OrderFullStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showQualificationModal, setShowQualificationModal] = useState(false)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      const client = getApiClient()
      const resp = await client.pdb.orderFullStatus(orderId)
      if (resp.code === 0 && resp.data) {
        setDetail(resp.data as OrderFullStatus)
      }
    } catch {
      // 静默
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  // 执行支付 — 打开支付弹窗
  const handlePay = async () => {
    if (!detail) return
    setShowPaymentModal(true)
  }

  // 发起资质交换 — 打开资质表单弹窗
  const handleQualification = async () => {
    if (!detail) return
    setShowQualificationModal(true)
  }

  // 电子签章
  const handleESign = async () => {
    if (!detail) return
    setActionLoading(true)
    try {
      const client = getApiClient()
      const resp = await client.pdb.eSign(detail.id)
      if (resp.code === 0) {
        showToast('电子签章已发起', 'success')
        loadDetail()
      } else {
        showToast(`签章失败：${resp.msg}`, 'error')
      }
    } catch {
      showToast('操作失败，请稍后重试', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const statusCfg = detail ? (ORDER_STATUS_MAP[detail.status] || { label: detail.status, color: 'bg-gray-100 text-gray-600' }) : null
  const payCfg = detail ? (PAYMENT_STATUS_MAP[detail.payment_status] || { label: detail.payment_status, color: 'text-text-muted' }) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-semibold text-text-primary">订单详情</h3>
          </div>
          <button
            onClick={loadDetail}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover"
            title="刷新"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : !detail ? (
            <div className="py-12 text-center text-sm text-text-muted">订单不存在或加载失败</div>
          ) : (
            <div className="space-y-4">
              {/* 订单号 & 状态 */}
              <div className="rounded-xl bg-bg-hover p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">订单号</span>
                  <span className="font-mono text-sm text-text-primary">{detail.order_number}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-text-muted">订单状态</span>
                  {statusCfg && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-text-muted">支付状态</span>
                  {payCfg && <span className={`text-xs font-medium ${payCfg.color}`}>{payCfg.label}</span>}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-text-muted">下单时间</span>
                  <span className="text-xs text-text-secondary">{new Date(detail.created_at).toLocaleString('zh-CN')}</span>
                </div>
              </div>

              {/* 商品明细 */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                  <Package className="h-4 w-4" />
                  商品明细
                </div>
                <div className="space-y-2">
                  {(detail.items || []).map((item) => (
                    <div key={item.id} className="rounded-lg border border-border-subtle p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary">{item.product_name}</div>
                          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-text-secondary">
                            {item.product_spec && <span>{item.product_spec}</span>}
                            {item.product_manufacturer && <span>{item.product_manufacturer}</span>}
                          </div>
                          <div className="mt-1 text-xs text-text-muted">
                            ¥{item.unit_price} / {item.product_unit} x {item.quantity}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-red-500">¥{item.total_price}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                  <span className="text-xs text-text-muted">订单总额</span>
                  <span className="text-lg font-bold text-red-500">¥{detail.total_amount}</span>
                </div>
              </div>

              {/* 供应商信息 */}
              {detail.supplier_info && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <Store className="h-4 w-4" />
                    供应商信息
                  </div>
                  <div className="rounded-lg border border-border-subtle p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted w-16">供应商</span>
                      <span className="text-text-primary">{detail.supplier_info.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="h-3 w-3 text-text-muted" />
                      <span className="text-text-muted">联系人：{detail.supplier_info.contact_name || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="h-3 w-3 text-text-muted" />
                      <span className="text-text-muted">电话：{detail.supplier_info.contact_phone || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 配送信息 */}
              {detail.delivery_info && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <Truck className="h-4 w-4" />
                    配送信息
                  </div>
                  <div className="rounded-lg border border-border-subtle p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin className="h-3 w-3 text-text-muted" />
                      <span className="text-text-muted">{detail.delivery_info.tenant_province} {detail.delivery_info.tenant_city}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-blue-500" />
                      <span className="text-text-secondary">预计 {detail.delivery_info.delivery_hours} 小时内送达</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Wallet className="h-3 w-3 text-text-muted" />
                      <span className="text-text-muted">最低起订：¥{detail.delivery_info.min_order_amount}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 资质交换 */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                  <FileCheck className="h-4 w-4" />
                  资质交换
                </div>
                <div className="rounded-lg border border-border-subtle p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">状态</span>
                    <span className="text-xs font-medium text-text-primary">{detail.qualification_status_display}</span>
                  </div>
                  {detail.qualification_exchange && (
                    <div className="mt-2 space-y-1 text-[11px] text-text-secondary">
                      {detail.qualification_exchange.buyer_qualifications && (
                        <div>买方资质：{Array.isArray(detail.qualification_exchange.buyer_qualifications) ? detail.qualification_exchange.buyer_qualifications.length : 0} 项</div>
                      )}
                      {detail.qualification_exchange.seller_qualifications && (
                        <div>卖方资质：{Array.isArray(detail.qualification_exchange.seller_qualifications) ? detail.qualification_exchange.seller_qualifications.length : 0} 项</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 支付记录 */}
              {detail.payments && detail.payments.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <CreditCard className="h-4 w-4" />
                    支付记录
                  </div>
                  <div className="space-y-1.5">
                    {detail.payments.map((pay) => (
                      <div key={pay.id} className="rounded-lg border border-border-subtle p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-secondary">{pay.payment_method === 'wechat' ? '微信支付' : pay.payment_method === 'alipay' ? '支付宝' : pay.payment_method}</span>
                          <span className="text-xs font-medium text-emerald-500">¥{pay.amount}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
                          <span>{pay.transaction_id || '无交易号'}</span>
                          <span>{pay.paid_at ? new Date(pay.paid_at).toLocaleString('zh-CN') : '未支付'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 下一步操作 */}
              {detail.next_actions && detail.next_actions.length > 0 && (
                <div className="rounded-xl bg-emerald-50 p-3">
                  <div className="mb-2 text-xs font-medium text-emerald-600">下一步操作</div>
                  <div className="flex flex-wrap gap-2">
                    {detail.next_actions.includes('initiate_qualification') && (
                      <button
                        onClick={handleQualification}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-accent shadow-sm transition-colors hover:bg-accent-soft disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileCheck className="h-3 w-3" />}
                        发起资质交换
                      </button>
                    )}
                    {detail.next_actions.includes('initiate_e_sign') && (
                      <button
                        onClick={handleESign}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-accent shadow-sm transition-colors hover:bg-accent-soft disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileCheck className="h-3 w-3" />}
                        电子签章
                      </button>
                    )}
                    {detail.next_actions.includes('create_payment') && (
                      <button
                        onClick={handlePay}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                        立即支付
                      </button>
                    )}
                    {detail.next_actions.includes('track_delivery') && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs text-indigo-600 shadow-sm">
                        <Truck className="h-3 w-3" />
                        等待配送
                      </div>
                    )}
                    {detail.next_actions.includes('confirm_receipt') && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs text-indigo-600 shadow-sm">
                        <Package className="h-3 w-3" />
                        等待收货确认
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="border-t border-border-subtle px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-bg-hover py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated"
          >
            关闭
          </button>
        </div>
      </div>

      {/* 支付弹窗 */}
      {showPaymentModal && detail && (
        <PaymentModal
          orderId={detail.id}
          orderNumber={detail.order_number}
          totalAmount={detail.total_amount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false)
            loadDetail()
          }}
          showToast={showToast}
        />
      )}

      {/* 资质交换表单弹窗 */}
      {showQualificationModal && detail && (
        <QualificationFormModal
          orderId={detail.id}
          existingQualifications={detail.qualification_exchange?.buyer_qualifications as any[] | undefined}
          onClose={() => setShowQualificationModal(false)}
          onSuccess={() => {
            setShowQualificationModal(false)
            loadDetail()
          }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// ========== 产品列表头（搜索结果统计 + 排序） ==========

function ProductListHeader({ products }: { products: PharmacyProduct[] }) {
  const suppliers = new Set(products.map(p => p.supplier_name).filter(Boolean))
  const categories = new Set(products.map(p => p.category).filter(Boolean))
  const inStock = products.filter(p => p.stock_quantity != null && p.stock_quantity > 0).length
  const avgPrice = products.length > 0
    ? (products.reduce((sum, p) => sum + parseFloat(p.price || '0'), 0) / products.length).toFixed(2)
    : '0.00'

  return (
    <div className="rounded-lg bg-bg-hover px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-text-secondary">
          找到 {products.length} 个产品
          {suppliers.size > 0 && <span className="ml-2 text-text-muted">· {suppliers.size} 家供应商</span>}
          {categories.size > 0 && <span className="ml-1 text-text-muted">· {categories.size} 个分类</span>}
          {inStock < products.length && <span className="ml-1 text-orange-500">· {inStock} 个有货</span>}
        </div>
        <div className="text-[10px] text-text-muted">
          均价 ¥{avgPrice}
        </div>
      </div>
    </div>
  )
}

// ========== 产品详情弹窗 ==========

function ProductDetailModal({ product, onClose, onOrderSuccess, showToast }: {
  product: PharmacyProduct
  onClose: () => void
  onOrderSuccess: (orderId: number, orderNumber: string) => void
  showToast: (msg: string, type?: ToastState['type']) => void
}) {
  const [qty, setQty] = useState(product.min_order_quantity || 1)
  const [ordering, setOrdering] = useState(false)

  const handleOrder = async () => {
    setOrdering(true)
    await handleQuickOrder(product.id, product.supplier_id || 0, qty, onOrderSuccess, showToast)
    setOrdering(false)
  }

  const totalPrice = product.price ? (parseFloat(product.price) * qty).toFixed(2) : '0.00'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h3 className="text-lg font-semibold text-text-primary">产品详情</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* 产品名称 + 价格 */}
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-blue-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-text-primary">{product.name}</h2>
                {product.trade_name && (
                  <p className="mt-0.5 text-sm text-text-muted">商品名：{product.trade_name}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end">
                {product.price && (
                  <>
                    <span className="text-2xl font-bold text-red-500">¥{product.price}</span>
                    <span className="text-xs text-text-muted">/{product.unit || '件'}</span>
                  </>
                )}
              </div>
            </div>
            {product.match_type && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-medium text-blue-600">
                  {product.match_type}
                </span>
                {product.score != null && (
                  <span className="text-[10px] text-text-muted">
                    匹配度 {Math.round(product.score * 100)}%
                  </span>
                )}
                {product.match_fields && product.match_fields.length > 0 && (
                  <span className="text-[10px] text-text-muted">
                    命中字段：{product.match_fields.join('、')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 详细信息 */}
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {product.specification && (
                <InfoItem label="规格" value={product.specification} />
              )}
              {product.dosage_form && (
                <InfoItem label="剂型" value={product.dosage_form} />
              )}
              {product.manufacturer && (
                <InfoItem label="生产厂家" value={product.manufacturer} />
              )}
              {product.category && (
                <InfoItem label="分类" value={product.category} />
              )}
              {product.approval_number && (
                <InfoItem label="批准文号" value={product.approval_number} />
              )}
              {product.barcode && (
                <InfoItem label="条码" value={product.barcode} />
              )}
              {product.unit && (
                <InfoItem label="单位" value={product.unit} />
              )}
              {product.min_order_quantity != null && product.min_order_quantity > 0 && (
                <InfoItem label="最低起订" value={`${product.min_order_quantity} ${product.unit || '件'}`} />
              )}
              {product.storage_condition && (
                <InfoItem label="储存条件" value={product.storage_condition} />
              )}
              {product.delivery_info && (
                <InfoItem label="配送信息" value={product.delivery_info} />
              )}
              {product.delivery_areas && (
                <InfoItem label="配送区域" value={product.delivery_areas} />
              )}
            </div>

            {/* 库存 + 供应商 */}
            <div className="rounded-lg border border-border-subtle p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-text-muted">库存状态</span>
                </div>
                {product.stock_quantity != null ? (
                  <span className={`text-sm font-medium ${product.stock_quantity > 100 ? 'text-emerald-500' : 'text-orange-500'}`}>
                    {product.stock_quantity} {product.unit || '件'}
                    {product.stock_quantity > 100 ? ' (充足)' : product.stock_quantity > 0 ? ' (紧张)' : ' (缺货)'}
                  </span>
                ) : (
                  <span className="text-sm text-text-muted">未知</span>
                )}
              </div>
              {product.supplier_name && (
                <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-text-muted">供应商</span>
                  </div>
                  <span className="text-sm font-medium text-text-primary">{product.supplier_name}</span>
                </div>
              )}
            </div>

            {product.status && product.status !== 'active' && (
              <div className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-600">
                当前状态：{product.status}
              </div>
            )}
          </div>
        </div>

        {/* 底部下单栏 */}
        <div className="border-t border-border-subtle px-5 py-3">
          <div className="flex items-center gap-3">
            {/* 数量选择 */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setQty(Math.max(product.min_order_quantity || 1, qty - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-text-muted transition-colors hover:bg-bg-hover"
              >
                <span className="text-sm">-</span>
              </button>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(Math.max(product.min_order_quantity || 1, parseInt(e.target.value) || 1))}
                className="w-16 rounded-lg border border-border-subtle px-2 py-1.5 text-center text-sm"
                min={product.min_order_quantity || 1}
              />
              <button
                onClick={() => setQty(qty + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-text-muted transition-colors hover:bg-bg-hover"
              >
                <span className="text-sm">+</span>
              </button>
            </div>

            {/* 总价 */}
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted">合计</span>
              <span className="text-lg font-bold text-red-500">¥{totalPrice}</span>
            </div>

            {/* 下单按钮 */}
            <button
              onClick={handleOrder}
              disabled={ordering || (product.stock_quantity != null && product.stock_quantity <= 0)}
              className="ml-auto flex items-center gap-1.5 rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {ordering ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              立即下单
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  )
}

// ========== 支付弹窗 ==========

const PAYMENT_METHODS = [
  { id: 'wechat', label: '微信支付', desc: '推荐 · 扫码即付', color: 'green' },
  { id: 'alipay', label: '支付宝', desc: '扫码支付', color: 'blue' },
  { id: 'bank_transfer', label: '银行转账', desc: '对公转账', color: 'orange' },
] as const

function PaymentModal({ orderId, orderNumber, totalAmount, onClose, onSuccess, showToast }: {
  orderId: number
  orderNumber: string
  totalAmount: string
  onClose: () => void
  onSuccess: () => void
  showToast: (msg: string, type?: ToastState['type']) => void
}) {
  const [method, setMethod] = useState<string>('wechat')
  const [paying, setPaying] = useState(false)
  const [qrGenerated, setQrGenerated] = useState(false)

  const handlePay = async () => {
    setPaying(true)
    try {
      const client = getApiClient()
      // 1. 创建支付记录
      const payResp = await client.pdb.createPayment(orderId, method)
      if (payResp.code !== 0 || !payResp.data) {
        showToast(`创建支付失败：${payResp.msg}`, 'error')
        setPaying(false)
        return
      }
      const payment = payResp.data as { id?: number; payment_id?: number }
      const paymentId = payment.id || payment.payment_id || 0
      if (!paymentId) {
        showToast('支付记录创建异常', 'error')
        setPaying(false)
        return
      }
      // 2. 模拟扫码完成 → 处理支付
      await new Promise(resolve => setTimeout(resolve, 1500))
      const procResp = await client.pdb.processPayment(paymentId)
      if (procResp.code === 0) {
        showToast('支付成功！', 'success')
        onSuccess()
      } else {
        showToast(`支付处理失败：${procResp.msg}`, 'error')
      }
    } catch {
      showToast('支付失败，请稍后重试', 'error')
    } finally {
      setPaying(false)
    }
  }

  const selectedMethod = PAYMENT_METHODS.find(m => m.id === method)!
  const methodColorClass = {
    green: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-600', active: 'border-emerald-500 bg-emerald-50', ring: 'ring-emerald-200' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-600', active: 'border-blue-500 bg-blue-50', ring: 'ring-blue-200' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-600', active: 'border-orange-500 bg-orange-50', ring: 'ring-orange-200' },
  }[selectedMethod.color]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-slide-up">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-text-primary">订单支付</h3>
          </div>
          <button
            onClick={onClose}
            disabled={paying}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* 订单金额 */}
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-blue-50 p-4 text-center">
            <div className="text-xs text-text-muted">订单号</div>
            <div className="mt-0.5 font-mono text-sm text-text-secondary">{orderNumber}</div>
            <div className="mt-3 text-xs text-text-muted">应付金额</div>
            <div className="mt-1 text-3xl font-bold text-red-500">¥{totalAmount}</div>
          </div>

          {/* 支付方式选择 */}
          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold text-text-primary">选择支付方式</div>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((m) => {
                const cfg = {
                  green: { bg: 'bg-emerald-50', text: 'text-emerald-600', active: 'border-emerald-500 bg-emerald-50' },
                  blue: { bg: 'bg-blue-50', text: 'text-blue-600', active: 'border-blue-500 bg-blue-50' },
                  orange: { bg: 'bg-orange-50', text: 'text-orange-600', active: 'border-orange-500 bg-orange-50' },
                }[m.color]
                const isSelected = method === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => { setMethod(m.id); setQrGenerated(false) }}
                    disabled={paying}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all disabled:opacity-50 ${
                      isSelected ? cfg.active : 'border-border-subtle bg-white hover:bg-bg-hover'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cfg.bg}`}>
                      {m.id === 'wechat' && (
                        <svg className="h-6 w-6 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9.5 4C5.36 4 2 6.69 2 10c0 1.89 1.08 3.56 2.78 4.66L4 17l2.83-1.48c.84.23 1.74.36 2.67.36.26 0 .51-.01.76-.03C9.9 15.27 9.75 14.66 9.75 14c0-2.88 2.77-5.25 6.25-5.25.26 0 .51.02.76.05C16.05 5.7 13.05 4 9.5 4zM7 8.5c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm5 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm3 2.25c-3.17 0-5.75 2.13-5.75 4.75S11.83 20 15 20c.67 0 1.33-.1 1.95-.29L19 21l-.6-1.86C19.7 18.2 20.75 16.8 20.75 15.25c0-2.62-2.58-4.5-5.75-4.5zm-2 3c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75zm4 0c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75z"/>
                        </svg>
                      )}
                      {m.id === 'alipay' && (
                        <svg className="h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M2 12c0-5.52 4.48-10 10-10s10 4.48 10 10c0 1.46-.32 2.85-.89 4.09-.65-.23-1.53-.55-2.55-.89.32-.64.49-1.36.49-2.12 0-2.76-2.24-5-5-5s-5 2.24-5 5c0 2.76 2.24 5 5 5 .46 0 .91-.06 1.33-.19-.34.86-.95 1.59-1.84 2.17 3.56-.24 6.92-2.08 8.21-5.36C21.34 18.2 22 15.18 22 12c0-5.52-4.48-10-10-10S2 6.48 2 12zm5.5-1c0-2.49 2.01-4.5 4.5-4.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5S7.5 13.49 7.5 11zm3 0c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5z"/>
                        </svg>
                      )}
                      {m.id === 'bank_transfer' && (
                        <Wallet className={`h-5 w-5 ${cfg.text}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-primary">{m.label}</div>
                      <div className="text-[11px] text-text-muted">{m.desc}</div>
                    </div>
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected ? `${methodColorClass.border} ${methodColorClass.bg}` : 'border-border-subtle'
                    }`}>
                      {isSelected && <Check className={`h-3 w-3 ${methodColorClass.text}`} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 二维码区域 */}
          {(method === 'wechat' || method === 'alipay') && (
            <div className="mt-4">
              <button
                onClick={() => setQrGenerated(true)}
                disabled={paying || qrGenerated}
                className="w-full rounded-xl border-2 border-dashed border-border-subtle py-4 text-sm text-text-muted transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
              >
                {qrGenerated ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-500" />
                    二维码已生成
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <QrCode className="h-4 w-4" />
                    生成{selectedMethod.label}二维码
                  </span>
                )}
              </button>
              {qrGenerated && !paying && (
                <div className="mt-3 flex flex-col items-center">
                  <div className={`flex h-40 w-40 items-center justify-center rounded-xl ${methodColorClass.bg} border-2 ${methodColorClass.border}`}>
                    <QrCode className={`h-24 w-24 ${methodColorClass.text} opacity-30`} />
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    请使用{selectedMethod.label}扫描二维码完成支付
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 银行转账信息 */}
          {method === 'bank_transfer' && (
            <div className="mt-4 rounded-xl border border-border-subtle bg-orange-50/50 p-4">
              <div className="mb-2 text-sm font-semibold text-text-primary">对公转账信息</div>
              <div className="space-y-1.5 text-xs text-text-secondary">
                <div>开户银行：<span className="font-medium text-text-primary">中国工商银行</span></div>
                <div>账户名称：<span className="font-medium text-text-primary">药采购平台运营有限公司</span></div>
                <div>银行账号：<span className="font-mono font-medium text-text-primary">6222 0210 0123 4567 890</span></div>
                <div className="pt-1 text-text-muted">请在转账备注中注明订单号：{orderNumber}</div>
              </div>
            </div>
          )}
        </div>

        {/* 底部支付按钮 */}
        <div className="border-t border-border-subtle px-5 py-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-text-muted">支付金额</span>
            <span className="text-lg font-bold text-red-500">¥{totalAmount}</span>
          </div>
          <button
            onClick={handlePay}
            disabled={paying}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white transition-colors disabled:opacity-50 ${methodColorClass.text.replace('text-', 'bg-')}`}
            style={{ backgroundColor: method === 'wechat' ? '#10b981' : method === 'alipay' ? '#3b82f6' : '#f97316' }}
          >
            {paying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                支付处理中...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                确认支付 ¥{totalAmount}
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[10px] text-text-muted">
            支付即表示同意平台交易协议，支付完成后自动确认
          </p>
        </div>
      </div>
    </div>
  )
}

// ========== 资质交换表单弹窗 ==========

const QUALIFICATION_TYPES = [
  '药品经营许可证',
  'GSP认证证书',
  '医疗器械经营许可证',
  '互联网药品信息服务资格证',
  '营业执照',
  '药品经营质量管理规范认证证书',
]

interface QualificationEntry {
  type: string
  number: string
  status: string
}

function QualificationFormModal({ orderId, existingQualifications, onClose, onSuccess, showToast }: {
  orderId: number
  existingQualifications?: any[]
  onClose: () => void
  onSuccess: () => void
  showToast: (msg: string, type?: ToastState['type']) => void
}) {
  const parseExisting = (): QualificationEntry[] => {
    if (!existingQualifications || !Array.isArray(existingQualifications) || existingQualifications.length === 0) {
      return [
        { type: '药品经营许可证', number: '', status: 'valid' },
        { type: 'GSP认证证书', number: '', status: 'valid' },
      ]
    }
    return existingQualifications.map((q: any) => ({
      type: q.type || q.qualification_type || '',
      number: q.number || q.license_number || q.certificate_number || '',
      status: q.status || 'valid',
    }))
  }

  const [entries, setEntries] = useState<QualificationEntry[]>(parseExisting)
  const [submitting, setSubmitting] = useState(false)

  const updateEntry = (index: number, field: keyof QualificationEntry, value: string) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e))
  }

  const addEntry = () => {
    setEntries(prev => [...prev, { type: '', number: '', status: 'valid' }])
  }

  const removeEntry = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    const validEntries = entries.filter(e => e.type && e.number.trim())
    if (validEntries.length === 0) {
      showToast('请至少填写一项资质信息', 'error')
      return
    }
    setSubmitting(true)
    try {
      const client = getApiClient()
      const resp = await client.pdb.qualification(orderId, validEntries.map(e => ({
        type: e.type,
        number: e.number.trim(),
        status: e.status,
      })))
      if (resp.code === 0) {
        showToast(`资质交换已发起（${validEntries.length}项资质）`, 'success')
        onSuccess()
      } else {
        showToast(`资质交换失败：${resp.msg}`, 'error')
      }
    } catch {
      showToast('操作失败，请稍后重试', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-slide-up">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-text-primary">资质交换</h3>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* 说明 */}
          <div className="mb-4 rounded-xl bg-blue-50 p-3">
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <div className="text-xs text-blue-700">
                <div className="font-medium">资质交换说明</div>
                <div className="mt-1 text-blue-600">
                  请填写您的企业资质信息，系统将自动与供应商进行资质互换验证。
                  资质通过后可进行电子签章和支付。
                </div>
              </div>
            </div>
          </div>

          {/* 资质条目列表 */}
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div key={index} className="rounded-xl border border-border-subtle p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">资质 #{index + 1}</span>
                  {entries.length > 1 && (
                    <button
                      onClick={() => removeEntry(index)}
                      disabled={submitting}
                      className="flex h-6 w-6 items-center justify-center rounded text-red-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {/* 资质类型 */}
                  <div>
                    <label className="mb-1 block text-[11px] text-text-muted">资质类型</label>
                    <select
                      value={entry.type}
                      onChange={(e) => updateEntry(index, 'type', e.target.value)}
                      disabled={submitting}
                      className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/10 disabled:opacity-50"
                    >
                      <option value="">请选择资质类型</option>
                      {QUALIFICATION_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  {/* 证书编号 */}
                  <div>
                    <label className="mb-1 block text-[11px] text-text-muted">证书编号</label>
                    <input
                      type="text"
                      value={entry.number}
                      onChange={(e) => updateEntry(index, 'number', e.target.value)}
                      disabled={submitting}
                      placeholder="请输入证书编号"
                      className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/10 disabled:opacity-50"
                    />
                  </div>
                  {/* 有效状态 */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted">状态：</span>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                      <Check className="h-2.5 w-2.5" />
                      有效
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 添加资质按钮 */}
          <button
            onClick={addEntry}
            disabled={submitting}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border-subtle py-2.5 text-sm text-text-muted transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            添加资质
          </button>
        </div>

        {/* 底部 */}
        <div className="border-t border-border-subtle px-5 py-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-text-muted">已填写资质</span>
            <span className="font-medium text-text-primary">
              {entries.filter(e => e.type && e.number.trim()).length} / {entries.length} 项
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || entries.filter(e => e.type && e.number.trim()).length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                提交资质交换
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
