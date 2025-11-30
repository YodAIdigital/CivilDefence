'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { CommunityLocationsManager } from '@/components/maps/community-locations-manager'
import { ContactsManager } from '@/components/community/contacts-manager'
import { Search, UserPlus, X, Mail, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Community, Profile, CommunityRole, CommunityContact, CommunityMapPoint, CreateCommunityMapPoint, UpdateCommunityMapPoint, Json } from '@/types/database'
import { COMMUNITY_ROLE_CONFIG } from '@/types/database'

interface CommunityMemberWithProfile {
  id: string
  user_id: string
  community_id: string
  role: CommunityRole
  joined_at: string
  profile: Profile | null
}

interface PendingInvitation {
  id: string
  email: string
  role: CommunityRole
  status: string
  created_at: string
  expires_at: string
}

type TabType = 'events' | 'members' | 'visibility'

export default function CommunityManagePage() {
  const params = useParams()
  const communityId = params?.id as string
  const { user } = useAuth()

  const [community, setCommunity] = useState<Community | null>(null)
  const [members, setMembers] = useState<CommunityMemberWithProfile[]>([])
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<CommunityContact[]>([])
  const [isSavingContacts, setIsSavingContacts] = useState(false)
  const [mapPoints, setMapPoints] = useState<CommunityMapPoint[]>([])
  const [isSavingMapPoints, setIsSavingMapPoints] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('members')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<CommunityRole>('member')
  const [isInviting, setIsInviting] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user || !communityId) return

    try {
      setIsLoading(true)

      // Fetch community details
      const { data: communityData, error: communityError } = await supabase
        .from('communities')
        .select('*')
        .eq('id', communityId)
        .single()

      if (communityError) throw communityError
      setCommunity(communityData)

      // Load contacts from settings
      const settings = communityData.settings as { contacts?: CommunityContact[] } | null
      if (settings?.contacts) {
        setContacts(settings.contacts)
      } else {
        setContacts([])
      }

      // Fetch map points
      const { data: mapPointsData } = await (supabase
        .from('community_map_points' as 'profiles')
        .select('*')
        .eq('community_id', communityId)
        .order('display_order', { ascending: true }) as unknown as Promise<{ data: CommunityMapPoint[] | null; error: Error | null }>)

      if (mapPointsData) {
        setMapPoints(mapPointsData)
      }

      // Check if current user is admin of this community
      const { data: membershipData, error: membershipError } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
        .single()

      if (membershipError) {
        setIsAdmin(false)
        return
      }

      const userIsAdmin = membershipData.role === 'admin' || membershipData.role === 'super_admin'
      setIsAdmin(userIsAdmin)

      if (!userIsAdmin) return

      // Fetch all community members with their profiles
      const { data: membersData, error: membersError } = await supabase
        .from('community_members')
        .select(`
          id,
          user_id,
          community_id,
          role,
          joined_at
        `)
        .eq('community_id', communityId)
        .order('joined_at', { ascending: true })

      if (membersError) throw membersError

      // Fetch profiles for all members
      const userIds = membersData.map(m => m.user_id)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      if (profilesError) throw profilesError

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || [])

      const membersWithProfiles: CommunityMemberWithProfile[] = membersData.map(m => ({
        ...m,
        role: m.role as CommunityRole,
        profile: profilesMap.get(m.user_id) || null
      }))

      setMembers(membersWithProfiles)

      // Fetch pending invitations
      try {
        const supabaseAny = supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              eq: (col: string, val: string) => {
                eq: (col: string, val: string) => {
                  order: (col: string, opts: { ascending: boolean }) => Promise<{ data: PendingInvitation[] | null; error: Error | null }>
                }
              }
            }
          }
        }
        const { data: invitationsData } = await supabaseAny
          .from('community_invitations')
          .select('*')
          .eq('community_id', communityId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (invitationsData) {
          setPendingInvitations(invitationsData)
        }
      } catch {
        // Table might not exist yet
        setPendingInvitations([])
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load community data')
    } finally {
      setIsLoading(false)
    }
  }, [user, communityId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members
    const query = searchQuery.toLowerCase()
    return members.filter(member => {
      const name = member.profile?.full_name?.toLowerCase() || ''
      const email = member.profile?.email?.toLowerCase() || ''
      return name.includes(query) || email.includes(query)
    })
  }, [members, searchQuery])

  const updateMemberRole = async (memberId: string, newRole: CommunityRole) => {
    try {
      setUpdatingMemberId(memberId)
      setError(null)

      const { error } = await supabase
        .from('community_members')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) throw error

      await fetchData()
      setSuccess(`Member role updated to ${newRole}`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating member role:', err)
      setError('Failed to update member role')
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const removeMember = async (memberId: string, memberUserId: string) => {
    // Prevent removing yourself if you're the only admin
    const admins = members.filter(m => m.role === 'admin')
    if (memberUserId === user?.id && admins.length === 1) {
      setError('Cannot remove yourself - you are the only admin. Promote another member first.')
      return
    }

    if (!confirm('Are you sure you want to remove this member from the community?')) return

    try {
      setUpdatingMemberId(memberId)
      setError(null)

      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      await fetchData()
      setSuccess('Member removed from community')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error removing member:', err)
      setError('Failed to remove member')
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      setError('Please enter an email address')
      return
    }

    if (!user) {
      setError('You must be logged in to invite users')
      return
    }

    try {
      setIsInviting(true)
      setError(null)

      const emailLower = inviteEmail.toLowerCase().trim()

      // Check if user is already a member
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', emailLower)
        .single()

      if (existingProfile) {
        // Check if already a member
        const { data: existingMember } = await supabase
          .from('community_members')
          .select('id')
          .eq('community_id', communityId)
          .eq('user_id', existingProfile.id)
          .single()

        if (existingMember) {
          setError('This user is already a member of this community')
          return
        }
      }

      // Create invitation in database
      const supabaseAny = supabase as unknown as {
        from: (table: string) => {
          insert: (data: unknown) => {
            select: () => {
              single: () => Promise<{ data: PendingInvitation | null; error: { message: string } | null }>
            }
          }
        }
      }

      const { data: invitation, error: inviteError } = await supabaseAny
        .from('community_invitations')
        .insert({
          community_id: communityId,
          email: emailLower,
          role: inviteRole,
          invited_by: user.id,
          status: 'pending'
        })
        .select()
        .single()

      if (inviteError) {
        // Check if it's a duplicate invitation error
        if (inviteError.message?.includes('unique') || inviteError.message?.includes('duplicate')) {
          setError('An invitation has already been sent to this email address')
          return
        }
        throw new Error(inviteError.message || 'Failed to create invitation')
      }

      // If user already exists, add them directly
      if (existingProfile) {
        const { error: memberError } = await supabase
          .from('community_members')
          .insert({
            community_id: communityId,
            user_id: existingProfile.id,
            role: inviteRole
          })

        if (memberError) throw memberError

        // Update invitation status
        if (invitation) {
          await (supabase as unknown as {
            from: (table: string) => {
              update: (data: unknown) => {
                eq: (col: string, val: string) => Promise<{ error: Error | null }>
              }
            }
          })
            .from('community_invitations')
            .update({ status: 'accepted', accepted_at: new Date().toISOString() })
            .eq('id', invitation.id)
        }

        setSuccess(`${inviteEmail} has been added to the community as ${COMMUNITY_ROLE_CONFIG[inviteRole].label}`)
      } else {
        // User doesn't exist - send invitation email
        if (invitation) {
          try {
            // Fetch the invitation with token
            const { data: inviteWithToken } = await (supabase as unknown as {
              from: (table: string) => {
                select: (cols: string) => {
                  eq: (col: string, val: string) => {
                    single: () => Promise<{ data: { token: string } | null; error: Error | null }>
                  }
                }
              }
            })
              .from('community_invitations')
              .select('token')
              .eq('id', invitation.id)
              .single()

            if (inviteWithToken?.token) {
              // Send invitation email via API
              await fetch('/api/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  invitationId: invitation.id,
                  communityId,
                  email: emailLower,
                  role: inviteRole,
                  invitedBy: user.id,
                  token: inviteWithToken.token,
                }),
              })
            }
          } catch (emailError) {
            console.error('Failed to send invitation email:', emailError)
            // Don't fail the invitation if email fails
          }
        }
        setSuccess(`Invitation sent to ${inviteEmail}. They will be added as ${COMMUNITY_ROLE_CONFIG[inviteRole].label} when they create an account.`)
      }

      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('member')
      await fetchData()
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      console.error('Error inviting user:', err)
      setError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    try {
      const supabaseAny = supabase as unknown as {
        from: (table: string) => {
          update: (data: unknown) => {
            eq: (col: string, val: string) => Promise<{ error: Error | null }>
          }
        }
      }

      const { error } = await supabaseAny
        .from('community_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId)

      if (error) throw error

      await fetchData()
      setSuccess('Invitation cancelled')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error cancelling invitation:', err)
      setError('Failed to cancel invitation')
    }
  }

  const saveContacts = async (newContacts: CommunityContact[]) => {
    if (!community) return

    try {
      setIsSavingContacts(true)
      setError(null)

      // Merge new contacts with existing settings
      const existingSettings = (community.settings as Record<string, unknown>) || {}
      const updatedSettings = {
        ...existingSettings,
        contacts: newContacts,
      }

      const { error } = await supabase
        .from('communities')
        .update({
          settings: updatedSettings as unknown as Json,
        })
        .eq('id', community.id)

      if (error) throw error

      setContacts(newContacts)
      setCommunity({ ...community, settings: updatedSettings as unknown as Json })
      setSuccess('Contacts updated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error saving contacts:', err)
      setError('Failed to save contacts')
    } finally {
      setIsSavingContacts(false)
    }
  }

  const toggleVisibility = async () => {
    if (!community) return

    try {
      setError(null)

      const { error } = await supabase
        .from('communities')
        .update({ is_public: !community.is_public })
        .eq('id', community.id)

      if (error) throw error

      setCommunity({ ...community, is_public: !community.is_public })
      setSuccess(`Community is now ${!community.is_public ? 'public' : 'private'}`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating visibility:', err)
      setError('Failed to update community visibility')
    }
  }

  const addMapPoint = async (point: CreateCommunityMapPoint) => {
    try {
      setIsSavingMapPoints(true)
      setError(null)

      const pointData = { ...point }

      const supabaseAny = supabase as unknown as { from: (table: string) => { insert: (data: unknown) => { select: () => { single: () => Promise<{ data: CommunityMapPoint | null; error: { message: string; code?: string } | null }> } } } }
      const { data, error } = await supabaseAny
        .from('community_map_points')
        .insert(pointData)
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message || 'Database error')
      }
      if (data) {
        setMapPoints(prev => [...prev, data])
      }

      setSuccess('Map point added successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error adding map point:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to add map point'
      setError(errorMessage)
    } finally {
      setIsSavingMapPoints(false)
    }
  }

  const updateMapPoint = async (id: string, point: UpdateCommunityMapPoint) => {
    try {
      setIsSavingMapPoints(true)
      setError(null)

      const supabaseAny = supabase as unknown as { from: (table: string) => { update: (data: unknown) => { eq: (col: string, val: string) => { select: () => { single: () => Promise<{ data: CommunityMapPoint | null; error: Error | null }> } } } } }
      const { data, error } = await supabaseAny
        .from('community_map_points')
        .update(point)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (data) {
        setMapPoints(prev => prev.map(p => p.id === id ? data : p))
      }

      setSuccess('Map point updated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating map point:', err)
      setError('Failed to update map point')
    } finally {
      setIsSavingMapPoints(false)
    }
  }

  const deleteMapPoint = async (id: string) => {
    try {
      setIsSavingMapPoints(true)
      setError(null)

      const supabaseAny = supabase as unknown as { from: (table: string) => { delete: () => { eq: (col: string, val: string) => Promise<{ error: Error | null }> } } }
      const { error } = await supabaseAny
        .from('community_map_points')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMapPoints(prev => prev.filter(p => p.id !== id))
      setSuccess('Map point deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting map point:', err)
      setError('Failed to delete map point')
    } finally {
      setIsSavingMapPoints(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="material-icons animate-spin text-4xl text-primary">sync</span>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <span className="material-icons text-6xl text-destructive">block</span>
        <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">
          You must be a community admin to access this page.
        </p>
        <Link
          href="/community"
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Back to Communities
        </Link>
      </div>
    )
  }

  const tabs = [
    { id: 'members' as TabType, label: `${members.length} Members`, icon: 'people' },
    { id: 'events' as TabType, label: 'Manage Events', icon: 'event', href: `/community/${communityId}/events` },
    { id: 'visibility' as TabType, label: community?.is_public ? 'Public' : 'Private', icon: community?.is_public ? 'public' : 'lock' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/community" className="hover:text-foreground">Communities</Link>
            <span className="material-icons text-sm">chevron_right</span>
            <span>{community?.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Manage Community</h1>
          <p className="mt-1 text-muted-foreground">
            Manage members, roles, and community settings.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <span className="material-icons text-lg">admin_panel_settings</span>
          Community Admin
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-50 p-4 text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id

          const tabContent = (
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                tab.id === 'events' ? 'bg-[#FEB100]/20' :
                tab.id === 'members' ? 'bg-[#FEB100]/20' :
                'bg-green-500/10'
              }`}>
                <span className={`material-icons text-2xl ${
                  tab.id === 'events' ? 'text-[#FEB100]' :
                  tab.id === 'members' ? 'text-[#FEB100]' :
                  'text-green-500'
                }`}>{tab.icon}</span>
              </div>
              <div>
                <h3 className="font-semibold">{tab.label}</h3>
                <p className="text-sm text-muted-foreground">
                  {tab.id === 'events' && 'Schedule community events'}
                  {tab.id === 'members' && `${members.filter(m => m.role === 'admin').length} admins, ${members.filter(m => m.role === 'team_member').length} team members`}
                  {tab.id === 'visibility' && 'Community visibility'}
                </p>
              </div>
            </div>
          )

          if (tab.id === 'events') {
            return (
              <Link
                key={tab.id}
                href={tab.href as `/community/${string}/events`}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors"
              >
                {tabContent}
              </Link>
            )
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl border p-5 text-left transition-colors ${
                isActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              {tabContent}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'members' && (
        <>
          {/* Members List */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold">Community Members</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage member roles and permissions
                  </p>
                </div>
              </div>

              {/* Search Bar and Invite Button - Inline */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => setShowInviteModal(true)} className="gap-2 shrink-0">
                  <UserPlus className="h-4 w-4" />
                  Invite Member
                </Button>
              </div>
            </div>

            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <div className="border-b border-border bg-amber-50/50 dark:bg-amber-900/10">
                <div className="px-4 py-2">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Pending Invitations ({pendingInvitations.length})
                  </p>
                </div>
                <div className="divide-y divide-amber-200/50 dark:divide-amber-800/50">
                  {pendingInvitations.map(invitation => {
                    const roleConfig = COMMUNITY_ROLE_CONFIG[invitation.role as keyof typeof COMMUNITY_ROLE_CONFIG]
                    return (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                            <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{invitation.email}</span>
                              {roleConfig && (
                                <span
                                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{
                                    backgroundColor: `${roleConfig.color}20`,
                                    color: roleConfig.color
                                  }}
                                >
                                  {roleConfig.label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Invited {new Date(invitation.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => cancelInvitation(invitation.id)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Cancel
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="divide-y divide-border">
              {filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchQuery ? 'No members found matching your search' : 'No members yet'}
                </div>
              ) : (
                filteredMembers.map(member => {
                  const isCurrentUser = member.user_id === user?.id
                  const roleConfig = COMMUNITY_ROLE_CONFIG[member.role as keyof typeof COMMUNITY_ROLE_CONFIG]

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <span className="material-icons text-primary">person</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {member.profile?.full_name || member.profile?.email || 'Unknown User'}
                            </span>
                            {isCurrentUser && (
                              <span className="text-xs text-muted-foreground">(You)</span>
                            )}
                            {member.role !== 'member' && roleConfig && (
                              <span
                                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor: `${roleConfig.color}20`,
                                  color: roleConfig.color
                                }}
                              >
                                <span className="material-icons text-xs">{roleConfig.icon}</span>
                                {roleConfig.label}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {member.profile?.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Role selector */}
                        <select
                          value={member.role}
                          onChange={(e) => updateMemberRole(member.id, e.target.value as CommunityRole)}
                          disabled={updatingMemberId === member.id}
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                        >
                          <option value="member">Member</option>
                          <option value="team_member">Team Member</option>
                          <option value="admin">Admin</option>
                        </select>

                        {/* Remove button */}
                        {!isCurrentUser && (
                          <button
                            onClick={() => removeMember(member.id, member.user_id)}
                            disabled={updatingMemberId === member.id}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                            title="Remove member"
                          >
                            {updatingMemberId === member.id ? (
                              <span className="material-icons animate-spin text-lg">sync</span>
                            ) : (
                              <span className="material-icons text-lg">person_remove</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Help Text */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <span className="material-icons text-xl text-[#FEB100]">help</span>
              About Roles
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Each member can have a different role in each community they belong to.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="material-icons text-sm" style={{ color: COMMUNITY_ROLE_CONFIG.member.color }}>arrow_right</span>
                <span><strong>Member:</strong> {COMMUNITY_ROLE_CONFIG.member.description}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-icons text-sm" style={{ color: COMMUNITY_ROLE_CONFIG.team_member.color }}>arrow_right</span>
                <span><strong>Team Member:</strong> {COMMUNITY_ROLE_CONFIG.team_member.description}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-icons text-sm" style={{ color: COMMUNITY_ROLE_CONFIG.admin.color }}>arrow_right</span>
                <span><strong>Admin:</strong> {COMMUNITY_ROLE_CONFIG.admin.description}</span>
              </li>
            </ul>
          </div>
        </>
      )}

      {activeTab === 'visibility' && (
        <div className="space-y-6">
          {/* Visibility Settings */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="text-lg font-semibold">Community Visibility</h2>
              <p className="text-sm text-muted-foreground">
                Control who can find and join your community
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    community?.is_public ? 'bg-green-500/10' : 'bg-amber-500/10'
                  }`}>
                    <span className={`material-icons text-2xl ${
                      community?.is_public ? 'text-green-500' : 'text-amber-500'
                    }`}>
                      {community?.is_public ? 'public' : 'lock'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{community?.is_public ? 'Public Community' : 'Private Community'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {community?.is_public
                        ? 'Anyone can find and request to join this community'
                        : 'Only invited users can join this community'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={toggleVisibility}
                >
                  {community?.is_public ? 'Make Private' : 'Make Public'}
                </Button>
              </div>
            </div>
          </div>

          {/* Locations Section */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span className="material-icons text-green-500">map</span>
                Community Locations
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage meeting points and key reference locations for your community. Control who can see each location.
              </p>
            </div>
            <div className="p-4">
              {user && (
                <CommunityLocationsManager
                  communityId={communityId}
                  userId={user.id}
                  points={mapPoints}
                  onAdd={addMapPoint}
                  onUpdate={updateMapPoint}
                  onDelete={deleteMapPoint}
                  isSaving={isSavingMapPoints}
                />
              )}
            </div>
          </div>

          {/* Community Contacts Section */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span className="material-icons text-[#FEB100]">contact_phone</span>
                Key Contacts & Roles
              </h2>
              <p className="text-sm text-muted-foreground">
                Define key roles and contacts for your community. These will be visible to all members.
              </p>
            </div>
            <div className="p-4">
              <ContactsManager
                contacts={contacts}
                members={members}
                onSave={saveContacts}
                isSaving={isSavingContacts}
              />
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Invite Member</h2>
              <button
                onClick={() => {
                  setShowInviteModal(false)
                  setInviteEmail('')
                  setInviteRole('member')
                }}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inviteEmail.trim()) {
                      handleInviteUser()
                    }
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  An invitation will be sent to this email address
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Member Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as CommunityRole)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                >
                  <option value="member">Community Member</option>
                  <option value="team_member">Team Member</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {inviteRole === 'admin' && 'Full control over community settings and members'}
                  {inviteRole === 'team_member' && 'Can manage response plans, map points, and community content'}
                  {inviteRole === 'member' && 'Can view community content and participate in events'}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowInviteModal(false)
                    setInviteEmail('')
                    setInviteRole('member')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleInviteUser}
                  disabled={isInviting || !inviteEmail.trim()}
                >
                  {isInviting ? (
                    <>
                      <span className="material-icons animate-spin text-lg mr-2">sync</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
