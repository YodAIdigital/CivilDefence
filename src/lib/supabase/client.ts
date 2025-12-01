import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables (only warn in development)
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.error('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  })
}

/**
 * Get the correct site URL for auth redirects
 * Never uses window.location to avoid Docker/PWA issues
 */
function getSiteUrl(): string {
  // Check if we're in a browser and on localhost
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000'
    }
  }
  // Always use production URL in production
  return 'https://civildefence.pro'
}

/**
 * Supabase client for client-side operations
 * Uses the anonymous key for public operations
 * Typed with Database schema for type safety
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: typeof window !== 'undefined',
      detectSessionInUrl: typeof window !== 'undefined',
      storageKey: 'civil-defence-auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // Explicitly set the flow type and site URL to prevent 0.0.0.0 issues
      flowType: 'pkce'
    },
    global: {
      headers: {
        'x-client-info': 'civildefencepro'
      }
    }
  }
)

// Export getSiteUrl for use in auth functions
export { getSiteUrl }

/**
 * Get the current session
 */
export async function getSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession()
  if (error) {
    console.error('Error getting session:', error)
    return null
  }
  return session
}

/**
 * Get the current user
 */
export async function getUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()
  if (error) {
    console.error('Error getting user:', error)
    return null
  }
  return user
}