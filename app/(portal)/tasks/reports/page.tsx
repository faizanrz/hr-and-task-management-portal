'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Badge, Button, Card, CardContent, CardHeader, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, AnimatedPage, AnimatedSection, SkeletonPage } from '@/components/ui'
import dynamic from 'next/dynamic'
const DarkPieChart = dynamic(() => import('@/components/ui/Charts').then(m => ({ default: m.DarkPieChart })), { ssr: false, loading: () => <div className="h-[260px] animate-pulse bg-surface-mid rounded" /> })
const DarkBarChart = dynamic(() => import('@/components/ui/Charts').then(m => ({ default: m.DarkBarChart })), { ssr: false, loading: () => <div className="h-[260px] animate-pulse bg-surface-mid rounded" /> })
const DarkLineChart = dynamic(() => import('@/components/ui/Charts').then(m => ({ default: m.DarkLineChart })), { ssr: false, loading: () => <div className="h-[260px] animate-pulse bg-surface-mid rounded" /> })
import TaskSectionNav from '../_components/TaskSectionNav'
import TaskAdminPanel from '../_components/TaskAdminPanel'
import {
  getCompletionDays,
  getDisplayName,
  getPerformanceLabel,
  getTaskBaselineDate,
  getWorkloadLabel,
  normalizeTaskReportTask,
  isTaskActive,
  isTaskCompleted,
  isTaskDueThisWeek,
  isTaskOverdue,
  type DateRange,
  type TaskReportBoard,
  type TaskReportClient,
  type TaskReportColumn,
  type TaskReportPerson,
  type TaskReportTask,
} from '@/lib/task-reporting'

/* ─── Shared helpers ─── */

type TopTab = 'overview' | 'reports' | 'admin'
type ReportTab = 'department' | 'team' | 'clients' | 'workload' | 'time'

const reportTabs: { id: ReportTab; label: string }[] = [
  { id: 'department', label: 'Department' },
  { id: 'team', label: 'Team Performance' },
  { id: 'clients', label: 'Client Reports' },
  { id: 'workload', label: 'Workload Distribution' },
  { id: 'time', label: 'Time Metrics' },
]

function formatDateInput(date: Date) {
  return date.toISOString().split('T')[0]
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'N/A'
  return new Date(value).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function isTaskRelevantToRange(task: TaskReportTask, range: DateRange) {
  const start = new Date(range.start)
  const end = new Date(range.end)
  const anchors = [task.completed_at, task.due_date, task.start_date, task.created_at]
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())

  return anchors.some((timestamp) => timestamp >= start.getTime() && timestamp <= end.getTime())
}

