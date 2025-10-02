"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useTranslations } from 'next-intl'
import { usePathname } from '@/i18n/navigation'

import { Layout } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { NavChatList } from "@/components/web/sidebar/nav-chat-list"
import { NavUser } from "@/components/web/sidebar/nav-user"
import { useGlobalUserData } from '@/hooks/use-global-user-data'
import type { Chat } from "@/app/[locale]/types" 

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onSelectChat?: (chat: Chat) => void;
  chats: Chat[];
  currentChatId?: number;
}

export function AppSidebar({ onSelectChat, chats, currentChatId, ...props }: AppSidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const { userProfile } = useGlobalUserData();
  const { toggleSidebar, open, setOpen } = useSidebar();
  
  // 从全局用户数据中获取用户信息，如果没有则使用默认值
  const email = userProfile?.email || 'not_found@example.com';
  const username = userProfile?.username || 'User';
  
  // 判断是否在首页（工作台页面）
  const isWorkspaceActive = pathname === '/';
  
  // Logo 点击处理：在展开和折叠状态之间切换
  const handleLogoClick = () => {
    toggleSidebar();
  };

  // 工作台点击处理：自动折叠 sidebar，给工作区更多空间
  const handleWorkspaceClick = () => {
    setOpen(false);
  };

  // 使用 ref 追踪上一次的路径，只在路径变化到首页时折叠
  const prevPathnameRef = React.useRef(pathname);
  
  React.useEffect(() => {
    // 只在从其他页面导航到首页时自动折叠
    const wasNotHomePage = prevPathnameRef.current !== '/';
    if (isWorkspaceActive && wasNotHomePage && open) {
      setOpen(false);
    }
    prevPathnameRef.current = pathname;
  }, [pathname, isWorkspaceActive, open, setOpen]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              size="lg" 
              onClick={handleLogoClick}
              className="cursor-pointer"
              tooltip={t('editor.workspace')}
            >
              <Avatar className="h-10 w-10 rounded-lg">
                <Image
                  src="/logo.svg"
                  alt="Logo"
                  width={32}
                  height={32}
                  className="cursor-pointer"
                />
              </Avatar>
              <div className="text-xl font-light relative">
                <span className="text-foreground">{t('app.fullName')}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* 工作台按钮 */}
            <SidebarMenuButton
              tooltip={t('editor.workspace')}
              isActive={isWorkspaceActive}
              size="default"
              asChild
            >
              <Link href="/" className="flex items-center gap-2" onClick={handleWorkspaceClick}>
                <Layout className="text-primary" />
                <span className="font-semibold text-primary">{t('editor.workspace')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="border-y">
        {/* Chat list, calls onSelectChat when clicked */}
        <NavChatList
          chats={chats}
          onSelectChat={onSelectChat}
          currentChatId={currentChatId}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ name: username, email: email }} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
