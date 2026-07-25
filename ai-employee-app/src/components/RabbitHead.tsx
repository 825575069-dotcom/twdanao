/**
 * YesGo 数字员工形象 —— 戴紫色围巾的小白兔
 * 使用用户提供的头像图片
 */
export default function RabbitHead({
  agentId,
  className
}: {
  agentId?: string
  className?: string
}) {
  // 统一使用戴围巾的兔子形象，忽略 agentId 参数
  void agentId

  return (
    <img
      src="/yesgo-avatar.png"
      alt="YesGo digital employee rabbit"
      className={`object-contain ${className ?? ''}`}
    />
  )
}
