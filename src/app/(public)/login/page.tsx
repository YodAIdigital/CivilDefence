'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { signIn, signInWithOAuth } from '@/lib/supabase/auth'
import { supabase } from '@/lib/supabase/client'
import { Logo } from '@/components/custom/logo'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check for error in URL params (from auth callback)
  useEffect(() => {
    if (!searchParams) return
    const urlError = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    if (urlError) {
      if (errorDescription) {
        setError(`Authentication failed: ${errorDescription}`)
      } else if (urlError === 'auth_callback_error') {
        setError('Authentication failed. Please try again.')
      } else if (urlError === 'verification_error') {
        setError('Email verification failed. Please try again.')
      } else {
        setError(`Authentication error: ${urlError}`)
      }
      // Clear URL params
      window.history.replaceState({}, '', '/login')
    }
  }, [searchParams])

  // Listen for auth state changes and redirect on sign in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Login page auth state changed:', event)
      if (event === 'SIGNED_IN' && session) {
        console.log('User signed in, redirecting to dashboard...')
        window.location.href = '/dashboard'
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Handle hash fragment tokens from email confirmation links
  useEffect(() => {
    const handleHashToken = async () => {
      // Check if there's a hash with access_token (from email confirmation)
      if (window.location.hash && window.location.hash.includes('access_token')) {
        console.log('Detected access token in URL hash, processing...')

        // Supabase client automatically detects and processes the hash
        const { data: { session }, error } = await supabase.auth.getSession()

        if (session && !error) {
          console.log('Session established from hash token, redirecting...')
          window.location.href = '/dashboard'
          return
        }

        if (error) {
          console.error('Error processing hash token:', error)
          setError('Failed to verify email. Please try logging in.')
        }

        // Clear the problematic URL
        window.history.replaceState(null, '', '/login')
      }
    }

    handleHashToken()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      console.log('Attempting sign in...')
      const result = await signIn(email, password)
      console.log('Sign in result:', result)

      if (result.error) {
        setError(result.error.message)
        setIsLoading(false)
        return
      }

      // Redirect to dashboard on success
      console.log('Sign in successful, redirecting...')
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('Sign in error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <Logo size="md" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your CivilDefence account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                disabled={isLoading}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              type="button"
              disabled={isLoading}
              onClick={() => signInWithOAuth('google')}
              className="w-full"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
