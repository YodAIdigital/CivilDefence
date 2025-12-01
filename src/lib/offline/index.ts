/**
 * Offline Module - Entry Point
 * Exports all offline-related functionality
 */

// IndexedDB service and types
export {
  STORES,
  type StoreName,
  type SyncAction,
  type StoreMeta,
  type OfflineChecklistData,
  type OfflineProfile,
  openDatabase,
  offlineDB,
  // Profile operations
  saveProfile,
  getProfile,
  // Communities operations
  saveCommunities,
  getCommunities,
  getCommunity,
  // Community members operations
  saveCommunityMembers,
  getCommunityMembers,
  getUserCommunityMemberships,
  // Guides operations
  saveGuides,
  getGuides,
  getAllGuides,
  // Map points operations
  saveMapPoints,
  getMapPoints,
  // Alerts operations
  saveAlerts,
  getAlerts,
  getActiveAlerts,
  // Events operations
  saveEvents,
  getEvents,
  // Checklist operations
  saveChecklist,
  getChecklist,
  // Emergency contacts operations
  saveEmergencyContacts,
  getEmergencyContacts,
  // Sync queue operations
  addToSyncQueue,
  getSyncQueue,
  removeSyncAction,
  updateSyncAction,
  clearSyncQueue,
  // Meta operations
  getStoreMeta,
  getAllStoreMeta,
  isDataStale,
  // Utility functions
  clearAllOfflineData,
  getOfflineStats,
} from './indexedDB'

// Sync service
export {
  syncService,
  triggerBackgroundSync,
  type SyncStatus,
  type SyncResult,
  type SyncProgress,
} from './syncService'
