import type { Metadata } from 'next'

import { NO_INDEX_ROBOTS } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Payment',
  robots: NO_INDEX_ROBOTS,
  alternates: {},
}

/**
 * 支付结果路由布局，避免交易状态地址进入搜索结果。
 *
 * @param children - 支付结果页面内容。
 */
export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return children
}
