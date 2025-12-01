'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOffline } from './useOffline'
import {
  STORES,
  type StoreName,
  getProfile,
  saveProfile,
  getCommunities,
  saveCommunities,
  getGuides,
  getAllGuides,
  getMapPoints,
  getAlerts,
  getEvents,
  getChecklist,
  saveChecklist,
  getEmergencyContacts,
  saveEmergencyContacts,
  addToSyncQueue,
  isDataStale,
  type OfflineProfile,
  type OfflineChecklistData,
} from '@/lib/offline/indexedDB'
import { syncService, type SyncProgress, type SyncResult } from '@/lib/offline/syncService'
import type {
  Community,
  CommunityGuide,
  CommunityMapPoint,
  Alert,
  CommunityEvent,
  EmergencyContact,
} from '@/types/database'

// Hook for managing offline profile data
export function useOfflineProfile(userId: string | null) {
  const [profile, setProfile] = useState<OfflineProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const { isOffline } = useOffline()

  // Load profile from IndexedDB
  const loadFromCache = useCallback(async () => {
    if (!userId) return
    try {
      const cached = await getProfile(userId)
      if (cached) {
        setProfile(cached)
      }
    } catch (e) {
      console.error('Failed to load cached profile:', e)
    }
  }, [userId])

  // Save profile to IndexedDB and optionally queue for sync
  const saveToCache = useCallback(
    async (data: OfflineProfile, queueSync = true) => {
      try {
        await saveProfile(data)
        setProfile(data)

        if (queueSync && isOffline) {
          await addToSyncQueue({
            type: 'update',
            store: STORES.PROFILE,
            entityId: data.id,
            payload: data as unknown as Record<string, unknown>,
          })
        }
      } catch (e) {
        console.error('Failed to save profile to cache:', e)
        throw e
      }
    },
    [isOffline]
  )

  useEffect(() => {
    if (userId) {
      setLoading(true)
      loadFromCache().finally(() => setLoading(false))
    }
  }, [userId, loadFromCache])

  return {
    profile,
    loading,
    saveToCache,
    loadFromCache,
    isOffline,
  }
}

// Hook for managing offline communities data
export function useOfflineCommunities(userId: string | null) {
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const { isOffline } = useOffline()

  const loadFromCache = useCallback(async () => {
    if (!userId) return
    try {
      const cachedCommunities = await getCommunities()
      setCommunities(cachedCommunities)
    } catch (e) {
      console.error('Failed to load cached communities:', e)
    }
  }, [userId])

  const saveToCache = useCallback(async (data: Community[]) => {
    try {
      await saveCommunities(data)
      setCommunities(data)
    } catch (e) {
      console.error('Failed to save communities to cache:', e)
    }
  }, [])

  useEffect(() => {
    if (userId) {
      setLoading(true)
      loadFromCache().finally(() => setLoading(false))
    }
  }, [userId, loadFromCache])

  return {
    communities,
    loading,
    saveToCache,
    loadFromCache,
    isOffline,
  }
}

// Hook for managing offline guides/response plans
export function useOfflineGuides(communityId?: string) {
  const [guides, setGuides] = useState<CommunityGuide[]>([])
  const [loading, setLoading] = useState(true)
  const { isOffline } = useOffline()

  const loadFromCache = useCallback(async () => {
    try {
      const cached = communityId ? await getGuides(communityId) : await getAllGuides()
      setGuides(cached)
    } catch (e) {
      console.error('Failed to load cached guides:', e)
    }
  }, [communityId])

  useEffect(() => {
    setLoading(true)
    loadFromCache().finally(() => setLoading(false))
  }, [loadFromCache])

  return {
    guides,
    loading,
    loadFromCache,
    isOffline,
  }
}

// Hook for managing offline map points
export function useOfflineMapPoints(communityId: string | null) {
  const [mapPoints, setMapPoints] = useState<CommunityMapPoint[]>([])
  const [loading, setLoading] = useState(true)
  const { isOffline } = useOffline()

  const loadFromCache = useCallback(async () => {
    if (!communityId) return
    try {
      const cached = await getMapPoints(communityId)
      setMapPoints(cached)
    } catch (e) {
      console.error('Failed to load cached map points:', e)
    }
  }, [communityId])

  useEffect(() => {
    if (communityId) {
      setLoading(true)
      loadFromCache().finally(() => setLoading(false))
    }
  }, [communityId, loadFromCache])

  return {
    mapPoints,
    loading,
    loadFromCache,
    isOffline,
  }
}

// Hook for managing offline alerts
export function useOfflineAlerts(communityId?: string) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const { isOffline } = useOffline()

  const loadFromCache = useCallback(async () => {
    try {
      const cached = await getAlerts(communityId)
      setAlerts(cached)
    } catch (e) {
      console.error('Failed to load cached alerts:', e)
    }
  }, [communityId])

  useEffect(() => {
    setLoading(true)
    loadFromCache().finally(() => setLoading(false))
  }, [loadFromCache])

  return {
    alerts,
    loading,
    loadFromCache,
    isOffline,
  }
}

// Hook for managing offline events
export function useOfflineEvents(communityId: string | null) {
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const { isOffline } = useOffline()

  const loadFromCache = useCallback(async () => {
    if (!communityId) return
    try {
      const cached = await getEvents(communityId)
      setEvents(cached)
    } catch (e) {
      console.error('Failed to load cached events:', e)
    }
  }, [communityId])

  useEffect(() => {
    if (communityId) {
      setLoading(true)
      loadFromCache().finally(() => setLoading(false))
    }
  }, [communityId, loadFromCache])

  return {
    events,
    loading,
    loadFromCache,
    isOffline,
  }
}

