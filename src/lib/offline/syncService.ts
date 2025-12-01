/**
 * Offline Sync Service
 * Handles synchronization between IndexedDB and Supabase
 * with conflict resolution and retry logic
 */

import { supabase } from '@/lib/supabase/client'
import {
  STORES,
  type StoreName,
  type SyncAction,
  getSyncQueue,
  removeSyncAction,
  updateSyncAction,
  saveProfile,
  saveCommunities,
  saveCommunityMembers,
  saveGuides,
  saveMapPoints,
  saveAlerts,
  saveEvents,
  getStoreMeta,
  type OfflineProfile,
} from './indexedDB'
import type {
  CommunityGuide,
  CommunityMapPoint,
  ProfileExtended,
} from '@/types/database'

// Sync configuration
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000

// Change detection result
export interface ChangeCheckResult {
  hasChanges: boolean
  changedStores: StoreName[]
  latestUpdateTime: number | null
}

// Sync status types
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'

export interface SyncResult {
  success: boolean
  error?: string
  syncedCount: number
  failedCount: number
  timestamp: number
}

export interface SyncProgress {
  status: SyncStatus
  currentStore?: StoreName
  progress: number // 0-100
  message?: string
}

// Event types for sync progress updates
type SyncProgressCallback = (progress: SyncProgress) => void

class SyncService {
  private isSyncing = false
  private progressCallbacks: Set<SyncProgressCallback> = new Set()

  // Subscribe to sync progress updates
  onProgress(callback: SyncProgressCallback): () => void {
    this.progressCallbacks.add(callback)
    return () => this.progressCallbacks.delete(callback)
  }

  private notifyProgress(progress: SyncProgress): void {
    this.progressCallbacks.forEach((cb) => cb(progress))
  }

  // Check if we're currently syncing
  get syncing(): boolean {
    return this.isSyncing
  }

