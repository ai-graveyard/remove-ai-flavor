import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from "next";
import "@/app/globals.css";
import { routing } from '@/i18n/routing';
import ThemeProvider from "@/components/common/theme-provider";
import { ThemeProvider as NextThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { GlobalChatStateProvider } from '@/hooks/use-global-chat-state';
import { GlobalDataCacheProvider } from '@/hooks/use-global-data-cache';
import { GlobalUserDataProvider } from '@/hooks/use-global-user-data';
import { getSiteUrl, SITE_NAME } from '@/lib/site';

/**
 * 生成全站共享的本地化 metadata。
 *
 * 首页 canonical、hreflang 和社交卡片由首页自身补充，避免子路由错误继承首页地址。
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo.home' });

  return {
    metadataBase: getSiteUrl(),
    title: {
      default: t('title'),
      template: `%s | ${SITE_NAME}`,
    },
    description: t('description'),
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <NextThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThemeProvider />
          <NextIntlClientProvider locale={locale}>
            <GlobalChatStateProvider>
              <GlobalUserDataProvider>
                <GlobalDataCacheProvider>
                  {children}
                </GlobalDataCacheProvider>
              </GlobalUserDataProvider>
            </GlobalChatStateProvider>
          </NextIntlClientProvider>
          <Toaster />
        </NextThemeProvider>
      </body>
    </html>
  );
}
