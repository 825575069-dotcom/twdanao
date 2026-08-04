/**
 * YesGo 数字员工形象 —— 戴围巾的小白兔
 * 根据 agentId 从 store 读取围巾颜色配置，渲染对应形象
 */
import { useStore } from '../store/appStore'

// 使用相对路径，兼容 Electron 打包后的 file:// 协议和 Web 部署
// 12 色兔仔形象（2026-07-29 全平台统一更换）
const SCARF_IMAGES: Record<string, string> = {
  brown: './rabbits/brown.png',
  purple: './rabbits/purple.png',
  magenta: './rabbits/magenta.png',
  darkgreen: './rabbits/darkgreen.png',
  darkblue: './rabbits/darkblue.png',
  springgreen: './rabbits/springgreen.png',
  bluegray: './rabbits/bluegray.png',
  orangered: './rabbits/orangered.png',
  pink: './rabbits/pink.png',
  red: './rabbits/red.png',
  yellow: './rabbits/yellow.png',
  royalblue: './rabbits/royalblue.png'
}

// Map hex colors from the admin backend to named scarf colors
const HEX_TO_NAME: Record<string, string> = {
  '#8b4513': 'brown',
  '#9333ea': 'purple',
  '#d946ef': 'magenta',
  '#166534': 'darkgreen',
  '#1e3a8a': 'darkblue',
  '#84cc16': 'springgreen',
  '#64748b': 'bluegray',
  '#ea580c': 'orangered',
  '#ec4899': 'pink',
  '#dc2626': 'red',
  '#eab308': 'yellow',
  '#2563eb': 'royalblue',
  // 旧色值向后兼容映射
  '#f97316': 'orangered',
  '#facc15': 'yellow',
  '#16a34a': 'darkgreen'
}

// 旧色值名称向后兼容
const LEGACY_NAME_MAP: Record<string, string> = {
  orange: 'orangered',
  green: 'darkgreen',
  blue: 'royalblue'
}

function resolveRabbitImage(colorKey?: string): string {
  if (!colorKey) return SCARF_IMAGES.purple
  const key = colorKey.toLowerCase()
  if (SCARF_IMAGES[key]) return SCARF_IMAGES[key]
  if (HEX_TO_NAME[key]) return SCARF_IMAGES[HEX_TO_NAME[key]]
  // 旧色值名称兼容
  if (LEGACY_NAME_MAP[key]) return SCARF_IMAGES[LEGACY_NAME_MAP[key]]
  return SCARF_IMAGES.purple
}

export default function RabbitHead({
  agentId,
  scarfColor,
  className
}: {
  agentId?: string
  scarfColor?: string
  className?: string
}) {
  const store = useStore()
  const agent = agentId ? store.agents.find((a) => a.id === agentId) : null

  // 自定义头像优先级最高；
  // 其次使用外部传入的 scarfColor（如首页经理兔跟随用户主题色）；
  // 否则按 agent 自身的围巾颜色；都没有则使用默认紫色围巾兔仔头像
  const colorKey = scarfColor || agent?.scarfColor
  const src = agent?.avatar || resolveRabbitImage(colorKey)

  return (
    <img
      src={src}
      alt="YesGo digital employee rabbit"
      className={`object-contain ${className ?? ''}`}
    />
  )
}
