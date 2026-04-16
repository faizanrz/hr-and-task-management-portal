import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { taskDueTodayEmail } from '@/lib/email-templates'

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

  const today = new Date().toISOString().split('T')[0]

  // Fetch non-archived tasks due today that are not completed, with assignee, board, and client
  const { data: tasks, error: taskError } = await admin
    .from('tasks')
    .select(`
      id,
      title,
      due_date,
      board:board_id ( name ),
      client:client_id ( name ),
      assignee:assignee_id ( id, first_name, last_name, email, department, role )
    `)
    .eq('is_archived', false)
    .eq('due_date', today)
    .is('completed_at', null)

  if (taskError) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No tasks due today' })
  }

  // Filter out tasks where assignee is in co-founder department or has no assignee
  const filteredTasks = tasks.filter((t: any) => {
    const assignee = t.assignee as any
    return assignee && assignee.department !== 'co-founder'
  })

  if (filteredTasks.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No eligible tasks due today' })
  }

  // Group tasks by assignee email
  const grouped: Record<string, {
    assigneeId: string
    name: string
    email: string
    department: string
    tasks: { title: string; board: string; client?: string }[]
  }> = {}

  for (const t of filteredTasks) {
    const assignee = t.assignee as any
    const board = t.board as any
    const client = t.client as any
    const email = assignee.email

    if (!grouped[email]) {
      grouped[email] = {
        assigneeId: assignee.id,
        name: `${assignee.first_name} ${assignee.last_name}`,
        email,
        department: assignee.department,
        tasks: [],
      }
    }

    grouped[email].tasks.push({
      title: t.title,
      board: board?.name || 'Unknown',
      client: client?.name,
    })
  }

  // Find managers/team leads per department for CC
  const departments = Array.from(new Set(Object.values(grouped).map(g => g.department)))

  const { data: managers } = await admin
    .from('employees')
    .select('id, email, department, role')
    .eq('is_active', true)
    .in('department', departments)
    .in('role', ['manager', 'admin'])

  const managersByDept: Record<string, string[]> = {}
  for (const m of managers || []) {
    const dept = (m as any).department
    if (!managersByDept[dept]) managersByDept[dept] = []
    managersByDept[dept].push((m as any).email)
  }

  let sentCount = 0

  for (const entry of Object.values(grouped)) {
    const { subject, html } = taskDueTodayEmail(entry.name, entry.tasks)

    // Build CC list: managers/team leads in the same department (excluding the assignee themselves)
    const cc = (managersByDept[entry.department] || []).filter(e => e !== entry.email)

    await resend.emails.send({
      from: fromEmail,
      to: entry.email,
      ...(cc.length > 0 && { cc }),
      subject,
      html,
    })

    sentCount++
  }

  return NextResponse.json({ sent: sentCount })
}
