import { crudCollection } from '@/lib/transit/api-helpers'
// GET 列表(?agg_point_id= 过滤)/ POST 建 —— 聚合落地选路
export const { GET, POST } = crudCollection('transit_agg_landing')
