import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Search,
  Smile,
  Mic,
  Phone,
  Image as ImageIcon,
  Video,
  FileText,
  Moon,
  Zap,
  MessageSquare
} from 'lucide-react'

// ============================================================
// 类型定义
// ============================================================

/** 企微账号（第三层对接企微 API 的入口） */
interface WecomAccount {
  id: string
  name: string
  /** 首字母/简称，用于头像占位 */
  initials: string
  color: string
  unread: number
}

/** 企微好友/客户 */
interface Contact {
  id: string
  accountId: string
  name: string
  /** 药店/公司名 */
  company: string
  avatar?: string
  lastMessage: string
  lastTime: string
  unread: number
  pinned: boolean
  aiHosted: boolean
}

/** 消息内容类型 */
type MessageType = 'text' | 'product'

interface ChatMessage {
  id: string
  contactId: string
  role: 'friend' | 'me'
  type: MessageType
  content: string
  time: string
  /** 产品卡片专用 */
  product?: {
    brand: string
    name: string
    spec: string
    price: number
    image: string
  }
}

// ============================================================
// Mock 数据（第三阶段由后端对接企微 API 后替换）
// ============================================================

const ACCOUNTS: WecomAccount[] = [
  { id: 'gykg', name: '国药控股', initials: '国', color: 'bg-blue-500', unread: 5 },
  { id: 'hr', name: '华润医药', initials: '华', color: 'bg-emerald-500', unread: 12 },
  { id: 'fx', name: '复星药房', initials: '复', color: 'bg-slate-400', unread: 1 },
  { id: 'bys', name: '白云山', initials: '白', color: 'bg-orange-500', unread: 3 }
]

const CONTACTS: Contact[] = [
  {
    id: 'c1',
    accountId: 'gykg',
    name: '王经理',
    company: '仁爱大药房',
    lastMessage: '发货后麻烦把物流单号发我',
    lastTime: '07-22',
    unread: 0,
    pinned: true,
    aiHosted: false
  },
  {
    id: 'c2',
    accountId: 'gykg',
    name: '陈经理',
    company: '同仁堂药店',
    lastMessage: '好的，到货通知我一声',
    lastTime: '07-22',
    unread: 0,
    pinned: true,
    aiHosted: false
  },
  {
    id: 'c3',
    accountId: 'hr',
    name: '赵药师',
    company: '健康人大药房',
    lastMessage: '先来100盒',
    lastTime: '07-22',
    unread: 1,
    pinned: true,
    aiHosted: true
  },
  {
    id: 'c4',
    accountId: 'fx',
    name: '李总',
    company: '康泰药业',
    lastMessage: '好的，辛苦了，等着你消息',
    lastTime: '07-22',
    unread: 0,
    pinned: false,
    aiHosted: true
  },
  {
    id: 'c5',
    accountId: 'bys',
    name: '张店长',
    company: '百姓堂药房',
    lastMessage: '太好了，感谢支持！',
    lastTime: '07-22',
    unread: 0,
    pinned: true,
    aiHosted: false
  },
  {
    id: 'c6',
    accountId: 'hr',
    name: '刘经理',
    company: '益丰大药房',
    lastMessage: '阿莫西林能不能再优惠点？',
    lastTime: '07-21',
    unread: 2,
    pinned: false,
    aiHosted: false
  },
  {
    id: 'c7',
    accountId: 'gykg',
    name: '周采购',
    company: '一心堂',
    lastMessage: '发票抬头换一下',
    lastTime: '07-21',
    unread: 0,
    pinned: false,
    aiHosted: false
  }
]

const MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    contactId: 'c1',
    role: 'friend',
    type: 'text',
    content: '你好，阿莫西林胶囊还有货吗？',
    time: '2026-07-22 14:15'
  },
  {
    id: 'm2',
    contactId: 'c1',
    role: 'me',
    type: 'product',
    content: '',
    time: '2026-07-22 14:16',
    product: {
      brand: '石药集团',
      name: '阿莫西林胶囊',
      spec: '0.25g*24粒',
      price: 8.5,
      image: 'pill'
    }
  },
  {
    id: 'm3',
    contactId: 'c3',
    role: 'friend',
    type: 'text',
    content: '头孢克肟分散片来两箱',
    time: '2026-07-22 10:30'
  },
  {
    id: 'm4',
    contactId: 'c4',
    role: 'friend',
    type: 'text',
    content: '布洛芬缓释胶囊库存足吗？',
    time: '2026-07-22 09:12'
  },
  {
    id: 'm5',
    contactId: 'c4',
    role: 'me',
    type: 'text',
    content: '经理，布洛芬缓释胶囊当前库存 3200 盒，预计 3 天内可发。需要我帮您锁库下单吗？',
    time: '2026-07-22 09:13'
  }
]

