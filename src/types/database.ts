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

// Global platform role (stored in profiles.role)
// - 'member' = regular platform user (default)
// - 'super_admin' = platform administrator with access to all communities
export type UserRole = 'public' | 'member' | 'team_member' | 'admin' | 'super_admin'

// Community-specific role (stored in community_members.role)
// Each user can have different roles in different communities
export type CommunityRole = 'member' | 'team_member' | 'admin'
export type AlertLevel = 'info' | 'warning' | 'danger' | 'critical'
export type EventType = 'general' | 'training' | 'drill' | 'meeting' | 'social'
export type EventVisibility = 'admin_only' | 'team_only' | 'all_members' | 'invite_only'
export type RsvpStatus = 'going' | 'maybe' | 'not_going'
export type InviteStatus = 'pending' | 'accepted' | 'declined'

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
          meeting_point_name: string | null
          meeting_point_address: string | null
          meeting_point_lat: number | null
          meeting_point_lng: number | null
          member_count: number
          settings: Json
          region_polygon: Json | null
          region_color: string | null
          region_opacity: number | null
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
          meeting_point_name?: string | null
          meeting_point_address?: string | null
          meeting_point_lat?: number | null
          meeting_point_lng?: number | null
          member_count?: number
          settings?: Json
          region_polygon?: Json | null
          region_color?: string | null
          region_opacity?: number | null
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
          meeting_point_name?: string | null
          meeting_point_address?: string | null
          meeting_point_lat?: number | null
          meeting_point_lng?: number | null
          member_count?: number
          settings?: Json
          region_polygon?: Json | null
          region_color?: string | null
          region_opacity?: number | null
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
          sent_via_email: boolean
          sent_via_sms: boolean
          sent_via_app: boolean
          recipient_count: number
          email_sent_count: number
          sms_sent_count: number
          push_sent_count: number
          recipient_group: string | null
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
          sent_via_email?: boolean
          sent_via_sms?: boolean
          sent_via_app?: boolean
          recipient_count?: number
          email_sent_count?: number
          sms_sent_count?: number
          push_sent_count?: number
          recipient_group?: string | null
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
          sent_via_email?: boolean
          sent_via_sms?: boolean
          sent_via_app?: boolean
          recipient_count?: number
          email_sent_count?: number
          sms_sent_count?: number
          push_sent_count?: number
          recipient_group?: string | null
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
      community_events: {
        Row: {
          id: string
          community_id: string
          title: string
          description: string | null
          start_time: string
          duration_minutes: number
          all_day: boolean
          recurrence_rule: string | null
          recurrence_end_date: string | null
          location_name: string | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          use_meeting_point: boolean
          is_online: boolean
          meeting_link: string | null
          event_type: EventType
          visibility: EventVisibility
          created_by: string
          is_cancelled: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          title: string
          description?: string | null
          start_time: string
          duration_minutes?: number
          all_day?: boolean
          recurrence_rule?: string | null
          recurrence_end_date?: string | null
          location_name?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          use_meeting_point?: boolean
          is_online?: boolean
          meeting_link?: string | null
          event_type?: EventType
          visibility?: EventVisibility
          created_by: string
          is_cancelled?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          title?: string
          description?: string | null
          start_time?: string
          duration_minutes?: number
          all_day?: boolean
          recurrence_rule?: string | null
          recurrence_end_date?: string | null
          location_name?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          use_meeting_point?: boolean
          is_online?: boolean
          meeting_link?: string | null
          event_type?: EventType
          visibility?: EventVisibility
          created_by?: string
          is_cancelled?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'community_events_community_id_fkey'
            columns: ['community_id']
            referencedRelation: 'communities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'community_events_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      event_invites: {
        Row: {
          id: string
          event_id: string
          user_id: string | null
          external_name: string | null
          external_email: string | null
          external_phone: string | null
          status: InviteStatus
          invited_by: string
          invited_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          event_id: string
          user_id?: string | null
          external_name?: string | null
          external_email?: string | null
          external_phone?: string | null
          status?: InviteStatus
          invited_by: string
          invited_at?: string
          responded_at?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string | null
          external_name?: string | null
          external_email?: string | null
          external_phone?: string | null
          status?: InviteStatus
          invited_by?: string
          invited_at?: string
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'event_invites_event_id_fkey'
            columns: ['event_id']
            referencedRelation: 'community_events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_invites_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_invites_invited_by_fkey'
            columns: ['invited_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      event_rsvps: {
        Row: {
          id: string
          event_id: string
          user_id: string
          status: RsvpStatus
          responded_at: string
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          status?: RsvpStatus
          responded_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          status?: RsvpStatus
          responded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_rsvps_event_id_fkey'
            columns: ['event_id']
            referencedRelation: 'community_events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_rsvps_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      alert_recipients: {
        Row: {
          id: string
          alert_id: string
          user_id: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          alert_id: string
          user_id: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          alert_id?: string
          user_id?: string
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'alert_recipients_alert_id_fkey'
            columns: ['alert_id']
            referencedRelation: 'alerts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alert_recipients_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      community_map_points: {
        Row: {
          id: string
          community_id: string
          name: string
          description: string | null
          point_type: string
          icon: string
          color: string
          address: string | null
          lat: number
          lng: number
          contact_name: string | null
          contact_phone: string | null
          contact_email: string | null
          is_active: boolean
          display_order: number
          visibility: string
          created_by: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          name: string
          description?: string | null
          point_type?: string
          icon?: string
          color?: string
          address?: string | null
          lat: number
          lng: number
          contact_name?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          is_active?: boolean
          display_order?: number
          visibility?: string
          created_by: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          name?: string
          description?: string | null
          point_type?: string
          icon?: string
          color?: string
          address?: string | null
          lat?: number
          lng?: number
          contact_name?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          is_active?: boolean
          display_order?: number
          visibility?: string
          created_by?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'community_map_points_community_id_fkey'
            columns: ['community_id']
            referencedRelation: 'communities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'community_map_points_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      community_groups: {
        Row: {
          id: string
          community_id: string
          name: string
          description: string | null
          color: string
          icon: string
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          name: string
          description?: string | null
          color?: string
          icon?: string
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          name?: string
          description?: string | null
          color?: string
          icon?: string
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'community_groups_community_id_fkey'
            columns: ['community_id']
            referencedRelation: 'communities'
            referencedColumns: ['id']
          }
        ]
      }
      community_guides: {
        Row: {
          id: string
          community_id: string
          name: string
          description: string | null
          icon: string
          color: string
          guide_type: string
          template_id: string
          sections: Json
          supplies: Json
          emergency_contacts: Json
          custom_notes: string | null
          local_resources: Json | null
          risk_level: 'low' | 'medium' | 'high' | null
          is_active: boolean
          display_order: number
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          name: string
          description?: string | null
          icon?: string
          color?: string
          guide_type: string
          template_id: string
          sections?: Json
          supplies?: Json
          emergency_contacts?: Json
          custom_notes?: string | null
          local_resources?: Json | null
          risk_level?: 'low' | 'medium' | 'high' | null
          is_active?: boolean
          display_order?: number
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          name?: string
          description?: string | null
          icon?: string
          color?: string
          guide_type?: string
          template_id?: string
          sections?: Json
          supplies?: Json
          emergency_contacts?: Json
          custom_notes?: string | null
          local_resources?: Json | null
          risk_level?: 'low' | 'medium' | 'high' | null
          is_active?: boolean
          display_order?: number
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'community_guides_community_id_fkey'
            columns: ['community_id']
            referencedRelation: 'communities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'community_guides_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      community_invitations: {
        Row: {
          id: string
          community_id: string
          email: string
          role: CommunityRole
          invited_by: string
          token: string
          status: 'pending' | 'accepted' | 'expired' | 'cancelled'
          expires_at: string
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          community_id: string
          email: string
          role?: CommunityRole
          invited_by: string
          token: string
          status?: 'pending' | 'accepted' | 'expired' | 'cancelled'
          expires_at: string
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          community_id?: string
          email?: string
          role?: CommunityRole
          invited_by?: string
          token?: string
          status?: 'pending' | 'accepted' | 'expired' | 'cancelled'
          expires_at?: string
          created_at?: string
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'community_invitations_community_id_fkey'
            columns: ['community_id']
            referencedRelation: 'communities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'community_invitations_invited_by_fkey'
            columns: ['invited_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      ai_prompt_configs: {
        Row: {
          id: string
          function_type: string
          name: string
          description: string | null
          prompt_template: string
          model_id: string
          is_active: boolean
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          function_type: string
          name: string
          description?: string | null
          prompt_template: string
          model_id: string
          is_active?: boolean
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          function_type?: string
          name?: string
          description?: string | null
          prompt_template?: string
          model_id?: string
          is_active?: boolean
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_prompt_configs_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_prompt_configs_updated_by_fkey'
            columns: ['updated_by']
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
export type CommunityEvent = Tables<'community_events'>
export type EventRsvp = Tables<'event_rsvps'>

// Insert types
export type ProfileInsert = Inserts<'profiles'>
export type CommunityInsert = Inserts<'communities'>
export type AlertInsert = Inserts<'alerts'>
export type ResourceInsert = Inserts<'resources'>
export type CommunityEventInsert = Inserts<'community_events'>
export type EventRsvpInsert = Inserts<'event_rsvps'>
export type EventInvite = Tables<'event_invites'>
export type EventInviteInsert = Inserts<'event_invites'>

// Update types
export type ProfileUpdate = Updates<'profiles'>
export type CommunityUpdate = Updates<'communities'>
export type AlertUpdate = Updates<'alerts'>
export type ResourceUpdate = Updates<'resources'>
export type CommunityEventUpdate = Updates<'community_events'>
export type EventRsvpUpdate = Updates<'event_rsvps'>

// Notification preferences type
export interface NotificationPreferences {
  email: boolean
  push: boolean
  sms: boolean
}

// Visibility type for profile fields
export type FieldVisibility = 'private' | 'community' | 'civil_defence_only'

// Emergency contact with relationship
export interface EmergencyContact {
  id: string
  name: string
  phone: string
  relationship: string // e.g., 'spouse', 'parent', 'sibling', 'child', 'friend', 'neighbor', 'other'
}

// Household member
export interface HouseholdMember {
  id: string
  name: string
  age: string // stored as string to allow ranges like "5" or empty
  contact_number?: string // optional - may not apply to children
  email?: string // optional - may not apply to children
}

// Insurance details with optional contact number
export interface InsuranceDetails {
  provider?: string
  policy_number?: string
  contact_phone?: string
}

// Utility company types
export type UtilityType = 'electricity' | 'gas' | 'water' | 'internet'

// Utility company details
export interface UtilityCompany {
  type: UtilityType
  provider: string
  account_number?: string
  phone?: string
  email?: string
  website?: string
}

// Utility type configuration for display
export const UTILITY_TYPE_CONFIG = {
  electricity: {
    label: 'Electricity',
    icon: 'bolt',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  gas: {
    label: 'Gas',
    icon: 'local_fire_department',
    color: 'text-orange-500',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  water: {
    label: 'Water',
    icon: 'water_drop',
    color: 'text-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  internet: {
    label: 'Internet / Phone',
    icon: 'wifi',
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
} as const

// Relationship options for emergency contacts
export const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Spouse/Partner' },
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'grandchild', label: 'Grandchild' },
  { value: 'aunt_uncle', label: 'Aunt/Uncle' },
  { value: 'cousin', label: 'Cousin' },
  { value: 'friend', label: 'Friend' },
  { value: 'neighbor', label: 'Neighbor' },
  { value: 'coworker', label: 'Coworker' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'other', label: 'Other' },
] as const

// Extended profile data stored in JSON fields
export interface ProfileExtended {
  // Personal Information
  date_of_birth?: string
  address?: string
  address_lat?: number
  address_lng?: number
  mobile_number?: string
  secondary_number?: string

  // Household Members
  household_members?: HouseholdMember[]

  // Emergency Contacts (multiple)
  emergency_contacts?: EmergencyContact[]

  // Legacy fields (kept for backwards compatibility)
  emergency_contact_name?: string
  emergency_contact_number?: string

  // Insurance Details (with contact numbers)
  home_insurance?: InsuranceDetails
  car_insurance?: InsuranceDetails
  medical_insurance?: InsuranceDetails

  // Utility Companies
  utility_companies?: UtilityCompany[]

  // Legacy fields (kept for backwards compatibility)
  home_insurance_provider?: string
  home_insurance_policy?: string
  car_insurance_provider?: string
  car_insurance_policy?: string
  medical_insurance_provider?: string
  medical_insurance_policy?: string

  // Skills & Qualifications
  skills?: string[] // Array of: 'medical_doctor', 'nurse', 'paramedic', 'first_aider', 'firefighter', 'search_rescue'

  // Disabilities & Needs
  disabilities?: string[] // Array of: 'unable_walk', 'difficulty_walking', 'medical_equipment', 'essential_medication', 'blind', 'deaf'

  // Equipment
  equipment?: string[] // Array of: '4wd', 'tractor', 'digger', 'water_filtration', 'chainsaw_certified'

  // Emergency Preparedness
  has_backup_power?: boolean
  has_backup_water?: boolean
  has_food_supply?: boolean // 5 days minimum

  // General
  general_comments?: string

  // Visibility settings for each field group
  visibility?: {
    personal_info?: FieldVisibility
    household?: FieldVisibility
    emergency_contact?: FieldVisibility
    insurance?: FieldVisibility
    utilities?: FieldVisibility
    skills?: FieldVisibility
    disabilities?: FieldVisibility
    equipment?: FieldVisibility
    preparedness?: FieldVisibility
    comments?: FieldVisibility
  }
}

// Skill options
export const SKILL_OPTIONS = [
  { value: 'medical_doctor', label: 'Medical Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'paramedic', label: 'Paramedic' },
  { value: 'first_aider', label: 'Trained First Aider' },
  { value: 'firefighter', label: 'Fire Fighter' },
  { value: 'search_rescue', label: 'Trained Search and Rescue' },
] as const

// Disability options
export const DISABILITY_OPTIONS = [
  { value: 'unable_walk', label: 'Unable to walk' },
  { value: 'difficulty_walking', label: 'Difficulty walking' },
  { value: 'medical_equipment', label: 'Dependant on medical equipment' },
  { value: 'essential_medication', label: 'Rely on essential medication' },
  { value: 'blind', label: 'Blind or visually impaired' },
  { value: 'deaf', label: 'Deaf or hard of hearing' },
] as const

// Equipment options
export const EQUIPMENT_OPTIONS = [
  { value: '4wd', label: '4 Wheel Drive' },
  { value: 'tractor', label: 'Tractor' },
  { value: 'digger', label: 'Digger' },
  { value: 'water_filtration', label: 'Water Filtration' },
  { value: 'chainsaw_certified', label: 'Chainsaw with certification' },
] as const

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

// Community guide - customized guide for a specific community
export interface CommunityGuide {
  id: string
  communityId: string
  templateId: string
  templateType: string // disaster type
  isEnabled: boolean
  riskLevel?: 'low' | 'medium' | 'high' | null // Risk severity from AI analysis
  customizations?: {
    additionalSections?: Array<{
      id: string
      title: string
      content: string
      phase: 'before' | 'during' | 'after'
    }>
    additionalSupplies?: string[]
    localContacts?: Array<{
      name: string
      number: string
      description: string
    }>
    notes?: string
  }
  lastUpdated: string
  updatedBy: string
}

// Helper to check if user is super admin
export function isSuperAdmin(role: UserRole | null | undefined): boolean {
  return role === 'super_admin'
}

// Helper to check if user can manage templates (super_admin only)
export function canManageTemplates(role: UserRole | null | undefined): boolean {
  return role === 'super_admin'
}

// Helper to check if user is community admin
export function isCommunityAdmin(memberRole: UserRole | CommunityRole | null | undefined): boolean {
  return memberRole === 'admin' || memberRole === 'super_admin'
}

// Helper to check if user can manage community content (admin or team_member)
export function canManageCommunity(memberRole: UserRole | CommunityRole | null | undefined): boolean {
  return memberRole === 'admin' || memberRole === 'team_member' || memberRole === 'super_admin'
}

// Community contact/role - defines key roles within a community
export interface CommunityContact {
  id: string
  role_name: string // e.g., "Community Leader", "First Aid Officer", "Communication Lead"
  member_id: string | null // Link to community_members.id (or null if external)
  member_name?: string // Denormalized for display
  member_email?: string // Denormalized for display
  phone?: string // Contact phone number
  description?: string // Description of the role/responsibilities
  is_external: boolean // True if contact is outside the community
  external_name?: string // Name if external
  external_phone?: string // Phone if external
  external_email?: string // Email if external
  display_order: number // Order for display
  created_at: string
  updated_at: string
}

// For storing in communities.settings JSON
export interface CommunityContactsSettings {
  contacts: CommunityContact[]
}

// Default roles that can be suggested
export const SUGGESTED_ROLES = [
  { name: 'Community Leader', description: 'Primary coordinator for the community' },
  { name: 'Deputy Leader', description: 'Backup coordinator and support' },
  { name: 'First Aid Officer', description: 'First aid trained member for medical emergencies' },
  { name: 'Communication Lead', description: 'Handles communication and alerts' },
  { name: 'Supply Coordinator', description: 'Manages emergency supplies and equipment' },
  { name: 'Welfare Officer', description: 'Supports vulnerable members and welfare needs' },
  { name: 'Technical Support', description: 'Handles technology, radio, and equipment' },
] as const

// Event visibility configuration for display
export const EVENT_VISIBILITY_CONFIG = {
  admin_only: {
    label: 'Admin Only',
    description: 'Only community admins can see this event',
    icon: 'admin_panel_settings',
  },
  team_only: {
    label: 'Admin & Team Only',
    description: 'Admins and designated team members can see this event',
    icon: 'group',
  },
  all_members: {
    label: 'All Community Members',
    description: 'All members of the community can see this event',
    icon: 'groups',
  },
  invite_only: {
    label: 'Invite Only',
    description: 'Only invited members can see this event',
    icon: 'mail',
  },
} as const

// Event type configuration for display
export const EVENT_TYPE_CONFIG = {
  general: {
    label: 'General',
    icon: 'event',
    color: 'bg-gradient-to-br from-slate-600 to-slate-700',
    bgColor: 'bg-slate-100 dark:bg-slate-900',
    textColor: 'text-slate-600 dark:text-slate-400',
  },
  training: {
    label: 'Training',
    icon: 'school',
    color: 'bg-gradient-to-br from-[#000542] to-[#313A64]',
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  drill: {
    label: 'Emergency Drill',
    icon: 'warning',
    color: 'bg-gradient-to-br from-orange-500 to-red-500',
    bgColor: 'bg-orange-100 dark:bg-orange-900',
    textColor: 'text-orange-600 dark:text-orange-400',
  },
  meeting: {
    label: 'Meeting',
    icon: 'groups',
    color: 'bg-gradient-to-br from-[#FEB100] to-amber-500',
    bgColor: 'bg-amber-100 dark:bg-amber-900',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  social: {
    label: 'Social Event',
    icon: 'celebration',
    color: 'bg-gradient-to-br from-green-500 to-emerald-600',
    bgColor: 'bg-green-100 dark:bg-green-900',
    textColor: 'text-green-600 dark:text-green-400',
  },
} as const

// Event with community info for display
export interface CommunityEventWithDetails extends CommunityEvent {
  community?: Community
  rsvp_count?: number
  user_rsvp?: RsvpStatus | null
}

// ==========================================
// Community Guides Types
// ==========================================

// Guide section (before, during, after steps)
export interface GuideSection {
  id: string
  title: string
  content: string
  icon?: string
}

// Guide emergency contact
export interface GuideEmergencyContact {
  name: string
  number: string
  description: string
}

// Local resource (shelter, meeting point, etc.)
export interface GuideLocalResource {
  id: string
  name: string
  type: 'shelter' | 'meeting_point' | 'supply_depot' | 'medical' | 'other'
  address?: string
  lat?: number
  lng?: number
  phone?: string
  notes?: string
}

// Community guide (stored in database)
export interface CommunityGuide {
  id: string
  community_id: string

  // Metadata
  name: string
  description: string | null
  icon: string
  color: string

  // Type
  guide_type: string // 'fire', 'flood', 'custom', etc.
  template_id: string | null

  // Content
  sections: {
    before: GuideSection[]
    during: GuideSection[]
    after: GuideSection[]
  }
  supplies: string[]
  emergency_contacts: GuideEmergencyContact[]

  // Customizations
  custom_notes: string | null
  local_resources: GuideLocalResource[]

  // Risk assessment
  risk_level: 'low' | 'medium' | 'high' | null

  // Status
  is_active: boolean
  display_order: number

  // Audit
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

// For creating a new guide
export interface CreateCommunityGuide {
  community_id: string
  name: string
  description?: string
  icon?: string
  color?: string
  guide_type: string
  template_id?: string
  sections?: {
    before: GuideSection[]
    during: GuideSection[]
    after: GuideSection[]
  }
  supplies?: string[]
  emergency_contacts?: GuideEmergencyContact[]
  custom_notes?: string
  local_resources?: GuideLocalResource[]
  is_active?: boolean
  display_order?: number
  created_by: string
}

// For updating a guide
export interface UpdateCommunityGuide {
  name?: string
  description?: string
  icon?: string
  color?: string
  sections?: {
    before: GuideSection[]
    during: GuideSection[]
    after: GuideSection[]
  }
  supplies?: string[]
  emergency_contacts?: GuideEmergencyContact[]
  custom_notes?: string
  local_resources?: GuideLocalResource[]
  is_active?: boolean
  display_order?: number
  updated_by: string
}

// Guide type configuration for display
export const GUIDE_TYPE_CONFIG = {
  fire: {
    label: 'Fire Emergency',
    icon: 'local_fire_department',
    color: 'from-orange-500 to-red-600',
  },
  flood: {
    label: 'Flood Emergency',
    icon: 'water',
    color: 'from-blue-500 to-cyan-600',
  },
  strong_winds: {
    label: 'Strong Winds',
    icon: 'air',
    color: 'from-slate-500 to-gray-700',
  },
  earthquake: {
    label: 'Earthquake',
    icon: 'vibration',
    color: 'from-amber-600 to-yellow-700',
  },
  tsunami: {
    label: 'Tsunami',
    icon: 'waves',
    color: 'from-teal-500 to-blue-700',
  },
  snow: {
    label: 'Snow & Ice',
    icon: 'ac_unit',
    color: 'from-sky-400 to-indigo-500',
  },
  pandemic: {
    label: 'Pandemic',
    icon: 'coronavirus',
    color: 'from-green-500 to-emerald-700',
  },
  solar_storm: {
    label: 'Solar Storm',
    icon: 'wb_sunny',
    color: 'from-yellow-400 to-orange-600',
  },
  custom: {
    label: 'Custom Guide',
    icon: 'menu_book',
    color: 'from-purple-500 to-indigo-600',
  },
} as const

export type GuideType = keyof typeof GUIDE_TYPE_CONFIG

// ==========================================
// Community Map Points Types
// ==========================================

export type MapPointType =
  | 'meeting_point'
  | 'hospital'
  | 'emergency_service'
  | 'power'
  | 'telecom'
  | 'food_distribution'
  | 'shelter'
  | 'water'
  | 'fuel'
  | 'other'

export type MapPointVisibility = 'admin_only' | 'members' | 'public'

export const MAP_POINT_VISIBILITY_CONFIG = {
  admin_only: {
    label: 'Admins Only',
    icon: 'admin_panel_settings',
    description: 'Only community admins can see this location',
  },
  members: {
    label: 'All Members',
    icon: 'groups',
    description: 'All community members can see this location',
  },
  public: {
    label: 'Public',
    icon: 'public',
    description: 'Anyone can see this location (if community is public)',
  },
} as const

// Community map point (stored in database)
export interface CommunityMapPoint {
  id: string
  community_id: string

  // Point details
  name: string
  description: string | null
  point_type: MapPointType
  icon: string
  color: string

  // Location
  address: string | null
  lat: number
  lng: number

  // Contact information
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null

  // Display settings
  is_active: boolean
  display_order: number
  visibility: MapPointVisibility

  // Audit
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

// For creating a new map point
export interface CreateCommunityMapPoint {
  community_id: string
  name: string
  description?: string
  point_type: MapPointType
  icon?: string
  color?: string
  address?: string
  lat: number
  lng: number
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  is_active?: boolean
  display_order?: number
  visibility?: MapPointVisibility
  created_by: string
}

// For updating a map point
export interface UpdateCommunityMapPoint {
  name?: string
  description?: string
  point_type?: MapPointType
  icon?: string
  color?: string
  address?: string
  lat?: number
  lng?: number
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  is_active?: boolean
  display_order?: number
  visibility?: MapPointVisibility
  updated_by: string
}

// Map point type configuration for display
export const MAP_POINT_TYPE_CONFIG = {
  meeting_point: {
    label: 'Meeting Point',
    icon: 'flag',
    color: '#22c55e',
    description: 'Emergency meeting point for community members',
  },
  hospital: {
    label: 'Hospital / Medical',
    icon: 'local_hospital',
    color: '#ef4444',
    description: 'Hospitals, clinics, and medical facilities',
  },
  emergency_service: {
    label: 'Emergency Services',
    icon: 'emergency',
    color: '#ef4444',
    description: 'Police, fire stations, ambulance services',
  },
  power: {
    label: 'Power / Electricity',
    icon: 'bolt',
    color: '#eab308',
    description: 'Power stations, substations, generators',
  },
  telecom: {
    label: 'Communications',
    icon: 'cell_tower',
    color: '#f97316',
    description: 'Cell towers, communication centers',
  },
  food_distribution: {
    label: 'Food Distribution',
    icon: 'restaurant',
    color: '#14b8a6',
    description: 'Food banks, distribution centers, supermarkets',
  },
  shelter: {
    label: 'Shelter / Evacuation',
    icon: 'night_shelter',
    color: '#3b82f6',
    description: 'Emergency shelters, evacuation centers',
  },
  water: {
    label: 'Water Supply',
    icon: 'water_drop',
    color: '#06b6d4',
    description: 'Water treatment, tanks, distribution points',
  },
  fuel: {
    label: 'Fuel Station',
    icon: 'local_gas_station',
    color: '#8b5cf6',
    description: 'Petrol stations, fuel depots',
  },
  other: {
    label: 'Other',
    icon: 'location_on',
    color: '#6b7280',
    description: 'Other important locations',
  },
} as const

// ==========================================
// Community Alert Rules Types
// ==========================================

export type AlertTriggerType = 'webhook' | 'email'
export type RuleRecipientGroup = 'admin' | 'team' | 'members' | 'groups' | 'specific'

// Community alert rule (stored in database)
export interface CommunityAlertRule {
  id: string
  community_id: string

  // Rule identification
  name: string
  description: string | null
  is_active: boolean

  // Trigger configuration
  trigger_type: AlertTriggerType
  webhook_token: string // UUID for webhook authentication
  trigger_email: string | null // Email address for email triggers

  // Alert configuration
  alert_title: string
  alert_message: string
  alert_level: 'info' | 'warning' | 'danger'

  // Recipient configuration
  recipient_group: RuleRecipientGroup
  specific_member_ids: string[] // For 'specific' recipient group

  // Delivery options
  send_email: boolean
  send_sms: boolean
  send_app_notification: boolean

  // Tracking
  trigger_count: number
  last_triggered_at: string | null

  // Audit
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

// For creating a new alert rule
export interface CreateCommunityAlertRule {
  community_id: string
  name: string
  description?: string
  is_active?: boolean
  trigger_type: AlertTriggerType
  alert_title: string
  alert_message: string
  alert_level?: 'info' | 'warning' | 'danger'
  recipient_group?: RuleRecipientGroup
  specific_member_ids?: string[]
  send_email?: boolean
  send_sms?: boolean
  send_app_notification?: boolean
  created_by: string
}

// For updating an alert rule
export interface UpdateCommunityAlertRule {
  name?: string
  description?: string
  is_active?: boolean
  alert_title?: string
  alert_message?: string
  alert_level?: 'info' | 'warning' | 'danger'
  recipient_group?: RuleRecipientGroup
  specific_member_ids?: string[]
  send_email?: boolean
  send_sms?: boolean
  send_app_notification?: boolean
  updated_by: string
}

// Alert rule trigger history
export interface AlertRuleTrigger {
  id: string
  rule_id: string
  alert_id: string | null

  // Trigger details
  trigger_source: 'webhook' | 'email'
  trigger_payload: Record<string, unknown> | null

  // Status
  success: boolean
  error_message: string | null

  // Delivery stats
  recipient_count: number
  emails_sent: number
  sms_sent: number
  push_sent: number

  // Audit
  triggered_at: string
}

// Alert level configuration for rules display
export const ALERT_RULE_LEVEL_CONFIG = {
  info: {
    label: 'Announcement',
    description: 'General information or announcement',
    color: '#22c55e',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  warning: {
    label: 'Warning',
    description: 'Important warning that requires attention',
    color: '#f59e0b',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  danger: {
    label: 'Emergency',
    description: 'Critical emergency requiring immediate action',
    color: '#ef4444',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
  },
} as const

// Trigger type configuration for display
export const TRIGGER_TYPE_CONFIG = {
  webhook: {
    label: 'Webhook',
    description: 'Trigger via HTTP POST request',
    icon: 'webhook',
  },
  email: {
    label: 'Email',
    description: 'Trigger when email is received',
    icon: 'email',
  },
} as const

// Recipient group configuration for rules
export const RULE_RECIPIENT_CONFIG = {
  admin: {
    label: 'Admins Only',
    description: 'Only community administrators',
  },
  team: {
    label: 'Team Members',
    description: 'Admins and team members',
  },
  members: {
    label: 'All Members',
    description: 'Everyone in the community',
  },
  groups: {
    label: 'Groups',
    description: 'Select one or more groups',
  },
  specific: {
    label: 'Custom Invites',
    description: 'Specific selected members',
  },
} as const

// Community role configuration for display
export const COMMUNITY_ROLE_CONFIG = {
  member: {
    label: 'Member',
    icon: 'person',
    color: '#6b7280',
    description: 'Can view community content and participate in events',
  },
  team_member: {
    label: 'Team Member',
    icon: 'badge',
    color: '#3b82f6',
    description: 'Can manage response plans, map points, and community content',
  },
  admin: {
    label: 'Admin',
    icon: 'admin_panel_settings',
    color: '#22c55e',
    description: 'Full control over community settings and members',
  },
} as const

// ==========================================
// Community Groups Types
// ==========================================

// Community group (stored in database)
export interface CommunityGroup {
  id: string
  community_id: string

  // Group identification
  name: string
  description: string | null
  color: string
  icon: string

  // Status
  is_active: boolean
  display_order: number

  // Tracking
  member_count: number

  // Audit
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

// Community group member (junction table)
export interface CommunityGroupMember {
  id: string
  group_id: string
  user_id: string

  // Audit
  added_by: string
  added_at: string
}

// For creating a new group
export interface CreateCommunityGroup {
  community_id: string
  name: string
  description?: string
  color?: string
  icon?: string
  is_active?: boolean
  display_order?: number
  created_by: string
}

// For updating a group
export interface UpdateCommunityGroup {
  name?: string
  description?: string
  color?: string
  icon?: string
  is_active?: boolean
  display_order?: number
  updated_by: string
}

// Group with member details
export interface CommunityGroupWithMembers extends CommunityGroup {
  members: {
    id: string
    user_id: string
    added_at: string
    profile?: {
      id: string
      full_name: string | null
      email: string
      avatar_url: string | null
    }
  }[]
}

// Suggested group templates
export const SUGGESTED_GROUPS = [
  { name: 'Civil Defence Management', description: 'Community leadership and coordination team', icon: 'admin_panel_settings', color: '#22c55e' },
  { name: 'Response Team', description: 'First responders and emergency response members', icon: 'emergency', color: '#ef4444' },
  { name: 'Fire Crew', description: 'Members trained in fire fighting', icon: 'local_fire_department', color: '#f97316' },
  { name: 'Medical Team', description: 'Members with medical training or qualifications', icon: 'medical_services', color: '#ec4899' },
  { name: 'Volunteers', description: 'General volunteer pool', icon: 'volunteer_activism', color: '#8b5cf6' },
  { name: 'Phone Tree Members', description: 'Members responsible for phone tree communications', icon: 'phone_in_talk', color: '#06b6d4' },
  { name: 'Flood Risk Homes', description: 'Households in flood-prone areas', icon: 'water', color: '#3b82f6' },
  { name: 'Zone 1', description: 'Members in geographic Zone 1', icon: 'location_on', color: '#84cc16' },
  { name: 'Zone 2', description: 'Members in geographic Zone 2', icon: 'location_on', color: '#eab308' },
  { name: 'Zone 3', description: 'Members in geographic Zone 3', icon: 'location_on', color: '#f59e0b' },
] as const

// Group icon options for custom groups
export const GROUP_ICON_OPTIONS = [
  { value: 'group', label: 'Group' },
  { value: 'groups', label: 'Groups' },
  { value: 'admin_panel_settings', label: 'Admin' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'local_fire_department', label: 'Fire' },
  { value: 'medical_services', label: 'Medical' },
  { value: 'volunteer_activism', label: 'Volunteer' },
  { value: 'phone_in_talk', label: 'Phone' },
  { value: 'water', label: 'Water/Flood' },
  { value: 'location_on', label: 'Location' },
  { value: 'home', label: 'Home' },
  { value: 'construction', label: 'Construction' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'elderly', label: 'Elderly' },
  { value: 'child_care', label: 'Children' },
  { value: 'pets', label: 'Pets' },
  { value: 'directions_car', label: 'Transport' },
  { value: 'radio', label: 'Radio/Comms' },
] as const

// Group color options for custom groups
export const GROUP_COLOR_OPTIONS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#84cc16', label: 'Lime' },
  { value: '#22c55e', label: 'Green' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6b7280', label: 'Gray' },
] as const

// ==========================================
// AI Prompt Configuration Types
// ==========================================

// Social style types
export type SocialStyleType = 'community' | 'professional' | 'emergency' | 'modern'

// Social style options for UI
export const SOCIAL_STYLE_OPTIONS = [
  { value: 'community' as const, label: 'Community', description: 'Warm, welcoming tone' },
  { value: 'professional' as const, label: 'Professional', description: 'Trust-inspiring, formal' },
  { value: 'emergency' as const, label: 'Emergency', description: 'Safety-focused theme' },
  { value: 'modern' as const, label: 'Modern', description: 'Minimalist, clean' },
] as const

// AI function types that can be configured
// Social functions have style variants (e.g., social_post_community, social_image_professional)
export type AIFunctionType =
  | 'region_analysis'
  | 'plan_customization'
  | 'social_post_community'
  | 'social_post_professional'
  | 'social_post_emergency'
  | 'social_post_modern'
  | 'social_image_community'
  | 'social_image_professional'
  | 'social_image_emergency'
  | 'social_image_modern'
  | 'emergency_contact_localization'
  | 'community_chat'
  | 'sop_generation'

// Helper to get function type from base type and style
export function getSocialFunctionType(baseType: 'social_post' | 'social_image', style: SocialStyleType): AIFunctionType {
  return `${baseType}_${style}` as AIFunctionType
}

// AI prompt configuration (stored in database)
export interface AIPromptConfig {
  id: string
  function_type: string
  name: string
  description: string | null
  prompt_template: string
  model_id: string
  is_active: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

// For creating a new AI prompt config
export interface CreateAIPromptConfig {
  function_type: AIFunctionType
  name: string
  description?: string
  prompt_template: string
  model_id: string
  is_active?: boolean
  created_by: string
}

// For updating an AI prompt config
export interface UpdateAIPromptConfig {
  name?: string
  description?: string
  prompt_template?: string
  model_id?: string
  is_active?: boolean
  updated_by: string
}

// AI function configuration for display
export const AI_FUNCTION_CONFIG = {
  region_analysis: {
    label: 'Region Analysis',
    description: 'Analyzes a community region for emergency preparedness insights',
    icon: 'map',
    supportsImage: false,
    category: 'general',
  },
  plan_customization: {
    label: 'Response Plan Customization',
    description: 'Customizes emergency response plans for specific communities',
    icon: 'description',
    supportsImage: false,
    category: 'general',
  },
  // Social Post styles
  social_post_community: {
    label: 'Social Post - Community',
    description: 'Warm, welcoming tone for community-focused posts',
    icon: 'edit_note',
    supportsImage: false,
    category: 'social_post',
    style: 'community' as SocialStyleType,
  },
  social_post_professional: {
    label: 'Social Post - Professional',
    description: 'Trust-inspiring, formal tone for professional posts',
    icon: 'edit_note',
    supportsImage: false,
    category: 'social_post',
    style: 'professional' as SocialStyleType,
  },
  social_post_emergency: {
    label: 'Social Post - Emergency',
    description: 'Safety-focused theme for emergency awareness posts',
    icon: 'edit_note',
    supportsImage: false,
    category: 'social_post',
    style: 'emergency' as SocialStyleType,
  },
  social_post_modern: {
    label: 'Social Post - Modern',
    description: 'Minimalist, clean style for modern appeal',
    icon: 'edit_note',
    supportsImage: false,
    category: 'social_post',
    style: 'modern' as SocialStyleType,
  },
  // Social Image styles
  social_image_community: {
    label: 'Social Image - Community',
    description: 'Warm, welcoming imagery for community groups',
    icon: 'image',
    supportsImage: true,
    category: 'social_image',
    style: 'community' as SocialStyleType,
  },
  social_image_professional: {
    label: 'Social Image - Professional',
    description: 'Trust-inspiring, formal imagery',
    icon: 'image',
    supportsImage: true,
    category: 'social_image',
    style: 'professional' as SocialStyleType,
  },
  social_image_emergency: {
    label: 'Social Image - Emergency',
    description: 'Safety-focused emergency preparedness imagery',
    icon: 'image',
    supportsImage: true,
    category: 'social_image',
    style: 'emergency' as SocialStyleType,
  },
  social_image_modern: {
    label: 'Social Image - Modern',
    description: 'Minimalist, clean modern design',
    icon: 'image',
    supportsImage: true,
    category: 'social_image',
    style: 'modern' as SocialStyleType,
  },
  emergency_contact_localization: {
    label: 'Emergency Contact Localization',
    description: 'Localizes emergency contacts for specific regions',
    icon: 'contacts',
    supportsImage: false,
    category: 'general',
  },
  community_chat: {
    label: 'Community Data Chat',
    description: 'AI assistant for querying community data (members, households, response plans)',
    icon: 'chat',
    supportsImage: false,
    category: 'general',
  },
  sop_generation: {
    label: 'SOP Task Generation',
    description: 'Generates Standard Operating Procedure tasks for emergency response teams',
    icon: 'checklist',
    supportsImage: false,
    category: 'general',
  },
} as const

// Gemini model info returned from API
export interface GeminiModelInfo {
  name: string
  displayName: string
  description: string
  supportedGenerationMethods: string[]
  inputTokenLimit?: number
  outputTokenLimit?: number
}

// ==========================================
// Community Region Types
// ==========================================

// A single coordinate point for the region polygon
export interface RegionCoordinate {
  lat: number
  lng: number
}

// Region polygon stored in communities table
export type RegionPolygon = RegionCoordinate[]

// Community with region data (parsed from Json)
export interface CommunityWithRegion extends Omit<Community, 'region_polygon' | 'region_color' | 'region_opacity'> {
  region_polygon: RegionPolygon | null
  region_color: string
  region_opacity: number
}

// For updating community region
export interface UpdateCommunityRegion {
  region_polygon: RegionPolygon | null
  region_color?: string
  region_opacity?: number
}

// ==========================================
// Community AI Chat Types
// ==========================================

// AI chat message for community data queries
export interface CommunityAIChatMessage {
  id: string
  community_id: string
  user_id: string
  user_message: string
  ai_response: string
  model_used: string | null
  tokens_used: number | null
  created_at: string
}

// For creating a new chat message
export interface CreateCommunityAIChatMessage {
  community_id: string
  user_id: string
  user_message: string
  ai_response: string
  model_used?: string
  tokens_used?: number
}

// Chat request payload
export interface CommunityAIChatRequest {
  community_id: string
  message: string
}

// Chat response payload
export interface CommunityAIChatResponse {
  response: string
  model_used: string
  tokens_used?: number
}

// ==========================================
// SOP (Standard Operating Procedures) Types
// ==========================================

// Task status options
export type SOPTaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

// Activated SOP status options
export type ActivatedSOPStatus = 'active' | 'completed' | 'archived'

// Task category options
export type SOPTaskCategory = 'immediate' | 'communication' | 'logistics' | 'safety' | 'recovery' | 'other'

// Default assignee role options for SOP template tasks
export type SOPDefaultAssigneeRole = 'team_lead' | 'any_team_member' | 'admin' | 'none'

export const SOP_DEFAULT_ASSIGNEE_OPTIONS: { value: SOPDefaultAssigneeRole; label: string }[] = [
  { value: 'none', label: 'No default' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'any_team_member', label: 'Any Team Member' },
  { value: 'admin', label: 'Admin' },
]

// SOP Template Task (stored in JSONB)
export interface SOPTemplateTask {
  id: string
  title: string
  description?: string
  order: number
  estimated_duration_minutes?: number
  category?: SOPTaskCategory
  default_assignee_role?: SOPDefaultAssigneeRole // Optional role-based pre-assignment
  default_assignee_id?: string // Optional specific user ID for pre-assignment
}

// SOP Template (attached to response plans)
export interface SOPTemplate {
  id: string
  community_id: string
  guide_id: string

  // Template details
  name: string
  description: string | null
  tasks: SOPTemplateTask[]

  // Status
  is_active: boolean

  // Audit
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

// For creating a new SOP template
export interface CreateSOPTemplate {
  community_id: string
  guide_id: string
  name: string
  description?: string
  tasks?: SOPTemplateTask[]
  is_active?: boolean
  created_by: string
}

// For updating an SOP template
export interface UpdateSOPTemplate {
  name?: string
  description?: string
  tasks?: SOPTemplateTask[]
  is_active?: boolean
  updated_by: string
}

// Activated SOP (instance during emergency)
export interface ActivatedSOP {
  id: string
  community_id: string
  template_id: string
  guide_id: string

  // Event details
  event_name: string
  event_date: string
  emergency_type: string

  // Status
  status: ActivatedSOPStatus

  // Timing
  activated_at: string
  completed_at: string | null
  archived_at: string | null

  // Notes
  completion_notes: string | null

  // Audit
  activated_by: string
  completed_by: string | null
  archived_by: string | null
  created_at: string
  updated_at: string
}

// For activating a new SOP
export interface CreateActivatedSOP {
  community_id: string
  template_id: string
  guide_id: string
  event_name: string
  event_date?: string
  emergency_type: string
  activated_by: string
}

// For updating an activated SOP
export interface UpdateActivatedSOP {
  event_name?: string
  status?: ActivatedSOPStatus
  completed_at?: string
  archived_at?: string
  completion_notes?: string
  completed_by?: string
  archived_by?: string
}

// SOP Task (individual task in an activated SOP)
export interface SOPTask {
  id: string
  activated_sop_id: string
  community_id: string

  // Task details
  title: string
  description: string | null
  task_order: number
  estimated_duration_minutes: number | null
  category: SOPTaskCategory | null

  // Assignment
  team_lead_id: string | null
  assigned_to_id: string | null

  // Progress
  status: SOPTaskStatus
  completed_at: string | null
  completed_by: string | null

  // Notes
  notes: string | null

  // Audit
  created_at: string
  updated_at: string
}

// For creating a new SOP task
export interface CreateSOPTask {
  activated_sop_id: string
  community_id: string
  title: string
  description?: string
  task_order: number
  estimated_duration_minutes?: number
  category?: SOPTaskCategory
  team_lead_id?: string
  assigned_to_id?: string
}

// For updating an SOP task
export interface UpdateSOPTask {
  title?: string
  description?: string
  task_order?: number
  team_lead_id?: string | null
  assigned_to_id?: string | null
  status?: SOPTaskStatus
  completed_at?: string
  completed_by?: string
  notes?: string
}

// SOP Task Activity (audit log)
export interface SOPTaskActivity {
  id: string
  task_id: string
  activated_sop_id: string

  // Activity details
  action: 'status_change' | 'assignment_change' | 'note_added' | 'team_lead_change'
  old_value: string | null
  new_value: string | null

  // Who made the change
  performed_by: string

  // Audit
  created_at: string
}

// SOP Task with profile details (for display)
export interface SOPTaskWithProfiles extends SOPTask {
  team_lead?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
  assigned_to?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
  completed_by_profile?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

// Activated SOP with related data (for display)
export interface ActivatedSOPWithDetails extends ActivatedSOP {
  template?: SOPTemplate
  guide?: {
    id: string
    name: string
    icon: string
    color: string
    guide_type: string
  }
  tasks?: SOPTaskWithProfiles[]
  activated_by_profile?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

// SOP Task category configuration for display
export const SOP_TASK_CATEGORY_CONFIG = {
  immediate: {
    label: 'Immediate Action',
    description: 'Actions that must be taken immediately',
    icon: 'priority_high',
    color: '#ef4444',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  communication: {
    label: 'Communication',
    description: 'Alert and communication tasks',
    icon: 'campaign',
    color: '#3b82f6',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  logistics: {
    label: 'Logistics',
    description: 'Equipment, supplies, and resource management',
    icon: 'inventory_2',
    color: '#8b5cf6',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
  },
  safety: {
    label: 'Safety',
    description: 'Safety checks and protocols',
    icon: 'health_and_safety',
    color: '#22c55e',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
  recovery: {
    label: 'Recovery',
    description: 'Post-emergency recovery tasks',
    icon: 'healing',
    color: '#f59e0b',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
  other: {
    label: 'Other',
    description: 'Other tasks',
    icon: 'more_horiz',
    color: '#6b7280',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
  },
} as const

// SOP Task status configuration for display
export const SOP_TASK_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: 'hourglass_empty',
    color: '#6b7280',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  in_progress: {
    label: 'In Progress',
    icon: 'sync',
    color: '#3b82f6',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  completed: {
    label: 'Completed',
    icon: 'check_circle',
    color: '#22c55e',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  skipped: {
    label: 'Skipped',
    icon: 'skip_next',
    color: '#f59e0b',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
} as const

// Activated SOP status configuration for display
export const ACTIVATED_SOP_STATUS_CONFIG = {
  active: {
    label: 'Active',
    description: 'Emergency response in progress',
    icon: 'emergency',
    color: '#ef4444',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  completed: {
    label: 'Completed',
    description: 'Emergency resolved',
    icon: 'check_circle',
    color: '#22c55e',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  archived: {
    label: 'Archived',
    description: 'Stored for historical review',
    icon: 'archive',
    color: '#6b7280',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
} as const

// ==========================================
// Emergency Contacts System Types
// ==========================================

// Contact categories
export type EmergencyContactCategory = 'emergency' | 'health' | 'utilities' | 'local' | 'government' | 'community' | 'personal' | 'medical' | 'insurance'

// Default emergency contact (system-wide)
export interface DefaultEmergencyContact {
  id: string
  name: string
  phone: string
  description: string | null
  icon: string
  category: EmergencyContactCategory
  display_order: number
  is_active: boolean
  allow_community_override: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

// For creating a new default contact
export interface CreateDefaultEmergencyContact {
  name: string
  phone: string
  description?: string
  icon?: string
  category: EmergencyContactCategory
  display_order?: number
  is_active?: boolean
  allow_community_override?: boolean
  created_by: string
}

// For updating a default contact
export interface UpdateDefaultEmergencyContact {
  name?: string
  phone?: string
  description?: string
  icon?: string
  category?: EmergencyContactCategory
  display_order?: number
  is_active?: boolean
  allow_community_override?: boolean
  updated_by: string
}

// Community emergency contact (regional)
export interface CommunityEmergencyContact {
  id: string
  community_id: string
  name: string
  phone: string
  description: string | null
  icon: string
  category: EmergencyContactCategory
  display_order: number
  is_active: boolean
  overrides_default_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

// For creating a new community contact
export interface CreateCommunityEmergencyContact {
  community_id: string
  name: string
  phone: string
  description?: string
  icon?: string
  category?: EmergencyContactCategory
  display_order?: number
  is_active?: boolean
  overrides_default_id?: string
  created_by: string
}

// For updating a community contact
export interface UpdateCommunityEmergencyContact {
  name?: string
  phone?: string
  description?: string
  icon?: string
  category?: EmergencyContactCategory
  display_order?: number
  is_active?: boolean
  overrides_default_id?: string | null
  updated_by: string
}

// User emergency contact (personal)
export interface UserEmergencyContact {
  id: string
  user_id: string
  name: string
  phone: string
  description: string | null
  icon: string
  category: EmergencyContactCategory
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// For creating a new user contact
export interface CreateUserEmergencyContact {
  user_id: string
  name: string
  phone: string
  description?: string
  icon?: string
  category?: EmergencyContactCategory
  display_order?: number
  is_active?: boolean
}

// For updating a user contact
export interface UpdateUserEmergencyContact {
  name?: string
  phone?: string
  description?: string
  icon?: string
  category?: EmergencyContactCategory
  display_order?: number
  is_active?: boolean
}

// Community hidden contact (to hide defaults)
export interface CommunityHiddenContact {
  id: string
  community_id: string
  default_contact_id: string
  reason: string | null
  hidden_by: string | null
  hidden_at: string
}

// For hiding a default contact
export interface CreateCommunityHiddenContact {
  community_id: string
  default_contact_id: string
  reason?: string
  hidden_by: string
}

// Combined contact for display (merges all levels)
export interface DisplayEmergencyContact {
  id: string
  name: string
  phone: string
  description: string | null
  icon: string
  category: EmergencyContactCategory
  display_order: number
  source: 'default' | 'community' | 'user'
  isEditable: boolean
  isHideable: boolean
  overridesDefaultId?: string
}

// Category configuration for display
export const EMERGENCY_CONTACT_CATEGORY_CONFIG = {
  emergency: {
    label: 'Emergency Services',
    icon: 'emergency',
    color: '#ef4444',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    order: 1,
  },
  health: {
    label: 'Health Services',
    icon: 'medical_services',
    color: '#ec4899',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    order: 2,
  },
  utilities: {
    label: 'Utilities',
    icon: 'build',
    color: '#f59e0b',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    order: 3,
  },
  local: {
    label: 'Information Lines',
    icon: 'info',
    color: '#3b82f6',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    order: 4,
  },
  government: {
    label: 'Government Services',
    icon: 'account_balance',
    color: '#6366f1',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    order: 5,
  },
  community: {
    label: 'Community Contacts',
    icon: 'groups',
    color: '#22c55e',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    order: 6,
  },
  personal: {
    label: 'Personal Contacts',
    icon: 'person',
    color: '#8b5cf6',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    order: 7,
  },
  medical: {
    label: 'Medical Contacts',
    icon: 'local_hospital',
    color: '#ef4444',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    order: 8,
  },
  insurance: {
    label: 'Insurance',
    icon: 'shield',
    color: '#14b8a6',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    order: 9,
  },
} as const

// Icon options for contacts
export const EMERGENCY_CONTACT_ICON_OPTIONS = [
  { value: 'call', label: 'Phone' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'local_police', label: 'Police' },
  { value: 'local_fire_department', label: 'Fire' },
  { value: 'local_hospital', label: 'Hospital' },
  { value: 'medical_services', label: 'Medical' },
  { value: 'health_and_safety', label: 'Health' },
  { value: 'psychology', label: 'Mental Health' },
  { value: 'support', label: 'Support' },
  { value: 'science', label: 'Poison' },
  { value: 'shield', label: 'Civil Defence' },
  { value: 'bolt', label: 'Power' },
  { value: 'water_drop', label: 'Water' },
  { value: 'cloud', label: 'Weather' },
  { value: 'directions_car', label: 'Transport' },
  { value: 'account_balance', label: 'Government' },
  { value: 'groups', label: 'Community' },
  { value: 'person', label: 'Person' },
  { value: 'home', label: 'Home' },
  { value: 'business', label: 'Business' },
] as const

// Suggested community contacts based on region
export const SUGGESTED_COMMUNITY_CONTACTS = [
  { name: 'Local Council', description: 'Your local district/city council', icon: 'account_balance', category: 'government' as const },
  { name: 'Regional Council', description: 'Regional council services', icon: 'account_balance', category: 'government' as const },
  { name: 'Power Company', description: 'Local electricity provider outages', icon: 'bolt', category: 'utilities' as const },
  { name: 'Water Supply', description: 'Local water supply issues', icon: 'water_drop', category: 'utilities' as const },
  { name: 'Local Police Station', description: 'Non-emergency local police', icon: 'local_police', category: 'emergency' as const },
  { name: 'Local Fire Station', description: 'Non-emergency local fire', icon: 'local_fire_department', category: 'emergency' as const },
  { name: 'Community Leader', description: 'Emergency response coordinator', icon: 'groups', category: 'community' as const },
  { name: 'Medical Centre', description: 'Local GP or medical centre', icon: 'local_hospital', category: 'health' as const },
  { name: 'Pharmacy', description: 'Local pharmacy', icon: 'medical_services', category: 'health' as const },
  { name: 'Vet Clinic', description: 'Local veterinary clinic', icon: 'pets', category: 'local' as const },
] as const
