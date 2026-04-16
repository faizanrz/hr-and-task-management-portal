// ── Roles ──
export const ROLES = ['admin', 'manager', 'team_lead', 'staff'] as const
export type Role = (typeof ROLES)[number]

// ── Departments ──
export const DEPARTMENTS = [
  'co-founder',
  'creative',
  'digital',
  'development',
  'seo',
  'finance',
  'operations',
] as const
export type Department = (typeof DEPARTMENTS)[number]

// ── Employment types ──
export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

// ── Attendance statuses ──
export const ATTENDANCE_STATUSES = [
  'present',
  'absent',
  'late',
  'half_day',
  'on_leave',
] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

// ── Leave types ──
export const LEAVE_TYPES = ['annual', 'sick', 'casual', 'unpaid'] as const
export type LeaveType = (typeof LEAVE_TYPES)[number]

// ── Leave request statuses ──
export const LEAVE_STATUSES = ['pending', 'approved', 'rejected'] as const
export type LeaveStatus = (typeof LEAVE_STATUSES)[number]

// ── Payroll statuses ──
export const PAYMENT_STATUSES = ['pending', 'paid'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

// ── Salary change types ──
export const SALARY_CHANGE_TYPES = ['increment', 'decrement', 'joining'] as const
export type SalaryChangeType = (typeof SALARY_CHANGE_TYPES)[number]

// ── HR document types ──
export const DOCUMENT_TYPES = [
  'offer_letter',
  'contract',
  'cnic_copy',
  'policy_acknowledgment',
  'nda',
  'offboarding',
  'other',
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

// ── Task board column workflow ──
export const BOARD_COLUMN_ORDER = [
  'Unassigned',
  'Assigned',
  'In Progress',
  'Internal Review',
  'Client Review',
  'Approved',
  'Done',
] as const

// ── Late threshold (PKT) ──
export const LATE_THRESHOLD_HOUR = 11 // hour component: 11 AM PKT
export const LATE_THRESHOLD_MINUTE = 0 // minute component: 11:00 AM PKT (30 min grace from 10:30 AM)

// ── Shift duration ──
export const REQUIRED_SHIFT_HOURS = 9 // Full shift = 9 hours

// ── Leave defaults per year ──
export const TOTAL_LEAVE_CAP = 15
export const DEFAULT_LEAVE_BALANCES = {
  annual_total: 8,
  sick_total: 4,
  casual_total: 3,
} as const

// ── Brand colors ──
export const COLORS = {
  primary: '#E63946',
  danger: '#E24B4A',
  warning: '#EF9F27',
  dark: '#171717',
  darkMid: '#1e1e1e',
  white: '#FFFFFF',
} as const

// ── Sidebar nav items ──
export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'People', href: '/people', icon: 'Users' },
  { label: 'Attendance', href: '/attendance', icon: 'Clock' },
  { label: 'Payroll', href: '/payroll', icon: 'Banknote' },
  { label: 'Documents', href: '/documents', icon: 'FileText' },
  { label: 'Announcements', href: '/announcements', icon: 'Megaphone' },
  { label: 'Tasks', href: '/tasks', icon: 'KanbanSquare' },
] as const
