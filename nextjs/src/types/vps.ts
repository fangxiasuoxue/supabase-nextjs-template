export interface VPSInstance {
    id: string // UUID from DB
    instanceId: string // GCP Instance ID
    name: string
    zone: string
    status: string
    machineType: string
    internalIp?: string
    externalIp?: string
    account: string // The alias/key suffix of the GCP account
    trafficReceived: number
    trafficSent: number
    billingUsed: number
    billingRemaining: number
    lastUpdated: string
    // Phase-2: openclaw billing_snapshots & traffic_snapshots
    creditRemaining?: number | null   // 赠金余额
    cost30d?: number | null           // 近30天费用
    uploadBytes?: number | null       // 上行流量（字节）
    downloadBytes?: number | null     // 下行流量（字节）
    billingUpdatedAt?: string | null  // 账单数据更新时间
}

export interface GCPInstance {
    id: string // GCP Instance ID
    name: string
    zone: string
    status: string
    machineType: string
    internalIp?: string
    externalIp?: string
    account: string
}

export interface VPSTraffic {
    instanceId: string
    receivedGB: number
    sentGB: number
    totalGB: number
}

export interface VPSBilling {
    account: string
    totalUsed: number
    remaining: number
    currency: string
}

export interface VPSData {
    instances: VPSInstance[]
    lastUpdated: number
    errors?: string[] // List of error messages encountered during sync
}