function StatBlock({ label, value, helper, href }: { label: string; value: string | number; helper?: string; href?: string }) {
  const card = (
    <Card className={href ? 'hover:border-brand/50 transition-colors cursor-pointer' : ''}>
      <CardContent>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-100">{value}</p>
        {helper ? <p className="mt-1 text-xs text-gray-400">{helper}</p> : null}
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{card}</Link> : card
}

/* ─── Main page ─── */

export default function TaskReportsAdminPage() {
  const { employee, isAdmin, isManager, isTeamLead, isStaff, canManageTeam, loading: ctxLoading } = useEmployee()

  /* ── Overview state ── */
  const [boards, setBoards] = useState<TaskReportBoard[]>([])
  const [allTasks, setAllTasks] = useState<TaskReportTask[]>([])

  /* ── Reports state ── */
  const [employees, setEmployees] = useState<TaskReportPerson[]>([])
  const [clients, setClients] = useState<TaskReportClient[]>([])
  const [reportTab, setReportTab] = useState<ReportTab>('team')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 30)
    return { start: formatDateInput(start), end: formatDateInput(end) }
  })

  /* ── Page state ── */
  const [topTab, setTopTab] = useState<TopTab>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employee) return

    async function load() {
      const supabase = createClient()

      const [{ data: boardData }, { data: taskData }, { data: employeeData }, { data: clientData }] = await Promise.all([
        supabase.from('boards').select('id, name, description, created_at, updated_at').order('created_at'),
        supabase
          .from('tasks')
          .select(
            'id, board_id, column_id, client_id, title, description, position, owner_id, assignee_id, start_date, due_date, completed_at, is_archived, created_at, updated_at, client:client_id(id, name), assignee:assignee_id(id, first_name, last_name, email, department), owner:owner_id(id, first_name, last_name, email, department), board:board_id(id, name), column:column_id(id, name)'
          )
          .order('updated_at', { ascending: false }),
        supabase.from('employees').select('id, first_name, last_name, email, department').eq('is_active', true).order('first_name'),
        supabase.from('clients').select('id, name').order('name'),
      ])

      setBoards((boardData || []) as TaskReportBoard[])
      setAllTasks((taskData || []).map((task) => normalizeTaskReportTask(task)))
      setEmployees((employeeData || []) as TaskReportPerson[])
      setClients((clientData || []) as TaskReportClient[])
      setLoading(false)
    }

    load()
  }, [employee])

  /* ── Scoping ── */

  const scopedTasks = useMemo(() => {
    if (!employee) return []
    if (isAdmin) return allTasks
    if ((isManager || isTeamLead) && employee.department) {
      return allTasks.filter((task) => {
        const assigneeDept = task.assignee?.department ?? null
        const ownerDept = task.owner?.department ?? null
        return assigneeDept === employee.department || ownerDept === employee.department
      })
    }
    return allTasks.filter((task) => task.assignee_id === employee.id || task.owner_id === employee.id)
  }, [employee, isAdmin, isManager, isTeamLead, allTasks])

  /* ── Overview derived data ── */

  const activeTasks = scopedTasks.filter(isTaskActive)
  const completedTasks = scopedTasks.filter(isTaskCompleted)
  const archivedTasks = scopedTasks.filter((task) => task.is_archived)
  const overdueTasks = scopedTasks.filter((task) => isTaskOverdue(task))

  const boardSummaries = useMemo(() => {
    return boards.map((board) => {
      const boardTasks = scopedTasks.filter((task) => task.board_id === board.id && !task.is_archived)
      return {
        ...board,
        totalTasks: boardTasks.length,
        completedTasks: boardTasks.filter(isTaskCompleted).length,
        overdueTasks: boardTasks.filter((task) => isTaskOverdue(task)).length,
      }
    })
  }, [boards, scopedTasks])

  const recentCompletedTasks = useMemo(() => {
    return [...completedTasks]
      .sort((a, b) => {
        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 8)
  }, [completedTasks])

  const recentActiveTasks = useMemo(() => {
    return [...activeTasks]
      .sort((a, b) => {
        const aTime = getTaskBaselineDate(a)?.getTime() ?? 0
        const bTime = getTaskBaselineDate(b)?.getTime() ?? 0
        return bTime - aTime
      })
      .slice(0, 8)
  }, [activeTasks])

  /* ── Reports derived data ── */

  const visibleEmployees = useMemo(() => {
    if (!employee) return []
    const excludeCoFounder = (list: typeof employees) => list.filter((m) => m.department !== 'co-founder')
    if (isAdmin) return excludeCoFounder(employees)
    if ((isManager || isTeamLead) && employee.department) {
      return excludeCoFounder(employees.filter((member) => member.department === employee.department))
    }
    return employees.filter((member) => member.id === employee.id)
  }, [employee, employees, isAdmin, isManager, isTeamLead])

  const visibleEmployeeIds = useMemo(() => visibleEmployees.map((m) => m.id), [visibleEmployees])

  const visibleTasks = useMemo(() => {
    if (!employee) return []
    return scopedTasks
  }, [employee, scopedTasks])

  const rangeTasks = useMemo(() => {
    return visibleTasks.filter((task) => isTaskRelevantToRange(task, dateRange))
  }, [dateRange, visibleTasks])

  const completedInRange = useMemo(() => rangeTasks.filter((task) => task.completed_at), [rangeTasks])

  const selectedClientTasks = useMemo(() => {
    if (!selectedClientId) return rangeTasks
    return rangeTasks.filter((task) => String(task.client_id) === selectedClientId)
  }, [rangeTasks, selectedClientId])

  const teamRows = useMemo(() => {
    return visibleEmployees.map((member) => {
      const assignedTasks = rangeTasks.filter((task) => task.assignee_id === member.id)
      const completedMemberTasks = assignedTasks.filter((task) => !!task.completed_at)
      const overdueMemberTasks = assignedTasks.filter((task) => isTaskOverdue(task))
      const avgCompletionDays = completedMemberTasks.length
        ? completedMemberTasks
            .map((task) => getCompletionDays(task))
            .filter((v): v is number => v !== null)
            .reduce((sum, v, _, arr) => sum + v / arr.length, 0)
        : null

      return {
        member,
        assignedCount: assignedTasks.length,
        completedCount: completedMemberTasks.length,
        overdueCount: overdueMemberTasks.length,
        avgCompletionDays,
        status: getPerformanceLabel({
          completedCount: completedMemberTasks.length,
          overdueCount: overdueMemberTasks.length,
          avgCompletionDays,
        }),
      }
    })
  }, [rangeTasks, visibleEmployees])

  const workloadRows = useMemo(() => {
    return visibleEmployees.map((member) => {
      const assignedTasks = visibleTasks.filter((task) => task.assignee_id === member.id)
      const activeCount = assignedTasks.filter(isTaskActive).length
      const overdueCount = assignedTasks.filter((task) => isTaskOverdue(task)).length
      const dueThisWeek = assignedTasks.filter((task) => isTaskDueThisWeek(task)).length

      return {
        member,
        activeCount,
        overdueCount,
        dueThisWeek,
        status: getWorkloadLabel({ activeCount, overdueCount }),
      }
    })
  }, [visibleEmployees, visibleTasks])

  const completionStats = useMemo(() => {
    const completionDays = completedInRange
      .map((task) => getCompletionDays(task))
      .filter((v): v is number => v !== null)

    return {
      totalCompleted: completedInRange.length,
      avgCompletion: completionDays.length > 0 ? (completionDays.reduce((s, v) => s + v, 0) / completionDays.length).toFixed(1) : '0.0',
      fastestCompletion: completionDays.length > 0 ? Math.min(...completionDays) : 0,
      longestCompletion: completionDays.length > 0 ? Math.max(...completionDays) : 0,
      totalOverdue: visibleTasks.filter((task) => isTaskOverdue(task)).length,
      teamMembersAffected: new Set(visibleTasks.filter((task) => isTaskOverdue(task)).map((task) => task.assignee_id).filter(Boolean)).size,
      clientsAffected: new Set(visibleTasks.filter((task) => isTaskOverdue(task)).map((task) => task.client_id).filter(Boolean)).size,
    }
  }, [completedInRange, visibleTasks])

  const completionTrend = useMemo(() => {
    const grouped = new Map<string, number>()
    completedInRange.forEach((task) => {
      if (!task.completed_at) return
      const date = task.completed_at.split('T')[0]
      grouped.set(date, (grouped.get(date) || 0) + 1)
    })
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))
  }, [completedInRange])

  const clientSummary = useMemo(() => {
    const tasksForClient = selectedClientTasks
    const completed = tasksForClient.filter((task) => !!task.completed_at)
    const active = tasksForClient.filter(isTaskActive)
    const overdue = tasksForClient.filter((task) => isTaskOverdue(task))
    const completionDays = completed.map((task) => getCompletionDays(task)).filter((v): v is number => v !== null)

    const taskByMember = visibleEmployees
      .map((member) => {
        const memberTasks = tasksForClient.filter((task) => task.assignee_id === member.id)
        const memberCompleted = memberTasks.filter((task) => !!task.completed_at)
        return {
          member,
          totalTasks: memberTasks.length,
          completed: memberCompleted.length,
          completionRate: memberTasks.length > 0 ? Math.round((memberCompleted.length / memberTasks.length) * 100) : 0,
        }
      })
      .filter((row) => row.totalTasks > 0)
      .sort((a, b) => b.totalTasks - a.totalTasks)

    const recentCompleted = [...completed]
      .sort((a, b) => {
        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 10)

    return {
      totalTasks: tasksForClient.length,
      completedTasks: completed.length,
      activeTasks: active.length,
      overdueTasks: overdue.length,
      avgCompletion: completionDays.length > 0 ? (completionDays.reduce((s, v) => s + v, 0) / completionDays.length).toFixed(1) : '0.0',
      taskByMember,
      recentCompleted,
    }
  }, [selectedClientTasks, visibleEmployees])

  /* ── Department breakdown ── */

  const departmentStats = useMemo(() => {
    const deptMap = new Map<string, { assigned: number; completed: number; overdue: number; active: number; members: Set<string> }>()

    rangeTasks.forEach((task) => {
      const dept = task.assignee?.department || task.owner?.department || 'Unassigned'
      if (dept === 'co-founder') return
      if (!deptMap.has(dept)) deptMap.set(dept, { assigned: 0, completed: 0, overdue: 0, active: 0, members: new Set() })
      const entry = deptMap.get(dept)!
      entry.assigned++
      if (task.completed_at) entry.completed++
      else {
        entry.active++
        if (isTaskOverdue(task)) entry.overdue++
      }
      if (task.assignee_id) entry.members.add(task.assignee_id)
    })

    return Array.from(deptMap.entries())
      .map(([dept, data]) => ({
        department: dept === 'null' ? 'Unassigned' : dept.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        ...data,
        memberCount: data.members.size,
        completionRate: data.assigned > 0 ? Math.round((data.completed / data.assigned) * 100) : 0,
      }))
      .sort((a, b) => b.assigned - a.assigned)
  }, [rangeTasks])

  /* ── Top-level tabs ── */

  const topTabs: { id: TopTab; label: string; show: boolean }[] = [
    { id: 'overview', label: 'Overview', show: true },
    { id: 'reports', label: 'Reports', show: canManageTeam },
    { id: 'admin', label: 'Admin', show: isAdmin },
  ]

  if (ctxLoading || loading) {
    return <SkeletonPage />
  }

  return (
    <AnimatedPage className="space-y-6">
      <AnimatedSection>
        <div className="space-y-2">
          <div>
            <h1 className="text-xl font-medium text-gray-100">Reports &amp; Admin</h1>
            <p className="mt-1 text-sm text-gray-500">
              Overview, analytics, and administrative tools for task management.
            </p>
          </div>
          <TaskSectionNav />
        </div>
      </AnimatedSection>

      {/* Top-level tab bar */}
      <AnimatedSection>
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {topTabs.filter((t) => t.show).map((item) => {
              const active = topTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTopTab(item.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-brand text-white' : 'border border-surface-border bg-surface-card text-gray-400 hover:bg-surface-mid'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
      </AnimatedSection>

      {/* ────────────── OVERVIEW TAB ────────────── */}
      {topTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatBlock label="Boards" value={boardSummaries.length} helper="Active task boards" href="/tasks" />
            <StatBlock label="Active Tasks" value={activeTasks.length} helper="Open work across your scope" href="/tasks?filter=active" />
            <StatBlock label="Overdue Tasks" value={overdueTasks.length} helper="Needs immediate attention" href="/tasks?filter=overdue" />
            <StatBlock label="Archived Tasks" value={archivedTasks.length} helper="Still kept in the database" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">Task Status Distribution</h2>
              </CardHeader>
              <CardContent>
                <DarkPieChart
                  data={[
                    { name: 'Active', value: activeTasks.length, color: '#3B82F6' },
                    { name: 'Completed', value: completedTasks.length, color: '#22C55E' },
                    { name: 'Overdue', value: overdueTasks.length, color: '#E63946' },
                    { name: 'Archived', value: archivedTasks.length, color: '#6B7280' },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">Tasks by Board</h2>
              </CardHeader>
              <CardContent>
                <DarkBarChart
                  data={boardSummaries.map((b) => ({ name: b.name, Completed: b.completedTasks, Overdue: b.overdueTasks, Other: b.totalTasks - b.completedTasks - b.overdueTasks }))}
                  bars={[
                    { dataKey: 'Completed', color: '#22C55E' },
                    { dataKey: 'Overdue', color: '#E63946' },
                    { dataKey: 'Other', color: '#3B82F6', name: 'In Progress' },
                  ]}
                  layout="vertical"
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr,1fr]">
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">Boards Overview</h2>
                <p className="mt-1 text-sm text-gray-500">Quick health snapshot for each board.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {boardSummaries.length === 0 ? (
                  <p className="text-sm text-gray-500">No boards available yet.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {boardSummaries.map((board) => (
                      <Link key={board.id} href={`/tasks/${board.id}`}>
                        <div className="rounded-lg border border-surface-border p-4 transition-colors hover:border-brand-50 hover:bg-brand-50/20">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-base font-medium text-gray-100">{board.name}</h3>
                              <p className="mt-1 text-xs text-gray-500">Updated {formatDateLabel(board.updated_at)}</p>
                            </div>
                            <Badge variant={board.overdueTasks > 0 ? 'warning' : 'success'}>
                              {board.overdueTasks > 0 ? `${board.overdueTasks} overdue` : 'On track'}
                            </Badge>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500">Tasks</p>
                              <p className="mt-1 font-medium text-gray-100">{board.totalTasks}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Completed</p>
                              <p className="mt-1 font-medium text-gray-100">{board.completedTasks}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Overdue</p>
                              <p className="mt-1 font-medium text-gray-100">{board.overdueTasks}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <h2 className="text-base font-medium text-gray-100">Completed Recently</h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentCompletedTasks.length === 0 ? (
                    <p className="text-sm text-gray-500">No completed tasks in your current scope.</p>
                  ) : (
                    recentCompletedTasks.map((task) => (
                      <div key={task.id} className="rounded-lg border border-surface-border p-3">
                        <p className="text-sm font-medium text-gray-100">{task.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {task.client?.name || 'No client'} · {getDisplayName(task.assignee)}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">Completed {formatDateLabel(task.completed_at)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="text-base font-medium text-gray-100">Needs Attention</h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overdueTasks.length === 0 ? (
                    <p className="text-sm text-gray-500">No overdue tasks right now.</p>
                  ) : (
                    overdueTasks.slice(0, 6).map((task) => (
                      <div key={task.id} className="rounded-lg border border-danger-50 bg-danger-50/30 p-3">
                        <p className="text-sm font-medium text-gray-100">{task.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {task.client?.name || 'No client'} · Due {formatDateLabel(task.due_date)}
                        </p>
                        <p className="mt-1 text-xs text-danger-600">Assigned to {getDisplayName(task.assignee)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium text-gray-100">Freshly Created / Active</h2>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Task</TableHeader>
                      <TableHeader>Board</TableHeader>
                      <TableHeader>Assignee</TableHeader>
                      <TableHeader>Due</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentActiveTasks.length === 0 ? (
                      <TableRow>
                        <TableCell className="py-6 text-center text-gray-400" colSpan={4}>
                          No active tasks in your current scope.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentActiveTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-100">{task.title}</p>
                              <p className="text-xs text-gray-500">{task.client?.name || 'No client'}</p>
                            </div>
                          </TableCell>
                          <TableCell>{task.board?.name || '—'}</TableCell>
                          <TableCell>{getDisplayName(task.assignee)}</TableCell>
                          <TableCell>{formatDateLabel(task.due_date)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ────────────── REPORTS TAB ────────────── */}
      {topTab === 'reports' && (
        <>
          <Card>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {reportTabs.map((item) => {
                  const active = reportTab === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setReportTab(item.id)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        active ? 'bg-brand text-white' : 'border border-surface-border bg-surface-card text-gray-400 hover:bg-surface-mid'
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-gray-500">Start Date</label>
                  <input
                    className="h-10 w-full rounded-md border border-surface-border bg-surface-mid px-3 text-sm text-gray-100"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-500">End Date</label>
                  <input
                    className="h-10 w-full rounded-md border border-surface-border bg-surface-mid px-3 text-sm text-gray-100"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                  />
                </div>
                {reportTab === 'clients' ? (
                  <div>
                    <label className="mb-1 block text-sm text-gray-500">Client</label>
                    <Select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      options={[
                        { value: '', label: 'All Clients' },
                        ...clients.map((c) => ({ value: String(c.id), label: c.name })),
                      ]}
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-surface-border bg-surface-mid px-4 py-3 text-sm text-gray-500">
                    Scope:
                    <span className="ml-2 font-medium text-gray-300">
                      {isAdmin ? 'All teams' : (isManager || isTeamLead) ? `Department: ${employee?.department}` : 'My tasks only'}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {reportTab === 'department' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <StatBlock label="Departments" value={departmentStats.length} href="/people" />
                <StatBlock label="Total Tasks" value={departmentStats.reduce((s, d) => s + d.assigned, 0)} href="/tasks" />
                <StatBlock label="Completed" value={departmentStats.reduce((s, d) => s + d.completed, 0)} href="/tasks" />
                <StatBlock label="Overdue" value={departmentStats.reduce((s, d) => s + d.overdue, 0)} href="/tasks?filter=overdue" />
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader><h2 className="text-base font-medium text-gray-100">Tasks by Department</h2></CardHeader>
                  <CardContent>
                    <DarkBarChart
                      data={departmentStats.map((d) => ({
                        name: d.department,
                        Active: d.active,
                        Completed: d.completed,
                        Overdue: d.overdue,
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
                  <CardHeader><h2 className="text-base font-medium text-gray-100">Completion Rate by Department</h2></CardHeader>
                  <CardContent>
                    <DarkBarChart
                      data={departmentStats.map((d) => ({
                        name: d.department,
                        'Completion %': d.completionRate,
                      }))}
                      bars={[{ dataKey: 'Completion %', color: '#22C55E' }]}
                      layout="vertical"
                    />
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader><h2 className="text-base font-medium text-gray-100">Department Breakdown</h2></CardHeader>
                <CardContent>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Department</TableHeader>
                        <TableHeader>Members</TableHeader>
                        <TableHeader>Assigned</TableHeader>
                        <TableHeader>Completed</TableHeader>
                        <TableHeader>Active</TableHeader>
                        <TableHeader>Overdue</TableHeader>
                        <TableHeader>Completion Rate</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {departmentStats.map((d) => (
                        <TableRow key={d.department}>
                          <TableCell className="font-medium text-gray-100 capitalize">{d.department}</TableCell>
                          <TableCell>{d.memberCount}</TableCell>
                          <TableCell>{d.assigned}</TableCell>
                          <TableCell>{d.completed}</TableCell>
                          <TableCell>{d.active}</TableCell>
                          <TableCell>{d.overdue}</TableCell>
                          <TableCell>
                            <Badge variant={d.completionRate >= 80 ? 'success' : d.completionRate >= 50 ? 'warning' : 'neutral'}>
                              {d.completionRate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {reportTab === 'team' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <StatBlock label="Team Members" value={teamRows.length} href="/people" />
                <StatBlock label="Assigned Tasks" value={teamRows.reduce((s, r) => s + r.assignedCount, 0)} href="/tasks" />
                <StatBlock label="Completed Tasks" value={teamRows.reduce((s, r) => s + r.completedCount, 0)} href="/tasks" />
                <StatBlock label="Overdue Tasks" value={teamRows.reduce((s, r) => s + r.overdueCount, 0)} href="/tasks?filter=overdue" />
              </div>
              <Card>
                <CardHeader><h2 className="text-base font-medium text-gray-100">Performance Overview</h2></CardHeader>
                <CardContent>
                  <DarkBarChart
                    data={teamRows.filter((r) => r.assignedCount > 0).map((r) => ({
                      name: getDisplayName(r.member).split(' ')[0],
                      Assigned: r.assignedCount,
                      Completed: r.completedCount,
                      Overdue: r.overdueCount,
                    }))}
                    bars={[
                      { dataKey: 'Assigned', color: '#3B82F6' },
                      { dataKey: 'Completed', color: '#22C55E' },
                      { dataKey: 'Overdue', color: '#E63946' },
                    ]}
                    layout="vertical"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><h2 className="text-base font-medium text-gray-100">Team Members Performance</h2></CardHeader>
                <CardContent>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Email</TableHeader>
                        <TableHeader>Assigned</TableHeader>
                        <TableHeader>Completed</TableHeader>
                        <TableHeader>Overdue</TableHeader>
                        <TableHeader>Avg. Completion</TableHeader>
                        <TableHeader>Status</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {teamRows.map((row) => (
                        <TableRow key={row.member.id}>
                          <TableCell className="font-medium text-gray-100">{getDisplayName(row.member)}</TableCell>
                          <TableCell>{row.member.email || '—'}</TableCell>
                          <TableCell>{row.assignedCount}</TableCell>
                          <TableCell>{row.completedCount}</TableCell>
                          <TableCell>{row.overdueCount}</TableCell>
                          <TableCell>{row.avgCompletionDays !== null ? `${row.avgCompletionDays.toFixed(1)} days` : 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={row.status.variant === 'success' ? 'success' : row.status.variant === 'warning' ? 'warning' : 'neutral'}>
                              {row.status.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {reportTab === 'clients' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <StatBlock label="Total Tasks" value={clientSummary.totalTasks} href="/tasks" />
                <StatBlock label="Completed" value={clientSummary.completedTasks} href="/tasks" />
                <StatBlock label="Active Tasks" value={clientSummary.activeTasks} href="/tasks?filter=active" />
                <StatBlock label="Overdue" value={clientSummary.overdueTasks} href="/tasks?filter=overdue" />
                <StatBlock label="Avg. Completion" value={`${clientSummary.avgCompletion} days`} />
              </div>
              <Card>
                <CardHeader><h2 className="text-base font-medium text-gray-100">Task Status Breakdown</h2></CardHeader>
                <CardContent>
                  <DarkPieChart
                    data={[
                      { name: 'Completed', value: clientSummary.completedTasks, color: '#22C55E' },
                      { name: 'Active', value: clientSummary.activeTasks, color: '#3B82F6' },
                      { name: 'Overdue', value: clientSummary.overdueTasks, color: '#E63946' },
                    ]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><h2 className="text-base font-medium text-gray-100">Tasks by Team Member</h2></CardHeader>
                <CardContent>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Team Member</TableHeader>
                        <TableHeader>Total Tasks</TableHeader>
                        <TableHeader>Completed</TableHeader>
                        <TableHeader>Completion Rate</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {clientSummary.taskByMember.length === 0 ? (
                        <TableRow><TableCell className="py-6 text-center text-gray-400" colSpan={4}>No client activity found in this range.</TableCell></TableRow>
                      ) : (
                        clientSummary.taskByMember.map((row) => (
                          <TableRow key={row.member.id}>
                            <TableCell className="font-medium text-gray-100">{getDisplayName(row.member)}</TableCell>
                            <TableCell>{row.totalTasks}</TableCell>
                            <TableCell>{row.completed}</TableCell>
                            <TableCell>
                              <Badge variant={row.completionRate >= 80 ? 'success' : row.completionRate >= 50 ? 'warning' : 'neutral'}>{row.completionRate}%</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><h2 className="text-base font-medium text-gray-100">Recently Completed Tasks</h2></CardHeader>
                <CardContent>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Task</TableHeader>
                        <TableHeader>Assignee</TableHeader>
                        <TableHeader>Completed Date</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {clientSummary.recentCompleted.length === 0 ? (
                        <TableRow><TableCell className="py-6 text-center text-gray-400" colSpan={3}>No completed tasks yet for the current client filter.</TableCell></TableRow>
                      ) : (
                        clientSummary.recentCompleted.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell className="font-medium text-gray-100">{task.title}</TableCell>
                            <TableCell>{getDisplayName(task.assignee)}</TableCell>
                            <TableCell>{formatDateLabel(task.completed_at)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {reportTab === 'workload' && (
            <div className="space-y-6">
              <Card>
                <CardHeader><h2 className="text-base font-medium text-gray-100">Workload Distribution</h2></CardHeader>
                <CardContent>
                  <DarkBarChart
                    data={workloadRows.filter((r) => r.activeCount > 0 || r.overdueCount > 0).map((r) => ({
                      name: getDisplayName(r.member).split(' ')[0],
                      Active: r.activeCount,
                      Overdue: r.overdueCount,
                      'Due This Week': r.dueThisWeek,
                    }))}
                    bars={[
                      { dataKey: 'Active', color: '#3B82F6' },
                      { dataKey: 'Overdue', color: '#E63946' },
                      { dataKey: 'Due This Week', color: '#EF9F27' },
                    ]}
                    layout="vertical"
                  />
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {workloadRows.map((row) => (
                  <Card key={row.member.id}>
                    <CardContent>
                      <p className="text-sm font-medium uppercase tracking-wide text-gray-500">{getDisplayName(row.member)}</p>
                      <p className="mt-2 text-3xl font-semibold text-gray-100">{row.activeCount}</p>
                      <p className="text-sm text-gray-500">active tasks</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.overdueCount > 0 ? <Badge variant="danger">{row.overdueCount} overdue</Badge> : null}
                        {row.dueThisWeek > 0 ? <Badge variant="warning">{row.dueThisWeek} due this week</Badge> : null}
                        {row.overdueCount === 0 && row.dueThisWeek === 0 ? <Badge variant="success">Steady</Badge> : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader><h2 className="text-base font-medium text-gray-100">Detailed Breakdown</h2></CardHeader>
                <CardContent>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Team Member</TableHeader>
                        <TableHeader>Active Tasks</TableHeader>
                        <TableHeader>Overdue</TableHeader>
                        <TableHeader>Due This Week</TableHeader>
                        <TableHeader>Status</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {workloadRows.map((row) => (
                        <TableRow key={row.member.id}>
                          <TableCell className="font-medium text-gray-100">{getDisplayName(row.member)}</TableCell>
                          <TableCell>{row.activeCount}</TableCell>
                          <TableCell>{row.overdueCount}</TableCell>
                          <TableCell>{row.dueThisWeek}</TableCell>
                          <TableCell>
                            <Badge variant={row.status.variant === 'danger' ? 'danger' : row.status.variant === 'warning' ? 'warning' : row.status.variant === 'success' ? 'success' : 'neutral'}>
                              {row.status.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {reportTab === 'time' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <StatBlock label="Tasks Completed" value={completionStats.totalCompleted} helper="In selected period" />
                <StatBlock label="Avg. Completion" value={`${completionStats.avgCompletion} days`} />
                <StatBlock label="Fastest Completion" value={`${completionStats.fastestCompletion} days`} />
                <StatBlock label="Longest Completion" value={`${completionStats.longestCompletion} days`} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatBlock label="Total Overdue" value={completionStats.totalOverdue} />
                <StatBlock label="Team Members Affected" value={completionStats.teamMembersAffected} />
                <StatBlock label="Clients Affected" value={completionStats.clientsAffected} />
              </div>
              <Card>
                <CardHeader><h2 className="text-base font-medium text-gray-100">Completion Trend</h2></CardHeader>
                <CardContent>
                  <DarkLineChart
                    data={completionTrend.map((row) => ({
                      date: new Date(row.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }),
                      Completed: row.count,
                    }))}
                    lines={[{ dataKey: 'Completed', color: '#22C55E' }]}
                    xKey="date"
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ────────────── ADMIN TAB ────────────── */}
      {topTab === 'admin' && <TaskAdminPanel />}
    </AnimatedPage>
  )
}
