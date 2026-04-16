'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const items = [
  { label: 'Boards', href: '/tasks' },
  { label: 'Reports & Admin', href: '/tasks/reports' },
]

export default function TaskSectionNav() {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const isActive =
          item.href === '/tasks'
            ? pathname === '/tasks'
            : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand text-white shadow-sm'
                : 'bg-surface-card text-gray-400 border border-surface-border hover:bg-surface-hover'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
