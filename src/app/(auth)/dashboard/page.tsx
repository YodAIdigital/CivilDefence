'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { WeatherWidget } from '@/components/weather/weather-widget'
import { EventCalendar } from '@/components/calendar/event-calendar'
import { PreparednessWidget } from '@/components/dashboard/preparedness-widget'
import { PDFExportWidget } from '@/components/dashboard/pdf-export-widget'
import { CommunityLocationsWidget } from '@/components/maps/community-locations-widget'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'
import type { AlertLevel } from '@/types/database'

interface Alert {
  id: string
  type: 'warning' | 'info' | 'emergency'
  title: string
  message: string
  timestamp: Date
  communityName?: string | undefined
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

export default function DashboardPage() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchAlerts = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      // Get user's community memberships
      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', user.id)

      const communityIds = memberships?.map(m => m.community_id) || []

      // Fetch alerts for user's communities
      let dbAlerts: DBAlert[] = []

      if (communityIds.length > 0) {
        const { data: alertsData } = await supabase
          .from('alerts')
          .select(`
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
          `)
          .eq('is_active', true)
          .in('community_id', communityIds)
          .order('created_at', { ascending: false })
          .limit(20)

        dbAlerts = (alertsData || []) as unknown as DBAlert[]
      }

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
        }))

      setAlerts(activeAlerts)
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

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
