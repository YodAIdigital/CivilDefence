/**
 * IndexedDB Service for Offline Data Storage
 * Handles local storage of critical data for offline access
 */

import type {
  Profile,
  Community,
  CommunityMember,
  CommunityGuide,
  CommunityMapPoint,
  Alert,
  CommunityEvent,
  ProfileExtended,
  EmergencyContact,
} from '@/types/database'

// Database configuration
const DB_NAME = 'CivilDefencePro'
const DB_VERSION = 1

// Store names
export const STORES = {
  PROFILE: 'profile',
  COMMUNITIES: 'communities',
  COMMUNITY_MEMBERS: 'community_members',
  GUIDES: 'guides',
  MAP_POINTS: 'map_points',
  ALERTS: 'alerts',
  EVENTS: 'events',
  CHECKLIST: 'checklist',
  EMERGENCY_CONTACTS: 'emergency_contacts',
  SYNC_QUEUE: 'sync_queue',
  META: 'meta', // For storing last sync timestamps, etc.
} as const

export type StoreName = (typeof STORES)[keyof typeof STORES]

// Sync action types
export interface SyncAction {
  id: string
  type: 'create' | 'update' | 'delete'
  store: StoreName
  entityId: string
  payload: Record<string, unknown>
  timestamp: number
  attempts: number
  lastAttempt?: number
}

// Metadata for tracking sync state
export interface StoreMeta {
  store: StoreName
  lastSyncedAt: number
  version: number
}

// Checklist item for offline storage
export interface OfflineChecklistData {
  id: string
  userId: string
  categories: Record<string, {
    items: Array<{
      id: string
      text: string
      completed: boolean
      completedAt?: number
      notes?: string
    }>
    lastChecked?: number
  }>
  lastModified: number
}

// Extended profile for offline storage (includes extended data)
export interface OfflineProfile extends Profile {
  extended?: ProfileExtended
}

// Open or create the database
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB: ' + request.error?.message))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Profile store - single user profile
      if (!db.objectStoreNames.contains(STORES.PROFILE)) {
        db.createObjectStore(STORES.PROFILE, { keyPath: 'id' })
      }

      // Communities store
      if (!db.objectStoreNames.contains(STORES.COMMUNITIES)) {
        const store = db.createObjectStore(STORES.COMMUNITIES, { keyPath: 'id' })
        store.createIndex('name', 'name', { unique: false })
      }

      // Community members store
      if (!db.objectStoreNames.contains(STORES.COMMUNITY_MEMBERS)) {
        const store = db.createObjectStore(STORES.COMMUNITY_MEMBERS, { keyPath: 'id' })
        store.createIndex('community_id', 'community_id', { unique: false })
        store.createIndex('user_id', 'user_id', { unique: false })
      }

      // Guides store
      if (!db.objectStoreNames.contains(STORES.GUIDES)) {
        const store = db.createObjectStore(STORES.GUIDES, { keyPath: 'id' })
        store.createIndex('community_id', 'community_id', { unique: false })
        store.createIndex('guide_type', 'guide_type', { unique: false })
      }

      // Map points store
      if (!db.objectStoreNames.contains(STORES.MAP_POINTS)) {
        const store = db.createObjectStore(STORES.MAP_POINTS, { keyPath: 'id' })
        store.createIndex('community_id', 'community_id', { unique: false })
        store.createIndex('point_type', 'point_type', { unique: false })
      }

      // Alerts store
      if (!db.objectStoreNames.contains(STORES.ALERTS)) {
        const store = db.createObjectStore(STORES.ALERTS, { keyPath: 'id' })
        store.createIndex('community_id', 'community_id', { unique: false })
        store.createIndex('is_active', 'is_active', { unique: false })
        store.createIndex('created_at', 'created_at', { unique: false })
      }

      // Events store
      if (!db.objectStoreNames.contains(STORES.EVENTS)) {
        const store = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' })
        store.createIndex('community_id', 'community_id', { unique: false })
        store.createIndex('start_time', 'start_time', { unique: false })
      }

      // Checklist store
      if (!db.objectStoreNames.contains(STORES.CHECKLIST)) {
        db.createObjectStore(STORES.CHECKLIST, { keyPath: 'id' })
      }

      // Emergency contacts store
      if (!db.objectStoreNames.contains(STORES.EMERGENCY_CONTACTS)) {
        const store = db.createObjectStore(STORES.EMERGENCY_CONTACTS, { keyPath: 'id' })
        store.createIndex('userId', 'userId', { unique: false })
      }

      // Sync queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' })
        store.createIndex('store', 'store', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }

      // Meta store for tracking sync state
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'store' })
      }
    }
  })
}

