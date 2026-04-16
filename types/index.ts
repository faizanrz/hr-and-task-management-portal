// ════════════════════════════════════════════
// HR Portal — TypeScript types for all tables
// Matches Supabase schema from BRIEF.md
// ════════════════════════════════════════════

// ── Employees (core table) ──
export interface Employee {
  id: string // UUID
  legacy_user_id: number | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  role: 'admin' | 'manager' | 'team_lead' | 'staff'
  department: 'co-founder' | 'creative' | 'digital' | 'development' | 'seo' | 'finance' | 'operations' | null
  job_title: string | null
  employment_type: 'full_time' | 'part_time' | 'contract'
  join_date: string | null // date
  basic_salary: number | null
  cnic: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Attendance ──
export interface Attendance {
  id: string
  employee_id: string
  date: string // date
  check_in: string | null // time
  check_out: string | null // time
  status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave'
  notes: string | null
  created_at: string
}

// ── Leave Requests ──
export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type: 'annual' | 'sick' | 'casual' | 'unpaid'
  start_date: string
  end_date: string
  days_count: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  admin_notes: string | null
  created_at: string
}

// ── Leave Balances ──
export interface LeaveBalance {
  id: string
  employee_id: string
  year: number
  annual_total: number
  annual_used: number
  sick_total: number
  sick_used: number
  casual_total: number
  casual_used: number
}

// ── Public Holidays ──
export interface PublicHoliday {
  id: string
  name: string
  date: string
  year: number
}

// ── Payroll Records ──
export interface PayrollRecord {
  id: string
  employee_id: string
  month: number
  year: number
  basic_salary: number
  allowances: number
  deductions: number
  bonus: number
  eobi_deduction: number
  tax_deduction: number
  net_salary: number // computed: basic + allowances + bonus - deductions
  payment_status: 'pending' | 'paid'
  payment_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Salary History ──
export interface SalaryHistory {
  id: string
  employee_id: string
  effective_date: string
  previous_salary: number | null
  new_salary: number
  change_type: 'increment' | 'decrement' | 'joining'
  reason: string | null
  created_by: string | null
  created_at: string
}

// ── HR Documents ──
export interface HRDocument {
  id: string
  employee_id: string
  document_type: 'offer_letter' | 'contract' | 'cnic_copy' | 'policy_acknowledgment' | 'nda' | 'offboarding' | 'other'
  title: string
  file_path: string
  file_size: number | null
  uploaded_by: string | null
  notes: string | null
  created_at: string
}

// ── Announcements ──
export interface Announcement {
  id: string
  title: string
  body: string
  is_pinned: boolean
  posted_by: string | null
  expires_at: string | null
  created_at: string
}

// ── Profile Edit Requests ──
export interface ProfileEditRequest {
  id: string
  employee_id: string
  requested_changes: Record<string, unknown>
  request_note: string | null
  status: 'pending' | 'reviewed' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

// ════════════════════════════════════
// Task Management (migrated from PHP)
// Uses integer IDs, not UUIDs
// ════════════════════════════════════

// ── Boards ──
export interface Board {
  id: number
  name: string
  description: string | null
  created_by: string // UUID → employees
  created_at: string
  updated_at: string
}

// ── Board Columns ──
export interface BoardColumn {
  id: number
  board_id: number
  name: string
  position: number
  created_at: string
}

// ── Clients ──
export interface Client {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_by: string // UUID → employees
  created_at: string
  updated_at: string
}

// ── Tasks ──
export interface Task {
  id: number
  board_id: number
  column_id: number
  client_id: number | null
  title: string
  description: string | null
  position: number
  owner_id: string // UUID → employees
  assignee_id: string | null // UUID → employees
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

// ── Task Comments ──
export interface TaskComment {
  id: number
  task_id: number
  user_id: string // UUID → employees
  comment: string
  created_at: string
}

// ── Task Statistics ──
export interface TaskStatistic {
  user_id: string // UUID → employees
  client_id: number
  date: string
  tasks_completed: number
  avg_completion_time: number | null
}

// ════════════════════════════════════
// Utility types
// ════════════════════════════════════

/** Employee with computed full name — use for dropdowns, lists */
export type EmployeeSummary = Pick<Employee, 'id' | 'first_name' | 'last_name' | 'email' | 'role' | 'department' | 'is_active'>

/** Task with joined relations — use for kanban cards */
export interface TaskWithRelations extends Task {
  client?: Pick<Client, 'id' | 'name'> | null
  assignee?: Pick<Employee, 'id' | 'first_name' | 'last_name'> | null
  owner?: Pick<Employee, 'id' | 'first_name' | 'last_name'> | null
  comments_count?: number
}
