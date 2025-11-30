'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { WeatherWidget } from '@/components/weather/weather-widget'
import { EventCalendar } from '@/components/calendar/event-calendar'
import { PreparednessWidget } from '@/components/dashboard/preparedness-widget'
import { PDFExportWidget } from '@/components/dashboard/pdf-export-widget'
import { CommunityLocationsWidget } from '@/components/maps/community-locations-widget'

interface Alert {
  id: string
  type: 'warning' | 'info' | 'emergency'
  title: string
  message: string
  timestamp: Date
}

// Mock alerts - in production these would come from database
const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'info',
    title: 'Welcome to CivilDefence',
    message: 'Complete your profile to get personalized emergency preparedness recommendations.',
    timestamp: new Date(),
  },
]

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

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])

  // Load alerts filtering out previously dismissed ones
  useEffect(() => {
    const dismissed = getDismissedAlerts()
    const activeAlerts = mockAlerts.filter(alert => !dismissed.includes(alert.id))
    setAlerts(activeAlerts)
  }, [])

  const dismissAlert = (alertId: string) => {
    saveDismissedAlert(alertId)
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
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
        return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
    }
  }

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Alerts & Messages Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Alerts & Messages</h2>
            <span className="text-sm text-muted-foreground">{alerts.length} active</span>
          </div>

          {alerts.length === 0 ? (
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
                    <h3 className="font-semibold">{alert.title}</h3>
                    <p className="mt-1 text-sm opacity-90">{alert.message}</p>
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
      <aside className="hidden w-80 flex-shrink-0 xl:block">
        <div className="sticky top-6 space-y-6">
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
