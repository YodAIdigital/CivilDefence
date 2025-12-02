'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { CommunityLocationsManager } from '@/components/maps/community-locations-manager'
import { ContactsManager } from '@/components/community/contacts-manager'
import { RegionEditor } from '@/components/maps/region-editor'
import { MemberSearchFilter } from '@/components/community/member-search-filter'
import { MemberProfileCard } from '@/components/community/member-profile-card'
import { UserPlus, X, Mail, Clock, Bell, AlertTriangle, AlertCircle, Info, CheckCircle, MessageSquare, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Community, Profile, CommunityRole, CommunityContact, CommunityMapPoint, CreateCommunityMapPoint, UpdateCommunityMapPoint, Json, RegionPolygon } from '@/types/database'
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

type TabType = 'alerts' | 'members' | 'events' | 'visibility'
type AlertLevel = 'info' | 'warning' | 'danger'
type RecipientGroup = 'admin' | 'team' | 'members' | 'specific'

const ALERT_LEVEL_CONFIG = {
  info: {
    label: 'General Announcement',
    description: 'Shown as a green alert',
    color: '#22c55e',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: Info,
  },
  warning: {
    label: 'Warning',
    description: 'Shown as an amber alert',
    color: '#f59e0b',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
  },
  danger: {
    label: 'Emergency',
    description: 'Shown as a red alert',
    color: '#ef4444',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: AlertCircle,
  },
} as const

