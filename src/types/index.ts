/**
 * Civil Defence Expo - Core Type Definitions
 */

// User roles as defined in project requirements
export enum Role {
  PUBLIC = 'public',
  MEMBER = 'member',
  ADMIN = 'admin'
}

// User interface
export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  role: Role
  created_at: string
  updated_at: string
}

// Community interface
export interface Community {
  id: string
  name: string
  description?: string
  image_url?: string
  created_by: string
  is_public: boolean
  member_count: number
  created_at: string
  updated_at: string
}

// Community member relationship
export interface CommunityMember {
  id: string
  community_id: string
  user_id: string
  role: Role
  joined_at: string
}

// Emergency alert levels
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  DANGER = 'danger',
  CRITICAL = 'critical'
}

// Alert/Announcement interface
export interface Alert {
  id: string
  title: string
  content: string
  level: AlertLevel
  community_id?: string
  is_public: boolean
  author_id: string
  expires_at?: string
  created_at: string
  updated_at: string
}

// Resource/Document interface
export interface Resource {
  id: string
  title: string
  description?: string
  file_url: string
  file_type: string
  file_size: number
  community_id?: string
  is_public: boolean
  author_id: string
  download_count: number
  created_at: string
  updated_at: string
}

// Sync action for offline queue
export interface SyncAction {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: string
  payload: Record<string, unknown>
  timestamp: number
  attempts: number
}

// API response wrapper
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

// Pagination interface
export interface PaginationParams {
  page: number
  limit: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  total_pages: number
}

// Navigation item for menus
export interface NavItem {
  title: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  disabled?: boolean
  external?: boolean
  requiresAuth?: boolean
  allowedRoles?: Role[]
}

// Form state for handling submissions
export interface FormState {
  isSubmitting: boolean
  isSuccess: boolean
  isError: boolean
  message: string | null
}