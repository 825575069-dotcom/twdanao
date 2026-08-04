import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import {
  Search,
  Smile,
  Mic,
  Image as ImageIcon,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileCode,
  FileType,
  Music,
  Video,
  Play,
  Pause,
  Moon,
  Zap,
  MessageSquare,
  Bot,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
  Users,
  Send,
  Volume2,
  Activity,
  Smartphone,
  Save,
  Plus,
  X,
  Ban,
  MessageCircle,
  Megaphone,
  Copy,
  Check,
  CheckCheck,
  Link2,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Star,
  Forward,
  CheckSquare,
  Bookmark,
  XCircle,
  Reply,
  Undo2,
  Package,
  PlaySquare,
  Hand,
  Bell,
  AlertCircle,
  LogOut,
  QrCode,
} from 'lucide-react'
import { getApiClient } from '../lib/api'
import { API_BUSINESS_CODE } from '../lib/constants'
import { hasAccess } from '../lib/permissions'
import { useStore } from '../store/appStore'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import ManualInterventionView from './ManualInterventionView'
import NotificationTargetsView from './NotificationTargetsView'
import TagsTab from './TagsTab'
import MassSendTab from './MassSendTab'
import MomentsTab from './MomentsTab'
import type {
  WecomDevice,
  WecomContact,
  WecomGroupRoom,
  WecomMessage,
  ChatSetting,
  MarketingDashboard,
  DashboardTrendPoint,
  UnifiedSession,
} from '../types'

// ============================================================
// 常量
// ============================================================

const TABS = [
  { key: 'chat', label: '跟客聊天' },
  { key: 'settings', label: '聊天设置' },
  { key: 'broadcast', label: '精准群发' },
  { key: 'tags', label: '标签分组' },
  { key: 'moments', label: '发朋友圈' },
  { key: 'board', label: '数据看板' }
] as const

// ============================================================
// 辅助函数
// ============================================================

function avatarFallback(name: string) {
  if (!name) return '?'
  // 纯数字 ID（如企微 external_userid 或手机号）显示后 2 位，避免显示"?"
  if (/^\d+$/.test(name)) return name.slice(-2)
  // 优先取中文字符或字母，避免展示无意义数字串
  const meaningful = name.replace(/^\d+/, '').trim()
  if (meaningful) {
    return meaningful.slice(meaningful.length > 2 ? 1 : 0, meaningful.length > 2 ? 3 : 2)
  }
  return name.slice(name.length > 2 ? 1 : 0, name.length > 2 ? 3 : 2)
}

function formatTime(isoStr: string) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return isoStr
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (isToday) return `${hh}:${mm}`
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mo}-${dd} ${hh}:${mm}`
}

function formatLastTime(isoStr: string | null) {
  if (!isoStr) return ''
  return formatTime(isoStr)
}

/** 操作提示：显示在聊天框区域中央，灰色半透明背景 */
function showOperationTip(message: string) {
  const el = document.createElement('div')
  el.textContent = message
  el.style.cssText = 'position:fixed;top:42%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.65);color:#fff;padding:10px 24px;border-radius:8px;font-size:14px;z-index:9999;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);pointer-events:none;'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1500)
}

/** 企微/微信表情占位符 → Unicode emoji */
const EMOJI_MAP: Record<string, string> = {
  咖啡: '☕',
  微笑: '😊',
  呲牙: '😁',
  偷笑: '🤭',
  憨笑: '😄',
  愉快: '😊',
  得意: '😎',
  调皮: '😜',
  坏笑: '😏',
  阴险: '😈',
  可怜: '🥺',
  可爱: '🥰',
  害羞: '😳',
  流泪: '😭',
  大哭: '😭',
  难过: '😞',
  囧: '😳',
  发呆: '😳',
  撇嘴: '😒',
  白眼: '🙄',
  傲慢: '😤',
  困: '😴',
  惊恐: '😱',
  冷汗: '😰',
  抓狂: '😫',
  吐: '🤮',
  衰: '😖',
  嘘: '🤫',
  哈欠: '🥱',
  晕: '😵',
  疑问: '❓',
  咒骂: '🤬',
  骷髅: '💀',
  再见: '👋',
  握手: '🤝',
  鼓掌: '👏',
  拥抱: '🤗',
  强: '👍',
  OK: '👌',
  拳头: '✊',
  加油: '💪',
  玫瑰: '🌹',
  爱心: '❤️',
  心碎: '💔',
  嘴唇: '💋',
  月亮: '🌙',
  太阳: '☀️',
  星星: '⭐',
  庆祝: '🎉',
  礼物: '🎁',
  红包: '🧧',
  福: '🧧',
  發: '🀅',
  烟花: '🎆',
  爆竹: '🧨',
  灯笼: '🏮',
  蛋糕: '🎂',
  啤酒: '🍺',
  西瓜: '🍉',
  饭: '🍚',
  面条: '🍜',
  饺子: '🥟',
  猪头: '🐷',
  旺柴: '🐶',
  菜刀: '🔪',
  便便: '💩',
  炸弹: '💣',
  闪电: '⚡',
  奖杯: '🏆',
  足球: '⚽',
  篮球: '🏀',
  乒乓球: '🏓',
  羽毛球: '🏸',
  666: '6️⃣',
  裂开: '😫',
  叹气: '😮‍💨',
  苦涩: '😭',
  让我看看: '👀',
  皱眉: '😟',
  翻白眼: '🙄',
  擦汗: '😓',
  糗大了: '😅',
  敲打: '🔨',
}

function renderTextWithEmojis(text: string) {
  if (!text) return text
  return text.replace(/\[([^\]]+)\]/g, (_, name) => EMOJI_MAP[name] || `[${name}]`)
}

/** 群聊多人头像拼图（参考微信布局） */
function GroupAvatar({ memberUserIds, contacts, isSelected }: {
  memberUserIds: string[]
  contacts: WecomContact[]
  isSelected: boolean
}) {
  // 根据群人数决定展示数量：3人=3个，4人=4个，5人=5个，大于5人=6个
  const memberCount = memberUserIds.length
  let displayCount = memberCount
  if (memberCount > 5) displayCount = 6

  // 取前 displayCount 个群成员头像
  const members = memberUserIds.slice(0, displayCount).map(uid => {
    const c = contacts.find(ct => ct.external_userid === uid)
    return { uid, name: c?.name || '', avatar: c?.avatar || '' }
  })

  const size = 44 // 头像总尺寸
  const gap = 1
  const bg = isSelected ? 'rgba(255,255,255,0.25)' : '#e8e8e8'

  // 根据数量决定布局
  // 1→1x1, 2→2x1横排, 3→3x1横排, 4→2x2, 5→5x1横排, 6→2x3
  let cols = displayCount
  let rows = 1
  if (displayCount === 4) { cols = 2; rows = 2 }
  else if (displayCount === 6) { cols = 3; rows = 2 }

  // 单人 — 大头像
  if (members.length === 1) {
    const m = members[0]
    return (
      <div
        className="shrink-0 overflow-hidden rounded-lg"
        style={{ width: size, height: size, background: bg }}
      >
        {m.avatar ? (
          <img src={m.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-medium text-[#999]">
            {avatarFallback(m.name || m.uid)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="shrink-0 overflow-hidden rounded-lg"
      style={{ width: size, height: size, background: bg }}
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: `${gap}px`,
        }}
      >
        {members.map((m, i) => (
          <div
            key={i}
            className="overflow-hidden"
            style={{ background: '#f0f0f0' }}
          >
            {m.avatar ? (
              <img src={m.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[8px] font-medium text-[#999]">
                {avatarFallback(m.name || m.uid)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** 常用 Unicode 表情（用于表情选择器，直接作为文本发送） */
const PICKER_EMOJIS = [
  '😊', '😁', '🤭', '😄', '😎', '😜', '😏', '🥺',
  '🥰', '😳', '😭', '😞', '😒', '🙄', '😤', '😴',
  '😱', '😰', '😫', '🤮', '🤫', '🥱', '😵', '❓',
  '🤬', '💀', '👋', '🤝', '👏', '🤗', '👍', '👌',
  '✊', '💪', '🌹', '❤️', '💔', '💋', '🌙', '☀️',
  '⭐', '🎉', '🎁', '🧧', '🎆', '🧨', '🏮', '🎂',
  '🍺', '🍉', '🍚', '🍜', '🥟', '🐷', '🐶', '💩',
  '💣', '⚡', '🏆', '⚽', '🏀', '6️⃣', '😅', '👀',
]

/** 根据文件名返回文件图标与颜色（参考微信文件气泡） */
function getFileInfo(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; label: string }> = {
    pdf: { icon: FileType, color: '#e74c3c', label: 'PDF' },
    doc: { icon: FileText, color: '#2b579a', label: 'Word' },
    docx: { icon: FileText, color: '#2b579a', label: 'Word' },
    xls: { icon: FileSpreadsheet, color: '#217346', label: 'Excel' },
    xlsx: { icon: FileSpreadsheet, color: '#217346', label: 'Excel' },
    csv: { icon: FileSpreadsheet, color: '#217346', label: 'Excel' },
    ppt: { icon: FileText, color: '#d24726', label: 'PPT' },
    pptx: { icon: FileText, color: '#d24726', label: 'PPT' },
    mp3: { icon: Music, color: '#8e44ad', label: '音频' },
    wav: { icon: Music, color: '#8e44ad', label: '音频' },
    ogg: { icon: Music, color: '#8e44ad', label: '音频' },
    amr: { icon: Music, color: '#8e44ad', label: '音频' },
    mp4: { icon: Video, color: '#c0392b', label: '视频' },
    mov: { icon: Video, color: '#c0392b', label: '视频' },
    avi: { icon: Video, color: '#c0392b', label: '视频' },
    webm: { icon: Video, color: '#c0392b', label: '视频' },
    jpg: { icon: FileImage, color: '#27ae60', label: '图片' },
    jpeg: { icon: FileImage, color: '#27ae60', label: '图片' },
    png: { icon: FileImage, color: '#27ae60', label: '图片' },
    gif: { icon: FileImage, color: '#27ae60', label: '图片' },
  zip: { icon: FileCode, color: '#f39c12', label: '压缩包' },
  rar: { icon: FileCode, color: '#f39c12', label: '压缩包' },
  '7z': { icon: FileCode, color: '#f39c12', label: '压缩包' },
  txt: { icon: FileText, color: '#7f8c8d', label: '文本' },
  md: { icon: FileText, color: '#7f8c8d', label: '文本' },
}
return map[ext] || { icon: FileText, color: '#7f8c8d', label: '文件' }
}

/** 文件消息卡片 */
function FileMessageCard({ filename, onClick }: { filename: string; onClick?: () => void }) {
  const { icon: FileIcon, color } = getFileInfo(filename)
  return (
    <div
      onClick={onClick}
      className="flex min-w-[220px] max-w-full cursor-pointer items-center gap-3 rounded-lg border border-[#e2e2e2] bg-white px-4 py-3 shadow-sm transition-colors hover:bg-[#f9f9f9]"
    >
      <FileIcon className="h-10 w-10 shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#333]">{filename || '文件'}</p>
        <p className="text-xs text-[#999]">点击下载/预览</p>
      </div>
    </div>
  )
}

/** 小程序卡片 */
function MiniProgramCard({ data, iconUrl, onClick }: { data: Record<string, unknown>; iconUrl?: string | null; onClick?: () => void }) {
  const msgData = (data?.msgData as Record<string, unknown>) || {}
  const title = (msgData.title as string) || (msgData.appName as string) || '小程序'
  const appName = (msgData.appName as string) || '小程序'
  const desc = (msgData.desc as string) || ''
  const pagePath = (msgData.pagePath as string) || ''
  const url = (msgData.url as string) || (msgData.pageUrl as string) || ''

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (url) {
      window.open(url, '_blank')
    }
  }

  return (
    <div
      onClick={handleClick}
      className="flex min-w-[240px] max-w-full cursor-pointer flex-col gap-2 rounded-lg border border-[#e2e2e2] bg-white px-0 py-0 shadow-sm transition-all hover:shadow-md hover:border-[#07c160]/40 overflow-hidden"
    >
      <div className="flex items-start gap-3 px-4 pt-3">
        {iconUrl ? (
          <img src={iconUrl} alt={appName} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#07c160]/10">
            <Smartphone className="h-6 w-6 text-[#07c160]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#333]">{title}</p>
          <p className="truncate text-xs text-[#999]">{appName}</p>
        </div>
      </div>
      {desc && (
        <p className="line-clamp-2 px-4 text-xs leading-relaxed text-[#666]">{desc}</p>
      )}
      <div className="border-t border-[#f2f2f2] bg-[#fafafa] px-4 py-1.5 text-[10px] text-[#b2b2b2]">
        小程序{pagePath ? ' · ' + pagePath : ''}
      </div>
    </div>
  )
}

/** 根据消息类型返回中文预览文案 */
function getMessagePreview(msg: { msg_type?: string; content?: string }): string {
  const content = (msg.content || '').trim()
  if (msg.msg_type === 'text' || !msg.msg_type) return content
  if (content) return content
  const map: Record<string, string> = {
    image: '[图片]',
    voice: '[语音]',
    file: '[文件]',
    video: '[视频]',
    link: '[链接]',
    emoji: '[表情]',
    miniprogram: '[小程序]',
  }
  return map[msg.msg_type] || `[${msg.msg_type}]`
}

// ============================================================
// 设备状态指示器
// ============================================================

function DeviceAvatar({ device, selected }: { device: WecomDevice; selected: boolean }) {
  const isOnline = device.status === 'online'
  const colorMap: Record<string, string> = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-400',
    banned: 'bg-red-500'
  }
  return (
    <button
      onClick={() => {/* handled by parent */}}
      className={`relative flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm transition-transform overflow-hidden ${colorMap[device.status] || 'bg-slate-400'} ${
        selected ? 'ring-2 ring-white/60 scale-105' : 'opacity-80 hover:opacity-100'
      }`}
      title={device.name}
    >
      {device.avatar
        ? <img src={device.avatar} alt={device.name} className="h-full w-full object-cover" />
        : avatarFallback(device.name)
      }
      <span
        className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-[#e7e7e7] ${
          isOnline ? 'bg-green-400' : 'bg-slate-300'
        }`}
      />
    </button>
  )
}

// ============================================================
// SettingsTab — 聊天设置面板
// ============================================================

const REPLY_STYLES = [
  { value: 'professional', label: '专业严谨', desc: '用语规范，适合商务场景' },
  { value: 'friendly', label: '亲切友好', desc: '语气亲和，拉近距离感' },
  { value: 'lively', label: '活泼生动', desc: '幽默风趣，适合老客户' },
  { value: 'calm', label: '沉稳冷静', desc: '克制内敛，突出权威性' }
] as const

const REPLY_LENGTHS = [
  { value: 'short', label: '简短', desc: '20字以内，快速回复' },
  { value: 'medium', label: '适中', desc: '50字左右，表达完整' },
  { value: 'detailed', label: '详细', desc: '100字以上，详尽解答' }
] as const

const CUSTOMER_ADDRESSES = [
  { value: 'remark', label: '备注名', desc: '使用客户备注名称呼' },
  { value: 'nickname', label: '昵称', desc: '使用客户微信昵称称呼' },
  { value: 'surname_prefix', label: '姓氏+称谓', desc: '如"王总"、"李经理"' }
] as const

const NON_TEXT_STRATEGIES = [
  { value: 'ignore', label: '不回复', desc: '收到非文本消息时不回复' },
  { value: 'reply_text', label: '回复指定文字', desc: '收到非文本消息时回复固定文字' },
  { value: 'reply_template', label: '回复话术模板', desc: '从快捷话术库中查找并回复' }
] as const

const GROUP_REPLY_MODES = [
  { value: 'at_only', label: '仅@我时回复', desc: '只在群内@我时AI才回复' },
  { value: 'at_and_whitelist', label: '@我或白名单群', desc: '@我时回复，白名单群无需@' },
  { value: 'all', label: '所有群消息', desc: '所有群消息AI都回复' }
] as const

