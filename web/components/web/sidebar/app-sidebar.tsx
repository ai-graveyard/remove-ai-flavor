"use client"

import * as React from "react"
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { getSidebarHeaderMode } from "@/components/web/sidebar/sidebar-header"
import { useGlobalUserData } from '@/hooks/use-global-user-data'
import type { Chat } from "@/app/[locale]/types" 

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onSelectChat?: (chat: Chat) => void;
  chats: Chat[];
  currentChatId?: number;
}

export function AppSidebar({ onSelectChat, chats, currentChatId, ...props }: AppSidebarProps) {
  const t = useTranslations();
  const { userProfile } = useGlobalUserData();
  const { state, toggleSidebar, setOpen } = useSidebar();
  const headerMode = getSidebarHeaderMode(state);
  
  // 从全局用户数据中获取用户信息，如果没有则使用默认值
  const email = userProfile?.email || 'not_found@example.com';
  const username = userProfile?.username || 'User';
  
  // 应用标题点击处理：在展开和折叠状态之间切换。
  const handleTitleClick = () => {
    toggleSidebar();
  };

  // 新建任务时自动折叠侧边栏，给编辑区域更多空间。
  const handleNewTaskClick = () => {
    setOpen(false);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="pb-[7px]">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-1">
            {headerMode === 'new-task' ? (
              /* 折叠后用新建任务入口替代标题，点击时保持侧边栏折叠。 */
              <SidebarMenuButton
                size="lg"
                tooltip={t('editor.newTask')}
                className="justify-center cursor-pointer text-primary [&>svg]:size-5"
                asChild
              >
                <Link
                  href="/?action=new"
                  onClick={handleNewTaskClick}
                  title={t('editor.newTask')}
                  aria-label={t('editor.newTask')}
                >
                  <Plus />
                </Link>
              </SidebarMenuButton>
            ) : (
              <>
                <SidebarMenuButton
                  size="lg"
                  onClick={handleTitleClick}
                  className="min-w-0 flex-1 cursor-pointer justify-center"
                  tooltip={t('app.fullName')}
                >
                  <div className="relative min-w-0 truncate text-xl font-semibold">
                    <span className="text-foreground">{t('app.fullName')}</span>
                  </div>
                </SidebarMenuButton>
                {/* 展开状态保留独立的新建优化任务入口。 */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 text-primary"
                  asChild
                >
                  <Link
                    href="/?action=new"
                    onClick={handleNewTaskClick}
                    title={t('editor.newTask')}
                    aria-label={t('editor.newTask')}
                  >
                    <Plus className="size-5" />
                  </Link>
                </Button>
              </>
            )}
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
