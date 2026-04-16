'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Button, Modal, Input, Select, Textarea, AnimatedPage, AnimatedSection, KanbanCard, CountUp, SkeletonPage, PulseBadge, CompletionCheck } from '@/components/ui'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDate } from '@/lib/utils'
import type { Board, BoardColumn, Task, Client, Employee, TaskComment } from '@/types'
import TaskSectionNav from '../_components/TaskSectionNav'

interface TaskWithRelations extends Task {
  client?: { id: number; name: string } | null
  assignee?: { id: string; first_name: string; last_name: string } | null
  owner?: { id: string; first_name: string; last_name: string } | null
}

export default function BoardPage({ params }: { params: { boardId: string } }) {
  const { employee, isAdmin, canManageTeam, loading: ctxLoading } = useEmployee()
  const [board, setBoard] = useState<Board | null>(null)
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterClient, setFilterClient] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')

  // Task detail modal
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null)
  const [comments, setComments] = useState<(TaskComment & { user?: { first_name: string; last_name: string } })[]>([])
  const [newComment, setNewComment] = useState('')
  const [commenting, setCommenting] = useState(false)

  // Edit task
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', client_id: '', assignee_id: '', start_date: '', due_date: '' })

  // Create task modal
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    client_id: '',
    assignee_id: '',
    column_id: '',
    start_date: '',
    due_date: '',
  })

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)

  const boardId = parseInt(params.boardId)

  useEffect(() => {
    if (!employee) return
    loadAll()
  }, [employee, boardId])

  async function loadAll() {
    const supabase = createClient()

    const [boardRes, colRes, clientRes, empRes] = await Promise.all([
      supabase.from('boards').select('*').eq('id', boardId).single(),
      supabase.from('board_columns').select('*').eq('board_id', boardId).order('position'),
      supabase.from('clients').select('*').eq('is_active', true).order('name'),
      supabase.from('employees').select('*').eq('is_active', true).order('first_name'),
    ])

    const { data: taskData } = await supabase
      .from('tasks')
      .select('*, client:client_id(id, name), assignee:assignee_id(id, first_name, last_name), owner:owner_id(id, first_name, last_name)')
      .eq('board_id', boardId)
      .eq('is_archived', false)
      .order('position')

    if (boardRes.data) setBoard(boardRes.data as Board)
    if (colRes.data) setColumns(colRes.data as BoardColumn[])
    if (taskData) setTasks(taskData as TaskWithRelations[])
    if (clientRes.data) setClients(clientRes.data as Client[])
    if (empRes.data) setEmployees(empRes.data as Employee[])
    setLoading(false)
  }

  async function loadComments(taskId: number) {
    const supabase = createClient()
    const { data } = await supabase
      .from('task_comments')
      .select('*, user:user_id(first_name, last_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    if (data) setComments(data as any)
  }

  async function handleAddComment() {
    if (!selectedTask || !newComment.trim() || !employee) return
    setCommenting(true)
    const supabase = createClient()
    await supabase.from('task_comments').insert({
      task_id: selectedTask.id,
      user_id: employee.id,
      comment: newComment.trim(),
    })
    setNewComment('')
    setCommenting(false)
    loadComments(selectedTask.id)
  }

  async function handleMoveTask(taskId: number, newColumnId: number, beforeTaskId?: number | null) {
    const supabase = createClient()
    const col = columns.find(c => c.id === newColumnId)
    const movedTask = tasks.find(t => t.id === taskId)

    if (!movedTask) return

    const updates: any = { column_id: newColumnId, updated_at: new Date().toISOString() }

    // If moved to "Done", set completed_at
    if (col?.name === 'Done') {
      updates.completed_at = new Date().toISOString()
    } else {
      updates.completed_at = null
    }

    const remainingTasks = tasks.filter(t => t.id !== taskId)
    const sourceColumnId = movedTask.column_id

    const sourceTasks = remainingTasks
      .filter(t => t.column_id === sourceColumnId)
      .sort((a, b) => a.position - b.position)

    const targetTasks = remainingTasks
      .filter(t => t.column_id === newColumnId)
      .sort((a, b) => a.position - b.position)

    const insertIndex = beforeTaskId
      ? targetTasks.findIndex(t => t.id === beforeTaskId)
      : -1

    const updatedMovedTask = {
      ...movedTask,
      column_id: newColumnId,
      completed_at: updates.completed_at,
      updated_at: updates.updated_at,
    }

    if (insertIndex >= 0) {
      targetTasks.splice(insertIndex, 0, updatedMovedTask)
    } else {
      targetTasks.push(updatedMovedTask)
    }

    const sourceReordered = sourceTasks.map((task, index) => ({
      ...task,
      position: index,
    }))

    const targetReordered = targetTasks.map((task, index) => ({
      ...task,
      position: index,
    }))

    const nextTasks = remainingTasks.map(task => {
      const sourceMatch = sourceReordered.find(t => t.id === task.id)
      if (sourceMatch) return sourceMatch

      const targetMatch = targetReordered.find(t => t.id === task.id)
      if (targetMatch) return targetMatch

      return task
    })

    nextTasks.push(updatedMovedTask)

    setTasks(
      nextTasks
        .map(task => {
          const targetMatch = targetReordered.find(t => t.id === task.id)
          if (targetMatch) return targetMatch

          const sourceMatch = sourceReordered.find(t => t.id === task.id)
          if (sourceMatch) return sourceMatch

          return task
        })
        .sort((a, b) => a.position - b.position)
    )

    setSelectedTask(prev => {
      if (!prev || prev.id !== taskId) return prev
      const reorderedMovedTask = targetReordered.find(t => t.id === taskId)
      return reorderedMovedTask ?? prev
    })

    const changedTasks = [...sourceReordered, ...targetReordered]

    await Promise.all(
      changedTasks.map(task => {
        const payload =
          task.id === taskId
            ? {
                column_id: task.column_id,
                position: task.position,
                completed_at: updates.completed_at,
                updated_at: updates.updated_at,
              }
            : {
                column_id: task.column_id,
                position: task.position,
              }

        return supabase.from('tasks').update(payload).eq('id', task.id)
      })
    )
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    if (!employee || !newTask.column_id) return
    setCreating(true)
    const supabase = createClient()

    await supabase.from('tasks').insert({
      board_id: boardId,
      column_id: parseInt(newTask.column_id),
      title: newTask.title,
      description: newTask.description || null,
      client_id: newTask.client_id ? parseInt(newTask.client_id) : null,
      owner_id: employee.id,
      assignee_id: newTask.assignee_id || null,
      start_date: newTask.start_date || null,
      due_date: newTask.due_date || null,
      position: 0,
    })

    setShowCreate(false)
    setNewTask({ title: '', description: '', client_id: '', assignee_id: '', column_id: '', start_date: '', due_date: '' })
    setCreating(false)
    loadAll()
  }

  async function handleArchiveTask(taskId: number) {
    if (!confirm('Archive this task?')) return
    const supabase = createClient()
    await supabase.from('tasks').update({ is_archived: true }).eq('id', taskId)
    setSelectedTask(null)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  function startEditing(task: TaskWithRelations) {
    setEditForm({
      title: task.title,
      description: task.description || '',
      client_id: task.client_id?.toString() || '',
      assignee_id: task.assignee_id || '',
      start_date: task.start_date || '',
      due_date: task.due_date || '',
    })
    setEditing(true)
  }

  async function handleSaveEdit() {
    if (!selectedTask || !editForm.title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('tasks').update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      client_id: editForm.client_id ? parseInt(editForm.client_id) : null,
      assignee_id: editForm.assignee_id || null,
      start_date: editForm.start_date || null,
      due_date: editForm.due_date || null,
    }).eq('id', selectedTask.id)

    if (!error) {
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? {
        ...t,
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        client_id: editForm.client_id ? parseInt(editForm.client_id) : null,
        assignee_id: editForm.assignee_id || null,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        client: editForm.client_id ? clients.find(c => c.id === parseInt(editForm.client_id)) || null : null,
        assignee: editForm.assignee_id ? (() => { const e = employees.find(emp => emp.id === editForm.assignee_id); return e ? { id: e.id, first_name: e.first_name, last_name: e.last_name } : null })() : null,
      } : t))
      setSelectedTask(prev => prev && prev.id === selectedTask.id ? {
        ...prev,
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        client_id: editForm.client_id ? parseInt(editForm.client_id) : null,
        assignee_id: editForm.assignee_id || null,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        client: editForm.client_id ? clients.find(c => c.id === parseInt(editForm.client_id)) || null : null,
        assignee: editForm.assignee_id ? (() => { const e = employees.find(emp => emp.id === editForm.assignee_id); return e ? { id: e.id, first_name: e.first_name, last_name: e.last_name } : null })() : null,
      } : prev)
      setEditing(false)
    }
    setSaving(false)
  }

  async function handleDeleteTask(taskId: number) {
    if (!confirm('Permanently delete this task? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('task_comments').delete().eq('task_id', taskId)
    await supabase.from('tasks').delete().eq('id', taskId)
    setSelectedTask(null)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  function openTaskDetail(task: TaskWithRelations) {
    setSelectedTask(task)
    loadComments(task.id)
  }

  const filteredTasks = tasks.filter(t => {
    if (filterClient && t.client_id !== parseInt(filterClient)) return false
    if (filterAssignee && t.assignee_id !== filterAssignee) return false
    return true
  })

  function getColumnTasks(columnId: number) {
    return filteredTasks
      .filter(t => t.column_id === columnId)
      .sort((a, b) => a.position - b.position)
  }

  // Drag handlers
  function handleDragStart(e: React.DragEvent, taskId: number) {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent, columnId: number) {
    e.preventDefault()
    if (draggedTaskId !== null) {
      handleMoveTask(draggedTaskId, columnId, null)
      setDraggedTaskId(null)
    }
  }

  function handleTaskDrop(e: React.DragEvent, columnId: number, targetTaskId: number) {
    e.preventDefault()
    e.stopPropagation()
    if (draggedTaskId !== null && draggedTaskId !== targetTaskId) {
      handleMoveTask(draggedTaskId, columnId, targetTaskId)
      setDraggedTaskId(null)
    }
  }

  if (ctxLoading || loading) return <SkeletonPage />
  if (!board) return <div className="text-sm text-gray-500">Board not found.</div>

  return (
    <AnimatedPage className="space-y-4">
      <TaskSectionNav />

      <AnimatedSection>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-100">{board.name}</h1>
            {board.description && <p className="text-sm text-gray-500 mt-0.5">{board.description}</p>}
          </div>
        </div>
      </AnimatedSection>

      {/* Filters */}
      <AnimatedSection>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          options={[
            { value: '', label: 'All Clients' },
            ...clients.map(c => ({ value: String(c.id), label: c.name })),
          ]}
        />
        <Select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          options={[
            { value: '', label: 'All Assignees' },
            ...employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
          ]}
        />
        {(filterClient || filterAssignee) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterClient(''); setFilterAssignee('') }}>
            Clear
          </Button>
        )}
        <div className="ml-auto">
          <Button onClick={() => setShowCreate(true)}>Add Task</Button>
        </div>
      </div>
      </AnimatedSection>

      {/* Kanban Board */}
      <div className="flex flex-col md:flex-row gap-4 md:overflow-x-auto pb-4 md:max-h-[calc(100vh-220px)] md:min-h-[400px]">
        {columns.map((col) => {
          const colTasks = getColumnTasks(col.id)
          return (
            <div
              key={col.id}
              className="w-full md:flex-shrink-0 md:w-72 bg-surface-mid rounded-lg flex flex-col"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-300">{col.name}</h3>
                  <span className="text-xs text-gray-400 bg-surface-hover rounded-full px-1.5 py-0.5">
                    <CountUp value={colTasks.length} />
                  </span>
                  {(() => {
                    const overdueCount = colTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && !t.completed_at).length
                    return overdueCount > 0 ? (
                      <PulseBadge>
                        <span className="text-xs text-danger bg-danger/10 rounded-full px-1.5 py-0.5">
                          {overdueCount} overdue
                        </span>
                      </PulseBadge>
                    ) : null
                  })()}
                </div>
              </div>

              {/* Tasks */}
              <div className="p-2 space-y-2 min-h-[100px] flex-1 overflow-y-auto">
                {colTasks.map((task, cardIndex) => (
                  <KanbanCard key={task.id} index={cardIndex} isDragging={draggedTaskId === task.id}>
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleTaskDrop(e, col.id, task.id)}
                      onClick={() => openTaskDetail(task)}
                      className="bg-surface-card rounded-md border border-surface-border p-3 cursor-pointer hover:border-brand-50 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-1.5">
                        <CompletionCheck show={col.name === 'Done' || col.name === 'Approved'} />
                        <p className="text-sm font-medium text-gray-100 leading-tight">{task.title}</p>
                      </div>
                      {task.client && (
                        <p className="text-xs text-gray-500 mt-1">{task.client.name}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        {task.assignee ? (
                          <span className="text-xs text-gray-400">
                            {task.assignee.first_name} {task.assignee.last_name[0]}.
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">Unassigned</span>
                        )}
                        {task.due_date && (
                          <span className={`text-xs ${new Date(task.due_date) < new Date() && !task.completed_at ? 'text-danger' : 'text-gray-400'}`}>
                            {formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </KanbanCard>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Create Task Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Task">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            id="task-title"
            label="Title"
            value={newTask.title}
            onChange={(e) => setNewTask(f => ({ ...f, title: e.target.value }))}
            required
          />
          <Textarea
            id="task-desc"
            label="Description"
            value={newTask.description}
            onChange={(e) => setNewTask(f => ({ ...f, description: e.target.value }))}
            rows={3}
          />
          <Select
            id="task-client"
            label="Client"
            value={newTask.client_id}
            onChange={(e) => setNewTask(f => ({ ...f, client_id: e.target.value }))}
            options={[
              { value: '', label: 'No client' },
              ...clients.map(c => ({ value: String(c.id), label: c.name })),
            ]}
          />
          <Select
            id="task-assignee"
            label="Assignee"
            value={newTask.assignee_id}
            onChange={(e) => setNewTask(f => ({ ...f, assignee_id: e.target.value }))}
            options={[
              { value: '', label: 'Unassigned' },
              ...employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
            ]}
          />
          <Select
            id="task-column"
            label="Current Stage"
            value={newTask.column_id}
            onChange={(e) => setNewTask(f => ({ ...f, column_id: e.target.value }))}
            options={[
              { value: '', label: 'Select stage' },
              ...columns.map(c => ({ value: String(c.id), label: c.name })),
            ]}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="task-start"
              label="Start Date"
              type="date"
              value={newTask.start_date}
              onChange={(e) => setNewTask(f => ({ ...f, start_date: e.target.value }))}
            />
            <Input
              id="task-due"
              label="Due Date"
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask(f => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create Task'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        open={!!selectedTask}
        onClose={() => { setSelectedTask(null); setEditing(false) }}
        title={editing ? 'Edit Task' : selectedTask?.title}
        className="max-w-2xl"
      >
        {selectedTask && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {editing ? (
              <div className="space-y-3">
                <Input
                  id="edit-title"
                  label="Title"
                  value={editForm.title}
                  onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
                <Textarea
                  id="edit-desc"
                  label="Description"
                  value={editForm.description}
                  onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    id="edit-client"
                    label="Client"
                    value={editForm.client_id}
                    onChange={(e) => setEditForm(f => ({ ...f, client_id: e.target.value }))}
                    placeholder="No client"
                    options={clients.map(c => ({ value: c.id.toString(), label: c.name }))}
                  />
                  <Select
                    id="edit-assignee"
                    label="Assignee"
                    value={editForm.assignee_id}
                    onChange={(e) => setEditForm(f => ({ ...f, assignee_id: e.target.value }))}
                    placeholder="Unassigned"
                    options={employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
                  />
                  <Input
                    id="edit-start"
                    label="Start Date"
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                  <Input
                    id="edit-due"
                    label="Due Date"
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleSaveEdit} disabled={saving || !editForm.title.trim()}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Task info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Client:</span>{' '}
                    <span className="text-gray-100">{selectedTask.client?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Assignee:</span>{' '}
                    <span className="text-gray-100">
                      {selectedTask.assignee ? `${selectedTask.assignee.first_name} ${selectedTask.assignee.last_name}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Owner:</span>{' '}
                    <span className="text-gray-100">
                      {selectedTask.owner ? `${selectedTask.owner.first_name} ${selectedTask.owner.last_name}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Column:</span>{' '}
                    <span className="text-gray-100">{columns.find(c => c.id === selectedTask.column_id)?.name}</span>
                  </div>
                  {selectedTask.start_date && (
                    <div>
                      <span className="text-gray-500">Start:</span>{' '}
                      <span className="text-gray-100">{formatDate(selectedTask.start_date)}</span>
                    </div>
                  )}
                  {selectedTask.due_date && (
                    <div>
                      <span className="text-gray-500">Due:</span>{' '}
                      <span className="text-gray-100">{formatDate(selectedTask.due_date)}</span>
                    </div>
                  )}
                </div>

                {selectedTask.description && (
                  <div className="border-t border-surface-border pt-3">
                    <p className="text-sm text-gray-400 whitespace-pre-wrap">{selectedTask.description}</p>
                  </div>
                )}

                {/* Edit button */}
                <div className="border-t border-surface-border pt-3">
                  <Button size="sm" variant="ghost" onClick={() => startEditing(selectedTask)}>
                    Edit Task
                  </Button>
                </div>
              </>
            )}

            {/* Move task */}
            <div className="border-t border-surface-border pt-3">
              <label className="text-sm text-gray-500 block mb-1">Move to column</label>
              <div className="flex flex-wrap gap-1">
                {columns.map(col => (
                  <button
                    key={col.id}
                    onClick={() => {
                      handleMoveTask(selectedTask.id, col.id)
                    }}
                    className={`text-xs px-2 py-1 rounded ${
                      col.id === selectedTask.column_id
                        ? 'bg-brand-100 text-brand-700 font-medium'
                        : 'bg-surface-hover text-gray-400 hover:bg-surface-border'
                    }`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div className="border-t border-surface-border pt-3">
              <h4 className="text-sm font-medium text-gray-100 mb-2">Comments</h4>
              {comments.length > 0 ? (
                <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
                  {comments.map(c => (
                    <div key={c.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-100">
                          {c.user ? `${c.user.first_name} ${c.user.last_name}` : 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                      </div>
                      <p className="text-gray-400 mt-0.5 whitespace-pre-wrap">{c.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-3">No comments yet.</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddComment()
                    }
                  }}
                  placeholder="Add a comment..."
                  className="flex-1 text-sm border border-surface-border bg-surface-mid text-gray-100 rounded-md px-3 py-1.5 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand placeholder:text-gray-500"
                />
                <Button size="sm" onClick={handleAddComment} disabled={commenting || !newComment.trim()}>
                  Post
                </Button>
              </div>
            </div>

            {/* Archive & Delete */}
            {canManageTeam && (
              <div className="border-t border-surface-border pt-3 flex gap-2">
                <Button size="sm" variant="danger" onClick={() => handleArchiveTask(selectedTask.id)}>
                  Archive Task
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDeleteTask(selectedTask.id)}>
                  Delete Task
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </Modal>
    </AnimatedPage>
  )
}
