// Generated from the StudioSaaS Supabase project (public schema).
// Regenerate with: npx supabase gen types typescript --project-id ysplylnwdfwizmuxvcqg > lib/supabase/database.types.ts

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
          checked_in_at: string
          center_id: string
          checked_in_by: string | null
          created_at: string
          id: string
          lesson_id: string
          member_id: string
          notes: string | null
        }
        Insert: {
          attended?: boolean
          checked_in_at?: string
          center_id?: string
          checked_in_by?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          member_id: string
          notes?: string | null
        }
        Update: {
          center_id?: string
          attended?: boolean
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
            foreignKeyName: "attendance_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
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
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          center_id: string
          id: string
          lesson_id: string | null
          member_id: string
          note: string | null
          reason: string
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          center_id?: string
          id?: string
          lesson_id?: string | null
          member_id: string
          note?: string | null
          reason: string
          subscription_id: string
        }
        Update: {
          center_id?: string
          amount?: number
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
            foreignKeyName: "credit_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
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
      organizations: {
        Row: { id: string; name: string; slug: string; is_active: boolean; created_at: string; created_by: string | null }
        Insert: { id?: string; name: string; slug: string; is_active?: boolean; created_at?: string; created_by?: string | null }
        Update: { id?: string; name?: string; slug?: string; is_active?: boolean; created_at?: string; created_by?: string | null }
        Relationships: [{ foreignKeyName: "organizations_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      center_admins: {
        Row: { center_id: string; profile_id: string; created_at: string }
        Insert: { center_id: string; profile_id: string; created_at?: string }
        Update: { center_id?: string; profile_id?: string; created_at?: string }
        Relationships: []
      }
      centers: {
        Row: { id: string; organization_id: string; name: string; address: string | null; is_active: boolean; created_at: string }
        Insert: { id?: string; organization_id: string; name: string; address?: string | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; organization_id?: string; name?: string; address?: string | null; is_active?: boolean; created_at?: string }
        Relationships: [{ foreignKeyName: "centers_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }]
      }
      rooms: {
        Row: { id: string; center_id: string; name: string; capacity: number; is_active: boolean; created_at: string }
        Insert: { id?: string; center_id: string; name: string; capacity?: number; is_active?: boolean; created_at?: string }
        Update: { id?: string; center_id?: string; name?: string; capacity?: number; is_active?: boolean; created_at?: string }
        Relationships: [{ foreignKeyName: "rooms_center_id_fkey"; columns: ["center_id"]; isOneToOne: false; referencedRelation: "centers"; referencedColumns: ["id"] }]
      }
      session_requests: {
        Row: {
          id: string; organization_id: string; center_id: string; room_id: string; instructor_id: string; requested_by: string;
          session_type: Database["public"]["Enums"]["lesson_type"]; title: string; private_member_id: string | null;
          starts_at: string; ends_at: string; expected_attendees: number; notes: string | null;
          status: string; reviewed_by: string | null; reviewed_at: string | null; review_note: string | null;
          approved_lesson_id: string | null; created_at: string;
        }
        Insert: {
          id?: string; organization_id: string; center_id: string; room_id: string; instructor_id: string; requested_by: string;
          session_type: Database["public"]["Enums"]["lesson_type"]; title: string; private_member_id?: string | null;
          starts_at: string; ends_at: string; expected_attendees?: number; notes?: string | null;
          status?: string; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null;
          approved_lesson_id?: string | null; created_at?: string;
        }
        Update: {
          id?: string; organization_id?: string; center_id?: string; room_id?: string; instructor_id?: string; requested_by?: string;
          session_type?: Database["public"]["Enums"]["lesson_type"]; title?: string; private_member_id?: string | null;
          starts_at?: string; ends_at?: string; expected_attendees?: number; notes?: string | null;
          status?: string; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null;
          approved_lesson_id?: string | null; created_at?: string;
        }
        Relationships: [
          { foreignKeyName: "session_requests_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "session_requests_center_id_fkey"; columns: ["center_id"]; isOneToOne: false; referencedRelation: "centers"; referencedColumns: ["id"] },
          { foreignKeyName: "session_requests_room_id_fkey"; columns: ["room_id"]; isOneToOne: false; referencedRelation: "rooms"; referencedColumns: ["id"] },
          { foreignKeyName: "session_requests_instructor_id_fkey"; columns: ["instructor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "session_requests_requested_by_fkey"; columns: ["requested_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "session_requests_private_member_id_fkey"; columns: ["private_member_id"]; isOneToOne: false; referencedRelation: "members"; referencedColumns: ["id"] },
          { foreignKeyName: "session_requests_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "session_requests_approved_lesson_id_fkey"; columns: ["approved_lesson_id"]; isOneToOne: false; referencedRelation: "lessons"; referencedColumns: ["id"] }
        ]
      }
      lessons: {
        Row: {
          center_id: string
          room_id: string | null
          expected_attendees: number | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          instructor_id: string | null
          notes: string | null
          private_member_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["lesson_status"]
          title: string
          type: Database["public"]["Enums"]["lesson_type"]
          updated_at: string
        }
        Insert: {
          center_id: string
          room_id?: string | null
          expected_attendees?: number | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          instructor_id?: string | null
          notes?: string | null
          private_member_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["lesson_status"]
          title: string
          type: Database["public"]["Enums"]["lesson_type"]
          updated_at?: string
        }
        Update: {
          center_id?: string
          room_id?: string | null
          expected_attendees?: number | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          instructor_id?: string | null
          notes?: string | null
          private_member_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["lesson_status"]
          title?: string
          type?: Database["public"]["Enums"]["lesson_type"]
          updated_at?: string
        }
        Relationships: [
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
            foreignKeyName: "lessons_private_member_id_fkey"
            columns: ["private_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
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
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
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
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          center_id: string
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
          created_at?: string
          center_id?: string
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
          center_id?: string
          amount?: number
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
            foreignKeyName: "subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
      create_center: { Args: { p_organization_id: string; p_name: string; p_address?: string | null }; Returns: string }
      grant_center_admin: { Args: { p_center_id: string; p_profile_id: string }; Returns: undefined }
      revoke_center_admin: { Args: { p_center_id: string; p_profile_id: string }; Returns: undefined }
      list_requestable_members: { Args: { p_center_id: string }; Returns: { id: string; full_name: string }[] }
      create_session_request: { Args: { p_center_id: string; p_room_id: string; p_session_type: Database["public"]["Enums"]["lesson_type"]; p_title: string; p_private_member_id: string | null; p_starts_at: string; p_ends_at: string; p_expected_attendees: number; p_notes: string | null; p_instructor_id?: string | null }; Returns: string }
      review_session_request: { Args: { p_request_id: string; p_approve: boolean; p_review_note?: string | null }; Returns: string | null }
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
