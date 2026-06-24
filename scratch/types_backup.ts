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
      addresses: {
        Row: {
          address_name: string | null
          address_phone: string | null
          area_locality: string | null
          address_tag: string | null
          address_line_1: string
          address_line_2: string | null
          city: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          lat: number | null
          lng: number | null
          phone: string
          pincode: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_name?: string | null
          address_phone?: string | null
          area_locality?: string | null
          address_tag?: string | null
          address_line_1: string
          address_line_2?: string | null
          city: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          lat?: number | null
          lng?: number | null
          phone: string
          pincode: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_name?: string | null
          address_phone?: string | null
          area_locality?: string | null
          address_tag?: string | null
          address_line_1?: string
          address_line_2?: string | null
          city?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          lat?: number | null
          lng?: number | null
          phone?: string
          pincode?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      content_blocks: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          metadata: Json | null
          subtitle: string | null
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          metadata?: Json | null
          subtitle?: string | null
          title?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          metadata?: Json | null
          subtitle?: string | null
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expiry: string | null
          id: string
          min_order_amount: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expiry?: string | null
          id?: string
          min_order_amount?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expiry?: string | null
          id?: string
          min_order_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_config: {
        Row: {
          id: number
          store_latitude: number
          store_longitude: number
        }
        Insert: {
          id?: number
          store_latitude?: number
          store_longitude?: number
        }
        Update: {
          id?: number
          store_latitude?: number
          store_longitude?: number
        }
        Relationships: []
      }
      delivery_pricing_tiers: {
        Row: {
          id: string
          max_distance_km: number
          delivery_fee: number
          created_at: string
        }
        Insert: {
          id?: string
          max_distance_km: number
          delivery_fee: number
          created_at?: string
        }
        Update: {
          id?: string
          max_distance_km?: number
          delivery_fee?: number
          created_at?: string
        }
        Relationships: []
      }
      delivery_partners: {
        Row: {
          aadhaar_url: string | null
          active: boolean
          assigned_areas: string[]
          assigned_slot_ids: string[]
          availability: Json | null
          city: string | null
          created_at: string
          email: string | null
          experience_years: number | null
          full_name: string
          id: string
          license_url: string | null
          notes: string | null
          phone: string
          pincode: string | null
          status: string
          updated_at: string
          user_id: string | null
          vehicle_type: string | null
        }
        Insert: {
          aadhaar_url?: string | null
          active?: boolean
          assigned_areas?: string[]
          assigned_slot_ids?: string[]
          availability?: Json | null
          city?: string | null
          created_at?: string
          email?: string | null
          experience_years?: number | null
          full_name: string
          id?: string
          license_url?: string | null
          notes?: string | null
          phone: string
          pincode?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vehicle_type?: string | null
        }
        Update: {
          aadhaar_url?: string | null
          active?: boolean
          assigned_areas?: string[]
          assigned_slot_ids?: string[]
          availability?: Json | null
          city?: string | null
          created_at?: string
          email?: string | null
          experience_years?: number | null
          full_name?: string
          id?: string
          license_url?: string | null
          notes?: string | null
          phone?: string
          pincode?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      delivery_slots: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          end_time: string
          id: string
          label: string
          start_time: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          end_time: string
          id?: string
          label: string
          start_time: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          end_time?: string
          id?: string
          label?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      faq: {
        Row: {
          active: boolean
          answer: string
          category: string | null
          created_at: string
          display_order: number
          id: string
          question: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          answer: string
          category?: string | null
          created_at?: string
          display_order?: number
          id?: string
          question: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          answer?: string
          category?: string | null
          created_at?: string
          display_order?: number
          id?: string
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price: number
          product_id: string | null
          product_image: string | null
          product_name: string
          quantity: number
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price: number
          product_id?: string | null
          product_image?: string | null
          product_name: string
          quantity: number
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          quantity?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          address_snapshot: Json | null
          coupon_code: string | null
          created_at: string
          delivered_at: string | null
          delivery_fee: number
          delivery_partner_id: string | null
          delivery_slot: string | null
          discount: number
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          order_status: Database["public"]["Enums"]["order_status"]
          out_for_delivery_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          picked_up_at: string | null
          pincode: string | null
          slot_id: string | null
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address_id?: string | null
          address_snapshot?: Json | null
          coupon_code?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          delivery_partner_id?: string | null
          delivery_slot?: string | null
          discount?: number
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          order_status?: Database["public"]["Enums"]["order_status"]
          out_for_delivery_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          pincode?: string | null
          slot_id?: string | null
          subtotal: number
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address_id?: string | null
          address_snapshot?: Json | null
          coupon_code?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          delivery_partner_id?: string | null
          delivery_slot?: string | null
          discount?: number
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          order_status?: Database["public"]["Enums"]["order_status"]
          out_for_delivery_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          picked_up_at?: string | null
          pincode?: string | null
          slot_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_partner_id_fkey"
            columns: ["delivery_partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otps: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          used?: boolean
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          benefit: string | null
          category: string | null
          created_at: string
          description: string | null
          discounted_price: number
          display_order: number
          id: string
          image_url: string | null
          images: string[]
          name: string
          nutrition_info: Json | null
          original_price: number
          slug: string
          stock_quantity: number
          tags: string[]
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefit?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          discounted_price: number
          display_order?: number
          id?: string
          image_url?: string | null
          images?: string[]
          name: string
          nutrition_info?: Json | null
          original_price: number
          slug: string
          stock_quantity?: number
          tags?: string[]
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefit?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          discounted_price?: number
          display_order?: number
          id?: string
          image_url?: string | null
          images?: string[]
          name?: string
          nutrition_info?: Json | null
          original_price?: number
          slug?: string
          stock_quantity?: number
          tags?: string[]
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      serviceable_pincodes: {
        Row: {
          active: boolean
          area_name: string | null
          created_at: string
          delivery_fee_override: number | null
          id: string
          pincode: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          area_name?: string | null
          created_at?: string
          delivery_fee_override?: number | null
          id?: string
          pincode: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          area_name?: string | null
          created_at?: string
          delivery_fee_override?: number | null
          id?: string
          pincode?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      subscription_orders: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          scheduled_for: string
          status: string
          subscription_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          scheduled_for: string
          status?: string
          subscription_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          scheduled_for?: string
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          id: string
          title: string
          description: string | null
          product_slug: string
          quantity: number
          frequency_type: string
          custom_days: number[] | null
          price_per_delivery: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          product_slug: string
          quantity?: number
          frequency_type: string
          custom_days?: number[] | null
          price_per_delivery: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          product_slug?: string
          quantity?: number
          frequency_type?: string
          custom_days?: number[] | null
          price_per_delivery?: number
          is_active?: boolean
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          address_id: string | null
          created_at: string
          end_date: string | null
          frequency: string
          id: string
          next_delivery_date: string
          payment_method: string
          plan_id: string | null
          product_id: string
          product_slug: string
          quantity: number
          slot_id: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_id?: string | null
          created_at?: string
          end_date?: string | null
          frequency: string
          id?: string
          next_delivery_date: string
          payment_method?: string
          plan_id?: string | null
          product_id: string
          product_slug?: string
          quantity?: number
          slot_id?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_id?: string | null
          created_at?: string
          end_date?: string | null
          frequency?: string
          id?: string
          next_delivery_date?: string
          payment_method?: string
          plan_id?: string | null
          product_id?: string
          product_slug?: string
          quantity?: number
          slot_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
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
