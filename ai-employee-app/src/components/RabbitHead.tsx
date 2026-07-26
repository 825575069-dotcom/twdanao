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
  className
}: {
  agentId?: string
  className?: string
}) {
  const store = useStore()
  const agent = agentId ? store.agents.find((a) => a.id === agentId) : null

  // 自定义头像优先级最高；否则按围巾颜色选择；都没有则使用默认紫色围巾头像
  const src = agent?.avatar || (agent?.scarfColor ? SCARF_IMAGES[agent.scarfColor] : '/yesgo-avatar.png')

  return (
    <img
      src={src}
      alt="YesGo digital employee rabbit"
      className={`object-contain ${className ?? ''}`}
    />
  )
}
