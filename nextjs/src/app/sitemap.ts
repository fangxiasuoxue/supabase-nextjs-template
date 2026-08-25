import type { MetadataRoute } from 'next'

// SDD 57:仅收录公开页(首页 + 法务)。设置 NEXT_PUBLIC_SITE_URL 后生成绝对地址。
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || ''
  const routes = ['', '/legal/privacy', '/legal/terms', '/legal/refund']
  return routes.map((r) => ({
    url: `${base}${r || '/'}`,
    changeFrequency: 'monthly',
    priority: r === '' ? 1 : 0.5,
  }))
}
