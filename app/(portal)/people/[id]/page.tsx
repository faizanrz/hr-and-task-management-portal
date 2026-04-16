'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Button, Badge, Card, CardContent, CardHeader, Input, Select, Textarea } from '@/components/ui'
import { DEPARTMENTS, ROLES, EMPLOYMENT_TYPES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { Employee, ProfileEditRequest } from '@/types'

const EDITABLE_FIELDS: Array<keyof Employee> = [
  'first_name',
  'last_name',
  'phone',
  'role',
  'department',
  'job_title',
  'employment_type',
  'join_date',
  'basic_salary',
  'cnic',
  'emergency_contact_name',
  'emergency_contact_phone',
]

export default function EmployeeProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { employee: currentUser, isAdmin, canEditEmployees } = useEmployee()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [requests, setRequests] = useState<ProfileEditRequest[]>([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Employee>>({})
  const [requestNote, setRequestNote] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const supabase = createClient()
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('id', params.id)
        .single()

      if (data) {
        setEmployee(data as Employee)
        setForm(data as Employee)
      }

      const { data: requestData } = await supabase
        .from('profile_edit_requests')
        .select('*')
        .eq('employee_id', params.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (requestData) {
        setRequests(requestData as ProfileEditRequest[])
      }
      setLoading(false)
    }
    fetch()
  }, [params.id])

  function update(field: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleRequestStatus(requestId: string, status: 'approved' | 'rejected', changes?: Record<string, unknown>) {
    if (!currentUser || !canEditEmployees) return
    const supabase = createClient()

    // If approving, apply the requested changes to the employee record
    if (status === 'approved' && changes && Object.keys(changes).length > 0) {
      const { error: updateError } = await supabase
        .from('employees')
        .update(changes)
        .eq('id', params.id)

      if (updateError) {
        alert('Failed to apply changes: ' + updateError.message)
        return
      }

      // Refresh employee data
      const { data: refreshed } = await supabase.from('employees').select('*').eq('id', params.id).single()
      if (refreshed) {
        setEmployee(refreshed as Employee)
        setForm(refreshed as Employee)
      }
    }

    await supabase
      .from('profile_edit_requests')
      .update({
        status,
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    const { data: requestData } = await supabase
      .from('profile_edit_requests')
      .select('*')
      .eq('employee_id', params.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (requestData) {
      setRequests(requestData as ProfileEditRequest[])
    }
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    const changes = EDITABLE_FIELDS.reduce<Record<string, unknown>>((acc, field) => {
      const previous = employee?.[field]
      const next = form[field]

      if ((previous ?? null) !== (next ?? null)) {
        acc[field] = next ?? null
      }

      return acc
    }, {})

    if (Object.keys(changes).length === 0) {
      setEditing(false)
      setSaving(false)
      return
    }

    if (canEditEmployees) {
      // Managers can edit basic fields; only admins can change role, salary
      const updatePayload: Record<string, unknown> = {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        department: form.department,
        job_title: form.job_title,
        employment_type: form.employment_type,
        join_date: form.join_date,
        cnic: form.cnic,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        updated_at: new Date().toISOString(),
      }

      // Only admin can update role and salary
      if (isAdmin) {
        updatePayload.role = form.role
        updatePayload.basic_salary = form.basic_salary ?? null
      }

      const salaryChanged = isAdmin && employee?.basic_salary !== (form.basic_salary ?? null)
      const { error } = await supabase
        .from('employees')
        .update(updatePayload)
        .eq('id', params.id)

      if (!error) {
        if (salaryChanged && currentUser && form.basic_salary) {
          await supabase.from('salary_history').insert({
            employee_id: params.id,
            effective_date: new Date().toISOString().split('T')[0],
            previous_salary: employee?.basic_salary ?? null,
            new_salary: form.basic_salary,
            change_type: (employee?.basic_salary || 0) <= Number(form.basic_salary) ? 'increment' : 'decrement',
            reason: 'Updated from employee profile',
            created_by: currentUser.id,
          })
        }

        setEmployee({ ...employee, ...form } as Employee)
        setEditing(false)
      }
    } else {
      const res = await fetch('/api/profile-edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: params.id,
          requested_changes: changes,
          request_note: requestNote,
        }),
      })

      if (res.ok) {
        const { data: requestData } = await supabase
          .from('profile_edit_requests')
          .select('*')
          .eq('employee_id', params.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (requestData) {
          setRequests(requestData as ProfileEditRequest[])
        }

        setEditing(false)
        setRequestNote('')
        setForm(employee as Employee)
      }
    }

    setSaving(false)
  }

  async function handleDeactivate() {
    if (!confirm('Are you sure you want to deactivate this employee?')) return
    const supabase = createClient()
    await supabase.from('employees').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', params.id)
    setEmployee((prev) => prev ? { ...prev, is_active: false } : null)
  }

  async function handleReactivate() {
    const supabase = createClient()
    await supabase.from('employees').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', params.id)
    setEmployee((prev) => prev ? { ...prev, is_active: true } : null)
  }

  if (loading) return <div className="text-sm text-gray-400">Loading...</div>
  if (!employee) return <div className="text-sm text-gray-500">Employee not found.</div>

  const isOwnProfile = currentUser?.id === employee.id

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-medium text-gray-100">
              {employee.first_name} {employee.last_name}
            </h1>
            <Badge variant={employee.is_active ? 'success' : 'danger'}>
              {employee.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {employee.job_title && (
            <p className="text-sm text-gray-500 mt-1">{employee.job_title}</p>
          )}
        </div>
        <div className="flex gap-2">
          {!editing && (
            <>
              {(canEditEmployees || isOwnProfile) && (
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  {canEditEmployees ? 'Edit' : 'Request Edit'}
                </Button>
              )}
              {isAdmin && (
                employee.is_active ? (
                  <Button size="sm" variant="danger" onClick={handleDeactivate}>
                    Deactivate
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleReactivate}>
                    Reactivate
                  </Button>
                )
              )}
            </>
          )}
          {editing && (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (canEditEmployees ? 'Saving...' : 'Submitting...') : (canEditEmployees ? 'Save' : 'Submit Request')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setEditing(false); setForm(employee); setRequestNote('') }}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-medium text-gray-100">Basic Information</h2>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input id="first_name" label="First Name" value={form.first_name || ''} onChange={(e) => update('first_name', e.target.value)} />
              <Input id="last_name" label="Last Name" value={form.last_name || ''} onChange={(e) => update('last_name', e.target.value)} />
              <Input id="email" label="Email" value={employee.email} disabled />
              <Input id="phone" label="Phone" value={form.phone || ''} onChange={(e) => update('phone', e.target.value)} />
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Full Name</dt>
                <dd className="text-sm text-gray-100 mt-0.5">{employee.first_name} {employee.last_name}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="text-sm text-gray-100 mt-0.5">{employee.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="text-sm text-gray-100 mt-0.5">{employee.phone || '—'}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <h2 className="text-base font-medium text-gray-100">Employment Details</h2>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isAdmin && (
                <Select
                  id="role"
                  label="Role"
                  value={form.role || 'staff'}
                  onChange={(e) => update('role', e.target.value)}
                  options={ROLES.map((r) => ({ value: r, label: r.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))}
                />
              )}
              <Select
                id="department"
                label="Department"
                value={form.department || ''}
                onChange={(e) => update('department', e.target.value)}
                options={[
                  { value: '', label: 'Select department' },
                  ...DEPARTMENTS.map((d) => ({ value: d, label: d.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) })),
                ]}
              />
              <Input id="job_title" label="Job Title" value={form.job_title || ''} onChange={(e) => update('job_title', e.target.value)} />
              <Select
                id="employment_type"
                label="Employment Type"
                value={form.employment_type || 'full_time'}
                onChange={(e) => update('employment_type', e.target.value)}
                options={EMPLOYMENT_TYPES.map((t) => ({
                  value: t,
                  label: t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                }))}
              />
              <Input id="join_date" label="Join Date" type="date" value={form.join_date || ''} onChange={(e) => update('join_date', e.target.value)} />
              {isAdmin && (
                <Input
                  id="basic_salary"
                  label="Basic Salary (PKR)"
                  type="number"
                  value={form.basic_salary ?? ''}
                  onChange={(e) => update('basic_salary', e.target.value ? Number(e.target.value) : '')}
                />
              )}
              <Input id="cnic" label="CNIC" value={form.cnic || ''} onChange={(e) => update('cnic', e.target.value)} />
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Role</dt>
                <dd className="text-sm text-gray-100 mt-0.5 capitalize">{employee.role}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Department</dt>
                <dd className="text-sm text-gray-100 mt-0.5 capitalize">{employee.department || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Job Title</dt>
                <dd className="text-sm text-gray-100 mt-0.5">{employee.job_title || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Employment Type</dt>
                <dd className="text-sm text-gray-100 mt-0.5 capitalize">{employee.employment_type?.replace('_', ' ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Join Date</dt>
                <dd className="text-sm text-gray-100 mt-0.5">{employee.join_date ? formatDate(employee.join_date) : '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Basic Salary</dt>
                <dd className="text-sm text-gray-100 mt-0.5">
                  {canEditEmployees || isOwnProfile
                    ? (employee.basic_salary !== null ? `PKR ${employee.basic_salary.toLocaleString('en-PK')}` : '—')
                    : '••••••'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">CNIC</dt>
                <dd className="text-sm text-gray-100 mt-0.5">{canEditEmployees || isOwnProfile ? (employee.cnic || '—') : '••••••'}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <h2 className="text-base font-medium text-gray-100">Emergency Contact</h2>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input id="ecn" label="Contact Name" value={form.emergency_contact_name || ''} onChange={(e) => update('emergency_contact_name', e.target.value)} />
              <Input id="ecp" label="Contact Phone" value={form.emergency_contact_phone || ''} onChange={(e) => update('emergency_contact_phone', e.target.value)} />
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="text-sm text-gray-100 mt-0.5">{employee.emergency_contact_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="text-sm text-gray-100 mt-0.5">{employee.emergency_contact_phone || '—'}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      {editing && !canEditEmployees && (
        <Card className="mt-4">
          <CardHeader>
            <h2 className="text-base font-medium text-gray-100">Request Note</h2>
          </CardHeader>
          <CardContent>
            <Textarea
              id="request-note"
              label="Optional note for admins"
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder="Explain what changed or why this update is needed."
              rows={3}
            />
          </CardContent>
        </Card>
      )}

      {requests.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <h2 className="text-base font-medium text-gray-100">Recent Edit Requests</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {requests.map((request) => {
                const changes = (request.requested_changes || {}) as Record<string, unknown>
                return (
                  <div key={request.id} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-gray-100">{new Date(request.created_at).toLocaleDateString('en-PK')}</p>
                        {request.request_note && (
                          <p className="text-xs text-gray-500 mt-0.5">{request.request_note}</p>
                        )}
                      </div>
                      <Badge variant={request.status === 'pending' ? 'warning' : request.status === 'rejected' ? 'danger' : 'success'}>
                        {request.status}
                      </Badge>
                    </div>

                    {/* Show requested changes */}
                    {Object.keys(changes).length > 0 && (
                      <div className="mt-2 bg-surface-mid rounded-md p-2 space-y-1">
                        {Object.entries(changes).map(([field, value]) => (
                          <div key={field} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500 capitalize">{field.replace(/_/g, ' ')}:</span>
                            <span className="text-gray-100">{value === null || value === '' ? '—' : String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {canEditEmployees && request.status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={() => handleRequestStatus(request.id, 'approved', changes)}>
                          Approve & Apply
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleRequestStatus(request.id, 'rejected')}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          &larr; Back to People
        </Button>
      </div>
    </div>
  )
}
