// Generated from live schema; nullable RPC arguments are adjusted to match SQL contracts.
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
      center_policy_overrides: {
        Row: {
          center_id: string
          key: string
          revision: number
          updated_at: string
          value: Json | null
        }
        Insert: {
          center_id: string
          key: string
          revision?: number
          updated_at?: string
          value?: Json | null
        }
        Update: {
          center_id?: string
          key?: string
          revision?: number
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "center_policy_overrides_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_policy_overrides_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "policy_definitions"
            referencedColumns: ["key"]
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
      crm_intake_forms: {
        Row: {
          active: boolean
          center_id: string
          id: string
          owner_id: string
          slug: string
          title: string
        }
        Insert: {
          active?: boolean
          center_id: string
          id?: string
          owner_id: string
          slug: string
          title: string
        }
        Update: {
          active?: boolean
          center_id?: string
          id?: string
          owner_id?: string
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_intake_forms_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_intake_forms_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          center_id: string
          converted_at: string | null
          converted_member_id: string | null
          created_at: string
          created_by: string
          email: string | null
          full_name: string
          id: string
          interests: string | null
          marketing_opt_in: boolean
          notes: string | null
          phone: string | null
          source: string
          stage: string
          trial_at: string | null
          trial_outcome: string | null
          updated_at: string
        }
        Insert: {
          center_id: string
          converted_at?: string | null
          converted_member_id?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          full_name: string
          id?: string
          interests?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          phone?: string | null
          source: string
          stage?: string
          trial_at?: string | null
          trial_outcome?: string | null
          updated_at?: string
        }
        Update: {
          center_id?: string
          converted_at?: string | null
          converted_member_id?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          full_name?: string
          id?: string
          interests?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          phone?: string | null
          source?: string
          stage?: string
          trial_at?: string | null
          trial_outcome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_converted_member_id_fkey"
            columns: ["converted_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          automation_key: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          due_at: string
          id: string
          lead_id: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          automation_key?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          due_at: string
          id?: string
          lead_id: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          automation_key?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          due_at?: string
          id?: string
          lead_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      group_waitlist: {
        Row: {
          created_at: string
          group_id: string
          id: string
          member_id: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          member_id: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          member_id?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_waitlist_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "studio_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_waitlist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_changes: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          lesson_id: string
          new_starts_at: string | null
          note: string
          old_starts_at: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          new_starts_at?: string | null
          note: string
          old_starts_at?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          new_starts_at?: string | null
          note?: string
          old_starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_changes_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_changes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
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
      lesson_member_outcomes: {
        Row: {
          actor_id: string
          created_at: string
          lesson_id: string
          member_id: string
          note: string
          outcome: string
          policy_snapshot: Json | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          lesson_id: string
          member_id: string
          note: string
          outcome: string
          policy_snapshot?: Json | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          lesson_id?: string
          member_id?: string
          note?: string
          outcome?: string
          policy_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_member_outcomes_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_member_outcomes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_member_outcomes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_staff_assignments: {
        Row: {
          center_id: string
          created_at: string
          lesson_id: string
          profile_id: string
          role: string
        }
        Insert: {
          center_id: string
          created_at?: string
          lesson_id: string
          profile_id: string
          role: string
        }
        Update: {
          center_id?: string
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
          {
            foreignKeyName: "lesson_staff_lesson_center_fkey"
            columns: ["lesson_id", "center_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id", "center_id"]
          },
          {
            foreignKeyName: "lesson_staff_role_center_fkey"
            columns: ["center_id", "profile_id", "role"]
            isOneToOne: false
            referencedRelation: "center_role_assignments"
            referencedColumns: ["center_id", "profile_id", "role"]
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
          group_id: string | null
          id: string
          instructor_id: string | null
          makeup_of: string | null
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
          group_id?: string | null
          id?: string
          instructor_id?: string | null
          makeup_of?: string | null
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
          group_id?: string | null
          id?: string
          instructor_id?: string | null
          makeup_of?: string | null
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
            foreignKeyName: "lessons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "studio_groups"
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
            foreignKeyName: "lessons_makeup_of_fkey"
            columns: ["makeup_of"]
            isOneToOne: false
            referencedRelation: "lessons"
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
      manual_payments: {
        Row: {
          actor_id: string | null
          amount: number
          center_id: string
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          method: string
          note: string
          occurred_at: string
          reversed_entry_id: string | null
          subscription_id: string
        }
        Insert: {
          actor_id?: string | null
          amount: number
          center_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          method?: string
          note: string
          occurred_at: string
          reversed_entry_id?: string | null
          subscription_id: string
        }
        Update: {
          actor_id?: string | null
          amount?: number
          center_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          method?: string
          note?: string
          occurred_at?: string
          reversed_entry_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_payments_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payments_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payments_reversed_entry_id_fkey"
            columns: ["reversed_entry_id"]
            isOneToOne: false
            referencedRelation: "manual_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      member_account_link_audit: {
        Row: {
          actor_id: string
          center_id: string
          changed_at: string
          id: string
          member_id: string
          new_profile_id: string | null
          old_profile_id: string | null
        }
        Insert: {
          actor_id: string
          center_id: string
          changed_at?: string
          id?: string
          member_id: string
          new_profile_id?: string | null
          old_profile_id?: string | null
        }
        Update: {
          actor_id?: string
          center_id?: string
          changed_at?: string
          id?: string
          member_id?: string
          new_profile_id?: string | null
          old_profile_id?: string | null
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
            isOneToOne: false
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
          dedupe_key: string | null
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
          dedupe_key?: string | null
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
          dedupe_key?: string | null
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
      organization_policies: {
        Row: {
          key: string
          max_value: number | null
          min_value: number | null
          mode: string
          organization_id: string
          revision: number
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          max_value?: number | null
          min_value?: number | null
          mode: string
          organization_id: string
          revision?: number
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          max_value?: number | null
          min_value?: number | null
          mode?: string
          organization_id?: string
          revision?: number
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "organization_policies_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "policy_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "organization_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      package_catalog: {
        Row: {
          active: boolean
          center_id: string
          credits: number
          freeze_count: number
          freeze_days: number
          id: string
          lesson_type: Database["public"]["Enums"]["lesson_type"]
          name: string
          price: number
          validity_days: number
        }
        Insert: {
          active?: boolean
          center_id: string
          credits: number
          freeze_count?: number
          freeze_days?: number
          id?: string
          lesson_type: Database["public"]["Enums"]["lesson_type"]
          name: string
          price: number
          validity_days: number
        }
        Update: {
          active?: boolean
          center_id?: string
          credits?: number
          freeze_count?: number
          freeze_days?: number
          id?: string
          lesson_type?: Database["public"]["Enums"]["lesson_type"]
          name?: string
          price?: number
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_catalog_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
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
      policy_audit: {
        Row: {
          action: string
          actor_id: string
          after_value: Json | null
          before_value: Json | null
          center_id: string | null
          created_at: string
          id: string
          key: string
          organization_id: string
          reason: string
        }
        Insert: {
          action: string
          actor_id: string
          after_value?: Json | null
          before_value?: Json | null
          center_id?: string | null
          created_at?: string
          id?: string
          key: string
          organization_id: string
          reason: string
        }
        Update: {
          action?: string
          actor_id?: string
          after_value?: Json | null
          before_value?: Json | null
          center_id?: string | null
          created_at?: string
          id?: string
          key?: string
          organization_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_audit_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_audit_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "policy_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "policy_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_definitions: {
        Row: {
          category: string
          default_value: Json
          key: string
          kind: string
          label: string
          max_value: number | null
          min_value: number | null
          revision: number
        }
        Insert: {
          category: string
          default_value: Json
          key: string
          kind: string
          label: string
          max_value?: number | null
          min_value?: number | null
          revision?: number
        }
        Update: {
          category?: string
          default_value?: Json
          key?: string
          kind?: string
          label?: string
          max_value?: number | null
          min_value?: number | null
          revision?: number
        }
        Relationships: []
      }
      policy_exceptions: {
        Row: {
          actor_id: string
          center_id: string
          created_at: string
          id: string
          lesson_id: string
          member_id: string
          policy_snapshot: Json
          reason: string
          values_override: Json
        }
        Insert: {
          actor_id: string
          center_id: string
          created_at?: string
          id?: string
          lesson_id: string
          member_id: string
          policy_snapshot: Json
          reason: string
          values_override: Json
        }
        Update: {
          actor_id?: string
          center_id?: string
          created_at?: string
          id?: string
          lesson_id?: string
          member_id?: string
          policy_snapshot?: Json
          reason?: string
          values_override?: Json
        }
        Relationships: [
          {
            foreignKeyName: "policy_exceptions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_exceptions_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_exceptions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_exceptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
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
      registration_acceptances: {
        Row: {
          accepted_at: string
          accepted_by: string
          member_id: string
          policy_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_by: string
          member_id: string
          policy_id: string
        }
        Update: {
          accepted_at?: string
          accepted_by?: string
          member_id?: string
          policy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_acceptances_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_acceptances_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_acceptances_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "registration_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_details: {
        Row: {
          emergency_name: string
          emergency_phone: string
          marketing_opt_in: boolean
          member_id: string
          phone: string
          updated_at: string
        }
        Insert: {
          emergency_name?: string
          emergency_phone?: string
          marketing_opt_in?: boolean
          member_id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          emergency_name?: string
          emergency_phone?: string
          marketing_opt_in?: boolean
          member_id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_details_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_documents: {
        Row: {
          created_at: string
          id: string
          member_id: string
          object_path: string
          title: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          object_path: string
          title: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          object_path?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_policies: {
        Row: {
          body: string
          center_id: string | null
          created_by: string
          id: string
          organization_id: string
          published_at: string
          required: boolean
          retired_at: string | null
          title: string
        }
        Insert: {
          body: string
          center_id?: string | null
          created_by: string
          id?: string
          organization_id: string
          published_at?: string
          required?: boolean
          retired_at?: string | null
          title: string
        }
        Update: {
          body?: string
          center_id?: string | null
          created_by?: string
          id?: string
          organization_id?: string
          published_at?: string
          required?: boolean
          retired_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_policies_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_requirements: {
        Row: {
          center_id: string
          document_required: boolean
          emergency_contact: boolean
        }
        Insert: {
          center_id: string
          document_required?: boolean
          emergency_contact?: boolean
        }
        Update: {
          center_id?: string
          document_required?: boolean
          emergency_contact?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "registration_requirements_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: true
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_blocks: {
        Row: {
          center_id: string
          ends_at: string
          id: string
          kind: string
          resource_id: string | null
          resource_kind: string
          starts_at: string
          title: string
        }
        Insert: {
          center_id: string
          ends_at: string
          id?: string
          kind: string
          resource_id?: string | null
          resource_kind: string
          starts_at: string
          title: string
        }
        Update: {
          center_id?: string
          ends_at?: string
          id?: string
          kind?: string
          resource_id?: string | null
          resource_kind?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_blocks_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_hours: {
        Row: {
          center_id: string
          closes: string
          id: string
          opens: string
          resource_id: string | null
          resource_kind: string
          weekday: number
        }
        Insert: {
          center_id: string
          closes: string
          id?: string
          opens: string
          resource_id?: string | null
          resource_kind: string
          weekday: number
        }
        Update: {
          center_id?: string
          closes?: string
          id?: string
          opens?: string
          resource_id?: string | null
          resource_kind?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_hours_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
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
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          note: string | null
          request_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          note?: string | null
          request_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          note?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_request_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "session_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      session_requests: {
        Row: {
          alternative_ends_at: string | null
          alternative_note: string | null
          alternative_proposed_at: string | null
          alternative_proposed_by: string | null
          alternative_starts_at: string | null
          approved_lesson_id: string | null
          center_id: string
          created_at: string
          ends_at: string
          expected_attendees: number
          id: string
          instructor_id: string
          notes: string | null
          organization_id: string
          policy_snapshot: Json | null
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
          alternative_ends_at?: string | null
          alternative_note?: string | null
          alternative_proposed_at?: string | null
          alternative_proposed_by?: string | null
          alternative_starts_at?: string | null
          approved_lesson_id?: string | null
          center_id: string
          created_at?: string
          ends_at: string
          expected_attendees?: number
          id?: string
          instructor_id: string
          notes?: string | null
          organization_id: string
          policy_snapshot?: Json | null
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
          alternative_ends_at?: string | null
          alternative_note?: string | null
          alternative_proposed_at?: string | null
          alternative_proposed_by?: string | null
          alternative_starts_at?: string | null
          approved_lesson_id?: string | null
          center_id?: string
          created_at?: string
          ends_at?: string
          expected_attendees?: number
          id?: string
          instructor_id?: string
          notes?: string | null
          organization_id?: string
          policy_snapshot?: Json | null
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
            foreignKeyName: "session_requests_alternative_proposed_by_fkey"
            columns: ["alternative_proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      student_progress: {
        Row: {
          center_id: string
          created_at: string
          id: string
          instructor_id: string
          lesson_type: Database["public"]["Enums"]["lesson_type"]
          level: string
          member_id: string
          note: string
          score: number
          skill: string
          student_visible: boolean
        }
        Insert: {
          center_id: string
          created_at?: string
          id?: string
          instructor_id: string
          lesson_type: Database["public"]["Enums"]["lesson_type"]
          level: string
          member_id: string
          note: string
          score: number
          skill: string
          student_visible?: boolean
        }
        Update: {
          center_id?: string
          created_at?: string
          id?: string
          instructor_id?: string
          lesson_type?: Database["public"]["Enums"]["lesson_type"]
          level?: string
          member_id?: string
          note?: string
          score?: number
          skill?: string
          student_visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_email_events: {
        Row: {
          created_at: string
          event_id: string
          occurred_at: string
          provider_id: string
          type: string
        }
        Insert: {
          created_at?: string
          event_id: string
          occurred_at: string
          provider_id: string
          type: string
        }
        Update: {
          created_at?: string
          event_id?: string
          occurred_at?: string
          provider_id?: string
          type?: string
        }
        Relationships: []
      }
      studio_email_outbox: {
        Row: {
          attempts: number
          center_id: string
          created_at: string
          first_attempt_at: string | null
          id: string
          last_error: string | null
          lease_token: string | null
          lease_until: string | null
          next_attempt_at: string
          notification_id: string
          provider_id: string | null
          recipient_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          center_id: string
          created_at?: string
          first_attempt_at?: string | null
          id?: string
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          notification_id: string
          provider_id?: string | null
          recipient_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          center_id?: string
          created_at?: string
          first_attempt_at?: string | null
          id?: string
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          notification_id?: string
          provider_id?: string | null
          recipient_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_email_outbox_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_email_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_email_outbox_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_group_members: {
        Row: {
          group_id: string
          joined_at: string
          member_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          member_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "studio_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_group_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_groups: {
        Row: {
          capacity: number
          center_id: string
          created_at: string
          created_by: string
          id: string
          instructor_id: string
          name: string
          room_id: string
        }
        Insert: {
          capacity: number
          center_id: string
          created_at?: string
          created_by: string
          id?: string
          instructor_id: string
          name: string
          room_id: string
        }
        Update: {
          capacity?: number
          center_id?: string
          created_at?: string
          created_by?: string
          id?: string
          instructor_id?: string
          name?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_groups_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_groups_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_groups_room_id_center_id_fkey"
            columns: ["room_id", "center_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id", "center_id"]
          },
        ]
      }
      studio_policies: {
        Row: {
          cancellation_hours: number
          center_id: string
        }
        Insert: {
          cancellation_hours?: number
          center_id: string
        }
        Update: {
          cancellation_hours?: number
          center_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_policies_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: true
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_freezes: {
        Row: {
          actor_id: string
          created_at: string
          ends_on: string
          id: string
          note: string
          starts_on: string
          subscription_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          ends_on: string
          id?: string
          note: string
          starts_on: string
          subscription_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          note?: string
          starts_on?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_freezes_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_freezes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          catalog_id: string | null
          catalog_snapshot: Json | null
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
          policy_snapshot: Json | null
          starts_on: string
          status: Database["public"]["Enums"]["subscription_status"]
          type: Database["public"]["Enums"]["subscription_type"]
        }
        Insert: {
          amount?: number
          catalog_id?: string | null
          catalog_snapshot?: Json | null
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
          policy_snapshot?: Json | null
          starts_on?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          type: Database["public"]["Enums"]["subscription_type"]
        }
        Update: {
          amount?: number
          catalog_id?: string | null
          catalog_snapshot?: Json | null
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
          policy_snapshot?: Json | null
          starts_on?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          type?: Database["public"]["Enums"]["subscription_type"]
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "package_catalog"
            referencedColumns: ["id"]
          },
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
      assign_center_role: {
        Args: { p_center_id: string; p_profile_id: string; p_role: string }
        Returns: undefined
      }
      catalog_command: { Args: { p_data: Json }; Returns: Json }
      catalog_workspace: { Args: never; Returns: Json }
      claim_studio_emails: { Args: { p_centers?: string[] }; Returns: Json }
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
      crm_automation_command: { Args: { p_data: Json }; Returns: Json }
      crm_command: { Args: { p_data: Json }; Returns: Json }
      crm_intake_info: { Args: { p_slug: string }; Returns: Json }
      crm_intake_limited: {
        Args: { p_data: Json; p_ip_hash: string; p_slug: string }
        Returns: undefined
      }
      crm_intake_submit: {
        Args: { p_data: Json; p_slug: string }
        Returns: undefined
      }
      email_work_scope: { Args: never; Returns: string[] }
      finish_studio_email: {
        Args: {
          p_error?: string
          p_id: string
          p_lease: string
          p_provider?: string
          p_status: string
        }
        Returns: undefined
      }
      grant_center_admin: {
        Args: { p_center_id: string; p_profile_id: string }
        Returns: undefined
      }
      groups_command: { Args: { p_data: Json }; Returns: Json }
      lesson_command: { Args: { p_data: Json }; Returns: Json }
      link_member_account: {
        Args: { p_account_email: string; p_member_id: string }
        Returns: string
      }
      list_requestable_members: {
        Args: { p_center_id: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      lookup_center_account: {
        Args: { p_center_id: string; p_email: string }
        Returns: {
          email: string
          full_name: string
          linked_member_id: string
          profile_id: string
        }[]
      }
      my_lesson_roster: {
        Args: { p_lesson_id: string }
        Returns: {
          attended: boolean
          checked_in_at: string
          email: string
          full_name: string
          member_id: string
          phone: string
          source: string
        }[]
      }
      my_payment_balances: {
        Args: never
        Returns: {
          amount: number
          balance: number
          paid: number
          subscription_id: string
        }[]
      }
      my_scoped_roles: {
        Args: never
        Returns: {
          role: string
          scope_id: string
          scope_type: string
        }[]
      }
      my_subscription_terms: { Args: never; Returns: Json }
      my_teaching_lessons: {
        Args: never
        Returns: {
          center_id: string
          expected_attendees: number
          id: string
          starts_at: string
          status: Database["public"]["Enums"]["lesson_status"]
          title: string
          type: Database["public"]["Enums"]["lesson_type"]
        }[]
      }
      payments_command: { Args: { p_data: Json }; Returns: Json }
      pending_email_receipts: { Args: { p_centers?: string[] }; Returns: Json }
      planned_group_usage: {
        Args: { p_request_ids: string[] }
        Returns: {
          ends_at: string
          request_id: string
          starts_at: string
          title: string
        }[]
      }
      planning_command: { Args: { p_data: Json }; Returns: Json }
      planning_workspace: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      policy_cancel_exception: { Args: { p_data: Json }; Returns: Json }
      policy_command: { Args: { p_data: Json }; Returns: Json }
      policy_workspace: { Args: never; Returns: Json }
      progress_command: { Args: { p_data: Json }; Returns: Json }
      progress_workspace: { Args: never; Returns: Json }
      propose_session_request_alternative: {
        Args: {
          p_ends_at: string
          p_note: string
          p_request_id: string
          p_starts_at: string
        }
        Returns: undefined
      }
      registration_command: { Args: { p_data: Json }; Returns: Json }
      registration_workspace: { Args: never; Returns: Json }
      remove_center_role: {
        Args: { p_center_id: string; p_profile_id: string; p_role: string }
        Returns: undefined
      }
      respond_session_request_alternative: {
        Args: { p_accept: boolean; p_proposed_at: string; p_request_id: string }
        Returns: undefined
      }
      retry_studio_email: { Args: { p_id: string }; Returns: undefined }
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
      roadmap_command: {
        Args: { p_data: Json; p_module: string }
        Returns: Json
      }
      roadmap_workspace: {
        Args: { p_from?: string; p_module: string; p_to?: string }
        Returns: Json
      }
      studio_email_credentials: { Args: never; Returns: Json }
      studio_email_event: {
        Args: {
          p_event_id: string
          p_occurred_at: string
          p_provider: string
          p_type: string
        }
        Returns: undefined
      }
      studio_report: { Args: { p_from: string; p_to: string }; Returns: Json }
      studio_workspace: { Args: { p_module: string }; Returns: Json }
      unlink_member_account: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      verify_email_worker: { Args: { p_token: string }; Returns: boolean }
      waitlist_command: { Args: { p_data: Json }; Returns: Json }
      withdraw_session_request: {
        Args: { p_request_id: string }
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
