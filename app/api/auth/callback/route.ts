import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_REDIRECTS = ['/dashboard', '/reset-password', '/people', '/attendance', '/payroll', '/documents', '/announcements', '/tasks']

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  // Validate redirect is a safe relative path (prevent open redirect)
  const safeNext = ALLOWED_REDIRECTS.some(p => next.startsWith(p)) ? next : '/dashboard'
  const redirectUrl = new URL(safeNext, request.url)

  if (code) {
    const response = NextResponse.redirect(redirectUrl)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return response
    }
  }

  // If no code or exchange failed, redirect to login
  return NextResponse.redirect(new URL('/login', request.url))
}
