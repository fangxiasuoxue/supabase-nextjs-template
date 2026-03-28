// Node Management Type Definitions

export type Protocol = 'vless' | 'vmess' | 'trojan' | 'shadowsocks' | 'ssr' | 'socks' | 'http';

export type SourceType = '3x-ui' | 's-ui' | 'xray-gateway' | 'gost' | 'xray-core';

export type NodeStatus = 'enabled' | 'disabled' | 'expired';

export type SyncType = 'full' | 'incremental';

export type SyncStatus = 'success' | 'failed' | 'partial' | 'pending';

export type PermissionType = 'read' | 'write' | 'manage';

// VPS Configuration
export interface VpsConfig {
    id: string;
    name: string;
    ip: string;
    port: number;
    username?: string;
    password?: string; // encrypted
    vps_module_id?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
}

// Node Source Configuration
export interface NodeSourceConfig {
    id: string;
    vps_id: string;
    source_type: SourceType;
    api_url: string;
    username?: string;
    password?: string; // encrypted
    token?: string; // encrypted
    sub_url?: string;
    extra_config: Record<string, any>;
    is_active: boolean;
    last_sync_at?: string;
    last_sync_status?: SyncStatus;
    last_sync_error?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
    // Joined data
    vps_configs?: VpsConfig;
}

// Node
export interface Node {
    id: string;
    name: string;
    vps_id?: string;
    source_config_id?: string;
    protocol: Protocol;
    host: string;
    port: number;
    uuid?: string;
    extra_params: Record<string, any>;
    node_url?: string;
    qr_code_path?: string;
    status: NodeStatus;
    is_manual: boolean;
    remark?: string;
    traffic_up: number;
    traffic_down: number;
    traffic_total: number;
    expire_time?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
    synced_at?: string;
    deleted_at?: string;
    // Joined data
    vps_configs?: VpsConfig;
}

// Node Permission
export interface NodePermission {
    id: string;
    user_id: string;
    node_id?: string; // NULL means global permission
    permission_type: PermissionType;
    created_by?: string;
    created_at: string;
}

// Subscription
export interface Subscription {
    id: string;
    name: string;
    user_id: string;
    subscription_token: string;
    access_count: number;
    expire_time?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// Subscription Node
export interface SubscriptionNode {
    id: string;
    subscription_id: string;
    node_id: string;
    sort_order: number;
    created_at: string;
    // Joined data
    nodes?: Node;
}

// Sync Log
export interface SyncLog {
    id: string;
    source_config_id: string;
    sync_type?: SyncType;
    status?: SyncStatus;
    nodes_added: number;
    nodes_updated: number;
    nodes_deleted: number;
    error_message?: string;
    duration_ms?: number;
    started_at: string;
    completed_at?: string;
    created_by?: string;
}

// Node Statistics
export interface NodeStatistics {
    vps_id?: string;
    protocol: Protocol;
    status: NodeStatus;
    node_count: number;
    total_traffic_up: number;
    total_traffic_down: number;
    total_traffic_limit: number;
}

// Subscription Details
export interface SubscriptionDetails extends Subscription {
    node_count: number;
}

// API Request/Response Types

export interface CreateVpsConfigRequest {
    name: string;
    ip: string;
    port?: number;
    username?: string;
    password?: string;
    vps_module_id?: string;
}

export interface UpdateVpsConfigRequest extends Partial<CreateVpsConfigRequest> { }

export interface CreateNodeSourceConfigRequest {
    vps_id: string;
    source_type: SourceType;
    api_url: string;
    username?: string;
    password?: string;
    token?: string;
    sub_url?: string;
    extra_config?: Record<string, any>;
}

export interface UpdateNodeSourceConfigRequest extends Partial<CreateNodeSourceConfigRequest> { }

export interface CreateNodeRequest {
    name: string;
    vps_id?: string;
    source_config_id?: string;
    protocol: Protocol;
    host: string;
    port: number;
    uuid?: string;
    extra_params?: Record<string, any>;
    node_url?: string;
    status?: NodeStatus;
    is_manual?: boolean;
    remark?: string;
    traffic_total?: number;
    expire_time?: string;
}

export interface UpdateNodeRequest extends Partial<CreateNodeRequest> { }

export interface ParseUrlRequest {
    urls: string[];
}

export interface ParsedNode {
    protocol: Protocol;
    host: string;
    port: number;
    uuid?: string;
    extra_params: Record<string, any>;
    remark?: string;
    node_url: string;
}

export interface ParseUrlResponse {
    parsed: ParsedNode[];
    errors: string[];
}

export interface SyncNodesRequest {
    source_config_id: string;
    sync_type: SyncType;
}

export interface SyncNodesResponse {
    success: boolean;
    added: number;
    updated: number;
    deleted: number;
    errors: string[];
}

export interface CreateSubscriptionRequest {
    name: string;
    node_ids: string[];
    expire_time?: string;
}

export interface UpdateSubscriptionRequest {
    name?: string;
    node_ids?: string[];
    expire_time?: string;
    is_active?: boolean;
}

export interface NodeListParams {
    page?: number;
    size?: number;
    vps_id?: string;
    protocol?: Protocol;
    status?: NodeStatus;
    search?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    size: number;
}