const TABS = [
  { key: 'chat', label: '跟客聊天' },
  { key: 'settings', label: '聊天设置' },
  { key: 'broadcast', label: '精准群发' },
  { key: 'tags', label: '标签分组' },
  { key: 'moments', label: '发朋友圈' },
  { key: 'board', label: '数据看板' }
]

// ============================================================
// 辅助函数 / 小组件
// ============================================================

function avatarFallback(name: string) {
  return name.slice(name.length > 2 ? 1 : 0, name.length > 2 ? 3 : 2)
}

function PillImage() {
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-200 to-red-300">
      <div className="relative h-10 w-20">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-300 via-yellow-400 to-red-500 shadow-md" />
        <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/40" />
      </div>
    </div>
  )
}

export default function MarketingView() {
  const [activeTab, setActiveTab] = useState('chat')
  const [selectedAccountId, setSelectedAccountId] = useState(ACCOUNTS[0].id)
  const [selectedContactId, setSelectedContactId] = useState('c1')
  const [search, setSearch] = useState('')
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(MESSAGES)
  const [contacts, setContacts] = useState<Contact[]>(CONTACTS)

  const bottomRef = useRef<HTMLDivElement | null>(null)

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId)!,
    [contacts, selectedContactId]
  )

  const currentMessages = useMemo(
    () => messages.filter((m) => m.contactId === selectedContactId),
    [messages, selectedContactId]
  )

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages])

  // 联系人排序：置项 > 未读 > 时间（mock 按 id 简单排序）
  const filteredContacts = useMemo(() => {
    let list = contacts.filter((c) => c.accountId === selectedAccountId)
    if (search.trim()) {
      const kw = search.trim().toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(kw) ||
          c.company.toLowerCase().includes(kw) ||
          c.lastMessage.toLowerCase().includes(kw)
      )
    }
    if (onlyUnread) list = list.filter((c) => c.unread > 0)
    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.unread - a.unread
    })
  }, [contacts, selectedAccountId, search, onlyUnread])

  const toggleAiHost = () => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === selectedContactId ? { ...c, aiHosted: !c.aiHosted } : c
      )
    )
  }

  const sendMessage = () => {
    const text = input.trim()
    if (!text) return
    const now = new Date()
    const time = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      contactId: selectedContactId,
      role: 'me',
      type: 'text',
      content: text,
      time
    }
    setMessages((prev) => [...prev, newMsg])
    setContacts((prev) =>
      prev.map((c) =>
        c.id === selectedContactId
          ? { ...c, lastMessage: text, lastTime: '刚刚', unread: 0 }
          : c
      )
    )
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-full flex-col bg-bg-base text-text-primary">
      {/* 顶部 Tab 导航 */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface/60 pl-2.5 pr-6 backdrop-blur">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-accent text-white shadow-glow'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button className="icon-btn">
          <Moon className="h-5 w-5" />
        </button>
      </div>

      {/* 主体：账号栏 + 联系人 + 聊天区 */}
      <div className="flex min-h-0 flex-1">
        {/* 左侧账号选择栏（对接企微 API 的多账号入口） */}
        <div className="flex w-16 flex-col items-center gap-3 border-r border-border-subtle bg-bg-surface/40 py-4">
          {ACCOUNTS.map((acc) => (
            <button
              key={acc.id}
              onClick={() => {
                setSelectedAccountId(acc.id)
                const first = contacts.find((c) => c.accountId === acc.id)
                if (first) setSelectedContactId(first.id)
              }}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm transition-transform ${acc.color} ${
                selectedAccountId === acc.id
                  ? 'ring-2 ring-white/60 scale-105'
                  : 'opacity-80 hover:opacity-100'
              }`}
              title={acc.name}
            >
              {acc.initials}
              {acc.unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {acc.unread > 99 ? '99+' : acc.unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 联系人列表 */}
        <div className="flex w-80 flex-col border-r border-border-subtle bg-bg-surface/30">
          {/* 搜索 + 未读过滤 */}
          <div className="border-b border-border-subtle p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="请输入用户名搜索"
                className="h-9 w-full rounded-lg border border-border-default bg-bg-elevated pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
              <div
                onClick={() => setOnlyUnread(!onlyUnread)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  onlyUnread ? 'bg-accent' : 'bg-border-strong'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    onlyUnread ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'
                  }`}
                />
              </div>
              仅显示未读
            </label>
          </div>

          {/* 联系人 */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredContacts.length === 0 ? (
              <div className="mt-10 text-center text-sm text-text-muted">
                暂无联系人
              </div>
            ) : (
              filteredContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedContactId(c.id)}
                  className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${
                    selectedContactId === c.id
                      ? 'bg-accent/10'
                      : 'hover:bg-bg-hover'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent text-sm font-bold text-white">
                      {avatarFallback(c.name)}
                    </div>
                    {c.unread > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {c.unread > 99 ? '99+' : c.unread}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-text-primary">
                        {c.name}-{c.company}
                      </span>
                      {c.pinned && (
                        <span className="shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-medium text-amber-400">
                          置顶
                        </span>
                      )}
                      {c.aiHosted && (
                        <span className="shrink-0 rounded bg-accent/20 px-1 py-0.5 text-[10px] font-medium text-accent">
                          AI托管
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="truncate text-xs text-text-muted">
                        {c.lastMessage}
                      </p>
                      <span className="shrink-0 text-xs text-text-muted">
                        {c.lastTime}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 右侧聊天区 */}
        <div className="flex min-w-0 flex-1 flex-col bg-bg-base">
          {/* 聊天头部 */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent text-sm font-bold text-white">
                {avatarFallback(selectedContact.name)}
              </div>
              <h2 className="text-base font-semibold text-text-primary">
                {selectedContact.name}-{selectedContact.company}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Zap
                className={`h-4 w-4 ${
                  selectedContact.aiHosted ? 'text-accent' : 'text-text-muted'
                }`}
              />
              <span>AI托管</span>
              <button
                onClick={toggleAiHost}
                className={`relative ml-1 h-5 w-9 rounded-full transition-colors ${
                  selectedContact.aiHosted ? 'bg-accent' : 'bg-border-strong'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    selectedContact.aiHosted
                      ? 'left-[calc(100%-1.125rem)]'
                      : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 消息区 */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {currentMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
                <MessageSquare className="h-10 w-10 opacity-30" />
                <p className="text-sm">暂无消息，开始跟客吧</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {currentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === 'me' ? 'flex-row-reverse' : 'flex-row'
                    } gap-3`}
                  >
                    {/* 头像 */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                        msg.role === 'me'
                          ? 'bg-accent'
                          : 'bg-gradient-to-br from-accent to-accent'
                      }`}
                    >
                      {msg.role === 'me'
                        ? avatarFallback('我')
                        : avatarFallback(selectedContact.name)}
                    </div>

                    {/* 气泡 */}
                    <div
                      className={`flex max-w-[70%] flex-col ${
                        msg.role === 'me' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <span className="mb-1 text-xs text-text-muted">
                        {msg.time}
                      </span>
                      {msg.type === 'text' ? (
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            msg.role === 'me'
                              ? 'rounded-tr-sm bg-accent text-white'
                              : 'rounded-tl-sm bg-bg-elevated text-text-primary'
                          }`}
                        >
                          {msg.content}
                        </div>
                      ) : msg.product ? (
                        <div className="w-64 overflow-hidden rounded-xl bg-bg-elevated p-3 shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500/20 text-emerald-400">
                              <span className="text-xs">🌿</span>
                            </div>
                            <span className="text-sm font-medium text-text-primary">
                              {msg.product.brand}
                            </span>
                          </div>
                          <div className="mt-3 flex gap-3">
                            <PillImage />
                            <div className="flex flex-col justify-center">
                              <p className="text-sm font-medium text-text-primary">
                                {msg.product.name}
                              </p>
                              <p className="text-xs text-text-muted">
                                {msg.product.spec}
                              </p>
                              <p className="mt-1 text-base font-bold text-red-400">
                                ¥{msg.product.price.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-text-muted">小程序</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="shrink-0 border-t border-border-subtle bg-bg-surface/40 px-6 py-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="按ctrl+enter换行"
              rows={3}
              className="w-full resize-none rounded-xl border border-border-default bg-bg-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1 text-text-muted">
                <button className="icon-btn" title="表情">
                  <Smile className="h-5 w-5" />
                </button>
                <button className="icon-btn" title="语音">
                  <Mic className="h-5 w-5" />
                </button>
                <button className="icon-btn" title="电话">
                  <Phone className="h-5 w-5" />
                </button>
                <button className="icon-btn" title="图片">
                  <ImageIcon className="h-5 w-5" />
                </button>
                <button className="icon-btn" title="视频">
                  <Video className="h-5 w-5" />
                </button>
                <button className="icon-btn" title="文件">
                  <FileText className="h-5 w-5" />
                </button>
                <button className="ml-2 rounded-lg px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-hover">
                  快捷回复
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setInput('')}
                  className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                >
                  清空
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white shadow-glow transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  点击发送
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
