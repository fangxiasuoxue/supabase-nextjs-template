import type { MetadataRoute } from 'next'

// SDD 57:公开站点可被收录(SEO);后台/鉴权/分享/接口不收录。
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || ''
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app', '/api', '/auth', '/s', '/sub'],
      },
    ],
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  }
}
