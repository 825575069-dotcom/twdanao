// ============================================================
// InteractiveRabbit — 交互式 SVG 兔子公仔
// 特性：耳朵微动 / 眼睛跟随鼠标 / 输入密码时闭眼
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react'

interface InteractiveRabbitProps {
  /** 围巾颜色 key（6 色之一） */
  scarfColor?: string
  className?: string
  /** 是否闭眼（输入密码时为 true） */
  closeEyes?: boolean
}

// 12 色围巾 → SVG 填充色
const SCARF_COLORS: Record<string, { main: string; dark: string; shadow: string }> = {
  brown:       { main: '#8b4513', dark: '#6b3410', shadow: '#4d240a' },
  purple:      { main: '#9333ea', dark: '#7e22ce', shadow: '#6b21a8' },
  magenta:     { main: '#d946ef', dark: '#b820e0', shadow: '#86198f' },
  darkgreen:   { main: '#166534', dark: '#14532d', shadow: '#0f3d22' },
  darkblue:    { main: '#1e3a8a', dark: '#1e40af', shadow: '#172554' },
  springgreen: { main: '#84cc16', dark: '#65a30d', shadow: '#4d7c0f' },
  bluegray:    { main: '#64748b', dark: '#475569', shadow: '#334155' },
  orangered:   { main: '#ea580c', dark: '#c2410c', shadow: '#9a3412' },
  pink:        { main: '#ec4899', dark: '#db2777', shadow: '#9d174d' },
  red:         { main: '#dc2626', dark: '#b91c1c', shadow: '#991b1b' },
  yellow:      { main: '#eab308', dark: '#ca8a04', shadow: '#a16207' },
  royalblue:   { main: '#2563eb', dark: '#1d4ed8', shadow: '#1e40af' },
}

// 瞳孔相对于眼睛中心的最大偏移量
const MAX_PUPIL_OFFSET = 3.2
// 左右眼中心坐标
const LEFT_EYE = { cx: 79, cy: 100 }
const RIGHT_EYE = { cx: 121, cy: 100 }

