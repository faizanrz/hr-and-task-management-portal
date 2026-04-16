'use client'

import { useState } from 'react'
import { EmployeeProvider } from '@/lib/employee-context'
import Sidebar from '@/components/layout/Sidebar'
import TopNav from '@/components/layout/TopNav'

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <EmployeeProvider>
      <div className="min-h-screen flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 overflow-auto">
          <TopNav onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
          <div className="px-3 py-4 sm:p-4 md:p-6">{children}</div>
        </main>
      </div>
    </EmployeeProvider>
  )
}
