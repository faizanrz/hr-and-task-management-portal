'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Button, Badge, Card, CardContent, CardHeader, Input, Select, Modal, AnimatedPage, AnimatedSection, SkeletonPage } from '@/components/ui'
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '@/components/ui'
import { formatPKR } from '@/lib/utils'
import type { PayrollRecord, Employee } from '@/types'

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
]

export default function PayrollPage() {
  const router = useRouter()
  const { employee, isAdmin, isManager, isTeamLead, canManageTeam, loading: ctxLoading } = useEmployee()
  const [records, setRecords] = useState<(PayrollRecord & { employee?: { first_name: string; last_name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const isCoFounder = employee?.department === 'co-founder'
  const canViewTeamPayroll = isAdmin || isCoFounder

  const [createForm, setCreateForm] = useState({
    employee_id: '',
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    basic_salary: '',
    allowances: '0',
    deductions: '0',
    bonus: '0',
    eobi_deduction: '0',
    tax_deduction: '0',
    notes: '',
  })

  useEffect(() => {
    if (!employee) return
    loadData()
    if (canViewTeamPayroll) {
      const supabase = createClient()
      const query = supabase.from('employees').select('*').eq('is_active', true).order('first_name')
      query
        .then(({ data }) => { if (data) setEmployees(data as Employee[]) })
    }
  }, [canViewTeamPayroll, employee, isAdmin, isManager, isTeamLead])

  async function loadData() {
    const supabase = createClient()
    let query = supabase
      .from('payroll_records')
      .select('*, employee:employee_id(first_name, last_name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (!canViewTeamPayroll) {
      query = query.eq('employee_id', employee!.id)
    }

    const { data } = await query
    if (data) setRecords(data as any)
    setLoading(false)
  }

  async function handleCreateRecord(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const supabase = createClient()

    const { error } = await supabase.from('payroll_records').insert({
      employee_id: createForm.employee_id,
      month: parseInt(createForm.month),
      year: parseInt(createForm.year),
      basic_salary: parseFloat(createForm.basic_salary),
      allowances: parseFloat(createForm.allowances) || 0,
      deductions: parseFloat(createForm.deductions) || 0,
      bonus: parseFloat(createForm.bonus) || 0,
      eobi_deduction: parseFloat(createForm.eobi_deduction) || 0,
      tax_deduction: parseFloat(createForm.tax_deduction) || 0,
      notes: createForm.notes || null,
    })

    if (!error) {
      setShowCreate(false)
      setCreateForm({
        employee_id: '', month: String(new Date().getMonth() + 1),
        year: String(new Date().getFullYear()), basic_salary: '',
        allowances: '0', deductions: '0', bonus: '0',
        eobi_deduction: '0', tax_deduction: '0', notes: '',
      })
      loadData()
    }
    setCreating(false)
  }

  const filtered = records.filter((r) => {
    if (filterMonth && r.month !== parseInt(filterMonth)) return false
    if (filterYear && r.year !== parseInt(filterYear)) return false
    if (filterStatus && r.payment_status !== filterStatus) return false
    return true
  })

  const monthName = (m: number) => MONTHS[m - 1]?.label || ''

  if (ctxLoading || loading) return <SkeletonPage />

  return (
    <AnimatedPage className="space-y-6">
      <AnimatedSection>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-100">Payroll</h1>
            <p className="text-sm text-gray-500 mt-1">Monthly salary records and payslips</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowCreate(true)}>Create Record</Button>
          )}
        </div>
      </AnimatedSection>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          options={[{ value: '', label: 'All Months' }, ...MONTHS]}
        />
        <Input
          type="number"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          placeholder="Year"
          className="w-24"
        />
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
          ]}
        />
      </div>

      {/* Records Table */}
      <AnimatedSection>
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              {canViewTeamPayroll && <TableHeader>Employee</TableHeader>}
              <TableHeader>Period</TableHeader>
              <TableHeader>Basic</TableHeader>
              <TableHeader>Net Salary</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader></TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                {canViewTeamPayroll && (
                  <TableCell>
                    {r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : '—'}
                  </TableCell>
                )}
                <TableCell>{monthName(r.month)} {r.year}</TableCell>
                <TableCell>{formatPKR(r.basic_salary)}</TableCell>
                <TableCell className="font-medium">{formatPKR(r.net_salary)}</TableCell>
                <TableCell>
                  <Badge variant={r.payment_status === 'paid' ? 'success' : 'warning'}>
                    {r.payment_status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {canViewTeamPayroll || r.employee_id === employee?.id ? (
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/payroll/${r.id}`)}>
                      View
                    </Button>
                  ) : (
                    <span className="text-xs text-gray-400">Summary only</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell className="text-center text-gray-400 py-8">
                  No payroll records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      </AnimatedSection>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Payroll Record" className="max-w-xl">
        <form onSubmit={handleCreateRecord} className="space-y-4">
          <Select
            id="emp"
            label="Employee"
            value={createForm.employee_id}
            onChange={(e) => {
              const selectedEmployee = employees.find((item) => item.id === e.target.value)
              setCreateForm((f) => ({
                ...f,
                employee_id: e.target.value,
                basic_salary: selectedEmployee?.basic_salary ? String(selectedEmployee.basic_salary) : f.basic_salary,
              }))
            }}
            options={[
              { value: '', label: 'Select employee' },
              ...employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
            ]}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="month"
              label="Month"
              value={createForm.month}
              onChange={(e) => setCreateForm((f) => ({ ...f, month: e.target.value }))}
              options={MONTHS}
            />
            <Input
              id="year"
              label="Year"
              type="number"
              value={createForm.year}
              onChange={(e) => setCreateForm((f) => ({ ...f, year: e.target.value }))}
            />
          </div>
          <Input
            id="basic"
            label="Basic Salary (PKR)"
            type="number"
            value={createForm.basic_salary}
            onChange={(e) => setCreateForm((f) => ({ ...f, basic_salary: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="allowances"
              label="Allowances"
              type="number"
              value={createForm.allowances}
              onChange={(e) => setCreateForm((f) => ({ ...f, allowances: e.target.value }))}
            />
            <Input
              id="bonus"
              label="Bonus"
              type="number"
              value={createForm.bonus}
              onChange={(e) => setCreateForm((f) => ({ ...f, bonus: e.target.value }))}
            />
            <Input
              id="deductions"
              label="Deductions"
              type="number"
              value={createForm.deductions}
              onChange={(e) => setCreateForm((f) => ({ ...f, deductions: e.target.value }))}
            />
            <Input
              id="eobi"
              label="EOBI"
              type="number"
              value={createForm.eobi_deduction}
              onChange={(e) => setCreateForm((f) => ({ ...f, eobi_deduction: e.target.value }))}
            />
            <Input
              id="tax"
              label="Tax"
              type="number"
              value={createForm.tax_deduction}
              onChange={(e) => setCreateForm((f) => ({ ...f, tax_deduction: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </AnimatedPage>
  )
}
