import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

/**
 * Create a Supabase client for server-side operations
 * Uses service key for admin operations (bypasses RLS)
 */
export function createServerClient() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Create a Supabase client with user context from cookies
 * Respects RLS policies based on authenticated user
 */
export async function createServerClientWithAuth() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value
  const refreshToken = cookieStore.get('sb-refresh-token')?.value

  const client = createClient<Database>(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'x-app-name': 'civil-defence-expo'
        }
      }
    }
  )

  if (accessToken && refreshToken) {
    await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })
  }

  return client
}

/**
 * Get the current user from server context
 */
export async function getServerUser() {
  const client = await createServerClientWithAuth()
  const {
    data: { user },
    error
  } = await client.auth.getUser()

  if (error) {
    console.error('Error getting server user:', error)
    return null
  }

  return user
}

/**
 * Admin operations client - USE WITH CAUTION
 * Bypasses all RLS policies
 */
export function createAdminClient() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
