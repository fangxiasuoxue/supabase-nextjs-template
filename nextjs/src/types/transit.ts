// 中转加速模块类型(对应 migration 20260827000001_transit_acceleration_module.sql)。SDD 60。

export type TransitProvider = 'gorelay' | 'self-hk' | 'cn2gia'
export type EntityStatus = 'active' | 'inactive'
export type TunnelMode = 'direct' | 'aggregated'
export type LandingKind = 'reality' | 'cheap-direct' | 'cheap-agg'

export interface TransitChannel {
  id: string
  name: string
  provider: TransitProvider
  in_node_group_id: number | null
  traffic_rate: number | null
  level: string | null
  region_from: string | null
  region_to: string | null
  status: EntityStatus
  note: string | null
  created_at: string
  updated_at: string
}

export interface TransitAggPoint {
  id: string
  vps_instance_id: string
  region: string | null
  listen_port: number
  inbound_tag: string
  status: EntityStatus
  note: string | null
  created_at: string
  updated_at: string
}

export interface TransitAggLanding {
  id: string
  agg_point_id: string
  ip_asset_label: string
  agg_user: string
  agg_pass_ref: string | null
  outbound_tag: string
  route_tag: string
  status: EntityStatus
  created_at: string
  updated_at: string
}

export interface TransitTunnel {
  id: string
  channel_id: string
  gorelay_tunnel_id: number | null
  name: string | null
  listen_port: number
  mode: TunnelMode
  forward_spec: { address: string; weight?: number }[]
  load_balance_type: string
  status: EntityStatus
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface TransitBinding {
  id: string
  gw: string
  consume_port: number
  tunnel_id: string
  landing_kind: LandingKind
  landing_ref: string | null
  agg_user: string | null
  node_name: string | null
  status: EntityStatus
  created_at: string
  updated_at: string
}

export interface ReconcileResult {
  missing: string[] // 已声明但现网 GoRelay 无(需 sync)
  orphan: number[] // 现网有但 DB 未声明(gorelay_tunnel_id)
}

export const PROVIDER_META: Record<TransitProvider, { label: string; cls: string }> = {
  gorelay: { label: 'GoRelay', cls: 'text-sky-700 bg-sky-50 border-sky-200' },
  'self-hk': { label: '自建HK', cls: 'text-violet-700 bg-violet-50 border-violet-200' },
  cn2gia: { label: 'CN2 GIA', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
}
