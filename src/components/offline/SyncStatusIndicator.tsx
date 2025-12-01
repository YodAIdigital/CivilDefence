'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useOfflineContext } from '@/contexts/OfflineContext'

interface SyncStatusIndicatorProps {
  showDetails?: boolean
  className?: string
}

export function SyncStatusIndicator({ showDetails = false, className = '' }: SyncStatusIndicatorProps) {
  const { user } = useAuth()
  const {
    syncProgress,
    lastSyncTime,
    pendingCount,
    isOffline,
    isSyncing,
    sync,
  } = useOfflineContext()

  const [showTooltip, setShowTooltip] = useState(false)

  // Format last sync time
  const formatLastSync = (timestamp: number | null): string => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Get status color
  const getStatusColor = (): string => {
    if (isOffline) return 'text-orange-500'
    if (isSyncing) return 'text-blue-500'
    if (pendingCount > 0) return 'text-yellow-500'
    return 'text-green-500'
  }

  // Get status icon
  const getStatusIcon = (): string => {
    if (isOffline) return 'cloud_off'
    if (isSyncing) return 'sync'
    if (pendingCount > 0) return 'cloud_upload'
    return 'cloud_done'
  }

  // Get status text
  const getStatusText = (): string => {
    if (isOffline) return 'Offline'
    if (isSyncing) return 'Syncing...'
    if (pendingCount > 0) return `${pendingCount} pending`
    return 'Synced'
  }

  const handleSyncClick = () => {
    if (!isOffline && !isSyncing) {
      sync()
    }
  }

  if (!user) return null

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={handleSyncClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={isOffline || isSyncing}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all
          ${isOffline ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}
          ${isSyncing ? 'cursor-wait' : isOffline ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}
        title={isOffline ? 'You are offline' : isSyncing ? 'Syncing...' : 'Click to sync'}
      >
        <span
          className={`material-icons text-lg ${getStatusColor()} ${isSyncing ? 'animate-spin' : ''}`}
        >
          {getStatusIcon()}
        </span>
        {showDetails && (
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-64 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Status:</span>
              <span className={`font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Last sync:</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {formatLastSync(lastSyncTime)}
              </span>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Pending:</span>
                <span className="font-medium text-yellow-600 dark:text-yellow-400">
                  {pendingCount} changes
                </span>
              </div>
            )}
            {isSyncing && syncProgress.message && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {syncProgress.message}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Floating sync status for mobile
export function FloatingSyncStatus() {
  const {
    syncProgress,
    pendingCount,
    isOffline,
    isSyncing,
    sync,
  } = useOfflineContext()

  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed state when status changes
  useEffect(() => {
    if (isOffline || pendingCount > 0) {
      setDismissed(false)
    }
  }, [isOffline, pendingCount])

  // Don't show if dismissed or everything is fine
  if (dismissed || (!isOffline && pendingCount === 0 && !isSyncing)) {
    return null
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50">
      <div
        className={`
          p-4 rounded-xl shadow-lg border
          ${isOffline
            ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }
        `}
      >
        <div className="flex items-start gap-3">
          <span
            className={`
              material-icons text-2xl mt-0.5
              ${isOffline ? 'text-orange-500' : isSyncing ? 'text-blue-500 animate-spin' : 'text-yellow-500'}
            `}
          >
            {isOffline ? 'cloud_off' : isSyncing ? 'sync' : 'cloud_upload'}
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {isOffline ? 'You are offline' : isSyncing ? 'Syncing data...' : 'Changes pending'}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {isOffline
                ? 'Your changes will sync when you reconnect'
                : isSyncing
                ? syncProgress.message || 'Please wait...'
                : `${pendingCount} changes waiting to sync`
              }
            </p>
            {isSyncing && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress.progress}%` }}
                />
              </div>
            )}
            {!isOffline && !isSyncing && pendingCount > 0 && (
              <button
                onClick={() => sync()}
                className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Sync now
              </button>
            )}
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span className="material-icons text-lg">close</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// Compact offline banner
export function OfflineBanner() {
  const { isOffline } = useOfflineContext()

  if (!isOffline) return null

  return (
    <div className="bg-orange-500 text-white py-2 px-4 text-center text-sm font-medium">
      <span className="material-icons text-sm align-middle mr-1">cloud_off</span>
      You are offline. Data shown may not be up to date.
    </div>
  )
}
