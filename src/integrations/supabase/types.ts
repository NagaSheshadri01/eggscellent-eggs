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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      manifests: {
        Row: {
          id: string
          delivery_date: string | null
          driver_id: string | null
          status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          delivery_date?: string | null
          driver_id?: string | null
          status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          delivery_date?: string | null
          driver_id?: string | null
          status?: string | null
          created_at?: string
        }
        Relationships: []
      }
      manifest_drops: {
        Row: {
          id: string
          manifest_id: string | null
          subscription_id: string | null
          user_id: string | null
          product_slug: string | null
          quantity: number | null
          escrow_amount: number | null
          status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          manifest_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
          product_slug?: string | null
          quantity?: number | null
          escrow_amount?: number | null
          status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          manifest_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
          product_slug?: string | null
          quantity?: number | null
          escrow_amount?: number | null
          status?: string | null
          created_at?: string
        }
        Relationships: [
            {
              foreignKeyName: "manifest_drops_address_id_fkey"
              columns: ["address_id"]
              isOneToOne: false
              referencedRelation: "addresses"
              referencedColumns: ["id"]
            },
            {
              foreignKeyName: "manifest_drops_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "manifests"
            referencedColumns: ["id"]
          }
        ]
      }
      one_time_orders: {
        Row: {
          id: string
          display_id: string
          user_id: string
          delivery_address_id: string | null
          total_amount: number
          status: string
          payment_method: string
          payment_status: string
          delivery_partner_id: string | null
          delivery_slot_key: string | null
          delivery_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          display_id: string
          user_id: string
          delivery_address_id?: string | null
          total_amount: number
          status?: string
          payment_method?: string
          payment_status?: string
          delivery_partner_id?: string | null
          delivery_slot_key?: string | null
          delivery_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_id?: string
          user_id?: string
          delivery_address_id?: string | null
          total_amount?: number
          status?: string
          payment_method?: string
          payment_status?: string
          delivery_partner_id?: string | null
          delivery_slot_key?: string | null
          delivery_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_time_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      one_time_order_items: {
        Row: {
          id: string
          order_id: string
          product_slug: string
          quantity: number
          price: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_slug: string
          quantity: number
          price: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_slug?: string
          quantity?: number
          price?: number
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "one_time_orders"
            referencedColumns: ["id"]
          }
        ]
      },
      subscription_items: {
        Row: {
          id: string
          subscription_id: string
          product_slug: string
          quantity: number
          frequency: string
          selected_days: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          subscription_id: string
          product_slug: string
          quantity: number
          frequency?: string
          selected_days?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          subscription_id?: string
          product_slug?: string
          quantity?: number
          frequency?: string
          selected_days?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          }
        ]
      },,
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      deduct_wallet: {
        Args: { uid: string; amount: number }
        Returns: { success: boolean; new_balance: number }
      }

      calculate_order_delivery_fee: {
        Args: { p_address_id: string }
        Returns: number
      }
      compute_next_delivery_date: {
        Args: { _frequency: string; _from: string }
        Returns: string
      }
      email_exists: { Args: { _email: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_partner: { Args: { _uid: string }; Returns: boolean }
      partner_update_order_status: {
        Args: { _new_status: string; _order_id: string }
        Returns: undefined
      }
      phone_exists: { Args: { _phone: string }; Returns: boolean }
    }
    Enums: {
      app_role: "customer" | "admin" | "partner"
      discount_type: "percent" | "flat"
      order_status:
        | "placed"
        | "confirmed"
        | "packed"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payment_method: "upi" | "cod" | "card"
      payment_status: "pending" | "paid" | "failed" | "refunded"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["customer", "admin", "partner"],
      discount_type: ["percent", "flat"],
      order_status: [
        "placed",
        "confirmed",
        "packed",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      payment_method: ["upi", "cod", "card"],
      payment_status: ["pending", "paid", "failed", "refunded"],
    },
  },
} as const
