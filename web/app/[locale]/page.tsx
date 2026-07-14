'use client'

import { Suspense } from 'react'

import RemoveFlavorEditor from '@/components/web/editor/remove-flavor-editor'
import SharedLayout from '@/components/web/layout/shared-layout'

/**
 * 主页面内容组件，允许登录用户和访客进入文本优化工作台。
 */
function HomePageContent() {
  return (
    <SharedLayout>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <RemoveFlavorEditor />
      </Suspense>
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
export default function HomePage() {
  return <HomePageContent />
}