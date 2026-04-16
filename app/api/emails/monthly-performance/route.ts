import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { monthlyPerformanceEmail, PerformanceData } from '@/lib/email-templates'

function getBusinessDays(year: number, month: number): number {
  let count = 0
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!resendApiKey || !fromEmail) {
    return NextResponse.json({ error: 'Missing RESEND_API_KEY or RESEND_FROM_EMAIL' }, { status: 500 })
  }

  const resend = new Resend(resendApiKey)
  const admin = createAdminClient()

  // Fetch active employees excluding co-founder department
  const { data: employees, error: empError } = await admin
    .from('employees')
    .select('id, full_name, email, department')
    .eq('status', 'active')
    .neq('department', 'co-founder')

  if (empError) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }

  if (!employees || employees.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active employees found' })
  }

  // Previous calendar month
  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const totalWorkDays = getBusinessDays(prevYear, prevMonth)

  // Date range for previous month
  const monthStart = new Date(prevYear, prevMonth, 1).toISOString().split('T')[0]
  const monthEnd = new Date(prevYear, prevMonth + 1, 0).toISOString().split('T')[0]

  // Month label like "February 2026"
  const monthLabel = new Date(prevYear, prevMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const today = now.toISOString().split('T')[0]
  let sentCount = 0

  for (const emp of employees) {
    // Tasks assigned (not archived)
    const { count: tasksAssigned } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', emp.id)
      .eq('is_archived', false)

    // Tasks completed within previous month
    const { count: tasksCompleted } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', emp.id)
      .gte('completed_at', monthStart)
      .lte('completed_at', monthEnd)

    // Tasks overdue (due_date < today, not completed, not archived)
    const { count: tasksOverdue } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', emp.id)
      .eq('is_archived', false)
      .is('completed_at', null)
      .lt('due_date', today)

    // Attendance records within previous month
    const { data: attendanceRecords } = await admin
      .from('attendance')
      .select('status')
      .eq('employee_id', emp.id)
      .gte('date', monthStart)
      .lte('date', monthEnd)

    const records = attendanceRecords || []
    const daysPresent = records.filter((r: { status: string }) => r.status === 'present').length
    const daysLate = records.filter((r: { status: string }) => r.status === 'late').length
    const daysAbsent = records.filter((r: { status: string }) => r.status === 'absent').length

    const assigned = tasksAssigned || 0
    const completed = tasksCompleted || 0
    const completionPct = assigned > 0 ? Math.round((completed / assigned) * 100) : 0
    const attendancePct = totalWorkDays > 0 ? Math.round((daysPresent / totalWorkDays) * 100) : 0

    let performanceRating: PerformanceData['performanceRating']
    if (completionPct >= 80 && attendancePct >= 90) {
      performanceRating = 'Excellent'
    } else if (completionPct >= 50) {
      performanceRating = 'Good'
    } else {
      performanceRating = 'Needs Improvement'
    }

    const data: PerformanceData = {
      tasksAssigned: assigned,
      tasksCompleted: completed,
      tasksOverdue: tasksOverdue || 0,
      daysPresent,
      daysLate,
      daysAbsent,
      totalWorkDays,
      performanceRating,
    }

    const { subject, html } = monthlyPerformanceEmail(emp.full_name, monthLabel, data)

    await resend.emails.send({
      from: fromEmail,
      to: emp.email,
      subject,
      html,
    })

    sentCount++
  }

  return NextResponse.json({ sent: sentCount })
}
