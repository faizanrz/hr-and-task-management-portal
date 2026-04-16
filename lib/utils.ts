import { clsx, type ClassValue } from 'clsx'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Format date as DD MMM YYYY (Pakistan convention) — e.g. "24 Mar 2026" */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'dd MMM yyyy')
}

/** Format currency in PKR with comma separators — e.g. "PKR 45,000" */
export function formatPKR(amount: number): string {
  return `PKR ${amount.toLocaleString('en-PK')}`
}

/** Convert UTC timestamp to PKT (UTC+5) for display */
export function toPKT(date: string | Date): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  return toZonedTime(d, 'Asia/Karachi')
}

/** Format a time string (HH:mm:ss) for display — e.g. "10:30 AM" */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}
