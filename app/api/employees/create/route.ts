import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { passwordResetEmail } from '@/lib/email-templates'

const VALID_ROLES = ['admin', 'manager', 'team_lead', 'staff'] as const
const VALID_DEPARTMENTS = ['co-founder', 'creative', 'digital', 'development', 'seo', 'finance', 'operations'] as const
const VALID_EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'] as const
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    // Verify caller is admin
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: caller } = await supabase
      .from('employees')
      .select('id, role')
      .eq('email', user.email)
      .single()

    if (!caller || caller.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      first_name, last_name, email, phone, role, department,
      job_title, employment_type, join_date, basic_salary, cnic,
      emergency_contact_name, emergency_contact_phone,
    } = body

    // Input validation
    if (!first_name || typeof first_name !== 'string' || first_name.trim().length === 0) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 })
    }
    if (!last_name || typeof last_name !== 'string' || last_name.trim().length === 0) {
      return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (department && !VALID_DEPARTMENTS.includes(department)) {
      return NextResponse.json({ error: 'Invalid department' }, { status: 400 })
    }
    if (employment_type && !VALID_EMPLOYMENT_TYPES.includes(employment_type)) {
      return NextResponse.json({ error: 'Invalid employment type' }, { status: 400 })
    }
    if (basic_salary !== undefined && basic_salary !== null && basic_salary !== '') {
      const salary = parseFloat(basic_salary)
      if (isNaN(salary) || salary < 0 || salary > 10000000) {
        return NextResponse.json({ error: 'Invalid salary value' }, { status: 400 })
      }
    }

    // Create Supabase Auth user with cryptographically secure password
    const admin = createAdminClient()
    const tempPassword = randomBytes(24).toString('base64url')
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: role || 'staff' },
    })

    if (authError) {
      return NextResponse.json({ error: 'Failed to create auth account' }, { status: 400 })
    }

    // Insert employee record
    const { data: emp, error: empError } = await admin
      .from('employees')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        role: role || 'staff',
        department: department || null,
        job_title: job_title || null,
        employment_type: employment_type || 'full_time',
        join_date: join_date || null,
        basic_salary: basic_salary ? parseFloat(basic_salary) : null,
        cnic: cnic || null,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
      })
      .select('id, basic_salary')
      .single()

    if (empError) {
      return NextResponse.json({ error: 'Failed to create employee record' }, { status: 400 })
    }

    if (emp.basic_salary) {
      await admin.from('salary_history').insert({
        employee_id: emp.id,
        effective_date: join_date || new Date().toISOString().split('T')[0],
        previous_salary: null,
        new_salary: emp.basic_salary,
        change_type: 'joining',
        reason: 'Initial salary on employee creation',
        created_by: caller.id,
      })
    }

    // Send password reset email via Resend so user can set their password
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    if (linkData?.properties?.hashed_token) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const recoveryUrl = `${appUrl}/api/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/reset-password`

      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'HR Portal <noreply@example.com>',
        to: email.trim().toLowerCase(),
        subject: 'Welcome to HR Portal — Set your password',
        html: passwordResetEmail(recoveryUrl),
      }).catch(() => {}) // Don't fail creation if email fails
    }

    return NextResponse.json({ id: emp.id })
  } catch (err: any) {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
