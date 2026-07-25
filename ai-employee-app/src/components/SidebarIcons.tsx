import type { ComponentType } from 'react'

const IconWrapper = ({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {children}
  </svg>
)

export const IconSearch: ComponentType<{ className?: string }> = ({ className }) => (
  <IconWrapper className={className}>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" fill="none" />
    <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </IconWrapper>
)

export const IconPlusSquare: ComponentType<{ className?: string }> = ({
  className
}) => (
  <IconWrapper className={className}>
    <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
    <path d="M12 8v8M8 12h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
  </IconWrapper>
)

export const IconClock: ComponentType<{ className?: string }> = ({ className }) => (
  <IconWrapper className={className}>
    <circle cx="12" cy="12" r="9" fill="currentColor" />
    <path d="M12 7v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </IconWrapper>
)

export const IconMessage: ComponentType<{ className?: string }> = ({ className }) => (
  <IconWrapper className={className}>
    <path
      d="M19 3a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7.5a2 2 0 0 0-1.5.68V21l-3-3V6a3 3 0 0 1 3-3H19z"
      fill="currentColor"
    />
    <path d="M7 9h10M7 13h7" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </IconWrapper>
)

export const IconBot: ComponentType<{ className?: string }> = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="5" y="9" width="14" height="10" rx="3" fill="currentColor" />
    <circle cx="12" cy="7" r="4" fill="currentColor" />
    <circle cx="9.5" cy="13.5" r="1.5" fill="white" />
    <circle cx="14.5" cy="13.5" r="1.5" fill="white" />
    <path d="M10.5 16.5h3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M6 6l-1-2M18 6l1-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </IconWrapper>
)

export const IconGrid: ComponentType<{ className?: string }> = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" />
    <path d="M10 3v18M3 12h18" stroke="white" strokeWidth="1.5" />
  </IconWrapper>
)

export const IconFile: ComponentType<{ className?: string }> = ({ className }) => (
  <IconWrapper className={className}>
    <path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
      fill="currentColor"
    />
    <path d="M14 2v6h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 14h8M8 18h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </IconWrapper>
)

export const IconImage: ComponentType<{ className?: string }> = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" />
    <circle cx="8.5" cy="9.5" r="2" fill="white" />
    <path d="M3 16l4.5-4.5 3.5 3.5L15 11l6 5v1H3z" fill="white" />
  </IconWrapper>
)

export const IconChart: ComponentType<{ className?: string }> = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="5" y="10" width="4" height="10" rx="1" fill="currentColor" />
    <rect x="10" y="6" width="4" height="14" rx="1" fill="currentColor" />
    <rect x="15" y="13" width="4" height="7" rx="1" fill="currentColor" />
    <path d="M5 10h4v3H5zM10 6h4v3h-4zM15 13h4v3h-4z" fill="white" />
  </IconWrapper>
)

export const IconUsers: ComponentType<{ className?: string }> = ({ className }) => (
  <IconWrapper className={className}>
    <circle cx="9" cy="7" r="3" fill="currentColor" />
    <circle cx="16" cy="8" r="2.5" fill="currentColor" />
    <circle cx="18" cy="17" r="2.5" fill="currentColor" />
    <path d="M3 18c0-2.5 3-4.5 6-4.5s6 2 6 4.5V20H3v-2z" fill="currentColor" />
    <path d="M13 18c0-2 2.5-3.5 5-3.5s5 1.5 5 3.5V20H13v-2z" fill="currentColor" />
    <path d="M12 14a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="white" />
    <path d="M16.5 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" fill="white" />
  </IconWrapper>
)

export const IconCoins: ComponentType<{ className?: string }> = ({ className }) => (
  <IconWrapper className={className}>
    <ellipse cx="12" cy="6" rx="7" ry="3" fill="currentColor" />
    <ellipse cx="12" cy="12" rx="7" ry="3" fill="currentColor" />
    <ellipse cx="12" cy="18" rx="7" ry="3" fill="currentColor" />
    <path d="M5 6v12M19 6v12" stroke="white" strokeWidth="1.5" />
    <path d="M12 9v12" stroke="white" strokeWidth="1.5" />
  </IconWrapper>
)

export const IconSettings: ComponentType<{ className?: string }> = ({ className }) => (
  <IconWrapper className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8.36-3.55a1.5 1.5 0 0 1 .2 2.3l-1.5 1.5a1.5 1.5 0 0 1-1.82.23l-.26-.13a6 6 0 0 1-1.6.93l-.1.34a1.5 1.5 0 0 1-1.5 1.08h-2.12a1.5 1.5 0 0 1-1.5-1.08l-.1-.34a6 6 0 0 1-1.6-.93l-.26.13a1.5 1.5 0 0 1-1.82-.23l-1.5-1.5a1.5 1.5 0 0 1 .2-2.3l.2-.17a6 6 0 0 1 0-1.86l-.2-.17a1.5 1.5 0 0 1-.2-2.3l1.5-1.5a1.5 1.5 0 0 1 1.82-.23l.26.13a6 6 0 0 1 1.6-.93l.1-.34A1.5 1.5 0 0 1 11.38 2h2.12a1.5 1.5 0 0 1 1.5 1.08l.1.34a6 6 0 0 1 1.6.93l.26-.13a1.5 1.5 0 0 1 1.82.23l1.5 1.5a1.5 1.5 0 0 1-.2 2.3l-.2.17a6 6 0 0 1 0 1.86l.2.17z"
      fill="currentColor"
    />
    <circle cx="12" cy="12" r="3" fill="white" />
  </IconWrapper>
)
