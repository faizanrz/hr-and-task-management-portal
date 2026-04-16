'use client'

import { useEmployee } from '@/lib/employee-context'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/constants'

interface TopNavProps {
  onMenuToggle: () => void
}

export default function TopNav({ onMenuToggle }: TopNavProps) {
  const { employee } = useEmployee()
  const pathname = usePathname()

  const initials = employee
    ? `${employee.first_name[0]}${employee.last_name[0]}`
    : ''

  // Derive page title from current route
  const currentNav = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )
  const pageTitle = currentNav?.label ?? 'Dashboard'

  return (
    <header className="h-16 bg-surface-card border-b border-surface-border flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="md:hidden text-gray-400 hover:text-gray-200 -ml-1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-100">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-3">
        {employee && (
          <>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-100">
                {employee.first_name} {employee.last_name}
              </p>
              <p className="text-[11px] text-gray-500 capitalize">{employee.role}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-brand-50 text-brand flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
