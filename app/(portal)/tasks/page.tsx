'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Badge, Button, Card, CardContent, Table, TableHead, TableBody, TableRow, TableCell, TableHeader, AnimatedPage, AnimatedSection, SkeletonPage } from '@/components/ui'
import TaskSectionNav from './_components/TaskSectionNav'
import { formatDate } from '@/lib/utils'
import {
  normalizeTaskReportTask,
  isTaskActive,
  isTaskCompleted,
  isTaskOverdue,
  type TaskReportBoard,
  type TaskReportTask,
} from '@/lib/task-reporting'

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'N/A'
  return new Date(value).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function TasksBoardsPageWrapper() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <TasksBoardsPage />
    </Suspense>
  )
}

function TasksBoardsPage() {
  const { employee, isAdmin, isManager, loading: ctxLoading } = useEmployee()
  const searchParams = useSearchParams()
  const filterParam = searchParams.get('filter')
  const [boards, setBoards] = useState<TaskReportBoard[]>([])
  const [tasks, setTasks] = useState<TaskReportTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employee) return

    async function load() {
      const supabase = createClient()

      const [{ data: boardData }, { data: taskData }] = await Promise.all([
        supabase.from('boards').select('id, name, description, created_at, updated_at').order('created_at'),
        supabase
          .from('tasks')
          .select(
            'id, board_id, column_id, client_id, title, description, position, owner_id, assignee_id, start_date, due_date, completed_at, is_archived, created_at, updated_at, client:client_id(id, name), assignee:assignee_id(id, first_name, last_name, email, department), owner:owner_id(id, first_name, last_name, email, department), board:board_id(id, name), column:column_id(id, name)'
          )
          .order('updated_at', { ascending: false })
          .limit(5000),
      ])

      setBoards((boardData || []) as TaskReportBoard[])
      setTasks((taskData || []).map((task) => normalizeTaskReportTask(task)) as TaskReportTask[])
      setLoading(false)
    }

    load()
  }, [employee])

  const scopedTasks = useMemo(() => {
    if (!employee) return []
    if (isAdmin) return tasks
    if (isManager && employee.department) {
      return tasks.filter((task) => {
        const assigneeDept = task.assignee?.department ?? null
        const ownerDept = task.owner?.department ?? null
        return assigneeDept === employee.department || ownerDept === employee.department
      })
    }
    return tasks.filter((task) => task.assignee_id === employee.id || task.owner_id === employee.id)
  }, [employee, isAdmin, isManager, tasks])

  const boardSummaries = useMemo(() => {
    return boards.map((board) => {
      const boardTasks = scopedTasks.filter((task) => task.board_id === board.id && !task.is_archived)
      const active = boardTasks.filter(isTaskActive).length
      const completed = boardTasks.filter(isTaskCompleted).length
      const overdue = boardTasks.filter((task) => isTaskOverdue(task)).length

      return {
        ...board,
        totalTasks: boardTasks.length,
        activeTasks: active,
        completedTasks: completed,
        overdueTasks: overdue,
      }
    })
  }, [boards, scopedTasks])

  // Filtered tasks for active/overdue views
  const filteredTasks = useMemo(() => {
    const nonArchived = scopedTasks.filter(t => !t.is_archived)
    if (filterParam === 'active') return nonArchived.filter(isTaskActive)
    if (filterParam === 'overdue') return nonArchived.filter(t => isTaskOverdue(t))
    return []
  }, [scopedTasks, filterParam])

  if (ctxLoading || loading) {
    return <SkeletonPage />
  }

  // Filtered view for active/overdue
  if (filterParam === 'active' || filterParam === 'overdue') {
    const title = filterParam === 'active' ? 'Active Tasks' : 'Overdue Tasks'
    return (
      <AnimatedPage className="space-y-6">
        <AnimatedSection>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-medium text-gray-100">{title}</h1>
                <p className="mt-1 text-sm text-gray-500">
                  {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} across all boards
                </p>
              </div>
              <Link href="/tasks">
                <Button variant="ghost" size="sm">&larr; Back to Boards</Button>
              </Link>
            </div>
            <TaskSectionNav />
          </div>
        </AnimatedSection>

        <AnimatedSection>
          <Card>
            <CardContent>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Task</TableHeader>
                    <TableHeader>Board</TableHeader>
                    <TableHeader>Stage</TableHeader>
                    <TableHeader>Client</TableHeader>
                    <TableHeader>Assignee</TableHeader>
                    <TableHeader>Due Date</TableHeader>
                    {filterParam === 'overdue' && <TableHeader>Days Overdue</TableHeader>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTasks.map((task) => {
                    const daysOverdue = task.due_date
                      ? Math.floor((Date.now() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24))
                      : 0
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <Link href={`/tasks/${task.board_id}`} className="text-gray-100 hover:text-brand transition-colors">
                            {task.title}
                          </Link>
                        </TableCell>
                        <TableCell>{task.board?.name || '—'}</TableCell>
                        <TableCell>{task.column?.name || '—'}</TableCell>
                        <TableCell>{task.client?.name || '—'}</TableCell>
                        <TableCell>
                          {task.assignee ? `${task.assignee.first_name} ${task.assignee.last_name}` : '—'}
                        </TableCell>
                        <TableCell>
                          {task.due_date ? (
                            <span className={isTaskOverdue(task) ? 'text-danger' : ''}>
                              {formatDate(task.due_date)}
                            </span>
                          ) : '—'}
                        </TableCell>
                        {filterParam === 'overdue' && (
                          <TableCell>
                            <Badge variant="danger">{daysOverdue} day{daysOverdue !== 1 ? 's' : ''}</Badge>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                  {filteredTasks.length === 0 && (
                    <TableRow>
                      <TableCell className="text-center text-gray-400 py-8">
                        No {filterParam} tasks found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </AnimatedSection>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="space-y-6">
      <AnimatedSection>
        <div className="space-y-2">
          <div>
            <h1 className="text-xl font-medium text-gray-100">Task Boards</h1>
            <p className="mt-1 text-sm text-gray-500">
              Select a board to view and manage its tasks.
            </p>
          </div>
          <TaskSectionNav />
        </div>
      </AnimatedSection>

      <AnimatedSection>
      {boardSummaries.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500">No boards available yet. Admins can create boards from the Reports &amp; Admin section.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {boardSummaries.map((board) => (
            <Link key={board.id} href={`/tasks/${board.id}`}>
              <Card className="h-full transition-all hover:border-brand-50 hover:shadow-md">
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-100">{board.name}</h3>
                      {board.description && (
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{board.description}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-400">
                        Updated {formatDateLabel(board.updated_at)}
                      </p>
                    </div>
                    <Badge variant={board.overdueTasks > 0 ? 'warning' : 'success'}>
                      {board.overdueTasks > 0 ? `${board.overdueTasks} overdue` : 'On track'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3 border-t border-surface-border pt-4 text-sm">
                    <div>
                      <p className="text-gray-500">Active</p>
                      <p className="mt-1 text-lg font-semibold text-gray-100">{board.activeTasks}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Completed</p>
                      <p className="mt-1 text-lg font-semibold text-gray-100">{board.completedTasks}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="mt-1 text-lg font-semibold text-gray-100">{board.totalTasks}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      </AnimatedSection>
    </AnimatedPage>
  )
}
