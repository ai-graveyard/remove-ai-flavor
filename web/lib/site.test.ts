import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_SITE_URL,
  absoluteUrl,
  getSiteUrl,
  localizedAlternates,
  localizedPath,
} from './site'

describe('站点 SEO URL 工具', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('未配置站点地址时使用正式域名', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')

    expect(getSiteUrl().origin).toBe(DEFAULT_SITE_URL)
  })

  it('生成带语言前缀的规范路径', () => {
    expect(localizedPath('zh')).toBe('/zh')
    expect(localizedPath('en', '/guide/')).toBe('/en/guide')
  })

  it('生成当前页面 canonical 和全部语言替代链接', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com')

    expect(localizedAlternates('zh')).toEqual({
      canonical: 'https://example.com/zh',
      languages: {
        en: 'https://example.com/en',
        zh: 'https://example.com/zh',
        'x-default': 'https://example.com/en',
      },
    })
    expect(absoluteUrl('/sitemap.xml')).toBe('https://example.com/sitemap.xml')
  })
})
