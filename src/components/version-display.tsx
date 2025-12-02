'use client'

import { useState, useEffect } from 'react'
import packageJson from '../../package.json'

// Detect if running as a mobile app (PWA in standalone mode)
function isMobileApp(): boolean {
  if (typeof window === 'undefined') return false

  // Check if running as installed PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const isInStandaloneMode = (window.navigator as Navigator & { standalone?: boolean }).standalone === true

  // Check if on mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    window.navigator.userAgent
  )

  return (isStandalone || isInStandaloneMode) && isMobile
}

interface VersionDisplayProps {
  collapsed?: boolean
  inline?: boolean
}

export function VersionDisplay({ collapsed = false, inline = false }: VersionDisplayProps) {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [showOnMobile, setShowOnMobile] = useState(false)

  const currentVersion = packageJson.version

  useEffect(() => {
    // Check if we're on mobile app to show update button
    setShowOnMobile(isMobileApp())

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setIsUpdateAvailable(true)
              }
            })
          }
        })
      })
    }
  }, [])

  const checkForUpdate = async () => {
    if (!('serviceWorker' in navigator)) return

    setIsChecking(true)
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.update()

      // Give time for update to be detected
      setTimeout(() => {
        setIsChecking(false)
        if (!isUpdateAvailable) {
          // Show brief "up to date" message if no update found
        }
      }, 2000)
    } catch (error) {
      console.error('Error checking for updates:', error)
      setIsChecking(false)
    }
  }

  const applyUpdate = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Tell the service worker to skip waiting
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
      // Reload the page to activate new version
      window.location.reload()
    }
  }

  if (collapsed) {
    return (
      <span className="text-[10px] text-muted-foreground">v{currentVersion}</span>
    )
  }

  if (inline) {
    return (
      <span className="text-xs text-muted-foreground">Version {currentVersion}</span>
    )
  }

  return (
    <div className="px-3 py-2 border-t border-border">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Version {currentVersion}</span>

        {/* Update button - only show on mobile app */}
        {showOnMobile && (
          <>
            {isUpdateAvailable ? (
              <button
                onClick={applyUpdate}
                className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
              >
                <span className="material-icons text-sm">system_update</span>
                Update
              </button>
            ) : (
              <button
                onClick={checkForUpdate}
                disabled={isChecking}
                className="flex items-center gap-1 hover:text-foreground transition-colors disabled:opacity-50"
                title="Check for updates"
              >
                <span className={`material-icons text-sm ${isChecking ? 'animate-spin' : ''}`}>
                  {isChecking ? 'sync' : 'refresh'}
                </span>
                {isChecking ? 'Checking...' : 'Check'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Update available indicator for mobile */}
      {showOnMobile && isUpdateAvailable && (
        <p className="text-[10px] text-primary mt-1">
          New version available! Tap Update to install.
        </p>
      )}
    </div>
  )
}
