import { crudCollection } from '@/lib/transit/api-helpers'
// GET 列表 / POST 建 —— GoRelay 隧道声明
export const { GET, POST } = crudCollection('transit_tunnel')
