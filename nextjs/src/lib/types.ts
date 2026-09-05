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
  public: {
    Tables: {
      account_service_status: {
        Row: {
          account_id: string | null
          checked_at: string
          companion_project: string | null
          detail: string | null
          id: string
          rate_limit_until: string | null
          service: string
          status: string | null
          sub2api_acct: number | null
        }
        Insert: {
          account_id?: string | null
          checked_at?: string
          companion_project?: string | null
          detail?: string | null
          id?: string
          rate_limit_until?: string | null
          service: string
          status?: string | null
          sub2api_acct?: number | null
        }
        Update: {
          account_id?: string | null
          checked_at?: string
          companion_project?: string | null
          detail?: string | null
          id?: string
          rate_limit_until?: string | null
          service?: string
          status?: string | null
          sub2api_acct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "account_service_status_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          adspower_profile: string | null
          creds_ref: string | null
          email: string
          gcp_project: string | null
          id: string
          kind: string | null
          notes: string | null
          role: string | null
          service_account: string | null
          synced_at: string
          vps: string[] | null
        }
        Insert: {
          adspower_profile?: string | null
          creds_ref?: string | null
          email: string
          gcp_project?: string | null
          id: string
          kind?: string | null
          notes?: string | null
          role?: string | null
          service_account?: string | null
          synced_at?: string
          vps?: string[] | null
        }
        Update: {
          adspower_profile?: string | null
          creds_ref?: string | null
          email?: string
          gcp_project?: string | null
          id?: string
          kind?: string | null
          notes?: string | null
          role?: string | null
          service_account?: string | null
          synced_at?: string
          vps?: string[] | null
        }
        Relationships: []
      }
      agent_events: {
        Row: {
          agent_time: string
          batch_id: string
          created_at: string
          event_type: string
          id: string
          instance_id: string
          level: string
          payload: Json | null
          source: string
        }
        Insert: {
          agent_time: string
          batch_id: string
          created_at?: string
          event_type: string
          id?: string
          instance_id: string
          level?: string
          payload?: Json | null
          source: string
        }
        Update: {
          agent_time?: string
          batch_id?: string
          created_at?: string
          event_type?: string
          id?: string
          instance_id?: string
          level?: string
          payload?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "vps_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tokens: {
        Row: {
          id: string
          instance_id: string
          issued_at: string
          last_used_at: string | null
          revoked_at: string | null
          status: string
          token_hash: string
        }
        Insert: {
          id?: string
          instance_id: string
          issued_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
          status?: string
          token_hash: string
        }
        Update: {
          id?: string
          instance_id?: string
          issued_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tokens_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "vps_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acked_at: string | null
          acked_by: string | null
          alert_type: string
          content: string | null
          created_at: string
          id: string
          resource_id: string
          resource_type: string
          severity: string
          status: string
          title: string
        }
        Insert: {
          acked_at?: string | null
          acked_by?: string | null
          alert_type: string
          content?: string | null
          created_at?: string
          id?: string
          resource_id: string
          resource_type: string
          severity: string
          status?: string
          title: string
        }
        Update: {
          acked_at?: string | null
          acked_by?: string | null
          alert_type?: string
          content?: string | null
          created_at?: string
          id?: string
          resource_id?: string
          resource_type?: string
          severity?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      auto_push_rules: {
        Row: {
          created_at: string | null
          event_types: string[]
          id: number
          is_enabled: boolean | null
          priority_filter: string | null
          time_window: Json | null
          updated_at: string | null
          user_key: string
        }
        Insert: {
          created_at?: string | null
          event_types: string[]
          id?: number
          is_enabled?: boolean | null
          priority_filter?: string | null
          time_window?: Json | null
          updated_at?: string | null
          user_key: string
        }
        Update: {
          created_at?: string | null
          event_types?: string[]
          id?: number
          is_enabled?: boolean | null
          priority_filter?: string | null
          time_window?: Json | null
          updated_at?: string | null
          user_key?: string
        }
        Relationships: []
      }
      billing_alerts: {
        Row: {
          account_id: string | null
          alert_type: string
          current_value: number | null
          id: number
          message: string | null
          notified_at: string | null
          notified_via: string | null
          threshold: number | null
        }
        Insert: {
          account_id?: string | null
          alert_type: string
          current_value?: number | null
          id?: number
          message?: string | null
          notified_at?: string | null
          notified_via?: string | null
          threshold?: number | null
        }
        Update: {
          account_id?: string | null
          alert_type?: string
          current_value?: number | null
          id?: number
          message?: string | null
          notified_at?: string | null
          notified_via?: string | null
          threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_alerts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gcp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_snapshots: {
        Row: {
          account_id: string | null
          cost_30d: number | null
          created_at: string | null
          credit_balance: number | null
          credit_total: number | null
          error_msg: string | null
          has_credit: boolean | null
          id: number
          raw_cost_text: string | null
          raw_credit_text: string | null
          screenshot_path: string | null
          snapshot_date: string
          source: string | null
          success: boolean | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          cost_30d?: number | null
          created_at?: string | null
          credit_balance?: number | null
          credit_total?: number | null
          error_msg?: string | null
          has_credit?: boolean | null
          id?: number
          raw_cost_text?: string | null
          raw_credit_text?: string | null
          screenshot_path?: string | null
          snapshot_date?: string
          source?: string | null
          success?: boolean | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          cost_30d?: number | null
          created_at?: string | null
          credit_balance?: number | null
          credit_total?: number | null
          error_msg?: string | null
          has_credit?: boolean | null
          id?: number
          raw_cost_text?: string | null
          raw_credit_text?: string | null
          screenshot_path?: string | null
          snapshot_date?: string
          source?: string | null
          success?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gcp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_messages: {
        Row: {
          created_at: string | null
          custom_content: string | null
          deleted_at: string | null
          event_id: string
          event_type: string
          id: number
          is_read: boolean | null
          notes: string | null
          payload: Json
          push_status: string | null
          received_at: string
          source: string
          template_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_content?: string | null
          deleted_at?: string | null
          event_id: string
          event_type: string
          id?: never
          is_read?: boolean | null
          notes?: string | null
          payload: Json
          push_status?: string | null
          received_at: string
          source: string
          template_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_content?: string | null
          deleted_at?: string | null
          event_id?: string
          event_type?: string
          id?: never
          is_read?: boolean | null
          notes?: string | null
          payload?: Json
          push_status?: string | null
          received_at?: string
          source?: string
          template_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      gcp_accounts: {
        Row: {
          billing_id: string | null
          created_at: string | null
          gcloud_configured: boolean | null
          gmail_email: string
          id: string
          is_active: boolean | null
          label: string
          notes: string | null
          profile_cloak: string | null
          profile_fox: string | null
          project_id: string | null
          proxy_url: string | null
          updated_at: string | null
        }
        Insert: {
          billing_id?: string | null
          created_at?: string | null
          gcloud_configured?: boolean | null
          gmail_email: string
          id: string
          is_active?: boolean | null
          label: string
          notes?: string | null
          profile_cloak?: string | null
          profile_fox?: string | null
          project_id?: string | null
          proxy_url?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_id?: string | null
          created_at?: string | null
          gcloud_configured?: boolean | null
          gmail_email?: string
          id?: string
          is_active?: boolean | null
          label?: string
          notes?: string | null
          profile_cloak?: string | null
          profile_fox?: string | null
          project_id?: string | null
          proxy_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gcp_instance_policies: {
        Row: {
          allowed_regions: Json
          disk_type: string
          id: string
          is_active: boolean
          machine_type: string
          max_disk_gb: number
          network_tier: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_regions?: Json
          disk_type?: string
          id?: string
          is_active?: boolean
          machine_type?: string
          max_disk_gb?: number
          network_tier?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_regions?: Json
          disk_type?: string
          id?: string
          is_active?: boolean
          machine_type?: string
          max_disk_gb?: number
          network_tier?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ip_allocations: {
        Row: {
          allocated_at: string | null
          assigned_to: string | null
          assignee_user_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          display_name: string | null
          id: number
          ip_id: number | null
          notes: string | null
          owner: string | null
          owner_id: string | null
          released_at: string | null
          state: string | null
          terminate_at_period_end: boolean
        }
        Insert: {
          allocated_at?: string | null
          assigned_to?: string | null
          assignee_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string | null
          id?: never
          ip_id?: number | null
          notes?: string | null
          owner?: string | null
          owner_id?: string | null
          released_at?: string | null
          state?: string | null
          terminate_at_period_end?: boolean
        }
        Update: {
          allocated_at?: string | null
          assigned_to?: string | null
          assignee_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string | null
          id?: never
          ip_id?: number | null
          notes?: string | null
          owner?: string | null
          owner_id?: string | null
          released_at?: string | null
          state?: string | null
          terminate_at_period_end?: boolean
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
          ip: string | null
          ip_version: string | null
          isp_name: string | null
          label: string | null
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
          terminate_at_period_end: boolean
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
          ip?: string | null
          ip_version?: string | null
          isp_name?: string | null
          label?: string | null
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
          terminate_at_period_end?: boolean
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
          ip?: string | null
          ip_version?: string | null
          isp_name?: string | null
          label?: string | null
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
          terminate_at_period_end?: boolean
          type?: string | null
        }
        Relationships: []
      }
      ip_latency_matrix: {
        Row: {
          id: number
          ip: string
          latency_ms: number | null
          source_node: string
          tested_at: string
        }
        Insert: {
          id?: number
          ip: string
          latency_ms?: number | null
          source_node: string
          tested_at?: string
        }
        Update: {
          id?: number
          ip?: string
          latency_ms?: number | null
          source_node?: string
          tested_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          channels: string[]
          content_template: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          title_template: string | null
          type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          channels: string[]
          content_template: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          title_template?: string | null
          type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          channels?: string[]
          content_template?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          title_template?: string | null
          type?: string
          updated_at?: string | null
          variables?: Json | null
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
      node_clients: {
        Row: {
          created_at: string
          created_by: string | null
          cred_ref: string
          email: string
          enabled: boolean
          expires_at: string | null
          id: string
          ip_limit: number | null
          label: string | null
          last_reconcile_error: string | null
          last_reconciled_at: string | null
          node_id: string
          outbound_config: Json | null
          outbound_id: string | null
          outbound_tag: string | null
          over_action: string
          period_started_at: string | null
          protocol: string
          quota_bytes: number | null
          quota_period: string
          subscribe_token: string | null
          updated_at: string
          used_bytes: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cred_ref: string
          email: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          ip_limit?: number | null
          label?: string | null
          last_reconcile_error?: string | null
          last_reconciled_at?: string | null
          node_id: string
          outbound_config?: Json | null
          outbound_id?: string | null
          outbound_tag?: string | null
          over_action?: string
          period_started_at?: string | null
          protocol?: string
          quota_bytes?: number | null
          quota_period?: string
          subscribe_token?: string | null
          updated_at?: string
          used_bytes?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cred_ref?: string
          email?: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          ip_limit?: number | null
          label?: string | null
          last_reconcile_error?: string | null
          last_reconciled_at?: string | null
          node_id?: string
          outbound_config?: Json | null
          outbound_id?: string | null
          outbound_tag?: string | null
          over_action?: string
          period_started_at?: string | null
          protocol?: string
          quota_bytes?: number | null
          quota_period?: string
          subscribe_token?: string | null
          updated_at?: string
          used_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "node_clients_outbound_id_fkey"
            columns: ["outbound_id"]
            isOneToOne: false
            referencedRelation: "node_outbounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_clients_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      node_deployments: {
        Row: {
          config_hash: string | null
          created_at: string | null
          deploy_mode: string
          error_message: string | null
          finished_at: string | null
          id: string
          node_id: string
          profile_id: string | null
          rendered_config: Json | null
          request_payload: Json | null
          response_payload: Json | null
          retry_count: number | null
          rollback_to_id: string | null
          scheduled_at: string
          started_at: string | null
          status: string
          task_type: string
          updated_at: string | null
        }
        Insert: {
          config_hash?: string | null
          created_at?: string | null
          deploy_mode?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          node_id: string
          profile_id?: string | null
          rendered_config?: Json | null
          request_payload?: Json | null
          response_payload?: Json | null
          retry_count?: number | null
          rollback_to_id?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          task_type: string
          updated_at?: string | null
        }
        Update: {
          config_hash?: string | null
          created_at?: string | null
          deploy_mode?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          node_id?: string
          profile_id?: string | null
          rendered_config?: Json | null
          request_payload?: Json | null
          response_payload?: Json | null
          retry_count?: number | null
          rollback_to_id?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          task_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "node_deployments_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_deployments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "node_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_deployments_rollback_to_id_fkey"
            columns: ["rollback_to_id"]
            isOneToOne: false
            referencedRelation: "node_deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      node_profiles: {
        Row: {
          config_template: Json
          created_at: string | null
          created_by: string | null
          enabled: boolean
          engine: string
          id: string
          inbound_port: number | null
          name: string
          transport_protocol: string
          updated_at: string | null
        }
        Insert: {
          config_template?: Json
          created_at?: string | null
          created_by?: string | null
          enabled?: boolean
          engine?: string
          id?: string
          inbound_port?: number | null
          name: string
          transport_protocol?: string
          updated_at?: string | null
        }
        Update: {
          config_template?: Json
          created_at?: string | null
          created_by?: string | null
          enabled?: boolean
          engine?: string
          id?: string
          inbound_port?: number | null
          name?: string
          transport_protocol?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      node_traffic_stat: {
        Row: {
          bucket_hour: string
          downlink_bytes: number
          email: string
          node_id: string
          updated_at: string
          uplink_bytes: number
        }
        Insert: {
          bucket_hour: string
          downlink_bytes?: number
          email?: string
          node_id: string
          updated_at?: string
          uplink_bytes?: number
        }
        Update: {
          bucket_hour?: string
          downlink_bytes?: number
          email?: string
          node_id?: string
          updated_at?: string
          uplink_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "node_traffic_stat_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      nodes: {
        Row: {
          config_hash: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          expires_at: string | null
          id: string
          inbound_tag: string | null
          ip_resource_ids: string[] | null
          last_deployed_at: string | null
          name: string
          node_quota_bytes: number | null
          order_id: string | null
          outbound_strategy: string
          port: number
          profile_id: string | null
          protocol: string
          public_ip: string | null
          remark: string | null
          status: string | null
          subscribe_token: string | null
          updated_at: string | null
          user_id: string | null
          vps_instance_id: string | null
        }
        Insert: {
          config_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          inbound_tag?: string | null
          ip_resource_ids?: string[] | null
          last_deployed_at?: string | null
          name: string
          node_quota_bytes?: number | null
          order_id?: string | null
          outbound_strategy?: string
          port: number
          profile_id?: string | null
          protocol: string
          public_ip?: string | null
          remark?: string | null
          status?: string | null
          subscribe_token?: string | null
          updated_at?: string | null
          user_id?: string | null
          vps_instance_id?: string | null
        }
        Update: {
          config_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          inbound_tag?: string | null
          ip_resource_ids?: string[] | null
          last_deployed_at?: string | null
          name?: string
          node_quota_bytes?: number | null
          order_id?: string | null
          outbound_strategy?: string
          port?: number
          profile_id?: string | null
          protocol?: string
          public_ip?: string | null
          remark?: string | null
          status?: string | null
          subscribe_token?: string | null
          updated_at?: string | null
          user_id?: string | null
          vps_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nodes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "node_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodes_vps_instance_id_fkey"
            columns: ["vps_instance_id"]
            isOneToOne: false
            referencedRelation: "vps_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string | null
          currency: string
          expires_at: string | null
          id: string
          note: string | null
          order_no: string | null
          order_type: string
          paid_at: string | null
          payment_id: string | null
          plan_name: string
          started_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          billing_cycle?: string
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          order_no?: string | null
          order_type?: string
          paid_at?: string | null
          payment_id?: string | null
          plan_name: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          order_no?: string | null
          order_type?: string
          paid_at?: string | null
          payment_id?: string | null
          plan_name?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      page_scrape_logs: {
        Row: {
          account_id: string | null
          created_at: string | null
          error_msg: string | null
          id: number
          numeric_value: number | null
          scrape_date: string | null
          scrape_type: string
          scraped_data: Json
          source: string | null
          success: boolean | null
          target_url: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          error_msg?: string | null
          id?: number
          numeric_value?: number | null
          scrape_date?: string | null
          scrape_type: string
          scraped_data: Json
          source?: string | null
          success?: boolean | null
          target_url?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          error_msg?: string | null
          id?: number
          numeric_value?: number | null
          scrape_date?: string | null
          scrape_type?: string
          scraped_data?: Json
          source?: string | null
          success?: boolean | null
          target_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_scrape_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gcp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      phones: {
        Row: {
          account: string | null
          balance_code: string | null
          carrier: string | null
          cost: number | null
          created_at: string
          die_date: string | null
          id: string
          location: string | null
          name_label: string | null
          phone: string
          source: string | null
          updated_at: string
        }
        Insert: {
          account?: string | null
          balance_code?: string | null
          carrier?: string | null
          cost?: number | null
          created_at?: string
          die_date?: string | null
          id?: string
          location?: string | null
          name_label?: string | null
          phone: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          account?: string | null
          balance_code?: string | null
          carrier?: string | null
          cost?: number | null
          created_at?: string
          die_date?: string | null
          id?: string
          location?: string | null
          name_label?: string | null
          phone?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proxy_test_results: {
        Row: {
          download_mbps: number | null
          download_speed_kbps: number | null
          error_message: string | null
          host: string | null
          id: number
          ip_address: string | null
          is_reachable: boolean | null
          latency_ms: number | null
          port: number | null
          proxy_id: number | null
          test_method: string
          tested_at: string | null
          tested_from_ip: string | null
          tested_from_vps_id: string | null
          upload_mbps: number | null
        }
        Insert: {
          download_mbps?: number | null
          download_speed_kbps?: number | null
          error_message?: string | null
          host?: string | null
          id?: number
          ip_address?: string | null
          is_reachable?: boolean | null
          latency_ms?: number | null
          port?: number | null
          proxy_id?: number | null
          test_method?: string
          tested_at?: string | null
          tested_from_ip?: string | null
          tested_from_vps_id?: string | null
          upload_mbps?: number | null
        }
        Update: {
          download_mbps?: number | null
          download_speed_kbps?: number | null
          error_message?: string | null
          host?: string | null
          id?: number
          ip_address?: string | null
          is_reachable?: boolean | null
          latency_ms?: number | null
          port?: number | null
          proxy_id?: number | null
          test_method?: string
          tested_at?: string | null
          tested_from_ip?: string | null
          tested_from_vps_id?: string | null
          upload_mbps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proxy_test_results_proxy_id_fkey"
            columns: ["proxy_id"]
            isOneToOne: false
            referencedRelation: "ip_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_test_results_tested_from_vps_id_fkey"
            columns: ["tested_from_vps_id"]
            isOneToOne: false
            referencedRelation: "vps_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      push_configs: {
        Row: {
          channel: string
          config_key: string
          config_value: string
          created_at: string | null
          description: string | null
          id: number
          is_enabled: boolean | null
          updated_at: string | null
          user_key: string
          user_name: string
        }
        Insert: {
          channel: string
          config_key: string
          config_value: string
          created_at?: string | null
          description?: string | null
          id?: number
          is_enabled?: boolean | null
          updated_at?: string | null
          user_key: string
          user_name: string
        }
        Update: {
          channel?: string
          config_key?: string
          config_value?: string
          created_at?: string | null
          description?: string | null
          id?: number
          is_enabled?: boolean | null
          updated_at?: string | null
          user_key?: string
          user_name?: string
        }
        Relationships: []
      }
      push_logs: {
        Row: {
          channel: string
          error_message: string | null
          id: number
          message_id: number | null
          pushed_at: string | null
          response_time: number | null
          status: string
          template_id: number | null
          user_key: string
        }
        Insert: {
          channel: string
          error_message?: string | null
          id?: number
          message_id?: number | null
          pushed_at?: string | null
          response_time?: number | null
          status: string
          template_id?: number | null
          user_key: string
        }
        Update: {
          channel?: string
          error_message?: string | null
          id?: number
          message_id?: number | null
          pushed_at?: string | null
          response_time?: number | null
          status?: string
          template_id?: number | null
          user_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "external_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
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
      resource_bindings: {
        Row: {
          bind_type: string
          bound_at: string
          id: string
          order_id: string
          released_at: string | null
          resource_id: string
          status: string
        }
        Insert: {
          bind_type: string
          bound_at?: string
          id?: string
          order_id: string
          released_at?: string | null
          resource_id: string
          status?: string
        }
        Update: {
          bind_type?: string
          bound_at?: string
          id?: string
          order_id?: string
          released_at?: string | null
          resource_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_bindings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_bundles: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          token?: string
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
      traffic_snapshots: {
        Row: {
          account_id: string | null
          created_at: string | null
          egress_gb: number | null
          id: number
          ingress_gb: number | null
          is_warning: boolean | null
          raw_data: Json | null
          snapshot_date: string
          source: string | null
          traffic_limit_gb: number | null
          updated_at: string | null
          usage_pct: number | null
          vm_id: number | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          egress_gb?: number | null
          id?: number
          ingress_gb?: number | null
          is_warning?: boolean | null
          raw_data?: Json | null
          snapshot_date?: string
          source?: string | null
          traffic_limit_gb?: number | null
          updated_at?: string | null
          usage_pct?: number | null
          vm_id?: number | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          egress_gb?: number | null
          id?: number
          ingress_gb?: number | null
          is_warning?: boolean | null
          raw_data?: Json | null
          snapshot_date?: string
          source?: string | null
          traffic_limit_gb?: number | null
          updated_at?: string | null
          usage_pct?: number | null
          vm_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "traffic_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gcp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traffic_snapshots_vm_id_fkey"
            columns: ["vm_id"]
            isOneToOne: false
            referencedRelation: "vm_instances"
            referencedColumns: ["id"]
          },
        ]
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
      vm_instances: {
        Row: {
          account_id: string | null
          gcp_instance_id: string | null
          id: number
          is_active: boolean | null
          machine_type: string | null
          project_id: string
          public_ip: string | null
          status: string | null
          updated_at: string | null
          vm_name: string
          zone: string | null
        }
        Insert: {
          account_id?: string | null
          gcp_instance_id?: string | null
          id?: number
          is_active?: boolean | null
          machine_type?: string | null
          project_id: string
          public_ip?: string | null
          status?: string | null
          updated_at?: string | null
          vm_name: string
          zone?: string | null
        }
        Update: {
          account_id?: string | null
          gcp_instance_id?: string | null
          id?: number
          is_active?: boolean | null
          machine_type?: string | null
          project_id?: string
          public_ip?: string | null
          status?: string | null
          updated_at?: string | null
          vm_name?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vm_instances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gcp_accounts"
            referencedColumns: ["id"]
          },
        ]
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
          account: string | null
          agent_version: string | null
          billing_remaining: number | null
          billing_updated_at: string | null
          billing_used: number | null
          cost_30d: number | null
          created_at: string | null
          credit_remaining: number | null
          disk_size_gb: number | null
          disk_type: string | null
          download_bytes: number | null
          external_ip: string | null
          gcp_instance_name: string | null
          gcp_project_id: string | null
          heartbeat_status: string
          id: string
          instance_id: string | null
          internal_ip: string | null
          last_heartbeat_at: string | null
          last_sync_at: string | null
          last_sync_batch_id: string | null
          last_updated: string | null
          machine_type: string | null
          name: string | null
          network_tier: string | null
          provider: string
          public_ip: unknown
          region: string | null
          runtime_stack: string | null
          status: string | null
          sync_cpu_percent: number | null
          sync_disk_percent: number | null
          sync_mem_percent: number | null
          traffic_received: number | null
          traffic_sent: number | null
          upload_bytes: number | null
          zone: string | null
        }
        Insert: {
          account?: string | null
          agent_version?: string | null
          billing_remaining?: number | null
          billing_updated_at?: string | null
          billing_used?: number | null
          cost_30d?: number | null
          created_at?: string | null
          credit_remaining?: number | null
          disk_size_gb?: number | null
          disk_type?: string | null
          download_bytes?: number | null
          external_ip?: string | null
          gcp_instance_name?: string | null
          gcp_project_id?: string | null
          heartbeat_status?: string
          id?: string
          instance_id?: string | null
          internal_ip?: string | null
          last_heartbeat_at?: string | null
          last_sync_at?: string | null
          last_sync_batch_id?: string | null
          last_updated?: string | null
          machine_type?: string | null
          name?: string | null
          network_tier?: string | null
          provider?: string
          public_ip?: unknown
          region?: string | null
          runtime_stack?: string | null
          status?: string | null
          sync_cpu_percent?: number | null
          sync_disk_percent?: number | null
          sync_mem_percent?: number | null
          traffic_received?: number | null
          traffic_sent?: number | null
          upload_bytes?: number | null
          zone?: string | null
        }
        Update: {
          account?: string | null
          agent_version?: string | null
          billing_remaining?: number | null
          billing_updated_at?: string | null
          billing_used?: number | null
          cost_30d?: number | null
          created_at?: string | null
          credit_remaining?: number | null
          disk_size_gb?: number | null
          disk_type?: string | null
          download_bytes?: number | null
          external_ip?: string | null
          gcp_instance_name?: string | null
          gcp_project_id?: string | null
          heartbeat_status?: string
          id?: string
          instance_id?: string | null
          internal_ip?: string | null
          last_heartbeat_at?: string | null
          last_sync_at?: string | null
          last_sync_batch_id?: string | null
          last_updated?: string | null
          machine_type?: string | null
          name?: string | null
          network_tier?: string | null
          provider?: string
          public_ip?: unknown
          region?: string | null
          runtime_stack?: string | null
          status?: string | null
          sync_cpu_percent?: number | null
          sync_disk_percent?: number | null
          sync_mem_percent?: number | null
          traffic_received?: number | null
          traffic_sent?: number | null
          upload_bytes?: number | null
          zone?: string | null
        }
        Relationships: []
      }
      vps_metrics: {
        Row: {
          cpu_percent: number | null
          disk_percent: number | null
          id: number
          instance_id: string
          mem_percent: number | null
          recorded_at: string
        }
        Insert: {
          cpu_percent?: number | null
          disk_percent?: number | null
          id?: number
          instance_id: string
          mem_percent?: number | null
          recorded_at?: string
        }
        Update: {
          cpu_percent?: number | null
          disk_percent?: number | null
          id?: number
          instance_id?: string
          mem_percent?: number | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vps_metrics_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "vps_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      vps_metrics_2026_03: {
        Row: {
          cpu_percent: number | null
          disk_percent: number | null
          id: number
          instance_id: string
          mem_percent: number | null
          recorded_at: string
        }
        Insert: {
          cpu_percent?: number | null
          disk_percent?: number | null
          id?: number
          instance_id: string
          mem_percent?: number | null
          recorded_at?: string
        }
        Update: {
          cpu_percent?: number | null
          disk_percent?: number | null
          id?: number
          instance_id?: string
          mem_percent?: number | null
          recorded_at?: string
        }
        Relationships: []
      }
      vps_metrics_2026_04: {
        Row: {
          cpu_percent: number | null
          disk_percent: number | null
          id: number
          instance_id: string
          mem_percent: number | null
          recorded_at: string
        }
        Insert: {
          cpu_percent?: number | null
          disk_percent?: number | null
          id?: number
          instance_id: string
          mem_percent?: number | null
          recorded_at?: string
        }
        Update: {
          cpu_percent?: number | null
          disk_percent?: number | null
          id?: number
          instance_id?: string
          mem_percent?: number | null
          recorded_at?: string
        }
        Relationships: []
      }
      vps_metrics_default: {
        Row: {
          cpu_percent: number | null
          disk_percent: number | null
          id: number
          instance_id: string
          mem_percent: number | null
          recorded_at: string
        }
        Insert: {
          cpu_percent?: number | null
          disk_percent?: number | null
          id?: number
          instance_id: string
          mem_percent?: number | null
          recorded_at?: string
        }
        Update: {
          cpu_percent?: number | null
          disk_percent?: number | null
          id?: number
          instance_id?: string
          mem_percent?: number | null
          recorded_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_node_permission: {
        Args: {
          p_node_id: string
          p_permission_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      gcp_billing_report_url: {
        Args: { billing_id: string; project_id: string }
        Returns: string
      }
      generate_subscription_token: { Args: never; Returns: string }
      has_module_permission: {
        Args: { m: string; p: string }
        Returns: boolean
      }
      increment_subscription_access: {
        Args: { p_token: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      restore_node: { Args: { node_uuid: string }; Returns: boolean }
      soft_delete_node: { Args: { node_uuid: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
