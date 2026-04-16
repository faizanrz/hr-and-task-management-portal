import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { teamPerformanceMonthlyEmail, TeamMemberPerformance } from '@/lib/email-templates'

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

  // Previous calendar month
  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const totalWorkDays = getBusinessDays(prevYear, prevMonth)

  const monthStart = new Date(prevYear, prevMonth, 1).toISOString().split('T')[0]
  const monthEnd = new Date(prevYear, prevMonth + 1, 0).toISOString().split('T')[0]

  const monthLabel = new Date(prevYear, prevMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const today = now.toISOString().split('T')[0]

  // Fetch recipients: admin, manager, team_lead (active, exclude co-founder)
  const { data: recipients, error: recipError } = await admin
    .from('employees')
    .select('id, full_name, email, role, department')
    .eq('status', 'active')
    .neq('department', 'co-founder')
    .in('role', ['admin', 'manager', 'team_lead'])

  if (recipError) {
    return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 })
  }

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No eligible recipients found' })
  }

  // Fetch all active non-co-founder employees for team member data
  const { data: allEmployees, error: allEmpError } = await admin
    .from('employees')
    .select('id, full_name, department')
    .eq('status', 'active')
    .neq('department', 'co-founder')

  if (allEmpError) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }

  const employees = allEmployees || []

  // Pre-fetch performance data for all employees
  const memberDataMap = new Map<string, TeamMemberPerformance>()

  for (const emp of employees) {
    const { count: tasksAssigned } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', emp.id)
      .eq('is_archived', false)

    const { count: tasksCompleted } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', emp.id)
      .gte('completed_at', monthStart)
      .lte('completed_at', monthEnd)

    const { count: tasksOverdue } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', emp.id)
      .eq('is_archived', false)
      .is('completed_at', null)
      .lt('due_date', today)

    const { data: attendanceRecords } = await admin
      .from('attendance')
      .select('status')
      .eq('employee_id', emp.id)
      .gte('date', monthStart)
      .lte('date', monthEnd)

    const records = attendanceRecords || []
    const daysPresent = records.filter((r: { status: string }) => r.status === 'present').length

    memberDataMap.set(emp.id, {
      name: emp.full_name,
      department: emp.department,
      tasksAssigned: tasksAssigned || 0,
      tasksCompleted: tasksCompleted || 0,
      tasksOverdue: tasksOverdue || 0,
      daysPresent,
      totalWorkDays,
    })
  }

  let sentCount = 0

  for (const recipient of recipients) {
    // Determine team scope
    let teamMembers: TeamMemberPerformance[]
    let teamLabel: string

    if (recipient.role === 'admin') {
      // Admin sees all non-co-founder employees
      teamMembers = Array.from(memberDataMap.values())
      teamLabel = 'All Departments'
    } else {
      // Manager/team_lead sees their department
      teamMembers = Array.from(memberDataMap.values()).filter(
        (m) => m.department === recipient.department
      )
      teamLabel = recipient.department
    }

    if (teamMembers.length === 0) continue

    // Calculate totals
    const totals = {
      assigned: teamMembers.reduce((sum, m) => sum + m.tasksAssigned, 0),
      completed: teamMembers.reduce((sum, m) => sum + m.tasksCompleted, 0),
      overdue: teamMembers.reduce((sum, m) => sum + m.tasksOverdue, 0),
      avgAttendance: Math.round(
        teamMembers.reduce((sum, m) => {
          const pct = m.totalWorkDays > 0 ? (m.daysPresent / m.totalWorkDays) * 100 : 0
          return sum + pct
        }, 0) / teamMembers.length
      ),
    }

    const { subject, html } = teamPerformanceMonthlyEmail(
      recipient.full_name,
      monthLabel,
      teamLabel,
      teamMembers,
      totals
    )

    await resend.emails.send({
      from: fromEmail,
      to: recipient.email,
      subject,
      html,
    })

    sentCount++
  }

  return NextResponse.json({ sent: sentCount })
}
