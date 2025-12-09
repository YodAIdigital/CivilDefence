'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { ContactsManager } from '@/components/community/contacts-manager'
import { GroupsManager } from '@/components/community/groups-manager'
import { MemberSearchFilter } from '@/components/community/member-search-filter'
import { MemberProfileCard } from '@/components/community/member-profile-card'
import { AIChat } from '@/components/community/ai-chat'
import { UserPlus, X, Mail, Clock, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Community, Profile, CommunityRole, CommunityContact, Json, CommunityEvent, EventType, EventVisibility } from '@/types/database'
import { COMMUNITY_ROLE_CONFIG, EVENT_TYPE_CONFIG, EVENT_VISIBILITY_CONFIG } from '@/types/database'
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete'

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

  // Filter state - filteredMembers is managed by MemberSearchFilter component
  const [displayedMembers, setDisplayedMembers] = useState<CommunityMemberWithProfile[]>([])

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<CommunityRole>('member')
  const [isInviting, setIsInviting] = useState(false)

  // Events state
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CommunityEvent | null>(null)
  const [isSavingEvent, setIsSavingEvent] = useState(false)
  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    duration_hours: 1,
    duration_minutes: 0,
    event_type: 'general' as EventType,
    visibility: 'all_members' as EventVisibility,
    location_name: '',
    location_address: '',
    use_meeting_point: false,
    is_online: false,
    meeting_link: '',
    notes: '',
  })

  // Collapsible section states - all collapsed by default
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    'events': true,
    'members': true,
    'contacts': true,
    'groups': true,
    'about-roles': true,
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

      // Fetch community events
      try {
        const { data: eventsData } = await supabase
          .from('community_events')
          .select('*')
          .eq('community_id', communityId)
          .order('start_time', { ascending: true })

        if (eventsData) {
          setEvents(eventsData)
        }
      } catch {
        // Events table might not exist yet
        setEvents([])
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

  // Event helper functions
  const resetEventForm = () => {
    setEventFormData({
      title: '',
      description: '',
      start_time: '',
      duration_hours: 1,
      duration_minutes: 0,
      event_type: 'general',
      visibility: 'all_members',
      location_name: '',
      location_address: '',
      use_meeting_point: false,
      is_online: false,
      meeting_link: '',
      notes: '',
    })
    setEditingEvent(null)
  }

  const openCreateEventModal = () => {
    resetEventForm()
    setShowEventModal(true)
  }

  const openEditEventModal = (event: CommunityEvent) => {
    setEditingEvent(event)
    const startDate = new Date(event.start_time)
    const hours = Math.floor(event.duration_minutes / 60)
    const mins = event.duration_minutes % 60

    setEventFormData({
      title: event.title,
      description: event.description || '',
      start_time: startDate.toISOString().slice(0, 16),
      duration_hours: hours,
      duration_minutes: mins,
      event_type: event.event_type,
      visibility: event.visibility,
      location_name: event.location_name || '',
      location_address: event.location_address || '',
      use_meeting_point: event.use_meeting_point,
      is_online: event.is_online,
      meeting_link: event.meeting_link || '',
      notes: event.notes || '',
    })
    setShowEventModal(true)
  }

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !communityId) return

    setIsSavingEvent(true)
    setError(null)

    try {
      const durationMinutes = (eventFormData.duration_hours * 60) + eventFormData.duration_minutes

      const eventData = {
        community_id: communityId,
        title: eventFormData.title,
        description: eventFormData.description || null,
        start_time: new Date(eventFormData.start_time).toISOString(),
        duration_minutes: durationMinutes,
        all_day: false,
        event_type: eventFormData.event_type,
        visibility: eventFormData.visibility,
        location_name: eventFormData.is_online ? null : (eventFormData.location_name || null),
        location_address: eventFormData.is_online ? null : (eventFormData.location_address || null),
        use_meeting_point: eventFormData.is_online ? false : eventFormData.use_meeting_point,
        is_online: eventFormData.is_online,
        meeting_link: eventFormData.is_online ? (eventFormData.meeting_link || null) : null,
        notes: eventFormData.notes || null,
        created_by: user.id,
      }

      if (editingEvent) {
        const { error: updateError } = await supabase
          .from('community_events')
          .update(eventData)
          .eq('id', editingEvent.id)

        if (updateError) throw updateError
        setSuccess('Event updated successfully')
      } else {
        const { error: insertError } = await supabase
          .from('community_events')
          .insert(eventData)

        if (insertError) throw insertError
        setSuccess('Event created successfully')
      }

      setShowEventModal(false)
      resetEventForm()
      await fetchData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error saving event:', err)
      setError('Failed to save event')
    } finally {
      setIsSavingEvent(false)
    }
  }

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const { error } = await supabase
        .from('community_events')
        .delete()
        .eq('id', eventId)

      if (error) throw error
      setSuccess('Event deleted successfully')
      await fetchData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting event:', err)
      setError('Failed to delete event')
    }
  }

  const formatEventDate = (startTime: string, durationMinutes: number) => {
    const start = new Date(startTime)
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

    const dateStr = start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })

    const startTimeStr = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    const endTimeStr = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    return `${dateStr}, ${startTimeStr} - ${endTimeStr}`
  }

  // Separate upcoming and past events
  const now = new Date()
  const upcomingEvents = events.filter(e => new Date(e.start_time) >= now)
  const pastEvents = events.filter(e => new Date(e.start_time) < now).reverse()

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

      {/* Members Section */}
      <div className="space-y-6">
          {/* Manage Events Section */}
          <div className="rounded-xl border border-border bg-card">
            <button
              onClick={() => toggleSection('events')}
              className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="text-left">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="material-icons text-blue-500">event</span>
                  Manage Events
                  {events.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">({upcomingEvents.length} upcoming)</span>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Create and manage community events, meetings, and activities.
                </p>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['events'] ? '-rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['events'] ? 'max-h-0' : 'max-h-[3000px]'}`}>
              <div className="p-4">
                {/* Create Event Button */}
                <div className="flex justify-end mb-4">
                  <Button onClick={openCreateEventModal} className="gap-2">
                    <span className="material-icons text-lg">add</span>
                    Create Event
                  </Button>
                </div>

                {/* Upcoming Events */}
                {upcomingEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border rounded-lg">
                    <span className="material-icons text-4xl text-muted-foreground">event_busy</span>
                    <p className="mt-2 text-muted-foreground">No upcoming events scheduled</p>
                    <button
                      onClick={openCreateEventModal}
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      Create your first event
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Upcoming Events</h3>
                    {upcomingEvents.map(event => {
                      const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.general
                      const visConfig = EVENT_VISIBILITY_CONFIG[event.visibility] || EVENT_VISIBILITY_CONFIG.all_members
                      return (
                        <div
                          key={event.id}
                          className={`p-4 rounded-lg border border-border hover:bg-muted/50 ${event.is_cancelled ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.color} text-white shrink-0`}>
                              <span className="material-icons text-lg">{config.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className={`font-semibold ${event.is_cancelled ? 'line-through' : ''}`}>
                                  {event.title}
                                </h4>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                                  {config.label}
                                </span>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                                  <span className="material-icons text-xs">{visConfig.icon}</span>
                                  {visConfig.label}
                                </span>
                                {event.is_cancelled && (
                                  <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-medium text-destructive">
                                    Cancelled
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {formatEventDate(event.start_time, event.duration_minutes)}
                              </p>
                              {event.is_online ? (
                                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                                  <span className="material-icons text-sm">videocam</span>
                                  Online Event
                                </p>
                              ) : event.location_name && (
                                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                                  <span className="material-icons text-sm">location_on</span>
                                  {event.location_name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openEditEventModal(event)}
                                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Edit event"
                              >
                                <span className="material-icons text-lg">edit</span>
                              </button>
                              <button
                                onClick={() => deleteEvent(event.id)}
                                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                                title="Delete event"
                              >
                                <span className="material-icons text-lg">delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Past Events */}
                {pastEvents.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Past Events</h3>
                    {pastEvents.slice(0, 3).map(event => {
                      const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.general
                      return (
                        <div key={event.id} className="p-3 rounded-lg border border-border opacity-60">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bgColor}`}>
                              <span className={`material-icons text-sm ${config.textColor}`}>{config.icon}</span>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{event.title}</h4>
                              <p className="text-xs text-muted-foreground">
                                {formatEventDate(event.start_time, event.duration_minutes)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {pastEvents.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{pastEvents.length - 3} more past events
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

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

          {/* Member Groups Section */}
          <div className="rounded-xl border border-border bg-card">
            <button
              onClick={() => toggleSection('groups')}
              className="w-full border-b border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="text-left">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="material-icons text-purple-500">groups</span>
                  Member Groups
                </h2>
                <p className="text-sm text-muted-foreground">
                  Create groups to organize members and send targeted alerts.
                </p>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${collapsedSections['groups'] ? '-rotate-90' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${collapsedSections['groups'] ? 'max-h-0' : 'max-h-[3000px]'}`}>
              <div className="p-4">
                {user && (
                  <GroupsManager
                    communityId={communityId}
                    userId={user.id}
                    members={members}
                  />
                )}
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
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => {
            setShowInviteModal(false)
            setInviteEmail('')
            setInviteRole('member')
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card border border-border p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
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

      {/* Create/Edit Event Modal */}
      {showEventModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowEventModal(false)
            resetEventForm()
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-card shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card p-4">
              <h2 className="text-lg font-semibold">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h2>
              <button
                onClick={() => {
                  setShowEventModal(false)
                  resetEventForm()
                }}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1">Event Title *</label>
                <Input
                  type="text"
                  required
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                  placeholder="e.g., Emergency Response Training"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-sm font-medium mb-1">Event Type</label>
                <select
                  value={eventFormData.event_type}
                  onChange={(e) => setEventFormData({ ...eventFormData, event_type: e.target.value as EventType })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                >
                  {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={eventFormData.description}
                  onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  placeholder="Event description..."
                />
              </div>

              {/* Start Date/Time */}
              <div>
                <label className="block text-sm font-medium mb-1">Start Date & Time *</label>
                <Input
                  type="datetime-local"
                  required
                  value={eventFormData.start_time}
                  onChange={(e) => setEventFormData({ ...eventFormData, start_time: e.target.value })}
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium mb-1">Duration</label>
                <div className="flex gap-2">
                  <select
                    value={eventFormData.duration_hours}
                    onChange={(e) => setEventFormData({ ...eventFormData, duration_hours: parseInt(e.target.value) })}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2"
                  >
                    {[...Array(13)].map((_, i) => (
                      <option key={i} value={i}>{i} hour{i !== 1 ? 's' : ''}</option>
                    ))}
                  </select>
                  <select
                    value={eventFormData.duration_minutes}
                    onChange={(e) => setEventFormData({ ...eventFormData, duration_minutes: parseInt(e.target.value) })}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2"
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium mb-1">Visibility</label>
                <select
                  value={eventFormData.visibility}
                  onChange={(e) => setEventFormData({ ...eventFormData, visibility: e.target.value as EventVisibility })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                >
                  {Object.entries(EVENT_VISIBILITY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>

              {/* Online Event Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_online"
                  checked={eventFormData.is_online}
                  onChange={(e) => setEventFormData({ ...eventFormData, is_online: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="is_online" className="text-sm font-medium">
                  This is an online event
                </label>
              </div>

              {/* Location / Meeting Link */}
              {eventFormData.is_online ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Meeting Link</label>
                  <Input
                    type="url"
                    value={eventFormData.meeting_link}
                    onChange={(e) => setEventFormData({ ...eventFormData, meeting_link: e.target.value })}
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="use_meeting_point"
                      checked={eventFormData.use_meeting_point}
                      onChange={(e) => setEventFormData({ ...eventFormData, use_meeting_point: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="use_meeting_point" className="text-sm font-medium">
                      Use community meeting point
                    </label>
                  </div>
                  {!eventFormData.use_meeting_point && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm font-medium mb-1">Location Name</label>
                        <Input
                          value={eventFormData.location_name}
                          onChange={(e) => setEventFormData({ ...eventFormData, location_name: e.target.value })}
                          placeholder="e.g., Community Hall"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Address</label>
                        <AddressAutocomplete
                          value={eventFormData.location_address}
                          onChange={(address) => setEventFormData({ ...eventFormData, location_address: address })}
                          placeholder="Search for address..."
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Additional Notes</label>
                <textarea
                  value={eventFormData.notes}
                  onChange={(e) => setEventFormData({ ...eventFormData, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  placeholder="Any additional notes for attendees..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowEventModal(false)
                    resetEventForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isSavingEvent || !eventFormData.title.trim() || !eventFormData.start_time}
                >
                  {isSavingEvent ? (
                    <>
                      <span className="material-icons animate-spin text-lg mr-2">sync</span>
                      Saving...
                    </>
                  ) : (
                    editingEvent ? 'Save Changes' : 'Create Event'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Chat - Only show for admins and team members */}
      {isAdmin && community && (
        <AIChat
          communityId={communityId}
          communityName={community.name}
        />
      )}

    </div>
  )
}