// Hook for managing offline checklist
export function useOfflineChecklist(userId: string | null) {
  const [checklist, setChecklist] = useState<OfflineChecklistData | null>(null)
  const [loading, setLoading] = useState(true)
  const { isOffline } = useOffline()

  const loadFromCache = useCallback(async () => {
    if (!userId) return
    try {
      const cached = await getChecklist(userId)
      if (cached) {
        setChecklist(cached)
      }
    } catch (e) {
      console.error('Failed to load cached checklist:', e)
    }
  }, [userId])

  const saveToCache = useCallback(
    async (data: OfflineChecklistData) => {
      try {
        await saveChecklist(data)
        setChecklist(data)

        if (isOffline) {
          await addToSyncQueue({
            type: 'update',
            store: STORES.CHECKLIST,
            entityId: data.id,
            payload: data as unknown as Record<string, unknown>,
          })
        }
      } catch (e) {
        console.error('Failed to save checklist to cache:', e)
      }
    },
    [isOffline]
  )

  useEffect(() => {
    if (userId) {
      setLoading(true)
      loadFromCache().finally(() => setLoading(false))
    }
  }, [userId, loadFromCache])

  return {
    checklist,
    loading,
    saveToCache,
    loadFromCache,
    isOffline,
  }
}

// Hook for managing offline emergency contacts
export function useOfflineEmergencyContacts(userId: string | null) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [loading, setLoading] = useState(true)
  const { isOffline } = useOffline()

  const loadFromCache = useCallback(async () => {
    if (!userId) return
    try {
      const cached = await getEmergencyContacts(userId)
      setContacts(cached)
    } catch (e) {
      console.error('Failed to load cached emergency contacts:', e)
    }
  }, [userId])

  const saveToCache = useCallback(
    async (data: EmergencyContact[]) => {
      if (!userId) return
      try {
        await saveEmergencyContacts(userId, data)
        setContacts(data)

        if (isOffline) {
          await addToSyncQueue({
            type: 'update',
            store: STORES.EMERGENCY_CONTACTS,
            entityId: `contacts_${userId}`,
            payload: { userId, contacts: data },
          })
        }
      } catch (e) {
        console.error('Failed to save emergency contacts to cache:', e)
      }
    },
    [userId, isOffline]
  )

  useEffect(() => {
    if (userId) {
      setLoading(true)
      loadFromCache().finally(() => setLoading(false))
    }
  }, [userId, loadFromCache])

  return {
    contacts,
    loading,
    saveToCache,
    loadFromCache,
    isOffline,
  }
}

// Main hook for sync management
// NOTE: Prefer using OfflineContext instead of this hook to avoid duplicate syncs
export function useOfflineSync(userId: string | null) {
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    status: 'idle',
    progress: 0,
  })
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const { isOffline } = useOffline()
  const syncInProgressRef = useRef(false)

  // Subscribe to sync progress
  useEffect(() => {
    const unsubscribe = syncService.onProgress(setSyncProgress)
    return unsubscribe
  }, [])

  // Load last sync time and pending count
  const refreshSyncStatus = useCallback(async () => {
    const [time, count] = await Promise.all([
      syncService.getLastSyncTime(),
      syncService.getPendingSyncCount(),
    ])
    setLastSyncTime(time)
    setPendingCount(count)
  }, [])

  useEffect(() => {
    refreshSyncStatus()
  }, [refreshSyncStatus])

  // Trigger full sync
  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (!userId || isOffline || syncInProgressRef.current) {
      return null
    }

    syncInProgressRef.current = true
    try {
      const result = await syncService.fullSync(userId)
      await refreshSyncStatus()
      return result
    } finally {
      syncInProgressRef.current = false
    }
  }, [userId, isOffline, refreshSyncStatus])

  // NOTE: Auto-sync on reconnect is handled by OfflineContext
  // Removed from here to prevent duplicate syncs

  // Check if data is stale and needs sync
  const checkStaleData = useCallback(
    async (store: StoreName, maxAgeMinutes: number = 30): Promise<boolean> => {
      return isDataStale(store, maxAgeMinutes)
    },
    []
  )

  return {
    syncProgress,
    lastSyncTime,
    pendingCount,
    isOffline,
    isSyncing: syncProgress.status === 'syncing',
    sync,
    refreshSyncStatus,
    checkStaleData,
  }
}

// Hook for data that falls back to cache when offline
export function useOfflineFirst<T>(
  fetchOnline: () => Promise<T>,
  loadFromCache: () => Promise<T | null>,
  saveToCache: (data: T) => Promise<void>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'online' | 'cache' | null>(null)
  const { isOffline } = useOffline()

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (isOffline) {
        // Offline - load from cache
        const cached = await loadFromCache()
        if (cached) {
          setData(cached)
          setSource('cache')
        } else {
          setError('No cached data available')
        }
      } else {
        // Online - try to fetch fresh data
        try {
          const fresh = await fetchOnline()
          setData(fresh)
          setSource('online')
          // Save to cache for offline use
          await saveToCache(fresh)
        } catch (e) {
          // Network failed - fall back to cache
          console.error('Online fetch failed, falling back to cache:', e)
          const cached = await loadFromCache()
          if (cached) {
            setData(cached)
            setSource('cache')
          } else {
            throw e
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [isOffline, fetchOnline, loadFromCache, saveToCache])

  useEffect(() => {
    fetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline, ...deps])

  return {
    data,
    loading,
    error,
    source,
    refetch: fetch,
    isOffline,
  }
}
