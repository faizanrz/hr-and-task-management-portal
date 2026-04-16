'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Button, Badge, Card, Input, Select, AnimatedPage, AnimatedSection, SkeletonPage } from '@/components/ui'
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '@/components/ui'
import { DEPARTMENTS } from '@/lib/constants'
import type { Employee, ProfileEditRequest } from '@/types'

export default function PeoplePage() {
  const router = useRouter()
  const { employee: currentUser, isAdmin, isStaff, canViewAllEmployees, canEditEmployees, loading: ctxLoading } = useEmployee()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [profileRequests, setProfileRequests] = useState<(ProfileEditRequest & { employee?: { first_name: string; last_name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')

  // Staff should be redirected to their own profile
  useEffect(() => {
    if (!ctxLoading && isStaff && currentUser) {
      router.replace(`/people/${currentUser.id}`)
    }
  }, [ctxLoading, isStaff, currentUser, router])

  useEffect(() => {
    if (!currentUser || isStaff) return
    async function fetch() {
      const supabase = createClient()
      let query = supabase.from('employees').select('*').order('first_name')

      if (statusFilter === 'active') query = query.eq('is_active', true)
      else if (statusFilter === 'inactive') query = query.eq('is_active', false)

      if (deptFilter) query = query.eq('department', deptFilter)

      const { data } = await query
      if (data) setEmployees(data as Employee[])

      // Admin and manager can see pending profile edit requests
      if (canEditEmployees) {
        const { data: requests } = await supabase
          .from('profile_edit_requests')
          .select('*, employee:employee_id(first_name, last_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5)

        if (requests) setProfileRequests(requests as any)
      }

      setLoading(false)
    }
    fetch()
  }, [currentUser, isStaff, deptFilter, canEditEmployees, statusFilter])

  const filtered = employees.filter((e) => {
    const term = search.toLowerCase()
    return (
      e.first_name.toLowerCase().includes(term) ||
      e.last_name.toLowerCase().includes(term) ||
      e.email.toLowerCase().includes(term) ||
      (e.job_title && e.job_title.toLowerCase().includes(term))
    )
  })

  if (ctxLoading || loading || isStaff) {
    return <SkeletonPage />
  }

  return (
    <AnimatedPage className="space-y-6">
      <AnimatedSection>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-100">People</h1>
            <p className="text-sm text-gray-500 mt-1">{filtered.length} employees</p>
          </div>
          {isAdmin && (
            <Button onClick={() => router.push('/people/new')}>Add Employee</Button>
          )}
        </div>
      </AnimatedSection>

      <AnimatedSection>
      <div className="flex flex-wrap gap-3">
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search by name, email, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          options={[
            { value: '', label: 'All Departments' },
            ...DEPARTMENTS.map((d) => ({ value: d, label: d.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) })),
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      </AnimatedSection>

      {canEditEmployees && profileRequests.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b border-surface-border">
            <h2 className="text-sm font-medium text-gray-100">Pending Profile Edit Requests</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {profileRequests.map((request) => (
              <button
                key={request.id}
                type="button"
                className="w-full px-4 py-3 text-left hover:bg-surface-hover transition-colors"
                onClick={() => router.push(`/people/${request.employee_id}`)}
              >
                <p className="text-sm font-medium text-gray-100">
                  {request.employee ? `${request.employee.first_name} ${request.employee.last_name}` : 'Employee'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Requested {new Date(request.created_at).toLocaleDateString('en-PK')}
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}

      <AnimatedSection>
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Email</TableHeader>
              <TableHeader>Department</TableHeader>
              <TableHeader>Role</TableHeader>
              <TableHeader>Status</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((emp) => (
              <TableRow
                key={emp.id}
                className="cursor-pointer"
                onClick={() => router.push(`/people/${emp.id}`)}
              >
                <TableCell>
                  <div>
                    <p className="font-medium text-gray-100">
                      {emp.first_name} {emp.last_name}
                    </p>
                    {emp.job_title && (
                      <p className="text-xs text-gray-500">{emp.job_title}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>
                  {emp.department ? (
                    <span className="capitalize">{emp.department.replace('_', ' ')}</span>
                  ) : (
                    <span className="text-gray-400">&mdash;</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={emp.role === 'admin' ? 'default' : emp.role === 'manager' ? 'warning' : emp.role === 'team_lead' ? 'warning' : 'neutral'}>
                    {emp.role === 'team_lead' ? 'Team Lead' : emp.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={emp.is_active ? 'success' : 'danger'}>
                    {emp.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell className="text-center text-gray-400 py-8">
                  No employees found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      </AnimatedSection>
    </AnimatedPage>
  )
}
