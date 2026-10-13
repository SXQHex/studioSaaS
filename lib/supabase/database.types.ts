export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      lesson_member_outcomes: {
        Row: { lesson_id: string; member_id: string; outcome: string; actor_id: string; note: string; created_at: string }
        Insert: { lesson_id: string; member_id: string; outcome: string; actor_id: string; note: string; created_at?: string }
        Update: { lesson_id?: string; member_id?: string; outcome?: string; actor_id?: string; note?: string; created_at?: string }
        Relationships: []
      }
      attendance: {
        Row: {
          attended: boolean
          center_id: string
          checked_in_at: string
          checked_in_by: string | null
          created_at: string
          id: string
          lesson_id: string
          member_id: string
          notes: string | null
        }
        Insert: {
          attended?: boolean
          center_id: string
          checked_in_at?: string
          checked_in_by?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          member_id: string
          notes?: string | null
        }
        Update: {
          attended?: boolean
          center_id?: string
          checked_in_at?: string
          checked_in_by?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          member_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_lesson_center_fkey"
            columns: ["lesson_id", "center_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "attendance_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_center_fkey"
            columns: ["member_id", "center_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      center_admins: {
        Row: {
          center_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          center_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          center_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_admins_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_admins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      center_role_assignments: {
        Row: {
          center_id: string
          created_at: string
          profile_id: string
          role: string
        }
        Insert: {
          center_id: string
          created_at?: string
          profile_id: string
          role: string
        }
        Update: {
          center_id?: string
          created_at?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_role_assignments_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_role_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      centers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "centers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          center_id: string
          created_at: string
          created_by: string | null
          id: string
          lesson_id: string | null
          member_id: string
          note: string | null
          reason: string
          subscription_id: string
        }
        Insert: {
          amount: number
          center_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          lesson_id?: string | null
          member_id: string
          note?: string | null
          reason: string
          subscription_id: string
        }
        Update: {
          amount?: number
          center_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lesson_id?: string | null
          member_id?: string
          note?: string | null
          reason?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_lesson_center_fkey"
            columns: ["lesson_id", "center_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "credit_transactions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_member_center_fkey"
            columns: ["member_id", "center_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "credit_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_subscription_center_fkey"
            columns: ["subscription_id", "center_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "credit_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_enrollments: {
        Row: {
          center_id: string
          created_at: string
          lesson_id: string
          member_id: string
        }
        Insert: {
          center_id: string
          created_at?: string
          lesson_id: string
          member_id: string
        }
        Update: {
          center_id?: string
          created_at?: string
          lesson_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_enrollments_lesson_id_center_id_fkey"
            columns: ["lesson_id", "center_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "lesson_enrollments_member_id_center_id_fkey"
            columns: ["member_id", "center_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "center_id"]
          },
        ]
      }
      lesson_staff_assignments: {
        Row: {
          created_at: string
          lesson_id: string
          profile_id: string
          role: string
        }
        Insert: {
          created_at?: string
          lesson_id: string
          profile_id: string
          role: string
        }
        Update: {
          created_at?: string
          lesson_id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_staff_assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_staff_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          center_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          expected_attendees: number | null
          id: string
          instructor_id: string | null
          notes: string | null
          private_member_id: string | null
          room_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["lesson_status"]
          title: string
          type: Database["public"]["Enums"]["lesson_type"]
          updated_at: string
        }
        Insert: {
          center_id: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          expected_attendees?: number | null
          id?: string
          instructor_id?: string | null
          notes?: string | null
          private_member_id?: string | null
          room_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["lesson_status"]
          title: string
          type: Database["public"]["Enums"]["lesson_type"]
          updated_at?: string
        }
        Update: {
          center_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          expected_attendees?: number | null
          id?: string
          instructor_id?: string | null
          notes?: string | null
          private_member_id?: string | null
          room_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["lesson_status"]
          title?: string
          type?: Database["public"]["Enums"]["lesson_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_private_member_center_fkey"
            columns: ["private_member_id", "center_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "lessons_private_member_id_fkey"
            columns: ["private_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_room_center_fkey"
            columns: ["room_id", "center_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "lessons_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      member_account_link_audit: {
        Row: {
          id: string
          member_id: string
          center_id: string
          old_profile_id: string | null
          new_profile_id: string | null
          actor_id: string
          changed_at: string
        }
        Insert: {
          id?: string
          member_id: string
          center_id: string
          old_profile_id?: string | null
          new_profile_id?: string | null
          actor_id: string
          changed_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          center_id?: string
          old_profile_id?: string | null
          new_profile_id?: string | null
          actor_id?: string
          changed_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          center_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          center_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          center_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          center_id: string | null
          created_at: string
          href: string
          id: string
          organization_id: string | null
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          body: string
          center_id?: string | null
          created_at?: string
          href?: string
          id?: string
          organization_id?: string | null
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          body?: string
          center_id?: string | null
          created_at?: string
          href?: string
          id?: string
          organization_id?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_role_assignments: {
        Row: {
          created_at: string
          organization_id: string
          profile_id: string
          role: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          profile_id: string
          role: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_role_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_role_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_role_assignments: {
        Row: {
          created_at: string
          profile_id: string
          role: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          role: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_role_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          capacity: number
          center_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          capacity?: number
          center_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          capacity?: number
          center_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      session_request_events: {
        Row: { id: string; request_id: string; actor_id: string | null; action: string; note: string | null; details: Json; created_at: string }
        Insert: { id?: string; request_id: string; actor_id?: string | null; action: string; note?: string | null; details?: Json; created_at?: string }
        Update: { id?: string; request_id?: string; actor_id?: string | null; action?: string; note?: string | null; details?: Json; created_at?: string }
        Relationships: []
      }
      session_requests: {
        Row: {
          alternative_starts_at: string | null
          alternative_ends_at: string | null
          alternative_note: string | null
          alternative_proposed_at: string | null
          alternative_proposed_by: string | null
          approved_lesson_id: string | null
          center_id: string
          created_at: string
          ends_at: string
          expected_attendees: number
          id: string
          instructor_id: string
          notes: string | null
          organization_id: string
          private_member_id: string | null
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          room_id: string
          session_type: Database["public"]["Enums"]["lesson_type"]
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          alternative_starts_at?: string | null
          alternative_ends_at?: string | null
          alternative_note?: string | null
          alternative_proposed_at?: string | null
          alternative_proposed_by?: string | null
          approved_lesson_id?: string | null
          center_id: string
          created_at?: string
          ends_at: string
          expected_attendees?: number
          id?: string
          instructor_id: string
          notes?: string | null
          organization_id: string
          private_member_id?: string | null
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_id: string
          session_type: Database["public"]["Enums"]["lesson_type"]
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          alternative_starts_at?: string | null
          alternative_ends_at?: string | null
          alternative_note?: string | null
          alternative_proposed_at?: string | null
          alternative_proposed_by?: string | null
          approved_lesson_id?: string | null
          center_id?: string
          created_at?: string
          ends_at?: string
          expected_attendees?: number
          id?: string
          instructor_id?: string
          notes?: string | null
          organization_id?: string
          private_member_id?: string | null
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_id?: string
          session_type?: Database["public"]["Enums"]["lesson_type"]
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_requests_approved_lesson_id_fkey"
            columns: ["approved_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_center_organization_fkey"
            columns: ["center_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "session_requests_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_private_member_center_fkey"
            columns: ["private_member_id", "center_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "session_requests_private_member_id_fkey"
            columns: ["private_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_room_center_fkey"
            columns: ["room_id", "center_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "session_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          center_id: string
          created_at: string
          created_by: string | null
          credits_purchased: number
          credits_remaining: number
          ends_on: string | null
          id: string
          member_id: string
          notes: string | null
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          starts_on: string
          status: Database["public"]["Enums"]["subscription_status"]
          type: Database["public"]["Enums"]["subscription_type"]
        }
        Insert: {
          amount?: number
          center_id: string
          created_at?: string
          created_by?: string | null
          credits_purchased: number
          credits_remaining: number
          ends_on?: string | null
          id?: string
          member_id: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          starts_on?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          type: Database["public"]["Enums"]["subscription_type"]
        }
        Update: {
          amount?: number
          center_id?: string
          created_at?: string
          created_by?: string | null
          credits_purchased?: number
          credits_remaining?: number
          ends_on?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          starts_on?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          type?: Database["public"]["Enums"]["subscription_type"]
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_member_center_fkey"
            columns: ["member_id", "center_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      waitlist_command: { Args: { p_data: Json }; Returns: Json }
      groups_command: { Args: { p_data: Json }; Returns: Json }
      payments_command: { Args: { p_data: Json }; Returns: Json }
      lesson_command: { Args: { p_data: Json }; Returns: Json }
      crm_command: { Args: { p_data: Json }; Returns: Json }
      studio_workspace: { Args: { p_module: string }; Returns: Json }
      studio_report: { Args: { p_from: string; p_to: string }; Returns: Json }

      my_teaching_lessons: {
        Args: Record<string, never>
        Returns: { id: string; center_id: string; title: string; type: Database["public"]["Enums"]["lesson_type"]; starts_at: string; status: Database["public"]["Enums"]["lesson_status"]; expected_attendees: number | null }[]
      }
      my_lesson_roster: {
        Args: { p_lesson_id: string }
        Returns: { member_id: string; full_name: string; email: string | null; phone: string | null; source: string; attended: boolean | null; checked_in_at: string | null }[]
      }
      lookup_center_account: {
        Args: { p_center_id: string; p_email: string }
        Returns: { profile_id: string; email: string; full_name: string; linked_member_id: string | null }[]
      }
      link_member_account: {
        Args: { p_member_id: string; p_account_email: string }
        Returns: string
      }
      unlink_member_account: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      assign_center_role: {
        Args: { p_center_id: string; p_profile_id: string; p_role: string }
        Returns: undefined
      }
      remove_center_role: {
        Args: { p_center_id: string; p_profile_id: string; p_role: string }
        Returns: undefined
      }

      my_scoped_roles: { Args: Record<string, never>; Returns: { role: string; scope_type: string; scope_id: string | null }[] }
      create_center: {
        Args: { p_address?: string | null; p_name: string; p_organization_id: string }
        Returns: string
      }
      create_session_request: {
        Args: {
          p_center_id: string
          p_ends_at: string
          p_expected_attendees: number
          p_instructor_id?: string | null
          p_notes: string | null
          p_private_member_id: string | null
          p_room_id: string
          p_session_type: Database["public"]["Enums"]["lesson_type"]
          p_starts_at: string
          p_title: string
        }
        Returns: string
      }
      grant_center_admin: {
        Args: { p_center_id: string; p_profile_id: string }
        Returns: undefined
      }
      list_requestable_members: {
        Args: { p_center_id: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      withdraw_session_request: { Args: { p_request_id: string }; Returns: undefined }
      propose_session_request_alternative: { Args: { p_request_id: string; p_starts_at: string; p_ends_at: string; p_note: string }; Returns: undefined }
      respond_session_request_alternative: { Args: { p_request_id: string; p_proposed_at: string; p_accept: boolean }; Returns: undefined }
      review_session_request: {
        Args: {
          p_approve: boolean
          p_request_id: string
          p_review_note?: string | null
        }
        Returns: string
      }
      revoke_center_admin: {
        Args: { p_center_id: string; p_profile_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "instructor" | "student"
      lesson_status: "scheduled" | "completed" | "cancelled" | "postponed"
      lesson_type: "private" | "group"
      payment_status: "pending" | "paid" | "refunded"
      subscription_status: "active" | "expired" | "cancelled"
      subscription_type: "private_credits" | "group_4_weeks"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "instructor", "student"],
      lesson_status: ["scheduled", "completed", "cancelled", "postponed"],
      lesson_type: ["private", "group"],
      payment_status: ["pending", "paid", "refunded"],
      subscription_status: ["active", "expired", "cancelled"],
      subscription_type: ["private_credits", "group_4_weeks"],
    },
  },
} as const
