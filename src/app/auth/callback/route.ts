import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Get the correct base URL for redirects
 * Never uses request.url origin as it can be 0.0.0.0 in Docker
 */
function getBaseUrl(): string {
  // Always use production URL unless explicitly in development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000'
  }
  // Use configured APP_URL or fallback to production domain
  return process.env.NEXT_PUBLIC_APP_URL || 'https://civildefence.pro'
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  const cookieStore = await cookies()

  // Use correct base URL - never use requestUrl.origin as it can be 0.0.0.0 in Docker
  const baseUrl = getBaseUrl()

  // Track cookies that need to be set
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookies) {
          cookiesToSet.push(...cookies)
        },
      },
    }
  )

  // Handle PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Create response and set all cookies
      const response = NextResponse.redirect(new URL(next, baseUrl))
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    }

    console.error('Auth callback error (code exchange):', error.message, error)
    // Include error details in redirect for debugging
    const errorUrl = new URL('/login', baseUrl)
    errorUrl.searchParams.set('error', 'auth_callback_error')
    errorUrl.searchParams.set('error_description', error.message || 'Unknown error')
    return NextResponse.redirect(errorUrl)
  }

  // Handle email confirmation with token_hash
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'signup' | 'recovery' | 'email_change' | 'email'
    })

    if (!error) {
      // Create response and set all cookies
      const response = NextResponse.redirect(new URL(next, baseUrl))
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    }

    console.error('Auth callback error (token verification):', error)
    return NextResponse.redirect(new URL('/login?error=verification_error', baseUrl))
  }

  // If no code or token_hash, redirect to dashboard (session may already exist)
  return NextResponse.redirect(new URL('/dashboard', baseUrl))
}
