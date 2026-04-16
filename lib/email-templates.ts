/**
 * HR Portal — Branded HTML email templates
 * All emails share a consistent dark-themed layout matching the portal UI.
 */

const BRAND_COLOR = '#E63946'
const BG_DARK = '#171717'
const BG_CARD = '#252525'
const BG_MID = '#1e1e1e'
const TEXT_PRIMARY = '#f3f4f6'
const TEXT_SECONDARY = '#9ca3af'
const BORDER = '#333333'
const SUCCESS = '#22C55E'
const WARNING = '#EF9F27'
const DANGER = '#E63946'

function layout(title: string, preheader: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
  body { margin: 0; padding: 0; background-color: ${BG_DARK}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .container { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
  .card { background-color: ${BG_CARD}; border: 1px solid ${BORDER}; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
  .header { text-align: center; padding: 24px 0 16px; }
  .logo { font-size: 20px; font-weight: 700; color: ${BRAND_COLOR}; letter-spacing: 1px; }
  .subtitle { font-size: 12px; color: ${TEXT_SECONDARY}; margin-top: 4px; }
  h1 { color: ${TEXT_PRIMARY}; font-size: 20px; font-weight: 600; margin: 0 0 8px; }
  h2 { color: ${TEXT_PRIMARY}; font-size: 16px; font-weight: 600; margin: 0 0 12px; }
  p { color: ${TEXT_SECONDARY}; font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
  .text-primary { color: ${TEXT_PRIMARY}; }
  .text-brand { color: ${BRAND_COLOR}; }
  .text-success { color: ${SUCCESS}; }
  .text-warning { color: ${WARNING}; }
  .text-danger { color: ${DANGER}; }
  .stat-grid { display: flex; gap: 12px; margin-bottom: 16px; }
  .stat-box { flex: 1; background: ${BG_MID}; border: 1px solid ${BORDER}; border-radius: 8px; padding: 12px; text-align: center; }
  .stat-value { font-size: 24px; font-weight: 700; color: ${TEXT_PRIMARY}; }
  .stat-label { font-size: 11px; color: ${TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { text-align: left; padding: 8px 12px; font-size: 11px; color: ${TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid ${BORDER}; }
  td { padding: 10px 12px; font-size: 13px; color: ${TEXT_PRIMARY}; border-bottom: 1px solid ${BORDER}; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-danger { background: rgba(230,57,70,0.15); color: ${DANGER}; }
  .badge-warning { background: rgba(239,159,39,0.15); color: ${WARNING}; }
  .badge-success { background: rgba(34,197,94,0.15); color: ${SUCCESS}; }
  .progress-bar { width: 100%; height: 8px; background: ${BG_MID}; border-radius: 4px; overflow: hidden; margin: 8px 0; }
  .progress-fill { height: 100%; border-radius: 4px; }
  .btn { display: inline-block; padding: 10px 24px; background: ${BRAND_COLOR}; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
  .footer { text-align: center; padding: 16px 0; font-size: 12px; color: ${TEXT_SECONDARY}; }
  .divider { border: none; border-top: 1px solid ${BORDER}; margin: 16px 0; }
  .preheader { display: none; max-height: 0; overflow: hidden; }
</style>
</head>
<body>
<div class="preheader">${preheader}</div>
<div class="container">
  <div class="header">
    <div class="logo">HR Portal</div>
    <div class="subtitle">Your Company</div>
  </div>
  ${body}
  <div class="footer">
    <p>This is an automated email from HR Portal. <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" style="color:${BRAND_COLOR};">Open Portal</a></p>
  </div>
</div>
</body>
</html>`
}

function statBox(value: string | number, label: string, colorClass?: string): string {
  const color = colorClass === 'danger' ? DANGER : colorClass === 'warning' ? WARNING : colorClass === 'success' ? SUCCESS : TEXT_PRIMARY
  return `<div class="stat-box"><div class="stat-value" style="color:${color}">${value}</div><div class="stat-label">${label}</div></div>`
}

function progressBar(used: number, total: number): string {
  const pct = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0
  const color = pct >= 90 ? DANGER : pct >= 70 ? WARNING : SUCCESS
  return `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>`
}

// ─── Task Due Today ───

export function taskDueTodayEmail(
  recipientName: string,
  tasks: { title: string; board: string; client?: string }[]
): { subject: string; html: string } {
  const rows = tasks.map(t =>
    `<tr><td>${t.title}</td><td>${t.board}</td><td>${t.client || '—'}</td></tr>`
  ).join('')

  const body = `
    <div class="card">
      <h1>Tasks Due Today</h1>
      <p>Hi ${recipientName}, you have <strong class="text-primary">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</strong> due today.</p>
      <hr class="divider" />
      <table>
        <tr><th>Task</th><th>Board</th><th>Client</th></tr>
        ${rows}
      </table>
      <div style="text-align:center;padding-top:12px">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/tasks" class="btn">View Tasks</a>
      </div>
    </div>`

  return {
    subject: `${tasks.length} task${tasks.length !== 1 ? 's' : ''} due today`,
    html: layout('Tasks Due Today', `You have ${tasks.length} tasks due today`, body),
  }
}

// ─── Task Overdue ───

export function taskOverdueEmail(
  recipientName: string,
  tasks: { title: string; board: string; dueDate: string; daysPastDue: number }[]
): { subject: string; html: string } {
  const rows = tasks.map(t =>
    `<tr><td>${t.title}</td><td>${t.board}</td><td>${t.dueDate}</td><td><span class="badge badge-danger">${t.daysPastDue} day${t.daysPastDue !== 1 ? 's' : ''}</span></td></tr>`
  ).join('')

  const body = `
    <div class="card">
      <h1 class="text-danger">Overdue Tasks</h1>
      <p>Hi ${recipientName}, you have <strong class="text-danger">${tasks.length} overdue task${tasks.length !== 1 ? 's' : ''}</strong> that need attention.</p>
      <hr class="divider" />
      <table>
        <tr><th>Task</th><th>Board</th><th>Due Date</th><th>Past Due</th></tr>
        ${rows}
      </table>
      <div style="text-align:center;padding-top:12px">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/tasks" class="btn">View Tasks</a>
      </div>
    </div>`

  return {
    subject: `${tasks.length} overdue task${tasks.length !== 1 ? 's' : ''} need attention`,
    html: layout('Overdue Tasks', `You have ${tasks.length} overdue tasks`, body),
  }
}

// ─── Weekly / Monthly Performance ───

export interface PerformanceData {
  tasksAssigned: number
  tasksCompleted: number
  tasksOverdue: number
  daysPresent: number
  daysLate: number
  daysAbsent: number
  totalWorkDays: number
  performanceRating: 'Excellent' | 'Good' | 'Needs Improvement'
}

export function weeklyPerformanceEmail(
  recipientName: string,
  weekLabel: string,
  data: PerformanceData
): { subject: string; html: string } {
  return performanceEmail(recipientName, 'Weekly', weekLabel, data)
}

export function monthlyPerformanceEmail(
  recipientName: string,
  monthLabel: string,
  data: PerformanceData
): { subject: string; html: string } {
  return performanceEmail(recipientName, 'Monthly', monthLabel, data)
}

function performanceEmail(
  recipientName: string,
  period: 'Weekly' | 'Monthly',
  periodLabel: string,
  data: PerformanceData
): { subject: string; html: string } {
  const ratingColor = data.performanceRating === 'Excellent' ? 'success' : data.performanceRating === 'Good' ? 'warning' : 'danger'
  const ratingBadge = `<span class="badge badge-${ratingColor}">${data.performanceRating}</span>`
  const attendancePct = data.totalWorkDays > 0 ? Math.round((data.daysPresent / data.totalWorkDays) * 100) : 0
  const completionPct = data.tasksAssigned > 0 ? Math.round((data.tasksCompleted / data.tasksAssigned) * 100) : 0

  const body = `
    <div class="card">
      <h1>${period} Performance Report</h1>
      <p>Hi ${recipientName}, here's your ${period.toLowerCase()} summary for <strong class="text-primary">${periodLabel}</strong>.</p>
      <p>Overall Rating: ${ratingBadge}</p>
    </div>

    <div class="card">
      <h2>Tasks Breakdown</h2>
      <!--[if mso]><table role="presentation" width="100%"><tr><td width="33%"><![endif]-->
      <div class="stat-grid">
        ${statBox(data.tasksAssigned, 'Assigned')}
        ${statBox(data.tasksCompleted, 'Completed', 'success')}
        ${statBox(data.tasksOverdue, 'Overdue', data.tasksOverdue > 0 ? 'danger' : undefined)}
      </div>
      <p>Completion Rate</p>
      ${progressBar(data.tasksCompleted, data.tasksAssigned)}
      <p class="text-primary" style="font-size:13px">${completionPct}% of assigned tasks completed</p>
    </div>

    <div class="card">
      <h2>Attendance</h2>
      <div class="stat-grid">
        ${statBox(data.daysPresent, 'Present', 'success')}
        ${statBox(data.daysLate, 'Late', data.daysLate > 0 ? 'warning' : undefined)}
        ${statBox(data.daysAbsent, 'Absent', data.daysAbsent > 0 ? 'danger' : undefined)}
      </div>
      <p>Attendance Rate</p>
      ${progressBar(data.daysPresent, data.totalWorkDays)}
      <p class="text-primary" style="font-size:13px">${attendancePct}% attendance (${data.daysPresent}/${data.totalWorkDays} work days)</p>
    </div>

    <div style="text-align:center;padding:8px 0 16px">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" class="btn">View Dashboard</a>
    </div>`

  return {
    subject: `Your ${period} Performance Report — ${periodLabel}`,
    html: layout(`${period} Performance`, `Your ${period.toLowerCase()} performance report for ${periodLabel}`, body),
  }
}

// ─── Team Performance Monthly ───

export interface TeamMemberPerformance {
  name: string
  department: string
  tasksAssigned: number
  tasksCompleted: number
  tasksOverdue: number
  daysPresent: number
  totalWorkDays: number
}

export function teamPerformanceMonthlyEmail(
  recipientName: string,
  monthLabel: string,
  teamLabel: string,
  members: TeamMemberPerformance[],
  totals: { assigned: number; completed: number; overdue: number; avgAttendance: number }
): { subject: string; html: string } {
  const rows = members.map(m => {
    const completionPct = m.tasksAssigned > 0 ? Math.round((m.tasksCompleted / m.tasksAssigned) * 100) : 0
    const attendancePct = m.totalWorkDays > 0 ? Math.round((m.daysPresent / m.totalWorkDays) * 100) : 0
    const overdueClass = m.tasksOverdue > 0 ? 'badge-danger' : 'badge-success'
    return `<tr>
      <td>${m.name}</td>
      <td>${m.department}</td>
      <td>${m.tasksCompleted}/${m.tasksAssigned}</td>
      <td><span class="badge ${overdueClass}">${m.tasksOverdue}</span></td>
      <td>${attendancePct}%</td>
      <td><span class="badge ${completionPct >= 80 ? 'badge-success' : completionPct >= 50 ? 'badge-warning' : 'badge-danger'}">${completionPct}%</span></td>
    </tr>`
  }).join('')

  const body = `
    <div class="card">
      <h1>Team Performance — ${monthLabel}</h1>
      <p>Hi ${recipientName}, here's the monthly team performance report for <strong class="text-primary">${teamLabel}</strong>.</p>
    </div>

    <div class="card">
      <h2>Summary</h2>
      <div class="stat-grid">
        ${statBox(totals.assigned, 'Total Assigned')}
        ${statBox(totals.completed, 'Completed', 'success')}
        ${statBox(totals.overdue, 'Overdue', totals.overdue > 0 ? 'danger' : undefined)}
        ${statBox(`${totals.avgAttendance}%`, 'Avg Attendance')}
      </div>
    </div>

    <div class="card">
      <h2>Individual Breakdown</h2>
      <table>
        <tr><th>Name</th><th>Dept</th><th>Completed</th><th>Overdue</th><th>Attendance</th><th>Completion</th></tr>
        ${rows}
      </table>
    </div>

    <div style="text-align:center;padding:8px 0 16px">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/tasks/reports" class="btn">View Reports</a>
    </div>`

  return {
    subject: `Team Performance Report — ${monthLabel}`,
    html: layout('Team Performance', `Monthly team performance report for ${monthLabel}`, body),
  }
}

// ─── Remaining Leaves ───

export function remainingLeavesEmail(
  recipientName: string,
  balance: { annualUsed: number; annualTotal: number; sickUsed: number; sickTotal: number; casualUsed: number; casualTotal: number },
  totalCap: number
): { subject: string; html: string } {
  const totalUsed = balance.annualUsed + balance.sickUsed + balance.casualUsed
  const remaining = totalCap - totalUsed

  const body = `
    <div class="card">
      <h1>Leave Balance Update</h1>
      <p>Hi ${recipientName}, here's your current leave balance.</p>
      <hr class="divider" />
      <div style="text-align:center;margin:16px 0">
        <div style="font-size:48px;font-weight:700;color:${remaining <= 3 ? DANGER : remaining <= 7 ? WARNING : SUCCESS}">${remaining}</div>
        <p>days remaining out of ${totalCap}</p>
      </div>
      ${progressBar(totalUsed, totalCap)}
    </div>

    <div class="card">
      <h2>Breakdown by Type</h2>
      <table>
        <tr><th>Leave Type</th><th>Used</th><th>Total</th><th>Remaining</th></tr>
        <tr><td>Annual</td><td>${balance.annualUsed}</td><td>${balance.annualTotal}</td><td>${balance.annualTotal - balance.annualUsed}</td></tr>
        <tr><td>Sick</td><td>${balance.sickUsed}</td><td>${balance.sickTotal}</td><td>${balance.sickTotal - balance.sickUsed}</td></tr>
        <tr><td>Casual</td><td>${balance.casualUsed}</td><td>${balance.casualTotal}</td><td>${balance.casualTotal - balance.casualUsed}</td></tr>
      </table>
      <hr class="divider" />
      <p style="font-size:12px">Combined cap: <strong class="text-primary">${totalCap} days</strong> per year across all leave types.</p>
    </div>

    <div style="text-align:center;padding:8px 0 16px">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/attendance/leave" class="btn">View Leave Details</a>
    </div>`

  return {
    subject: `Leave Balance: ${remaining} days remaining`,
    html: layout('Leave Balance', `You have ${remaining} days of leave remaining`, body),
  }
}

// ─── Password Reset ───

export function passwordResetEmail(resetUrl: string): string {
  const body = `
    <div class="card">
      <h1>Reset Your Password</h1>
      <p>We received a request to reset your password. Click the button below to set a new password.</p>
      <hr class="divider" />
      <div style="text-align:center;padding:16px 0">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </div>
      <p style="font-size:12px">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>`

  return layout('Reset Password', 'Reset your HR Portal password', body)
}