function SettingsTab() {
  const api = getApiClient()

  const [devices, setDevices] = useState<WecomDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const [setting, setSetting] = useState<ChatSetting | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)

  const store = useStore()

  // 子导航：AI人设设置 / 单聊设置 / 群聊设置 / 人工介入设置 / 通知对象
  const [activeSubTab, setActiveSubTab] = useState<
    'persona' | 'single' | 'group' | 'manualIntervention' | 'notificationTargets'
  >('persona')

  const subTabs = useMemo(
    () =>
      [
        { key: 'persona', label: 'AI人设设置', icon: Bot },
        { key: 'single', label: '单聊设置', icon: MessageCircle },
        { key: 'group', label: '群聊设置', icon: Users },
        { key: 'manualIntervention', label: '人工介入设置', icon: Hand },
        { key: 'notificationTargets', label: '通知对象', icon: Bell },
      ].filter((tab) =>
        hasAccess(store.userPermissions, tab.key as import('../App').ViewKey)
      ),
    [store.userPermissions]
  )

  // 当前子导航无权限时回退到第一个有权限的子导航
  useEffect(() => {
    if (!subTabs.some((t) => t.key === activeSubTab) && subTabs.length > 0) {
      setActiveSubTab(subTabs[0].key as typeof activeSubTab)
    }
  }, [subTabs, activeSubTab])

  // 快捷回复和禁用词的输入缓冲
  const [quickReplyInput, setQuickReplyInput] = useState('')
  const [forbiddenWordInput, setForbiddenWordInput] = useState('')

  // 单聊设置：停止回复关键词输入缓冲
  const [stopKeywordInput, setStopKeywordInput] = useState('')

  // 群聊设置：白名单和固定回复群列表输入缓冲
  const [groupWhitelistInput, setGroupWhitelistInput] = useState('')
  const [groupFixedRoomInput, setGroupFixedRoomInput] = useState('')

  // —— 加载设备列表 ——
  useEffect(() => {
    const loadDevices = async () => {
      setLoading(true)
      try {
        const res = await api.wecom.devices.list()
        if (res.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(res.data)) {
          const list = res.data as WecomDevice[]
          setDevices(list)
          if (list.length > 0) setSelectedDeviceId(list[0].id)
        }
      } catch {
        setError('加载设备失败')
      } finally {
        setLoading(false)
      }
    }
    loadDevices()
  }, [api])

  // —— 加载聊天设置 ——
  useEffect(() => {
    if (selectedDeviceId === null) return
    const loadSetting = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.marketing.chatSettings.get(selectedDeviceId)
        if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
          setSetting(res.data as ChatSetting)
        } else {
          // 设置不存在，创建默认空值
          setSetting({
            id: 0,
            tenant: '',
            device: selectedDeviceId,
            device_name: devices.find((d) => d.id === selectedDeviceId)?.name || '',
            agent_id: '',
            agent_name: '',
            ai_enabled: false,
            reply_style: 'professional',
            reply_length: 'medium',
            customer_address: 'remark',
            ai_signature: false,
            quick_replies: [],
            forbidden_words: [],
            work_hours_start: '09:00',
            work_hours_end: '18:00',
            // 单聊设置默认值
            memory_rounds: 10,
            reply_delay_min: 1,
            reply_delay_max: 3,
            non_text_reply_strategy: 'reply_text',
            non_text_reply_content: '',
            stop_reply_keywords: [],
            // 群聊设置默认值
            group_reply_mode: 'at_only',
            group_no_at_whitelist: [],
            group_fixed_reply_enabled: false,
            group_fixed_reply_start: null,
            group_fixed_reply_end: null,
            group_fixed_reply_rooms: [],
            created_at: '',
            updated_at: ''
          })
        }
      } catch {
        setError('加载聊天设置失败')
      } finally {
        setLoading(false)
      }
    }
    loadSetting()
  }, [api, selectedDeviceId, devices])

  // —— 保存聊天设置 ——
  const handleSave = async () => {
    if (selectedDeviceId === null || !setting) return
    setSaving(true)
    setError(null)
    try {
      const res = await api.marketing.chatSettings.save(selectedDeviceId, {
        ai_enabled: setting.ai_enabled,
        reply_style: setting.reply_style,
        reply_length: setting.reply_length,
        customer_address: setting.customer_address,
        ai_signature: setting.ai_signature,
        quick_replies: setting.quick_replies,
        forbidden_words: setting.forbidden_words,
        work_hours_start: setting.work_hours_start,
        work_hours_end: setting.work_hours_end,
        // 单聊设置
        memory_rounds: setting.memory_rounds,
        reply_delay_min: setting.reply_delay_min,
        reply_delay_max: setting.reply_delay_max,
        non_text_reply_strategy: setting.non_text_reply_strategy,
        non_text_reply_content: setting.non_text_reply_content,
        stop_reply_keywords: setting.stop_reply_keywords,
        // 群聊设置
        group_reply_mode: setting.group_reply_mode,
        group_no_at_whitelist: setting.group_no_at_whitelist,
        group_fixed_reply_enabled: setting.group_fixed_reply_enabled,
        group_fixed_reply_start: setting.group_fixed_reply_start,
        group_fixed_reply_end: setting.group_fixed_reply_end,
        group_fixed_reply_rooms: setting.group_fixed_reply_rooms,
      })
      if (res.code === API_BUSINESS_CODE.SUCCESS) {
        setSavedMsg(true)
        setTimeout(() => setSavedMsg(false), 2000)
      } else {
        setError(res.msg || '保存失败')
      }
    } catch {
      setError('网络错误，保存失败')
    } finally {
      setSaving(false)
    }
  }

  // —— 快捷回复管理 ——
  const addQuickReply = () => {
    const text = quickReplyInput.trim()
    if (!text || !setting) return
    setSetting({ ...setting, quick_replies: [...setting.quick_replies, text] })
    setQuickReplyInput('')
  }

  const removeQuickReply = (index: number) => {
    if (!setting) return
    setSetting({
      ...setting,
      quick_replies: setting.quick_replies.filter((_, i) => i !== index)
    })
  }

  // —— 禁用词管理 ——
  const addForbiddenWord = () => {
    const text = forbiddenWordInput.trim()
    if (!text || !setting) return
    setSetting({ ...setting, forbidden_words: [...setting.forbidden_words, text] })
    setForbiddenWordInput('')
  }

  const removeForbiddenWord = (index: number) => {
    if (!setting) return
    setSetting({
      ...setting,
      forbidden_words: setting.forbidden_words.filter((_, i) => i !== index)
    })
  }

  // —— 停止回复关键词管理 ——
  const addStopKeyword = () => {
    const text = stopKeywordInput.trim()
    if (!text || !setting) return
    setSetting({ ...setting, stop_reply_keywords: [...setting.stop_reply_keywords, text] })
    setStopKeywordInput('')
  }

  const removeStopKeyword = (index: number) => {
    if (!setting) return
    setSetting({
      ...setting,
      stop_reply_keywords: setting.stop_reply_keywords.filter((_, i) => i !== index)
    })
  }

  // —— 群聊白名单管理 ——
  const addGroupWhitelist = () => {
    const text = groupWhitelistInput.trim()
    if (!text || !setting) return
    setSetting({ ...setting, group_no_at_whitelist: [...setting.group_no_at_whitelist, text] })
    setGroupWhitelistInput('')
  }

  const removeGroupWhitelist = (index: number) => {
    if (!setting) return
    setSetting({
      ...setting,
      group_no_at_whitelist: setting.group_no_at_whitelist.filter((_, i) => i !== index)
    })
  }

  // —— 群聊固定回复群列表管理 ——
  const addGroupFixedRoom = () => {
    const text = groupFixedRoomInput.trim()
    if (!text || !setting) return
    setSetting({ ...setting, group_fixed_reply_rooms: [...setting.group_fixed_reply_rooms, text] })
    setGroupFixedRoomInput('')
  }

  const removeGroupFixedRoom = (index: number) => {
    if (!setting) return
    setSetting({
      ...setting,
      group_fixed_reply_rooms: setting.group_fixed_reply_rooms.filter((_, i) => i !== index)
    })
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
        <Smartphone className="h-10 w-10 opacity-30" />
        <p className="text-sm">请先在跟客聊天页面添加企微设备</p>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左侧设备选择 */}
      <div className="flex w-48 flex-col gap-2 border-r border-border-subtle bg-bg-surface/30 p-3">
        <p className="px-2 pb-1 text-xs font-medium text-text-muted">选择设备</p>
        {devices.map((device) => (
          <button
            key={device.id}
            onClick={() => setSelectedDeviceId(device.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              selectedDeviceId === device.id
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${device.status === 'online' ? 'bg-green-400' : 'bg-slate-400'}`} />
            <span className="truncate">{device.name}</span>
          </button>
        ))}
      </div>

      {/* 右侧设置区域 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {setting && (
          <>
            {/* 子导航 */}
            <div className="flex gap-1 border-b border-border-subtle px-6 py-3">
              {subTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveSubTab(tab.key as typeof activeSubTab)}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeSubTab === tab.key
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-y-auto">
              {activeSubTab === 'manualIntervention' && <ManualInterventionView />}
              {activeSubTab === 'notificationTargets' && <NotificationTargetsView />}
              {['persona', 'single', 'group'].includes(activeSubTab) && (
                <div className="p-6">
                  <div className="mx-auto max-w-2xl space-y-6">

                    {/* ════════ Tab 1: AI人设设置 ════════ */}
                {activeSubTab === 'persona' && (
                  <>
                    {/* AI 开关 */}
                    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                            <Bot className="h-5 w-5 text-accent" />
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-text-primary">AI 自动回复</h3>
                            <p className="text-xs text-text-muted">开启后，AI 将自动回复客户消息</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSetting({ ...setting, ai_enabled: !setting.ai_enabled })}
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            setting.ai_enabled ? 'bg-accent' : 'bg-border-strong'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              setting.ai_enabled ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* 回复风格 */}
                    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <h3 className="mb-3 text-sm font-medium text-text-primary">回复风格</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {REPLY_STYLES.map((style) => (
                          <button
                            key={style.value}
                            onClick={() => setSetting({ ...setting, reply_style: style.value })}
                            className={`rounded-lg border p-3 text-left transition-colors ${
                              setting.reply_style === style.value
                                ? 'border-accent bg-accent/5'
                                : 'border-border-default hover:bg-bg-hover'
                            }`}
                          >
                            <p className="text-sm font-medium text-text-primary">{style.label}</p>
                            <p className="text-xs text-text-muted">{style.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 回复长度 + 客户称呼 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                        <h3 className="mb-3 text-sm font-medium text-text-primary">回复长度</h3>
                        <div className="space-y-2">
                          {REPLY_LENGTHS.map((len) => (
                            <button
                              key={len.value}
                              onClick={() => setSetting({ ...setting, reply_length: len.value })}
                              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                                setting.reply_length === len.value
                                  ? 'border-accent bg-accent/5'
                                  : 'border-border-default hover:bg-bg-hover'
                              }`}
                            >
                              <div>
                                <span className="text-sm text-text-primary">{len.label}</span>
                                <span className="ml-2 text-xs text-text-muted">{len.desc}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                        <h3 className="mb-3 text-sm font-medium text-text-primary">客户称呼方式</h3>
                        <div className="space-y-2">
                          {CUSTOMER_ADDRESSES.map((addr) => (
                            <button
                              key={addr.value}
                              onClick={() => setSetting({ ...setting, customer_address: addr.value })}
                              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                                setting.customer_address === addr.value
                                  ? 'border-accent bg-accent/5'
                                  : 'border-border-default hover:bg-bg-hover'
                              }`}
                            >
                              <div>
                                <span className="text-sm text-text-primary">{addr.label}</span>
                                <span className="ml-2 text-xs text-text-muted">{addr.desc}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 工作时间 */}
                    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <h3 className="mb-3 text-sm font-medium text-text-primary">工作时间</h3>
                      <p className="mb-3 text-xs text-text-muted">非工作时间内，AI 将自动回复客户消息</p>
                      <div className="flex items-center gap-3">
                        <input
                          type="time"
                          value={setting.work_hours_start || '09:00'}
                          onChange={(e) => setSetting({ ...setting, work_hours_start: e.target.value })}
                          className="rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                        />
                        <span className="text-text-muted">至</span>
                        <input
                          type="time"
                          value={setting.work_hours_end || '18:00'}
                          onChange={(e) => setSetting({ ...setting, work_hours_end: e.target.value })}
                          className="rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    {/* AI 签名 */}
                    <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <div>
                        <h3 className="text-sm font-medium text-text-primary">AI 回复签名</h3>
                        <p className="text-xs text-text-muted">AI 回复消息末尾自动添加签名标识</p>
                      </div>
                      <button
                        onClick={() => setSetting({ ...setting, ai_signature: !setting.ai_signature })}
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          setting.ai_signature ? 'bg-accent' : 'bg-border-strong'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            setting.ai_signature ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* 快捷回复 */}
                    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <h3 className="mb-3 text-sm font-medium text-text-primary">快捷回复话术</h3>
                      <p className="mb-3 text-xs text-text-muted">AI 回复时可引用的常用话术库</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={quickReplyInput}
                          onChange={(e) => setQuickReplyInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') addQuickReply() }}
                          placeholder="输入快捷回复话术..."
                          className="flex-1 rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                        />
                        <button
                          onClick={addQuickReply}
                          className="flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover"
                        >
                          <Plus className="h-4 w-4" />
                          添加
                        </button>
                      </div>
                      {setting.quick_replies.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {setting.quick_replies.map((reply, i) => (
                            <span
                              key={i}
                              className="flex items-center gap-1 rounded-lg bg-bg-hover px-3 py-1.5 text-sm text-text-secondary"
                            >
                              {reply}
                              <button
                                onClick={() => removeQuickReply(i)}
                                className="ml-1 text-text-muted hover:text-red-400"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 禁用词 */}
                    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <h3 className="mb-3 text-sm font-medium text-text-primary">禁用词列表</h3>
                      <p className="mb-3 text-xs text-text-muted">AI 回复中将不会出现这些词汇</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={forbiddenWordInput}
                          onChange={(e) => setForbiddenWordInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') addForbiddenWord() }}
                          placeholder="输入禁用词..."
                          className="flex-1 rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                        />
                        <button
                          onClick={addForbiddenWord}
                          className="flex items-center gap-1 rounded-lg bg-red-500/80 px-3 py-2 text-sm text-white hover:bg-red-500"
                        >
                          <Plus className="h-4 w-4" />
                          添加
                        </button>
                      </div>
                      {setting.forbidden_words.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {setting.forbidden_words.map((word, i) => (
                            <span
                              key={i}
                              className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-400"
                            >
                              <Ban className="h-3 w-3" />
                              {word}
                              <button
                                onClick={() => removeForbiddenWord(i)}
                                className="ml-1 hover:text-red-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ════════ Tab 2: 单聊设置 ════════ */}
                {activeSubTab === 'single' && (
                  <>
                    {/* AI 记忆上下文轮数 */}
                    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <h3 className="mb-1 text-sm font-medium text-text-primary">AI 记忆上下文轮数</h3>
                      <p className="mb-3 text-xs text-text-muted">AI 回复时读取最近 N 轮对话作为上下文（默认 10）</p>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={2}
                          max={50}
                          step={2}
                          value={setting.memory_rounds}
                          onChange={(e) => setSetting({ ...setting, memory_rounds: parseInt(e.target.value) })}
                          className="flex-1 accent-accent"
                        />
                        <span className="w-16 rounded-lg border border-border-default bg-bg-elevated px-3 py-1.5 text-center text-sm text-text-primary">
                          {setting.memory_rounds} 轮
                        </span>
                      </div>
                    </div>

                    {/* 回复延迟 */}
                    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <h3 className="mb-1 text-sm font-medium text-text-primary">回复延迟</h3>
                      <p className="mb-3 text-xs text-text-muted">AI 回复前随机等待的秒数范围（模仿真人打字）</p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-muted">最小</span>
                          <input
                            type="number"
                            min={0}
                            max={30}
                            value={setting.reply_delay_min}
                            onChange={(e) => setSetting({ ...setting, reply_delay_min: parseInt(e.target.value) || 0 })}
                            className="w-20 rounded-lg border border-border-default bg-bg-elevated px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                          />
                          <span className="text-xs text-text-muted">秒</span>
                        </div>
                        <span className="text-text-muted">~</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-muted">最大</span>
                          <input
                            type="number"
                            min={0}
                            max={60}
                            value={setting.reply_delay_max}
                            onChange={(e) => setSetting({ ...setting, reply_delay_max: parseInt(e.target.value) || 0 })}
                            className="w-20 rounded-lg border border-border-default bg-bg-elevated px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                          />
                          <span className="text-xs text-text-muted">秒</span>
                        </div>
                      </div>
                    </div>

                    {/* 非文本消息回复策略 */}
                    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <h3 className="mb-1 text-sm font-medium text-text-primary">非文本/语音消息回复策略</h3>
                      <p className="mb-3 text-xs text-text-muted">客户发送图片、语音、视频等非文本消息时，AI 的处理方式</p>
                      <div className="space-y-2">
                        {NON_TEXT_STRATEGIES.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => setSetting({ ...setting, non_text_reply_strategy: s.value })}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                              setting.non_text_reply_strategy === s.value
                                ? 'border-accent bg-accent/5'
                                : 'border-border-default hover:bg-bg-hover'
                            }`}
                          >
                            <div>
                              <span className="text-sm text-text-primary">{s.label}</span>
                              <span className="ml-2 text-xs text-text-muted">{s.desc}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      {/* 回复内容输入 */}
                      {setting.non_text_reply_strategy !== 'ignore' && (
                        <div className="mt-3">
                          <input
                            type="text"
                            value={setting.non_text_reply_content}
                            onChange={(e) => setSetting({ ...setting, non_text_reply_content: e.target.value })}
                            placeholder={
                              setting.non_text_reply_strategy === 'reply_text'
                                ? '输入固定回复文字，如：收到您的图片，稍后回复您~'
                                : '输入话术模板名称（需与快捷回复话术库中的名称匹配）'
                            }
                            className="w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                          />
                        </div>
                      )}
                    </div>

                    {/* AI 停止回复关键词 */}
                    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <h3 className="mb-1 text-sm font-medium text-text-primary">AI 停止回复关键词</h3>
                      <p className="mb-3 text-xs text-text-muted">收到包含这些关键词的消息时，AI 自动停止回复并转为人工</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={stopKeywordInput}
                          onChange={(e) => setStopKeywordInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') addStopKeyword() }}
                          placeholder="输入关键词，如：人工客服、转人工"
                          className="flex-1 rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                        />
                        <button
                          onClick={addStopKeyword}
                          className="flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover"
                        >
                          <Plus className="h-4 w-4" />
                          添加
                        </button>
                      </div>
                      {setting.stop_reply_keywords.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {setting.stop_reply_keywords.map((kw, i) => (
                            <span
                              key={i}
                              className="flex items-center gap-1 rounded-lg bg-orange-500/10 px-3 py-1.5 text-sm text-orange-500"
                            >
                              {kw}
                              <button
                                onClick={() => removeStopKeyword(i)}
                                className="ml-1 text-text-muted hover:text-red-400"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ════════ Tab 3: 群聊设置 ════════ */}
                {activeSubTab === 'group' && (
                  <>
                    {/* 群聊 AI 回复模式 */}
                    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <h3 className="mb-1 text-sm font-medium text-text-primary">群聊 AI 回复模式</h3>
                      <p className="mb-3 text-xs text-text-muted">控制 AI 在群聊中何时回复</p>
                      <div className="space-y-2">
                        {GROUP_REPLY_MODES.map((m) => (
                          <button
                            key={m.value}
                            onClick={() => setSetting({ ...setting, group_reply_mode: m.value })}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                              setting.group_reply_mode === m.value
                                ? 'border-accent bg-accent/5'
                                : 'border-border-default hover:bg-bg-hover'
                            }`}
                          >
                            <div>
                              <span className="text-sm text-text-primary">{m.label}</span>
                              <span className="ml-2 text-xs text-text-muted">{m.desc}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 无@回复白名单（仅 at_and_whitelist 模式显示） */}
                    {setting.group_reply_mode === 'at_and_whitelist' && (
                      <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                        <h3 className="mb-1 text-sm font-medium text-text-primary">群聊无@回复白名单</h3>
                        <p className="mb-3 text-xs text-text-muted">这些群无需@也会自动回复（输入群ID）</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={groupWhitelistInput}
                            onChange={(e) => setGroupWhitelistInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') addGroupWhitelist() }}
                            placeholder="输入群ID..."
                            className="flex-1 rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                          />
                          <button
                            onClick={addGroupWhitelist}
                            className="flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover"
                          >
                            <Plus className="h-4 w-4" />
                            添加
                          </button>
                        </div>
                        {setting.group_no_at_whitelist.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {setting.group_no_at_whitelist.map((rid, i) => (
                              <span
                                key={i}
                                className="flex items-center gap-1 rounded-lg bg-bg-hover px-3 py-1.5 text-sm text-text-secondary"
                              >
                                {rid}
                                <button
                                  onClick={() => removeGroupWhitelist(i)}
                                  className="ml-1 text-text-muted hover:text-red-400"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 固定回复开关 */}
                    <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                      <div>
                        <h3 className="text-sm font-medium text-text-primary">群聊固定回复</h3>
                        <p className="text-xs text-text-muted">开启后在固定时间段内自动回复群消息</p>
                      </div>
                      <button
                        onClick={() => setSetting({ ...setting, group_fixed_reply_enabled: !setting.group_fixed_reply_enabled })}
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          setting.group_fixed_reply_enabled ? 'bg-accent' : 'bg-border-strong'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            setting.group_fixed_reply_enabled ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* 固定回复时间段（开启后显示） */}
                    {setting.group_fixed_reply_enabled && (
                      <>
                        <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                          <h3 className="mb-3 text-sm font-medium text-text-primary">固定回复时间段</h3>
                          <div className="flex items-center gap-3">
                            <input
                              type="time"
                              value={setting.group_fixed_reply_start || '09:00'}
                              onChange={(e) => setSetting({ ...setting, group_fixed_reply_start: e.target.value })}
                              className="rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                            />
                            <span className="text-text-muted">至</span>
                            <input
                              type="time"
                              value={setting.group_fixed_reply_end || '18:00'}
                              onChange={(e) => setSetting({ ...setting, group_fixed_reply_end: e.target.value })}
                              className="rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                            />
                          </div>
                        </div>

                        {/* 固定回复群列表 */}
                        <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
                          <h3 className="mb-1 text-sm font-medium text-text-primary">固定回复群列表</h3>
                          <p className="mb-3 text-xs text-text-muted">固定回复功能生效的群（输入群ID，留空则对所有群生效）</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={groupFixedRoomInput}
                              onChange={(e) => setGroupFixedRoomInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') addGroupFixedRoom() }}
                              placeholder="输入群ID..."
                              className="flex-1 rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                            />
                            <button
                              onClick={addGroupFixedRoom}
                              className="flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover"
                            >
                              <Plus className="h-4 w-4" />
                              添加
                            </button>
                          </div>
                          {setting.group_fixed_reply_rooms.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {setting.group_fixed_reply_rooms.map((rid, i) => (
                                <span
                                  key={i}
                                  className="flex items-center gap-1 rounded-lg bg-bg-hover px-3 py-1.5 text-sm text-text-secondary"
                                >
                                  {rid}
                                  <button
                                    onClick={() => removeGroupFixedRoom(i)}
                                    className="ml-1 text-text-muted hover:text-red-400"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* 保存按钮 */}
                <div className="flex items-center justify-end gap-3 pb-6">
                  {savedMsg && (
                    <span className="text-sm text-green-400">保存成功</span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white shadow-glow transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saving ? '保存中...' : '保存设置'}
                  </button>
                </div>
              </div>
            </div>
          )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// BoardTab — 数据看板（4 区块 + 时间筛选 + 趋势图 + 饼图）
// ============================================================

type RangeKey = 'last_1_day' | 'last_3_days' | 'last_7_days' | 'custom'

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'last_1_day', label: '昨日' },
  { key: 'last_3_days', label: '最近3天' },
  { key: 'last_7_days', label: '最近7天' },
  { key: 'custom', label: '自定义' },
]

/** 趋势折线图（SVG） */
function TrendChart({ data, color = '#3b82f6' }: { data: DashboardTrendPoint[]; color?: string }) {
  if (!data || data.length === 0) {
    return <div className="flex h-[120px] items-center justify-center text-xs text-text-muted">暂无趋势数据</div>
  }
  const W = 560, H = 120, PAD = { top: 10, right: 10, bottom: 20, left: 10 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const values = data.map(d => d.value)
  const maxVal = Math.max(...values, 1)
  const minVal = Math.min(...values, 0)
  const range = maxVal - minVal || 1
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW
  const points = data.map((d, i) => {
    const x = PAD.left + i * stepX
    const y = PAD.top + innerH - ((d.value - minVal) / range) * innerH
    return { x, y, ...d }
  })
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${PAD.top + innerH} L ${points[0].x.toFixed(1)} ${PAD.top + innerH} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 140 }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={color} />
          {(data.length <= 7 || i === 0 || i === data.length - 1) && (
            <text x={p.x} y={H - 4} textAnchor="middle" className="fill-text-muted" style={{ fontSize: 9 }}>
              {p.date.slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

/** 饼图（SVG） */
function MessagePie({ sent, received }: { sent: number; received: number }) {
  const total = sent + received
  if (total === 0) {
    return (
      <div className="flex h-[140px] flex-col items-center justify-center gap-1 text-xs text-text-muted">
        <p>暂无数据</p>
      </div>
    )
  }
  const cx = 70, cy = 70, r = 55
  const sentAngle = (sent / total) * Math.PI * 2
  const sentEndX = cx + r * Math.sin(sentAngle)
  const sentEndY = cy - r * Math.cos(sentAngle)
  const largeArc = sentAngle > Math.PI ? 1 : 0
  const sentPath = `M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${sentEndX} ${sentEndY} L ${cx} ${cy} Z`
  const recvPath = `M ${sentEndX} ${sentEndY} A ${r} ${r} 0 ${largeArc === 1 ? 0 : 1} 1 ${cx} ${cy - r} L ${cx} ${cy} Z`
  const sentPct = Math.round((sent / total) * 100)
  const recvPct = 100 - sentPct
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 140 140" width="140" height="140">
        <path d={sentPath} fill="#3b82f6" />
        <path d={recvPath} fill="#22c55e" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="fill-text-primary" style={{ fontSize: 11, fontWeight: 700 }}>
          {total}
        </text>
      </svg>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ background: '#3b82f6' }} />
          <span className="text-xs text-text-secondary">发送 {sentPct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ background: '#22c55e' }} />
          <span className="text-xs text-text-secondary">接收 {recvPct}%</span>
        </div>
      </div>
    </div>
  )
}

/** 统计卡片 */
function DashCard({
  label,
  value,
  color = '#3b82f6',
  selected,
  onClick,
}: {
  label: string
  value: number
  color?: string
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-lg border p-3 text-left transition-colors ${selected ? 'border-transparent' : 'border-border-subtle hover:border-border-default'}`}
      style={selected ? { background: color } : undefined}
    >
      <p className={`text-xs ${selected ? 'text-white/80' : 'text-text-muted'}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold ${selected ? 'text-white' : 'text-text-primary'}`}>{value}</p>
      {selected && (
        <span className="absolute bottom-0 right-0" style={{
          width: 0, height: 0,
          borderLeft: '10px solid transparent',
          borderBottom: `10px solid ${color}`,
        }} />
      )}
    </button>
  )
}

/** 区块容器（左侧蓝色竖线） */
function BlockSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="block h-4 w-1 rounded-full bg-blue-500" />
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function BoardTab() {
  const api = getApiClient()
  const [dashboard, setDashboard] = useState<MarketingDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rangeKey, setRangeKey] = useState<RangeKey>('last_7_days')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  // 每区块选中的指标
  const [exposureMetric, setExposureMetric] = useState<string>('total_exposure')
  const [replyMetric, setReplyMetric] = useState<string>('total_reply')
  const [customerMetric, setCustomerMetric] = useState<string>('total_contacts')

  const buildParams = useCallback((key: RangeKey) => {
    if (key === 'custom') {
      return { range: 'custom', start_date: customStart, end_date: customEnd }
    }
    return { range: key }
  }, [customStart, customEnd])

  const loadDashboard = useCallback(async (key: RangeKey) => {
    setLoading(true)
    setError(null)
    try {
      const params = buildParams(key)
      const res = await api.marketing.dashboard.get(params)
      if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
        setDashboard(res.data as MarketingDashboard)
      } else {
        setError(res.msg || '加载看板数据失败')
      }
    } catch {
      setError('网络错误，无法加载看板数据')
    } finally {
      setLoading(false)
    }
  }, [api, buildParams])

  useEffect(() => {
    if (rangeKey !== 'custom' || (customStart && customEnd)) {
      loadDashboard(rangeKey)
    }
  }, [rangeKey, customStart, customEnd, loadDashboard])

  const handleRangeChange = (key: RangeKey) => {
    setRangeKey(key)
    if (key !== 'custom') {
      loadDashboard(key)
    }
  }

  // 趋势图取区块整体趋势数据
  const getTrendData = (block: MarketingDashboard['exposure'] | MarketingDashboard['reply'] | MarketingDashboard['customer'] | MarketingDashboard['message']): DashboardTrendPoint[] => {
    if ('trend' in block) return (block as { trend: DashboardTrendPoint[] }).trend
    return []
  }

  if (loading && !dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
        <Activity className="h-10 w-10 opacity-30" />
        <p className="text-sm">{error || '暂无数据'}</p>
        <button
          onClick={() => loadDashboard(rangeKey)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover"
        >
          <RefreshCw className="h-4 w-4" />
          重新加载
        </button>
      </div>
    )
  }

  const exposureCards = [
    { key: 'total_exposure', label: '累计曝光次数', value: dashboard.exposure.total_exposure },
    { key: 'ai_greeting', label: 'AI自动打招呼次数', value: dashboard.exposure.ai_greeting },
    { key: 'ai_nurturing', label: 'AI新客培育次数', value: dashboard.exposure.ai_nurturing },
    { key: 'ai_mass_send', label: 'AI精准群发次数', value: dashboard.exposure.ai_mass_send },
    { key: 'ai_moments', label: 'AI发朋友圈次数', value: dashboard.exposure.ai_moments },
    { key: 'ai_tracking', label: 'AI追踪激活人数', value: dashboard.exposure.ai_tracking },
  ]
  const replyCards = [
    { key: 'total_reply', label: '累计激活回复数据', value: dashboard.reply.total_reply },
    { key: 'nurturing_reply', label: 'AI新客培育回复次数', value: dashboard.reply.nurturing_reply },
    { key: 'mass_send_reply', label: 'AI精准群发回复次数', value: dashboard.reply.mass_send_reply },
    { key: 'tracking_reply', label: 'AI跟踪激活回复次数', value: dashboard.reply.tracking_reply },
  ]
  const customerCards = [
    { key: 'total_contacts', label: '累计客户人数', value: dashboard.customer.total_contacts },
    { key: 'high_intent', label: '高意向客户人数', value: dashboard.customer.high_intent },
    { key: 'medium_intent', label: '中意向客户人数', value: dashboard.customer.medium_intent },
    { key: 'total_groups', label: '累计客户群总数', value: dashboard.customer.total_groups },
    { key: 'new_groups', label: '新增客户群数量', value: dashboard.customer.new_groups },
    { key: 'new_contacts', label: '新增客户人数', value: dashboard.customer.new_contacts },
  ]

  const exposureMetricLabel = exposureCards.find(c => c.key === exposureMetric)?.label || '累计曝光次数'
  const replyMetricLabel = replyCards.find(c => c.key === replyMetric)?.label || '累计激活回复数据'
  const customerMetricLabel = customerCards.find(c => c.key === customerMetric)?.label || '累计客户人数'

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* 顶部：时间筛选器 + 刷新 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => handleRangeChange(opt.key)}
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  rangeKey === opt.key
                    ? 'bg-blue-500 text-white'
                    : 'border border-border-subtle text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {rangeKey === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="rounded-lg border border-border-subtle bg-transparent px-2 py-1 text-xs text-text-primary"
                />
                <span className="text-xs text-text-muted">~</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="rounded-lg border border-border-subtle bg-transparent px-2 py-1 text-xs text-text-primary"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>{dashboard.start_date} ~ {dashboard.end_date}</span>
            <button
              onClick={() => loadDashboard(rangeKey)}
              className="flex items-center gap-1 rounded-lg border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </button>
          </div>
        </div>

        {/* 区块1：AI 曝光数据 */}
        <BlockSection title="AI 曝光数据">
          <div className="grid grid-cols-6 gap-3">
            {exposureCards.map(c => (
              <DashCard
                key={c.key}
                label={c.label}
                value={c.value}
                selected={exposureMetric === c.key}
                onClick={() => setExposureMetric(c.key)}
              />
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-text-secondary">{exposureMetricLabel}趋势</span>
              <span className="text-xs text-text-muted">按日期</span>
            </div>
            <TrendChart data={getTrendData(dashboard.exposure)} color="#3b82f6" />
          </div>
        </BlockSection>

        {/* 区块2：AI 激活回复数据 */}
        <BlockSection title="AI 激活回复数据">
          <div className="grid grid-cols-4 gap-3">
            {replyCards.map(c => (
              <DashCard
                key={c.key}
                label={c.label}
                value={c.value}
                color="#8b5cf6"
                selected={replyMetric === c.key}
                onClick={() => setReplyMetric(c.key)}
              />
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-text-secondary">{replyMetricLabel}趋势</span>
              <span className="text-xs text-text-muted">按日期</span>
            </div>
            <TrendChart data={getTrendData(dashboard.reply)} color="#8b5cf6" />
          </div>
        </BlockSection>

        {/* 区块3：客户数据 */}
        <BlockSection title="客户数据">
          <div className="grid grid-cols-6 gap-3">
            {customerCards.map(c => (
              <DashCard
                key={c.key}
                label={c.label}
                value={c.value}
                color="#f59e0b"
                selected={customerMetric === c.key}
                onClick={() => setCustomerMetric(c.key)}
              />
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-text-secondary">{customerMetricLabel}趋势</span>
              <span className="text-xs text-text-muted">按日期</span>
            </div>
            <TrendChart data={getTrendData(dashboard.customer)} color="#f59e0b" />
          </div>
        </BlockSection>

        {/* 区块4：沟通消息数据 */}
        <BlockSection title="沟通消息数据">
          <div className="grid grid-cols-3 gap-4">
            {/* 左列：3 个堆叠卡片 */}
            <div className="col-span-1 space-y-3">
              <div className="rounded-lg p-4" style={{ background: '#3b82f6' }}>
                <p className="text-xs text-white/80">累计消息数</p>
                <p className="mt-1 text-2xl font-bold text-white">{dashboard.message.total_messages}</p>
              </div>
              <div className="rounded-lg p-4" style={{ background: '#f97316' }}>
                <p className="text-xs text-white/80">发送消息数</p>
                <p className="mt-1 text-2xl font-bold text-white">{dashboard.message.sent_messages}</p>
              </div>
              <div className="rounded-lg p-4" style={{ background: '#22c55e' }}>
                <p className="text-xs text-white/80">接收消息数</p>
                <p className="mt-1 text-2xl font-bold text-white">{dashboard.message.received_messages}</p>
              </div>
            </div>
            {/* 右列：饼图 */}
            <div className="col-span-2 flex items-center justify-center rounded-lg border border-border-subtle p-4">
              <MessagePie sent={dashboard.message.sent_messages} received={dashboard.message.received_messages} />
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-text-secondary">消息趋势</span>
              <span className="text-xs text-text-muted">按日期</span>
            </div>
            <TrendChart data={dashboard.message.trend} color="#06b6d4" />
          </div>
        </BlockSection>
      </div>
    </div>
  )
}

// ============================================================
// ============================================================
// ChatTab — 跟客聊天（对接真实后端 API）
// ============================================================

function ChatTab() {
  const api = getApiClient()

  // —— 状态 ——
  const [devices, setDevices] = useState<WecomDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const [devicesLoading, setDevicesLoading] = useState(true)

  const [contacts, setContacts] = useState<WecomContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null)
  const [groups, setGroups] = useState<WecomGroupRoom[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [showGroupMembers, setShowGroupMembers] = useState(false)
  const [groupMembers, setGroupMembers] = useState<{
    room_id: number
    name: string
    member_count: number
    members: Array<{
      external_userid: string
      contact_id: number | null
      name: string
      avatar: string
      contact_source: string
      is_external: boolean
      is_owner: boolean
    }>
  } | null>(null)
  const [groupMembersLoading, setGroupMembersLoading] = useState(false)

  // —— @ 提及群成员功能（参考微信） ——
  const [showAtPicker, setShowAtPicker] = useState(false)
  const [atSearchText, setAtSearchText] = useState('')
  const [atMentionStartPos, setAtMentionStartPos] = useState(-1)
  const atPickerRef = useRef<HTMLDivElement | null>(null)

  const [messages, setMessages] = useState<WecomMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesRefreshing, setMessagesRefreshing] = useState(false)

  const [search, setSearch] = useState('')
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [onlyAiHosted, setOnlyAiHosted] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  // 草稿持久化：防抖定时器引用
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [togglingAi, setTogglingAi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 联系人列表宽度（可拖拽收缩）
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const sidebarResizingRef = useRef(false)
  const sidebarResizeStartXRef = useRef(0)
  const sidebarResizeStartWidthRef = useRef(320)

  // —— 表情/图片/文件/语音 ——
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [sendingMedia, setSendingMedia] = useState(false)
  // 正在撤回的消息 ID 集合（防止重复点击 + 显示“努力撤回中”）
  const [recallingMessageIds, setRecallingMessageIds] = useState<Set<number>>(new Set())
  // 右键菜单（联系人）
  const [contextMenu, setContextMenu] = useState<{ contactId: number; x: number; y: number } | null>(null)
  // 右键菜单（消息）
  const [msgContextMenu, setMsgContextMenu] = useState<{ messageId: number; x: number; y: number } | null>(null)
  // 联系人多选模式
  const [contactMultiSelect, setContactMultiSelect] = useState(false)
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set())
  // 已读联系人跟踪：记录每个联系人最后已读时间，用于红点提示
  const [lastReadAtMap, setLastReadAtMap] = useState<Record<number, string>>({})
  // 未读消息计数：记录每个联系人的未读消息数（近似值，每次轮询检测到 last_message_time 变化时 +1）
  const [unreadCountMap, setUnreadCountMap] = useState<Record<number, number>>({})
  // 记录上次轮询时各联系人的 last_message_time，用于检测变化
  const prevMsgTimeRef = useRef<Record<number, string | null>>({})
  // 消息多选模式
  const [msgMultiSelect, setMsgMultiSelect] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(new Set())
  // 收藏面板
  const [showFavoritesPanel, setShowFavoritesPanel] = useState(false)
  const [favoritesList, setFavoritesList] = useState<any[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [favoritesCategory, setFavoritesCategory] = useState<string>('all')
  // 营销素材面板
  const [showMediaPickerPanel, setShowMediaPickerPanel] = useState(false)
  const [mediaAssets, setMediaAssets] = useState<any[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [activeMediaTab, setActiveMediaTab] = useState<string>('image')
  // 联系人选择弹窗（转发/群发共用）
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [contactPickerMode, setContactPickerMode] = useState<'forward' | 'massSend'>('forward')
  const [contactPickerMessageId, setContactPickerMessageId] = useState<number | null>(null)
  const [contactPickerSearch, setContactPickerSearch] = useState('')
  const [contactPickerSelected, setContactPickerSelected] = useState<Set<number>>(new Set())
  // 引用消息
  const [quotedMessage, setQuotedMessage] = useState<WecomMessage | null>(null)
  // P3-B: 消息悬浮工具栏 — 当前 hover 的消息 ID
  const [hoveredMsgId, setHoveredMsgId] = useState<number | null>(null)
  // P4-A: 滚动到底部浮动按钮 — 是否在底部 + 滚动期间累积的未读消息数
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [scrollUpUnreadCount, setScrollUpUnreadCount] = useState(0)
  // P4-C: 网络状态
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  // P5-C: AI 正在输入状态
  const [aiTypingContactId, setAiTypingContactId] = useState<number | null>(null)
  const [aiTypingRoomId, setAiTypingRoomId] = useState<number | null>(null)
  // P4-B: textarea 自适应高度 ref
  const textareaAutoResizeRef = useRef<HTMLTextAreaElement | null>(null)
  // 编辑好友姓名
  const [isEditingContactName, setIsEditingContactName] = useState(false)
  const [editingContactName, setEditingContactName] = useState('')
  const [pendingMedia, setPendingMedia] = useState<
    | { type: 'image'; file: File; previewUrl: string }
    | { type: 'file'; file: File }
    | { type: 'voice'; file: File; voiceTime: number }
    | null
  >(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingImageUrlRef = useRef<string | null>(null)
  const voiceRecordingContactIdRef = useRef<number | null>(null)
  const voiceTranscriptRef = useRef('')
  const voiceStartIndexRef = useRef(0)

  // 语音输入：录制后转文字写入输入框
  const { listening: isRecordingVoice, transcribing: isTranscribingVoice, toggleListening: toggleVoiceRecording } = useVoiceRecorder({
    onTranscript: (text) => {
      // 仅在录音时对应的联系人仍未切换时才写入，防止转写延迟导致写到别的联系人
      if (voiceRecordingContactIdRef.current !== null && voiceRecordingContactIdRef.current !== selectedContactId) return
      // 用新的转写结果替换本次录音已写入的旧结果，避免 Web Speech 多次回调导致重复追加
      setInput((prev) => {
        const before = prev.slice(0, voiceStartIndexRef.current).trim()
        voiceTranscriptRef.current = text
        return before ? before + ' ' + text : text
      })
    },
    onError: (msg) => setError(msg),
    preferWebSpeech: true,
  })

  // 语音消息：录制后直接发送语音文件
  const [isRecordingVoiceMsg, setIsRecordingVoiceMsg] = useState(false)
  const voiceMsgRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceMsgStreamRef = useRef<MediaStream | null>(null)
  const voiceMsgChunksRef = useRef<Blob[]>([])
  const voiceMsgStartTimeRef = useRef<number>(0)
  const voiceMsgTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceMsgSendRef = useRef(true)
  const voiceMsgSentRef = useRef(false)
  const voiceMsgAudioContextRef = useRef<AudioContext | null>(null)
  const voiceMsgAnalyserRef = useRef<AnalyserNode | null>(null)
  const voiceMsgVolumeLoopRef = useRef<number | null>(null)
  const [voiceMsgVolumes, setVoiceMsgVolumes] = useState<number[]>(Array(9).fill(0.2))

  // 媒体预览 / 播放
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [playingVoiceId, setPlayingVoiceId] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const startVoiceMsgRecording = async () => {
    if (selectedContactId === null || selectedDeviceId === null) return
    setError(null)
    setVoiceMsgVolumes(Array(9).fill(0.2))
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceMsgStreamRef.current = stream
      voiceMsgChunksRef.current = []
      voiceMsgStartTimeRef.current = Date.now()

      // 设置音量分析器
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 128
        analyser.smoothingTimeConstant = 0.6
        source.connect(analyser)
        voiceMsgAudioContextRef.current = audioContext
        voiceMsgAnalyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const updateVolume = () => {
          const a = voiceMsgAnalyserRef.current
          if (!a) return
          a.getByteFrequencyData(dataArray)
          const binCount = dataArray.length
          // 将频谱分成 9 段取平均值，归一化到 0~1
          const segmentSize = Math.max(1, Math.floor(binCount / 9))
          const volumes = Array.from({ length: 9 }).map((_, i) => {
            const start = i * segmentSize
            const end = Math.min(start + segmentSize, binCount)
            let sum = 0
            for (let j = start; j < end; j++) {
              sum += dataArray[j]
            }
            const avg = sum / (end - start)
            return Math.min(1, Math.max(0.15, avg / 180))
          })
          setVoiceMsgVolumes(volumes)
          voiceMsgVolumeLoopRef.current = requestAnimationFrame(updateVolume)
        }
        voiceMsgVolumeLoopRef.current = requestAnimationFrame(updateVolume)
      } catch {
        // 音量分析失败不影响录音主流程
      }

      const mimeTypeOrder = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ]
      let mimeType = ''
      for (const mt of mimeTypeOrder) {
        if (MediaRecorder.isTypeSupported(mt)) {
          mimeType = mt
          break
        }
      }
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          voiceMsgChunksRef.current.push(e.data)
        }
      }

      recorder.onerror = () => {
        setIsRecordingVoiceMsg(false)
        setError('录音出现错误，请重试')
      }

      recorder.onstop = () => {
        if (voiceMsgStreamRef.current) {
          voiceMsgStreamRef.current.getTracks().forEach((track) => track.stop())
          voiceMsgStreamRef.current = null
        }
        if (!voiceMsgSendRef.current) {
          // 用户取消，不发送
          voiceMsgSendRef.current = true
          return
        }
        // 防止 onstop 重复触发导致重复发送
        if (voiceMsgSentRef.current) return
        voiceMsgSentRef.current = true
        const finalMimeType = mimeType || 'audio/webm'
        const blob = new Blob(voiceMsgChunksRef.current, { type: finalMimeType })
        const duration = Math.round((Date.now() - voiceMsgStartTimeRef.current) / 1000)
        if (blob.size > 0 && duration > 0) {
          const ext = finalMimeType.includes('mp4') ? 'mp4' : 'webm'
          const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: finalMimeType })
          sendMediaMessage('voice', file, duration)
        } else if (blob.size === 0) {
          setError('未检测到音频输入')
        }
      }

      recorder.start()
      voiceMsgRecorderRef.current = recorder
      voiceMsgSentRef.current = false
      setIsRecordingVoiceMsg(true)

      // 最长 60 秒自动结束
      voiceMsgTimeoutRef.current = setTimeout(() => {
        if (voiceMsgRecorderRef.current?.state === 'recording') {
          stopVoiceMsgRecording()
        }
      }, 60000)
    } catch {
      setError('无法访问麦克风，请检查权限设置')
    }
  }

  const stopVoiceMsgRecording = (send = true) => {
    voiceMsgSendRef.current = send
    if (voiceMsgTimeoutRef.current) {
      clearTimeout(voiceMsgTimeoutRef.current)
      voiceMsgTimeoutRef.current = null
    }
    if (voiceMsgVolumeLoopRef.current) {
      cancelAnimationFrame(voiceMsgVolumeLoopRef.current)
      voiceMsgVolumeLoopRef.current = null
    }
    if (voiceMsgAnalyserRef.current) {
      voiceMsgAnalyserRef.current = null
    }
    if (voiceMsgAudioContextRef.current && voiceMsgAudioContextRef.current.state !== 'closed') {
      voiceMsgAudioContextRef.current.close().catch(() => {})
      voiceMsgAudioContextRef.current = null
    }
    const recorder = voiceMsgRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        // ignore
      }
    }
    setIsRecordingVoiceMsg(false)
  }

  // 切换联系人或卸载时停止语音消息录音与播放
  useEffect(() => {
    return () => {
      if (voiceMsgTimeoutRef.current) {
        clearTimeout(voiceMsgTimeoutRef.current)
      }
      if (voiceMsgVolumeLoopRef.current) {
        cancelAnimationFrame(voiceMsgVolumeLoopRef.current)
        voiceMsgVolumeLoopRef.current = null
      }
      if (voiceMsgAudioContextRef.current && voiceMsgAudioContextRef.current.state !== 'closed') {
        voiceMsgAudioContextRef.current.close().catch(() => {})
        voiceMsgAudioContextRef.current = null
      }
      if (voiceMsgRecorderRef.current?.state === 'recording') {
        try {
          voiceMsgRecorderRef.current.stop()
        } catch {
          // ignore
        }
      }
      if (voiceMsgStreamRef.current) {
        voiceMsgStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
        setPlayingVoiceId(null)
      }
    }
  }, [selectedContactId])

  // 语音消息播放
  const toggleVoicePlayback = (msg: WecomMessage) => {
    const url = msg.media_file_url
    if (!url) return
    if (playingVoiceId === msg.id && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingVoiceId(null)
      return
    }
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => {
      setPlayingVoiceId(null)
      audioRef.current = null
    }
    audio.onerror = () => {
      setError('语音播放失败')
      setPlayingVoiceId(null)
      audioRef.current = null
    }
    audio.play().then(() => {
      setPlayingVoiceId(msg.id)
    }).catch(() => {
      setError('语音播放失败')
      setPlayingVoiceId(null)
      audioRef.current = null
    })
  }

  // —— 设备绑定 / 同步好友 ——
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false)
  const [deviceStep, setDeviceStep] = useState<1 | 2>(1)
  const [deviceForm, setDeviceForm] = useState({
    guid: '',
    remark: '',
    mobile: '',
  })
  const [deviceId, setDeviceId] = useState<number | null>(null)
  const [deviceGuid, setDeviceGuid] = useState('')
  const [qrCodeData, setQrCodeData] = useState('')
  const [loginStatus, setLoginStatus] = useState<number | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [loginUserInfo, setLoginUserInfo] = useState<{ userId?: string; nickname?: string }>({})
  const [deviceLoading, setDeviceLoading] = useState(false)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const loginPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [syncingContacts, setSyncingContacts] = useState(false)

  // —— 设备右键菜单 ——
  const [deviceContextMenu, setDeviceContextMenu] = useState<{ deviceId: number; x: number; y: number } | null>(null)
  const [deviceDeleteConfirm, setDeviceDeleteConfirm] = useState<number | null>(null)
  const [deviceActionLoading, setDeviceActionLoading] = useState(false)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const isAtBottomRef = useRef(true) // P4-A: 镜像 isAtBottom 状态，供 useEffect 读取最新值
  const contactListRef = useRef<HTMLDivElement | null>(null)
  const selectedContactItemRef = useRef<HTMLButtonElement | null>(null)
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const contactsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sseRef = useRef<EventSource | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentContactIdRef = useRef<number | null>(null)
  const currentRoomIdRef = useRef<number | null>(null)
  const isSwitchingContactRef = useRef<boolean>(false)  // 标记是否正在切换会话（用于控制滚动行为）
  const messagesCacheRef = useRef<Record<string, WecomMessage[]>>({})  // 会话消息缓存（key: c{id}/r{id}），切换时即时展示

  // 会话缓存 key 生成
  const convKey = (contactId: number | null, roomId: number | null) =>
    contactId !== null ? `c${contactId}` : roomId !== null ? `r${roomId}` : ''

  // —— 加载设备列表 ——
  const loadDevices = useCallback(async () => {
    setDevicesLoading(true)
    setError(null)
    try {
      const res = await api.wecom.devices.list()
      if (res.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(res.data)) {
        const list = res.data as WecomDevice[]
        setDevices(list)
        if (list.length > 0 && selectedDeviceId === null) {
          setSelectedDeviceId(list[0].id)
        }
      } else {
        setDevices([])
        if (res.code !== API_BUSINESS_CODE.SUCCESS) {
          setError(res.msg || '加载设备失败')
        }
      }
    } catch {
      setDevices([])
      setError('网络错误，无法加载设备列表')
    } finally {
      setDevicesLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  // —— 重置设备绑定流程 ——
  const resetDeviceFlow = useCallback(() => {
    if (loginPollRef.current) {
      clearInterval(loginPollRef.current)
      loginPollRef.current = null
    }
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current)
      successTimerRef.current = null
    }
    setDeviceStep(1)
    setDeviceForm({ guid: '', remark: '', mobile: '' })
    setDeviceId(null)
    setDeviceGuid('')
    setQrCodeData('')
    setLoginStatus(null)
    setVerifyCode('')
    setLoginUserInfo({})
    setDeviceError(null)
    setLoginSuccess(false)
  }, [])

  // —— 组件卸载时清理轮询 ——
  useEffect(() => {
    return () => {
      if (loginPollRef.current) {
        clearInterval(loginPollRef.current)
        loginPollRef.current = null
      }
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
        successTimerRef.current = null
      }
    }
  }, [])

  // —— 步骤1：GUID 绑定设备 + 获取二维码 ——
  const handleNextStep = async () => {
    const { guid, remark, mobile } = deviceForm
    if (!guid.trim()) {
      setDeviceError('请输入 GUID 号')
      return
    }
    if (!mobile.trim()) {
      setDeviceError('请输入手机号')
      return
    }
    setDeviceLoading(true)
    setDeviceError(null)
    try {
      // 1. 用 GUID + 备注 + 手机号绑定设备（天网大脑预创建的企微号）
      const bindRes = await api.wecom.devices.bind({
        guid: guid.trim(),
        mobile: mobile.trim(),
        remark: remark.trim(),
      })
      if (bindRes.code !== API_BUSINESS_CODE.SUCCESS || !bindRes.data) {
        setDeviceError(bindRes.msg || '绑定设备失败，请检查 GUID 是否正确')
        return
      }
      const newDevice = bindRes.data as WecomDevice
      setDeviceId(newDevice.id)
      setDeviceGuid(guid.trim())

      // 2. 获取登录二维码
      const qrRes = await api.wecom.devices.getQrcode({
        guid: guid.trim(),
        device_id: newDevice.id,
      })
      if (qrRes.code !== API_BUSINESS_CODE.SUCCESS || !qrRes.data) {
        setDeviceError(qrRes.msg || '获取登录二维码失败')
        return
      }
      setQrCodeData(qrRes.data.loginQrcodeBase64Data)
      setDeviceStep(2)

      // 3. 开始轮询登录状态
      startLoginPolling(guid.trim(), newDevice.id)
    } catch {
      setDeviceError('网络错误，请重试')
    } finally {
      setDeviceLoading(false)
    }
  }

  // —— 轮询登录状态 ——
  const startLoginPolling = (guid: string, devId: number) => {
    if (loginPollRef.current) clearInterval(loginPollRef.current)
    loginPollRef.current = setInterval(async () => {
      try {
        const res = await api.wecom.devices.checkLogin({ guid, device_id: devId })
        if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
          const status = res.data.loginQrcodeStatus
          setLoginStatus(status)
          if (res.data.userId) {
            setLoginUserInfo((prev) => ({ ...prev, userId: res.data!.userId }))
          }
          if (res.data.nickname) {
            setLoginUserInfo((prev) => ({ ...prev, nickname: res.data!.nickname }))
          }

          if (status === 2) {
            // 登录成功 — 自动完成绑定并关闭弹窗
            if (loginPollRef.current) {
              clearInterval(loginPollRef.current)
              loginPollRef.current = null
            }
            setLoginSuccess(true)
            if (deviceId) {
              setSelectedDeviceId(deviceId)
            }
            // 刷新设备列表 + 1.5s 后自动关闭弹窗
            loadDevices()
            if (successTimerRef.current) clearTimeout(successTimerRef.current)
            successTimerRef.current = setTimeout(() => {
              setShowAddDeviceModal(false)
              resetDeviceFlow()
            }, 1500)
          } else if (status === 4) {
            // 用户取消
            if (loginPollRef.current) {
              clearInterval(loginPollRef.current)
              loginPollRef.current = null
            }
            setDeviceError('用户取消了登录，请重新扫码')
          }
        }
      } catch {
        // 轮询失败静默忽略
      }
    }, 2000)
  }

  // —— 提交6位验证码 ——
  const handleVerifyCode = async () => {
    if (!verifyCode.trim() || verifyCode.trim().length !== 6) {
      setDeviceError('请输入6位验证码')
      return
    }
    setDeviceLoading(true)
    setDeviceError(null)
    try {
      const res = await api.wecom.devices.verifyCode({
        guid: deviceGuid,
        code: verifyCode.trim(),
        device_id: deviceId ?? undefined,
      })
      if (res.code !== API_BUSINESS_CODE.SUCCESS) {
        setDeviceError(res.msg || '验证码验证失败')
        return
      }
      // 验证后再次检查登录状态
      const checkRes = await api.wecom.devices.checkLogin({
        guid: deviceGuid,
        device_id: deviceId ?? undefined,
      })
      if (checkRes.code === API_BUSINESS_CODE.SUCCESS && checkRes.data) {
        const status = checkRes.data.loginQrcodeStatus
        setLoginStatus(status)
        if (status === 2) {
          // 登录成功 — 自动完成绑定并关闭弹窗
          if (loginPollRef.current) {
            clearInterval(loginPollRef.current)
            loginPollRef.current = null
          }
          setLoginSuccess(true)
          if (deviceId) {
            setSelectedDeviceId(deviceId)
          }
          loadDevices()
          if (successTimerRef.current) clearTimeout(successTimerRef.current)
          successTimerRef.current = setTimeout(() => {
            setShowAddDeviceModal(false)
            resetDeviceFlow()
          }, 1500)
        }
      }
    } catch {
      setDeviceError('网络错误，验证码验证失败')
    } finally {
      setDeviceLoading(false)
    }
  }

  // —— 设备右键菜单：退出登录 ——
  const handleDeviceLogout = async (deviceId: number) => {
    setDeviceContextMenu(null)
    setDeviceActionLoading(true)
    try {
      const res = await api.wecom.devices.logout(deviceId)
      if (res.code === API_BUSINESS_CODE.SUCCESS) {
        await loadDevices()
      }
    } catch {
      // 静默
    } finally {
      setDeviceActionLoading(false)
    }
  }

  // —— 设备右键菜单：登录（弹出二维码扫码） ——
  const handleDeviceLogin = async (deviceId: number) => {
    setDeviceContextMenu(null)
    const device = devices.find((d) => d.id === deviceId)
    if (!device) return
    // 重置流程并跳到步骤 2
    resetDeviceFlow()
    setDeviceGuid(device.guid)
    setDeviceId(device.id)
    setShowAddDeviceModal(true)
    setDeviceStep(2)
    setDeviceLoading(true)
    setDeviceError(null)
    try {
      const qrRes = await api.wecom.devices.getQrcode({
        guid: device.guid,
        device_id: device.id,
      })
      if (qrRes.code === API_BUSINESS_CODE.SUCCESS && qrRes.data) {
        setQrCodeData(qrRes.data.loginQrcodeBase64Data)
        startLoginPolling(device.guid, device.id)
      } else {
        setDeviceError(qrRes.msg || '获取登录二维码失败')
      }
    } catch {
      setDeviceError('网络错误，请重试')
    } finally {
      setDeviceLoading(false)
    }
  }

  // —— 设备右键菜单：删除 ——
  const handleDeviceDelete = async (deviceId: number) => {
    setDeviceDeleteConfirm(null)
    setDeviceActionLoading(true)
    try {
      await api.wecom.devices.delete(deviceId)
      // 如果删除的是当前选中的设备，切换到第一个
      if (selectedDeviceId === deviceId) {
        setSelectedDeviceId(null)
        setSelectedContactId(null)
        setSelectedRoomId(null)
      }
      await loadDevices()
    } catch {
      // 静默
    } finally {
      setDeviceActionLoading(false)
    }
  }

  // —— 从第三方企微同步当前设备的好友 ——
  const handleSyncContacts = async () => {
    if (selectedDeviceId === null) return
    setSyncingContacts(true)
    setError(null)
    try {
      const res = await api.wecom.sync.contacts(selectedDeviceId)
      if (res.code === API_BUSINESS_CODE.SUCCESS) {
        // 同步完成后刷新联系人列表（后端已自动同步群聊，前端直接刷新）
        await loadContacts(selectedDeviceId)
      } else {
        setError(res.msg || '同步好友失败')
      }
    } catch {
      setError('网络错误，同步好友失败')
    } finally {
      setSyncingContacts(false)
    }
  }

  // —— 加载联系人列表（设备切换时） ——
  const loadContacts = useCallback(async (deviceId: number, silent = false) => {
    if (!silent) setContactsLoading(true)
    if (!silent) setError(null)
    try {
      const res = await api.wecom.contacts.list({ device_id: deviceId, page: 1, page_size: 500 })
      if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
        const list = (res.data as { list: unknown[] }).list as WecomContact[]
        setContacts(list || [])
        // 首次加载的联系人标记为已读，避免页面一打开就全部红点
        if (list && list.length > 0) {
          setLastReadAtMap((prev) => {
            const next = { ...prev }
            let changed = false
            const now = new Date().toISOString()
            list.forEach((c) => {
              if (!next[c.id]) {
                next[c.id] = now
                changed = true
              }
            })
            return changed ? next : prev
          })
          // 轮询时检测 last_message_time 变化，为非当前选中联系人增加未读计数
          const currentSelected = currentContactIdRef.current
          const isFirstLoad = Object.keys(prevMsgTimeRef.current).length === 0
          setUnreadCountMap((prev) => {
            const next = { ...prev }
            let changed = false
            list.forEach((c) => {
              const prevTime = prevMsgTimeRef.current[c.id] ?? null
              const currTime = c.last_message_time ?? null
              // 首次加载只初始化 prevMsgTime，不计数
              // 后续轮询：last_message_time 变化 → 有新消息
              if (!isFirstLoad && currTime && prevTime !== null && currTime !== prevTime) {
                if (currentSelected !== c.id) {
                  next[c.id] = (next[c.id] || 0) + 1
                  changed = true
                }
              }
              prevMsgTimeRef.current[c.id] = currTime
            })
            return changed ? next : prev
          })
        }
      } else if (!silent) {
        setContacts([])
      }
      // 同时加载群聊列表
      const groupRes = await api.wecom.groups.list({ device_id: deviceId })
      if (groupRes.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(groupRes.data)) {
        setGroups(groupRes.data as WecomGroupRoom[])
      } else {
        setGroups([])
      }
    } catch {
      if (!silent) {
        setContacts([])
        setError('网络错误，无法加载联系人')
      }
    } finally {
      if (!silent) setContactsLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (selectedDeviceId !== null) {
      // 切换设备时重置选中会话，等待加载后自动选第一个
      setSelectedContactId(null)
      setSelectedRoomId(null)
      setMessages([])
      loadContacts(selectedDeviceId)
    }
  }, [selectedDeviceId, loadContacts])

  // —— 联系人列表加载后自动选中第一个（仅设备切换时） ——
  const contactsLoadedForDeviceRef = useRef<number | null>(null)
  useEffect(() => {
    if (selectedDeviceId === null) return
    // 当前选中的联系人仍在列表中，保持不动（不覆盖用户选择）
    if (selectedContactId !== null && contacts.some((c) => c.id === selectedContactId)) return
    // 当前选中的群聊仍在列表中，保持不动
    if (selectedRoomId !== null && groups.some((g) => g.id === selectedRoomId)) return
    // 列表不为空且列来自当前设备，自动选第一个
    if (contacts.length > 0) {
      // 仅当没有选中或设备切换导致列表变化时自动选
      if (contactsLoadedForDeviceRef.current !== selectedDeviceId) {
        contactsLoadedForDeviceRef.current = selectedDeviceId
        setSelectedContactId(contacts[0].id)
      }
    }
  }, [contacts, groups, selectedDeviceId, selectedContactId, selectedRoomId])

  // —— 打开群成员面板时拉取群成员详情（含真实姓名/头像/来源）——
  useEffect(() => {
    if (!showGroupMembers || selectedRoomId === null) return
    let cancelled = false
    setGroupMembersLoading(true)
    ;(async () => {
      try {
        const res = await api.wecom.groups.members(selectedRoomId)
        if (cancelled) return
        if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
          setGroupMembers(res.data as never)
        } else {
          setGroupMembers(null)
        }
      } catch {
        if (!cancelled) setGroupMembers(null)
      } finally {
        if (!cancelled) setGroupMembersLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [showGroupMembers, selectedRoomId, api])

  // 切换群聊/关闭面板时清空数据
  useEffect(() => {
    if (!showGroupMembers) {
      setGroupMembers(null)
    }
  }, [showGroupMembers])

  // —— 加载消息列表（联系人/群聊切换时） ——
  const loadMessages = useCallback(async (contactId: number | null, roomId: number | null, silent = false) => {
    const key = convKey(contactId, roomId)
    currentContactIdRef.current = contactId
    currentRoomIdRef.current = roomId
    isSwitchingContactRef.current = true  // 标记正在切换会话
    const cached = messagesCacheRef.current[key]
    if (!silent) {
      setMessagesLoading(true)
      if (!cached) setMessages([]) // 无缓存时才清空，避免白屏
    } else {
      setMessagesRefreshing(true)
    }
    try {
      const res = contactId !== null
        ? await api.wecom.messages.list({ contact_id: contactId, device_id: selectedDeviceId ?? undefined, limit: 50 })
        : await api.wecom.messages.list({ room_id: roomId!, device_id: selectedDeviceId ?? undefined, limit: 50 })
      // 忽略非当前会话的陈旧响应
      if (currentContactIdRef.current !== contactId || currentRoomIdRef.current !== roomId) return
      if (res.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(res.data)) {
        const newMsgs = res.data as WecomMessage[]
        setMessages(newMsgs)
        messagesCacheRef.current[key] = newMsgs
        // 加载消息后标记为已读（以最新一条消息时间为准）
        const latestTime = newMsgs.length > 0 ? newMsgs[newMsgs.length - 1].created_at : new Date().toISOString()
        if (contactId !== null) {
          setLastReadAtMap((prev) => ({ ...prev, [contactId]: latestTime }))
          // 选中联系人后清除未读计数
          setUnreadCountMap((prev) => (prev[contactId] ? { ...prev, [contactId]: 0 } : prev))
        }
      } else if (!cached) {
        setMessages([])
        messagesCacheRef.current[key] = []
        if (contactId !== null) {
          setLastReadAtMap((prev) => ({ ...prev, [contactId]: new Date().toISOString() }))
          setUnreadCountMap((prev) => (prev[contactId] ? { ...prev, [contactId]: 0 } : prev))
        }
      }
    } catch {
      if (currentContactIdRef.current === contactId && currentRoomIdRef.current === roomId) {
        if (!cached) {
          setMessages([])
          messagesCacheRef.current[key] = []
        }
      }
    } finally {
      if (currentContactIdRef.current === contactId && currentRoomIdRef.current === roomId) {
        setMessagesLoading(false)
        setMessagesRefreshing(false)
      }
    }
  }, [api, selectedDeviceId])

  // —— 加载草稿（切换会话时） ——
  const loadDraft = useCallback(async (contactId: number | null, roomId: number | null) => {
    if (contactId === null && roomId === null) {
      setInput('')
      return
    }
    try {
      const params = contactId !== null ? { contact_id: contactId } : { room_id: roomId! }
      const res = await api.wecom.drafts.get(params)
      if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
        setInput(res.data.content || '')
      } else {
        setInput('')
      }
    } catch {
      setInput('')
    }
  }, [api])

  // —— 防抖保存草稿 ——
  const saveDraftDebounced = useCallback((text: string, contactId: number | null, roomId: number | null) => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current)
    }
    draftTimerRef.current = setTimeout(async () => {
      if (contactId === null && roomId === null) return
      try {
        const params: { contact_id?: number; room_id?: number; content: string } = { content: text }
        if (contactId !== null) params.contact_id = contactId
        if (roomId !== null) params.room_id = roomId
        await api.wecom.drafts.save(params)
      } catch {
        // 静默失败，草稿保存不阻塞用户操作
      }
    }, 500)
  }, [api])

  // —— 清除草稿（发送消息后调用） ——
  const clearDraft = useCallback(async (contactId: number | null, roomId: number | null) => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current)
      draftTimerRef.current = null
    }
    if (contactId === null && roomId === null) return
    try {
      const params = contactId !== null ? { contact_id: contactId } : { room_id: roomId! }
      await api.wecom.drafts.delete(params)
    } catch {
      // 静默失败
    }
  }, [api])

  useEffect(() => {
    if (selectedContactId !== null) {
      const key = convKey(selectedContactId, null)
      const cached = messagesCacheRef.current[key]
      if (cached) {
        // 有缓存时先展示旧消息，再静默刷新
        setMessages(cached)
        loadMessages(selectedContactId, null, true)
      } else {
        loadMessages(selectedContactId, null, false)
      }
      // 加载草稿
      loadDraft(selectedContactId, null)
      // P5-B: 标记会话消息为已读
      api.wecom.markRead({ contact_id: selectedContactId }).catch(() => {})
    } else if (selectedRoomId !== null) {
      const key = convKey(null, selectedRoomId)
      const cached = messagesCacheRef.current[key]
      if (cached) {
        setMessages(cached)
        loadMessages(null, selectedRoomId, true)
      } else {
        loadMessages(null, selectedRoomId, false)
      }
      // 加载草稿
      loadDraft(null, selectedRoomId)
      // P5-B: 标记会话消息为已读
      api.wecom.markRead({ room_id: selectedRoomId }).catch(() => {})
    } else {
      currentContactIdRef.current = null
      currentRoomIdRef.current = null
      setMessages([])
      setInput('')
    }
    // 切换会话时清空待发送媒体和表情面板，防止误发
    clearPendingMedia()
    setShowEmojiPicker(false)
  }, [selectedContactId, selectedRoomId, loadMessages, loadDraft])

  // —— SSE 使用的滚动函数（独立于 messages useEffect） ——
  const scrollToBottomSSE = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior })
      } else {
        bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
      }
    })
  }, [])

  // —— 轮询新消息 ——
  const pollNewMessages = useCallback(async () => {
    if (selectedContactId === null && selectedRoomId === null) return
    const contactId = selectedContactId
    const roomId = selectedRoomId
    const key = convKey(contactId, roomId)
    try {
      const res = contactId !== null
        ? await api.wecom.messages.list({ contact_id: contactId, device_id: selectedDeviceId ?? undefined, limit: 50 })
        : await api.wecom.messages.list({ room_id: roomId!, device_id: selectedDeviceId ?? undefined, limit: 50 })
      // 忽略切换会话后仍返回的旧响应
      if (currentContactIdRef.current !== contactId || currentRoomIdRef.current !== roomId) return
      if (res.code === API_BUSINESS_CODE.SUCCESS && Array.isArray(res.data)) {
        const newMsgs = res.data as WecomMessage[]
        let hasNew = false
        setMessages((prev) => {
          // 仅在消息数量变化时快速判断
          if (newMsgs.length === prev.length && newMsgs.length > 0) {
            // 检查是否有任何状态变化（撤回、引用、内容变更等）
            const hasChanges = newMsgs.some((newMsg, idx) => {
              const prevMsg = prev[idx]
              if (!prevMsg) return true
              return (
                prevMsg.is_recalled !== newMsg.is_recalled ||
                prevMsg.quoted_message !== newMsg.quoted_message ||
                prevMsg.quoted_message_content !== newMsg.quoted_message_content ||
                prevMsg.content !== newMsg.content ||
                prevMsg.id !== newMsg.id
              )
            })
            if (!hasChanges) {
              const prevLast = prev[prev.length - 1]
              const newLast = newMsgs[newMsgs.length - 1]
              if (prevLast && newLast && prevLast.id === newLast.id) {
                return prev // 无任何变化，不更新
              }
            }
          }
          hasNew = newMsgs.length > 0 &&
            (newMsgs.length !== prev.length ||
              newMsgs[newMsgs.length - 1].id !== prev[prev.length - 1]?.id)
          messagesCacheRef.current[key] = newMsgs
          return newMsgs
        })
        // 同步更新当前联系人/群聊列表预览
        if (hasNew && newMsgs.length > 0) {
          const latest = newMsgs[newMsgs.length - 1]
          if (contactId !== null) {
            setContacts((prev) =>
              prev.map((c) =>
                c.id === contactId
                  ? {
                      ...c,
                      last_contacted_at: latest.created_at,
                      last_message_time: latest.created_at,
                      last_message: getMessagePreview(latest),
                      last_message_type: latest.msg_type,
                    }
                  : c
              )
            )
            // 当前正在查看该联系人，新消息直接标记为已读
            setLastReadAtMap((prev) => ({ ...prev, [contactId]: latest.created_at }))
            setUnreadCountMap((prev) => (prev[contactId] ? { ...prev, [contactId]: 0 } : prev))
          } else if (roomId !== null) {
            // 群聊：更新群聊的最后消息时间，确保会话列表能按新消息排序
            setGroups((prev) =>
              prev.map((g) =>
                g.id === roomId
                  ? {
                      ...g,
                      last_message_time: latest.created_at,
                      last_message: getMessagePreview(latest),
                      last_message_type: latest.msg_type,
                    }
                  : g
              )
            )
          }
        }
      }
    } catch {
      // 轮询失败静默处理
    }
  }, [api, selectedContactId, selectedRoomId, selectedDeviceId])

  useEffect(() => {
    if (selectedContactId !== null || selectedRoomId !== null) {
      // SSE 为主，轮询为辅（30s fallback）
      pollTimerRef.current = setInterval(pollNewMessages, 30000)
    }
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [selectedContactId, selectedRoomId, pollNewMessages])

  // —— P5-A: SSE 实时消息推送 ——
  useEffect(() => {
    if (selectedDeviceId === null) return

    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let isClosed = false

    const connectSSE = () => {
      if (isClosed) return
      try {
        const url = api.wecom.sseUrl(selectedDeviceId)
        const es = new EventSource(url)
        sseRef.current = es

        // 连接成功
        es.addEventListener('connected', () => {
          // eslint-disable-next-line no-console
          console.log('[SSE] Connected for device', selectedDeviceId)
        })

        // 新消息事件
        es.addEventListener('message', (e) => {
          try {
            const payload = JSON.parse(e.data)
            const msg: WecomMessage = payload.message
            if (!msg) return

            const msgContactId = payload.contact_id
            const msgRoomId = payload.room_id

            // 如果消息属于当前会话，更新 messages
            const curContact = currentContactIdRef.current
            const curRoom = currentRoomIdRef.current
            if (curContact !== null && msgContactId === curContact) {
              setMessages((prev) => {
                // 避免重复（乐观更新可能已添加）
                if (prev.some((m) => m.id === msg.id)) return prev
                if (msg.client_msg_id && prev.some((m) => m.client_msg_id === msg.client_msg_id)) {
                  return prev.map((m) => m.client_msg_id === msg.client_msg_id ? msg : m)
                }
                const updated = [...prev, msg]
                const key = convKey(curContact, null)
                messagesCacheRef.current[key] = updated
                return updated
              })
              // 更新联系人列表预览
              setContacts((prev) => prev.map((c) =>
                c.id === curContact
                  ? { ...c, last_contacted_at: msg.created_at, last_message_time: msg.created_at, last_message: getMessagePreview(msg), last_message_type: msg.msg_type }
                  : c
              ))
              // 如果是入站消息，标记已读
              if (msg.direction === 'inbound') {
                setLastReadAtMap((prev) => ({ ...prev, [curContact]: msg.created_at }))
                setUnreadCountMap((prev) => (prev[curContact] ? { ...prev, [curContact]: 0 } : prev))
              }
              // 如果是出站消息（AI 回复），清除 typing 状态
              if (msg.direction === 'outbound' && msg.ai_generated) {
                setAiTypingContactId(null)
                setAiTypingRoomId(null)
              }
              // 自动滚动到底部
              scrollToBottomSSE('smooth')
            } else if (curRoom !== null && msgRoomId === curRoom) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev
                if (msg.client_msg_id && prev.some((m) => m.client_msg_id === msg.client_msg_id)) {
                  return prev.map((m) => m.client_msg_id === msg.client_msg_id ? msg : m)
                }
                const updated = [...prev, msg]
                const key = convKey(null, curRoom)
                messagesCacheRef.current[key] = updated
                return updated
              })
              setGroups((prev) => prev.map((g) =>
                g.id === curRoom
                  ? { ...g, last_message_time: msg.created_at, last_message: getMessagePreview(msg), last_message_type: msg.msg_type }
                  : g
              ))
              if (msg.direction === 'outbound' && msg.ai_generated) {
                setAiTypingContactId(null)
                setAiTypingRoomId(null)
              }
              scrollToBottomSSE('smooth')
            } else {
              // 非当前会话：更新列表预览 + 未读计数
              if (msgContactId) {
                setContacts((prev) => prev.map((c) =>
                  c.id === msgContactId
                    ? { ...c, last_message_time: msg.created_at, last_message: getMessagePreview(msg), last_message_type: msg.msg_type }
                    : c
                ))
                if (msg.direction === 'inbound') {
                  setUnreadCountMap((prev) => ({ ...prev, [msgContactId]: (prev[msgContactId] || 0) + 1 }))
                }
              } else if (msgRoomId) {
                setGroups((prev) => prev.map((g) =>
                  g.id === msgRoomId
                    ? { ...g, last_message_time: msg.created_at, last_message: getMessagePreview(msg), last_message_type: msg.msg_type }
                    : g
                ))
              }
            }
          } catch { /* ignore parse errors */ }
        })

        // typing 事件（AI 正在输入）
        es.addEventListener('typing', (e) => {
          try {
            const payload = JSON.parse(e.data)
            const curContact = currentContactIdRef.current
            const curRoom = currentRoomIdRef.current
            if (payload.contact_id && payload.contact_id === curContact) {
              setAiTypingContactId(curContact)
              setAiTypingRoomId(null)
              // 10s 后自动清除
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
              typingTimeoutRef.current = setTimeout(() => {
                setAiTypingContactId(null)
              }, 10000)
            } else if (payload.room_id && payload.room_id === curRoom) {
              setAiTypingRoomId(curRoom)
              setAiTypingContactId(null)
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
              typingTimeoutRef.current = setTimeout(() => {
                setAiTypingRoomId(null)
              }, 10000)
            }
          } catch { /* ignore */ }
        })

        // read_receipt 事件（已读回执）
        es.addEventListener('read_receipt', (e) => {
          try {
            const payload = JSON.parse(e.data)
            const curContact = currentContactIdRef.current
            const curRoom = currentRoomIdRef.current
            if ((payload.contact_id && payload.contact_id === curContact) ||
                (payload.room_id && payload.room_id === curRoom)) {
              setMessages((prev) => prev.map((m) =>
                m.direction === 'outbound' && (m.status === 'sent' || m.status === 'delivered')
                  ? { ...m, status: 'read' as const }
                  : m
              ))
            }
          } catch { /* ignore */ }
        })

        // 错误处理 — 自动重连（3s 延迟）
        es.onerror = () => {
          if (isClosed) return
          // eslint-disable-next-line no-console
          console.warn('[SSE] Connection error, retrying in 3s...')
          es.close()
          sseRef.current = null
          retryTimer = setTimeout(connectSSE, 3000)
        }
      } catch {
        // EventSource 创建失败，3s 后重试
        retryTimer = setTimeout(connectSSE, 3000)
      }
    }

    connectSSE()

    return () => {
      isClosed = true
      if (retryTimer) clearTimeout(retryTimer)
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
    }
  }, [selectedDeviceId, api, scrollToBottomSSE])

  // —— 轮询刷新联系人列表（实时更新最后消息/未读） ——
  useEffect(() => {
    if (selectedDeviceId !== null) {
      contactsTimerRef.current = setInterval(() => {
        loadContacts(selectedDeviceId, true)  // silent: 不触发 loading 状态避免 UI 闪烁
      }, 30000)  // SSE 为主，轮询为辅
    }
    return () => {
      if (contactsTimerRef.current) {
        clearInterval(contactsTimerRef.current)
        contactsTimerRef.current = null
      }
    }
  }, [selectedDeviceId, loadContacts])

  // —— 自动滚动到底部 ——
  // 切换联系人时使用 instant（无动画），新消息时使用 smooth
  // P4-A: 用户向上滚动浏览历史消息时，不自动滚到底部（微信交互）
  useEffect(() => {
    const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior })
        } else {
          bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
        }
      })
    }
    if (isSwitchingContactRef.current) {
      // 切换联系人：立即跳到底部，不闪
      scrollToBottom('auto')
      isSwitchingContactRef.current = false
      isAtBottomRef.current = true
      setIsAtBottom(true)
      setScrollUpUnreadCount(0)
    } else if (isAtBottomRef.current) {
      // 新消息 + 用户在底部：平滑滚动
      scrollToBottom('smooth')
    } else {
      // P4-A: 用户不在底部时不自动滚动，累加未读计数
      setScrollUpUnreadCount((prev) => prev + 1)
    }
    // 用户不在底部时不自动滚动，由浮动按钮显示未读计数
  }, [messages])

  // —— 计算属性 ——
  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) || null,
    [contacts, selectedContactId]
  )

  const selectedRoom = useMemo(
    () => groups.find((g) => g.id === selectedRoomId) || null,
    [groups, selectedRoomId]
  )

  // 当前是否有选中的会话（联系人或群聊）
  const hasSelectedConversation = selectedContactId !== null || selectedRoomId !== null

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  )

  // 判断联系人是否有未读消息
  const isContactUnread = useCallback((contact: WecomContact) => {
    if (selectedContactId === contact.id) return false
    if (!contact.last_message_time) return false
    const lastRead = lastReadAtMap[contact.id]
    if (!lastRead) return false
    return new Date(contact.last_message_time).getTime() > new Date(lastRead).getTime()
  }, [lastReadAtMap, selectedContactId])

  // —— 合并联系人 + 群聊为统一会话列表，按微信规范排序（置顶 + 最新聊天时间）——
  // 参考微信：单聊和群聊混合排序，不分组
  const unifiedSessions = useMemo<UnifiedSession[]>(() => {    const sessions: UnifiedSession[] = []

    // 单聊会话
    let contactList = [...contacts]
    if (search.trim()) {
      const kw = search.trim().toLowerCase()
      contactList = contactList.filter(
        (c) =>
          c.name.toLowerCase().includes(kw) ||
          (c.remark && c.remark.toLowerCase().includes(kw)) ||
          (c.enterprise_id && c.enterprise_id.toLowerCase().includes(kw))
      )
    }
    if (onlyUnread) {
      contactList = contactList.filter((c) => isContactUnread(c))
    }
    if (onlyAiHosted) {
      contactList = contactList.filter((c) => c.ai_hosted)
    }
    for (const c of contactList) {
      sessions.push({
        session_key: `contact-${c.id}`,
        kind: 'contact',
        id: c.id,
        name: c.name,
        remark: c.remark,
        avatar: c.avatar,
        contact_source: c.contact_source,
        last_message: c.last_message || '',
        last_message_type: c.last_message_type || '',
        last_message_time: c.last_message_time || c.last_contacted_at || null,
        last_contacted_at: c.last_contacted_at,
        is_pinned: !!c.is_pinned,
        pinned_at: c.pinned_at || null,
        ai_hosted: !!c.ai_hosted,
        tags: c.tags,
        tags_display: c.tags_display,
        contact_ref: c,
      })
    }

    // 群聊会话（不受 onlyUnread/onlyAiHosted 影响）
    if (!onlyUnread && !onlyAiHosted) {
      let groupList = [...groups]
      if (search.trim()) {
        const kw = search.trim().toLowerCase()
        groupList = groupList.filter((g) => g.name.toLowerCase().includes(kw))
      }
      for (const g of groupList) {
        sessions.push({
          session_key: `group-${g.id}`,
          kind: 'group',
          id: g.id,
          name: g.name,
          member_count: g.member_count,
          member_user_ids: g.member_user_ids || [],
          last_message: g.last_message || '',
          last_message_type: g.last_message_type || '',
          last_message_time: g.last_message_time || null,
          is_pinned: false,
          pinned_at: null,
          ai_hosted: false,
          tags: g.tags,
          tags_display: g.tags_display,
          group_ref: g,
        })
      }
    }

    // 排序：置顶在前（pinned_at 降序），然后按最后消息时间降序
    return sessions.sort((a, b) => {
      // 置顶优先
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
      // 置顶组内按 pinned_at 降序
      if (a.is_pinned && b.is_pinned) {
        const aTime = a.pinned_at ? new Date(a.pinned_at).getTime() : 0
        const bTime = b.pinned_at ? new Date(b.pinned_at).getTime() : 0
        if (bTime !== aTime) return bTime - aTime
      }
      // 按最后消息时间降序（无消息时间用 0 兜底）
      const aTime = a.last_message_time ? new Date(a.last_message_time).getTime() : 0
      const bTime = b.last_message_time ? new Date(b.last_message_time).getTime() : 0
      if (bTime !== aTime) return bTime - aTime
      // 单聊（联系人）排在群聊之前（同时间时）
      if (a.kind !== b.kind) return a.kind === 'contact' ? -1 : 1
      return 0
    })
  }, [contacts, groups, search, onlyUnread, onlyAiHosted, isContactUnread])

  // 从 unifiedSessions 派生的纯联系人列表（用于多选模式等场景）
  const filteredContacts = useMemo(() => {
    return unifiedSessions
      .filter((s) => s.kind === 'contact' && s.contact_ref)
      .map((s) => s.contact_ref!)
  }, [unifiedSessions])

  // 当前选中的联系人被过滤掉时，自动切换到第一个可用联系人
  useEffect(() => {
    if (selectedContactId === null) return
    const stillExists = unifiedSessions.some(
      (s) => s.kind === 'contact' && s.id === selectedContactId
    )
    if (!stillExists) {
      const first = unifiedSessions.find((s) => s.kind === 'contact')
      setSelectedContactId(first?.id || null)
    }
  }, [unifiedSessions, selectedContactId])

  // 当前选中的群聊被过滤掉时，自动切换
  useEffect(() => {
    if (selectedRoomId === null) return
    const stillExists = unifiedSessions.some(
      (s) => s.kind === 'group' && s.id === selectedRoomId
    )
    if (!stillExists) {
      setSelectedRoomId(null)
    }
  }, [unifiedSessions, selectedRoomId])

  // —— 选中联系人变化时，滚动列表使其可见 ——
  // 只依赖 selectedContactId，不依赖 filteredContacts。
  // 原因：轮询刷新 contacts 会触发 filteredContacts 重新计算，
  //       如果依赖 filteredContacts，每次轮询都会尝试把列表滚回选中联系人，
  //       打断用户手动浏览。修复后仅在选中联系人真正改变时才自动滚动。
  useEffect(() => {
    if (selectedContactId === null) return
    requestAnimationFrame(() => {
      const item = selectedContactItemRef.current
      const list = contactListRef.current
      if (item && list) {
        const itemTop = item.offsetTop
        const itemBottom = itemTop + item.offsetHeight
        const listScrollTop = list.scrollTop
        const listHeight = list.clientHeight
        if (itemTop < listScrollTop || itemBottom > listScrollTop + listHeight) {
          list.scrollTo({ top: itemTop - listHeight / 2 + item.offsetHeight / 2, behavior: 'smooth' })
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContactId])

  // 切换联系人时退出姓名编辑模式
  useEffect(() => {
    setIsEditingContactName(false)
    setEditingContactName('')
  }, [selectedContactId])

  // —— 发送消息 ——
  const sendMessage = async () => {
    if (!hasSelectedConversation || selectedDeviceId === null) return
    const text = input.trim()

    // 优先发送待发送的媒体（图片/文件/语音）
    if (pendingMedia) {
      await sendMediaMessage(pendingMedia.type, pendingMedia.file, pendingMedia.type === 'voice' ? pendingMedia.voiceTime : undefined)
      // 媒体发送后，如果输入框还有文字，再追加一条文本消息
      if (text) {
        await sendTextMessage(text)
      }
      return
    }

    // 仅文本
    if (!text) return
    await sendTextMessage(text)
  }

  // —— 发送纯文本消息（乐观更新：先显示 sending，API 返回后更新为 sent） ——
  const sendTextMessage = async (text: string) => {
    if ((selectedContactId === null && selectedRoomId === null) || selectedDeviceId === null || !text.trim()) return
    setSending(true)
    const quoteId = quotedMessage?.id
    const key = convKey(selectedContactId, selectedRoomId)
    // 生成客户端消息 ID（乐观更新匹配用）
    const clientMsgId = crypto.randomUUID()
    const nowIso = new Date().toISOString()
    // 构造乐观消息（立即显示在聊天列表中，状态为 sending）
    const optimisticMsg: WecomMessage = {
      id: -Date.now(), // 临时负数 ID，避免与真实消息冲突
      tenant: '',
      device: selectedDeviceId,
      device_name: '',
      contact: selectedContactId,
      contact_name: selectedContact?.name || '',
      contact_avatar: selectedContact?.avatar || '',
      room: selectedRoomId,
      room_name: selectedRoom ? selectedRoom.name : null,
      conversation_type: selectedContactId !== null ? 'personal' : 'group',
      conversation_type_display: selectedContactId !== null ? '单聊' : '群聊',
      sender_name: selectedDevice?.name || null,
      direction: 'outbound',
      direction_display: '发出',
      msg_type: 'text',
      msg_type_display: '文本',
      content: text,
      media_file: null,
      media_file_url: null,
      raw_data: {},
      ai_generated: false,
      is_recalled: false,
      client_msg_id: clientMsgId,
      status: 'sending',
      quoted_message: quoteId ?? null,
      quoted_message_content: quotedMessage?.content ?? null,
      quoted_message_contact_name: quotedMessage?.contact_name ?? null,
      quoted_message_direction: quotedMessage?.direction ?? null,
      quoted_message_created_at: quotedMessage?.created_at ?? null,
      created_at: nowIso,
    }
    // 立即添加到消息列表（乐观更新）
    setMessages((prev) => {
      const next = [...prev, optimisticMsg]
      messagesCacheRef.current[key] = next
      return next
    })
    setInput('')
    setQuotedMessage(null)
    // 清除草稿（发送后不需要草稿了）
    clearDraft(selectedContactId, selectedRoomId)
    // 立即更新会话列表排序（发送的会话排到顶部）
    updateConversationLastMessage('text', text, nowIso)

    try {
      const payload: Record<string, unknown> = {
        device_id: selectedDeviceId,
        msg_type: 'text',
        content: text,
        client_msg_id: clientMsgId,
      }
      if (selectedContactId !== null) {
        payload.contact_id = selectedContactId
      } else if (selectedRoomId !== null) {
        payload.room_id = selectedRoomId
      }
      if (quoteId) {
        payload.quoted_message_id = quoteId
      }
      const res = await api.wecom.messages.send(payload as { device_id: number; contact_id?: number; room_id?: number; msg_type: 'text' | 'image'; content: string; quoted_message_id?: number; client_msg_id?: string })
      if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
        const newMsg = res.data as WecomMessage
        // 用 client_msg_id 匹配乐观消息，替换为服务器返回的真实消息
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.client_msg_id === clientMsgId ? { ...newMsg } : m
          )
          messagesCacheRef.current[key] = next
          return next
        })
        // 用服务器返回的时间更新会话列表排序
        const serverTime = newMsg.created_at || nowIso
        updateConversationLastMessage('text', text, serverTime)
      } else {
        // 发送失败：标记消息为 failed
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.client_msg_id === clientMsgId ? { ...m, status: 'failed' as const } : m
          )
          messagesCacheRef.current[key] = next
          return next
        })
        setError(res.msg || '发送失败')
      }
    } catch {
      // 网络错误：标记消息为 failed
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.client_msg_id === clientMsgId ? { ...m, status: 'failed' as const } : m
        )
        messagesCacheRef.current[key] = next
        return next
      })
      setError('网络错误，发送失败')
    } finally {
      setSending(false)
    }
  }

  // —— 发送媒体消息（图片/文件/语音）——
  const sendMediaMessage = async (msgType: 'image' | 'file' | 'voice', file: File, voiceTime?: number) => {
    if ((selectedContactId === null && selectedRoomId === null) || selectedDeviceId === null || sendingMedia) return
    setSendingMedia(true)
    setError(null)
    const key = convKey(selectedContactId, selectedRoomId)
    try {
      const mediaData: Record<string, unknown> = {
        device_id: selectedDeviceId,
        msg_type: msgType,
        file,
      }
      if (selectedContactId !== null) mediaData.contact_id = selectedContactId
      if (selectedRoomId !== null) mediaData.room_id = selectedRoomId
      if (voiceTime !== undefined) mediaData.voice_time = voiceTime
      const res = await api.wecom.messages.sendMedia(mediaData as { device_id: number; contact_id?: number; room_id?: number; msg_type: 'image' | 'file' | 'voice'; file: File; voice_time?: number })
      if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
        const newMsg = res.data as WecomMessage
        setMessages((prev) => {
          const next = [...prev, newMsg]
          messagesCacheRef.current[key] = next
          return next
        })
        // 更新联系人/群聊最后消息信息
        const msgLabel = getMessagePreview(newMsg)
        const nowTime = newMsg.created_at || new Date().toISOString()
        updateConversationLastMessage(msgType, msgLabel, nowTime)
        // 发送成功后清空待发送媒体
        if (pendingMedia?.type === 'image' && pendingMedia.previewUrl) {
          URL.revokeObjectURL(pendingMedia.previewUrl)
        }
        if (pendingImageUrlRef.current) {
          URL.revokeObjectURL(pendingImageUrlRef.current)
          pendingImageUrlRef.current = null
        }
        setPendingMedia(null)
      } else {
        setError(res.msg || '发送失败')
      }
    } catch {
      setError('网络错误，发送失败')
    } finally {
      setSendingMedia(false)
    }
  }

  // —— 图片选择 ——
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 释放上一个预览 URL
      if (pendingImageUrlRef.current) {
        URL.revokeObjectURL(pendingImageUrlRef.current)
      }
      const previewUrl = URL.createObjectURL(file)
      pendingImageUrlRef.current = previewUrl
      setPendingMedia({ type: 'image', file, previewUrl })
      setShowEmojiPicker(false)
    }
    e.target.value = '' // 重置以允许重复选择同一文件
  }

  // —— 文件选择 ——
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPendingMedia({ type: 'file', file })
      setShowEmojiPicker(false)
    }
    e.target.value = ''
  }

  // —— 统一更新当前会话的最后消息时间（单聊或群聊）——
  // 用于所有发送场景：文本/图片/文件/语音/小程序/素材 发送成功后调用
  // 确保会话列表能按"新消息"正确排序（类似微信：收到/发送消息的会话排到顶部）
  const updateConversationLastMessage = useCallback((
    msgType: string,
    msgLabel: string,
    timestamp: string,
  ) => {
    if (selectedContactId !== null) {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === selectedContactId
            ? {
                ...c,
                last_contacted_at: timestamp,
                last_message_time: timestamp,
                last_message: msgLabel,
                last_message_type: msgType,
              }
            : c
        )
      )
      // 自己发送的消息不需要红点
      setLastReadAtMap((prev) => ({ ...prev, [selectedContactId]: timestamp }))
      setUnreadCountMap((prev) =>
        prev[selectedContactId] ? { ...prev, [selectedContactId]: 0 } : prev
      )
    } else if (selectedRoomId !== null) {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === selectedRoomId
            ? {
                ...g,
                last_message_time: timestamp,
                last_message: msgLabel,
                last_message_type: msgType,
              }
            : g
        )
      )
    }
  }, [selectedContactId, selectedRoomId])

  // —— 粘贴图片到输入框（Ctrl+V 发图）——
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!hasSelectedConversation || sendingMedia) return
    const items = e.clipboardData?.items
    if (!items || items.length === 0) return

    // 查找图片项
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        // 生成预览 URL
        if (pendingImageUrlRef.current) {
          URL.revokeObjectURL(pendingImageUrlRef.current)
        }
        const previewUrl = URL.createObjectURL(file)
        pendingImageUrlRef.current = previewUrl
        setPendingMedia({ type: 'image', file, previewUrl })
        setShowEmojiPicker(false)
        setShowMediaPickerPanel(false)
        setShowFavoritesPanel(false)
        return
      }
    }
  }, [hasSelectedConversation, sendingMedia])

  // —— 拖拽上传文件/图片 ——
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!hasSelectedConversation || sendingMedia) return
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingFile(true)
    }
  }, [hasSelectedConversation, sendingMedia])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 只有真正离开容器时才清除（避免子元素触发）
    if (e.currentTarget === e.target) {
      setIsDraggingFile(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!hasSelectedConversation || sendingMedia) return
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(false)
    const file = files[0]
    if (!file) return
    if (file.type.startsWith('image/')) {
      // 图片：走预览流程
      if (pendingImageUrlRef.current) {
        URL.revokeObjectURL(pendingImageUrlRef.current)
      }
      const previewUrl = URL.createObjectURL(file)
      pendingImageUrlRef.current = previewUrl
      setPendingMedia({ type: 'image', file, previewUrl })
    } else {
      // 其他文件：直接设为待发送文件
      setPendingMedia({ type: 'file', file })
    }
    setShowEmojiPicker(false)
    setShowMediaPickerPanel(false)
    setShowFavoritesPanel(false)
  }, [hasSelectedConversation, sendingMedia])

  // —— 取消待发送媒体 ——
  const clearPendingMedia = () => {
    if (pendingMedia?.type === 'image' && pendingMedia.previewUrl) {
      URL.revokeObjectURL(pendingMedia.previewUrl)
    }
    if (pendingImageUrlRef.current) {
      URL.revokeObjectURL(pendingImageUrlRef.current)
      pendingImageUrlRef.current = null
    }
    setPendingMedia(null)
  }

  // —— 语音录制（使用 useVoiceRecorder 转写成文字写入输入框）——
  const startRecording = async () => {
    setError(null)
    voiceRecordingContactIdRef.current = selectedContactId
    voiceTranscriptRef.current = ''
    voiceStartIndexRef.current = input.length
    toggleVoiceRecording()
  }

  const stopRecording = () => {
    toggleVoiceRecording()
    // 录音结束后再保留一次 guard 用于异步后端 STT；下一次 startRecording 会重新初始化
  }

  // —— 插入表情到输入框 ——
  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji)
    setShowEmojiPicker(false)
  }

  // —— 切换 AI 托管 ——
  const toggleAiHost = async () => {
    if (selectedContactId === null || !selectedContact) return
    const newVal = !selectedContact.ai_hosted
    setTogglingAi(true)
    try {
      const res = await api.wecom.contacts.update(selectedContactId, { ai_hosted: newVal })
      if (res.code === API_BUSINESS_CODE.SUCCESS) {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === selectedContactId ? { ...c, ai_hosted: newVal } : c
          )
        )
      } else {
        setError(res.msg || '切换 AI 托管失败')
      }
    } catch {
      setError('网络错误，切换 AI 托管失败')
    } finally {
      setTogglingAi(false)
    }
  }

  // —— 修改好友备注姓名 ——
  const updateContactName = async () => {
    if (selectedContactId === null || !selectedContact) return
    const newName = editingContactName.trim()
    if (!newName) return
    try {
      const res = await api.wecom.contacts.update(selectedContactId, { remark: newName })
      if (res.code === API_BUSINESS_CODE.SUCCESS) {
        setContacts((prev) =>
          prev.map((c) => (c.id === selectedContactId ? { ...c, remark: newName } : c))
        )
        setIsEditingContactName(false)
      } else {
        setError(res.msg || '修改失败')
      }
    } catch {
      setError('网络错误，修改失败')
    }
  }

  // —— 置顶/取消置顶联系人 ——
  const togglePinContact = async (contactId: number, pinned: boolean) => {
    setContextMenu(null)
    try {
      const res = await api.wecom.contacts.update(contactId, { is_pinned: pinned })
      if (res.code === API_BUSINESS_CODE.SUCCESS) {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contactId
              ? { ...c, is_pinned: pinned, pinned_at: pinned ? new Date().toISOString() : null }
              : c
          )
        )
      } else {
        setError(res.msg || '操作失败')
      }
    } catch {
      setError('网络错误，操作失败')
    }
  }

  // —— 删除联系人 ——
  const deleteContact = async (contactId: number) => {
    setContextMenu(null)
    try {
      const res = await api.wecom.contacts.delete(contactId)
      if (res.code === API_BUSINESS_CODE.SUCCESS) {
        setContacts((prev) => prev.filter((c) => c.id !== contactId))
        if (selectedContactId === contactId) setSelectedContactId(null)
      } else {
        setError(res.msg || '删除失败')
      }
    } catch {
      setError('网络错误，删除失败')
    }
  }

  // —— 批量置顶/取消置顶联系人 ——
  const batchPinContacts = async (pinned: boolean) => {
    const ids = Array.from(selectedContactIds)
    for (const id of ids) {
      try {
        await api.wecom.contacts.update(id, { is_pinned: pinned })
      } catch { /* ignore individual errors */ }
    }
    setContacts((prev) =>
      prev.map((c) =>
        selectedContactIds.has(c.id)
          ? { ...c, is_pinned: pinned, pinned_at: pinned ? new Date().toISOString() : null }
          : c
      )
    )
    setContactMultiSelect(false)
    setSelectedContactIds(new Set())
  }

  // —— 批量切换 AI 托管 ——
  const batchAiHost = async (enabled: boolean) => {
    const ids = Array.from(selectedContactIds)
    for (const id of ids) {
      try {
        await api.wecom.contacts.update(id, { ai_hosted: enabled })
      } catch { /* ignore individual errors */ }
    }
    setContacts((prev) =>
      prev.map((c) =>
        selectedContactIds.has(c.id) ? { ...c, ai_hosted: enabled } : c
      )
    )
    setContactMultiSelect(false)
    setSelectedContactIds(new Set())
  }

  // —— 批量删除联系人 ——
  const batchDeleteContacts = async () => {
    const ids = Array.from(selectedContactIds)
    // 先从前端移除（乐观更新）
    setContacts((prev) => prev.filter((c) => !selectedContactIds.has(c.id)))
    if (selectedContactId && selectedContactIds.has(selectedContactId)) {
      setSelectedContactId(null)
    }
    setContactMultiSelect(false)
    setSelectedContactIds(new Set())
    // 后台逐个删除
    for (const id of ids) {
      try {
        await api.wecom.contacts.delete(id)
      } catch { /* ignore individual errors */ }
    }
  }

  // —— 切换联系人选中状态（多选模式）——
  const toggleContactSelection = (contactId: number) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev)
      if (next.has(contactId)) next.delete(contactId)
      else next.add(contactId)
      return next
    })
  }

  // —— 删除消息 ——
  const deleteMessage = async (messageId: number) => {
    setMsgContextMenu(null)
    try {
      const res = await api.wecom.messages.delete(messageId)
      if (res.code === API_BUSINESS_CODE.SUCCESS) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
      } else {
        setError(res.msg || '删除消息失败')
      }
    } catch {
      setError('网络错误，删除消息失败')
    }
  }

  // —— 收藏消息 ——
  const favoriteMessage = async (messageId: number) => {
    setMsgContextMenu(null)
    try {
      const res = await api.wecom.favorites.create({ message_id: messageId })
      if (res.code === API_BUSINESS_CODE.SUCCESS) {
        setError(null)
        // 短暂提示
        showOperationTip('已收藏')
      } else {
        setError(res.msg || '收藏失败')
      }
    } catch {
      setError('网络错误，收藏失败')
    }
  }

  // —— 复制消息 ——
  const copyMessage = (messageId: number) => {
    setMsgContextMenu(null)
    const msg = messages.find((m) => m.id === messageId)
    if (!msg) return
    const text = msg.content || msg.media_file_url || ''
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        showOperationTip('已复制')
      }).catch(() => setError('复制失败'))
    }
  }

  // —— 撤回消息 ——
  const recallMessage = async (messageId: number) => {
    // 防止重复点击
    if (recallingMessageIds.has(messageId)) return
    setMsgContextMenu(null)
    setRecallingMessageIds((prev) => new Set(prev).add(messageId))
    try {
      const res = await api.wecom.messages.recall(messageId)
      if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
        const recalled = res.data as WecomMessage
        setMessages((prev) => {
          const next = prev.map((m) => m.id === messageId ? recalled : m)
          messagesCacheRef.current[convKey(selectedContactId, selectedRoomId)] = next
          return next
        })
        // 更新最后消息（仅单聊）
        if (selectedContactId !== null) {
          setContacts((prev) =>
            prev.map((c) => {
              if (c.id === selectedContactId && c.last_message === recalled.content) {
                return { ...c, last_message: '你撤回了一条消息' }
              }
              return c
            })
          )
        }
        showOperationTip('消息已撤回')
      } else {
        setError(res.msg || '撤回失败')
      }
    } catch {
      setError('网络错误，撤回失败')
    } finally {
      setRecallingMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    }
  }

  // —— 引用消息 ——
  const quoteMessage = (messageId: number) => {
    setMsgContextMenu(null)
    const msg = messages.find((m) => m.id === messageId)
    if (msg) {
      setQuotedMessage(msg)
      // 将光标定位到输入框，方便用户直接输入回复
      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 0)
    }
  }

  // —— 取消引用 ——
  const cancelQuote = () => {
    setQuotedMessage(null)
  }

  // —— 批量删除消息 ——
  const batchDeleteMessages = async () => {
    const ids = Array.from(selectedMessageIds)
    for (const id of ids) {
      try {
        await api.wecom.messages.delete(id)
      } catch { /* ignore */ }
    }
    setMessages((prev) => prev.filter((m) => !selectedMessageIds.has(m.id)))
    setMsgMultiSelect(false)
    setSelectedMessageIds(new Set())
  }

  // —— 批量收藏消息 ——
  const batchFavoriteMessages = async () => {
    const ids = Array.from(selectedMessageIds)
    for (const id of ids) {
      try {
        await api.wecom.favorites.create({ message_id: id })
      } catch { /* ignore */ }
    }
    setMsgMultiSelect(false)
    setSelectedMessageIds(new Set())
    showOperationTip(`已收藏 ${ids.length} 条`)
  }

  // —— 切换消息选中状态（多选模式）——
  const toggleMessageSelection = (messageId: number) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  // —— P3-A: 双击消息引用回复（微信交互：非多选模式下双击触发引用）——
  const handleMessageDoubleClick = (msgId: number) => {
    if (msgMultiSelect) return
    const msg = messages.find((m) => m.id === msgId)
    if (msg && !msg.is_recalled) {
      quoteMessage(msgId)
    }
  }

  // —— P4-A: 消息容器滚动监听 — 判断是否在底部 ——
  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const threshold = 80 // 距底部 80px 以内视为"在底部"
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    isAtBottomRef.current = atBottom
    setIsAtBottom(atBottom)
    if (atBottom) {
      setScrollUpUnreadCount(0)
    }
  }, [])

  // —— P4-A: 点击回到底部按钮 ——
  const scrollToBottomClick = useCallback(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
    isAtBottomRef.current = true
    setScrollUpUnreadCount(0)
    setIsAtBottom(true)
  }, [])

  // —— P4-B: textarea 自适应高度（微信交互：输入框随内容增高，最大 6 行后滚动）——
  const autoResizeTextarea = useCallback(() => {
    const ta = textareaAutoResizeRef.current || messageInputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 22 // ~text-sm line-height
    const minHeight = lineHeight * 1 // 最小 1 行
    const maxHeight = lineHeight * 6 // 最大 6 行
    const newHeight = Math.min(Math.max(ta.scrollHeight, minHeight), maxHeight)
    ta.style.height = `${newHeight}px`
    if (ta.scrollHeight > maxHeight) {
      ta.style.overflowY = 'auto'
    } else {
      ta.style.overflowY = 'hidden'
    }
  }, [])

  // —— P4-C: 网络状态监听 ——
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // —— P4-B: 输入内容变化时自适应高度 ——
  useEffect(() => {
    autoResizeTextarea()
  }, [input, autoResizeTextarea])

  // —— 加载收藏列表 ——
  const loadFavorites = async () => {
    setFavoritesLoading(true)
    try {
      const res = await api.wecom.favorites.list()
      if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
        setFavoritesList(res.data as any[])
      }
    } catch {
      setError('加载收藏失败')
    } finally {
      setFavoritesLoading(false)
    }
  }

  // —— 点击收藏：填入输入框（不直接发送）——
  const applyFavorite = async (fav: any) => {
    if (selectedContactId === null || selectedDeviceId === null) return
    setShowFavoritesPanel(false)
    const favType = fav.msg_type
    if (favType === 'text' || favType === 'emoji') {
      // 文本/表情填入输入框（已有内容则空格拼接）
      setInput((prev) => (prev ? prev + ' ' + fav.content : fav.content))
    } else if (favType === 'image' && fav.media_file_url) {
      try {
        const resp = await fetch(fav.media_file_url)
        const blob = await resp.blob()
        const file = new File([blob], fav.media_file_name || 'image.png', { type: blob.type })
        setPendingMedia({ type: 'image', file, previewUrl: fav.media_file_url })
      } catch {
        setError('加载收藏图片失败')
      }
    } else if (favType === 'file' && fav.media_file_url) {
      try {
        const resp = await fetch(fav.media_file_url)
        const blob = await resp.blob()
        const file = new File([blob], fav.media_file_name || 'file', { type: blob.type })
        setPendingMedia({ type: 'file', file })
      } catch {
        setError('加载收藏文件失败')
      }
    } else if (favType === 'voice' && fav.media_file_url) {
      try {
        const resp = await fetch(fav.media_file_url)
        const blob = await resp.blob()
        const file = new File([blob], fav.media_file_name || 'voice.amr', { type: blob.type })
        setPendingMedia({ type: 'voice', file, voiceTime: 0 })
      } catch {
        setError('加载收藏语音失败')
      }
    } else if (favType === 'miniprogram') {
      // 小程序收藏：直接发送小程序卡片
      try {
        const rd = typeof fav.raw_data === 'string' ? JSON.parse(fav.raw_data) : (fav.raw_data || {})
        const md = (rd?.msgData as Record<string, unknown>) || rd || {}
        const appId = (md.appId as string) || ''
        const pagePath = (md.pagePath as string) || ''
        if (!appId || !pagePath) {
          setError('该收藏小程序缺少 appId 或 pagePath，无法发送')
          return
        }
        setSending(true)
        const sendData: Record<string, unknown> = {
          device_id: selectedDeviceId,
          msg_type: 'miniprogram',
          content: (md.title as string) || (md.appName as string) || fav.content || '[小程序]',
          app_id: appId,
          page_path: pagePath,
          title: (md.title as string) || '',
          app_name: (md.appName as string) || '',
          desc: (md.desc as string) || '',
          icon_url: (md.iconUrl as string) || fav.media_file_url || '',
          username: (md.username as string) || '',
          cover_image_id: (md.coverImageId as string) || '',
          cover_image_aes_key: (md.coverImageAesKey as string) || '',
          cover_image_md5: (md.coverImageMd5 as string) || '',
          cover_image_size: (md.coverImageSize as number) || 0,
        }
        if (selectedContactId !== null) sendData.contact_id = selectedContactId
        if (selectedRoomId !== null) sendData.room_id = selectedRoomId
        const res = await api.wecom.messages.send(sendData as any)
        if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
          const newMsg = res.data as WecomMessage
          const key = convKey(selectedContactId, selectedRoomId)
          setMessages((prev) => {
            const next = [...prev, newMsg]
            messagesCacheRef.current[key] = next
            return next
          })
          const msgLabel = getMessagePreview(newMsg)
          const nowTime = newMsg.created_at || new Date().toISOString()
          updateConversationLastMessage('miniprogram', msgLabel, nowTime)
        } else {
          setError(res.msg || '发送失败')
        }
      } catch {
        setError('发送收藏小程序失败')
      } finally {
        setSending(false)
      }
    }
  }

  // —— 加载营销素材 ——
  const loadMediaAssets = async () => {
    setMediaLoading(true)
    try {
      const res = await api.media.list()
      if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
        const data = res.data as unknown
        const items = (data as any)?.items || (Array.isArray(data) ? data : []) || []
        setMediaAssets(items)
      }
    } catch {
      setError('加载营销素材失败')
    } finally {
      setMediaLoading(false)
    }
  }

  // —— 发送营销素材给当前好友/群聊 ——
  const sendMediaAsset = async (asset: any) => {
    if ((selectedContactId === null && selectedRoomId === null) || selectedDeviceId === null) return
    setShowMediaPickerPanel(false)

    const assetType = asset.type || 'image'
    const fileUrl = asset.file_url || asset.url || ''
    const assetName = asset.name || asset.description || '素材'

    // 文本类素材：链接、小程序、视频号、Emoji → 直接发文本消息
    if (['link', 'miniapp', 'channel', 'emoji'].includes(assetType)) {
      try {
        setSending(true)
        const text = [assetName, fileUrl].filter(Boolean).join('\n')
        const sendData: Record<string, unknown> = {
          device_id: selectedDeviceId,
          msg_type: 'text',
          content: text,
        }
        if (selectedContactId !== null) sendData.contact_id = selectedContactId
        if (selectedRoomId !== null) sendData.room_id = selectedRoomId
        const res = await api.wecom.messages.send(sendData as any)
        if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
          const newMsg = res.data as WecomMessage
          const key = convKey(selectedContactId, selectedRoomId)
          setMessages((prev) => {
            const next = [...prev, newMsg]
            messagesCacheRef.current[key] = next
            return next
          })
          const msgLabel = getMessagePreview(newMsg)
          const nowTime = newMsg.created_at || new Date().toISOString()
          updateConversationLastMessage('text', msgLabel, nowTime)
        } else {
          setError(res.msg || '发送失败')
        }
      } catch {
        setError('发送营销素材失败')
      } finally {
        setSending(false)
      }
      return
    }

    // 媒体类素材：图片、视频、语音、文件 → 下载为 File 后发 sendMedia
    if (!fileUrl) {
      setError('素材文件地址无效')
      return
    }

    try {
      setSendingMedia(true)
      const resp = await fetch(fileUrl)
      if (!resp.ok) throw new Error('下载失败')
      const blob = await resp.blob()
      const ext = fileUrl.split('.').pop()?.split('?')[0] || ''
      const fileName = assetName + (ext ? '.' + ext : '')
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' })

      const msgType = assetType === 'image' ? 'image' : 'file'
      const mediaData: Record<string, unknown> = {
        device_id: selectedDeviceId,
        msg_type: msgType,
        file,
      }
      if (selectedContactId !== null) mediaData.contact_id = selectedContactId
      if (selectedRoomId !== null) mediaData.room_id = selectedRoomId
      const res = await api.wecom.messages.sendMedia(mediaData as any)
      if (res.code === API_BUSINESS_CODE.SUCCESS && res.data) {
        const newMsg = res.data as WecomMessage
        const key = convKey(selectedContactId, selectedRoomId)
        setMessages((prev) => {
          const next = [...prev, newMsg]
          messagesCacheRef.current[key] = next
          return next
        })
        const msgLabel = getMessagePreview(newMsg)
        const nowTime = newMsg.created_at || new Date().toISOString()
        updateConversationLastMessage(msgType, msgLabel, nowTime)
      } else {
        setError(res.msg || '发送失败')
      }
    } catch {
      setError('下载并发送素材失败')
    } finally {
      setSendingMedia(false)
    }
  }

  // —— 转发消息给其他好友 ——
  const forwardMessageTo = async (messageId: number, targetContactId: number) => {
    if (selectedDeviceId === null) return
    const msg = messages.find((m) => m.id === messageId)
    if (!msg) return
    try {
      if (msg.msg_type === 'text') {
        const res = await api.wecom.messages.send({
          device_id: selectedDeviceId,
          contact_id: targetContactId,
          msg_type: 'text',
          content: msg.content,
        })
        if (res.code === API_BUSINESS_CODE.SUCCESS) {
          // success toast handled by caller
        }
      } else if (msg.msg_type === 'miniprogram') {
        // 小程序转发：优先使用 /msg/sendWeapp 接口并传入 thumbUrl，保证封面图正常显示
        const msgData = (msg.raw_data?.msgData as Record<string, unknown>) || {}
        const appId = (msgData.appId as string) || ''
        const pagePath = (msgData.pagePath as string) || ''
        if (!appId || !pagePath) {
          setError('该小程序缺少 appId 或 pagePath，无法转发')
          return
        }
        const thumbUrl = (msgData.thumbUrl as string) || ''
        const res = await api.wecom.messages.send({
          device_id: selectedDeviceId,
          contact_id: targetContactId,
          msg_type: 'miniprogram',
          content: (msgData.title as string) || (msgData.appName as string) || '[小程序]',
          app_id: appId,
          page_path: pagePath,
          title: (msgData.title as string) || '',
          app_name: (msgData.appName as string) || '',
          desc: (msgData.desc as string) || '',
          icon_url: (msgData.iconUrl as string) || msg.media_file_url || '',
          username: (msgData.username as string) || '',
          thumb_url: thumbUrl,
          cover_image_id: (msgData.coverImageId as string) || '',
          cover_image_aes_key: (msgData.coverImageAesKey as string) || '',
          cover_image_md5: (msgData.coverImageMd5 as string) || '',
          cover_image_size: (msgData.coverImageSize as number) || 0,
        })
        if (res.code !== API_BUSINESS_CODE.SUCCESS) {
          setError(res.msg || '小程序转发失败')
          return
        }
      } else if (msg.msg_type === 'image' && msg.media_file_url) {
        // 图片转发：发送为链接
        const res = await api.wecom.messages.send({
          device_id: selectedDeviceId,
          contact_id: targetContactId,
          msg_type: 'text',
          content: msg.content || msg.media_file_url || '[图片]',
        })
        if (res.code === API_BUSINESS_CODE.SUCCESS) {
          // success toast handled by caller
        }
      } else if (msg.msg_type === 'file' && msg.media_file_url) {
        // 文件转发：发送文件名和链接
        const fileName = msg.content || '[文件]'
        const res = await api.wecom.messages.send({
          device_id: selectedDeviceId,
          contact_id: targetContactId,
          msg_type: 'text',
          content: `${fileName}\n${msg.media_file_url || ''}`,
        })
        if (res.code === API_BUSINESS_CODE.SUCCESS) {
          // success toast handled by caller
        }
      } else if (msg.msg_type === 'voice' && msg.content) {
        // 语音转发：发送语音描述
        const res = await api.wecom.messages.send({
          device_id: selectedDeviceId,
          contact_id: targetContactId,
          msg_type: 'text',
          content: msg.content || '[语音消息]',
        })
        if (res.code === API_BUSINESS_CODE.SUCCESS) {
          // success toast handled by caller
        }
      } else if (msg.msg_type === 'link') {
        // 链接转发
        const res = await api.wecom.messages.send({
          device_id: selectedDeviceId,
          contact_id: targetContactId,
          msg_type: 'text',
          content: msg.content || '[链接]',
        })
        if (res.code === API_BUSINESS_CODE.SUCCESS) {
          // success toast handled by caller
        }
      }
    } catch {
      setError('转发失败')
    }
  }

  // —— 确认联系人选择（转发/群发）——
  const confirmContactPicker = async () => {
    if (contactPickerMessageId === null || selectedDeviceId === null) return
    const ids = Array.from(contactPickerSelected)
    if (ids.length === 0) return
    setShowContactPicker(false)
    if (contactPickerMode === 'forward') {
      const msg = messages.find((m) => m.id === contactPickerMessageId)
      for (const cid of ids) {
        await forwardMessageTo(contactPickerMessageId, cid)
      }
      // 更新联系人列表预览
      if (msg) {
        const nowTime = new Date().toISOString()
        const previewText = getMessagePreview(msg)
        setContacts((prev) =>
          prev.map((c) =>
            ids.includes(c.id)
              ? {
                  ...c,
                  last_contacted_at: nowTime,
                  last_message_time: nowTime,
                  last_message: previewText,
                  last_message_type: msg.msg_type,
                }
              : c
          )
        )
        // 群发也更新群聊的最后消息时间
        if (selectedRoomId !== null) {
          setGroups((prev) =>
            prev.map((g) =>
              g.id === selectedRoomId
                ? {
                    ...g,
                    last_message_time: nowTime,
                    last_message: previewText,
                    last_message_type: msg.msg_type,
                  }
                : g
            )
          )
        }
      }
      showOperationTip(`已转发给 ${ids.length} 位好友`)
    } else {
      await groupSendMessage(contactPickerMessageId, ids)
    }
    setContactPickerSelected(new Set())
    setContactPickerSearch('')
    setContactPickerMessageId(null)
  }

  // —— 群发消息给多个好友 ——
  const groupSendMessage = async (messageId: number, targetContactIds: number[]) => {
    if (selectedDeviceId === null) return
    const msg = messages.find((m) => m.id === messageId)
    if (!msg) return
    setMsgContextMenu(null)
    for (const cid of targetContactIds) {
      try {
        if (msg.msg_type === 'text') {
          await api.wecom.messages.send({
            device_id: selectedDeviceId,
            contact_id: cid,
            msg_type: 'text',
            content: msg.content,
          })
        }
      } catch { /* ignore individual */ }
    }
    // 更新联系人列表预览：每个目标好友显示最后发送的消息文案
    const nowTime = new Date().toISOString()
    const previewText = getMessagePreview(msg)
    setContacts((prev) =>
      prev.map((c) =>
        targetContactIds.includes(c.id)
          ? {
              ...c,
              last_contacted_at: nowTime,
              last_message_time: nowTime,
              last_message: previewText,
              last_message_type: msg.msg_type,
            }
          : c
      )
    )
    showOperationTip(`已群发给 ${targetContactIds.length} 位好友`)
  }

  // —— 右键菜单（联系人）——
  const handleContactContextMenu = (e: React.MouseEvent, contactId: number) => {
    e.preventDefault()
    e.stopPropagation() // 阻止冒泡到 window，否则 window 的 contextmenu 监听会立刻关闭菜单
    if (contactMultiSelect) return // 多选模式下不弹右键菜单
    setContextMenu({ contactId, x: e.clientX, y: e.clientY })
  }

  // —— 右键菜单（消息）——
  const handleMessageContextMenu = (e: React.MouseEvent, messageId: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (msgMultiSelect) return
    setMsgContextMenu({ messageId, x: e.clientX, y: e.clientY })
  }

  // 点击其他区域关闭右键菜单
  useEffect(() => {
    if (!contextMenu && !msgContextMenu && !deviceContextMenu) return
    const close = () => {
      setContextMenu(null)
      setMsgContextMenu(null)
      setDeviceContextMenu(null)
    }
    // click: 左键点击外部关闭
    // contextmenu: 右键点击外部关闭（contact/message 上的 contextmenu 已 stopPropagation，不会到达这里）
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
    }
  }, [contextMenu, msgContextMenu, deviceContextMenu])

  // —— 联系人列表宽度拖拽收缩 ——
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!sidebarResizingRef.current) return
      // 基于拖动起始点的相对位移计算新宽度，避免受外层侧边栏宽度/折叠状态影响
      const deltaX = e.clientX - sidebarResizeStartXRef.current
      const newWidth = Math.max(220, Math.min(480, sidebarResizeStartWidthRef.current + deltaX))
      setSidebarWidth(newWidth)
    }
    const onMouseUp = () => {
      if (sidebarResizingRef.current) {
        sidebarResizingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // —— 键盘事件 ——
  // —— 点击外部关闭 @ 选择面板 ——
  useEffect(() => {
    if (!showAtPicker) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      // 如果点击不在 @ 面板内，也不在输入框内，则关闭
      if (atPickerRef.current && !atPickerRef.current.contains(target) &&
          messageInputRef.current && !messageInputRef.current.contains(target)) {
        setShowAtPicker(false)
        setAtMentionStartPos(-1)
        setAtSearchText('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAtPicker])

  // 切换会话时关闭 @ 面板
  useEffect(() => {
    setShowAtPicker(false)
    setAtMentionStartPos(-1)
    setAtSearchText('')
  }, [selectedContactId, selectedRoomId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Escape 关闭 @ 选择面板
    if (e.key === 'Escape' && showAtPicker) {
      setShowAtPicker(false)
      setAtMentionStartPos(-1)
      setAtSearchText('')
      e.preventDefault()
      return
    }
    // @ 选择面板打开时，上下键选择、回车确认
    if (showAtPicker && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // —— 渲染 ——
  return (
    <div className="flex min-h-0 flex-1">
      {/* 左侧设备选择栏 */}
      <div className="flex w-16 flex-col items-center gap-3 border-r border-[#d6d6d6] bg-[#e7e7e7] py-4">
        {/* 添加设备 */}
        <button
          onClick={() => setShowAddDeviceModal(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-[#999] text-[#666] transition-colors hover:border-[#07c160] hover:text-[#07c160]"
          title="绑定企微设备"
        >
          <Plus className="h-5 w-5" />
        </button>

        <div className="w-10 border-b border-[#d6d6d6]" />

        {devicesLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-[#999]" />
        ) : devices.length === 0 ? (
          <div className="text-center text-xs text-[#999]">无设备</div>
        ) : (
          devices.map((device) => (
            <div
              key={device.id}
              onClick={() => setSelectedDeviceId(device.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setDeviceContextMenu({ deviceId: device.id, x: e.clientX, y: e.clientY })
              }}
              className="cursor-pointer"
            >
              <DeviceAvatar device={device} selected={selectedDeviceId === device.id} />
            </div>
          ))
        )}
        <button
          onClick={loadDevices}
          className="mt-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#666] transition-colors hover:bg-[#d6d6d6] hover:text-[#333]"
          title="刷新设备列表"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* 联系人列表 */}
      <div
        className="flex flex-col bg-[#f7f7f7]"
        style={{ width: sidebarWidth }}
      >
        {/* 搜索 */}
        <div className="border-b border-border-subtle p-4">
          <div className="relative mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索联系人"
                className="h-9 w-full rounded-lg border-0 bg-white pl-9 pr-3 text-sm text-[#333] placeholder:text-[#999] outline-none"
              />
            </div>
            <button
              onClick={handleSyncContacts}
              disabled={selectedDeviceId === null || syncingContacts}
              className="flex h-9 items-center gap-1 rounded-lg border border-[#d6d6d6] bg-white px-2.5 text-xs text-[#666] transition-colors hover:bg-[#eee] disabled:cursor-not-allowed disabled:opacity-50"
              title="从企微同步好友"
            >
              {syncingContacts ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              同步好友
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-[#666]">
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
              显示未读
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-[#666]">
              <div
                onClick={() => setOnlyAiHosted(!onlyAiHosted)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  onlyAiHosted ? 'bg-[#ff9900]' : 'bg-border-strong'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    onlyAiHosted ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'
                  }`}
                />
              </div>
              <span className="flex items-center gap-0.5">
                <Bot className="h-3.5 w-3.5 text-[#ff9900]" />
                Ai托管
              </span>
            </label>
          </div>
        </div>

        {/* 联系人列表 */}
        <div
          ref={contactListRef}
          className="flex-1 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/20"
        >
          {contactsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
            </div>
          ) : unifiedSessions.length === 0 ? (
            <div className="mt-10 text-center text-sm text-text-muted">
              {selectedDevice ? '暂无联系人和群聊' : '请先选择设备'}
            </div>
          ) : (
            <>
            {/* 统一会话列表（单聊 + 群聊合并，按置顶+最新聊天时间排序） */}
            {unifiedSessions.map((session) => {
              if (session.kind === 'group') {
                const isSelected = selectedRoomId === session.id
                // 根据群人数决定头像预览数量：3人=3个，4人=4个，5人=5个，大于5人=6个
                const memberCount = session.member_count || (session.member_user_ids || []).length
                const displayCount = memberCount > 5 ? 6 : memberCount
                const previewMembers = (session.member_user_ids || []).slice(0, displayCount)
                return (
                  <button
                    key={session.session_key}
                    onClick={() => {
                      setSelectedRoomId(session.id)
                      setSelectedContactId(null)  // 互斥
                      setQuotedMessage(null)
                      setShowGroupMembers(false)
                    }}
                    className={`flex w-full items-start gap-3 border-b border-[#e9e9e9] p-3 text-left transition-colors ${
                      isSelected ? 'bg-[#07c160]' : 'hover:bg-[#e0e0e0]'
                    }`}
                  >
                    <div className="shrink-0">
                      <GroupAvatar
                        memberUserIds={previewMembers}
                        contacts={contacts}
                        isSelected={isSelected}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-sm font-medium ${isSelected ? 'text-white' : 'text-[#333]'}`}>
                          {session.name}
                        </span>
                        <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${isSelected ? 'bg-white/20 text-white' : 'bg-[#5b8ff9]/10 text-[#5b8ff9]'}`}>
                          {session.member_count}人
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className={`truncate text-xs ${isSelected ? 'text-white/80' : 'text-[#999]'}`}>
                          {session.last_message
                            ? getMessagePreview({ msg_type: session.last_message_type, content: session.last_message })
                            : '群聊'}
                        </p>
                        <span className={`shrink-0 text-xs ${isSelected ? 'text-white/70' : 'text-[#b2b2b2]'}`}>
                          {formatLastTime(session.last_message_time)}
                        </span>
                      </div>
                      {/* 群标签展示 */}
                      {session.tags_display && session.tags_display.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {session.tags_display.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded px-1 py-0.5 text-[10px]"
                              style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color
                              }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                )
              }

              // 单聊会话
              const isSelected = selectedContactId === session.id
              const c = session.contact_ref!
              return (
                <button
                  key={session.session_key}
                  ref={(el) => {
                    if (isSelected) {
                      selectedContactItemRef.current = el
                    }
                  }}
                  onClick={() => {
                    if (contactMultiSelect) {
                      toggleContactSelection(session.id)
                    } else {
                      setSelectedContactId(session.id)
                      setSelectedRoomId(null)
                      setQuotedMessage(null)
                      // 标记为已读
                      setLastReadAtMap((prev) => ({ ...prev, [session.id]: new Date().toISOString() }))
                    }
                  }}
                  onContextMenu={(e) => handleContactContextMenu(e, session.id)}
                  className={`flex w-full items-start gap-3 border-b border-[#e9e9e9] p-3 text-left transition-colors ${
                    contactMultiSelect && selectedContactIds.has(session.id)
                      ? 'bg-[#07c160]/20'
                      : isSelected
                      ? 'bg-[#07c160]'
                      : 'hover:bg-[#e0e0e0]'
                  }`}
                >
                  {/* 多选模式下显示复选框 */}
                  {contactMultiSelect && (
                    <div className="mt-1 shrink-0">
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        selectedContactIds.has(session.id) ? 'border-[#07c160] bg-[#07c160]' : 'border-[#ccc] bg-white'
                      }`}>
                        {selectedContactIds.has(session.id) && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </div>
                  )}
                  <div className="relative shrink-0">
                    {c.avatar ? (
                      <img
                        src={c.avatar}
                        alt={c.name}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent text-sm font-bold text-white">
                        {avatarFallback(c.name)}
                      </div>
                    )}
                    {c.is_pinned && !isContactUnread(c) && (unreadCountMap[c.id] || 0) === 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#07c160] text-white">
                        <Pin className="h-2.5 w-2.5" />
                      </span>
                    )}
                    {(() => {
                      const unreadCount = unreadCountMap[c.id] || 0
                      const isUnread = isContactUnread(c)
                      if (unreadCount > 0) {
                        return (
                          <span className="absolute -right-2 -top-1.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none shadow-sm border border-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )
                      }
                      if (isUnread) {
                        return (
                          <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 border border-white" />
                        )
                      }
                      return null
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`truncate text-sm font-medium ${isSelected ? 'text-white' : 'text-[#333]'}`}>
                        {c.remark || c.name}
                      </span>
                      {c.contact_source === 'wechat' && (
                        <span
                          className={`shrink-0 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-[#07c160]/10 text-[#07c160]'
                          }`}
                          title="微信好友"
                        >
                          <Smartphone className="h-2.5 w-2.5" />
                          微信
                        </span>
                      )}
                      {c.contact_source === 'wecom' && (
                        <span
                          className={`shrink-0 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-[#5b8ff9]/10 text-[#5b8ff9]'
                          }`}
                          title="企微同事"
                        >
                          <Users className="h-2.5 w-2.5" />
                          企微
                        </span>
                      )}
                      {c.is_pinned && (
                        <span className={`shrink-0 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${isSelected ? 'bg-white/20 text-white' : 'bg-[#07c160]/10 text-[#07c160]'}`}>
                          <Pin className="h-2.5 w-2.5" />
                          置顶
                        </span>
                      )}
                      {c.ai_hosted && (
                        <span className={`shrink-0 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${isSelected ? 'bg-white/20 text-white' : 'bg-[#ff9900]/10 text-[#ff9900]'}`}>
                          <Bot className="h-2.5 w-2.5" />
                          AI托管
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className={`truncate text-xs ${isSelected ? 'text-white/80' : 'text-[#999]'}`}>
                        {c.last_message
                          ? getMessagePreview({ msg_type: c.last_message_type, content: c.last_message })
                          : (c.enterprise_id || c.name)}
                      </p>
                      <span className={`shrink-0 text-xs ${isSelected ? 'text-white/70' : 'text-[#b2b2b2]'}`}>
                        {formatLastTime(c.last_message_time || c.last_contacted_at || null)}
                      </span>
                    </div>
                    {/* 标签展示 */}
                    {c.tags_display && c.tags_display.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.tags_display.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded px-1 py-0.5 text-[10px]"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
            </>
          )}
        </div>
      </div>

      {/* 拖拽分隔条 — 联系人列表宽度可收缩（视觉上隐藏，保留拖拽热区） */}
      <div
        className="relative z-10 w-1 shrink-0 cursor-col-resize bg-transparent"
        style={{ minHeight: 0 }}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          sidebarResizingRef.current = true
          sidebarResizeStartXRef.current = e.clientX
          sidebarResizeStartWidthRef.current = sidebarWidth
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
        }}
      >
        {/* 扩大可抓取区域（左右各 5px 透明层） */}
        <div className="absolute inset-y-0 -left-[5px] -right-[5px]" />
      </div>

      {/* 右侧聊天区 */}
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        {/* 聊天头部 */}
        <div className="flex h-16 shrink-0 items-center justify-between bg-white px-6">
          <div className="flex items-center gap-3">
            {isEditingContactName && selectedContact ? (
              <div className="flex items-center gap-2">
                <input
                  value={editingContactName}
                  onChange={(e) => setEditingContactName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      updateContactName()
                    } else if (e.key === 'Escape') {
                      setIsEditingContactName(false)
                    }
                  }}
                  autoFocus
                  className="h-8 rounded-lg border border-[#07c160] px-3 text-sm text-[#333] outline-none"
                />
                <button
                  onClick={updateContactName}
                  className="rounded-lg bg-[#07c160] px-3 py-1 text-xs font-medium text-white hover:bg-[#06ad56]"
                >
                  保存
                </button>
                <button
                  onClick={() => setIsEditingContactName(false)}
                  className="rounded-lg border border-[#d6d6d6] px-3 py-1 text-xs text-[#666] hover:bg-[#eee]"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#333]">
                  {selectedContact
                    ? (selectedContact.remark || selectedContact.name)
                    : selectedRoom
                    ? selectedRoom.name
                    : '未选择会话'}
                </h2>
                {selectedContact && (
                  <button
                    onClick={() => {
                      setEditingContactName(selectedContact.remark || selectedContact.name || '')
                      setIsEditingContactName(true)
                    }}
                    className="rounded p-1 text-[#999] hover:bg-[#f0f0f0] hover:text-[#07c160]"
                    title="修改姓名"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {selectedRoom && selectedRoom.member_count > 0 && (
                  <button
                    onClick={() => setShowGroupMembers(!showGroupMembers)}
                    className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      showGroupMembers
                        ? 'bg-[#5b8ff9] text-white'
                        : 'bg-[#5b8ff9]/10 text-[#5b8ff9] hover:bg-[#5b8ff9]/20'
                    }`}
                    title="查看群成员"
                  >
                    <Users className="h-2.5 w-2.5" />
                    {selectedRoom.member_count}人
                  </button>
                )}
              </div>
            )}
            {selectedDevice && (
              <span className="flex items-center gap-1 text-xs text-[#999]">
                {selectedDevice.status === 'online' ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-[#999]" />
                )}
                {selectedDevice.name}
              </span>
            )}
          </div>
          {selectedContact && (
            <div className="flex items-center gap-2 text-sm text-[#666]">
              <Zap
                className={`h-4 w-4 ${
                  selectedContact.ai_hosted ? 'text-[#07c160]' : 'text-[#999]'
                }`}
              />
              <span>AI托管</span>
              <button
                onClick={toggleAiHost}
                disabled={togglingAi}
                className={`relative ml-1 h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
                  selectedContact.ai_hosted ? 'bg-[#07c160]' : 'bg-[#d6d6d6]'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    selectedContact.ai_hosted
                      ? 'left-[calc(100%-1.125rem)]'
                      : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-6 mb-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-xs underline"
            >
              关闭
            </button>
          </div>
        )}

        {/* 群成员列表面板 — 从后端 /wecom/groups/<id>/members/ 拉取真实姓名和头像 */}
        {showGroupMembers && selectedRoom && selectedRoom.member_count > 0 && (
          <div className="mx-6 mb-2 rounded-lg border border-[#e9e9e9] bg-[#f7f7f7] max-h-72 overflow-y-auto">
            <div className="sticky top-0 z-10 bg-[#f7f7f7] px-3 py-2 border-b border-[#e9e9e9] flex items-center justify-between">
              <span className="text-xs font-medium text-[#666]">
                群成员 ({groupMembers?.member_count ?? selectedRoom.member_count})
              </span>
              <button
                onClick={() => setShowGroupMembers(false)}
                className="text-[#999] hover:text-[#333]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {groupMembersLoading && !groupMembers ? (
              <div className="flex items-center justify-center py-6 text-xs text-[#999]">
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                加载群成员...
              </div>
            ) : groupMembers && groupMembers.members.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-2">
                {groupMembers.members.map((m) => {
                  const canClick = m.contact_id !== null
                  return (
                    <button
                      key={m.external_userid}
                      disabled={!canClick}
                      onClick={() => {
                        if (!m.contact_id) return
                        // 跳转到该成员的单聊
                        setSelectedContactId(m.contact_id)
                        setSelectedRoomId(null)
                        setShowGroupMembers(false)
                        setQuotedMessage(null)
                      }}
                      className={`inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] border transition-colors ${
                        canClick
                          ? 'cursor-pointer hover:bg-[#07c160]/5 hover:border-[#07c160]/30 text-[#333] border-[#e9e9e9]'
                          : 'cursor-default text-[#999] border-[#eee]'
                      }`}
                      title={canClick ? `查看 ${m.name} 的单聊` : m.name}
                    >
                      {m.avatar ? (
                        <img src={m.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
                      ) : (
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-medium text-white ${
                          m.contact_source === 'wecom' ? 'bg-[#5b8ff9]' : 'bg-[#07c160]'
                        }`}>
                          {avatarFallback(m.name)}
                        </span>
                      )}
                      <span className="max-w-[120px] truncate">{m.name}</span>
                      {m.is_owner && (
                        <span className="ml-0.5 rounded bg-amber-100 px-1 text-[8px] text-amber-700">群主</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#999]">暂无群成员</div>
            )}
          </div>
        )}

        {/* P4-C: 网络断开提示横幅（微信风格） */}
        {!isOnline && (
          <div className="flex items-center justify-center gap-2 bg-[#fa5151] px-4 py-1.5 text-xs text-white">
            <WifiOff className="h-3.5 w-3.5" />
            网络连接已断开，消息可能无法正常发送
          </div>
        )}

        {/* 消息区 */}
        <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="relative flex-1 overflow-y-auto px-6 py-5">
          {messagesLoading && messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p className="text-sm">暂无消息，开始跟客吧</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((msg) => {
                const isMe = msg.direction === 'outbound'
                return (
                  <div
                    key={msg.id}
                    onContextMenu={(e) => handleMessageContextMenu(e, msg.id)}
                    onClick={() => { if (msgMultiSelect) toggleMessageSelection(msg.id) }}
                    onDoubleClick={() => handleMessageDoubleClick(msg.id)}
                    onMouseEnter={() => !msgMultiSelect && setHoveredMsgId(msg.id)}
                    onMouseLeave={() => setHoveredMsgId(null)}
                    className={`group relative flex ${isMe ? 'flex-row-reverse' : 'flex-row'} gap-3 ${msgMultiSelect ? 'cursor-pointer' : 'cursor-default'} ${
                      msgMultiSelect && selectedMessageIds.has(msg.id) ? 'opacity-100' : msgMultiSelect ? 'opacity-60' : ''
                    }`}
                  >
                    {/* 多选模式下显示复选框 */}
                    {msgMultiSelect && (
                      <div className="mt-1 shrink-0 self-center">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          selectedMessageIds.has(msg.id) ? 'border-[#07c160] bg-[#07c160]' : 'border-[#ccc] bg-white'
                        }`}>
                          {selectedMessageIds.has(msg.id) && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    )}
                    {/* 头像 */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white overflow-hidden ${
                        isMe ? 'bg-[#07c160]' : 'bg-[#07c160]'
                      }`}
                    >
                      {isMe
                        ? selectedDevice?.avatar
                          ? <img src={selectedDevice.avatar} alt="" className="h-9 w-9 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                          : <span>{avatarFallback(selectedDevice?.name || '我')}</span>
                        : msg.contact_avatar
                          ? <img
                              src={msg.contact_avatar}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover"
                              onError={(e) => {
                                // 图片加载失败时显示文字头像
                                e.currentTarget.style.display = 'none'
                                const parent = e.currentTarget.parentElement
                                if (parent) parent.textContent = avatarFallback(msg.contact_name || '?')
                              }}
                            />
                          : selectedContact?.avatar
                            ? <img src={selectedContact.avatar} alt="" className="h-9 w-9 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                            : <span>{avatarFallback(msg.contact_name || selectedContact?.name || '?')}</span>
                      }
                    </div>

                    {/* 气泡 */}
                    <div
                      className={`flex max-w-[70%] flex-col ${
                        isMe ? 'items-end' : 'items-start'
                      }`}
                    >
                      {/* 发送者姓名（仅群聊显示，与微信一致） */}
                      {!isMe && (msg.conversation_type === 'group' || selectedRoomId !== null) && (
                        <span className="mb-1 ml-1 text-xs text-[#999]">
                          {msg.contact_name || msg.sender_name || selectedContact?.remark || selectedContact?.name || ''}
                        </span>
                      )}

                      {/* 消息内容 */}
                      {recallingMessageIds.has(msg.id) ? (
                        <div
                          className={`rounded-md px-4 py-2 text-sm leading-relaxed ${
                            isMe
                              ? 'bg-[#95ec69]/70 text-black'
                              : 'bg-[#f2f2f2] text-[#666]'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            努力撤回中…
                          </span>
                        </div>
                      ) : msg.is_recalled ? (
                        <div
                          className={`rounded-md px-4 py-2 text-sm leading-relaxed ${
                            isMe
                              ? 'bg-transparent text-[#999]'
                              : 'bg-[#f2f2f2] text-[#999]'
                          }`}
                        >
                          {isMe ? '你撤回了一条消息' : '对方撤回了一条消息'}
                        </div>
                      ) : msg.msg_type === 'text' ? (
                        <div
                          className={`rounded-md px-4 py-2 text-sm leading-relaxed ${
                            isMe
                              ? 'bg-[#95ec69] text-black'
                              : 'bg-[#f2f2f2] text-black'
                          }`}
                        >
                          {renderTextWithEmojis(msg.content)}
                        </div>
                      ) : msg.msg_type === 'image' && msg.media_file_url ? (
                        <img
                          src={msg.media_file_url}
                          alt={msg.msg_type_display || '图片'}
                          className="max-h-60 max-w-full cursor-pointer rounded-lg object-contain shadow-sm"
                          onClick={() => setPreviewImageUrl(msg.media_file_url)}
                          onLoad={() => {
                            const container = messagesContainerRef.current
                            if (container) {
                              container.scrollTo({ top: container.scrollHeight, behavior: 'auto' })
                            }
                          }}
                        />
                      ) : msg.msg_type === 'file' ? (
                        <FileMessageCard
                          filename={msg.content || '文件'}
                          onClick={() => msg.media_file_url && window.open(msg.media_file_url, '_blank')}
                        />
                      ) : msg.msg_type === 'video' ? (
                        msg.media_file_url ? (
                          <video
                            src={msg.media_file_url}
                            controls
                            className="max-h-60 max-w-full rounded-lg object-contain shadow-sm"
                            onLoadedMetadata={() => {
                              const container = messagesContainerRef.current
                              if (container) {
                                container.scrollTo({ top: container.scrollHeight, behavior: 'auto' })
                              }
                            }}
                          />
                        ) : (
                          <div
                            onClick={() => {
                              const raw = (msg.raw_data as Record<string, unknown>) || {}
                              const msgData = (raw.msgData as Record<string, unknown>) || {}
                              const videoUrl = (msgData.fileHttpUrl as string) || (msgData.videoUrl as string) || (msgData.fileUrl as string) || (raw.videoUrl as string) || (raw.fileUrl as string) || (raw.fileHttpUrl as string) || ''
                              if (videoUrl) {
                                window.open(videoUrl, '_blank')
                              } else {
                                showOperationTip('视频文件暂不可播放')
                              }
                            }}
                            className="flex cursor-pointer items-center gap-3 rounded-lg bg-[#f2f2f2] px-4 py-3 text-sm text-[#333] transition-colors hover:bg-[#e6e6e6]"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#07c160]">
                              <Play className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{msg.content || '[视频]'}</p>
                              <p className="text-xs text-[#999]">点击下载/预览</p>
                            </div>
                          </div>
                        )
                      ) : msg.msg_type === 'voice' ? (
                        <div
                          onClick={() => toggleVoicePlayback(msg)}
                          className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm ${
                            isMe
                              ? 'bg-[#95ec69] text-black'
                              : 'bg-[#f2f2f2] text-black'
                          }`}
                        >
                          {playingVoiceId === msg.id ? (
                            <Pause className="h-4 w-4 shrink-0" />
                          ) : (
                            <Play className="h-4 w-4 shrink-0" />
                          )}
                          <Mic className="h-4 w-4 shrink-0" />
                          <span>{msg.content || '[语音]'}</span>
                        </div>
                      ) : msg.msg_type === 'miniprogram' ? (
                        <MiniProgramCard data={msg.raw_data} iconUrl={msg.media_file_url} onClick={() => {
                          const msgData = (msg.raw_data?.msgData as Record<string, unknown>) || {}
                          const url = (msgData.url as string) || (msgData.pageUrl as string) || ''
                          if (url) {
                            window.open(url, '_blank')
                          } else {
                            showOperationTip('小程序路径: ' + ((msgData.pagePath as string) || '未知'))
                          }
                        }} />
                      ) : (
                        <div
                          className={`rounded-md px-4 py-2 text-sm leading-relaxed ${
                            isMe
                              ? 'bg-[#95ec69] text-black'
                              : 'bg-[#f2f2f2] text-black'
                          }`}
                        >
                          <span className="text-[#999]">
                            [{msg.msg_type_display || msg.msg_type}]
                          </span>
                        </div>
                      )}

                      {/* 引用消息预览（放在主消息下方，灰色字体） */}
                      {msg.quoted_message_content && (
                        <div
                          className={`mt-1.5 flex max-w-full flex-col rounded-md bg-[#f2f2f2] px-3 py-1.5 text-xs ${
                            isMe ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div className="flex w-full items-start gap-1">
                            <span className="shrink-0 font-medium text-[#07c160]">
                              {msg.quoted_message_contact_name || '消息'}
                            </span>
                            <span className="line-clamp-2 text-[#666]">
                              {msg.quoted_message_content}
                            </span>
                          </div>
                          {msg.quoted_message_created_at && (
                            <span className="mt-0.5 text-[10px] text-[#b2b2b2]">
                              {formatTime(msg.quoted_message_created_at)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* 发送时间 + 消息状态图标 */}
                      <div className="mt-1 flex items-center gap-1.5">
                        {isMe && msg.status === 'sending' && (
                          <Loader2 className="h-3 w-3 animate-spin text-[#999]" />
                        )}
                        {isMe && msg.status === 'sent' && (
                          <Check className="h-3 w-3 text-[#999]" />
                        )}
                        {isMe && msg.status === 'delivered' && (
                          <CheckCheck className="h-3.5 w-3.5 text-[#999]" />
                        )}
                        {isMe && msg.status === 'read' && (
                          <CheckCheck className="h-3.5 w-3.5 text-[#07c160]" />
                        )}
                        {isMe && msg.status === 'failed' && (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium text-red-500">
                            <AlertCircle className="h-3 w-3" />
                            发送失败
                          </span>
                        )}
                        <span className="text-xs text-[#b2b2b2]">
                          {formatTime(msg.created_at)}
                        </span>
                        {msg.ai_generated && isMe && (
                          <span className="flex items-center gap-0.5 rounded bg-[#07c160]/10 px-1 py-0.5 text-[10px] font-medium text-[#07c160]">
                            <Bot className="h-2.5 w-2.5" />
                            AI
                          </span>
                        )}
                      </div>
                    </div>

                    {/* P3-B: 消息悬浮工具栏（微信 PC 风格） */}
                    {!msgMultiSelect && hoveredMsgId === msg.id && !msg.is_recalled && !recallingMessageIds.has(msg.id) && (
                      <div className={`absolute -top-7 ${isMe ? 'right-12' : 'left-12'} z-20 flex items-center gap-0.5 rounded-lg border border-[#e0e0e0] bg-white px-1 py-0.5 shadow-md`}>
                        <button onClick={() => quoteMessage(msg.id)} className="flex h-6 w-6 items-center justify-center rounded text-[#666] hover:bg-[#f0f0f0]" title="引用">
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setMsgContextMenu(null); setContactPickerMessageId(msg.id); setContactPickerMode('forward'); setShowContactPicker(true) }} className="flex h-6 w-6 items-center justify-center rounded text-[#666] hover:bg-[#f0f0f0]" title="转发">
                          <Forward className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={async () => { try { await api.wecom.favorites.create({ message_id: msg.id }); showOperationTip('已收藏') } catch { showOperationTip('收藏失败') } }} className="flex h-6 w-6 items-center justify-center rounded text-[#666] hover:bg-[#f0f0f0]" title="收藏">
                          <Star className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={async () => { try { await api.wecom.messages.delete(msg.id); setMessages(prev => prev.filter(m => m.id !== msg.id)) } catch { showOperationTip('删除失败') } }} className="flex h-6 w-6 items-center justify-center rounded text-[#666] hover:bg-[#f0f0f0]" title="删除">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {/* P5-C: AI 正在输入指示器（微信风格） */}
              {((aiTypingContactId !== null && aiTypingContactId === selectedContactId) ||
                (aiTypingRoomId !== null && aiTypingRoomId === selectedRoomId)) && (
                <div className="flex items-center gap-1 px-4 py-2">
                  <span className="text-xs text-[#999]">AI正在输入</span>
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#07c160]" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#07c160]" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#07c160]" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
          {messagesRefreshing && (
            <div className="pointer-events-none absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs text-white shadow">
              <Loader2 className="h-3 w-3 animate-spin" />
              更新中…
            </div>
          )}
          {/* P4-A: 回到底部浮动按钮（微信风格） */}
          {!isAtBottom && messages.length > 0 && (
            <button
              onClick={scrollToBottomClick}
              className="absolute bottom-4 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[#e0e0e0] bg-white text-[#07c160] shadow-lg transition-all hover:bg-[#f5f5f5] active:scale-95"
              title="回到最新消息"
            >
              {scrollUpUnreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#fa5151] px-1 text-[10px] font-bold text-white">
                  {scrollUpUnreadCount > 99 ? '99+' : scrollUpUnreadCount}
                </span>
              )}
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* 引用消息预览条 */}
        {quotedMessage && (
          <div className="flex items-center gap-3 border-t border-[#eee] bg-[#f7f7f7] px-6 py-2">
            <Reply className="h-4 w-4 shrink-0 text-[#07c160]" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-[#07c160]">
                {quotedMessage.direction === 'outbound' ? '你' : (quotedMessage.contact_name || '好友')}
              </span>
              <span className="ml-1.5 text-xs text-[#666] line-clamp-1">
                {quotedMessage.content}
              </span>
            </div>
            <button
              onClick={cancelQuote}
              className="shrink-0 text-[#999] hover:text-[#333]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 输入区 */}
        <div className="shrink-0 bg-white px-6 py-4">
          {/* 隐藏的文件选择 input */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* 表情选择器 */}
          {showEmojiPicker && (
            <div className="mb-3 rounded-xl border border-[#e2e2e2] bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-[#666]">常用表情</span>
                <button
                  onClick={() => setShowEmojiPicker(false)}
                  className="text-[#999] hover:text-[#333]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-8 gap-1">
                {PICKER_EMOJIS.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => insertEmoji(emoji)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors hover:bg-[#eee]"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 录音中提示 */}
          {isRecordingVoice && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm text-red-400">录音中，正在识别为文字...</span>
              <button
                onClick={stopRecording}
                className="ml-auto rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600"
              >
                停止
              </button>
            </div>
          )}

          {/* 语音识别中提示 */}
          {isTranscribingVoice && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#07c160]/30 bg-[#07c160]/10 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#07c160]" />
              <span className="text-sm text-[#07c160]">语音识别中...</span>
            </div>
          )}

          {/* 发送媒体中提示 */}
          {sendingMedia && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#07c160]/30 bg-[#07c160]/10 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#07c160]" />
              <span className="text-sm text-[#07c160]">正在发送...</span>
            </div>
          )}

          {/* 待发送媒体预览 */}
          {pendingMedia && !sendingMedia && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#e2e2e2] bg-white px-3 py-2">
              {pendingMedia.type === 'image' ? (
                <div className="flex items-center gap-3">
                  <img
                    src={pendingMedia.previewUrl}
                    alt="preview"
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <span className="text-sm text-[#666]">图片</span>
                </div>
              ) : pendingMedia.type === 'file' ? (
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-[#666]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#333]">{pendingMedia.file.name}</p>
                    <p className="text-xs text-[#999]">
                      {(pendingMedia.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-[#666]" />
                  <span className="text-sm text-[#666]">
                    语音 {pendingMedia.voiceTime} 秒
                  </span>
                </div>
              )}
              <button
                onClick={clearPendingMedia}
                className="ml-auto rounded-full p-1 text-[#999] hover:bg-[#eee] hover:text-[#333]"
                title="移除"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div
            className={`relative rounded-xl border bg-white p-3 transition-colors ${
              isDraggingFile
                ? 'border-[#07c160] border-2 bg-[#f0faf4]'
                : 'border-[#e2e2e2]'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* 拖拽提示遮罩 */}
            {isDraggingFile && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[#07c160] bg-[#f0faf4]/80">
                <div className="text-sm font-medium text-[#07c160]">
                  松手即可上传文件
                </div>
              </div>
            )}
            {isRecordingVoiceMsg ? (
              <div className="flex h-[104px] items-center justify-center px-4">
                <div className="flex items-center gap-3 rounded-full bg-[#f2f2f2] px-4 py-2.5 shadow-sm">
                  <button
                    onClick={() => stopVoiceMsgRecording(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#07c160] text-white shadow transition-colors hover:bg-[#06ad56]"
                    title="发送"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                  <div className="flex h-6 items-center gap-[3px] px-1">
                    {voiceMsgVolumes.map((vol, i) => (
                      <span
                        key={i}
                        className="w-1.5 rounded-full bg-[#07c160] transition-all duration-75"
                        style={{ height: `${8 + vol * 24}px`, opacity: 0.4 + vol * 0.6 }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => stopVoiceMsgRecording(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#666] transition-colors hover:bg-[#f0f0f0]"
                    title="取消"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <textarea
                  ref={(el) => {
                    messageInputRef.current = el
                    textareaAutoResizeRef.current = el
                  }}
                  value={input}
                  onPaste={handlePaste}
                  onChange={(e) => {
                    const val = e.target.value
                    setInput(val)
                    // 防抖保存草稿（500ms）
                    saveDraftDebounced(val, selectedContactId, selectedRoomId)

                    // —— @ 提及检测（仅在群聊中触发，参考微信交互） ——
                    if (selectedRoomId && messageInputRef.current) {
                      const cursorPos = messageInputRef.current.selectionStart
                      // 从光标位置向前找最近的 @
                      const textBeforeCursor = val.substring(0, cursorPos)
                      const lastAtIndex = textBeforeCursor.lastIndexOf('@')

                      if (lastAtIndex !== -1) {
                        // @ 后的文本（用于搜索过滤）
                        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
                        // 检查 @ 后没有空格或换行（微信规则：@ 后有空格则取消）
                        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                          // 检查 @ 前面是行首或空格（避免匹配邮箱等场景）
                          const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ''
                          if (lastAtIndex === 0 || charBeforeAt === ' ' || charBeforeAt === '\n') {
                            setShowAtPicker(true)
                            setAtMentionStartPos(lastAtIndex)
                            setAtSearchText(textAfterAt)
                            return
                          }
                        }
                      }

                      // 如果没有找到有效的 @，关闭面板
                      if (showAtPicker) {
                        setShowAtPicker(false)
                        setAtMentionStartPos(-1)
                        setAtSearchText('')
                      }
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={hasSelectedConversation ? '输入消息，Enter 发送' : '请先选择联系人或群聊'}
                  disabled={!hasSelectedConversation}
                  className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-[22px] text-[#333] placeholder:text-[#999] outline-none disabled:opacity-50"
                  style={{ minHeight: '22px', maxHeight: '132px', overflowY: 'hidden' }}
                />
                {/* @ 提及群成员选择面板（参考微信） */}
                {showAtPicker && selectedRoom && (
                  <div ref={atPickerRef} className="absolute left-3 bottom-32 z-40 w-64 max-h-60 overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-xl">
                    <div className="border-b border-[#f0f0f0] px-3 py-2 text-xs text-[#999]">
                      @{atSearchText ? `搜索 "${atSearchText}"` : '选择群成员'}
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {(() => {
                        const memberUids = selectedRoom.member_user_ids || []
                        const matched = memberUids
                          .map(uid => contacts.find(c => c.external_userid === uid))
                          .filter((c): c is WecomContact => !!c)
                          .filter(c => {
                            if (!atSearchText) return true
                            const q = atSearchText.toLowerCase()
                            return c.name.toLowerCase().includes(q) ||
                              (c.remark && c.remark.toLowerCase().includes(q))
                          })

                        if (matched.length === 0) {
                          return (
                            <div className="px-3 py-4 text-center text-xs text-[#999]">
                              未找到匹配的群成员
                            </div>
                          )
                        }

                        return matched.map((c, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              // 插入 @昵称 到输入框
                              const before = input.substring(0, atMentionStartPos)
                              const after = input.substring(messageInputRef.current?.selectionStart || input.length)
                              const insertText = `@${c.name} `
                              const newInput = before + insertText + after
                              setInput(newInput)
                              setShowAtPicker(false)
                              setAtMentionStartPos(-1)
                              setAtSearchText('')

                              // 恢复焦点并将光标移到插入文本之后
                              requestAnimationFrame(() => {
                                if (messageInputRef.current) {
                                  const newPos = before.length + insertText.length
                                  messageInputRef.current.focus()
                                  messageInputRef.current.setSelectionRange(newPos, newPos)
                                }
                              })
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#f5f5f5]"
                          >
                            {c.avatar ? (
                              <img src={c.avatar} alt="" className="h-7 w-7 shrink-0 rounded" />
                            ) : (
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#e8e8e8] text-[10px] font-medium text-[#999]">
                                {avatarFallback(c.name)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm text-[#333]">{c.name}</div>
                              {c.remark && (
                                <div className="truncate text-xs text-[#999]">{c.remark}</div>
                              )}
                            </div>
                          </button>
                        ))
                      })()}
                    </div>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[#999]">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[#eee] ${showEmojiPicker ? 'text-[#07c160]' : 'text-[#666]'}`}
                      title="表情"
                      disabled={!hasSelectedConversation}
                    >
                      <Smile className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (!showMediaPickerPanel) loadMediaAssets()
                        setShowMediaPickerPanel(!showMediaPickerPanel)
                        setShowEmojiPicker(false)
                        setShowFavoritesPanel(false)
                      }}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[#eee] ${showMediaPickerPanel ? 'text-[#07c160]' : 'text-[#666]'}`}
                      title="营销素材"
                      disabled={!hasSelectedConversation || sendingMedia}
                    >
                      <Package className="h-5 w-5" />
                    </button>
                    <button
                      onClick={isRecordingVoice ? stopRecording : startRecording}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[#eee] ${isRecordingVoice ? 'text-red-500' : 'text-[#666]'}`}
                      title={isRecordingVoice ? '停止录音' : '语音'}
                      disabled={!hasSelectedConversation || sendingMedia || isTranscribingVoice}
                    >
                      {isTranscribingVoice ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Mic className="h-5 w-5" />
                      )}
                    </button>
                    <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#666] transition-colors hover:bg-[#eee]" title="图片" disabled={!hasSelectedConversation || sendingMedia}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <ImageIcon className="h-5 w-5" />
                    </button>
                    <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#666] transition-colors hover:bg-[#eee]" title="文件" disabled={!hasSelectedConversation || sendingMedia}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileText className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (!showFavoritesPanel) loadFavorites()
                        setShowFavoritesPanel(!showFavoritesPanel)
                      }}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[#eee] ${showFavoritesPanel ? 'text-[#07c160]' : 'text-[#666]'}`}
                      title="收藏"
                      disabled={!hasSelectedConversation}
                    >
                      <Bookmark className="h-5 w-5" />
                    </button>
                    <button
                      onClick={startVoiceMsgRecording}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#666] transition-colors hover:bg-[#eee]"
                      title="发送语音"
                      disabled={!hasSelectedConversation || sendingMedia || isRecordingVoice || isTranscribingVoice}
                    >
                      <Volume2 className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setInput('')}
                      className="rounded-lg border border-[#d6d6d6] bg-white px-4 py-2 text-sm text-[#666] transition-colors hover:bg-[#eee]"
                    >
                      清空
                    </button>
                    <button
                      onClick={sendMessage}
                      disabled={(!input.trim() && !pendingMedia) || sending || !hasSelectedConversation || isTranscribingVoice}
                      className="flex items-center gap-1.5 rounded-lg bg-[#07c160] px-5 py-2 text-sm font-medium text-white shadow transition-all hover:bg-[#06ad56] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {sending ? '发送中...' : '点击发送'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 收藏面板 */}
      {showFavoritesPanel && (
        <div className="absolute bottom-[120px] left-[40%] z-40 w-80 rounded-xl border border-[#e2e2e2] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#eee] px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-[#333]">
              <Bookmark className="h-4 w-4 text-[#07c160]" />
              收藏内容
            </span>
            <button
              onClick={() => setShowFavoritesPanel(false)}
              className="text-[#999] hover:text-[#333]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* 分类标签 */}
          <div className="flex items-center gap-1 border-b border-[#eee] px-2 py-1.5">
            {[
              { key: 'all', label: '全部' },
              { key: 'text', label: '文本' },
              { key: 'image', label: '图片' },
              { key: 'voice', label: '语音' },
              { key: 'file', label: '文件' },
              { key: 'miniprogram', label: '小程序' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFavoritesCategory(tab.key)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  favoritesCategory === tab.key
                    ? 'bg-[#07c160] text-white'
                    : 'text-[#666] hover:bg-[#f0f0f0]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="h-80 overflow-y-auto p-2">
            {favoritesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[#999]" />
              </div>
            ) : favoritesList.filter((fav) => favoritesCategory === 'all' || fav.msg_type === favoritesCategory || (favoritesCategory === 'text' && fav.msg_type === 'emoji')).length === 0 ? (
              <div className="py-6 text-center text-sm text-[#999]">
                <Star className="mx-auto mb-2 h-8 w-8 opacity-20" />
                暂无收藏内容
              </div>
            ) : (
              favoritesList
                .filter((fav) => favoritesCategory === 'all' || fav.msg_type === favoritesCategory || (favoritesCategory === 'text' && fav.msg_type === 'emoji'))
                .map((fav) => (
                <button
                  key={fav.id}
                  onClick={() => applyFavorite(fav)}
                  className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-[#f5f5f5] transition-colors"
                >
                  <div className="mt-0.5 shrink-0">
                    {fav.msg_type === 'text' && <MessageCircle className="h-4 w-4 text-[#666]" />}
                    {fav.msg_type === 'image' && <ImageIcon className="h-4 w-4 text-[#666]" />}
                    {fav.msg_type === 'file' && <FileText className="h-4 w-4 text-[#666]" />}
                    {fav.msg_type === 'voice' && <Mic className="h-4 w-4 text-[#666]" />}
                    {fav.msg_type === 'emoji' && <Smile className="h-4 w-4 text-[#666]" />}
                    {fav.msg_type === 'miniprogram' && <Smartphone className="h-4 w-4 text-[#07c160]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[#333]">
                      {fav.msg_type === 'miniprogram'
                        ? (() => {
                            try {
                              const rd = typeof fav.raw_data === 'string' ? JSON.parse(fav.raw_data) : fav.raw_data
                              const md = rd?.msgData || rd || {}
                              return (md.title as string) || (md.appName as string) || '小程序'
                            } catch { return fav.content || '[小程序]' }
                          })()
                        : (fav.content || fav.media_file_name || `[${fav.msg_type_display || fav.msg_type}]`)}
                    </p>
                    <span className="text-xs text-[#999]">{fav.msg_type_display || fav.msg_type}</span>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        await api.wecom.favorites.delete(fav.id)
                        setFavoritesList((prev) => prev.filter((f) => f.id !== fav.id))
                      } catch { /* ignore */ }
                    }}
                    className="shrink-0 text-[#ccc] hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-[#eee] px-3 py-2 text-center text-xs text-[#999]">
            点击内容填入输入框（小程序直接发送）
          </div>
        </div>
      )}

      {/* 营销素材面板 */}
      {showMediaPickerPanel && (
        <div className="absolute bottom-[120px] left-[40%] z-40 w-96 rounded-xl border border-[#e2e2e2] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#eee] px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-[#333]">
              <Package className="h-4 w-4 text-[#07c160]" />
              营销素材
            </span>
            <button
              onClick={() => setShowMediaPickerPanel(false)}
              className="text-[#999] hover:text-[#333]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* 类型标签 */}
          <div className="flex flex-wrap items-center gap-1 border-b border-[#eee] px-2 py-1.5">
            {[
              { key: 'image', label: '图片', icon: ImageIcon },
              { key: 'video', label: '视频', icon: Video },
              { key: 'audio', label: '语音', icon: Mic },
              { key: 'file', label: '文件', icon: FileText },
              { key: 'link', label: '链接', icon: Link2 },
              { key: 'miniapp', label: '小程序', icon: Smartphone },
              { key: 'channel', label: '视频号', icon: PlaySquare },
              { key: 'emoji', label: 'Emoji', icon: Smile },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveMediaTab(tab.key)}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${
                  activeMediaTab === tab.key
                    ? 'bg-[#07c160] text-white'
                    : 'text-[#666] hover:bg-[#f0f0f0]'
                }`}
              >
                <tab.icon className="h-3 w-3" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="h-80 overflow-y-auto p-2">
            {mediaLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[#999]" />
              </div>
            ) : mediaAssets.filter((a) => (a.type || 'image') === activeMediaTab).length === 0 ? (
              <div className="py-6 text-center text-sm text-[#999]">
                <Package className="mx-auto mb-2 h-8 w-8 opacity-20" />
                暂无{({ image: '图片', video: '视频', audio: '语音', file: '文件', link: '链接', miniapp: '小程序', channel: '视频号', emoji: 'Emoji' } as Record<string, string>)[activeMediaTab]}素材
              </div>
            ) : (
              mediaAssets
                .filter((a) => (a.type || 'image') === activeMediaTab)
                .map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => sendMediaAsset(asset)}
                    disabled={sendingMedia || sending}
                    className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
                  >
                    <div className="mt-0.5 shrink-0">
                      {activeMediaTab === 'image' && <ImageIcon className="h-4 w-4 text-[#666]" />}
                      {activeMediaTab === 'video' && <Video className="h-4 w-4 text-[#666]" />}
                      {activeMediaTab === 'audio' && <Mic className="h-4 w-4 text-[#666]" />}
                      {activeMediaTab === 'file' && <FileText className="h-4 w-4 text-[#666]" />}
                      {activeMediaTab === 'link' && <Link2 className="h-4 w-4 text-[#666]" />}
                      {activeMediaTab === 'miniapp' && <Smartphone className="h-4 w-4 text-[#07c160]" />}
                      {activeMediaTab === 'channel' && <PlaySquare className="h-4 w-4 text-[#666]" />}
                      {activeMediaTab === 'emoji' && <Smile className="h-4 w-4 text-[#666]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#333]">{asset.name || asset.description || '未命名素材'}</p>
                      <span className="text-xs text-[#999]">
                        {asset.size || '-'}
                        {asset.description ? ' · ' + asset.description.slice(0, 30) : ''}
                      </span>
                    </div>
                    <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#07c160]" />
                  </button>
                ))
            )}
          </div>
          <div className="border-t border-[#eee] px-3 py-2 text-center text-xs text-[#999]">
            点击素材发送给好友
          </div>
        </div>
      )}

      {/* 右键菜单 — 消息 */}
      {msgContextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg border border-[#e2e2e2] bg-white py-1 shadow-xl"
          style={{ left: msgContextMenu.x, top: msgContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#333] hover:bg-[#eee] transition-colors"
            onClick={() => copyMessage(msgContextMenu.messageId)}
          >
            <Copy className="h-4 w-4" />
            复制
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#333] hover:bg-[#eee] transition-colors"
            onClick={() => favoriteMessage(msgContextMenu.messageId)}
          >
            <Star className="h-4 w-4" />
            收藏
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#333] hover:bg-[#eee] transition-colors"
            onClick={() => {
              setContactPickerMessageId(msgContextMenu.messageId)
              setContactPickerMode('forward')
              setContactPickerSelected(new Set())
              setContactPickerSearch('')
              setShowContactPicker(true)
              setMsgContextMenu(null)
            }}
          >
            <Forward className="h-4 w-4" />
            转发
          </button>
          <div className="my-1 border-t border-[#eee]" />
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#333] hover:bg-[#eee] transition-colors"
            onClick={() => quoteMessage(msgContextMenu.messageId)}
          >
            <Reply className="h-4 w-4" />
            引用
          </button>
          {(() => {
            const msg = messages.find((m) => m.id === msgContextMenu.messageId)
            // 仅自己发出的消息可撤回；超过 2 分钟（微信/企微撤回时限）后置灰
            if (msg && msg.direction === 'outbound' && !msg.is_recalled) {
              const RECALL_WINDOW_MS = 2 * 60 * 1000
              const isRecalling = recallingMessageIds.has(msg.id)
              const canRecall = !isRecalling && Date.now() - new Date(msg.created_at).getTime() < RECALL_WINDOW_MS
              return (
                <button
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    canRecall
                      ? 'text-[#333] hover:bg-[#eee]'
                      : 'cursor-not-allowed text-[#999]'
                  }`}
                  onClick={() => canRecall && recallMessage(msgContextMenu.messageId)}
                  disabled={!canRecall}
                >
                  {isRecalling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Undo2 className="h-4 w-4" />
                  )}
                  {isRecalling ? '努力撤回中…' : '撤回'}
                </button>
              )
            }
            return null
          })()}
          <div className="my-1 border-t border-[#eee]" />
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#333] hover:bg-[#eee] transition-colors"
            onClick={() => {
              setMsgContextMenu(null)
              setMsgMultiSelect(true)
              setSelectedMessageIds(new Set([msgContextMenu.messageId]))
            }}
          >
            <CheckSquare className="h-4 w-4" />
            多选
          </button>
          <div className="my-1 border-t border-[#eee]" />
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
            onClick={() => deleteMessage(msgContextMenu.messageId)}
          >
            <Trash2 className="h-4 w-4" />
            删除
          </button>
        </div>
      )}

      {/* 多选模式 — 消息批量操作栏 */}
      {msgMultiSelect && (
        <div className="absolute bottom-[120px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[#d6d6d6] bg-white px-4 py-2.5 shadow-lg">
          <span className="text-sm text-[#666]">
            已选 {selectedMessageIds.size} 项
          </span>
          <button
            onClick={() => setSelectedMessageIds(new Set(messages.map((m) => m.id)))}
            className="rounded-lg border border-[#d6d6d6] px-3 py-1 text-xs text-[#666] hover:bg-[#eee]"
          >
            全选
          </button>
          <div className="h-4 w-px bg-[#e2e2e2]" />
          <button
            onClick={batchFavoriteMessages}
            disabled={selectedMessageIds.size === 0}
            className="flex items-center gap-1 rounded-lg bg-[#07c160] px-3 py-1 text-xs font-medium text-white hover:bg-[#06ad56] disabled:opacity-50"
          >
            <Star className="h-3.5 w-3.5" />
            收藏
          </button>
          <button
            onClick={batchDeleteMessages}
            disabled={selectedMessageIds.size === 0}
            className="flex items-center gap-1 rounded-lg border border-red-500 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </button>
          <button
            onClick={() => {
              setMsgMultiSelect(false)
              setSelectedMessageIds(new Set())
            }}
            className="flex items-center gap-1 rounded-lg border border-[#d6d6d6] px-3 py-1 text-xs text-[#666] hover:bg-[#eee]"
          >
            <XCircle className="h-3.5 w-3.5" />
            退出
          </button>
        </div>
      )}

      {/* 联系人选择弹窗（转发/群发共用） */}
      {showContactPicker && contactPickerMessageId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => { setShowContactPicker(false); setContactPickerSelected(new Set()); setContactPickerSearch(''); setContactPickerMessageId(null) }}
        >
          <div
            className="w-96 rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between border-b border-[#eee] px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-[#333]">
                {contactPickerMode === 'forward' ? <Forward className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                {contactPickerMode === 'forward' ? '转发给' : '群发给'}
              </span>
              <button
                onClick={() => { setShowContactPicker(false); setContactPickerSelected(new Set()); setContactPickerSearch(''); setContactPickerMessageId(null) }}
                className="text-[#999] hover:text-[#333]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* 搜索框 */}
            <div className="border-b border-[#eee] px-3 py-2">
              <div className="flex items-center gap-2 rounded-lg bg-[#f5f5f5] px-3 py-1.5">
                <Search className="h-4 w-4 shrink-0 text-[#999]" />
                <input
                  value={contactPickerSearch}
                  onChange={(e) => setContactPickerSearch(e.target.value)}
                  placeholder="搜索好友名称、备注或标签"
                  className="w-full bg-transparent text-sm text-[#333] placeholder:text-[#999] outline-none"
                  autoFocus
                />
                {contactPickerSearch && (
                  <button onClick={() => setContactPickerSearch('')} className="text-[#999] hover:text-[#333]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {/* 联系人列表 */}
            <div className="max-h-64 overflow-y-auto p-2">
              {(() => {
                const pickerContacts = filteredContacts
                  .filter(c => c.id !== selectedContactId)
                  .filter(c => {
                    if (!contactPickerSearch.trim()) return true
                    const q = contactPickerSearch.toLowerCase()
                    return (
                      c.name.toLowerCase().includes(q) ||
                      (c.remark && c.remark.toLowerCase().includes(q)) ||
                      (c.tags_display && c.tags_display.some(t => t.name.toLowerCase().includes(q)))
                    )
                  })
                if (pickerContacts.length === 0) {
                  return <div className="py-6 text-center text-sm text-[#999]">未找到匹配的联系人</div>
                }
                return pickerContacts.map((c) => {
                  const checked = contactPickerSelected.has(c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setContactPickerSelected(prev => {
                          const next = new Set(prev)
                          if (next.has(c.id)) next.delete(c.id)
                          else next.add(c.id)
                          return next
                        })
                      }}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-[#f5f5f5] transition-colors"
                    >
                      {/* 复选框 */}
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${checked ? 'border-[#07c160] bg-[#07c160]' : 'border-[#ccc]'}`}>
                        {checked && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                      {/* 头像 */}
                      <div className="shrink-0">
                        {c.avatar ? (
                          <img src={c.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07c160] text-xs font-bold text-white">
                            {avatarFallback(c.name)}
                          </div>
                        )}
                      </div>
                      {/* 名称 + 标签 */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[#333]">{c.remark || c.name}</p>
                        {c.tags_display && c.tags_display.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {c.tags_display.slice(0, 3).map(t => (
                              <span key={t.id} className="rounded px-1.5 py-0.5 text-[10px] text-white" style={{ backgroundColor: t.color || '#999' }}>
                                {t.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })
              })()}
            </div>
            {/* 底部操作栏 */}
            <div className="flex items-center justify-between border-t border-[#eee] px-3 py-2.5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const pickerContacts = filteredContacts.filter(c => c.id !== selectedContactId)
                    setContactPickerSelected(new Set(pickerContacts.map(c => c.id)))
                  }}
                  className="rounded-lg border border-[#d6d6d6] px-2.5 py-1 text-xs text-[#666] hover:bg-[#eee]"
                >
                  全选
                </button>
                <button
                  onClick={() => setContactPickerSelected(new Set())}
                  className="rounded-lg border border-[#d6d6d6] px-2.5 py-1 text-xs text-[#666] hover:bg-[#eee]"
                >
                  取消全选
                </button>
                <span className="text-xs text-[#999]">已选 {contactPickerSelected.size} 项</span>
              </div>
              <button
                onClick={confirmContactPicker}
                disabled={contactPickerSelected.size === 0}
                className="rounded-lg bg-[#07c160] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#06ad56] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {contactPickerMode === 'forward' ? '确认转发' : '确认群发'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 图片预览弹窗 */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <img
            src={previewImageUrl}
            alt="图片预览"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPreviewImageUrl(null)}
            className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* 绑定企微设备弹窗（两步：填表单 → 扫码登录） */}
      {showAddDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary">
                {deviceStep === 1 ? '绑定企微设备' : '扫码登录'}
              </h3>
              <button
                onClick={() => {
                  if (loginPollRef.current) {
                    clearInterval(loginPollRef.current)
                    loginPollRef.current = null
                  }
                  if (successTimerRef.current) {
                    clearTimeout(successTimerRef.current)
                    successTimerRef.current = null
                  }
                  setShowAddDeviceModal(false)
                  resetDeviceFlow()
                }}
                className="rounded-lg p-1 text-text-muted hover:bg-bg-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 步骤指示器（两步） */}
            <div className="mb-6 flex items-center gap-2">
              {[1, 2].map((s) => (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                      deviceStep >= s
                        ? 'bg-accent text-white'
                        : 'bg-bg-hover text-text-muted'
                    }`}
                  >
                    {deviceStep > s ? <Check className="h-4 w-4" /> : s}
                  </div>
                  {s < 2 && (
                    <div
                      className={`h-0.5 flex-1 rounded ${deviceStep > s ? 'bg-accent' : 'bg-border-default'}`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* 步骤1：填写 GUID + 备注 + 手机号 */}
            {deviceStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-text-muted">GUID 号 <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={deviceForm.guid}
                    onChange={(e) => setDeviceForm({ ...deviceForm, guid: e.target.value })}
                    placeholder="请输入天网大脑分配的 GUID 号"
                    className="w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  />
                  <p className="mt-1 text-xs text-text-muted">由天网大脑管理后台创建企微号时自动生成</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">备注</label>
                  <input
                    type="text"
                    value={deviceForm.remark}
                    onChange={(e) => setDeviceForm({ ...deviceForm, remark: e.target.value })}
                    placeholder="如：销售一部-张经理"
                    className="w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">手机号 <span className="text-red-400">*</span></label>
                  <input
                    type="tel"
                    value={deviceForm.mobile}
                    onChange={(e) => setDeviceForm({ ...deviceForm, mobile: e.target.value.replace(/\D/g, '') })}
                    placeholder="企微号绑定手机号"
                    maxLength={11}
                    className="w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                  />
                </div>
              </div>
            )}

            {/* 步骤2：扫码登录 + 验证码输入 + 完成 */}
            {deviceStep === 2 && (
              <div className="space-y-4">
                <div className="flex flex-col items-center">
                  {qrCodeData ? (
                    <div className="rounded-xl border border-border-subtle bg-white p-3">
                      <img
                        src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                        alt="登录二维码"
                        className="h-48 w-48"
                      />
                    </div>
                  ) : (
                    <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-border-subtle bg-bg-hover">
                      <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
                    </div>
                  )}

                  {/* 登录状态提示 */}
                  <div className="mt-4 text-center">
                    {loginSuccess ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15">
                          <Check className="h-5 w-5 text-green-400" />
                        </div>
                        <p className="text-sm font-medium text-green-400">登录成功{loginUserInfo.nickname ? `（${loginUserInfo.nickname}）` : ''}</p>
                        <p className="text-xs text-text-muted">正在进入跟客聊天...</p>
                      </div>
                    ) : (
                      <>
                        {loginStatus === -1 && (
                          <p className="text-sm text-text-secondary">请使用企业微信扫描二维码登录</p>
                        )}
                        {loginStatus === 0 && (
                          <p className="text-sm text-text-secondary">请使用企业微信扫描二维码登录</p>
                        )}
                        {loginStatus === 1 && (
                          <p className="text-sm text-accent">已扫码，请在手机上确认登录</p>
                        )}
                        {loginStatus === 4 && (
                          <p className="text-sm text-red-400">用户取消了登录，请重新扫码</p>
                        )}
                        {loginStatus === 10 && (
                          <p className="text-sm text-amber-400">请在下方输入设备验证码</p>
                        )}
                        {loginStatus === null && (
                          <p className="text-sm text-text-secondary">等待扫码...</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 验证码输入框 — 始终显示在二维码下方（始终可输入） */}
                {!loginSuccess && (
                  <div className="w-full">
                    <label className="mb-1 block text-xs text-text-muted">
                      设备验证码{loginStatus === 10 ? <span className="text-red-400"> *</span> : '（扫码后如需填写）'}
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                      placeholder={loginStatus === 10 ? '请输入6位验证码' : '6位数字'}
                      className="w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-center text-lg tracking-widest text-text-primary outline-none focus:border-accent"
                    />
                    <button
                      onClick={handleVerifyCode}
                      disabled={deviceLoading || verifyCode.length !== 6}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deviceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {deviceLoading ? '验证中...' : '提交验证码'}
                    </button>
                  </div>
                )}

                {/* 重新扫码按钮 — status=4 时显示 */}
                {!loginSuccess && loginStatus === 4 && (
                  <button
                    onClick={async () => {
                      setDeviceLoading(true)
                      setDeviceError(null)
                      try {
                        const qrRes = await api.wecom.devices.getQrcode({
                          guid: deviceGuid,
                          device_id: deviceId ?? undefined,
                        })
                        if (qrRes.code === API_BUSINESS_CODE.SUCCESS && qrRes.data) {
                          setQrCodeData(qrRes.data.loginQrcodeBase64Data)
                          setLoginStatus(-1)
                          if (deviceId) startLoginPolling(deviceGuid, deviceId)
                        }
                      } catch {
                        setDeviceError('获取二维码失败')
                      } finally {
                        setDeviceLoading(false)
                      }
                    }}
                    disabled={deviceLoading}
                    className="flex w-full items-center gap-1.5 rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                  >
                    {deviceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    重新扫码
                  </button>
                )}
              </div>
            )}

            {/* 弹窗内错误消息 */}
            {deviceError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{deviceError}</span>
              </div>
            )}

            {/* 底部按钮 */}
            <div className="mt-6 flex items-center justify-end gap-3">
              {deviceStep === 1 && (
                <>
                  <button
                    onClick={() => {
                      setShowAddDeviceModal(false)
                      resetDeviceFlow()
                    }}
                    className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={deviceLoading}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white shadow-glow transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deviceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {deviceLoading ? '加载中...' : '下一步'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 右键菜单 — 联系人 */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg border border-[#e2e2e2] bg-white py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {(() => {
            const contact = contacts.find((c) => c.id === contextMenu.contactId)
            const isPinned = contact?.is_pinned ?? false
            return (
              <>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#333] hover:bg-[#eee] transition-colors"
                  onClick={() => togglePinContact(contextMenu.contactId, !isPinned)}
                >
                  {isPinned ? (
                    <>
                      <PinOff className="h-4 w-4" />
                      取消置顶
                    </>
                  ) : (
                    <>
                      <Pin className="h-4 w-4" />
                      置顶联系人
                    </>
                  )}
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#333] hover:bg-[#eee] transition-colors"
                  onClick={() => deleteContact(contextMenu.contactId)}
                >
                  <Trash2 className="h-4 w-4" />
                  删除联系人
                </button>
                <div className="my-1 border-t border-[#eee]" />
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#333] hover:bg-[#eee] transition-colors"
                  onClick={() => {
                    setContextMenu(null)
                    setContactMultiSelect(true)
                    setSelectedContactIds(new Set([contextMenu.contactId]))
                  }}
                >
                  <CheckSquare className="h-4 w-4" />
                  多选
                </button>
              </>
            )
          })()}
        </div>
      )}

      {/* 右键菜单 — 设备列表 */}
      {deviceContextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg border border-[#e2e2e2] bg-white py-1 shadow-xl"
          style={{
            left: Math.min(deviceContextMenu.x, window.innerWidth - 180),
            top: Math.min(deviceContextMenu.y, window.innerHeight - 200),
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {(() => {
            const device = devices.find((d) => d.id === deviceContextMenu.deviceId)
            const isOnline = device?.status === 'online'
            return (
              <>
                {isOnline && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#333] hover:bg-[#eee] transition-colors"
                    onClick={() => handleDeviceLogout(deviceContextMenu.deviceId)}
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </button>
                )}
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#333] hover:bg-[#eee] transition-colors"
                  onClick={() => handleDeviceLogin(deviceContextMenu.deviceId)}
                >
                  <QrCode className="h-4 w-4" />
                  登录
                </button>
                <div className="my-1 border-t border-[#eee]" />
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-[#fee] transition-colors"
                  onClick={() => {
                    setDeviceDeleteConfirm(deviceContextMenu.deviceId)
                    setDeviceContextMenu(null)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              </>
            )
          })()}
        </div>
      )}

      {/* 删除设备确认弹窗 */}
      {deviceDeleteConfirm !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="text-base font-semibold text-text-primary">删除设备</h3>
            </div>
            <p className="mb-5 text-sm text-text-secondary">
              删除后聊天消息将彻底清除，请谨慎操作
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeviceDeleteConfirm(null)}
                disabled={deviceActionLoading}
                className="flex-1 rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={() => handleDeviceDelete(deviceDeleteConfirm)}
                disabled={deviceActionLoading}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {deviceActionLoading ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}


      {contactMultiSelect && (
        <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center gap-3 border-t border-[#d6d6d6] bg-white px-4 py-3 shadow-lg">
          <span className="text-sm text-[#666]">
            已选 {selectedContactIds.size} 项
          </span>
          <button
            onClick={() => {
              if (selectedContactIds.size === filteredContacts.length && filteredContacts.length > 0) {
                setSelectedContactIds(new Set())
              } else {
                setSelectedContactIds(new Set(filteredContacts.map((c) => c.id)))
              }
            }}
            className="rounded-lg border border-[#d6d6d6] px-3 py-1.5 text-xs text-[#666] hover:bg-[#eee]"
          >
            {selectedContactIds.size === filteredContacts.length && filteredContacts.length > 0 ? '取消全选' : '全选'}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => batchAiHost(true)}
            disabled={selectedContactIds.size === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#07c160] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#06ad56] disabled:opacity-50"
          >
            <Bot className="h-3.5 w-3.5" />
            AI托管
          </button>
          <button
            onClick={() => batchAiHost(false)}
            disabled={selectedContactIds.size === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#ff9900] px-3 py-1.5 text-xs font-medium text-[#ff9900] hover:bg-[#fff5e6] disabled:opacity-50"
          >
            <Bot className="h-3.5 w-3.5" />
            取消AI托管
          </button>
          <button
            onClick={() => batchPinContacts(true)}
            disabled={selectedContactIds.size === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#07c160] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#06ad56] disabled:opacity-50"
          >
            <Pin className="h-3.5 w-3.5" />
            置顶
          </button>
          <button
            onClick={batchDeleteContacts}
            disabled={selectedContactIds.size === 0}
            className="flex items-center gap-1.5 rounded-lg border border-red-500 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </button>
          <button
            onClick={() => {
              setContactMultiSelect(false)
              setSelectedContactIds(new Set())
            }}
            className="flex items-center gap-1 rounded-lg border border-[#d6d6d6] px-3 py-1.5 text-xs text-[#666] hover:bg-[#eee]"
          >
            <XCircle className="h-3.5 w-3.5" />
            退出
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================

interface MarketingViewProps {
  initialTab?: string
}

export default function MarketingView({ initialTab }: MarketingViewProps) {
  const store = useStore()
  const [activeTab, setActiveTab] = useState<string>(
    initialTab && TABS.some((t) => t.key === initialTab) ? initialTab : 'chat'
  )

  // 同步外部传入的 initialTab（用于从侧边栏直接导航到子 Tab）
  useEffect(() => {
    if (initialTab && TABS.some((t) => t.key === initialTab) && activeTab !== initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => hasAccess(store.userPermissions, tab.key as import('../App').ViewKey)),
    [store.userPermissions]
  )

  // 当前 Tab 无权限时回退到第一个有权限的 Tab
  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === activeTab) && visibleTabs.length > 0) {
      setActiveTab(visibleTabs[0].key)
    }
  }, [visibleTabs, activeTab])

  return (
    <div className="flex h-full flex-col bg-bg-base text-text-primary">
      {/* 顶部 Tab 导航 */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface/60 pl-2.5 pr-6 backdrop-blur">
        <div className="flex items-center gap-1">
          {visibleTabs.map((tab) => (
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

      {/* 主体内容 */}
      {activeTab === 'chat' && <ChatTab />}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'broadcast' && <MassSendTab />}
      {activeTab === 'tags' && <TagsTab />}
      {activeTab === 'moments' && <MomentsTab />}
      {activeTab === 'board' && <BoardTab />}
    </div>
  )
}
