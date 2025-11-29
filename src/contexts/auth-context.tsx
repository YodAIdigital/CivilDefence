'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode
} from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    isAuthenticated: false
  })

  // Fetch user profile from database
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      return data
    } catch (err) {
      console.error('Error fetching profile:', err)
      return null
    }
  }, [])

  // Initialize auth state
  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout

    const initializeAuth = async () => {
      try {
        // Set a timeout to prevent hanging - will set loading to false after 5s
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.warn('Auth initialization timed out, proceeding as unauthenticated')
            setState({
              user: null,
              profile: null,
              session: null,
              isLoading: false,
              isAuthenticated: false
            })
          }
        }, 5000)

        const { data: { session }, error } = await supabase.auth.getSession()

        // Clear the timeout since we got a response
        clearTimeout(timeoutId)

        if (error) {
          console.error('Error getting session:', error)
        }

        if (!isMounted) return

        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          if (!isMounted) return
          setState({
            user: session.user,
            profile,
            session,
            isLoading: false,
            isAuthenticated: true
          })
        } else {
          setState({
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            isAuthenticated: false
          })
        }
      } catch (err) {
        console.error('Error initializing auth:', err)
        clearTimeout(timeoutId)
        if (isMounted) {
          setState({
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            isAuthenticated: false
          })
        }
      }
    }

    initializeAuth()

    // Subscribe to auth changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return

      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        if (!isMounted) return
        setState({
          user: session.user,
          profile,
          session,
          isLoading: false,
          isAuthenticated: true
        })
      } else {
        setState({
          user: null,
          profile: null,
          session: null,
          isLoading: false,
          isAuthenticated: false
        })
      }
    })

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    if (state.user) {
      const profile = await fetchProfile(state.user.id)
      setState((prev) => ({ ...prev, profile }))
    }
  }, [state.user, fetchProfile])

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState({
      user: null,
      profile: null,
      session: null,
      isLoading: false,
      isAuthenticated: false
    })
  }, [])

  const value: AuthContextType = {
    ...state,
    refreshProfile,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Default auth state for SSR/when context is not available
const defaultAuthState: AuthContextType = {
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  refreshProfile: async () => {},
  signOut: async () => {}
}

export function useAuth() {
  const context = useContext(AuthContext)
  // Return default state during SSR or when outside provider
  if (context === undefined) {
    return defaultAuthState
  }
  return context
}

// Hook for checking specific roles
export function useRole() {
  const { profile } = useAuth()

  const isSuperAdmin = profile?.role === 'super_admin'
  const isAdmin = profile?.role === 'admin' || isSuperAdmin
  const isMember = profile?.role === 'member' || isAdmin

  return {
    isSuperAdmin,
    isAdmin,
    isMember,
    role: profile?.role ?? null
  }
}

// Hook for protecting routes/components
export function useRequireAuth(redirectTo: string = '/login') {
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = redirectTo
    }
  }, [isAuthenticated, isLoading, redirectTo])

  return { isAuthenticated, isLoading }
}
