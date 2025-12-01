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

  // Subscribe to sync progress
  useEffect(() => {
    const unsubscribe = syncService.onProgress((progress) => {
      setSyncProgress(progress)
      setIsSyncing(progress.status === 'syncing')
    })
    return unsubscribe
  }, [])

  // Load cached data from IndexedDB on mount
  const loadCachedData = useCallback(async () => {
    if (!user?.id) return

    try {
      const [profileData, communitiesData, guidesData, contactsData] = await Promise.all([
        getProfile(user.id),
        getCommunities(),
        getAllGuides(),
        getEmergencyContacts(user.id),
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
  }, [user?.id])

  // Load cached data when user is available
  useEffect(() => {
    if (user?.id) {
      loadCachedData()
    }
  }, [user?.id, loadCachedData])

  // Sync when coming back online
  useEffect(() => {
    if (justReconnected && user?.id && !syncInProgressRef.current) {
      // Delay to ensure network is stable
      const timer = setTimeout(() => {
        sync()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [justReconnected, user?.id])

  // Initial sync when user logs in (if online)
  useEffect(() => {
    if (user?.id && !isOffline && !initialSyncDone.current && !syncInProgressRef.current) {
      initialSyncDone.current = true
      // Delay initial sync to let the app settle
      const timer = setTimeout(() => {
        sync()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [user?.id, isOffline])

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
  }, [isOffline, user?.id])

  // Sync function
  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (!user?.id || isOffline || syncInProgressRef.current) {
      return null
    }

    syncInProgressRef.current = true
    try {
      const result = await syncService.fullSync(user.id)

      // Reload cached data after sync
      await loadCachedData()

      return result
    } finally {
      syncInProgressRef.current = false
    }
  }, [user?.id, isOffline, loadCachedData])

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
