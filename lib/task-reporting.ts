import { differenceInCalendarDays, endOfDay, isWithinInterval, startOfDay } from 'date-fns'

export interface TaskReportPerson {
  id: string
  first_name: string
  last_name: string
  email?: string | null
  department?: string | null
}

export interface TaskReportClient {
  id: number
  name: string
}

export interface TaskReportBoard {
  id: number
  name: string
  description?: string | null
  created_at?: string
  updated_at?: string
}

export interface TaskReportColumn {
  id: number
  name: string
}

export interface TaskReportTask {
  id: number
  board_id: number
  column_id: number
  client_id: number | null
  title: string
  description: string | null
  position: number
  owner_id: string
  assignee_id: string | null
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
  client?: TaskReportClient | null
  assignee?: TaskReportPerson | null
  owner?: TaskReportPerson | null
  board?: TaskReportBoard | null
  column?: TaskReportColumn | null
}

export interface DateRange {
  start: string
  end: string
}

export function normalizeTaskReportTask(task: any): TaskReportTask {
  const normalizeRelation = <T>(value: T | T[] | null | undefined): T | null => {
    if (Array.isArray(value)) return value[0] ?? null
    return value ?? null
  }

  return {
    ...task,
    client: normalizeRelation<TaskReportClient>(task.client),
    assignee: normalizeRelation<TaskReportPerson>(task.assignee),
    owner: normalizeRelation<TaskReportPerson>(task.owner),
    board: normalizeRelation<TaskReportBoard>(task.board),
    column: normalizeRelation<TaskReportColumn>(task.column),
  }
}

function safeDate(date: string | null | undefined) {
  return date ? new Date(date) : null
}

export function isDateInRange(date: string | null | undefined, range: DateRange) {
  const value = safeDate(date)
  if (!value) return false

  return isWithinInterval(value, {
    start: startOfDay(new Date(range.start)),
    end: endOfDay(new Date(range.end)),
  })
}

export function getTaskBaselineDate(task: TaskReportTask) {
  return safeDate(task.start_date) ?? safeDate(task.created_at)
}

export function getCompletionDays(task: TaskReportTask) {
  if (!task.completed_at) return null

  const baseline = getTaskBaselineDate(task)
  const completed = safeDate(task.completed_at)
  if (!baseline || !completed) return null

  return Math.max(0, differenceInCalendarDays(completed, baseline))
}

export function isTaskActive(task: TaskReportTask) {
  if (task.is_archived || task.completed_at) return false
  // Also treat tasks in "Done" column as completed
  if (task.column?.name === 'Done') return false
  return true
}

export function isTaskCompleted(task: TaskReportTask) {
  if (task.completed_at) return true
  // Tasks in "Done" column are completed even without completed_at
  if (task.column?.name === 'Done') return true
  return false
}

export function isTaskOverdue(task: TaskReportTask, today = new Date()) {
  if (!isTaskActive(task) || !task.due_date) return false
  return startOfDay(new Date(task.due_date)) < startOfDay(today)
}

export function isTaskDueThisWeek(task: TaskReportTask, today = new Date()) {
  if (!isTaskActive(task) || !task.due_date) return false

  const due = startOfDay(new Date(task.due_date))
  const start = startOfDay(today)
  const diff = differenceInCalendarDays(due, start)
  return diff >= 0 && diff <= 7
}

export function getDisplayName(person?: TaskReportPerson | null) {
  if (!person) return 'Unassigned'
  return `${person.first_name} ${person.last_name}`
}

export function getPerformanceLabel({
  completedCount,
  overdueCount,
  avgCompletionDays,
}: {
  completedCount: number
  overdueCount: number
  avgCompletionDays: number | null
}) {
  if (completedCount === 0) return { label: 'No Data', variant: 'neutral' as const }
  if (overdueCount >= 3 || (avgCompletionDays !== null && avgCompletionDays > 7)) {
    return { label: 'Needs Improvement', variant: 'warning' as const }
  }
  return { label: 'Good', variant: 'success' as const }
}

export function getWorkloadLabel({
  activeCount,
  overdueCount,
}: {
  activeCount: number
  overdueCount: number
}) {
  if (overdueCount > 0) return { label: 'Has Overdue', variant: 'danger' as const }
  if (activeCount >= 8) return { label: 'Heavy Load', variant: 'warning' as const }
  if (activeCount >= 1) return { label: 'Light Load', variant: 'success' as const }
  return { label: 'No Active Tasks', variant: 'neutral' as const }
}
