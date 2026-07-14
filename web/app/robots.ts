import type { MetadataRoute } from 'next'

import { absoluteUrl, getSiteUrl } from '@/lib/site'

/**
 * 生成搜索引擎抓取规则。
 *
 * 私有页面通过页面级 noindex 控制，确保爬虫能读取禁止索引指令。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: getSiteUrl().origin,
  }
}
