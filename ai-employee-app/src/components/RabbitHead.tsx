/**
 * 智能体头像 —— 全平台 AI 统一形象
 * 支持按 agentId 显示角色化小白兔插画，无 agentId 时回退默认 SVG
 */
export default function RabbitHead({
  agentId,
  className
}: {
  agentId?: string
  className?: string
}) {
  if (agentId && agentId !== 'default') {
    return (
      <img
        src={`./avatars/${agentId}.png`}
        alt={`${agentId} avatar`}
        className={`rounded-full object-cover ${className ?? ''}`}
        draggable={false}
      />
    )
  }

  return (
    <svg viewBox="0 0 80 90" className={className} aria-label="rabbit">
      {/* 耳朵 */}
      <ellipse cx="28" cy="20" rx="9" ry="22" fill="white" stroke="#d4d4d8" strokeWidth="1" />
      <ellipse cx="52" cy="20" rx="9" ry="22" fill="white" stroke="#d4d4d8" strokeWidth="1" />
      {/* 耳内 */}
      <ellipse cx="28" cy="20" rx="4" ry="14" fill="#fce7f3" />
      <ellipse cx="52" cy="20" rx="4" ry="14" fill="#fce7f3" />
      {/* 头 */}
      <ellipse cx="40" cy="55" rx="26" ry="22" fill="white" stroke="#d4d4d8" strokeWidth="1" />
      {/* 眼睛 */}
      <circle cx="30" cy="52" r="2.5" fill="#18181b" />
      <circle cx="50" cy="52" r="2.5" fill="#18181b" />
      {/* 腮红 */}
      <circle cx="24" cy="58" r="3.5" fill="#fda4af" opacity="0.35" />
      <circle cx="56" cy="58" r="3.5" fill="#fda4af" opacity="0.35" />
      {/* 鼻子 */}
      <ellipse cx="40" cy="62" rx="3" ry="2.5" fill="#fb7185" />
      {/* 嘴 */}
      <path
        d="M40 64.5 L40 69 M35 67 Q40 71 45 67"
        stroke="#18181b"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
