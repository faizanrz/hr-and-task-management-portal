'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Button, Badge, Card, CardContent, CardHeader, Select, Input, AnimatedPage, AnimatedSection, SkeletonPage } from '@/components/ui'
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '@/components/ui'
import { formatDate, formatTime } from '@/lib/utils'
import { LATE_THRESHOLD_HOUR, LATE_THRESHOLD_MINUTE, REQUIRED_SHIFT_HOURS } from '@/lib/constants'
import type { Attendance, Employee } from '@/types'

export default function AttendancePage() {
  const { employee, isAdmin, isManager, isTeamLead, canManageTeam, loading: ctxLoading } = useEmployee()
  const [records, setRecords] = useState<(Attendance & { employee?: { first_name: string; last_name: string } })[]>([])
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [checking, setChecking] = useState(false)
  const isCoFounder = employee?.department === 'co-founder'
  const canViewTeamAttendance = canManageTeam

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!employee) return
    loadData()
    if (canViewTeamAttendance) {
      const supabase = createClient()
      let query = supabase.from('employees').select('*').eq('is_active', true).neq('department', 'co-founder').order('first_name')
      if (isTeamLead && !isAdmin && !isManager && employee.department) {
        query = query.eq('department', employee.department)
      }
      query
        .then(({ data }) => { if (data) setEmployees(data as Employee[]) })
    }
  }, [canViewTeamAttendance, employee, isAdmin, isManager, isTeamLead])

  async function loadData(empFilter?: string, dateFilter?: string) {
    const supabase = createClient()

    // Get today's record for current user (skip for co-founders)
    if (!isCoFounder) {
      const { data: myToday } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee!.id)
        .eq('date', today)
        .single()
      if (myToday) setTodayRecord(myToday as Attendance)
    }

    // Get attendance records
    const hasFilter = empFilter || dateFilter
    let query = supabase
      .from('attendance')
      .select('*, employee:employee_id(first_name, last_name)')
      .order('date', { ascending: false })
      .order('check_in', { ascending: false })
      .limit(hasFilter ? 1000 : 500)

    // Apply employee filter at query level
    if (empFilter) {
      query = query.eq('employee_id', empFilter)
    } else if (!canViewTeamAttendance) {
      query = query.eq('employee_id', employee!.id)
    } else {
      // Admin, manager, team_lead: fetch non-co-founder employee IDs
      let memberQuery = supabase.from('employees').select('id').eq('is_active', true).neq('department', 'co-founder')
      if (isTeamLead && !isAdmin && !isManager && employee?.department) {
        memberQuery = memberQuery.eq('department', employee.department)
      }
      const { data: members } = await memberQuery
      const memberIds = (members || []).map((m) => m.id)
      if (memberIds.length > 0) {
        query = query.in('employee_id', memberIds)
      }
    }

    if (dateFilter) {
      query = query.eq('date', dateFilter)
    }

    const { data } = await query
    if (data) setRecords(data as any)
    setLoading(false)
  }

  async function handleCheckIn() {
    setChecking(true)
    const supabase = createClient()
    const now = new Date()
    const hours = now.getUTCHours() + 5 // PKT = UTC+5
    const minutes = now.getUTCMinutes()
    const timeStr = `${String(hours % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
    const status = (hours > LATE_THRESHOLD_HOUR || (hours === LATE_THRESHOLD_HOUR && minutes >= LATE_THRESHOLD_MINUTE)) ? 'late' : 'present'

    const { data, error } = await supabase
      .from('attendance')
      .insert({
        employee_id: employee!.id,
        date: today,
        check_in: timeStr,
        status,
      })
      .select()
      .single()

    if (data) {
      setTodayRecord(data as Attendance)
      loadData(filterEmployee || undefined, filterDate || undefined)
    }
    setChecking(false)
  }

  async function handleCheckOut() {
    if (!todayRecord) return
    setChecking(true)
    const supabase = createClient()
    const now = new Date()
    const hours = now.getUTCHours() + 5
    const minutes = now.getUTCMinutes()
    const timeStr = `${String(hours % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`

    const { data } = await supabase
      .from('attendance')
      .update({ check_out: timeStr })
      .eq('id', todayRecord.id)
      .select()
      .single()

    if (data) {
      setTodayRecord(data as Attendance)
      loadData(filterEmployee || undefined, filterDate || undefined)
    }
    setChecking(false)
  }

  // Re-query when filters change
  useEffect(() => {
    if (!employee) return
    loadData(filterEmployee || undefined, filterDate || undefined)
  }, [filterEmployee, filterDate])

  const filteredRecords = records

  const statusBadge = (status: string) => {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'default'> = {
      present: 'success', late: 'warning', absent: 'danger', half_day: 'neutral', on_leave: 'default',
    }
    return <Badge variant={map[status] || 'neutral'}>{status.replace('_', ' ')}</Badge>
  }

  function getShiftInfo(checkIn: string | null, checkOut: string | null) {
    if (!checkIn || !checkOut) return null
    const [inH, inM] = checkIn.split(':').map(Number)
    const [outH, outM] = checkOut.split(':').map(Number)
    const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM)
    if (totalMinutes <= 0) return null
    const hours = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    const label = `${hours}h ${mins}m`
    const completed = totalMinutes >= REQUIRED_SHIFT_HOURS * 60
    const earlyBy = completed ? 0 : (REQUIRED_SHIFT_HOURS * 60) - totalMinutes
    return { label, completed, earlyBy, totalMinutes }
  }

  if (ctxLoading || loading) return <SkeletonPage />

  return (
    <AnimatedPage className="space-y-6">
      <AnimatedSection>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-100">Attendance</h1>
            <p className="text-sm text-gray-500 mt-1">Daily check-in and attendance log</p>
          </div>
          <Link href="/attendance/leave">
            <Button variant="secondary">Leave Requests</Button>
          </Link>
        </div>
      </AnimatedSection>

      {/* Check In/Out Card — hidden for co-founders */}
      {!isCoFounder && (
      <AnimatedSection>
      <Card>
        <CardHeader>
          <h2 className="text-base font-medium text-gray-100">Today &mdash; {formatDate(today)}</h2>
        </CardHeader>
        <CardContent>
          {todayRecord ? (
            <div className="flex items-center gap-4">
              {statusBadge(todayRecord.status)}
              <span className="text-sm text-gray-400">
                In: {todayRecord.check_in ? formatTime(todayRecord.check_in) : '—'}
              </span>
              {todayRecord.check_out ? (
                <span className="text-sm text-gray-400">
                  Out: {formatTime(todayRecord.check_out)}
                </span>
              ) : (
                <Button size="sm" variant="secondary" onClick={handleCheckOut} disabled={checking}>
                  {checking ? 'Checking out...' : 'Check Out'}
                </Button>
              )}
            </div>
          ) : (
            <Button onClick={handleCheckIn} disabled={checking}>
              {checking ? 'Checking in...' : 'Check In'}
            </Button>
          )}
        </CardContent>
      </Card>
      </AnimatedSection>
      )}

      {/* Filters */}
      {canViewTeamAttendance && (
        <div className="flex flex-wrap gap-3">
          <Select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            options={[
              { value: '', label: 'All Employees' },
              ...employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
            ]}
          />
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          {(filterEmployee || filterDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterEmployee(''); setFilterDate('') }}>
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Records Table */}
      <AnimatedSection>
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              {canViewTeamAttendance && <TableHeader>Employee</TableHeader>}
              <TableHeader>Date</TableHeader>
              <TableHeader>Check In</TableHeader>
              <TableHeader>Check Out</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Shift</TableHeader>
              <TableHeader>Notes</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRecords.map((r) => (
              <TableRow key={r.id}>
                {canViewTeamAttendance && (
                  <TableCell>
                    {r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : '—'}
                  </TableCell>
                )}
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell>{r.check_in ? formatTime(r.check_in) : '—'}</TableCell>
                <TableCell>{r.check_out ? formatTime(r.check_out) : '—'}</TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell>
                  {(() => {
                    const shift = getShiftInfo(r.check_in, r.check_out)
                    if (!shift) return <span className="text-gray-500">—</span>
                    if (shift.completed) {
                      return <Badge variant="success">{shift.label}</Badge>
                    }
                    const earlyH = Math.floor(shift.earlyBy / 60)
                    const earlyM = shift.earlyBy % 60
                    return (
                      <span className="text-xs">
                        <Badge variant="danger">{shift.label}</Badge>
                        <span className="text-gray-500 ml-1">({earlyH > 0 ? `${earlyH}h ` : ''}{earlyM}m early)</span>
                      </span>
                    )
                  })()}
                </TableCell>
                <TableCell>{r.notes || '—'}</TableCell>
              </TableRow>
            ))}
            {filteredRecords.length === 0 && (
              <TableRow>
                <TableCell className="text-center text-gray-400 py-8">
                  No attendance records found.
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
