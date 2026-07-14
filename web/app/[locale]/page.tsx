import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import RemoveFlavorEditor from '@/components/web/editor/remove-flavor-editor'
import SharedLayout from '@/components/web/layout/shared-layout'
import {
  absoluteUrl,
  localizedAlternates,
  localizedPath,
  openGraphLocale,
  SITE_NAME,
} from '@/lib/site'

/**
 * 生成首页独立的 canonical、hreflang 和社交分享 metadata。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.home' })
  const title = t('title')
  const description = t('description')

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: localizedAlternates(locale),
    openGraph: {
      type: 'website',
      url: absoluteUrl(localizedPath(locale)),
      title,
      description,
      siteName: SITE_NAME,
      locale: openGraphLocale(locale),
      alternateLocale: [openGraphLocale(locale === 'zh' ? 'en' : 'zh')],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

/**
 * 主页面内容组件，输出可索引的产品说明和交互式文本优化工作台。
 *
 * @param heading - 首页主标题。
 * @param intro - 首页产品简介。
 */
function HomePageContent({ heading, intro }: { heading: string; intro: string }) {
  return (
    <SharedLayout>
      <div className="flex h-full min-h-0 w-full flex-col">
        <section className="shrink-0 border-b bg-muted/20 px-4 py-3 sm:px-6">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            {heading}
          </h1>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            {intro}
          </p>
        </section>
        <div className="min-h-0 flex-1">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            }
          >
            <RemoveFlavorEditor />
          </Suspense>
        </div>
      </div>
    </SharedLayout>
  )
}

/**
 * 主页面 - 去除 AI 味文本编辑器
 * 
 * 功能:
 * - 提供左右分栏的文本编辑界面
 * - 左侧输入原始 AI 生成文本
 * - 右侧显示优化后的文本
 * - 支持文本编辑、复制、下载、折叠等功能
 * - 包含 header 和 sidebar
 * 
 * 路由: /
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'seo.home' })
  const pageUrl = absoluteUrl(localizedPath(locale))
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: pageUrl,
    description: t('description'),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    inLanguage: locale,
  }

  return (
    <>
      <HomePageContent heading={t('heading')} intro={t('intro')} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
    </>
  )
}