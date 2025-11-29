'use client'

import { useOffline } from '@/hooks/useOffline'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WifiOff } from 'lucide-react'

export function OfflineIndicator() {
  const { isOffline } = useOffline()

  if (!isOffline) return null

  return (
    <Alert variant="warning" className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <WifiOff className="h-4 w-4" />
      <AlertDescription>
        You are currently offline. Some features may be limited.
      </AlertDescription>
    </Alert>
  )
}