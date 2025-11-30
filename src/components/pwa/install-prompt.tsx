'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Share, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown'

  const ua = navigator.userAgent.toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /android/.test(ua)

  if (isIOS) return 'ios'
  if (isAndroid) return 'android'
  return 'desktop'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
    setIsInstalled(isStandalone())

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (platform === 'ios') {
      setShowIOSInstructions(true)
      return
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  // Don't show if already installed or dismissed
  if (isInstalled || dismissed) return null

  // Don't show on desktop if no install prompt available (browser doesn't support PWA install)
  if (platform === 'desktop' && !deferredPrompt) return null

  // Show iOS instructions modal
  if (showIOSInstructions) {
    return (
      <div className="mt-6 w-full max-w-sm">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              Install on iOS
            </h3>
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li className="flex items-start gap-2">
              <span className="font-bold">1.</span>
              <span>
                Tap the <Share className="inline h-4 w-4" /> Share button in Safari
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">2.</span>
              <span>Scroll down and tap &quot;Add to Home Screen&quot;</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">3.</span>
              <span>Tap &quot;Add&quot; to confirm</span>
            </li>
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleInstallClick}
        className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <Download className="mr-2 h-4 w-4" />
        Install App
      </Button>
      {platform !== 'desktop' && (
        <button
          onClick={handleDismiss}
          className="text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          Not now
        </button>
      )}
    </div>
  )
}
