import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { weeklyPerformanceEmail, PerformanceData } from '@/lib/email-templates'

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

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Calculate the week range (last 7 days)
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]

  // Format week label like "Mar 19 – Mar 25, 2026"
  const formatShortDate = (d: Date): string => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  const weekLabel = `${formatShortDate(weekAgo)} – ${formatShortDate(now)}, ${now.getFullYear()}`

  let sentCount = 0

  for (const emp of employees) {
    // Tasks assigned (not archived)
    const { count: tasksAssigned } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', emp.id)
      .eq('is_archived', false)

    // Tasks completed within last 7 days
    const { count: tasksCompleted } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', emp.id)
      .gte('completed_at', weekAgoStr)
      .lte('completed_at', today)

    // Tasks overdue (due_date < today, not completed, not archived)
    const { count: tasksOverdue } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', emp.id)
      .eq('is_archived', false)
      .is('completed_at', null)
      .lt('due_date', today)

    // Attendance records from last 7 days
    const { data: attendanceRecords } = await admin
      .from('attendance')
      .select('status')
      .eq('employee_id', emp.id)
      .gte('date', weekAgoStr)
      .lte('date', today)

    const records = attendanceRecords || []
    const daysPresent = records.filter((r: { status: string }) => r.status === 'present').length
    const daysLate = records.filter((r: { status: string }) => r.status === 'late').length
    const daysAbsent = records.filter((r: { status: string }) => r.status === 'absent').length
    const totalWorkDays = 5

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

    const { subject, html } = weeklyPerformanceEmail(emp.full_name, weekLabel, data)

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
