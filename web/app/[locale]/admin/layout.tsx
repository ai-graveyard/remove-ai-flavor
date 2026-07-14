import type { Metadata } from 'next'

import { NO_INDEX_ROBOTS } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Admin',
  robots: NO_INDEX_ROBOTS,
  alternates: {},
}

/**
 * 管理后台路由布局，统一阻止后台页面进入搜索结果。
 *
 * @param children - 管理后台页面内容。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
