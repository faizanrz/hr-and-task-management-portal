import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function formatPKR(amount: number): string {
  return `PKR ${amount.toLocaleString('en-PK')}`
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildSimplePdf(lines: string[]) {
  const content = [
    'BT',
    '/F1 12 Tf',
    '50 790 Td',
    ...lines.flatMap((line, index) => {
      const prefix = index === 0 ? '' : '0 -18 Td\n'
      return `${prefix}(${escapePdfText(line)}) Tj`
    }),
    'ET',
  ].join('\n')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  for (const object of objects) {
    offsets.push(pdf.length)
    pdf += `${object}\n`
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'

  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.from(pdf, 'binary')
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Validate UUID format
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: record } = await supabase
    .from('payroll_records')
    .select('*')
    .eq('id', id)
    .single()

  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: emp } = await supabase
    .from('employees')
    .select('*')
    .eq('id', record.employee_id)
    .single()

  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  // Verify access: admin, manager/team_lead for own department, or own record
  const { data: caller } = await supabase.from('employees').select('role, id, department').eq('email', user.email).single()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isOwn = caller.id === record.employee_id
  const isAdmin = caller.role === 'admin'
  const isTeamManager = (caller.role === 'manager' || caller.role === 'team_lead') && caller.department === emp.department

  if (!isOwn && !isAdmin && !isTeamManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pdf = buildSimplePdf([
    'Your Company',
    `Payslip for ${MONTH_NAMES[record.month]} ${record.year}`,
    '',
    `Employee: ${emp.first_name} ${emp.last_name}`,
    `Email: ${emp.email}`,
    `Department: ${emp.department ? emp.department.charAt(0).toUpperCase() + emp.department.slice(1) : '—'}`,
    `Job Title: ${emp.job_title || '—'}`,
    `Payment Status: ${record.payment_status.charAt(0).toUpperCase() + record.payment_status.slice(1)}`,
    `Payment Date: ${record.payment_date || '—'}`,
    '',
    `Basic Salary: ${formatPKR(record.basic_salary)}`,
    `Allowances: +${formatPKR(record.allowances)}`,
    `Bonus: +${formatPKR(record.bonus)}`,
    `Deductions: -${formatPKR(record.deductions)}`,
    `EOBI Deduction: -${formatPKR(record.eobi_deduction)}`,
    `Tax Deduction: -${formatPKR(record.tax_deduction)}`,
    `Net Salary: ${formatPKR(record.net_salary)}`,
    '',
    `Notes: ${record.notes || '—'}`,
    `Generated on ${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}`,
  ])

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payslip-${emp.first_name}-${emp.last_name}-${record.month}-${record.year}.pdf"`,
    },
  })
}
