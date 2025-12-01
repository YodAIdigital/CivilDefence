'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Custom hook for detecting online/offline status
 * Used for PWA offline-first functionality
 */
export function useOffline() {
  const [isOffline, setIsOffline] = useState(false)
  const [justReconnected, setJustReconnected] = useState(false)
  const reconnectHandledRef = useRef(false)

  const handleOnline = useCallback(() => {
    setIsOffline(false)
    // Only set justReconnected once per reconnection event
    if (!reconnectHandledRef.current) {
      reconnectHandledRef.current = true
      setJustReconnected(true)
      // Reset justReconnected after a short delay (just long enough for one sync trigger)
      setTimeout(() => {
        setJustReconnected(false)
        // Allow future reconnections to trigger again
        setTimeout(() => {
          reconnectHandledRef.current = false
        }, 1000)
      }, 100)
    }
  }, [])

  const handleOffline = useCallback(() => {
    setIsOffline(true)
    reconnectHandledRef.current = false // Reset so next reconnect can trigger
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
    justReconnected
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