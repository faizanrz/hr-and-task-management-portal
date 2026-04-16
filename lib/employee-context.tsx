'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Employee } from '@/types'

interface EmployeeContextType {
  employee: Employee | null
  loading: boolean
  isAdmin: boolean
  isManager: boolean
  isTeamLead: boolean
  isStaff: boolean
  canManageTeam: boolean    // admin, manager, team_lead
  canManageLeave: boolean   // admin, manager, team_lead
  canEditEmployees: boolean // admin, manager
  canViewAllEmployees: boolean // admin, manager
}

const EmployeeContext = createContext<EmployeeContextType>({
  employee: null,
  loading: true,
  isAdmin: false,
  isManager: false,
  isTeamLead: false,
  isStaff: false,
  canManageTeam: false,
  canManageLeave: false,
  canEditEmployees: false,
  canViewAllEmployees: false,
})

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEmployee() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from('employees')
          .select('*')
          .eq('email', user.email)
          .single()

        if (data) setEmployee(data as Employee)
      }
      setLoading(false)
    }

    fetchEmployee()
  }, [])

  const role = employee?.role
  const isAdmin = role === 'admin'
  const isManager = role === 'manager'
  const isTeamLead = role === 'team_lead'
  const isStaff = role === 'staff'

  return (
    <EmployeeContext.Provider
      value={{
        employee,
        loading,
        isAdmin,
        isManager,
        isTeamLead,
        isStaff,
        canManageTeam: isAdmin || isManager || isTeamLead,
        canManageLeave: isAdmin || isManager || isTeamLead,
        canEditEmployees: isAdmin || isManager,
        canViewAllEmployees: isAdmin || isManager,
      }}
    >
      {children}
    </EmployeeContext.Provider>
  )
}

export function useEmployee() {
  return useContext(EmployeeContext)
}
