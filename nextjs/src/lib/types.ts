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
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ip_allocations: {
        Row: {
          allocated_at: string | null
          assigned_to: string | null
          assignee_user_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: number
          ip_id: number | null
          notes: string | null
          owner: string | null
          owner_id: string | null
          released_at: string | null
          state: string | null
        }
        Insert: {
          allocated_at?: string | null
          assigned_to?: string | null
          assignee_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: never
          ip_id?: number | null
          notes?: string | null
          owner?: string | null
          owner_id?: string | null
          released_at?: string | null
          state?: string | null
        }
        Update: {
          allocated_at?: string | null
          assigned_to?: string | null
          assignee_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: never
          ip_id?: number | null
          notes?: string | null
          owner?: string | null
          owner_id?: string | null
          released_at?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ip_allocations_ip_id_fkey"
            columns: ["ip_id"]
            isOneToOne: false
            referencedRelation: "ip_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_assets: {
        Row: {
          asn: string | null
          auth_password: string | null
          auth_username: string | null
          bandwidth_total: number | null
          bandwidth_used: number | null
          connect_ip: string | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          expires_at: string | null
          http_port: number | null
          https_port: number | null
          id: number
          ip: string
          ip_version: string | null
          isp_name: string | null
          last_ip: string | null
          last_latency_ms: number | null
          last_speed_kbps: number | null
          last_sync_at: string | null
          last_tested_at: string | null
          metadata: Json | null
          network_type: string | null
          order_id: string | null
          owner: string | null
          owner_id: string | null
          provider: string
          provider_id: string | null
          proxy_type: string | null
          public_ip: string | null
          remark: string | null
          routes: Json | null
          socks5_port: number | null
          source_raw: Json | null
          source_url: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          asn?: string | null
          auth_password?: string | null
          auth_username?: string | null
          bandwidth_total?: number | null
          bandwidth_used?: number | null
          connect_ip?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          http_port?: number | null
          https_port?: number | null
          id?: never
          ip: string
          ip_version?: string | null
          isp_name?: string | null
          last_ip?: string | null
          last_latency_ms?: number | null
          last_speed_kbps?: number | null
          last_sync_at?: string | null
          last_tested_at?: string | null
          metadata?: Json | null
          network_type?: string | null
          order_id?: string | null
          owner?: string | null
          owner_id?: string | null
          provider: string
          provider_id?: string | null
          proxy_type?: string | null
          public_ip?: string | null
          remark?: string | null
          routes?: Json | null
          socks5_port?: number | null
          source_raw?: Json | null
          source_url?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          asn?: string | null
          auth_password?: string | null
          auth_username?: string | null
          bandwidth_total?: number | null
          bandwidth_used?: number | null
          connect_ip?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          http_port?: number | null
          https_port?: number | null
          id?: never
          ip?: string
          ip_version?: string | null
          isp_name?: string | null
          last_ip?: string | null
          last_latency_ms?: number | null
          last_speed_kbps?: number | null
          last_sync_at?: string | null
          last_tested_at?: string | null
          metadata?: Json | null
          network_type?: string | null
          order_id?: string | null
          owner?: string | null
          owner_id?: string | null
          provider?: string
          provider_id?: string | null
          proxy_type?: string | null
          public_ip?: string | null
          remark?: string | null
          routes?: Json | null
          socks5_port?: number | null
          source_raw?: Json | null
          source_url?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: []
      }
      module_permissions: {
        Row: {
          can_manage: boolean | null
          can_menu: boolean | null
          can_read: boolean | null
          can_write: boolean | null
          created_at: string | null
          id: number
          module: string
          user_id: string | null
        }
        Insert: {
          can_manage?: boolean | null
          can_menu?: boolean | null
          can_read?: boolean | null
          can_write?: boolean | null
          created_at?: string | null
          id?: never
          module: string
          user_id?: string | null
        }
        Update: {
          can_manage?: boolean | null
          can_menu?: boolean | null
          can_read?: boolean | null
          can_write?: boolean | null
          created_at?: string | null
          id?: never
          module?: string
          user_id?: string | null
        }
        Relationships: []
      }
      resource_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          id: string
          resource_id: number
          resource_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          resource_id: number
          resource_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          resource_id?: number
          resource_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_configs: {
        Row: {
          created_at: string | null
          description: string | null
          group: string | null
          id: string
          is_secret: boolean | null
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          group?: string | null
          id?: string
          is_secret?: boolean | null
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          group?: string | null
          id?: string
          is_secret?: boolean | null
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      todo_list: {
        Row: {
          created_at: string
          description: string | null
          done: boolean
          done_at: string | null
          id: number
          owner: string
          title: string
          urgent: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          done?: boolean
          done_at?: string | null
          id?: number
          owner: string
          title: string
          urgent?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          done?: boolean
          done_at?: string | null
          id?: number
          owner?: string
          title?: string
          urgent?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      vps_allocations: {
        Row: {
          allocated_at: string | null
          assigned_to: string | null
          created_at: string | null
          id: number
          notes: string | null
          owner: string | null
          released_at: string | null
          state: string | null
          vps_id: string | null
        }
        Insert: {
          allocated_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          id?: never
          notes?: string | null
          owner?: string | null
          released_at?: string | null
          state?: string | null
          vps_id?: string | null
        }
        Update: {
          allocated_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          id?: never
          notes?: string | null
          owner?: string | null
          released_at?: string | null
          state?: string | null
          vps_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vps_allocations_vps_id_fkey"
            columns: ["vps_id"]
            isOneToOne: false
            referencedRelation: "vps_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      vps_instances: {
        Row: {
          account: string
          billing_remaining: number | null
          billing_used: number | null
          created_at: string | null
          external_ip: string | null
          id: string
          instance_id: string
          internal_ip: string | null
          last_updated: string | null
          machine_type: string | null
          name: string
          status: string
          traffic_received: number | null
          traffic_sent: number | null
          zone: string
        }
        Insert: {
          account: string
          billing_remaining?: number | null
          billing_used?: number | null
          created_at?: string | null
          external_ip?: string | null
          id?: string
          instance_id: string
          internal_ip?: string | null
          last_updated?: string | null
          machine_type?: string | null
          name: string
          status: string
          traffic_received?: number | null
          traffic_sent?: number | null
          zone: string
        }
        Update: {
          account?: string
          billing_remaining?: number | null
          billing_used?: number | null
          created_at?: string | null
          external_ip?: string | null
          id?: string
          instance_id?: string
          internal_ip?: string | null
          last_updated?: string | null
          machine_type?: string | null
          name?: string
          status?: string
          traffic_received?: number | null
          traffic_sent?: number | null
          zone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_module_permission: {
        Args: { m: string; p: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
