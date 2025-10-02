'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import RemoveFlavorEditor from '@/components/web/editor/remove-flavor-editor'
import SharedLayout from '@/components/web/layout/shared-layout'

import { getValidAccessToken } from '@/util/token'

/**
 * 主页面内容组件
 */
function HomePageContent() {
  const router = useRouter()

  // 检查用户认证
  useEffect(() => {
    const checkToken = async () => {
      const accessToken = await getValidAccessToken()
      if (!accessToken) {
        router.push('/login')
        return
      }
    }
    checkToken()
  }, [router])

  return (
    <SharedLayout>
      <RemoveFlavorEditor />
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