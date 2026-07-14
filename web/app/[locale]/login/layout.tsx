import {routing} from '@/i18n/routing';
import type { Metadata } from "next";
import { getTranslations } from 'next-intl/server';
import "@/app/globals.css";
import { NO_INDEX_ROBOTS } from '@/lib/site';

/**
 * 生成登录页 metadata，并阻止认证页面进入搜索结果。
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo.login' });

  return {
    title: t('title'),
    description: t('description'),
    robots: NO_INDEX_ROBOTS,
    alternates: {},
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

/**
 * 登录路由布局。
 *
 * @param children - 登录页内容。
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>{children}</>
  )
}
