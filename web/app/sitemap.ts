import type { MetadataRoute } from 'next'

import { routing } from '@/i18n/routing'
import { absoluteUrl, localizedPath } from '@/lib/site'

/**
 * 生成公开页面站点地图。
 *
 * 当前仅收录中英文首页；登录、对话、后台和支付结果页均为私有页面。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, absoluteUrl(localizedPath(locale))]),
  )

  return routing.locales.map((locale) => ({
    url: absoluteUrl(localizedPath(locale)),
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1,
    alternates: {
      languages: {
        ...languages,
        'x-default': absoluteUrl(localizedPath(routing.defaultLocale)),
      },
    },
  }))
}