// Generic database operations
class OfflineDB {
  private dbPromise: Promise<IDBDatabase> | null = null

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDatabase()
    }
    return this.dbPromise
  }

  // Get a single item by key
  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly')
      const objectStore = transaction.objectStore(store)
      const request = objectStore.get(key)

      request.onsuccess = () => resolve(request.result as T | undefined)
      request.onerror = () => reject(request.error)
    })
  }

  // Get all items from a store
  async getAll<T>(store: StoreName): Promise<T[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly')
      const objectStore = transaction.objectStore(store)
      const request = objectStore.getAll()

      request.onsuccess = () => resolve(request.result as T[])
      request.onerror = () => reject(request.error)
    })
  }

  // Get items by index
  async getByIndex<T>(store: StoreName, indexName: string, value: IDBValidKey): Promise<T[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly')
      const objectStore = transaction.objectStore(store)
      const index = objectStore.index(indexName)
      const request = index.getAll(value)

      request.onsuccess = () => resolve(request.result as T[])
      request.onerror = () => reject(request.error)
    })
  }

  // Put (create or update) an item
  async put<T>(store: StoreName, item: T): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite')
      const objectStore = transaction.objectStore(store)
      const request = objectStore.put(item)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Put multiple items in a single transaction
  async putMany<T>(store: StoreName, items: T[]): Promise<void> {
    if (items.length === 0) return

    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite')
      const objectStore = transaction.objectStore(store)

      let completed = 0
      let hasError = false

      items.forEach((item) => {
        const request = objectStore.put(item)
        request.onsuccess = () => {
          completed++
          if (completed === items.length && !hasError) {
            resolve()
          }
        }
        request.onerror = () => {
          if (!hasError) {
            hasError = true
            reject(request.error)
          }
        }
      })
    })
  }

  // Delete an item
  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite')
      const objectStore = transaction.objectStore(store)
      const request = objectStore.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Clear all items from a store
  async clear(store: StoreName): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite')
      const objectStore = transaction.objectStore(store)
      const request = objectStore.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Count items in a store
  async count(store: StoreName): Promise<number> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly')
      const objectStore = transaction.objectStore(store)
      const request = objectStore.count()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // Close the database connection
  async close(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise
      db.close()
      this.dbPromise = null
    }
  }
}

// Singleton instance
export const offlineDB = new OfflineDB()

// High-level API for specific data types

// Profile operations
export async function saveProfile(profile: OfflineProfile): Promise<void> {
  await offlineDB.put(STORES.PROFILE, profile)
  await updateStoreMeta(STORES.PROFILE)
}

export async function getProfile(userId: string): Promise<OfflineProfile | undefined> {
  return offlineDB.get<OfflineProfile>(STORES.PROFILE, userId)
}

// Communities operations
export async function saveCommunities(communities: Community[]): Promise<void> {
  await offlineDB.putMany(STORES.COMMUNITIES, communities)
  await updateStoreMeta(STORES.COMMUNITIES)
}

export async function getCommunities(): Promise<Community[]> {
  return offlineDB.getAll<Community>(STORES.COMMUNITIES)
}

export async function getCommunity(id: string): Promise<Community | undefined> {
  return offlineDB.get<Community>(STORES.COMMUNITIES, id)
}

// Community members operations
export async function saveCommunityMembers(members: CommunityMember[]): Promise<void> {
  await offlineDB.putMany(STORES.COMMUNITY_MEMBERS, members)
  await updateStoreMeta(STORES.COMMUNITY_MEMBERS)
}

export async function getCommunityMembers(communityId: string): Promise<CommunityMember[]> {
  return offlineDB.getByIndex<CommunityMember>(STORES.COMMUNITY_MEMBERS, 'community_id', communityId)
}

export async function getUserCommunityMemberships(userId: string): Promise<CommunityMember[]> {
  return offlineDB.getByIndex<CommunityMember>(STORES.COMMUNITY_MEMBERS, 'user_id', userId)
}

// Guides operations
export async function saveGuides(guides: CommunityGuide[]): Promise<void> {
  await offlineDB.putMany(STORES.GUIDES, guides)
  await updateStoreMeta(STORES.GUIDES)
}

export async function getGuides(communityId: string): Promise<CommunityGuide[]> {
  return offlineDB.getByIndex<CommunityGuide>(STORES.GUIDES, 'community_id', communityId)
}

export async function getAllGuides(): Promise<CommunityGuide[]> {
  return offlineDB.getAll<CommunityGuide>(STORES.GUIDES)
}

// Map points operations
export async function saveMapPoints(points: CommunityMapPoint[]): Promise<void> {
  await offlineDB.putMany(STORES.MAP_POINTS, points)
  await updateStoreMeta(STORES.MAP_POINTS)
}

