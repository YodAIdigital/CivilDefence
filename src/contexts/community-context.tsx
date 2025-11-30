'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode
} from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from './auth-context'
import type { CommunityRole } from '@/types/database'

interface Community {
  id: string
  name: string
  description?: string
  location?: string
  member_count: number
  meeting_point_name?: string
  meeting_point_address?: string
  meeting_point_lat?: number
  meeting_point_lng?: number
  created_by?: string
}

// Community with user's role in that community
interface CommunityWithRole extends Community {
  userRole: CommunityRole
}

interface CommunityContextType {
  communities: CommunityWithRole[]
  activeCommunity: CommunityWithRole | null
  isLoading: boolean
  setActiveCommunity: (community: CommunityWithRole | null) => void
  refreshCommunities: () => Promise<void>
  // Helper functions for role checks on active community
  isActiveCommunityAdmin: boolean
  isActiveCommunityTeamMember: boolean
  canManageActiveCommunity: boolean // admin or team_member
  // Get role for a specific community
  getRoleForCommunity: (communityId: string) => CommunityRole | null
}

const ACTIVE_COMMUNITY_KEY = 'civildefence_active_community'

const CommunityContext = createContext<CommunityContextType | undefined>(undefined)

interface CommunityProviderProps {
  children: ReactNode
}

export function CommunityProvider({ children }: CommunityProviderProps) {
  const { user, isAuthenticated } = useAuth()
  const [communities, setCommunities] = useState<CommunityWithRole[]>([])
  const [activeCommunity, setActiveCommunityState] = useState<CommunityWithRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch user's communities with their roles
  const fetchCommunities = useCallback(async () => {
    if (!user?.id) {
      setCommunities([])
      setActiveCommunityState(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      // Get user's community memberships WITH roles
      const { data: memberships, error: membershipError } = await supabase
        .from('community_members')
        .select('community_id, role')
        .eq('user_id', user.id)

      if (membershipError) throw membershipError

      if (!memberships || memberships.length === 0) {
        setCommunities([])
        setActiveCommunityState(null)
        setIsLoading(false)
        return
      }

      // Create a map of community_id -> role
      const roleMap = new Map<string, CommunityRole>()
      memberships.forEach((m) => {
        roleMap.set(m.community_id, m.role as CommunityRole)
      })

      const communityIds = memberships.map((m) => m.community_id)

      // Get community details
      const { data: communityData, error: communityError } = await supabase
        .from('communities')
        .select('*')
        .in('id', communityIds)

      if (communityError) throw communityError

      // Merge community data with user roles
      const fetchedCommunities: CommunityWithRole[] = (communityData || []).map((c) => ({
        ...c,
        userRole: roleMap.get(c.id) || 'member'
      })) as CommunityWithRole[]

      setCommunities(fetchedCommunities)

      // Restore previously selected community from localStorage
      if (fetchedCommunities.length > 0) {
        const savedCommunityId = localStorage.getItem(ACTIVE_COMMUNITY_KEY)
        const savedCommunity = savedCommunityId
          ? fetchedCommunities.find((c) => c.id === savedCommunityId)
          : null

        if (savedCommunity) {
          setActiveCommunityState(savedCommunity)
        } else {
          // Default to first community
          const firstCommunity = fetchedCommunities[0]
          if (firstCommunity) {
            setActiveCommunityState(firstCommunity)
            localStorage.setItem(ACTIVE_COMMUNITY_KEY, firstCommunity.id)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching communities:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // Set active community and persist to localStorage
  const setActiveCommunity = useCallback((community: CommunityWithRole | null) => {
    setActiveCommunityState(community)
    if (community) {
      localStorage.setItem(ACTIVE_COMMUNITY_KEY, community.id)
    } else {
      localStorage.removeItem(ACTIVE_COMMUNITY_KEY)
    }
  }, [])

  // Get role for a specific community
  const getRoleForCommunity = useCallback((communityId: string): CommunityRole | null => {
    const community = communities.find(c => c.id === communityId)
    return community?.userRole || null
  }, [communities])

  // Role check helpers for active community
  const isActiveCommunityAdmin = useMemo(() => {
    return activeCommunity?.userRole === 'admin'
  }, [activeCommunity?.userRole])

  const isActiveCommunityTeamMember = useMemo(() => {
    return activeCommunity?.userRole === 'team_member'
  }, [activeCommunity?.userRole])

  const canManageActiveCommunity = useMemo(() => {
    return activeCommunity?.userRole === 'admin' || activeCommunity?.userRole === 'team_member'
  }, [activeCommunity?.userRole])

  // Fetch communities when user changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchCommunities()
    } else {
      setCommunities([])
      setActiveCommunityState(null)
      setIsLoading(false)
    }
  }, [isAuthenticated, fetchCommunities])

  const value: CommunityContextType = {
    communities,
    activeCommunity,
    isLoading,
    setActiveCommunity,
    refreshCommunities: fetchCommunities,
    isActiveCommunityAdmin,
    isActiveCommunityTeamMember,
    canManageActiveCommunity,
    getRoleForCommunity
  }

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>
}

export function useCommunity() {
  const context = useContext(CommunityContext)
  if (context === undefined) {
    throw new Error('useCommunity must be used within a CommunityProvider')
  }
  return context
}

// Export types for use in other components
export type { Community, CommunityWithRole }
