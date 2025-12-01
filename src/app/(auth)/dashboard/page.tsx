'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { WeatherWidget } from '@/components/weather/weather-widget'
import { EventCalendar } from '@/components/calendar/event-calendar'
import { PreparednessWidget } from '@/components/dashboard/preparedness-widget'
import { PDFExportWidget } from '@/components/dashboard/pdf-export-widget'
import { CommunityLocationsWidget } from '@/components/maps/community-locations-widget'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/contexts/notification-context'
import { supabase } from '@/lib/supabase/client'
import type { AlertLevel } from '@/types/database'

interface Alert {
  id: string
  type: 'warning' | 'info' | 'emergency'
  title: string
  message: string
  timestamp: Date
  communityName?: string | undefined
  level?: AlertLevel
}

interface DBAlert {
  id: string
  title: string
  content: string
  level: AlertLevel
  community_id: string | null
  is_active: boolean
  created_at: string
  communities?: {
    name: string
  } | null
}

const DISMISSED_ALERTS_KEY = 'civildefence_dismissed_alerts'

function getDismissedAlerts(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(DISMISSED_ALERTS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveDismissedAlert(alertId: string) {
  try {
    const dismissed = getDismissedAlerts()
    if (!dismissed.includes(alertId)) {
      dismissed.push(alertId)
      localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(dismissed))
    }
  } catch {
    // Ignore localStorage errors
  }
}

// Map database alert level to UI type
function mapAlertLevel(level: AlertLevel): 'warning' | 'info' | 'emergency' {
  switch (level) {
    case 'danger':
    case 'critical':
      return 'emergency'
    case 'warning':
      return 'warning'
    case 'info':
    default:
      return 'info'
  }
}

// Key for tracking which alerts we've already notified about
const NOTIFIED_ALERTS_KEY = 'civildefence_notified_alerts'

function getNotifiedAlerts(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(NOTIFIED_ALERTS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveNotifiedAlert(alertId: string) {
  try {
    const notified = getNotifiedAlerts()
    if (!notified.includes(alertId)) {
      notified.push(alertId)
      // Keep only last 100 alert IDs to prevent localStorage bloat
      const trimmed = notified.slice(-100)
      localStorage.setItem(NOTIFIED_ALERTS_KEY, JSON.stringify(trimmed))
    }
  } catch {
    // Ignore localStorage errors
  }
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { sendAlertNotification, permission } = useNotifications()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const hasInitialFetch = useRef(false)

  const fetchAlerts = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      // Fetch alerts where user is a specific recipient
      // This respects the recipient_group filtering (admin, team, members, specific)
      console.log('=== DASHBOARD ALERTS DEBUG ===')
      console.log('Fetching alerts for user:', user.id)

      const { data: recipientAlerts, error: recipientError } = await supabase
        .from('alert_recipients')
        .select(`
          alert_id,
          alerts (
            id,
            title,
            content,
            level,
            community_id,
            is_active,
            created_at,
            communities (
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      console.log('Recipient alerts query result:', {
        count: recipientAlerts?.length || 0,
        data: recipientAlerts,
        error: recipientError?.message
      })

      // Extract alerts from recipients and filter active ones
      let dbAlerts: DBAlert[] = []

      if (recipientAlerts && recipientAlerts.length > 0) {
        dbAlerts = recipientAlerts
          .map(r => r.alerts as unknown as DBAlert)
          .filter(alert => alert && alert.is_active)
        console.log('Active alerts after filtering:', dbAlerts.length)
      }
      console.log('=== END DASHBOARD ALERTS DEBUG ===')

      // Filter out dismissed alerts
      const dismissed = getDismissedAlerts()
      const activeAlerts: Alert[] = dbAlerts
        .filter(alert => !dismissed.includes(alert.id))
        .map(alert => ({
          id: alert.id,
          type: mapAlertLevel(alert.level),
          title: alert.title,
          message: alert.content,
          timestamp: new Date(alert.created_at),
          communityName: alert.communities?.name,
          level: alert.level, // Keep original level for notifications
        }))

      setAlerts(activeAlerts)

      // Send push notifications for new alerts (only after initial load)
      if (hasInitialFetch.current && permission === 'granted') {
        const notifiedAlerts = getNotifiedAlerts()
        for (const alert of activeAlerts) {
          // Only notify for alerts we haven't notified about yet
          // and that are less than 1 hour old
          const alertAge = Date.now() - alert.timestamp.getTime()
          const isRecent = alertAge < 60 * 60 * 1000 // 1 hour

          if (!notifiedAlerts.includes(alert.id) && isRecent) {
            const dbAlert = dbAlerts.find(a => a.id === alert.id)
            const level = dbAlert?.level || 'info'
            await sendAlertNotification(
              alert.title,
              alert.message,
              level as 'info' | 'warning' | 'danger' | 'critical',
              alert.id
            )
            saveNotifiedAlert(alert.id)
          }
        }
      }
      hasInitialFetch.current = true
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, permission, sendAlertNotification])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Subscribe to real-time alerts updates
  useEffect(() => {
    if (!user) return

    // Set up real-time subscription for new alert recipients (targeted to this user)
    const channel = supabase
      .channel('alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alert_recipients',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refetch alerts when a new recipient entry is added for this user
          fetchAlerts()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'alerts',
        },
        () => {
          // Refetch when an alert is updated (e.g., deactivated)
          fetchAlerts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchAlerts])

  const dismissAlert = async (alertId: string) => {
    saveDismissedAlert(alertId)
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))

    // Also mark as acknowledged in database
    if (user) {
      try {
        await supabase
          .from('alert_acknowledgments')
          .insert({
            alert_id: alertId,
            user_id: user.id,
          })
      } catch {
        // Ignore errors - localStorage dismissal is sufficient
      }
    }
  }

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'emergency':
        return 'error'
      case 'warning':
        return 'warning'
      default:
        return 'info'
    }
  }

  const getAlertColor = (type: Alert['type']) => {
    switch (type) {
      case 'emergency':
        return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200'
      default:
        return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
    }
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Alerts & Messages Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Alerts & Messages</h2>
            <span className="text-sm text-muted-foreground">
              {isLoading ? 'Loading...' : `${alerts.length} active`}
            </span>
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <span className="material-icons animate-spin text-4xl text-muted-foreground">sync</span>
              <p className="mt-2 text-muted-foreground">Loading alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <span className="material-icons text-4xl text-muted-foreground">notifications_none</span>
              <p className="mt-2 text-muted-foreground">No alerts at this time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-4 rounded-xl border p-4 ${getAlertColor(alert.type)}`}
                >
                  <span className="material-icons text-2xl">{getAlertIcon(alert.type)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{alert.title}</h3>
                      {alert.communityName && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
                          {alert.communityName}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm opacity-90 whitespace-pre-wrap">{alert.message}</p>
                    <p className="mt-2 text-xs opacity-70">
                      {alert.timestamp.toLocaleDateString()} at {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="text-current opacity-60 hover:opacity-100 p-1 rounded-lg hover:bg-black/10 transition-colors"
                    aria-label="Dismiss alert"
                  >
                    <span className="material-icons">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Community Locations */}
        <CommunityLocationsWidget />
      </div>

      {/* Right Sidebar - PDF Export, Weather, Calendar & Schedule */}
      <aside className="w-full xl:w-80 flex-shrink-0">
        {/* Grid layout on smaller screens, stack on xl+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 xl:gap-6 xl:sticky xl:top-6">
          {/* PDF Export Widget */}
          <PDFExportWidget />

          {/* Weather Widget */}
          <WeatherWidget />

          {/* Community Events Calendar */}
          <EventCalendar compact maxEvents={3} />

          {/* Preparedness Score Widget */}
          <PreparednessWidget />
        </div>
      </aside>
    </div>
  )
}