export async function getMapPoints(communityId: string): Promise<CommunityMapPoint[]> {
  return offlineDB.getByIndex<CommunityMapPoint>(STORES.MAP_POINTS, 'community_id', communityId)
}

// Alerts operations
export async function saveAlerts(alerts: Alert[]): Promise<void> {
  await offlineDB.putMany(STORES.ALERTS, alerts)
  await updateStoreMeta(STORES.ALERTS)
}

export async function getAlerts(communityId?: string): Promise<Alert[]> {
  if (communityId) {
    return offlineDB.getByIndex<Alert>(STORES.ALERTS, 'community_id', communityId)
  }
  return offlineDB.getAll<Alert>(STORES.ALERTS)
}

export async function getActiveAlerts(): Promise<Alert[]> {
  return offlineDB.getByIndex<Alert>(STORES.ALERTS, 'is_active', 1)
}

// Events operations
export async function saveEvents(events: CommunityEvent[]): Promise<void> {
  await offlineDB.putMany(STORES.EVENTS, events)
  await updateStoreMeta(STORES.EVENTS)
}

export async function getEvents(communityId: string): Promise<CommunityEvent[]> {
  return offlineDB.getByIndex<CommunityEvent>(STORES.EVENTS, 'community_id', communityId)
}

// Checklist operations
export async function saveChecklist(data: OfflineChecklistData): Promise<void> {
  await offlineDB.put(STORES.CHECKLIST, data)
  await updateStoreMeta(STORES.CHECKLIST)
}

export async function getChecklist(userId: string): Promise<OfflineChecklistData | undefined> {
  return offlineDB.get<OfflineChecklistData>(STORES.CHECKLIST, userId)
}

// Emergency contacts operations
export async function saveEmergencyContacts(userId: string, contacts: EmergencyContact[]): Promise<void> {
  // Store contacts with a composite key
  const data = {
    id: `contacts_${userId}`,
    userId,
    contacts,
    lastModified: Date.now(),
  }
  await offlineDB.put(STORES.EMERGENCY_CONTACTS, data)
  await updateStoreMeta(STORES.EMERGENCY_CONTACTS)
}

export async function getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  const data = await offlineDB.get<{ contacts: EmergencyContact[] }>(
    STORES.EMERGENCY_CONTACTS,
    `contacts_${userId}`
  )
  return data?.contacts || []
}

// Sync queue operations
export async function addToSyncQueue(action: Omit<SyncAction, 'id' | 'timestamp' | 'attempts'>): Promise<void> {
  const syncAction: SyncAction = {
    ...action,
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    attempts: 0,
  }
  await offlineDB.put(STORES.SYNC_QUEUE, syncAction)
}

export async function getSyncQueue(): Promise<SyncAction[]> {
  const actions = await offlineDB.getAll<SyncAction>(STORES.SYNC_QUEUE)
  // Sort by timestamp (oldest first)
  return actions.sort((a, b) => a.timestamp - b.timestamp)
}

export async function removeSyncAction(id: string): Promise<void> {
  await offlineDB.delete(STORES.SYNC_QUEUE, id)
}

export async function updateSyncAction(action: SyncAction): Promise<void> {
  await offlineDB.put(STORES.SYNC_QUEUE, action)
}

export async function clearSyncQueue(): Promise<void> {
  await offlineDB.clear(STORES.SYNC_QUEUE)
}

// Meta operations
async function updateStoreMeta(store: StoreName): Promise<void> {
  const meta: StoreMeta = {
    store,
    lastSyncedAt: Date.now(),
    version: DB_VERSION,
  }
  await offlineDB.put(STORES.META, meta)
}

export async function getStoreMeta(store: StoreName): Promise<StoreMeta | undefined> {
  return offlineDB.get<StoreMeta>(STORES.META, store)
}

export async function getAllStoreMeta(): Promise<StoreMeta[]> {
  return offlineDB.getAll<StoreMeta>(STORES.META)
}

// Check if data is stale (older than specified minutes)
export async function isDataStale(store: StoreName, maxAgeMinutes: number = 30): Promise<boolean> {
  const meta = await getStoreMeta(store)
  if (!meta) return true

  const ageMs = Date.now() - meta.lastSyncedAt
  const maxAgeMs = maxAgeMinutes * 60 * 1000
  return ageMs > maxAgeMs
}

// Clear all offline data
export async function clearAllOfflineData(): Promise<void> {
  const stores = Object.values(STORES)
  for (const store of stores) {
    await offlineDB.clear(store)
  }
}

// Export database statistics
export async function getOfflineStats(): Promise<Record<StoreName, number>> {
  const stores = Object.values(STORES) as StoreName[]
  const stats: Partial<Record<StoreName, number>> = {}

  for (const store of stores) {
    stats[store] = await offlineDB.count(store)
  }

  return stats as Record<StoreName, number>
}
