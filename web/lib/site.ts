import type { Metadata } from 'next'

import { routing } from '../i18n/routing'

export const SITE_NAME = 'Remove AI Flavor'
export const DEFAULT_SITE_URL = 'https://www.removeaiflavor.com'

/**
 * 获取站点公开地址，用于生成 canonical、站点地图和社交分享链接。
 *
 * 未配置环境变量时回退到正式域名，避免生产构建生成 localhost 链接。
 *
 * @returns 解析后的站点 URL。
 */
export function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_SITE_URL

  try {
    return new URL(configuredUrl)
  } catch {
    return new URL(DEFAULT_SITE_URL)
  }
}

/**
 * 将站内路径转换为绝对 URL。
 *
 * @param pathname - 以斜杠开头的站内路径。
 * @returns 使用正式站点域名的绝对 URL。
 */
export function absoluteUrl(pathname: string): string {
  return new URL(pathname, getSiteUrl()).toString()
}

/**
 * 生成带语言前缀的页面路径。
 *
 * @param locale - 页面语言。
 * @param pathname - 不含语言前缀的页面路径。
 * @returns 规范化后的本地化路径。
 */
export function localizedPath(locale: string, pathname = '/'): string {
  const normalizedPath = pathname === '/' ? '' : `/${pathname.replace(/^\/+|\/+$/g, '')}`
  return `/${locale}${normalizedPath}`
}

/**
 * 生成页面的 canonical 与多语言替代链接。
 *
 * @param locale - 当前页面语言。
 * @param pathname - 不含语言前缀的页面路径。
 * @returns Next.js metadata alternates 配置。
 */
export function localizedAlternates(locale: string, pathname = '/'): NonNullable<Metadata['alternates']> {
  const languages = Object.fromEntries(
    routing.locales.map((supportedLocale) => [
      supportedLocale,
      absoluteUrl(localizedPath(supportedLocale, pathname)),
    ]),
  )

  return {
    canonical: absoluteUrl(localizedPath(locale, pathname)),
    languages: {
      ...languages,
      'x-default': absoluteUrl(localizedPath(routing.defaultLocale, pathname)),
    },
  }
}

/**
 * 返回 Open Graph 使用的标准地区代码。
 *
 * @param locale - 当前页面语言。
 * @returns Open Graph 地区代码。
 */
export function openGraphLocale(locale: string): string {
  return locale === 'zh' ? 'zh_CN' : 'en_US'
}

/**
 * 私有和低价值页面共用的禁止索引规则。
 */
export const NO_INDEX_ROBOTS: Metadata['robots'] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
}
