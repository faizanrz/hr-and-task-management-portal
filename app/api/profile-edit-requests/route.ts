import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server'

function formatChanges(changes: Record<string, unknown>) {
  return Object.entries(changes)
    .map(([field, value]) => `${field}: ${value === null || value === '' ? '—' : String(value)}`)
    .join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: caller } = await supabase
      .from('employees')
      .select('id, first_name, last_name, email, role')
      .eq('email', user.email)
      .single()

    if (!caller) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
    }

    const body = await request.json()
    const employeeId = body.employee_id as string
    const requestedChanges = (body.requested_changes || {}) as Record<string, unknown>
    const requestNote = (body.request_note || '').trim()

    // Validate employee_id is a UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!employeeId || !UUID_REGEX.test(employeeId)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 })
    }

    if (Object.keys(requestedChanges).length === 0) {
      return NextResponse.json({ error: 'No requested changes supplied' }, { status: 400 })
    }

    // Validate note length
    if (requestNote.length > 1000) {
      return NextResponse.json({ error: 'Request note is too long' }, { status: 400 })
    }

    // Block sensitive fields from being requested by non-admins
    const ADMIN_ONLY_FIELDS = ['role', 'basic_salary', 'is_active']
    if (caller.role !== 'admin') {
      const blockedFields = Object.keys(requestedChanges).filter(f => ADMIN_ONLY_FIELDS.includes(f))
      if (blockedFields.length > 0) {
        return NextResponse.json({ error: 'You cannot request changes to restricted fields' }, { status: 403 })
      }
    }

    if (caller.role !== 'admin' && caller.id !== employeeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('employees')
      .select('first_name, last_name, email')
      .eq('id', employeeId)
      .single()

    const { data: created, error } = await admin
      .from('profile_edit_requests')
      .insert({
        employee_id: employeeId,
        requested_changes: requestedChanges,
        request_note: requestNote || null,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create edit request' }, { status: 400 })
    }

    const resendApiKey = process.env.RESEND_API_KEY
    const resendFrom = process.env.RESEND_FROM_EMAIL

    if (resendApiKey && resendFrom) {
      const { data: admins } = await admin
        .from('employees')
        .select('email')
        .eq('role', 'admin')
        .eq('is_active', true)

      const adminEmails = ((admins || []) as Array<{ email: string | null }>)
        .map((item) => item.email)
        .filter((email): email is string => Boolean(email))

      if (adminEmails.length > 0) {
        const resend = new Resend(resendApiKey)
        await resend.emails.send({
          from: resendFrom,
          to: adminEmails,
          subject: `Profile edit request from ${profile?.first_name || caller.first_name} ${profile?.last_name || caller.last_name}`,
          text: [
            `${profile?.first_name || caller.first_name} ${profile?.last_name || caller.last_name} requested a profile update.`,
            '',
            'Requested changes:',
            formatChanges(requestedChanges),
            '',
            requestNote ? `Note: ${requestNote}` : 'Note: —',
          ].join('\n'),
        })
      }
    }

    return NextResponse.json({ id: created.id })
  } catch (error: any) {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
