import { InstancesClient } from '@google-cloud/compute'
import { MetricServiceClient } from '@google-cloud/monitoring'
import { BigQuery } from '@google-cloud/bigquery'
import { VPSInstance, GCPInstance, VPSTraffic, VPSBilling } from '@/types/vps'

export class GCPService {
    private credentials: any
    private projectId: string

    constructor(credentials: any) {
        this.credentials = credentials
        this.projectId = credentials.project_id
    }

    async listInstances(accountAlias: string): Promise<GCPInstance[]> {
        const instancesClient = new InstancesClient({
            credentials: this.credentials,
            projectId: this.projectId,
        })

        const instances: GCPInstance[] = []

        try {
            // Use aggregatedListAsync for better compatibility with newer client versions
            const iterable = instancesClient.aggregatedListAsync({
                project: this.projectId,
            })

            for await (const [zonePath, instancesScopedList] of iterable) {
                if (instancesScopedList.instances && instancesScopedList.instances.length > 0) {
                    const zone = zonePath.split('/').pop() || ''

                    for (const inst of instancesScopedList.instances) {
                        instances.push({
                            id: inst.id?.toString() || '',
                            name: inst.name || '',
                            zone: zone,
                            status: inst.status || '',
                            machineType: inst.machineType?.split('/').pop() || '',
                            internalIp: inst.networkInterfaces?.[0]?.networkIP || '',
                            externalIp: inst.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP || '',
                            account: accountAlias,
                        })
                    }
                }
            }
        } catch (error) {
            console.error(`Error listing instances for ${accountAlias}:`, error)
            // If aggregatedListAsync fails, try to log the client methods to debug
            console.log('Available methods on instancesClient:', Object.getOwnPropertyNames(Object.getPrototypeOf(instancesClient)))
            throw error
        }

        return instances
    }

    async getTraffic(instanceIds: string[]): Promise<Record<string, VPSTraffic>> {
        if (instanceIds.length === 0) return {}

        const client = new MetricServiceClient({
            credentials: this.credentials,
            projectId: this.projectId,
        })

        const projectName = client.projectPath(this.projectId)
        const now = new Date()
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

        const interval = {
            startTime: { seconds: Math.floor(startOfMonth.getTime() / 1000) },
            endTime: { seconds: Math.floor(now.getTime() / 1000) },
        }

        const idFilters = instanceIds.map(id => `resource.labels.instance_id="${id}"`).join(' OR ')

        // Helper to fetch metric
        const fetchMetric = async (metricType: string) => {
            const filter = `metric.type="${metricType}" AND (${idFilters})`
            const [timeSeries] = await client.listTimeSeries({
                name: projectName,
                filter: filter,
                interval: interval,
                view: 'FULL',
                aggregation: {
                    alignmentPeriod: { seconds: 86400 },
                    perSeriesAligner: 'ALIGN_SUM',
                },
            })
            return timeSeries
        }

        const [recvSeries, sentSeries] = await Promise.all([
            fetchMetric('compute.googleapis.com/instance/network/received_bytes_count'),
            fetchMetric('compute.googleapis.com/instance/network/sent_bytes_count'),
        ])

        const trafficMap: Record<string, VPSTraffic> = {}

        // Initialize map
        instanceIds.forEach(id => {
            trafficMap[id] = { instanceId: id, receivedGB: 0, sentGB: 0, totalGB: 0 }
        })

        const processSeries = (series: any[], type: 'receivedGB' | 'sentGB') => {
            series.forEach(s => {
                const instanceId = s.resource?.labels?.instance_id
                if (instanceId && trafficMap[instanceId]) {
                    let totalBytes = 0
                    s.points?.forEach((p: any) => {
                        totalBytes += Number(p.value.int64Value || p.value.doubleValue || 0)
                    })
                    trafficMap[instanceId][type] = totalBytes / (1024 ** 3)
                }
            })
        }

        processSeries(recvSeries, 'receivedGB')
        processSeries(sentSeries, 'sentGB')

        // Calculate totals
        Object.values(trafficMap).forEach(t => {
            t.totalGB = t.receivedGB + t.sentGB
        })

        return trafficMap
    }

    async getBilling(accountAlias: string, billingAccountId?: string): Promise<VPSBilling | null> {
        // If billing account ID is not provided, we might need to find it or skip
        // For now, let's assume it's passed or we can't query
        // Actually, the user's example uses an env var for billing account ID. 
        // We should probably store this in the config as well or derive it.
        // For this implementation, I'll assume we might not have it easily unless configured.
        // However, the user requirement mentions "GCP账单余额".
        // Let's try to query if we have the dataset info.

        // We need dataset ID and table name. These are specific to the export setup.
        // We can look for config keys like `vps.gcp.billing.dataset.{account}` and `vps.gcp.billing.account_id.{account}`
        // Or we can assume a convention.

        // For now, I will return null if not configured, but I'll implement the logic assuming we have the info.
        // I'll add `billing_account_id` and `dataset_id` to the `credentials` object or pass them separately?
        // The `credentials` object is the JSON key. It doesn't contain billing export info.

        // Let's assume for now we only support this if we can find the info.
        // I will implement a placeholder or a basic query if params are available.

        return null
    }

    // Overloaded getBilling with explicit params if we decide to pass them from system configs
    async getBillingWithParams(accountAlias: string, billingAccountId: string, datasetId: string, initialCredit: number = 300): Promise<VPSBilling> {
        const bigquery = new BigQuery({
            credentials: this.credentials,
            projectId: this.projectId,
        })

        const tableName = `gcp_billing_export_v1_${billingAccountId.replace(/-/g, '_')}`
        const query = `
      SELECT
        IFNULL(SUM(c.amount), 0) as total_credit_usage
      FROM \`${this.projectId}.${datasetId}.${tableName}\` t
      LEFT JOIN UNNEST(t.credits) as c
      WHERE 
        (c.name LIKE '%Free Trial%' OR c.type = 'PROMOTION')
    `

        try {
            const [job] = await bigquery.createQueryJob({ query, location: 'US' })
            const [rows] = await job.getQueryResults()
            const totalUsed = rows.length > 0 ? rows[0].total_credit_usage : 0

            return {
                account: accountAlias,
                totalUsed: totalUsed,
                remaining: initialCredit + totalUsed, // credits are usually negative
                currency: 'USD'
            }
        } catch (error) {
            console.error(`Error fetching billing for ${accountAlias}:`, error)
            return {
                account: accountAlias,
                totalUsed: 0,
                remaining: 0,
                currency: 'USD'
            }
        }
    }
}
