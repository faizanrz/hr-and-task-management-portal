'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Badge, Button, Card, CardContent, CardHeader, Input, Modal, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui'
import { BOARD_COLUMN_ORDER } from '@/lib/constants'
import type { Board, Client, Employee, ProfileEditRequest } from '@/types'

type AdminTab = 'clients' | 'boards' | 'team' | 'requests'

const adminTabs: { id: AdminTab; label: string }[] = [
  { id: 'clients', label: 'Clients' },
  { id: 'boards', label: 'Boards' },
  { id: 'team', label: 'Team' },
  { id: 'requests', label: 'Requests' },
]

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function TaskAdminPanel() {
  const { employee, isAdmin, loading: ctxLoading } = useEmployee()
  const [tab, setTab] = useState<AdminTab>('clients')
  const [clients, setClients] = useState<Client[]>([])
  const [boards, setBoards] = useState<Board[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [requests, setRequests] = useState<(ProfileEditRequest & { employee?: { first_name: string; last_name: string; email: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showBoardModal, setShowBoardModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editingBoard, setEditingBoard] = useState<Board | null>(null)
  const [saving, setSaving] = useState(false)
  const [clientForm, setClientForm] = useState({ name: '', description: '', is_active: 'true' })
  const [boardForm, setBoardForm] = useState({ name: '', description: '' })

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }

    load()
  }, [isAdmin])

  async function load() {
    const supabase = createClient()
    const [{ data: clientData }, { data: boardData }, { data: employeeData }, { data: requestData }] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('boards').select('*').order('created_at'),
      supabase.from('employees').select('*').order('first_name'),
      supabase
        .from('profile_edit_requests')
        .select('*, employee:employee_id(first_name, last_name, email)')
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    setClients((clientData || []) as Client[])
    setBoards((boardData || []) as Board[])
    setEmployees((employeeData || []) as Employee[])
    setRequests((requestData || []) as any)
    setLoading(false)
  }

  function openClientModal(client?: Client) {
    if (client) {
      setEditingClient(client)
      setClientForm({
        name: client.name,
        description: client.description || '',
        is_active: String(client.is_active),
      })
    } else {
      setEditingClient(null)
      setClientForm({ name: '', description: '', is_active: 'true' })
    }
    setShowClientModal(true)
  }

  function openBoardModal(board?: Board) {
    if (board) {
      setEditingBoard(board)
      setBoardForm({
        name: board.name,
        description: board.description || '',
      })
    } else {
      setEditingBoard(null)
      setBoardForm({ name: '', description: '' })
    }
    setShowBoardModal(true)
  }

  async function handleSaveClient(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: clientForm.name.trim(),
      description: clientForm.description.trim() || null,
      is_active: clientForm.is_active === 'true',
      updated_at: new Date().toISOString(),
    }

    if (editingClient) {
      await supabase.from('clients').update(payload).eq('id', editingClient.id)
    } else {
      await supabase.from('clients').insert({ ...payload, created_by: employee?.id })
    }

    setShowClientModal(false)
    setSaving(false)
    load()
  }

  async function handleSaveBoard(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: boardForm.name.trim(),
      description: boardForm.description.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (editingBoard) {
      await supabase.from('boards').update(payload).eq('id', editingBoard.id)
    } else {
      const { data: newBoard } = await supabase
        .from('boards')
        .insert({ ...payload, created_by: employee?.id })
        .select('id')
        .single()

      if (newBoard) {
        const columns = BOARD_COLUMN_ORDER.map((name, index) => ({
          board_id: newBoard.id,
          name,
          position: index,
        }))
        await supabase.from('board_columns').insert(columns)
      }
    }

    setShowBoardModal(false)
    setSaving(false)
    load()
  }

  async function handleDeleteClient(client: Client) {
    if (!confirm(`Delete ${client.name}? This should only be used for unused client records.`)) return
    const supabase = createClient()
    await supabase.from('clients').delete().eq('id', client.id)
    load()
  }

  async function handleDeleteBoard(board: Board) {
    if (!confirm(`Delete ${board.name}? This should only be used for unused boards.`)) return
    const supabase = createClient()
    await supabase.from('boards').delete().eq('id', board.id)
    load()
  }

  if (ctxLoading || loading) {
    return <div className="text-sm text-gray-400">Loading admin...</div>
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-gray-500">Task admin is only available to admins.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {adminTabs.map((item) => {
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-brand text-white' : 'border border-surface-border bg-surface-card text-gray-400 hover:bg-surface-hover'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {tab === 'clients' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-gray-100">Client Management</h2>
              <p className="mt-1 text-sm text-gray-500">Create and manage task clients.</p>
            </div>
            <Button size="sm" onClick={() => openClientModal()}>New Client</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>ID</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Description</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Created</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>{client.id}</TableCell>
                    <TableCell className="font-medium text-gray-100">{client.name}</TableCell>
                    <TableCell>{client.description || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={client.is_active ? 'success' : 'danger'}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateLabel(client.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openClientModal(client)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteClient(client)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'boards' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-gray-100">Board Management</h2>
              <p className="mt-1 text-sm text-gray-500">Create and manage task boards. New boards get the standard column workflow.</p>
            </div>
            <Button size="sm" onClick={() => openBoardModal()}>New Board</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>ID</TableHeader>
                  <TableHeader>Name</TableHeader>
                  <TableHeader>Description</TableHeader>
                  <TableHeader>Created</TableHeader>
                  <TableHeader>Updated</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {boards.map((board) => (
                  <TableRow key={board.id}>
                    <TableCell>{board.id}</TableCell>
                    <TableCell className="font-medium text-gray-100">{board.name}</TableCell>
                    <TableCell>{board.description || '—'}</TableCell>
                    <TableCell>{formatDateLabel(board.created_at)}</TableCell>
                    <TableCell>{formatDateLabel(board.updated_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openBoardModal(board)}>Edit</Button>
                        <Link href={`/tasks/${board.id}`}>
                          <Button size="sm" variant="ghost">Open</Button>
                        </Link>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteBoard(board)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'team' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-gray-100">Team Directory for Tasks</h2>
              <p className="mt-1 text-sm text-gray-500">Quick access to the people who show up in task assignment and reporting.</p>
            </div>
            <Link href="/people">
              <Button variant="secondary" size="sm">Open People</Button>
            </Link>
          </CardHeader>
          <CardContent>
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
                {employees.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium text-gray-100">
                      {member.first_name} {member.last_name}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell className="capitalize">{member.department || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'admin' ? 'default' : member.role === 'manager' ? 'warning' : 'neutral'}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.is_active ? 'success' : 'danger'}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'requests' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent>
                <p className="text-sm text-gray-500">Pending Profile Requests</p>
                <p className="mt-1 text-2xl font-semibold text-gray-100">
                  {requests.filter((request) => request.status === 'pending').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-gray-500">Team Members</p>
                <p className="mt-1 text-2xl font-semibold text-gray-100">{employees.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-gray-500">Admin Utilities</p>
                <p className="mt-1 text-sm text-gray-400">
                  Password reset actions live in Supabase Auth; profile requests live in the People area.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-gray-100">Recent Profile Edit Requests</h2>
                <p className="mt-1 text-sm text-gray-500">Task-side shortcut into the broader admin workflow.</p>
              </div>
              <Link href="/people">
                <Button variant="secondary" size="sm">Open People Requests</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Employee</TableHeader>
                    <TableHeader>Email</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Requested</TableHeader>
                    <TableHeader>Note</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow>
                      <TableCell className="py-6 text-center text-gray-400" colSpan={5}>
                        No profile edit requests found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium text-gray-100">
                          {request.employee ? `${request.employee.first_name} ${request.employee.last_name}` : 'Employee'}
                        </TableCell>
                        <TableCell>{request.employee?.email || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={request.status === 'pending' ? 'warning' : request.status === 'reviewed' ? 'success' : 'neutral'}>
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDateLabel(request.created_at)}</TableCell>
                        <TableCell>{request.request_note || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <Modal
        open={showClientModal}
        onClose={() => setShowClientModal(false)}
        title={editingClient ? `Edit ${editingClient.name}` : 'New Client'}
      >
        <form onSubmit={handleSaveClient} className="space-y-4">
          <Input
            id="client-name"
            label="Client Name"
            value={clientForm.name}
            onChange={(event) => setClientForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <Textarea
            id="client-description"
            label="Description"
            rows={3}
            value={clientForm.description}
            onChange={(event) => setClientForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <Select
            id="client-status"
            label="Status"
            value={clientForm.is_active}
            onChange={(event) => setClientForm((prev) => ({ ...prev, is_active: event.target.value }))}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingClient ? 'Save Changes' : 'Create Client'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowClientModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showBoardModal}
        onClose={() => setShowBoardModal(false)}
        title={editingBoard ? `Edit ${editingBoard.name}` : 'New Board'}
      >
        <form onSubmit={handleSaveBoard} className="space-y-4">
          <Input
            id="board-name"
            label="Board Name"
            value={boardForm.name}
            onChange={(event) => setBoardForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <Textarea
            id="board-description"
            label="Description"
            rows={3}
            value={boardForm.description}
            onChange={(event) => setBoardForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          {!editingBoard && (
            <p className="text-xs text-gray-500">
              The standard columns ({BOARD_COLUMN_ORDER.join(', ')}) will be created automatically.
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingBoard ? 'Save Changes' : 'Create Board'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowBoardModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
