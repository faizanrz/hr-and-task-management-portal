'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Button, Card, CardContent, CardHeader, Input, Select, Textarea } from '@/components/ui'
import { LEAVE_TYPES, TOTAL_LEAVE_CAP } from '@/lib/constants'
import type { LeaveBalance, PublicHoliday } from '@/types'

function calculateBusinessDays(start: string, end: string, holidays: string[]): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  let count = 0

  const current = new Date(startDate)
  while (current <= endDate) {
    const day = current.getDay()
    const dateStr = current.toISOString().split('T')[0]
    // Exclude weekends (Sat=6, Sun=0) and public holidays
    if (day !== 0 && day !== 6 && !holidays.includes(dateStr)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}

export default function NewLeaveRequestPage() {
  const router = useRouter()
  const { employee, loading: ctxLoading } = useEmployee()
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [holidays, setHolidays] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
  })

  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (!employee) return
    const supabase = createClient()

    supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('year', currentYear)
      .single()
      .then(({ data }) => { if (data) setBalance(data as LeaveBalance) })

    supabase
      .from('public_holidays')
      .select('date')
      .eq('year', currentYear)
      .then(({ data }) => {
        if (data) setHolidays(data.map((h: any) => h.date))
      })
  }, [employee, currentYear])

  const daysCount = form.start_date && form.end_date
    ? calculateBusinessDays(form.start_date, form.end_date, holidays)
    : 0

  function getRemaining(): number | null {
    if (!balance) return null
    if (form.leave_type === 'unpaid') return null
    const type = form.leave_type as 'annual' | 'sick' | 'casual'
    const total = balance[`${type}_total` as keyof LeaveBalance] as number
    const used = balance[`${type}_used` as keyof LeaveBalance] as number
    return total - used
  }

  function getCombinedRemaining(): number | null {
    if (!balance) return null
    const totalUsed = balance.annual_used + balance.sick_used + balance.casual_used
    return TOTAL_LEAVE_CAP - totalUsed
  }

  const remaining = getRemaining()
  const combinedRemaining = getCombinedRemaining()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (daysCount <= 0) {
      setError('Please select a valid date range.')
      return
    }
    if (remaining !== null && daysCount > remaining) {
      setError(`Not enough ${form.leave_type} leave balance. You have ${remaining} days remaining.`)
      return
    }
    if (form.leave_type !== 'unpaid' && combinedRemaining !== null && daysCount > combinedRemaining) {
      setError(`Combined leave cap exceeded. You have ${combinedRemaining} of ${TOTAL_LEAVE_CAP} total days remaining across all leave types.`)
      return
    }

    setError('')
    setSaving(true)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('leave_requests').insert({
      employee_id: employee!.id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      days_count: daysCount,
      reason: form.reason || null,
      status: 'pending',
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    router.push('/attendance/leave')
  }

  if (ctxLoading) return <div className="text-sm text-gray-400">Loading...</div>

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-100">Submit Leave Request</h1>
        <p className="text-sm text-gray-500 mt-1">Request time off</p>
      </div>

      {error && (
        <div className="bg-danger-50 text-danger text-sm px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent>
            <div className="space-y-4">
              <Select
                id="leave_type"
                label="Leave Type"
                value={form.leave_type}
                onChange={(e) => setForm((prev) => ({ ...prev, leave_type: e.target.value }))}
                options={LEAVE_TYPES.map((t) => ({
                  value: t,
                  label: t.charAt(0).toUpperCase() + t.slice(1),
                }))}
              />

              {remaining !== null && (
                <p className="text-xs text-gray-500">
                  Remaining {form.leave_type} leave: <span className="font-medium">{remaining} days</span>
                </p>
              )}
              {combinedRemaining !== null && (
                <p className="text-xs text-gray-500">
                  Overall leave balance: <span className="font-medium">{combinedRemaining} of {TOTAL_LEAVE_CAP} days</span> remaining
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="start_date"
                  label="Start Date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  required
                />
                <Input
                  id="end_date"
                  label="End Date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  min={form.start_date}
                  required
                />
              </div>

              {daysCount > 0 && (
                <p className="text-sm text-gray-400">
                  Working days: <span className="font-medium">{daysCount}</span>
                  <span className="text-xs text-gray-400 ml-1">(excludes weekends &amp; public holidays)</span>
                </p>
              )}

              <Textarea
                id="reason"
                label="Reason"
                value={form.reason}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason for leave request..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={saving}>
            {saving ? 'Submitting...' : 'Submit Request'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
