'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Button, Badge, Card, CardContent, CardHeader, Select, Modal, AnimatedPage, AnimatedSection, SkeletonPage } from '@/components/ui'
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '@/components/ui'
import { Textarea } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { TOTAL_LEAVE_CAP } from '@/lib/constants'
import type { LeaveRequest, LeaveBalance, Employee } from '@/types'

export default function LeaveRequestsPage() {
  const { employee, isAdmin, isManager, isTeamLead, canManageLeave, loading: ctxLoading } = useEmployee()
  const [requests, setRequests] = useState<(LeaveRequest & { employee?: { first_name: string; last_name: string } })[]>([])
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewModal, setReviewModal] = useState<LeaveRequest | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [teamBalances, setTeamBalances] = useState<(LeaveBalance & { employee?: { first_name: string; last_name: string; department: string } })[]>([])

  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (!employee) return
    loadData()
    if (canManageLeave) loadTeamBalances()
  }, [employee, canManageLeave])

  async function loadData() {
    const supabase = createClient()

    // Get leave balance
    const { data: bal } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employee!.id)
      .eq('year', currentYear)
      .single()
    if (bal) setBalance(bal as LeaveBalance)

    // Get leave requests
    let query = supabase
      .from('leave_requests')
      .select('*, employee:employee_id(first_name, last_name)')
      .order('created_at', { ascending: false })

    if (!canManageLeave) {
      query = query.eq('employee_id', employee!.id)
    } else if (isManager) {
      const { data: allMembers } = await supabase
        .from('employees')
        .select('id')
        .eq('is_active', true)
        .neq('department', 'co-founder')

      const allIds = (allMembers || []).map((member) => member.id)
      if (allIds.length > 0) {
        query = query.in('employee_id', allIds)
      }
    } else if (isTeamLead && employee?.department) {
      const { data: teamMembers } = await supabase
        .from('employees')
        .select('id')
        .eq('is_active', true)
        .eq('department', employee.department)

      const teamIds = (teamMembers || []).map((member) => member.id)
      if (teamIds.length > 0) {
        query = query.in('employee_id', teamIds)
      } else {
        query = query.eq('employee_id', employee!.id)
      }
    }

    const { data } = await query
    if (data) setRequests(data as any)
    setLoading(false)
  }

  async function loadTeamBalances() {
    const supabase = createClient()
    let query = supabase
      .from('leave_balances')
      .select('*, employee:employee_id(first_name, last_name, department)')
      .eq('year', currentYear)

    const { data } = await query
    if (data) {
      // Exclude co-founders
      const filtered = (data as any[]).filter(
        (b: any) => b.employee?.department !== 'co-founder'
      )
      // Team Lead: only show own department. Manager + Admin: all
      if (isTeamLead && !isAdmin && !isManager && employee?.department) {
        setTeamBalances(filtered.filter((b: any) => b.employee?.department === employee.department))
      } else {
        setTeamBalances(filtered)
      }
    }
  }

  async function handleReview(status: 'approved' | 'rejected') {
    if (!reviewModal || !employee) return
    setProcessing(true)
    const supabase = createClient()

    await supabase
      .from('leave_requests')
      .update({
        status,
        reviewed_by: employee.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
      })
      .eq('id', reviewModal.id)

    // If approved, update leave balance
    if (status === 'approved' && reviewModal.leave_type !== 'unpaid') {
      const field = `${reviewModal.leave_type}_used` as string
      const { data: currentBal } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', reviewModal.employee_id)
        .eq('year', currentYear)
        .single()

      if (currentBal) {
        await supabase
          .from('leave_balances')
          .update({ [field]: (currentBal as any)[field] + reviewModal.days_count })
          .eq('id', currentBal.id)
      }
    }

    setReviewModal(null)
    setAdminNotes('')
    setProcessing(false)
    loadData()
  }

  const filtered = requests.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    return true
  })

  const statusBadge = (status: string) => {
    const map: Record<string, 'warning' | 'success' | 'danger'> = {
      pending: 'warning', approved: 'success', rejected: 'danger',
    }
    return <Badge variant={map[status] || 'neutral'}>{status}</Badge>
  }

  if (ctxLoading || loading) return <SkeletonPage />

  return (
    <AnimatedPage className="space-y-6">
      <AnimatedSection>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-100">Leave Requests</h1>
            <p className="text-sm text-gray-500 mt-1">Manage leave requests and balances</p>
          </div>
          <Link href="/attendance/leave/new">
            <Button>Request Leave</Button>
          </Link>
        </div>
      </AnimatedSection>

      {/* My Leave Balance */}
      {balance && (() => {
        const totalUsed = balance.annual_used + balance.sick_used + balance.casual_used
        const totalRemaining = TOTAL_LEAVE_CAP - totalUsed
        const usedPct = Math.min((totalUsed / TOTAL_LEAVE_CAP) * 100, 100)
        return (
          <div className="space-y-4">
            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-100">Overall Leave Balance</p>
                  <p className="text-sm text-gray-400">{totalUsed} / {TOTAL_LEAVE_CAP} days used</p>
                </div>
                <div className="w-full h-3 bg-surface-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${usedPct}%`,
                      backgroundColor: usedPct >= 90 ? '#E63946' : usedPct >= 70 ? '#EF9F27' : '#22C55E',
                    }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{totalRemaining} days remaining</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent>
                  <p className="text-sm text-gray-500">Annual Leave</p>
                  <p className="text-lg font-medium text-gray-100 mt-1">
                    {balance.annual_used} / {balance.annual_total} used
                  </p>
                  <p className="text-xs text-gray-400">{balance.annual_total - balance.annual_used} remaining</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <p className="text-sm text-gray-500">Sick Leave</p>
                  <p className="text-lg font-medium text-gray-100 mt-1">
                    {balance.sick_used} / {balance.sick_total} used
                  </p>
                  <p className="text-xs text-gray-400">{balance.sick_total - balance.sick_used} remaining</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <p className="text-sm text-gray-500">Casual Leave</p>
                  <p className="text-lg font-medium text-gray-100 mt-1">
                    {balance.casual_used} / {balance.casual_total} used
                  </p>
                  <p className="text-xs text-gray-400">{balance.casual_total - balance.casual_used} remaining</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      })()}

      {/* Team Leave Tracker (Admin/Manager) */}
      {canManageLeave && teamBalances.length > 0 && (
        <AnimatedSection>
          <Card>
            <CardHeader>
              <h2 className="text-base font-medium text-gray-100">Team Leave Tracker</h2>
              <p className="text-xs text-gray-500">{TOTAL_LEAVE_CAP} days cap per employee</p>
            </CardHeader>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Used</TableHeader>
                  <TableHeader>Remaining</TableHeader>
                  <TableHeader>Usage</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {teamBalances.map((b) => {
                  const used = b.annual_used + b.sick_used + b.casual_used
                  const remaining = TOTAL_LEAVE_CAP - used
                  const pct = Math.min((used / TOTAL_LEAVE_CAP) * 100, 100)
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-gray-100">
                        {b.employee ? `${b.employee.first_name} ${b.employee.last_name}` : '—'}
                      </TableCell>
                      <TableCell>{used} / {TOTAL_LEAVE_CAP}</TableCell>
                      <TableCell>
                        <Badge variant={remaining <= 2 ? 'danger' : remaining <= 5 ? 'warning' : 'success'}>
                          {remaining} days
                        </Badge>
                      </TableCell>
                      <TableCell className="w-40">
                        <div className="w-full h-2 bg-surface-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 90 ? '#E63946' : pct >= 70 ? '#EF9F27' : '#22C55E',
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </AnimatedSection>
      )}

      {/* Filter */}
      <div className="flex gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </div>

      {/* Requests Table */}
      <AnimatedSection>
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              {canManageLeave && <TableHeader>Employee</TableHeader>}
              <TableHeader>Type</TableHeader>
              <TableHeader>From</TableHeader>
              <TableHeader>To</TableHeader>
              <TableHeader>Days</TableHeader>
              <TableHeader>Status</TableHeader>
              {canManageLeave && <TableHeader>Action</TableHeader>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                {canManageLeave && (
                  <TableCell>
                    {r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : '—'}
                  </TableCell>
                )}
                <TableCell className="capitalize">{r.leave_type}</TableCell>
                <TableCell>{formatDate(r.start_date)}</TableCell>
                <TableCell>{formatDate(r.end_date)}</TableCell>
                <TableCell>{r.days_count}</TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
                {canManageLeave && (
                  <TableCell>
                    {r.status === 'pending' && (
                      <Button size="sm" variant="secondary" onClick={() => setReviewModal(r)}>
                        Review
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell className="text-center text-gray-400 py-8">
                  No leave requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      </AnimatedSection>

      {/* Review Modal */}
      <Modal
        open={!!reviewModal}
        onClose={() => setReviewModal(null)}
        title="Review Leave Request"
      >
        {reviewModal && (
          <div className="space-y-4">
            <div className="text-sm">
              <p><span className="text-gray-500">Employee:</span> {(reviewModal as any).employee?.first_name} {(reviewModal as any).employee?.last_name}</p>
              <p><span className="text-gray-500">Type:</span> <span className="capitalize">{reviewModal.leave_type}</span></p>
              <p><span className="text-gray-500">Period:</span> {formatDate(reviewModal.start_date)} — {formatDate(reviewModal.end_date)} ({reviewModal.days_count} days)</p>
              {reviewModal.reason && <p><span className="text-gray-500">Reason:</span> {reviewModal.reason}</p>}
            </div>
            <Textarea
              label="Admin Notes (optional)"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button onClick={() => handleReview('approved')} disabled={processing}>
                Approve
              </Button>
              <Button variant="danger" onClick={() => handleReview('rejected')} disabled={processing}>
                Reject
              </Button>
              <Button variant="ghost" onClick={() => setReviewModal(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AnimatedPage>
  )
}
