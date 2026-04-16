import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-success-50 text-success-600': variant === 'default' || variant === 'success',
          'bg-warning-50 text-warning-600': variant === 'warning',
          'bg-danger-50 text-danger-600': variant === 'danger',
          'bg-surface-hover text-gray-400': variant === 'neutral',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
