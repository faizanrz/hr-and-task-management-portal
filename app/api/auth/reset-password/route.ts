import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { passwordResetEmail } from '@/lib/email-templates'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Generate recovery link via Admin API (no SMTP needed)
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim().toLowerCase(),
    })

    if (error) {
      console.error('[reset-password] generateLink error:', error.message)
      return NextResponse.json({ message: 'If an account exists, a reset email has been sent.' })
    }

    if (!data?.properties?.hashed_token) {
      console.error('[reset-password] No hashed_token in response:', JSON.stringify(data))
      return NextResponse.json({ message: 'If an account exists, a reset email has been sent.' })
    }

    // Build the recovery URL that goes through our confirm endpoint
    const token = data.properties.hashed_token
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const recoveryUrl = `${appUrl}/api/auth/confirm?token_hash=${token}&type=recovery&next=/reset-password`

    // Send via Resend
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'HR Portal <noreply@example.com>',
      to: email.trim().toLowerCase(),
      subject: 'Reset your password — HR Portal',
      html: passwordResetEmail(recoveryUrl),
    })

    if (emailError) {
      console.error('[reset-password] Resend error:', emailError)
    } else {
      console.log('[reset-password] Email sent:', emailResult?.id)
    }

    return NextResponse.json({ message: 'If an account exists, a reset email has been sent.' })
  } catch (err) {
    console.error('[reset-password] Unexpected error:', err)
    return NextResponse.json({ message: 'If an account exists, a reset email has been sent.' })
  }
}
