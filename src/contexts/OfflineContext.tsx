'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './auth-context'
import { useOffline } from '@/hooks/useOffline'
import { syncService, type SyncProgress, type SyncResult } from '@/lib/offline/syncService'
import {
  saveProfile,
  saveCommunities,
  saveGuides,
  saveEmergencyContacts,
  getProfile,
  getCommunities,
  getAllGuides,
  getEmergencyContacts,
  clearAllOfflineData,
  type OfflineProfile,
} from '@/lib/offline/indexedDB'
import type {
  Community,
  CommunityGuide,
  EmergencyContact,
} from '@/types/database'

interface OfflineContextType {
  // Offline status
  isOffline: boolean
  justReconnected: boolean

  // Sync status
  isSyncing: boolean
  syncProgress: SyncProgress
  lastSyncTime: number | null
  pendingCount: number

  // Actions
  sync: () => Promise<SyncResult | null>
  clearOfflineData: () => Promise<void>

  // Cached data
  cachedProfile: OfflineProfile | null
  cachedCommunities: Community[]
  cachedGuides: CommunityGuide[]
  cachedEmergencyContacts: EmergencyContact[]

  // Data loading
  isDataLoaded: boolean

  // Cache management
  cacheProfile: (profile: OfflineProfile) => Promise<void>
  cacheCommunities: (communities: Community[]) => Promise<void>
  cacheGuides: (guides: CommunityGuide[]) => Promise<void>
  cacheEmergencyContacts: (contacts: EmergencyContact[]) => Promise<void>
}

const OfflineContext = createContext<OfflineContextType | null>(null)

export function useOfflineContext() {
  const context = useContext(OfflineContext)
  if (!context) {
    throw new Error('useOfflineContext must be used within an OfflineProvider')
  }
  return context
}

interface OfflineProviderProps {
  children: React.ReactNode
}

// Minimum time between syncs (5 minutes)
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000

export function OfflineProvider({ children }: OfflineProviderProps) {
  const { user } = useAuth()
  const { isOffline, justReconnected } = useOffline()

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    status: 'idle',
    progress: 0,
  })
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  // Cached data
  const [cachedProfile, setCachedProfile] = useState<OfflineProfile | null>(null)
  const [cachedCommunities, setCachedCommunities] = useState<Community[]>([])
  const [cachedGuides, setCachedGuides] = useState<CommunityGuide[]>([])
  const [cachedEmergencyContacts, setCachedEmergencyContacts] = useState<EmergencyContact[]>([])
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  // Refs to prevent duplicate syncs
  const syncInProgressRef = useRef(false)
  const initialSyncDone = useRef(false)
  const lastSyncTimeRef = useRef<number>(0)
  const userIdRef = useRef<string | null>(null)

  // Subscribe to sync progress
  useEffect(() => {
    const unsubscribe = syncService.onProgress((progress) => {
      setSyncProgress(progress)
      setIsSyncing(progress.status === 'syncing')
    })
    return unsubscribe
  }, [])

  // Load cached data from IndexedDB on mount - defined before use
  const loadCachedData = useCallback(async (userId: string) => {
    try {
      const [profileData, communitiesData, guidesData, contactsData] = await Promise.all([
        getProfile(userId),
        getCommunities(),
        getAllGuides(),
        getEmergencyContacts(userId),
      ])

      if (profileData) setCachedProfile(profileData)
      setCachedCommunities(communitiesData)
      setCachedGuides(guidesData)
      setCachedEmergencyContacts(contactsData)
      setIsDataLoaded(true)

      // Get last sync time and pending count
      const [time, count] = await Promise.all([
        syncService.getLastSyncTime(),
        syncService.getPendingSyncCount(),
      ])
      setLastSyncTime(time)
      setPendingCount(count)
    } catch (error) {
      console.error('Failed to load cached data:', error)
      setIsDataLoaded(true)
    }
  }, [])

  // Load cached data when user is available
  useEffect(() => {
    if (user?.id && user.id !== userIdRef.current) {
      userIdRef.current = user.id
      loadCachedData(user.id)
    }
  }, [user?.id, loadCachedData])

  // Sync function - defined before effects that use it
  const sync = useCallback(async (): Promise<SyncResult | null> => {
    const userId = user?.id
    if (!userId || isOffline || syncInProgressRef.current) {
      return null
    }

    // Check if we synced recently
    const now = Date.now()
    if (now - lastSyncTimeRef.current < MIN_SYNC_INTERVAL_MS) {
      console.log('[OfflineContext] Skipping sync - synced recently')
      return null
    }

    syncInProgressRef.current = true
    lastSyncTimeRef.current = now

    try {
      const result = await syncService.fullSync(userId)

      // Reload cached data after sync
      await loadCachedData(userId)

      return result
    } finally {
      syncInProgressRef.current = false
    }
  }, [user?.id, isOffline, loadCachedData])

  // Sync when coming back online (only once per reconnection)
  useEffect(() => {
    if (justReconnected && user?.id && !syncInProgressRef.current) {
      // Delay to ensure network is stable
      const timer = setTimeout(() => {
        sync()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [justReconnected, user?.id, sync])

  // Initial sync when user logs in (if online) - only once
  useEffect(() => {
    if (user?.id && !isOffline && !initialSyncDone.current && !syncInProgressRef.current) {
      initialSyncDone.current = true
      // Delay initial sync to let the app settle
      const timer = setTimeout(() => {
        sync()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [user?.id, isOffline, sync])

  // Listen for service worker sync messages
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_REQUIRED' || event.data?.type === 'PERIODIC_SYNC') {
        if (!isOffline && user?.id && !syncInProgressRef.current) {
          sync()
        }
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [isOffline, user?.id, sync])

  // Cache management functions
  const cacheProfile = useCallback(async (data: OfflineProfile) => {
    await saveProfile(data)
    setCachedProfile(data)
  }, [])

  const cacheCommunities = useCallback(async (data: Community[]) => {
    await saveCommunities(data)
    setCachedCommunities(data)
  }, [])

  const cacheGuides = useCallback(async (data: CommunityGuide[]) => {
    await saveGuides(data)
    setCachedGuides(data)
  }, [])

  const cacheEmergencyContacts = useCallback(async (contacts: EmergencyContact[]) => {
    if (!user?.id) return
    await saveEmergencyContacts(user.id, contacts)
    setCachedEmergencyContacts(contacts)
  }, [user?.id])

  // Clear all offline data
  const clearOfflineData = useCallback(async () => {
    await clearAllOfflineData()
    setCachedProfile(null)
    setCachedCommunities([])
    setCachedGuides([])
    setCachedEmergencyContacts([])
    setLastSyncTime(null)
    setPendingCount(0)
    setIsDataLoaded(false)
  }, [])

  const value: OfflineContextType = {
    isOffline,
    justReconnected,
    isSyncing,
    syncProgress,
    lastSyncTime,
    pendingCount,
    sync,
    clearOfflineData,
    cachedProfile,
    cachedCommunities,
    cachedGuides,
    cachedEmergencyContacts,
    isDataLoaded,
    cacheProfile,
    cacheCommunities,
    cacheGuides,
    cacheEmergencyContacts,
  }

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  )
}
