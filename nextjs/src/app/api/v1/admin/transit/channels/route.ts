import { crudCollection } from '@/lib/transit/api-helpers'
// GET 列表 / POST 建 —— 中转通道(L2 供给)
export const { GET, POST } = crudCollection('transit_channel')
