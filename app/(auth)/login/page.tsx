'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showReset, setShowReset] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        setError('Something went wrong. Please try again.')
      } else {
        setResetSent(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  if (showReset) {
    return (
      <div>
        {/* Mobile logo */}
        <div className="lg:hidden flex justify-center mb-8">
          <Image src="/logo.png" alt="Logo" width={56} height={50} />
        </div>

        <div className="bg-surface-card rounded-xl shadow-sm border border-surface-border p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-100">Reset Password</h1>
            <p className="text-sm text-gray-500 mt-1">
              Enter your email to receive a reset link
            </p>
          </div>

          {resetSent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-brand-50 text-brand flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Password reset email sent. Check your inbox.
              </p>
              <Button variant="ghost" onClick={() => { setShowReset(false); setResetSent(false) }}>
                Back to login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="bg-danger-50 text-danger text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
              <Input
                id="reset-email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <button
                type="button"
                onClick={() => { setShowReset(false); setError('') }}
                className="w-full text-sm text-gray-500 hover:text-gray-300"
              >
                Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Mobile logo */}
      <div className="lg:hidden flex justify-center mb-8">
        <Image src="/logo.png" alt="Logo" width={56} height={50} />
      </div>

      <div className="bg-surface-card rounded-xl shadow-sm border border-surface-border p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-100">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-danger-50 text-danger text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />

          <Input
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setShowReset(true); setError('') }}
            className="text-sm text-brand hover:text-brand-600 transition-colors"
          >
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  )
}
