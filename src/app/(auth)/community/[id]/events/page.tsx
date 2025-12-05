'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete'
import type { Community, CommunityEvent, CommunityMember, EventType, EventVisibility, Profile } from '@/types/database'
import { EVENT_TYPE_CONFIG as eventTypeConfig, EVENT_VISIBILITY_CONFIG as visibilityConfig } from '@/types/database'

type TabType = 'alerts' | 'members' | 'events' | 'visibility'

interface MemberWithProfile extends CommunityMember {
  profile: Profile
}

interface EventInviteData {
  user_id: string | null
  external_name: string
  external_email: string
  external_phone: string
}

interface EventFormData {
  title: string
  description: string
  start_time: string
  duration_hours: number
  duration_minutes: number
  event_type: EventType
  visibility: EventVisibility
  location_name: string
  location_address: string
  use_meeting_point: boolean
  is_online: boolean
  meeting_link: string
  notes: string
  invites: EventInviteData[]
}

const initialFormData: EventFormData = {
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
  invites: [],
}

export default function CommunityEventsPage() {
  const params = useParams()
  const communityId = params?.id as string
  const { user } = useAuth()

  const [community, setCommunity] = useState<Community | null>(null)
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CommunityEvent | null>(null)
  const [formData, setFormData] = useState<EventFormData>(initialFormData)
  const [isSaving, setIsSaving] = useState(false)

  // Invite search state
  const [memberSearch, setMemberSearch] = useState('')
  const [showExternalForm, setShowExternalForm] = useState(false)
  const [externalInvite, setExternalInvite] = useState({ name: '', email: '', phone: '' })

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

      // Fetch members for invite selection
      const { data: membersData, error: membersError } = await supabase
        .from('community_members')
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq('community_id', communityId)

      if (membersError) throw membersError
      setMembers((membersData || []) as MemberWithProfile[])

      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('community_events')
        .select('*')
        .eq('community_id', communityId)
        .order('start_time', { ascending: true })

      if (eventsError) throw eventsError
      setEvents(eventsData || [])
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

  const openCreateModal = () => {
    setEditingEvent(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  const openEditModal = (event: CommunityEvent) => {
    setEditingEvent(event)
    const hours = Math.floor(event.duration_minutes / 60)
    const minutes = event.duration_minutes % 60
    setFormData({
      title: event.title,
      description: event.description || '',
      start_time: formatDateTimeForInput(event.start_time),
      duration_hours: hours,
      duration_minutes: minutes,
      event_type: event.event_type,
      visibility: event.visibility,
      location_name: event.location_name || '',
      location_address: event.location_address || '',
      use_meeting_point: event.use_meeting_point,
      is_online: event.is_online || false,
      meeting_link: event.meeting_link || '',
      notes: event.notes || '',
      invites: [],
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingEvent(null)
    setFormData(initialFormData)
    setMemberSearch('')
    setShowExternalForm(false)
    setExternalInvite({ name: '', email: '', phone: '' })
  }

  const formatDateTimeForInput = (dateString: string) => {
    const date = new Date(dateString)
    return date.toISOString().slice(0, 16)
  }

  const addMemberInvite = (memberId: string) => {
    if (formData.invites.some(i => i.user_id === memberId)) return
    setFormData(prev => ({
      ...prev,
      invites: [...prev.invites, { user_id: memberId, external_name: '', external_email: '', external_phone: '' }]
    }))
    setMemberSearch('')
  }

  const addExternalInvite = () => {
    if (!externalInvite.name) return
    setFormData(prev => ({
      ...prev,
      invites: [...prev.invites, {
        user_id: null,
        external_name: externalInvite.name,
        external_email: externalInvite.email,
        external_phone: externalInvite.phone
      }]
    }))
    setExternalInvite({ name: '', email: '', phone: '' })
    setShowExternalForm(false)
  }

  const removeInvite = (index: number) => {
    setFormData(prev => ({
      ...prev,
      invites: prev.invites.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !communityId) return

    setIsSaving(true)
    setError(null)

    try {
      const durationMinutes = (formData.duration_hours * 60) + formData.duration_minutes

      const eventData = {
        community_id: communityId,
        title: formData.title,
        description: formData.description || null,
        start_time: new Date(formData.start_time).toISOString(),
        duration_minutes: durationMinutes,
        all_day: false,
        event_type: formData.event_type,
        visibility: formData.visibility,
        location_name: formData.is_online ? null : (formData.location_name || null),
        location_address: formData.is_online ? null : (formData.location_address || null),
        use_meeting_point: formData.is_online ? false : formData.use_meeting_point,
        is_online: formData.is_online,
        meeting_link: formData.is_online ? (formData.meeting_link || null) : null,
        notes: formData.notes || null,
        created_by: user.id,
      }

      let eventId: string

      if (editingEvent) {
        // Update existing event
        const { error: updateError } = await supabase
          .from('community_events')
          .update(eventData)
          .eq('id', editingEvent.id)

        if (updateError) throw updateError
        eventId = editingEvent.id
        setSuccess('Event updated successfully')
      } else {
        // Create new event
        const { data: newEvent, error: insertError } = await supabase
          .from('community_events')
          .insert(eventData)
          .select()
          .single()

        if (insertError) throw insertError
        eventId = newEvent.id
        setSuccess('Event created successfully')
      }

      // Handle invites for invite_only events
      if (formData.visibility === 'invite_only' && formData.invites.length > 0) {
        // Delete existing invites if editing
        if (editingEvent) {
          await supabase
            .from('event_invites')
            .delete()
            .eq('event_id', eventId)
        }

        // Insert new invites
        const inviteData = formData.invites.map(invite => ({
          event_id: eventId,
          user_id: invite.user_id,
          external_name: invite.external_name || null,
          external_email: invite.external_email || null,
          external_phone: invite.external_phone || null,
          invited_by: user.id,
        }))

        const { error: inviteError } = await supabase
          .from('event_invites')
          .insert(inviteData)

        if (inviteError) {
          console.error('Error creating invites:', inviteError)
          // Don't fail the whole operation for invite errors
        }
      }

      // Send push notifications for new events (not when editing)
      if (!editingEvent) {
        try {
          let recipientUserIds: string[] = []

          // Determine recipients based on visibility
          if (formData.visibility === 'invite_only') {
            // Only notify invited members (not external invites)
            recipientUserIds = formData.invites
              .filter(invite => invite.user_id)
              .map(invite => invite.user_id as string)
          } else if (formData.visibility === 'admin_only') {
            // Notify all admins
            recipientUserIds = members
              .filter(m => m.role === 'admin' || m.role === 'super_admin')
              .map(m => m.user_id)
          } else {
            // Notify all members for 'all_members' visibility
            recipientUserIds = members.map(m => m.user_id)
          }

          // Remove the creator from notifications (they created the event)
          recipientUserIds = recipientUserIds.filter(id => id !== user.id)

          if (recipientUserIds.length > 0) {
            await fetch('/api/event-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                eventId,
                communityId,
                eventTitle: formData.title,
                eventStartTime: new Date(formData.start_time).toISOString(),
                isOnline: formData.is_online,
                meetingLink: formData.meeting_link || undefined,
                recipientUserIds,
              }),
            })
          }
        } catch (notifyErr) {
          console.error('Error sending event notifications:', notifyErr)
          // Don't fail the whole operation for notification errors
        }
      }

      closeModal()
      fetchData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error saving event:', err)
      setError('Failed to save event. Please check the console for details.')
    } finally {
      setIsSaving(false)
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
      fetchData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting event:', err)
      setError('Failed to delete event')
    }
  }

  const cancelEvent = async (eventId: string, isCancelled: boolean) => {
    try {
      const { error } = await supabase
        .from('community_events')
        .update({ is_cancelled: !isCancelled })
        .eq('id', eventId)

      if (error) throw error
      setSuccess(isCancelled ? 'Event restored' : 'Event cancelled')
      fetchData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating event:', err)
      setError('Failed to update event')
    }
  }

  const formatEventDate = (startTime: string, durationMinutes: number, allDay: boolean) => {
    const start = new Date(startTime)
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

    if (allDay) {
      return start.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    }

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

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}min`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}min`
  }

  // Filter members for search
  const filteredMembers = members.filter(m => {
    if (!memberSearch) return false
    const name = m.profile?.full_name?.toLowerCase() || ''
    const email = m.profile?.email?.toLowerCase() || ''
    const search = memberSearch.toLowerCase()
    return (name.includes(search) || email.includes(search)) && !formData.invites.some(i => i.user_id === m.user_id)
  })

  // Separate upcoming and past events
  const now = new Date()
  const upcomingEvents = events.filter(e => new Date(e.start_time) >= now)
  const pastEvents = events.filter(e => new Date(e.start_time) < now).reverse()

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
          You must be a community admin to manage events.
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
    { id: 'alerts' as TabType, label: 'Send Alert', icon: 'campaign', href: `/community/${communityId}/manage`, description: 'Send alerts to members' },
    { id: 'members' as TabType, label: `${members.length} Members`, icon: 'people', href: `/community/${communityId}/manage?tab=members`, description: `Manage roles & permissions` },
    { id: 'events' as TabType, label: 'Manage Events', icon: 'event', description: 'Schedule community events' },
    { id: 'visibility' as TabType, label: 'Settings', icon: 'settings', href: `/community/${communityId}/manage?tab=visibility`, description: 'Configure community' },
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
          const isActive = tab.id === 'events'
          const isLink = 'href' in tab && tab.href

          const tabContent = (
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                <span className="material-icons text-2xl text-[#000542]">{tab.icon}</span>
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
                href={tab.href as `/community/${string}/manage` | `/community/${string}/manage?tab=members` | `/community/${string}/manage?tab=visibility`}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors"
              >
                {tabContent}
              </Link>
            )
          }

          return (
            <button
              key={tab.id}
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

      {/* Events Content Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Community Events</h2>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
        >
          <span className="material-icons">add</span>
          Create Event
        </button>
      </div>

      {/* Upcoming Events */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="material-icons text-primary">event</span>
            Upcoming Events
          </h2>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="material-icons text-4xl text-muted-foreground">event_busy</span>
            <p className="mt-2 text-muted-foreground">No upcoming events scheduled</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Create your first event
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {upcomingEvents.map(event => {
              const config = eventTypeConfig[event.event_type]
              const visConfig = visibilityConfig[event.visibility]
              return (
                <div
                  key={event.id}
                  className={`p-4 hover:bg-muted/50 ${event.is_cancelled ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${config.color} text-white`}>
                      <span className="material-icons">{config.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-semibold ${event.is_cancelled ? 'line-through' : ''}`}>
                          {event.title}
                        </h3>
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
                        {formatEventDate(event.start_time, event.duration_minutes, event.all_day)}
                        {!event.all_day && (
                          <span className="ml-2 text-xs">({formatDuration(event.duration_minutes)})</span>
                        )}
                      </p>
                      {event.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      {event.is_online ? (
                        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <span className="material-icons text-sm">videocam</span>
                          <span>Online Event</span>
                          {event.meeting_link && (
                            <a
                              href={event.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Join Meeting
                            </a>
                          )}
                        </div>
                      ) : (event.location_name || event.use_meeting_point) && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <span className="material-icons text-sm">location_on</span>
                          {event.use_meeting_point ? 'Community Meeting Point' : event.location_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(event)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Edit event"
                      >
                        <span className="material-icons text-lg">edit</span>
                      </button>
                      <button
                        onClick={() => cancelEvent(event.id, event.is_cancelled)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-amber-600"
                        title={event.is_cancelled ? 'Restore event' : 'Cancel event'}
                      >
                        <span className="material-icons text-lg">
                          {event.is_cancelled ? 'restore' : 'cancel'}
                        </span>
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
      </div>

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-muted-foreground">
              <span className="material-icons">history</span>
              Past Events
            </h2>
          </div>
          <div className="divide-y divide-border">
            {pastEvents.slice(0, 5).map(event => {
              const config = eventTypeConfig[event.event_type]
              return (
                <div key={event.id} className="p-4 opacity-60">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bgColor}`}>
                      <span className={`material-icons ${config.textColor}`}>{config.icon}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{event.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatEventDate(event.start_time, event.duration_minutes, event.all_day)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create/Edit Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card p-4">
              <h2 className="text-lg font-semibold">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  placeholder="e.g., Emergency Response Training"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-sm font-medium mb-1">Event Type</label>
                <select
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value as EventType })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                >
                  {Object.entries(eventTypeConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  placeholder="Event description..."
                />
              </div>

              {/* Start Date/Time and Duration - Inline */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Start *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duration</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={formData.duration_hours}
                      onChange={(e) => setFormData({ ...formData, duration_hours: parseInt(e.target.value) || 0 })}
                      className="w-16 rounded-lg border border-border bg-background px-3 py-2"
                    />
                    <span className="text-sm text-muted-foreground">h</span>
                    <select
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                      className="w-16 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <option value="0">0</option>
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="45">45</option>
                    </select>
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
              </div>

              {/* Event Location Type */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Event Location</label>
                <div className="flex gap-4">
                  <label className={`flex-1 flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                    !formData.is_online ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}>
                    <input
                      type="radio"
                      name="location_type"
                      checked={!formData.is_online}
                      onChange={() => setFormData({ ...formData, is_online: false, meeting_link: '' })}
                      className="sr-only"
                    />
                    <span className="material-icons text-lg text-muted-foreground">location_on</span>
                    <span className="text-sm font-medium">In-Person</span>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                    formData.is_online ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}>
                    <input
                      type="radio"
                      name="location_type"
                      checked={formData.is_online}
                      onChange={() => setFormData({ ...formData, is_online: true, use_meeting_point: false })}
                      className="sr-only"
                    />
                    <span className="material-icons text-lg text-muted-foreground">videocam</span>
                    <span className="text-sm font-medium">Online</span>
                  </label>
                </div>

                {/* Online Meeting Options */}
                {formData.is_online && (
                  <div className="space-y-2 pt-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">Meeting Link</label>
                      <input
                        type="url"
                        value={formData.meeting_link}
                        onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        placeholder="https://meet.google.com/... or Zoom/Teams link"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Paste your Google Meet, Zoom, or Teams meeting link
                      </p>
                    </div>
                  </div>
                )}

                {/* In-Person Location Options */}
                {!formData.is_online && (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="use_meeting_point"
                        checked={formData.use_meeting_point}
                        onChange={(e) => setFormData({ ...formData, use_meeting_point: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="use_meeting_point" className="text-sm">
                        Use community meeting point
                        {community?.meeting_point_name && (
                          <span className="text-muted-foreground"> ({community.meeting_point_name})</span>
                        )}
                      </label>
                    </div>

                    {!formData.use_meeting_point && (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-1">Location Name</label>
                          <input
                            type="text"
                            value={formData.location_name}
                            onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2"
                            placeholder="e.g., Community Hall"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Address</label>
                          <AddressAutocomplete
                            value={formData.location_address}
                            onChange={(address) => setFormData({ ...formData, location_address: address })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2"
                            placeholder="Start typing to search for an address..."
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium mb-1">Who can see this event?</label>
                <div className="space-y-2">
                  {Object.entries(visibilityConfig).map(([key, config]) => (
                    <label
                      key={key}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        formData.visibility === key
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={key}
                        checked={formData.visibility === key}
                        onChange={(e) => setFormData({ ...formData, visibility: e.target.value as EventVisibility })}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="material-icons text-lg text-muted-foreground">{config.icon}</span>
                          <span className="font-medium">{config.label}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{config.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Invite Members (only for invite_only) */}
              {formData.visibility === 'invite_only' && (
                <div className="border-t border-border pt-4">
                  <label className="block text-sm font-medium mb-2">Invite People</label>

                  {/* Search members */}
                  <div className="relative mb-3">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-9"
                      placeholder="Search community members..."
                    />
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">search</span>

                    {/* Search results dropdown */}
                    {filteredMembers.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-auto">
                        {filteredMembers.map(member => (
                          <button
                            key={member.user_id}
                            type="button"
                            onClick={() => addMemberInvite(member.user_id)}
                            className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2"
                          >
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {member.profile?.full_name?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{member.profile?.full_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{member.profile?.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* External invite button */}
                  {!showExternalForm && (
                    <button
                      type="button"
                      onClick={() => setShowExternalForm(true)}
                      className="text-sm text-primary hover:underline flex items-center gap-1 mb-3"
                    >
                      <span className="material-icons text-sm">person_add</span>
                      Invite someone outside the community
                    </button>
                  )}

                  {/* External invite form */}
                  {showExternalForm && (
                    <div className="rounded-lg border border-border p-3 mb-3 space-y-2">
                      <p className="text-sm font-medium">External Invite</p>
                      <input
                        type="text"
                        value={externalInvite.name}
                        onChange={(e) => setExternalInvite({ ...externalInvite, name: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="Name *"
                      />
                      <input
                        type="email"
                        value={externalInvite.email}
                        onChange={(e) => setExternalInvite({ ...externalInvite, email: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="Email (optional)"
                      />
                      <input
                        type="tel"
                        value={externalInvite.phone}
                        onChange={(e) => setExternalInvite({ ...externalInvite, phone: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="Phone (optional)"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={addExternalInvite}
                          disabled={!externalInvite.name}
                          className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowExternalForm(false)
                            setExternalInvite({ name: '', email: '', phone: '' })
                          }}
                          className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Invited list */}
                  {formData.invites.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">{formData.invites.length} invited</p>
                      {formData.invites.map((invite, index) => {
                        const member = invite.user_id ? members.find(m => m.user_id === invite.user_id) : null
                        return (
                          <div key={index} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {member ? member.profile?.full_name?.charAt(0) : invite.external_name?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {member ? member.profile?.full_name : invite.external_name}
                              </p>
                              {!member && (
                                <p className="text-xs text-muted-foreground">External</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeInvite(index)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <span className="material-icons text-sm">close</span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Internal Notes <span className="text-muted-foreground font-normal">(admin only)</span>
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  placeholder="Notes for organizers..."
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSaving && <span className="material-icons animate-spin text-lg">sync</span>}
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
