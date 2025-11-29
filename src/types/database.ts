/**
 * Civil Defence Expo - Database Types
 * Generated from Supabase schema
 * Note: In production, use `supabase gen types typescript` to auto-generate
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'public' | 'member' | 'admin' | 'super_admin'
export type AlertLevel = 'info' | 'warning' | 'danger' | 'critical'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: UserRole
          phone: string | null
          location: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          notification_preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: UserRole
          phone?: string | null
          location?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          notification_preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: UserRole
          phone?: string | null
          location?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          notification_preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          id: string
          name: string
          description: string | null
          image_url: string | null
          created_by: string
          is_public: boolean
          location: string | null
          latitude: number | null
          longitude: number | null
          member_count: number
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          image_url?: string | null
          created_by: string
          is_public?: boolean
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          member_count?: number
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          image_url?: string | null
          created_by?: string
          is_public?: boolean
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          member_count?: number
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'communities_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      community_members: {
        Row: {
          id: string
          community_id: string
          user_id: string
          role: UserRole
          joined_at: string
        }
        Insert: {
          id?: string
          community_id: string
          user_id: string
          role?: UserRole
          joined_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          user_id?: string
          role?: UserRole
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'community_members_community_id_fkey'
            columns: ['community_id']
            referencedRelation: 'communities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'community_members_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      alerts: {
        Row: {
          id: string
          title: string
          content: string
          level: AlertLevel
          community_id: string | null
          is_public: boolean
          author_id: string
          expires_at: string | null
          is_active: boolean
          read_count: number
          location: string | null
          latitude: number | null
          longitude: number | null
          radius_km: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          level?: AlertLevel
          community_id?: string | null
          is_public?: boolean
          author_id: string
          expires_at?: string | null
          is_active?: boolean
          read_count?: number
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          radius_km?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          level?: AlertLevel
          community_id?: string | null
          is_public?: boolean
          author_id?: string
          expires_at?: string | null
          is_active?: boolean
          read_count?: number
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          radius_km?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'alerts_author_id_fkey'
            columns: ['author_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alerts_community_id_fkey'
            columns: ['community_id']
            referencedRelation: 'communities'
            referencedColumns: ['id']
          }
        ]
      }
      alert_acknowledgments: {
        Row: {
          id: string
          alert_id: string
          user_id: string
          acknowledged_at: string
        }
        Insert: {
          id?: string
          alert_id: string
          user_id: string
          acknowledged_at?: string
        }
        Update: {
          id?: string
          alert_id?: string
          user_id?: string
          acknowledged_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'alert_acknowledgments_alert_id_fkey'
            columns: ['alert_id']
            referencedRelation: 'alerts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alert_acknowledgments_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      resources: {
        Row: {
          id: string
          title: string
          description: string | null
          file_url: string
          file_type: string
          file_size: number
          community_id: string | null
          is_public: boolean
          author_id: string
          download_count: number
          tags: string[]
          category: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          file_url: string
          file_type: string
          file_size: number
          community_id?: string | null
          is_public?: boolean
          author_id: string
          download_count?: number
          tags?: string[]
          category?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          file_url?: string
          file_type?: string
          file_size?: number
          community_id?: string | null
          is_public?: boolean
          author_id?: string
          download_count?: number
          tags?: string[]
          category?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resources_author_id_fkey'
            columns: ['author_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resources_community_id_fkey'
            columns: ['community_id']
            referencedRelation: 'communities'
            referencedColumns: ['id']
          }
        ]
      }
      checklist_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          items: Json
          community_id: string | null
          is_public: boolean
          author_id: string
          category: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          items?: Json
          community_id?: string | null
          is_public?: boolean
          author_id: string
          category?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          items?: Json
          community_id?: string | null
          is_public?: boolean
          author_id?: string
          category?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'checklist_templates_author_id_fkey'
            columns: ['author_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'checklist_templates_community_id_fkey'
            columns: ['community_id']
            referencedRelation: 'communities'
            referencedColumns: ['id']
          }
        ]
      }
      user_checklists: {
        Row: {
          id: string
          user_id: string
          template_id: string | null
          name: string
          items: Json
          progress: number
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_id?: string | null
          name: string
          items?: Json
          progress?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string | null
          name?: string
          items?: Json
          progress?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_checklists_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_checklists_template_id_fkey'
            columns: ['template_id']
            referencedRelation: 'checklist_templates'
            referencedColumns: ['id']
          }
        ]
      }
      activity_log: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activity_log_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      is_community_admin: {
        Args: { user_uuid: string; community_uuid: string }
        Returns: boolean
      }
      is_community_member: {
        Args: { user_uuid: string; community_uuid: string }
        Returns: boolean
      }
      increment_download_count: {
        Args: { resource_uuid: string }
        Returns: void
      }
    }
    Enums: {
      user_role: UserRole
      alert_level: AlertLevel
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier access
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Commonly used types
export type Profile = Tables<'profiles'>
export type Community = Tables<'communities'>
export type CommunityMember = Tables<'community_members'>
export type Alert = Tables<'alerts'>
export type AlertAcknowledgment = Tables<'alert_acknowledgments'>
export type Resource = Tables<'resources'>
export type ChecklistTemplate = Tables<'checklist_templates'>
export type UserChecklist = Tables<'user_checklists'>
export type ActivityLog = Tables<'activity_log'>

// Insert types
export type ProfileInsert = Inserts<'profiles'>
export type CommunityInsert = Inserts<'communities'>
export type AlertInsert = Inserts<'alerts'>
export type ResourceInsert = Inserts<'resources'>

// Update types
export type ProfileUpdate = Updates<'profiles'>
export type CommunityUpdate = Updates<'communities'>
export type AlertUpdate = Updates<'alerts'>
export type ResourceUpdate = Updates<'resources'>

// Notification preferences type
export interface NotificationPreferences {
  email: boolean
  push: boolean
  sms: boolean
}

// Checklist item type
export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  notes?: string
}

// Community settings type
export interface CommunitySettings {
  allowPublicJoin?: boolean
  requireApproval?: boolean
  defaultMemberRole?: UserRole
}
