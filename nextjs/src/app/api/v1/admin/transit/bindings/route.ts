import { crudCollection } from '@/lib/transit/api-helpers'
// GET 列表(?gw= 过滤)/ POST 建 —— gw 消费口期望态
export const { GET, POST } = crudCollection('transit_binding')
