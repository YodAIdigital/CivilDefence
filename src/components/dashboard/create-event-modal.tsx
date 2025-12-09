'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useCommunity } from '@/contexts/community-context'
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete'
import type { Community, CommunityMember, EventType, EventVisibility, Profile } from '@/types/database'
import { EVENT_TYPE_CONFIG as eventTypeConfig, EVENT_VISIBILITY_CONFIG as visibilityConfig } from '@/types/database'

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

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CreateEventModal({ isOpen, onClose, onSuccess }: CreateEventModalProps) {
  const { user } = useAuth()
  const { activeCommunity } = useCommunity()

  const [community, setCommunity] = useState<Community | null>(null)
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [formData, setFormData] = useState<EventFormData>(initialFormData)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Invite search state
  const [memberSearch, setMemberSearch] = useState('')
  const [showExternalForm, setShowExternalForm] = useState(false)
  const [externalInvite, setExternalInvite] = useState({ name: '', email: '', phone: '' })

  // Fetch community and members data
  const fetchData = useCallback(async () => {
    if (!activeCommunity) return

    try {
      // Fetch community details
      const { data: communityData } = await supabase
        .from('communities')
        .select('*')
        .eq('id', activeCommunity.id)
        .single()

      if (communityData) {
        setCommunity(communityData)
      }

      // Fetch members for invite selection
      const { data: membersData } = await supabase
        .from('community_members')
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq('community_id', activeCommunity.id)

      if (membersData) {
        setMembers(membersData as MemberWithProfile[])
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }, [activeCommunity])

  useEffect(() => {
    if (isOpen) {
      fetchData()
      // Set default start time to next hour
      const now = new Date()
      now.setHours(now.getHours() + 1, 0, 0, 0)
      setFormData(prev => ({
        ...prev,
        start_time: formatDateTimeForInput(now.toISOString()),
      }))
    }
  }, [isOpen, fetchData])

  const resetForm = () => {
    setFormData(initialFormData)
    setMemberSearch('')
    setShowExternalForm(false)
    setExternalInvite({ name: '', email: '', phone: '' })
    setError(null)
    setSuccess(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const formatDateTimeForInput = (dateString: string) => {
    const date = new Date(dateString)
    return date.toISOString().slice(0, 16)
  }

  const filteredMembers = members.filter(member => {
    if (!memberSearch) return false
    const name = member.profile?.full_name?.toLowerCase() || ''
    const email = member.profile?.email?.toLowerCase() || ''
    const search = memberSearch.toLowerCase()
    const alreadyInvited = formData.invites.some(i => i.user_id === member.user_id)
    return !alreadyInvited && (name.includes(search) || email.includes(search))
  })

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
    if (!user || !activeCommunity) return

    setIsSaving(true)
    setError(null)

    try {
      const durationMinutes = (formData.duration_hours * 60) + formData.duration_minutes

      const eventData = {
        community_id: activeCommunity.id,
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

      // Create new event
      const { data: newEvent, error: insertError } = await supabase
        .from('community_events')
        .insert(eventData)
        .select()
        .single()

      if (insertError) throw insertError
      const eventId = newEvent.id

      // Handle invites for invite_only events
      if (formData.visibility === 'invite_only' && formData.invites.length > 0) {
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
        }
      }

      // Send push notifications
      try {
        let recipientUserIds: string[] = []

        if (formData.visibility === 'invite_only') {
          recipientUserIds = formData.invites
            .filter(invite => invite.user_id)
            .map(invite => invite.user_id as string)
        } else if (formData.visibility === 'admin_only') {
          recipientUserIds = members
            .filter(m => m.role === 'admin' || m.role === 'super_admin')
            .map(m => m.user_id)
        } else {
          recipientUserIds = members.map(m => m.user_id)
        }

        recipientUserIds = recipientUserIds.filter(id => id !== user.id)

        if (recipientUserIds.length > 0) {
          await fetch('/api/event-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventId,
              communityId: activeCommunity.id,
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
      }

      setSuccess('Event created successfully')
      setTimeout(() => {
        handleClose()
        onSuccess?.()
      }, 1500)
    } catch (err) {
      console.error('Error saving event:', err)
      setError('Failed to create event. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-card shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Create New Event</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error/Success Messages */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
              {success}
            </div>
          )}

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
              onClick={handleClose}
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
              Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
