'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import Link from 'next/link'
import { Card, CardContent, CardHeader, Badge, AnimatedPage, AnimatedSection, AnimatedGrid, AnimatedGridItem, CountUp, SkeletonPage, HoverCard, PulseBadge } from '@/components/ui'
import dynamic from 'next/dynamic'
const DarkPieChart = dynamic(() => import('@/components/ui/Charts').then(m => ({ default: m.DarkPieChart })), { ssr: false, loading: () => <div className="h-[260px] animate-pulse bg-surface-mid rounded" /> })
const DarkBarChart = dynamic(() => import('@/components/ui/Charts').then(m => ({ default: m.DarkBarChart })), { ssr: false, loading: () => <div className="h-[260px] animate-pulse bg-surface-mid rounded" /> })
import { formatDate } from '@/lib/utils'
import { TOTAL_LEAVE_CAP } from '@/lib/constants'
import type { Announcement, LeaveRequest, Attendance, LeaveBalance } from '@/types'

type DashboardTask = {
  id: string
  title: string
  board_id: string
  column_id: string
  assignee_id: string | null
  owner_id: string | null
  due_date: string | null
  completed_at: string | null
  is_archived: boolean
  board?: { id: string; name: string } | null
  column?: { id: string; name: string } | null
}

export default function DashboardPage() {
  const { employee, isAdmin, isManager, isTeamLead, canManageTeam, loading } = useEmployee()
  const [announcements, setAnnouncements] = useState<(Announcement & { poster?: { first_name: string; last_name: string } })[]>([])
  const [pendingLeaves, setPendingLeaves] = useState<(LeaveRequest & { employee?: { first_name: string; last_name: string } })[]>([])
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null)
  const [stats, setStats] = useState({ totalEmployees: 0, presentToday: 0, pendingLeaveCount: 0 })
  const [weeklyAttendance, setWeeklyAttendance] = useState<{ day: string; present: number; absent: number; late: number }[]>([])
  const [leaveByType, setLeaveByType] = useState<{ name: string; value: number }[]>([])
  const [myTasks, setMyTasks] = useState<DashboardTask[]>([])
  const [teamTasks, setTeamTasks] = useState<DashboardTask[]>([])
  const [allTasks, setAllTasks] = useState<DashboardTask[]>([])
  const [myLeaveBalance, setMyLeaveBalance] = useState<LeaveBalance | null>(null)
  const [teamLeaveBalances, setTeamLeaveBalances] = useState<(LeaveBalance & { employee?: { first_name: string; last_name: string; department: string } })[]>([])

  useEffect(() => {
    if (!employee) return
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    // Fetch announcements
    supabase
      .from('announcements')
      .select('*, poster:posted_by(first_name, last_name)')
      .or(`expires_at.is.null,expires_at.gte.${today}`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setAnnouncements(data as any)
      })

    // Fetch my today attendance
    supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('date', today)
      .single()
      .then(({ data }) => {
        if (data) setTodayAttendance(data as Attendance)
      })

    // Fetch my leave balance (exclude co-founders)
    if (employee.department !== 'co-founder') {
      const currentYear = new Date().getFullYear()
      supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('year', currentYear)
        .single()
        .then(({ data }) => {
          if (data) setMyLeaveBalance(data as LeaveBalance)
        })
    }

    // Fetch my tasks (assigned or owned, not archived)
    supabase
      .from('tasks')
      .select('id, title, board_id, column_id, assignee_id, owner_id, due_date, completed_at, is_archived, board:board_id(id, name), column:column_id(id, name)')
      .eq('is_archived', false)
      .or(`assignee_id.eq.${employee.id},owner_id.eq.${employee.id}`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (data) setMyTasks(data as unknown as DashboardTask[])
      })

    // Admin: fetch all tasks for overview
    if (isAdmin) {
      supabase
        .from('tasks')
        .select('id, title, board_id, column_id, assignee_id, owner_id, due_date, completed_at, is_archived, board:board_id(id, name), column:column_id(id, name)')
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })
        .then(({ data }) => {
          if (data) setAllTasks(data as unknown as DashboardTask[])
        })
    }

    // Manager: fetch all team tasks (except co-founder). Team Lead: department-scoped.
    if (isManager || isTeamLead) {
      ;(async () => {
        let memberQuery = supabase.from('employees').select('id').eq('is_active', true).neq('department', 'co-founder')
        if (isTeamLead && !isManager && employee.department) {
          memberQuery = memberQuery.eq('department', employee.department)
        }
        const { data: teamMembers } = await memberQuery
        const teamIds = (teamMembers || []).map((m) => m.id)
        if (teamIds.length > 0) {
          supabase
            .from('tasks')
            .select('id, title, board_id, column_id, assignee_id, owner_id, due_date, completed_at, is_archived, board:board_id(id, name), column:column_id(id, name)')
            .eq('is_archived', false)
            .or(teamIds.map(id => `assignee_id.eq.${id}`).join(','))
            .order('updated_at', { ascending: false })
            .then(({ data }) => {
              if (data) setTeamTasks(data as unknown as DashboardTask[])
            })
        }
      })()
    }

    if (canManageTeam) {
      const isTeamScoped = isTeamLead && !isManager && employee.department

      const fetchTeamIds = async () => {
        if (isManager) {
          // Manager sees all except co-founder
          const { data } = await supabase
            .from('employees')
            .select('id')
            .eq('is_active', true)
            .neq('department', 'co-founder')
          return (data || []).map((member) => member.id)
        }
        if (!isTeamScoped) return null
        const { data } = await supabase
          .from('employees')
          .select('id')
          .eq('is_active', true)
          .eq('department', employee.department)
        return (data || []).map((member) => member.id)
      }

      fetchTeamIds().then((teamIds) => {
        let leaveQuery = supabase
          .from('leave_requests')
          .select('*, employee:employee_id(first_name, last_name)', { count: 'exact' })
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5)

        let employeeQuery = supabase
          .from('employees')
          .select('id', { count: 'exact' })
          .eq('is_active', true)

        let attendanceQuery = supabase
          .from('attendance')
          .select('id', { count: 'exact' })
          .eq('date', today)
          .in('status', ['present', 'late'])

        if (teamIds && teamIds.length > 0) {
          leaveQuery = leaveQuery.in('employee_id', teamIds)
          employeeQuery = employeeQuery.eq('department', employee.department)
          attendanceQuery = attendanceQuery.in('employee_id', teamIds)
        }

        leaveQuery.then(({ data, count }) => {
          if (data) setPendingLeaves(data as any)
          setStats(prev => ({ ...prev, pendingLeaveCount: count || 0 }))
        })

        employeeQuery.then(({ count }) => {
          setStats(prev => ({ ...prev, totalEmployees: count || 0 }))
        })

        attendanceQuery.then(({ count }) => {
          setStats(prev => ({ ...prev, presentToday: count || 0 }))
        })

        // Weekly attendance breakdown (last 7 days)
        const weekDays: { day: string; date: string }[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          weekDays.push({
            day: d.toLocaleDateString('en-PK', { weekday: 'short' }),
            date: d.toISOString().split('T')[0],
          })
        }

        const weekStart = weekDays[0].date
        let weekAttQuery = supabase
          .from('attendance')
          .select('date, status')
          .gte('date', weekStart)
          .lte('date', today)

        if (teamIds && teamIds.length > 0) {
          weekAttQuery = weekAttQuery.in('employee_id', teamIds)
        }

        weekAttQuery.then(({ data: attData }) => {
          const grouped = new Map<string, { present: number; absent: number; late: number }>()
          weekDays.forEach((wd) => grouped.set(wd.date, { present: 0, absent: 0, late: 0 }))
          ;(attData || []).forEach((row: { date: string; status: string }) => {
            const entry = grouped.get(row.date)
            if (!entry) return
            if (row.status === 'present') entry.present++
            else if (row.status === 'late') entry.late++
            else entry.absent++
          })
          setWeeklyAttendance(
            weekDays.map((wd) => ({
              day: wd.day,
              ...(grouped.get(wd.date) || { present: 0, absent: 0, late: 0 }),
            }))
          )
        })

        // Leave requests by type (last 90 days)
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
        let leaveTypeQuery = supabase
          .from('leave_requests')
          .select('leave_type')
          .gte('created_at', ninetyDaysAgo.toISOString())

        if (teamIds && teamIds.length > 0) {
          leaveTypeQuery = leaveTypeQuery.in('employee_id', teamIds)
        }

        leaveTypeQuery.then(({ data: leaveData }) => {
          const typeMap = new Map<string, number>()
          ;(leaveData || []).forEach((row: { leave_type: string }) => {
            typeMap.set(row.leave_type, (typeMap.get(row.leave_type) || 0) + 1)
          })
          setLeaveByType(
            Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }))
          )
        })

        // Team leave balances (exclude co-founders)
        const currentYear = new Date().getFullYear()
        supabase
          .from('leave_balances')
          .select('*, employee:employee_id(first_name, last_name, department)')
          .eq('year', currentYear)
          .then(({ data: balData }) => {
            if (balData) {
              let filtered = (balData as any[]).filter(
                (b: any) => b.employee?.department !== 'co-founder'
              )
              if (teamIds && teamIds.length > 0) {
                filtered = filtered.filter((b: any) => b.employee?.department === employee.department)
              }
              setTeamLeaveBalances(filtered)
            }
          })
      })
    }
  }, [employee, isAdmin, isManager, isTeamLead, canManageTeam])

  const myTaskStats = useMemo(() => {
    if (myTasks.length === 0) return null
    const active = myTasks.filter((t) => !t.completed_at)
    const completed = myTasks.filter((t) => !!t.completed_at)
    const overdue = active.filter((t) => t.due_date && new Date(t.due_date) < new Date())
    const upcoming = active.filter((t) => {
      if (!t.due_date) return false
      const due = new Date(t.due_date)
      const now = new Date()
      const inWeek = new Date()
      inWeek.setDate(now.getDate() + 7)
      return due >= now && due <= inWeek
    })
    const colMap = new Map<string, number>()
    active.forEach((t) => {
      const cName = t.column?.name || 'Unknown'
      colMap.set(cName, (colMap.get(cName) || 0) + 1)
    })
    return { active, completed, overdue, upcoming, colMap }
  }, [myTasks])

  const teamTaskStats = useMemo(() => {
    if (teamTasks.length === 0) return null
    const active = teamTasks.filter((t) => !t.completed_at)
    const completed = teamTasks.filter((t) => !!t.completed_at)
    const overdue = active.filter((t) => t.due_date && new Date(t.due_date) < new Date())
    const boardMap = new Map<string, { name: string; active: number; completed: number; overdue: number }>()
    teamTasks.forEach((t) => {
      const bName = t.board?.name || 'Unknown'
      const bId = t.board_id
      if (!boardMap.has(bId)) boardMap.set(bId, { name: bName, active: 0, completed: 0, overdue: 0 })
      const entry = boardMap.get(bId)!
      if (t.completed_at) entry.completed++
      else {
        entry.active++
        if (t.due_date && new Date(t.due_date) < new Date()) entry.overdue++
      }
    })
    const colMap = new Map<string, number>()
    active.forEach((t) => {
      const cName = t.column?.name || 'Unknown'
      colMap.set(cName, (colMap.get(cName) || 0) + 1)
    })
    return { active, completed, overdue, boardMap, colMap }
  }, [teamTasks])

  const allTaskStats = useMemo(() => {
    if (allTasks.length === 0) return null
    const allActive = allTasks.filter((t) => !t.completed_at)
    const allCompleted = allTasks.filter((t) => !!t.completed_at)
    const allOverdue = allActive.filter((t) => t.due_date && new Date(t.due_date) < new Date())
    const boardMap = new Map<string, { name: string; active: number; completed: number; overdue: number }>()
    allTasks.forEach((t) => {
      const bName = t.board?.name || 'Unknown'
      const bId = t.board_id
      if (!boardMap.has(bId)) boardMap.set(bId, { name: bName, active: 0, completed: 0, overdue: 0 })
      const entry = boardMap.get(bId)!
      if (t.completed_at) entry.completed++
      else {
        entry.active++
        if (t.due_date && new Date(t.due_date) < new Date()) entry.overdue++
      }
    })
    const colMap = new Map<string, number>()
    allActive.forEach((t) => {
      const cName = t.column?.name || 'Unknown'
      colMap.set(cName, (colMap.get(cName) || 0) + 1)
    })
    return { allActive, allCompleted, allOverdue, boardMap, colMap }
  }, [allTasks])

  if (loading) {
    return <SkeletonPage />
  }

  return (
    <AnimatedPage className="space-y-6">
      <AnimatedSection>
      <div>
        <h1 className="text-xl font-medium text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {employee?.first_name}
        </p>
      </div>
      </AnimatedSection>

      {/* Announcements — top for all users */}
      {announcements.length > 0 && (
        <AnimatedSection>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-100">Announcements</h2>
              <Link href="/announcements" className="text-xs text-brand hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {announcements.map((a) => (
                <div key={a.id} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-gray-100">{a.title}</h3>
                    {a.is_pinned && <Badge variant="default">Pinned</Badge>}
                  </div>
                  <p className="text-sm text-gray-400 whitespace-pre-wrap">{a.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {a.poster && `${a.poster.first_name} ${a.poster.last_name} · `}
                    {formatDate(a.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </AnimatedSection>
      )}

      {/* Quick Stats */}
      {canManageTeam && (
        <AnimatedSection>
        <AnimatedGrid className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AnimatedGridItem>
            <Link href="/people">
              <Card className="hover:border-brand/50 transition-colors cursor-pointer">
                <CardContent>
                  <p className="text-sm text-gray-500">{isAdmin ? 'Active Employees' : 'Team Members'}</p>
                  <p className="text-2xl font-medium text-gray-100 mt-1"><CountUp value={stats.totalEmployees} /></p>
                </CardContent>
              </Card>
            </Link>
          </AnimatedGridItem>
          <AnimatedGridItem>
            <Link href="/attendance">
              <Card className="hover:border-success/50 transition-colors cursor-pointer">
                <CardContent>
                  <p className="text-sm text-gray-500">Present Today</p>
                  <p className="text-2xl font-medium text-gray-100 mt-1"><CountUp value={stats.presentToday} /></p>
                </CardContent>
              </Card>
            </Link>
          </AnimatedGridItem>
          <AnimatedGridItem>
            <Link href="/attendance/leave">
              <Card className="hover:border-warning/50 transition-colors cursor-pointer">
                <CardContent>
                  <p className="text-sm text-gray-500">Pending Leave Requests</p>
                  <p className="text-2xl font-medium text-warning mt-1"><CountUp value={stats.pendingLeaveCount} /></p>
                </CardContent>
              </Card>
            </Link>
          </AnimatedGridItem>
        </AnimatedGrid>
        </AnimatedSection>
      )}

      {/* Charts */}
      {canManageTeam && (
        <AnimatedSection>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-base font-medium text-gray-100">Weekly Attendance</h2>
              <p className="text-xs text-gray-500">Last 7 days breakdown</p>
            </CardHeader>
            <CardContent>
              <DarkBarChart
                data={weeklyAttendance}
                bars={[
                  { dataKey: 'present', color: '#22C55E', name: 'Present' },
                  { dataKey: 'late', color: '#EF9F27', name: 'Late' },
                  { dataKey: 'absent', color: '#E63946', name: 'Absent' },
                ]}
                xKey="day"
                layout="horizontal"
                height={260}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="text-base font-medium text-gray-100">Leave Requests by Type</h2>
              <p className="text-xs text-gray-500">Last 90 days</p>
            </CardHeader>
            <CardContent>
              <DarkPieChart data={leaveByType} height={260} />
            </CardContent>
          </Card>
        </div>
        </AnimatedSection>
      )}

      {/* Today's Attendance Status */}
      <AnimatedSection>
      <Card>
        <CardHeader>
          <h2 className="text-base font-medium text-gray-100">Today&apos;s Attendance</h2>
        </CardHeader>
        <CardContent>
          {todayAttendance ? (
            <div className="flex items-center gap-4">
              <Badge variant={todayAttendance.status === 'present' ? 'success' : todayAttendance.status === 'late' ? 'warning' : 'neutral'}>
                {todayAttendance.status.replace('_', ' ')}
              </Badge>
              <span className="text-sm text-gray-400">
                Checked in: {todayAttendance.check_in || '—'}
                {todayAttendance.check_out && ` | Checked out: ${todayAttendance.check_out}`}
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not checked in yet today.</p>
          )}
        </CardContent>
      </Card>
      </AnimatedSection>

      {/* My Tasks Overview (all users) */}
      {myTaskStats && (
        <AnimatedSection>
        <div className="space-y-6">
          <h2 className="text-base font-medium text-gray-100">My Tasks</h2>
          <AnimatedGrid className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <AnimatedGridItem><Card>
              <CardContent>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-medium text-gray-100 mt-1"><CountUp value={myTaskStats.active.length} /></p>
              </CardContent>
            </Card></AnimatedGridItem>
            <AnimatedGridItem><Card>
              <CardContent>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-medium text-success mt-1"><CountUp value={myTaskStats.completed.length} /></p>
              </CardContent>
            </Card></AnimatedGridItem>
            <AnimatedGridItem><Card>
              <CardContent>
                <p className="text-sm text-gray-500">Overdue</p>
                <p className="text-2xl font-medium text-danger mt-1">{myTaskStats.overdue.length > 0 ? <PulseBadge><CountUp value={myTaskStats.overdue.length} /></PulseBadge> : <CountUp value={myTaskStats.overdue.length} />}</p>
              </CardContent>
            </Card></AnimatedGridItem>
            <AnimatedGridItem><Card>
              <CardContent>
                <p className="text-sm text-gray-500">Due This Week</p>
                <p className="text-2xl font-medium text-warning mt-1"><CountUp value={myTaskStats.upcoming.length} /></p>
              </CardContent>
            </Card></AnimatedGridItem>
          </AnimatedGrid>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">Task Status</h2>
              </CardHeader>
              <CardContent>
                <DarkPieChart
                  data={[
                    { name: 'Active', value: myTaskStats.active.length - myTaskStats.overdue.length, color: '#3B82F6' },
                    { name: 'Overdue', value: myTaskStats.overdue.length, color: '#E63946' },
                    { name: 'Completed', value: myTaskStats.completed.length, color: '#22C55E' },
                  ]}
                  height={240}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">Tasks by Stage</h2>
              </CardHeader>
              <CardContent>
                <DarkBarChart
                  data={Array.from(myTaskStats.colMap.entries()).map(([name, count]) => ({ name, Tasks: count }))}
                  bars={[{ dataKey: 'Tasks', color: '#3B82F6' }]}
                  layout="vertical"
                  height={240}
                />
              </CardContent>
            </Card>
          </div>
          {myTaskStats.overdue.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">Overdue Tasks</h2>
              </CardHeader>
              <CardContent className="space-y-2">
                {myTaskStats.overdue.slice(0, 5).map((t) => (
                  <Link key={t.id} href={`/tasks/${t.board_id}`}>
                    <div className="rounded-lg border border-danger-50 bg-danger-50/30 p-3 hover:bg-danger-50/50 transition-colors">
                      <p className="text-sm font-medium text-gray-100">{t.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {t.board?.name} &middot; Due {t.due_date ? new Date(t.due_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }) : 'N/A'}
                      </p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
        </AnimatedSection>
      )}

      {/* Team Tasks (Manager/Team Lead) */}
      {(isManager || isTeamLead) && teamTaskStats && (
        <AnimatedSection>
        <div className="space-y-6">
          <h2 className="text-base font-medium text-gray-100">Team Tasks</h2>
          <AnimatedGrid className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <AnimatedGridItem><Card>
              <CardContent>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-medium text-gray-100 mt-1"><CountUp value={teamTasks.length} /></p>
              </CardContent>
            </Card></AnimatedGridItem>
            <AnimatedGridItem><Card>
              <CardContent>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-medium text-blue-400 mt-1"><CountUp value={teamTaskStats.active.length} /></p>
              </CardContent>
            </Card></AnimatedGridItem>
            <AnimatedGridItem><Card>
              <CardContent>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-medium text-success mt-1"><CountUp value={teamTaskStats.completed.length} /></p>
              </CardContent>
            </Card></AnimatedGridItem>
            <AnimatedGridItem><Card>
              <CardContent>
                <p className="text-sm text-gray-500">Overdue</p>
                <p className="text-2xl font-medium text-danger mt-1">{teamTaskStats.overdue.length > 0 ? <PulseBadge><CountUp value={teamTaskStats.overdue.length} /></PulseBadge> : <CountUp value={teamTaskStats.overdue.length} />}</p>
              </CardContent>
            </Card></AnimatedGridItem>
          </AnimatedGrid>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">Tasks by Board</h2>
              </CardHeader>
              <CardContent>
                <DarkBarChart
                  data={Array.from(teamTaskStats.boardMap.values()).map((b) => ({
                    name: b.name,
                    Active: b.active,
                    Completed: b.completed,
                    Overdue: b.overdue,
                  }))}
                  bars={[
                    { dataKey: 'Active', color: '#3B82F6' },
                    { dataKey: 'Completed', color: '#22C55E' },
                    { dataKey: 'Overdue', color: '#E63946' },
                  ]}
                  layout="vertical"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">Pipeline Distribution</h2>
              </CardHeader>
              <CardContent>
                <DarkPieChart
                  data={Array.from(teamTaskStats.colMap.entries()).map(([name, value]) => ({ name, value }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>
        </AnimatedSection>
      )}

      {/* Admin: All Tasks Overview */}
      {isAdmin && allTaskStats && (
        <AnimatedSection>
        <div className="space-y-6">
          <h2 className="text-base font-medium text-gray-100">All Tasks Overview</h2>
          <AnimatedGrid className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <AnimatedGridItem>
              <Link href="/tasks">
                <Card className="hover:border-brand/50 transition-colors cursor-pointer">
                  <CardContent>
                    <p className="text-sm text-gray-500">Total Tasks</p>
                    <p className="text-2xl font-medium text-gray-100 mt-1"><CountUp value={allTasks.length} /></p>
                  </CardContent>
                </Card>
              </Link>
            </AnimatedGridItem>
            <AnimatedGridItem>
              <Link href="/tasks?filter=active">
                <Card className="hover:border-blue-500/50 transition-colors cursor-pointer">
                  <CardContent>
                    <p className="text-sm text-gray-500">Active</p>
                    <p className="text-2xl font-medium text-blue-400 mt-1"><CountUp value={allTaskStats.allActive.length} /></p>
                  </CardContent>
                </Card>
              </Link>
            </AnimatedGridItem>
            <AnimatedGridItem>
              <Link href="/tasks">
                <Card className="hover:border-success/50 transition-colors cursor-pointer">
                  <CardContent>
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="text-2xl font-medium text-success mt-1"><CountUp value={allTaskStats.allCompleted.length} /></p>
                  </CardContent>
                </Card>
              </Link>
            </AnimatedGridItem>
            <AnimatedGridItem>
              <Link href="/tasks?filter=overdue">
                <Card className="hover:border-danger/50 transition-colors cursor-pointer">
                  <CardContent>
                    <p className="text-sm text-gray-500">Overdue</p>
                    <p className="text-2xl font-medium text-danger mt-1">{allTaskStats.allOverdue.length > 0 ? <PulseBadge><CountUp value={allTaskStats.allOverdue.length} /></PulseBadge> : <CountUp value={allTaskStats.allOverdue.length} />}</p>
                  </CardContent>
                </Card>
              </Link>
            </AnimatedGridItem>
          </AnimatedGrid>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">Tasks by Board</h2>
              </CardHeader>
              <CardContent>
                <DarkBarChart
                  data={Array.from(allTaskStats.boardMap.values()).map((b) => ({
                    name: b.name,
                    Active: b.active,
                    Completed: b.completed,
                    Overdue: b.overdue,
                  }))}
                  bars={[
                    { dataKey: 'Active', color: '#3B82F6' },
                    { dataKey: 'Completed', color: '#22C55E' },
                    { dataKey: 'Overdue', color: '#E63946' },
                  ]}
                  layout="vertical"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">Pipeline Distribution</h2>
              </CardHeader>
              <CardContent>
                <DarkPieChart
                  data={Array.from(allTaskStats.colMap.entries()).map(([name, value]) => ({ name, value }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>
        </AnimatedSection>
      )}

      {/* My Leave Balance */}
      {myLeaveBalance && (() => {
        const totalUsed = myLeaveBalance.annual_used + myLeaveBalance.sick_used + myLeaveBalance.casual_used
        const totalRemaining = TOTAL_LEAVE_CAP - totalUsed
        const usedPct = Math.min((totalUsed / TOTAL_LEAVE_CAP) * 100, 100)
        return (
          <AnimatedSection>
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">My Leave Balance</h2>
                <p className="text-xs text-gray-500">{totalRemaining} of {TOTAL_LEAVE_CAP} days remaining</p>
              </CardHeader>
              <CardContent>
                <div className="w-full h-3 bg-surface-border rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${usedPct}%`,
                      backgroundColor: usedPct >= 90 ? '#E63946' : usedPct >= 70 ? '#EF9F27' : '#22C55E',
                    }}
                  />
                </div>
                <div className="flex gap-6 text-xs text-gray-400">
                  <span>Annual: {myLeaveBalance.annual_used}/{myLeaveBalance.annual_total}</span>
                  <span>Sick: {myLeaveBalance.sick_used}/{myLeaveBalance.sick_total}</span>
                  <span>Casual: {myLeaveBalance.casual_used}/{myLeaveBalance.casual_total}</span>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
        )
      })()}

      {/* Team Leave Tracker (Admin/Manager/Team Lead) */}
      {canManageTeam && teamLeaveBalances.length > 0 && (
        <AnimatedSection>
          <Card>
            <CardHeader>
              <h2 className="text-base font-medium text-gray-100">Team Leave Tracker</h2>
              <p className="text-xs text-gray-500">{TOTAL_LEAVE_CAP} days cap per employee</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teamLeaveBalances.map((b) => {
                  const used = b.annual_used + b.sick_used + b.casual_used
                  const remaining = TOTAL_LEAVE_CAP - used
                  const pct = Math.min((used / TOTAL_LEAVE_CAP) * 100, 100)
                  return (
                    <div key={b.id} className="flex items-center gap-2 sm:gap-4">
                      <span className="text-xs sm:text-sm text-gray-100 w-24 sm:w-36 shrink-0 truncate">
                        {b.employee ? `${b.employee.first_name} ${b.employee.last_name}` : '—'}
                      </span>
                      <div className="flex-1 h-2 bg-surface-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pct >= 90 ? '#E63946' : pct >= 70 ? '#EF9F27' : '#22C55E',
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-12 sm:w-20 text-right shrink-0">
                        {remaining} left
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
      )}

      {/* Pending Leave Requests — links to leave page */}
      {canManageTeam && pendingLeaves.length > 0 && (
        <AnimatedSection>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-100">Pending Leave Requests</h2>
              <Link href="/attendance/leave" className="text-xs text-brand hover:underline">Review all</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingLeaves.map((leave) => (
                <Link key={leave.id} href="/attendance/leave">
                  <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-surface-hover rounded px-2 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-100">
                        {leave.employee?.first_name} {leave.employee?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {leave.leave_type} leave &middot; {formatDate(leave.start_date)} — {formatDate(leave.end_date)} ({leave.days_count} days)
                      </p>
                    </div>
                    <Badge variant="warning">Pending</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        </AnimatedSection>
      )}
    </AnimatedPage>
  )
}
