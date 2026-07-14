'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import LanguageSwitchButton from "@/components/common/language-switch-button"
import { AppSidebar } from "@/components/web/sidebar/app-sidebar"
import ThemeToggleButton from "@/components/common/theme-toggle-button"
import UpgradePlanDialog from "@/components/web/dialogs/upgrade-plan-dialog"

import { getValidAccessToken } from '@/util/token'
import { useGlobalDataCache } from '@/hooks/use-global-data-cache'
import type { Chat } from '@/app/[locale]/types'

interface SharedLayoutProps {
  children: React.ReactNode
  breadcrumbTitle?: string
  breadcrumbDescription?: string
}

/**
 * 共享布局组件
 * 
 * 功能:
 * - 提供统一的侧边栏和头部布局
 * - 在路由变化时保持侧边栏状态不变
 * - 避免侧边栏重新挂载导致的滚动位置丢失
 * 
 * @param children - 页面内容
 * @param breadcrumbTitle - 面包屑标题
 * @param breadcrumbDescription - 首页标题旁显示的页面简介
 */
export default function SharedLayout({
  children,
  breadcrumbTitle,
  breadcrumbDescription,
}: SharedLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const { chats, fetchChats } = useGlobalDataCache()
  // `null` 表示仍在检查 token，避免访客触发任何认证接口。
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  
  // 从路径中获取当前聊天 ID
  const getCurrentChatId = (): number | null => {
    const match = pathname.match(/^\/chat\/(\d+)(?:\/.*)?$/)
    return match ? parseInt(match[1], 10) : null
  }
  
  const currentChatId = getCurrentChatId()
  
  // 获取当前聊天信息用于面包屑
  const currentChat = chats?.find(chat => chat.id === currentChatId)
  
  // 确定面包屑标题
  const getBreadcrumbTitle = () => {
    if (breadcrumbTitle) return breadcrumbTitle
    if (currentChat) return currentChat.title
    return t('app.slogan')
  }

  // 判断是否在首页（工作台页面）
  // 使用国际化的 usePathname，已自动去除语言前缀，只需判断是否为 '/'
  const isHomePage = pathname === '/'
  
  // 首页默认折叠 sidebar，聊天页面默认展开
  const defaultSidebarOpen = !isHomePage

  // 首页允许访客访问，其他业务页面仍然要求登录。
  useEffect(() => {
    const checkToken = async () => {
      const accessToken = await getValidAccessToken()
      setIsAuthenticated(Boolean(accessToken))
      if (!accessToken) {
        if (!isHomePage) {
          router.push('/login')
        }
      }
    }
    checkToken()
  }, [isHomePage, router])

  // 只有登录用户才初始化聊天列表，访客不能访问聊天数据。
  useEffect(() => {
    const initializeData = async () => {
      if (isAuthenticated && !chats) {
        try {
          await fetchChats()
        } catch (error) {
          console.error('Fetch chat list failed:', error)
        }
      }
    }
    
    initializeData()
  }, [chats, fetchChats, isAuthenticated])

  // 受保护页面在认证完成前不挂载子组件，避免提前发起认证请求。
  if (!isHomePage && isAuthenticated !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t('editor.loading')}
      </div>
    )
  }

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      {isAuthenticated && (
        <AppSidebar
          chats={chats || []}
          onSelectChat={(chat: Chat) => {
            router.push(`/chat/${chat.id}`)
          }}
          currentChatId={currentChatId || undefined}
        />
      )}
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-xl transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/70 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex min-w-0 items-center gap-2 px-4">
            {isAuthenticated && (
              <>
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-[orientation=vertical]:h-4"
                />
              </>
            )}
            {isHomePage ? (
              <div className="hidden min-w-0 items-baseline gap-3 md:flex">
                <h1 className="shrink-0 text-lg font-semibold tracking-tight text-foreground">
                  {getBreadcrumbTitle()}
                </h1>
                {breadcrumbDescription && (
                  <p className="max-w-[min(48vw,42rem)] truncate text-sm text-muted-foreground/80">
                    {breadcrumbDescription}
                  </p>
                )}
              </div>
            ) : (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block text-lg">
                    <BreadcrumbLink href="#">
                      {getBreadcrumbTitle()}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center justify-end gap-3 pr-3 sm:pr-4">
            {isAuthenticated ? (
              <UpgradePlanDialog />
            ) : isAuthenticated === false ? (
              <Button
                size="sm"
                className="h-9 rounded-lg px-4"
                onClick={() => router.push('/login')}
              >
                {t('editor.actions.login')}
              </Button>
            ) : null}
            {/* 将低频设置收进统一工具栏，避免与主要操作竞争视觉注意力。 */}
            <div className="flex items-center rounded-lg border bg-muted/30 p-0.5 [&_button]:size-8 [&_button]:rounded-md [&_svg]:size-4">
              <ThemeToggleButton />
              <div aria-hidden="true" className="h-4 w-px bg-border" />
              <LanguageSwitchButton />
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col pt-0 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
