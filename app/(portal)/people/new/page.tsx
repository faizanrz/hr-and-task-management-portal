'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Button, Card, CardContent, CardHeader, Input, Select, Textarea } from '@/components/ui'
import { DEPARTMENTS, ROLES, EMPLOYMENT_TYPES } from '@/lib/constants'

export default function NewEmployeePage() {
  const router = useRouter()
  const { isAdmin, loading: ctxLoading } = useEmployee()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'staff',
    department: '',
    job_title: '',
    employment_type: 'full_time',
    join_date: '',
    basic_salary: '',
    cnic: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const supabase = createClient()

      // Create auth user via API route
      const res = await fetch('/api/employees/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to create employee')

      router.push(`/people/${result.id}`)
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (ctxLoading) return <div className="text-sm text-gray-400">Loading...</div>

  if (!isAdmin) {
    return (
      <div className="text-sm text-gray-500">
        You do not have permission to add employees.
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-100">Add Employee</h1>
        <p className="text-sm text-gray-500 mt-1">Create a new employee record</p>
      </div>

      {error && (
        <div className="bg-danger-50 text-danger text-sm px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <h2 className="text-base font-medium text-gray-100">Basic Information</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="first_name"
                label="First Name"
                value={form.first_name}
                onChange={(e) => update('first_name', e.target.value)}
                required
              />
              <Input
                id="last_name"
                label="Last Name"
                value={form.last_name}
                onChange={(e) => update('last_name', e.target.value)}
                required
              />
              <Input
                id="email"
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
              />
              <Input
                id="phone"
                label="Phone"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <h2 className="text-base font-medium text-gray-100">Employment Details</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                id="role"
                label="Role"
                value={form.role}
                onChange={(e) => update('role', e.target.value)}
                options={ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
              />
              <Select
                id="department"
                label="Department"
                value={form.department}
                onChange={(e) => update('department', e.target.value)}
                options={[
                  { value: '', label: 'Select department' },
                  ...DEPARTMENTS.map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) })),
                ]}
              />
              <Input
                id="job_title"
                label="Job Title"
                value={form.job_title}
                onChange={(e) => update('job_title', e.target.value)}
                placeholder="e.g. Digital Marketing Executive"
              />
              <Select
                id="employment_type"
                label="Employment Type"
                value={form.employment_type}
                onChange={(e) => update('employment_type', e.target.value)}
                options={EMPLOYMENT_TYPES.map((t) => ({
                  value: t,
                  label: t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                }))}
              />
              <Input
                id="join_date"
                label="Join Date"
                type="date"
                value={form.join_date}
                onChange={(e) => update('join_date', e.target.value)}
              />
              <Input
                id="basic_salary"
                label="Basic Salary (PKR)"
                type="number"
                value={form.basic_salary}
                onChange={(e) => update('basic_salary', e.target.value)}
                placeholder="e.g. 85000"
              />
              <Input
                id="cnic"
                label="CNIC"
                value={form.cnic}
                onChange={(e) => update('cnic', e.target.value)}
                placeholder="XXXXX-XXXXXXX-X"
                maxLength={15}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <h2 className="text-base font-medium text-gray-100">Emergency Contact</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="emergency_contact_name"
                label="Contact Name"
                value={form.emergency_contact_name}
                onChange={(e) => update('emergency_contact_name', e.target.value)}
              />
              <Input
                id="emergency_contact_phone"
                label="Contact Phone"
                value={form.emergency_contact_phone}
                onChange={(e) => update('emergency_contact_phone', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create Employee'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
