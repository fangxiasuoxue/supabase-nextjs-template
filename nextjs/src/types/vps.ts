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
}

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
