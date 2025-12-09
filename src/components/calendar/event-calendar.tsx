'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useCommunity } from '@/contexts/community-context'
import type { CommunityEvent, Community, RsvpStatus } from '@/types/database'
import { EVENT_TYPE_CONFIG } from '@/types/database'

interface EventRsvp {
  id: string
  event_id: string
  user_id: string
  status: RsvpStatus
}

interface EventWithCommunity extends CommunityEvent {
  community: Community
  rsvp?: EventRsvp
}

interface EventCalendarProps {
  showHeader?: boolean
  maxEvents?: number
  compact?: boolean
  showCreateButton?: boolean
  onCreateClick?: () => void
}

export function EventCalendar({ showHeader = true, maxEvents = 5, compact = false, showCreateButton = false, onCreateClick }: EventCalendarProps) {
  const { user } = useAuth()
  const { activeCommunity } = useCommunity()
  const [events, setEvents] = useState<EventWithCommunity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [view, setView] = useState<'list' | 'calendar'>('list')

  const fetchEvents = useCallback(async () => {
    if (!user || !activeCommunity) {
      setEvents([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      // Get events from the active community only
      const { data: eventsData, error: eventsError } = await supabase
        .from('community_events')
        .select(`
          *,
          community:communities(*)
        `)
        .eq('community_id', activeCommunity.id)
        .eq('is_cancelled', false)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(maxEvents * 2) // Get more to filter

      if (eventsError) throw eventsError

      // Fetch user's RSVPs for these events
      const eventIds = (eventsData || []).map(e => e.id)
      let rsvpMap: Record<string, EventRsvp> = {}

      if (eventIds.length > 0) {
        const { data: rsvpData } = await supabase
          .from('event_rsvps')
          .select('*')
          .eq('user_id', user.id)
          .in('event_id', eventIds)

        if (rsvpData) {
          rsvpMap = rsvpData.reduce((acc, rsvp) => {
            acc[rsvp.event_id] = rsvp as EventRsvp
            return acc
          }, {} as Record<string, EventRsvp>)
        }
      }

      // Merge RSVP data with events
      const eventsWithRsvp = (eventsData || []).map(event => ({
        ...event,
        rsvp: rsvpMap[event.id],
      })) as EventWithCommunity[]

      setEvents(eventsWithRsvp)
    } catch (err) {
      console.error('Error fetching events:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user, activeCommunity, maxEvents])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Handle RSVP update
  const handleRsvp = useCallback(async (eventId: string, status: RsvpStatus) => {
    if (!user) return

    try {
      // Check if user already has an RSVP
      const existingEvent = events.find(e => e.id === eventId)
      const existingRsvp = existingEvent?.rsvp

      if (existingRsvp) {
        // Update existing RSVP
        const { error } = await supabase
          .from('event_rsvps')
          .update({ status, responded_at: new Date().toISOString() })
          .eq('id', existingRsvp.id)

        if (error) throw error
      } else {
        // Insert new RSVP
        const { error } = await supabase
          .from('event_rsvps')
          .insert({
            event_id: eventId,
            user_id: user.id,
            status,
          })

        if (error) throw error
      }

      // Refresh events to get updated RSVP
      fetchEvents()
    } catch (err) {
      console.error('Error updating RSVP:', err)
    }
  }, [user, events, fetchEvents])

  const formatEventTime = (startTime: string, durationMinutes: number, allDay: boolean) => {
    const start = new Date(startTime)
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

    if (allDay) {
      return 'All day'
    }

    const startStr = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    const endStr = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    return `${startStr} - ${endStr}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const groupEventsByDate = (events: EventWithCommunity[]) => {
    const groups: Record<string, EventWithCommunity[]> = {}

    events.forEach(event => {
      const dateKey = new Date(event.start_time).toDateString()
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(event)
    })

    return groups
  }

  // Calendar view helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    return { daysInMonth, startingDay }
  }

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_time)
      return eventDate.toDateString() === date.toDateString()
    })
  }

  const groupedEvents = groupEventsByDate(events.slice(0, maxEvents))
  const { daysInMonth, startingDay } = getDaysInMonth(selectedDate)

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <span className="material-icons animate-spin text-2xl text-primary">sync</span>
        </div>
      </div>
    )
  }

  if (compact) {
    // Compact list view for sidebar
    return (
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        {showHeader && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Schedule</h3>
            <span className="text-sm text-muted-foreground">
              {formatDate(new Date().toISOString())}
            </span>
          </div>
        )}

        {events.length === 0 ? (
          <div className="text-center py-6">
            <span className="material-icons text-3xl text-muted-foreground">event_busy</span>
            <p className="mt-2 text-sm text-muted-foreground">No upcoming events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.slice(0, maxEvents).map(event => {
              const config = EVENT_TYPE_CONFIG[event.event_type]
              return (
                <div
                  key={event.id}
                  className={`rounded-xl ${config.color} p-3 text-white shadow-sm`}
                >
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <span className="material-icons-outlined text-sm">schedule</span>
                    {formatEventTime(event.start_time, event.duration_minutes, event.all_day)}
                  </div>
                  <h4 className="mt-1 text-sm font-semibold">{event.title}</h4>
                  <p className="mt-0.5 text-xs text-white/70 line-clamp-1">
                    {event.community?.name}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Create Event Button */}
        {showCreateButton && onCreateClick && (
          <button
            onClick={onCreateClick}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <span className="material-icons text-lg">add</span>
            Create Event
          </button>
        )}
      </div>
    )
  }

  // Full calendar/list view
  return (
    <div className="rounded-xl border border-border bg-card">
      {showHeader && (
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="material-icons text-primary">event</span>
            Community Events
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('list')}
              className={`rounded-lg p-2 ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <span className="material-icons text-lg">view_list</span>
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`rounded-lg p-2 ${view === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <span className="material-icons text-lg">calendar_month</span>
            </button>
          </div>
        </div>
      )}

      {view === 'list' ? (
        // List View
        <div className="divide-y divide-border">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="material-icons text-4xl text-muted-foreground">event_busy</span>
              <p className="mt-2 text-muted-foreground">No upcoming events</p>
              <p className="text-sm text-muted-foreground">
                Join communities to see their events
              </p>
            </div>
          ) : (
            Object.entries(groupedEvents).map(([dateKey, dateEvents]) => {
              const firstEvent = dateEvents[0]
              if (!firstEvent) return null
              return (
              <div key={dateKey} className="p-4">
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  {formatDate(firstEvent.start_time)}
                </h3>
                <div className="space-y-3">
                  {dateEvents.map(event => {
                    const config = EVENT_TYPE_CONFIG[event.event_type]
                    return (
                      <div key={event.id} className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.color} text-white flex-shrink-0`}>
                          <span className="material-icons text-lg">{config.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium truncate">{event.title}</h4>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${config.bgColor} ${config.textColor}`}>
                              {config.label}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatEventTime(event.start_time, event.duration_minutes, event.all_day)}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{event.community?.name}</span>
                            {event.is_online && (
                              <>
                                <span className="material-icons text-xs">videocam</span>
                                {event.meeting_link && (
                                  <a
                                    href={event.meeting_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Join
                                  </a>
                                )}
                              </>
                            )}
                          </div>
                          {/* RSVP Buttons */}
                          <div className="flex items-center gap-1 mt-2">
                            <span className="text-xs text-muted-foreground mr-1">RSVP:</span>
                            <button
                              onClick={() => handleRsvp(event.id, 'going')}
                              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                event.rsvp?.status === 'going'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-muted text-muted-foreground hover:bg-green-100 hover:text-green-700'
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => handleRsvp(event.id, 'maybe')}
                              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                event.rsvp?.status === 'maybe'
                                  ? 'bg-yellow-500 text-white'
                                  : 'bg-muted text-muted-foreground hover:bg-yellow-100 hover:text-yellow-700'
                              }`}
                            >
                              Maybe
                            </button>
                            <button
                              onClick={() => handleRsvp(event.id, 'not_going')}
                              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                event.rsvp?.status === 'not_going'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-700'
                              }`}
                            >
                              No
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              )
            })
          )}
        </div>
      ) : (
        // Calendar View
        <div className="p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <span className="material-icons">chevron_left</span>
            </button>
            <h3 className="font-semibold">
              {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <span className="material-icons">chevron_right</span>
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}

            {/* Empty cells for days before month starts */}
            {Array.from({ length: startingDay }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2" />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day)
              const dayEvents = getEventsForDate(date)
              const isToday = date.toDateString() === new Date().toDateString()

              return (
                <div
                  key={day}
                  className={`min-h-[60px] rounded-lg border p-1 ${
                    isToday ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border'
                  }`}
                >
                  <div className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {day}
                  </div>
                  {dayEvents.slice(0, 2).map(event => {
                    const config = EVENT_TYPE_CONFIG[event.event_type]
                    return (
                      <div
                        key={event.id}
                        className={`mt-1 truncate rounded px-1 py-0.5 text-xs ${config.bgColor} ${config.textColor}`}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    )
                  })}
                  {dayEvents.length > 2 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
