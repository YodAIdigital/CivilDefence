'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook for detecting online/offline status
 * Used for PWA offline-first functionality
 */
export function useOffline() {
  const [isOffline, setIsOffline] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  const handleOnline = useCallback(() => {
    if (isOffline) {
      setWasOffline(true)
      // Reset wasOffline after 5 seconds to hide reconnection message
      setTimeout(() => setWasOffline(false), 5000)
    }
    setIsOffline(false)
  }, [isOffline])

  const handleOffline = useCallback(() => {
    setIsOffline(true)
  }, [])

  useEffect(() => {
    // Check initial state
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  return {
    isOffline,
    isOnline: !isOffline,
    wasOffline,
    justReconnected: wasOffline && !isOffline
  }
}

/**
 * Custom hook for managing sync queue when offline
 */
export function useSyncQueue<T>() {
  const [queue, setQueue] = useState<T[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  const addToQueue = useCallback((item: T) => {
    setQueue(prev => [...prev, item])
  }, [])

  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clearQueue = useCallback(() => {
    setQueue([])
  }, [])

  const processQueue = useCallback(
    async (processor: (item: T) => Promise<void>) => {
      if (queue.length === 0 || isSyncing) return

      setIsSyncing(true)
      const failedItems: T[] = []

      for (const item of queue) {
        try {
          await processor(item)
        } catch {
          failedItems.push(item)
        }
      }

      setQueue(failedItems)
      setIsSyncing(false)
    },
    [queue, isSyncing]
  )

  return {
    queue,
    queueLength: queue.length,
    isSyncing,
    addToQueue,
    removeFromQueue,
    clearQueue,
    processQueue
  }
}