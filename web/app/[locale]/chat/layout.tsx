import type { Metadata } from 'next'

import { NO_INDEX_ROBOTS } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Chat',
  robots: NO_INDEX_ROBOTS,
  alternates: {},
}

/**
 * 私有对话路由布局，避免用户内容和动态对话地址被搜索引擎收录。
 *
 * @param children - 对话页面内容。
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children
}
