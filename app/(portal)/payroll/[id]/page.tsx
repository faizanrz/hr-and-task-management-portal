'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Button, Badge, Card, CardContent, CardHeader } from '@/components/ui'
import { formatPKR, formatDate } from '@/lib/utils'
import type { PayrollRecord, SalaryHistory, Employee } from '@/types'

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function PayslipDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { employee: currentUser, isAdmin } = useEmployee()
  const [record, setRecord] = useState<PayrollRecord | null>(null)
  const [emp, setEmp] = useState<Employee | null>(null)
  const [history, setHistory] = useState<SalaryHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    async function fetch() {
      const supabase = createClient()
      const { data: rec } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('id', params.id)
        .single()

      if (rec) {
        setRecord(rec as PayrollRecord)
        const { data: empData } = await supabase
          .from('employees')
          .select('*')
          .eq('id', (rec as PayrollRecord).employee_id)
          .single()
        if (empData) setEmp(empData as Employee)

        const { data: hist } = await supabase
          .from('salary_history')
          .select('*')
          .eq('employee_id', (rec as PayrollRecord).employee_id)
          .order('effective_date', { ascending: false })
          .limit(10)
        if (hist) setHistory(hist as SalaryHistory[])
      }
      setLoading(false)
    }
    fetch()
  }, [params.id])

  async function handleMarkPaid() {
    if (!record) return
    setMarking(true)
    const supabase = createClient()
    await supabase
      .from('payroll_records')
      .update({ payment_status: 'paid', payment_date: new Date().toISOString().split('T')[0] })
      .eq('id', record.id)
    setRecord((prev) => prev ? { ...prev, payment_status: 'paid', payment_date: new Date().toISOString().split('T')[0] } : null)
    setMarking(false)
  }

  async function handleDownloadPDF() {
    const res = await fetch(`/api/payroll/pdf?id=${params.id}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payslip-${emp?.first_name}-${emp?.last_name}-${record?.month}-${record?.year}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (loading) return <div className="text-sm text-gray-400">Loading...</div>
  if (!record || !emp) return <div className="text-sm text-gray-500">Record not found.</div>

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-100">
            Payslip — {MONTH_NAMES[record.month]} {record.year}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{emp.first_name} {emp.last_name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={handleDownloadPDF}>
            Download PDF
          </Button>
          {isAdmin && record.payment_status === 'pending' && (
            <Button size="sm" onClick={handleMarkPaid} disabled={marking}>
              {marking ? 'Marking...' : 'Mark as Paid'}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-base font-medium text-gray-100">Salary Breakdown</h2>
            <Badge variant={record.payment_status === 'paid' ? 'success' : 'warning'}>
              {record.payment_status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Basic Salary</span>
              <span className="text-gray-100">{formatPKR(record.basic_salary)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Allowances</span>
              <span className="text-green-600">+{formatPKR(record.allowances)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Bonus</span>
              <span className="text-green-600">+{formatPKR(record.bonus)}</span>
            </div>
            <div className="border-t border-surface-border pt-3" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Deductions</span>
              <span className="text-danger">-{formatPKR(record.deductions)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">EOBI</span>
              <span className="text-danger">-{formatPKR(record.eobi_deduction)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tax</span>
              <span className="text-danger">-{formatPKR(record.tax_deduction)}</span>
            </div>
            <div className="border-t border-surface-border pt-3" />
            <div className="flex justify-between text-base font-medium">
              <span className="text-gray-100">Net Salary</span>
              <span className="text-brand">{formatPKR(record.net_salary)}</span>
            </div>
            {record.payment_date && (
              <p className="text-xs text-gray-400 mt-2">
                Paid on {formatDate(record.payment_date)}
              </p>
            )}
            {record.notes && (
              <p className="text-sm text-gray-500 mt-2">Notes: {record.notes}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Salary History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-medium text-gray-100">Salary History</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm text-gray-100 capitalize">{h.change_type}</p>
                    <p className="text-xs text-gray-500">{formatDate(h.effective_date)}</p>
                    {h.reason && <p className="text-xs text-gray-400">{h.reason}</p>}
                  </div>
                  <div className="text-right">
                    {h.previous_salary && (
                      <p className="text-xs text-gray-400 line-through">{formatPKR(h.previous_salary)}</p>
                    )}
                    <p className="text-sm font-medium text-gray-100">{formatPKR(h.new_salary)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        &larr; Back to Payroll
      </Button>
    </div>
  )
}
