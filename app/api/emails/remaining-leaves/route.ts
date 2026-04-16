import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'
import { remainingLeavesEmail } from '@/lib/email-templates'
import { TOTAL_LEAVE_CAP } from '@/lib/constants'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL

  if (!resendApiKey || !fromEmail) {
    return NextResponse.json(
      { error: 'Missing RESEND_API_KEY or RESEND_FROM_EMAIL' },
      { status: 500 }
    )
  }

  const resend = new Resend(resendApiKey)
  const admin = createAdminClient()
  const currentYear = new Date().getFullYear()

  // Fetch all active employees, excluding co-founders
  const { data: employees, error: empError } = await admin
    .from('employees')
    .select('id, first_name, last_name, email, department')
    .eq('is_active', true)
    .neq('department', 'co-founder')

  if (empError) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }

  if (!employees || employees.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active employees found' })
  }

  // Fetch leave balances for the current year
  const employeeIds = employees.map((e: { id: string }) => e.id)

  const { data: balances, error: balanceError } = await admin
    .from('leave_balances')
    .select('employee_id, annual_used, annual_total, sick_used, sick_total, casual_used, casual_total')
    .eq('year', currentYear)
    .in('employee_id', employeeIds)

  if (balanceError) {
    return NextResponse.json({ error: 'Failed to fetch leave balances' }, { status: 500 })
  }

  // Index balances by employee_id for quick lookup
  const balanceMap = new Map<
    string,
    {
      annual_used: number
      annual_total: number
      sick_used: number
      sick_total: number
      casual_used: number
      casual_total: number
    }
  >()

  for (const b of balances || []) {
    balanceMap.set(b.employee_id, b)
  }

  let sent = 0

  for (const emp of employees) {
    const bal = balanceMap.get(emp.id)
    if (!bal) continue

    const name = `${emp.first_name} ${emp.last_name}`
    const balance = {
      annualUsed: bal.annual_used,
      annualTotal: bal.annual_total,
      sickUsed: bal.sick_used,
      sickTotal: bal.sick_total,
      casualUsed: bal.casual_used,
      casualTotal: bal.casual_total,
    }

    const { subject, html } = remainingLeavesEmail(name, balance, TOTAL_LEAVE_CAP)

    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: emp.email,
      subject,
      html,
    })

    if (!sendError) {
      sent++
    }
  }

  return NextResponse.json({ sent })
}
