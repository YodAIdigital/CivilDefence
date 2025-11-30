import { supabase } from './client'
import type { Profile } from '@/types/database'

export interface AuthError {
  message: string
  status?: number | undefined
}

export interface AuthResult<T = void> {
  data: T | null
  error: AuthError | null
}

/**
 * Get the appropriate redirect URL for auth operations
 * Uses NEXT_PUBLIC_APP_URL in production, or sanitizes the current origin in development
 * Filters out invalid origins like 0.0.0.0
 */
function getAuthRedirectUrl(path: string): string {
  if (typeof window === 'undefined') {
    // Server-side: use configured APP_URL or fallback
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    return appUrl ? `${appUrl}${path}` : `http://localhost:3000${path}`
  }

  const origin = window.location.origin

  // If origin contains 0.0.0.0, this is invalid for OAuth redirects
  if (origin.includes('0.0.0.0')) {
    // Try to use the configured APP_URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl && !appUrl.includes('0.0.0.0')) {
      return `${appUrl}${path}`
    }
    // Fallback to localhost for local development
    return `http://localhost:3000${path}`
  }

  return `${origin}${path}`
}

/**
 * Sign up with email and password
 */
export async function signUp(
  email: string,
  password: string,
  metadata?: { full_name?: string }
): Promise<AuthResult<{ user: { id: string; email: string } }>> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata ?? {},
        emailRedirectTo: getAuthRedirectUrl('/auth/callback')
      }
    })

    if (error) {
      return { data: null, error: { message: error.message, status: error.status ?? undefined } }
    }

    if (data.user) {
      return {
        data: { user: { id: data.user.id, email: data.user.email! } },
        error: null
      }
    }

    return { data: null, error: { message: 'Failed to create account' } }
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult<{ user: { id: string; email: string } }>> {
  try {
    console.log('signIn: calling supabase.auth.signInWithPassword...')
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    console.log('signIn: got response', { data: !!data, error: error?.message })

    if (error) {
      console.log('signIn: error returned', error.message)
      return { data: null, error: { message: error.message, status: error.status ?? undefined } }
    }

    if (data.user) {
      console.log('signIn: success, user id:', data.user.id)
      return {
        data: { user: { id: data.user.id, email: data.user.email! } },
        error: null
      }
    }

    console.log('signIn: no user in response')
    return { data: null, error: { message: 'Failed to sign in' } }
  } catch (err) {
    console.error('signIn: caught exception', err)
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithOAuth(
  provider: 'google' | 'github' | 'facebook'
): Promise<AuthResult> {
  try {
    const redirectTo = getAuthRedirectUrl('/auth/callback')

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    })

    if (error) {
      return { data: null, error: { message: error.message, status: error.status ?? undefined } }
    }

    return { data: null, error: null }
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      return { data: null, error: { message: error.message, status: error.status ?? undefined } }
    }

    return { data: null, error: null }
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl('/auth/reset-password')
    })

    if (error) {
      return { data: null, error: { message: error.message, status: error.status ?? undefined } }
    }

    return { data: null, error: null }
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

/**
 * Update password (for authenticated users)
 */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      return { data: null, error: { message: error.message, status: error.status ?? undefined } }
    }

    return { data: null, error: null }
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

/**
 * Get current user's profile from database
 */
export async function getCurrentProfile(): Promise<AuthResult<Profile>> {
  try {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      return { data: null, error: { message: error.message } }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

/**
 * Update current user's profile
 */
export async function updateProfile(
  updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'phone' | 'location' | 'emergency_contact_name' | 'emergency_contact_phone' | 'notification_preferences'>>
): Promise<AuthResult<Profile>> {
  try {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      return { data: null, error: { message: error.message } }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: { user: { id: string; email: string } } | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(
      event,
      session?.user
        ? { user: { id: session.user.id, email: session.user.email! } }
        : null
    )
  })
}

/**
 * Verify email with OTP
 */
export async function verifyOtp(
  email: string,
  token: string,
  type: 'signup' | 'recovery' | 'email_change' = 'signup'
): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type
    })

    if (error) {
      return { data: null, error: { message: error.message, status: error.status ?? undefined } }
    }

    return { data: null, error: null }
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

/**
 * Resend verification email
 */
export async function resendVerification(email: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email
    })

    if (error) {
      return { data: null, error: { message: error.message, status: error.status ?? undefined } }
    }

    return { data: null, error: null }
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}