const RECIPIENT_GROUP_CONFIG = {
  admin: {
    label: 'Admins',
    description: 'Only community administrators',
  },
  team: {
    label: 'Team',
    description: 'Admins and team members',
  },
  members: {
    label: 'All Members',
    description: 'Everyone in the community',
  },
  specific: {
    label: 'Select Members',
    description: 'Choose specific members',
  },
} as const

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
  const [isSavingRegion, setIsSavingRegion] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('alerts')

  // Alert history state
  interface AlertHistoryItem {
    id: string
    title: string
    content: string
    level: string
    created_at: string
    author_id: string
    sent_via_email: boolean
    sent_via_sms: boolean
    sent_via_app: boolean
    recipient_count: number
    email_sent_count: number
    sms_sent_count: number
    recipient_group: string
    author?: {
      full_name: string | null
      email: string | null
    }
  }
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([])
  const [_isLoadingAlertHistory, _setIsLoadingAlertHistory] = useState(false)

  // Filter state - filteredMembers is managed by MemberSearchFilter component
  const [displayedMembers, setDisplayedMembers] = useState<CommunityMemberWithProfile[]>([])

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<CommunityRole>('member')
  const [isInviting, setIsInviting] = useState(false)

  // Community name/description editing state
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedDescription, setEditedDescription] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)
  const [isSavingDescription, setIsSavingDescription] = useState(false)

  // Alert form state (modal removed - now using tab)
  const [_showAlertModal, _setShowAlertModal] = useState(false)
  const [alertTitle, setAlertTitle] = useState('')
  const [alertMessage, setAlertMessage] = useState('')
  const [alertLevel, setAlertLevel] = useState<AlertLevel>('info')
  const [alertRecipientGroup, setAlertRecipientGroup] = useState<RecipientGroup>('members')
  const [alertSelectedMembers, setAlertSelectedMembers] = useState<string[]>([])
  const [alertSendEmail, setAlertSendEmail] = useState(true)
  const [alertSendSms, setAlertSendSms] = useState(false)
  const [alertSendAppAlert, setAlertSendAppAlert] = useState(true)
  const [isSendingAlert, setIsSendingAlert] = useState(false)

  // Collapsible section states - all collapsed by default
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    'send-alert': true,
    'alert-history': true,
    'members': true,
    'contacts': true,
    'about-roles': true,
    'community-name': true,
    'visibility': true,
    'region': true,
    'locations': true,
  })

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

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

      // Fetch alert history
      try {
        const { data: alertsData } = await supabase
          .from('alerts')
          .select(`
            id,
            title,
            content,
            level,
            created_at,
            author_id,
            sent_via_email,
            sent_via_sms,
            sent_via_app,
            recipient_count,
            email_sent_count,
            sms_sent_count,
            recipient_group
          `)
          .eq('community_id', communityId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (alertsData && alertsData.length > 0) {
          // Fetch author profiles
          const authorIds = Array.from(new Set(alertsData.map(a => a.author_id)))
          const { data: authorsData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', authorIds)

          const authorsMap = new Map(authorsData?.map(a => [a.id, a]) || [])

          const alertsWithAuthors = alertsData.map(alert => ({
            ...alert,
            sent_via_email: alert.sent_via_email ?? false,
            sent_via_sms: alert.sent_via_sms ?? false,
            sent_via_app: alert.sent_via_app ?? true,
            recipient_count: alert.recipient_count ?? 0,
            email_sent_count: alert.email_sent_count ?? 0,
            sms_sent_count: alert.sms_sent_count ?? 0,
            recipient_group: alert.recipient_group ?? 'members',
            author: authorsMap.get(alert.author_id) || null,
          }))

          setAlertHistory(alertsWithAuthors as AlertHistoryItem[])
        }
      } catch {
        // Alert history columns might not exist yet
        console.log('Could not fetch alert history')
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

  // Handler for when MemberSearchFilter updates the filtered results
  const handleFilteredMembersChange = useCallback((filtered: CommunityMemberWithProfile[]) => {
    setDisplayedMembers(filtered)
  }, [])

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

  const handleSendAlert = async () => {
    if (!alertTitle.trim()) {
      setError('Please enter an alert title')
      return
    }

    if (!alertMessage.trim()) {
      setError('Please enter an alert message')
      return
    }

    if (!alertSendEmail && !alertSendSms && !alertSendAppAlert) {
      setError('Please select at least one delivery method')
      return
    }

    if (alertRecipientGroup === 'specific' && alertSelectedMembers.length === 0) {
      setError('Please select at least one member')
      return
    }

    try {
      setIsSendingAlert(true)
      setError(null)

      const response = await fetch('/api/community-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityId,
          senderId: user?.id,
          title: alertTitle,
          message: alertMessage,
          alertLevel,
          recipientGroup: alertRecipientGroup,
          specificMemberIds: alertRecipientGroup === 'specific' ? alertSelectedMembers : undefined,
          sendEmail: alertSendEmail,
          sendSms: alertSendSms,
          sendAppAlert: alertSendAppAlert,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send alert')
      }

      // Reset form
      // Modal was removed - now using tab
      setAlertTitle('')
      setAlertMessage('')
      setAlertLevel('info')
      setAlertRecipientGroup('members')
      setAlertSelectedMembers([])
      setAlertSendEmail(true)
      setAlertSendSms(false)
      setAlertSendAppAlert(true)

      const deliveryMethods = []
      if (alertSendAppAlert) deliveryMethods.push('app alert')
      if (alertSendEmail && data.emailsSent > 0) deliveryMethods.push(`${data.emailsSent} email${data.emailsSent > 1 ? 's' : ''}`)
      if (alertSendSms && data.smsSent > 0) deliveryMethods.push(`${data.smsSent} SMS`)

      setSuccess(`Alert sent to ${data.recipientCount} recipient${data.recipientCount > 1 ? 's' : ''} (${deliveryMethods.join(', ')})`)
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      console.error('Error sending alert:', err)
      setError(err instanceof Error ? err.message : 'Failed to send alert')
    } finally {
      setIsSendingAlert(false)
    }
  }

  const toggleMemberSelection = (userId: string) => {
    setAlertSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
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

  const saveCommunityName = async () => {
    if (!community || !editedName.trim()) return

    try {
      setIsSavingName(true)
      setError(null)

      const { error } = await supabase
        .from('communities')
        .update({ name: editedName.trim() })
        .eq('id', community.id)

      if (error) throw error

      setCommunity({ ...community, name: editedName.trim() })
      setIsEditingName(false)
      setSuccess('Community name updated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating community name:', err)
      setError('Failed to update community name')
    } finally {
      setIsSavingName(false)
    }
  }

  const saveCommunityDescription = async () => {
    if (!community) return

    try {
      setIsSavingDescription(true)
      setError(null)

      const { error } = await supabase
        .from('communities')
        .update({ description: editedDescription.trim() || null })
        .eq('id', community.id)

      if (error) throw error

      setCommunity({ ...community, description: editedDescription.trim() || null })
      setIsEditingDescription(false)
      setSuccess('Community description updated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating community description:', err)
      setError('Failed to update community description')
    } finally {
      setIsSavingDescription(false)
    }
  }

  const saveRegion = async (polygon: RegionPolygon | null, color: string, opacity: number) => {
    if (!community) return

    try {
      setIsSavingRegion(true)
      setError(null)

      const { error } = await supabase
        .from('communities')
        .update({
          region_polygon: polygon as unknown as Json,
          region_color: color,
          region_opacity: opacity,
        })
        .eq('id', community.id)

      if (error) throw error

      setCommunity({
        ...community,
        region_polygon: polygon as unknown as Json,
        region_color: color,
        region_opacity: opacity,
      } as Community)
      setSuccess(polygon ? 'Community region saved successfully' : 'Community region cleared')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error saving region:', err)
      setError('Failed to save community region')
    } finally {
      setIsSavingRegion(false)
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
    { id: 'alerts' as TabType, label: 'Send Alert', icon: 'campaign', description: 'Send alerts to members' },
    { id: 'members' as TabType, label: `${members.length} Members`, icon: 'people', description: `${members.filter(m => m.role === 'admin').length} admins, ${members.filter(m => m.role === 'team_member').length} team members` },
    { id: 'events' as TabType, label: 'Manage Events', icon: 'event', href: `/community/${communityId}/events`, description: 'Schedule community events' },
    { id: 'visibility' as TabType, label: 'Settings', icon: 'settings', description: 'Configure community' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          const isLink = 'href' in tab && tab.href

          const getIconColor = () => {
            return 'text-[#000542]'
          }

          const getIconBg = () => {
            return 'bg-gray-100'
          }

          const tabContent = (
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${getIconBg()}`}>
                <span className={`material-icons text-2xl ${getIconColor()}`}>{tab.icon}</span>
              </div>
              <div>
                <h3 className="font-semibold">{tab.label}</h3>
                <p className="text-sm text-muted-foreground">{tab.description}</p>
              </div>
            </div>
          )

          if (isLink) {
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
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Send New Alert Section */}
          <div className="rounded-xl border border-border bg-card">
            <button
              onClick={() => toggleSection('send-alert')}
              className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="text-left">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="material-icons text-[#FEB100]">campaign</span>
                  Send New Alert
                </h2>
                <p className="text-sm text-muted-foreground">
                  Send alerts to community members via app, email, or SMS.
                </p>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['send-alert'] ? '-rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['send-alert'] ? 'max-h-0' : 'max-h-[2000px]'}`}>
            <div className="p-6 space-y-6">
              {/* Alert Level Selection */}
              <div>
                <label className="block text-sm font-medium mb-3">Alert Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(ALERT_LEVEL_CONFIG) as AlertLevel[]).map((level) => {
                    const config = ALERT_LEVEL_CONFIG[level]
                    const IconComponent = config.icon
                    const isSelected = alertLevel === level
                    return (
                      <button
                        key={level}
                        onClick={() => setAlertLevel(level)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? `${config.bgColor} ${config.borderColor}`
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <IconComponent className="h-5 w-5" style={{ color: config.color }} />
                          <span className="font-medium" style={{ color: isSelected ? config.color : undefined }}>
                            {config.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Recipients Selection */}
              <div>
                <label className="block text-sm font-medium mb-3">Send To</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(RECIPIENT_GROUP_CONFIG) as RecipientGroup[]).map((group) => {
                    const config = RECIPIENT_GROUP_CONFIG[group]
                    const isSelected = alertRecipientGroup === group
                    return (
                      <button
                        key={group}
                        onClick={() => setAlertRecipientGroup(group)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <span className="font-medium text-sm">{config.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Member Selection (when specific is selected) */}
              {alertRecipientGroup === 'specific' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select Members ({alertSelectedMembers.length} selected)
                  </label>
                  <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                    {members.map((member) => {
                      const isSelected = alertSelectedMembers.includes(member.user_id)
                      return (
                        <button
                          key={member.id}
                          onClick={() => toggleMemberSelection(member.user_id)}
                          className={`w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 border-b border-border last:border-b-0 ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                        >
                          <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                            isSelected ? 'bg-primary border-primary' : 'border-border'
                          }`}>
                            {isSelected && <CheckCircle className="h-4 w-4 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {member.profile?.full_name || member.profile?.email || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {member.profile?.email}
                            </p>
                          </div>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${COMMUNITY_ROLE_CONFIG[member.role]?.color}20`,
                              color: COMMUNITY_ROLE_CONFIG[member.role]?.color
                            }}
                          >
                            {COMMUNITY_ROLE_CONFIG[member.role]?.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Alert Title */}
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <Input
                  placeholder="Enter alert title"
                  value={alertTitle}
                  onChange={(e) => setAlertTitle(e.target.value)}
                />
              </div>

              {/* Alert Message */}
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  placeholder="Enter your alert message..."
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {/* Delivery Options */}
              <div>
                <label className="block text-sm font-medium mb-3">Delivery Method</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={alertSendAppAlert}
                      onChange={(e) => setAlertSendAppAlert(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <div className="flex items-start gap-2">
                      <Bell className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <span className="font-medium text-sm">App Alert</span>
                        <p className="text-xs text-muted-foreground">Dashboard alerts</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={alertSendEmail}
                      onChange={(e) => setAlertSendEmail(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <span className="font-medium text-sm">Email</span>
                        <p className="text-xs text-muted-foreground">Email notification</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={alertSendSms}
                      onChange={(e) => setAlertSendSms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <span className="font-medium text-sm">SMS</span>
                        <p className="text-xs text-muted-foreground">Text message</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Preview */}
              {alertTitle && (
                <div>
                  <label className="block text-sm font-medium mb-2">Preview</label>
                  <div className={`rounded-xl border p-4 ${ALERT_LEVEL_CONFIG[alertLevel].bgColor} ${ALERT_LEVEL_CONFIG[alertLevel].borderColor}`}>
                    <div className="flex items-start gap-3">
                      {(() => {
                        const IconComponent = ALERT_LEVEL_CONFIG[alertLevel].icon
                        return <IconComponent className="h-5 w-5 mt-0.5" style={{ color: ALERT_LEVEL_CONFIG[alertLevel].color }} />
                      })()}
                      <div className="flex-1">
                        <h4 className="font-semibold" style={{ color: ALERT_LEVEL_CONFIG[alertLevel].color }}>
                          {alertTitle}
                        </h4>
                        {alertMessage && (
                          <p className="mt-1 text-sm whitespace-pre-wrap">{alertMessage}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Send Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSendAlert}
                  disabled={isSendingAlert || !alertTitle.trim() || !alertMessage.trim() || (!alertSendEmail && !alertSendSms && !alertSendAppAlert)}
                  className="gap-2"
                  style={{
                    backgroundColor: ALERT_LEVEL_CONFIG[alertLevel].color,
                  }}
                >
                  {isSendingAlert ? (
                    <>
                      <span className="material-icons animate-spin text-lg">sync</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4" />
                      Send Alert
                    </>
                  )}
                </Button>
              </div>
            </div>
            </div>
          </div>

          {/* Alert History Section */}
          <div className="rounded-xl border border-border bg-card">
            <button
              onClick={() => toggleSection('alert-history')}
              className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="text-left">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="material-icons text-muted-foreground">history</span>
                  Alert History
                </h2>
                <p className="text-sm text-muted-foreground">
                  Previously sent alerts to this community.
                </p>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['alert-history'] ? '-rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['alert-history'] ? 'max-h-0' : 'max-h-[2000px]'}`}>
            <div className="divide-y divide-border">
              {alertHistory.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="material-icons text-4xl text-muted-foreground">notifications_none</span>
                  <p className="mt-2 text-muted-foreground">No alerts have been sent yet.</p>
                </div>
              ) : (
                alertHistory.map((alert) => {
                  const config = ALERT_LEVEL_CONFIG[alert.level as AlertLevel] || ALERT_LEVEL_CONFIG.info
                  const IconComponent = config.icon
                  const alertDate = new Date(alert.created_at)

                  return (
                    <div key={alert.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bgColor}`}>
                          <IconComponent className="h-5 w-5" style={{ color: config.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold">{alert.title}</h4>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {alertDate.toLocaleDateString()} {alertDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{alert.content}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                            <span className="text-muted-foreground">
                              Sent by: <span className="font-medium text-foreground">{alert.author?.full_name || alert.author?.email || 'Unknown'}</span>
                            </span>
                            <span className="text-muted-foreground">
                              To: <span className="font-medium text-foreground">{alert.recipient_count} recipient{alert.recipient_count !== 1 ? 's' : ''}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              {alert.sent_via_app && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                  <Bell className="h-3 w-3" />
                                  App
                                </span>
                              )}
                              {alert.sent_via_email && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                  <Mail className="h-3 w-3" />
                                  {alert.email_sent_count > 0 ? `${alert.email_sent_count} emails` : 'Email'}
                                </span>
                              )}
                              {alert.sent_via_sms && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                  <MessageSquare className="h-3 w-3" />
                                  {alert.sms_sent_count > 0 ? `${alert.sms_sent_count} SMS` : 'SMS'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <>
          {/* Members List */}
          <div className="rounded-xl border border-border bg-card">
            <button
              onClick={() => toggleSection('members')}
              className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="text-left">
                <h2 className="text-lg font-semibold">Community Members</h2>
                <p className="text-sm text-muted-foreground">
                  Manage member roles and permissions
                </p>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['members'] ? '-rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['members'] ? 'max-h-0' : 'max-h-[3000px]'}`}>
            <div className="border-b border-border p-4">
              {/* Search/Filter and Invite Button inline */}
              <MemberSearchFilter
                members={members}
                onFilteredMembersChange={handleFilteredMembersChange}
                inviteButton={
                  <Button onClick={() => setShowInviteModal(true)} className="gap-2 shrink-0">
                    <UserPlus className="h-4 w-4" />
                    Invite Member
                  </Button>
                }
              />
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
              {displayedMembers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {members.length === 0 ? 'No members yet' : 'No members found matching your filters'}
                </div>
              ) : (
                displayedMembers.map(member => (
                  <MemberProfileCard
                    key={member.id}
                    member={member}
                    isCurrentUser={member.user_id === user?.id}
                    isAdmin={isAdmin}
                    onRoleChange={updateMemberRole}
                    onRemove={removeMember}
                    isUpdating={updatingMemberId === member.id}
                  />
                ))
              )}
            </div>
            </div>
          </div>

          {/* Key Contacts & Roles Section */}
          <div className="rounded-xl border border-border bg-card">
            <button
              onClick={() => toggleSection('contacts')}
              className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="text-left">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="material-icons text-[#FEB100]">contact_phone</span>
                  Key Contacts & Roles
                </h2>
                <p className="text-sm text-muted-foreground">
                  Define key roles and contacts for your community. These will be visible to all members.
                </p>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['contacts'] ? '-rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['contacts'] ? 'max-h-0' : 'max-h-[2000px]'}`}>
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

          {/* Help Text */}
          <div className="rounded-xl border border-border bg-card">
            <button
              onClick={() => toggleSection('about-roles')}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <h3 className="flex items-center gap-2 font-semibold">
                <span className="material-icons text-xl text-[#FEB100]">help</span>
                About Roles
              </h3>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['about-roles'] ? '-rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['about-roles'] ? 'max-h-0' : 'max-h-[500px]'}`}>
              <div className="px-5 pb-5">
                <p className="text-sm text-muted-foreground">
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
            </div>
          </div>
        </>
      )}

      {activeTab === 'visibility' && (
        <div className="space-y-6">
          {/* Community Details Section - Name, Description, Visibility combined */}
          <div className="rounded-xl border border-border bg-card">
            <button
              onClick={() => toggleSection('community-name')}
              className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="text-left">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="material-icons text-[#FEB100]">edit</span>
                  Community Details
                </h2>
                <p className="text-sm text-muted-foreground">
                  Manage your community&apos;s name, description, and visibility
                </p>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['community-name'] ? '-rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['community-name'] ? 'max-h-0' : 'max-h-[1000px]'}`}>
              <div className="p-4 space-y-4">
                {/* Community Name */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <span className="material-icons text-2xl text-primary">groups</span>
                  </div>
                  <div className="flex-1">
                    {isEditingName ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          placeholder="Enter community name"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editedName.trim()) {
                              saveCommunityName()
                            } else if (e.key === 'Escape') {
                              setIsEditingName(false)
                              setEditedName(community?.name || '')
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          onClick={saveCommunityName}
                          disabled={isSavingName || !editedName.trim()}
                          size="sm"
                        >
                          {isSavingName ? (
                            <span className="material-icons animate-spin text-lg">sync</span>
                          ) : (
                            'Save'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditingName(false)
                            setEditedName(community?.name || '')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Name</p>
                        <h3 className="font-semibold">{community?.name}</h3>
                      </>
                    )}
                  </div>
                  {!isEditingName && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditedName(community?.name || '')
                        setIsEditingName(true)
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </div>

                {/* Community Description */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                    <span className="material-icons text-2xl text-blue-500">description</span>
                  </div>
                  <div className="flex-1">
                    {isEditingDescription ? (
                      <div className="space-y-2">
                        <textarea
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          placeholder="Enter a description for your community..."
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={saveCommunityDescription}
                            disabled={isSavingDescription}
                            size="sm"
                          >
                            {isSavingDescription ? (
                              <span className="material-icons animate-spin text-lg">sync</span>
                            ) : (
                              'Save'
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditingDescription(false)
                              setEditedDescription(community?.description || '')
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Description</p>
                        <p className="text-sm mt-1">
                          {community?.description || <span className="text-muted-foreground italic">No description set</span>}
                        </p>
                      </>
                    )}
                  </div>
                  {!isEditingDescription && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditedDescription(community?.description || '')
                        setIsEditingDescription(true)
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </div>

                {/* Visibility Toggle */}
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
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Visibility</p>
                      <h3 className="font-semibold">{community?.is_public ? 'Public' : 'Private'}</h3>
                      <p className="text-sm text-muted-foreground">
                        {community?.is_public
                          ? 'Anyone can find and request to join'
                          : 'Only invited users can join'}
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
          </div>

          {/* Community Region Section */}
          <div className="rounded-xl border border-border bg-card">
            <button
              onClick={() => toggleSection('region')}
              className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="text-left">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="material-icons text-blue-500">polyline</span>
                  Community Region
                </h2>
                <p className="text-sm text-muted-foreground">
                  Draw the area covered by your community. This region will be shown as an overlay on maps.
                </p>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['region'] ? '-rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['region'] ? 'max-h-0' : 'max-h-[1500px]'}`}>
              <div className="p-4">
                <RegionEditor
                  initialPolygon={(community as Record<string, unknown>)?.region_polygon as RegionPolygon | null}
                  center={community?.latitude && community?.longitude
                    ? { lat: community.latitude, lng: community.longitude }
                    : undefined
                  }
                  onSave={saveRegion}
                  isSaving={isSavingRegion}
                />
              </div>
            </div>
          </div>

          {/* Locations Section */}
          <div className="rounded-xl border border-border bg-card">
            <button
              onClick={() => toggleSection('locations')}
              className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="text-left">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="material-icons text-green-500">map</span>
                  Community Locations
                </h2>
                <p className="text-sm text-muted-foreground">
                  Manage meeting points and key reference locations for your community. Control who can see each location.
                </p>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['locations'] ? '-rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['locations'] ? 'max-h-0' : 'max-h-[2000px]'}`}>
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
