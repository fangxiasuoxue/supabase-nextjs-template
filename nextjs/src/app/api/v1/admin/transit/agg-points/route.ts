import { crudCollection } from '@/lib/transit/api-helpers'
// GET 列表 / POST 建 —— 聚合点
export const { GET, POST } = crudCollection('transit_agg_point')
