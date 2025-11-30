import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  const cookieStore = await cookies()

  // Create response that we'll add cookies to
  const response = NextResponse.redirect(new URL(next, requestUrl.origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Handle PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return response
    }

    console.error('Auth callback error (code exchange):', error)
    return NextResponse.redirect(new URL('/login?error=auth_callback_error', requestUrl.origin))
  }

  // Handle email confirmation with token_hash
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'signup' | 'recovery' | 'email_change' | 'email'
    })

    if (!error) {
      return response
    }

    console.error('Auth callback error (token verification):', error)
    return NextResponse.redirect(new URL('/login?error=verification_error', requestUrl.origin))
  }

  // If no code or token_hash, redirect to dashboard (session may already exist)
  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
}