  // Full sync - download all data from server
  async fullSync(userId: string): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        error: 'Sync already in progress',
        syncedCount: 0,
        failedCount: 0,
        timestamp: Date.now(),
      }
    }

    this.isSyncing = true
    let syncedCount = 0
    let failedCount = 0

    try {
      this.notifyProgress({ status: 'syncing', progress: 0, message: 'Starting sync...' })

      // 1. Sync profile
      this.notifyProgress({
        status: 'syncing',
        currentStore: STORES.PROFILE,
        progress: 10,
        message: 'Syncing profile...',
      })
      try {
        await this.syncProfileFromServer(userId)
        syncedCount++
      } catch (e) {
        console.error('Failed to sync profile:', e)
        failedCount++
      }

      // 2. Sync communities and memberships
      this.notifyProgress({
        status: 'syncing',
        currentStore: STORES.COMMUNITIES,
        progress: 25,
        message: 'Syncing communities...',
      })
      try {
        await this.syncCommunitiesFromServer(userId)
        syncedCount++
      } catch (e) {
        console.error('Failed to sync communities:', e)
        failedCount++
      }

      // 3. Sync guides for all communities
      this.notifyProgress({
        status: 'syncing',
        currentStore: STORES.GUIDES,
        progress: 40,
        message: 'Syncing response plans...',
      })
      try {
        await this.syncGuidesFromServer(userId)
        syncedCount++
      } catch (e) {
        console.error('Failed to sync guides:', e)
        failedCount++
      }

      // 4. Sync map points
      this.notifyProgress({
        status: 'syncing',
        currentStore: STORES.MAP_POINTS,
        progress: 55,
        message: 'Syncing map points...',
      })
      try {
        await this.syncMapPointsFromServer(userId)
        syncedCount++
      } catch (e) {
        console.error('Failed to sync map points:', e)
        failedCount++
      }

      // 5. Sync alerts
      this.notifyProgress({
        status: 'syncing',
        currentStore: STORES.ALERTS,
        progress: 70,
        message: 'Syncing alerts...',
      })
      try {
        await this.syncAlertsFromServer(userId)
        syncedCount++
      } catch (e) {
        console.error('Failed to sync alerts:', e)
        failedCount++
      }

      // 6. Sync events
      this.notifyProgress({
        status: 'syncing',
        currentStore: STORES.EVENTS,
        progress: 85,
        message: 'Syncing events...',
      })
      try {
        await this.syncEventsFromServer(userId)
        syncedCount++
      } catch (e) {
        console.error('Failed to sync events:', e)
        failedCount++
      }

      // 7. Process pending sync queue (upload local changes)
      this.notifyProgress({
        status: 'syncing',
        currentStore: STORES.SYNC_QUEUE,
        progress: 95,
        message: 'Uploading pending changes...',
      })
      try {
        await this.processSyncQueue()
      } catch (e) {
        console.error('Failed to process sync queue:', e)
      }

      this.notifyProgress({
        status: 'success',
        progress: 100,
        message: 'Sync complete!',
      })

      return {
        success: failedCount === 0,
        syncedCount,
        failedCount,
        timestamp: Date.now(),
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
      this.notifyProgress({
        status: 'error',
        progress: 0,
        message: errorMessage,
      })

      return {
        success: false,
        error: errorMessage,
        syncedCount,
        failedCount,
        timestamp: Date.now(),
      }
    } finally {
      this.isSyncing = false
    }
  }

  // Sync profile from server
  private async syncProfileFromServer(userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    if (!data) return

    // Fetch extended profile data if stored separately
    const profile: OfflineProfile = {
      ...data,
      extended: data.notification_preferences as unknown as ProfileExtended,
    }

    await saveProfile(profile)
  }

  // Sync communities from server
  private async syncCommunitiesFromServer(userId: string): Promise<void> {
    // Get user's community memberships
    const { data: memberships, error: memberError } = await supabase
      .from('community_members')
      .select('*')
      .eq('user_id', userId)

    if (memberError) throw memberError

    if (memberships && memberships.length > 0) {
      await saveCommunityMembers(memberships)

      // Get full community data for all memberships
      const communityIds = memberships.map((m) => m.community_id)
      const { data: communities, error: commError } = await supabase
        .from('communities')
        .select('*')
        .in('id', communityIds)

      if (commError) throw commError
      if (communities) {
        await saveCommunities(communities)
      }
    }
  }

  // Sync guides from server
  private async syncGuidesFromServer(userId: string): Promise<void> {
    // Get user's communities first
    const { data: memberships } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', userId)

    if (!memberships || memberships.length === 0) return

    const communityIds = memberships.map((m) => m.community_id)

    // Fetch guides for all user's communities
    // Note: community_guides table exists but not in generated types yet
    const { data: guides, error } = await (supabase
      .from('community_guides' as 'profiles')
      .select('*')
      .in('community_id', communityIds)
      .eq('is_active', true) as unknown as Promise<{ data: CommunityGuide[] | null; error: Error | null }>)

    if (error) throw error
    if (guides) {
      await saveGuides(guides)
    }
  }

  // Sync map points from server
  private async syncMapPointsFromServer(userId: string): Promise<void> {
    const { data: memberships } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', userId)

    if (!memberships || memberships.length === 0) return

    const communityIds = memberships.map((m) => m.community_id)

    const { data: points, error } = await supabase
      .from('community_map_points')
      .select('*')
      .in('community_id', communityIds)
      .eq('is_active', true)

    if (error) throw error
    if (points) {
      await saveMapPoints(points as CommunityMapPoint[])
    }
  }

  // Sync alerts from server
  private async syncAlertsFromServer(userId: string): Promise<void> {
    const { data: memberships } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', userId)

    const communityIds = memberships?.map((m) => m.community_id) || []

    // Get active alerts for user's communities + public alerts
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('is_active', true)
      .or(`community_id.in.(${communityIds.join(',')}),is_public.eq.true`)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    if (alerts) {
      await saveAlerts(alerts)
    }
  }

  // Sync events from server
  private async syncEventsFromServer(userId: string): Promise<void> {
    const { data: memberships } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', userId)

    if (!memberships || memberships.length === 0) return

    const communityIds = memberships.map((m) => m.community_id)

    // Get upcoming events (next 30 days)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const { data: events, error } = await supabase
      .from('community_events')
      .select('*')
      .in('community_id', communityIds)
      .gte('start_time', new Date().toISOString())
      .lte('start_time', thirtyDaysFromNow.toISOString())
      .eq('is_cancelled', false)
      .order('start_time', { ascending: true })

    if (error) throw error
    if (events) {
      await saveEvents(events)
    }
  }

  // Process the sync queue - upload pending changes to server
  async processSyncQueue(): Promise<{ processed: number; failed: number }> {
    const queue = await getSyncQueue()
    let processed = 0
    let failed = 0

    for (const action of queue) {
      if (action.attempts >= MAX_RETRY_ATTEMPTS) {
        // Max retries exceeded, remove from queue
        await removeSyncAction(action.id)
        failed++
        continue
      }

      try {
        await this.processAction(action)
        await removeSyncAction(action.id)
        processed++
      } catch (error) {
        console.error('Sync action failed:', error)
        // Update retry count
        await updateSyncAction({
          ...action,
          attempts: action.attempts + 1,
          lastAttempt: Date.now(),
        })
        failed++

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }

    return { processed, failed }
  }

  // Process a single sync action
  private async processAction(action: SyncAction): Promise<void> {
    const { type, store, entityId, payload } = action

    switch (store) {
      case STORES.PROFILE:
        await this.syncProfileAction(type, entityId, payload)
        break
      case STORES.CHECKLIST:
        await this.syncChecklistAction(type, entityId, payload)
        break
      case STORES.EMERGENCY_CONTACTS:
        await this.syncEmergencyContactsAction(type, entityId, payload)
        break
      // Add more cases as needed
      default:
        console.warn(`Sync not implemented for store: ${store}`)
    }
  }

  // Sync profile changes to server
  private async syncProfileAction(
    type: 'create' | 'update' | 'delete',
    entityId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (type === 'update') {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', entityId)

      if (error) throw error
    }
  }

  // Sync checklist changes (if stored on server)
  private async syncChecklistAction(
    type: 'create' | 'update' | 'delete',
    entityId: string,
    _payload: Record<string, unknown>
  ): Promise<void> {
    // Checklists are currently local-only
    // This could be extended to sync to user_checklists table
    console.log('Checklist sync:', type, entityId)
  }

  // Sync emergency contacts to server
  private async syncEmergencyContactsAction(
    type: 'create' | 'update' | 'delete',
    entityId: string,
    _payload: Record<string, unknown>
  ): Promise<void> {
    // Emergency contacts are stored in profile.extended
    // This would need to update the profile's notification_preferences JSON
    console.log('Emergency contacts sync:', type, entityId)
  }

  // Sync a single store
  async syncStore(store: StoreName, userId: string): Promise<void> {
    switch (store) {
      case STORES.PROFILE:
        await this.syncProfileFromServer(userId)
        break
      case STORES.COMMUNITIES:
      case STORES.COMMUNITY_MEMBERS:
        await this.syncCommunitiesFromServer(userId)
        break
      case STORES.GUIDES:
        await this.syncGuidesFromServer(userId)
        break
      case STORES.MAP_POINTS:
        await this.syncMapPointsFromServer(userId)
        break
      case STORES.ALERTS:
        await this.syncAlertsFromServer(userId)
        break
      case STORES.EVENTS:
        await this.syncEventsFromServer(userId)
        break
      default:
        console.warn(`Sync not implemented for store: ${store}`)
    }
  }

  // Check if any store needs syncing
  async needsSync(maxAgeMinutes: number = 30): Promise<boolean> {
    const stores = [
      STORES.PROFILE,
      STORES.COMMUNITIES,
      STORES.GUIDES,
      STORES.ALERTS,
    ]

    for (const store of stores) {
      const meta = await getStoreMeta(store)
      if (!meta) return true

      const ageMs = Date.now() - meta.lastSyncedAt
      const maxAgeMs = maxAgeMinutes * 60 * 1000
      if (ageMs > maxAgeMs) return true
    }

    return false
  }

  // Get last sync time
  async getLastSyncTime(): Promise<number | null> {
    const stores = Object.values(STORES) as StoreName[]
    let oldestSync: number | null = null

    for (const store of stores) {
      const meta = await getStoreMeta(store)
      if (meta) {
        if (oldestSync === null || meta.lastSyncedAt < oldestSync) {
          oldestSync = meta.lastSyncedAt
        }
      }
    }

    return oldestSync
  }

  // Get pending sync count
  async getPendingSyncCount(): Promise<number> {
    const queue = await getSyncQueue()
    return queue.length
  }

  // Lightweight check for remote changes without downloading data
  // This compares server timestamps against local cache timestamps
  async checkForChanges(userId: string): Promise<ChangeCheckResult> {
    const changedStores: StoreName[] = []
    let latestUpdateTime: number | null = null

    try {
      // Get user's community IDs first
      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', userId)

      const communityIds = memberships?.map((m) => m.community_id) || []

      // Check profile updated_at
      const profileMeta = await getStoreMeta(STORES.PROFILE)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('updated_at')
        .eq('id', userId)
        .single()

      if (profileData?.updated_at) {
        const serverTime = new Date(profileData.updated_at).getTime()
        if (!profileMeta || serverTime > profileMeta.lastSyncedAt) {
          changedStores.push(STORES.PROFILE)
        }
        if (!latestUpdateTime || serverTime > latestUpdateTime) {
          latestUpdateTime = serverTime
        }
      }

      // Check communities - get max updated_at
      if (communityIds.length > 0) {
        const communitiesMeta = await getStoreMeta(STORES.COMMUNITIES)
        const { data: commData } = await supabase
          .from('communities')
          .select('updated_at')
          .in('id', communityIds)
          .order('updated_at', { ascending: false })
          .limit(1)

        if (commData?.[0]?.updated_at) {
          const serverTime = new Date(commData[0].updated_at).getTime()
          if (!communitiesMeta || serverTime > communitiesMeta.lastSyncedAt) {
            changedStores.push(STORES.COMMUNITIES)
          }
          if (!latestUpdateTime || serverTime > latestUpdateTime) {
            latestUpdateTime = serverTime
          }
        }

        // Check alerts - get latest created_at
        const alertsMeta = await getStoreMeta(STORES.ALERTS)
        const { data: alertData } = await supabase
          .from('alerts')
          .select('created_at')
          .eq('is_active', true)
          .or(`community_id.in.(${communityIds.join(',')}),is_public.eq.true`)
          .order('created_at', { ascending: false })
          .limit(1)

        if (alertData?.[0]?.created_at) {
          const serverTime = new Date(alertData[0].created_at).getTime()
          if (!alertsMeta || serverTime > alertsMeta.lastSyncedAt) {
            changedStores.push(STORES.ALERTS)
          }
          if (!latestUpdateTime || serverTime > latestUpdateTime) {
            latestUpdateTime = serverTime
          }
        }

        // Check events - get latest updated_at
        const eventsMeta = await getStoreMeta(STORES.EVENTS)
        const { data: eventData } = await supabase
          .from('community_events')
          .select('updated_at')
          .in('community_id', communityIds)
          .order('updated_at', { ascending: false })
          .limit(1)

        if (eventData?.[0]?.updated_at) {
          const serverTime = new Date(eventData[0].updated_at).getTime()
          if (!eventsMeta || serverTime > eventsMeta.lastSyncedAt) {
            changedStores.push(STORES.EVENTS)
          }
          if (!latestUpdateTime || serverTime > latestUpdateTime) {
            latestUpdateTime = serverTime
          }
        }
      }

      return {
        hasChanges: changedStores.length > 0,
        changedStores,
        latestUpdateTime,
      }
    } catch (error) {
      console.error('Failed to check for changes:', error)
      // On error, assume no changes to avoid unnecessary syncs
      return {
        hasChanges: false,
        changedStores: [],
        latestUpdateTime: null,
      }
    }
  }
}

// Singleton instance
export const syncService = new SyncService()

// Utility function to trigger background sync
export async function triggerBackgroundSync(): Promise<void> {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready
    try {
      await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('offline-sync')
    } catch (e) {
      console.error('Background sync registration failed:', e)
    }
  }
}