export default function InteractiveRabbit({
  scarfColor = 'purple',
  className = '',
  closeEyes = false,
}: InteractiveRabbitProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })

  const colors = SCARF_COLORS[scarfColor] || SCARF_COLORS.purple

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // 归一化鼠标位置到 [-1, 1]
    const dx = (e.clientX - centerX) / (rect.width / 2)
    const dy = (e.clientY - centerY) / (rect.height / 2)

    const clampedX = Math.max(-1, Math.min(1, dx))
    const clampedY = Math.max(-1, Math.min(1, dy))

    setPupilOffset({
      x: clampedX * MAX_PUPIL_OFFSET,
      y: clampedY * MAX_PUPIL_OFFSET,
    })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  return (
    <div ref={containerRef} className={className}>
      <svg
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* 耳朵摆动动画 */}
          <style>{`
            @keyframes ear-left-wobble {
              0%, 100% { transform: rotate(-14deg); }
              50%      { transform: rotate(-8deg); }
            }
            @keyframes ear-right-wobble {
              0%, 100% { transform: rotate(14deg); }
              50%      { transform: rotate(8deg); }
            }
            @keyframes ear-left-wobble-delayed {
              0%, 100% { transform: rotate(-14deg); }
              50%      { transform: rotate(-8deg); }
            }
            @keyframes ear-right-wobble-delayed {
              0%, 100% { transform: rotate(14deg); }
              50%      { transform: rotate(8deg); }
            }
            @keyframes head-float {
              0%, 100% { transform: translateY(0); }
              50%      { transform: translateY(-2px); }
            }
            .ear-left-group {
              transform-origin: 65px 103px;
              animation: ear-left-wobble 3.2s ease-in-out infinite;
              will-change: transform;
            }
            .ear-right-group {
              transform-origin: 135px 103px;
              animation: ear-right-wobble 3.2s ease-in-out infinite;
              animation-delay: 0.8s;
              will-change: transform;
            }
            .head-group {
              animation: head-float 4s ease-in-out infinite;
              will-change: transform;
            }
            .eye-pupil {
              transition: cx 0.12s ease-out, cy 0.12s ease-out;
            }
          `}</style>

          {/* 阴影滤镜 */}
          <filter id="rabbit-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* ===== 耳朵（头部后面） ===== */}

        {/* 左耳 */}
        <g className="ear-left-group">
          {/* 外耳 */}
          <ellipse cx="61" cy="55" rx="17" ry="52" fill="white" stroke="#e5e7eb" strokeWidth="1.2" />
          {/* 内耳 */}
          <ellipse cx="61" cy="55" rx="8" ry="38" fill="#fce7f3" />
        </g>

        {/* 右耳 */}
        <g className="ear-right-group">
          {/* 外耳 */}
          <ellipse cx="139" cy="55" rx="17" ry="52" fill="white" stroke="#e5e7eb" strokeWidth="1.2" />
          {/* 内耳 */}
          <ellipse cx="139" cy="55" rx="8" ry="38" fill="#fce7f3" />
        </g>

        {/* ===== 头部 ===== */}
        <g className="head-group">
          {/* 头主体 */}
          <ellipse cx="100" cy="112" rx="58" ry="52" fill="white" stroke="#e5e7eb" strokeWidth="1.2" filter="url(#rabbit-shadow)" />

          {/* ===== 腮红 ===== */}
          <ellipse cx="68" cy="114" rx="10" ry="6" fill="#fce7f3" opacity="0.55" />
          <ellipse cx="132" cy="114" rx="10" ry="6" fill="#fce7f3" opacity="0.55" />

          {/* ===== 眼睛 ===== */}
          {closeEyes ? (
            <>
              {/* 左眼 - 闭眼微笑弧线 */}
              <path
                d="M 71,100 Q 79,107 87,100"
                fill="none"
                stroke="#374151"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              {/* 右眼 - 闭眼微笑弧线 */}
              <path
                d="M 113,100 Q 121,107 129,100"
                fill="none"
                stroke="#374151"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              {/* 闭眼时的小睫毛 */}
              <line x1="70" y1="97" x2="72" y2="100" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="128" y1="97" x2="130" y2="100" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              {/* 左眼 */}
              <ellipse cx={LEFT_EYE.cx} cy={LEFT_EYE.cy} rx="9" ry="10" fill="white" stroke="#374151" strokeWidth="1.5" />
              <circle
                className="eye-pupil"
                cx={LEFT_EYE.cx + pupilOffset.x}
                cy={LEFT_EYE.cy + pupilOffset.y}
                r="4.5"
                fill="#1f2937"
              />
              {/* 眼睛高光 */}
              <circle
                className="eye-pupil"
                cx={LEFT_EYE.cx + pupilOffset.x - 1.5}
                cy={LEFT_EYE.cy + pupilOffset.y - 2}
                r="1.5"
                fill="white"
              />

              {/* 右眼 */}
              <ellipse cx={RIGHT_EYE.cx} cy={RIGHT_EYE.cy} rx="9" ry="10" fill="white" stroke="#374151" strokeWidth="1.5" />
              <circle
                className="eye-pupil"
                cx={RIGHT_EYE.cx + pupilOffset.x}
                cy={RIGHT_EYE.cy + pupilOffset.y}
                r="4.5"
                fill="#1f2937"
              />
              {/* 眼睛高光 */}
              <circle
                className="eye-pupil"
                cx={RIGHT_EYE.cx + pupilOffset.x - 1.5}
                cy={RIGHT_EYE.cy + pupilOffset.y - 2}
                r="1.5"
                fill="white"
              />
            </>
          )}

          {/* ===== 鼻子 ===== */}
          <ellipse cx="100" cy="114" rx="4.5" ry="3.5" fill="#f9a8d4" />

          {/* ===== 嘴巴 ===== */}
          <path
            d="M 95,120 Q 100,126 105,120"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          {/* 人中线 */}
          <line x1="100" y1="117.5" x2="100" y2="119" stroke="#9ca3af" strokeWidth="0.8" strokeLinecap="round" />

          {/* ===== 围巾 — 绕脖主体 ===== */}
          <path
            d="M 42,122
               C 42,135 55,148 100,152
               C 145,148 158,135 158,122
               L 158,112
               C 158,126 145,140 100,144
               C 55,140 42,126 42,112 Z"
            fill={colors.main}
          />

          {/* 围巾纹理线 */}
          <path
            d="M 48,126 C 70,138 130,138 152,126"
            fill="none"
            stroke={colors.dark}
            strokeWidth="0.6"
            opacity="0.4"
          />
          <path
            d="M 46,132 C 70,143 130,143 154,132"
            fill="none"
            stroke={colors.dark}
            strokeWidth="0.6"
            opacity="0.4"
          />

          {/* 围巾结 */}
          <ellipse cx="55" cy="140" rx="14" ry="11" fill={colors.dark} />
          <ellipse cx="55" cy="140" rx="8" ry="6" fill={colors.shadow} opacity="0.5" />

          {/* 围巾下垂尾巴 */}
          <path
            d="M 43,138
               C 36,160 40,178 45,192
               C 47,198 44,202 38,198
               C 32,194 35,185 35,175
               C 35,165 38,152 44,138 Z"
            fill={colors.main}
          />
          {/* 尾巴高光 */}
          <path
            d="M 43,145 C 38,165 40,178 44,188"
            fill="none"
            stroke={colors.shadow}
            strokeWidth="0.8"
            opacity="0.25"
          />
          {/* 尾巴底部条纹 */}
          <line x1="38" y1="195" x2="44" y2="195" stroke={colors.shadow} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        </g>
      </svg>
    </div>
  )
}
