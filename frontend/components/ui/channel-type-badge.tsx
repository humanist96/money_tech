import { CHANNEL_TYPE_CONFIG, type ChannelType } from '@/lib/types'

interface ChannelTypeBadgeProps {
  type: ChannelType
  showPIS?: boolean
  pis?: number | null
  size?: 'sm' | 'md'
}

export function ChannelTypeBadge({ type, showPIS, pis, size = 'sm' }: ChannelTypeBadgeProps) {
  const config = CHANNEL_TYPE_CONFIG[type] ?? CHANNEL_TYPE_CONFIG.unknown

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-xs'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${config.badge} ${sizeClasses}`}>
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
      {showPIS && pis != null && (
        <span className="opacity-60 ml-0.5">{Math.round(pis)}</span>
      )}
    </span>
  )
}
