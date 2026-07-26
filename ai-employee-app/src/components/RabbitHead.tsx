/**
 * YesGo 数字员工形象 —— 戴围巾的小白兔
 * 根据 agentId 从 store 读取围巾颜色配置，渲染对应形象
 */
import { useStore } from '../store/appStore'

const SCARF_IMAGES: Record<string, string> = {
  red: '/rabbits/red.png',
  green: '/rabbits/green.png',
  yellow: '/rabbits/yellow.png',
  blue: '/rabbits/blue.png',
  orange: '/rabbits/orange.png',
  purple: '/yesgo-avatar.png'
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
  // 否则按 agent 自身的围巾颜色；都没有则使用默认紫色围巾头像
  const colorKey = scarfColor || agent?.scarfColor
  const src = agent?.avatar || (colorKey ? SCARF_IMAGES[colorKey] || '/yesgo-avatar.png' : '/yesgo-avatar.png')

  return (
    <img
      src={src}
      alt="YesGo digital employee rabbit"
      className={`object-contain ${className ?? ''}`}
    />
  )
}
