'use client'

import React from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'

/**
 * 状态横幅类型
 */
type BannerType = 'maxRounds' | 'globalLock' | 'roundsWarning' | 'error'

/**
 * 状态横幅组件属性
 */
interface ChatStatusBannerProps {
  /** 横幅类型 */
  type: BannerType
  /** 当前轮次（maxRounds/roundsWarning 类型需要） */
  currentRounds?: number
  /** 最大轮次（maxRounds/roundsWarning 类型需要） */
  maxRounds?: number
  /** 剩余轮次（roundsWarning 类型需要） */
  remainingRounds?: number
  /** 锁定状态消息（globalLock 类型需要） */
  lockStatusMessage?: string
  /** 错误消息（error 类型需要） */
  errorMessage?: string
  /** 开始新对话回调 */
  onStartNewChat?: () => void
  /** 重置回调 */
  onReset?: () => void
  /** 重试回调 */
  onRetry?: () => void
}

/**
 * 聊天状态横幅组件
 * 
 * 功能：
 * - 显示不同类型的状态提示（轮次限制、全局锁定、错误等）
 * - 提供对应的操作按钮
 * 
 * 性能优化：
 * - 使用 React.memo 避免不必要的重渲染
 */
export const ChatStatusBanner = React.memo(function ChatStatusBanner({
  type,
  currentRounds,
  maxRounds,
  remainingRounds,
  lockStatusMessage,
  errorMessage,
  onStartNewChat,
  onReset,
  onRetry,
}: ChatStatusBannerProps) {
  const t = useTranslations()

  // 轮次限制警告
  if (type === 'maxRounds') {
    return (
      <div className="mb-4 p-3 bg-accent border border-accent-foreground/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-accent-foreground rounded-full"></div>
            <span className="text-sm font-medium text-accent-foreground">
              {t('chat.limits.maxRoundsWarning', {
                current: currentRounds ?? 0,
                max: maxRounds ?? 0,
              })}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-accent-foreground border-accent-foreground/30 hover:bg-accent/80"
            onClick={onStartNewChat}
          >
            {t('chat.limits.startNewChat')}
          </Button>
        </div>
      </div>
    )
  }

  // 全局对话锁定提示
  if (type === 'globalLock') {
    return (
      <div className="mb-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
            <span className="text-sm text-destructive font-medium">
              {lockStatusMessage}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onReset}
            className="text-destructive border-destructive/30 hover:bg-destructive/20"
          >
            {t('common.actions.reset')}
          </Button>
        </div>
      </div>
    )
  }

  // 轮次接近警告
  if (type === 'roundsWarning') {
    return (
      <div className="mb-3 p-2 bg-accent border border-accent-foreground/30 rounded-md">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-accent-foreground rounded-full"></div>
          <span className="text-xs text-accent-foreground">
            {t('chat.limits.roundsRemaining', { remaining: remainingRounds ?? 0 })}
          </span>
        </div>
      </div>
    )
  }

  // 错误提示
  if (type === 'error') {
    return (
      <div className="mb-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
        <div className="flex items-center justify-between">
          <span className="text-sm text-destructive">
            {errorMessage}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="text-destructive"
          >
            {t('common.actions.retry')}
          </Button>
        </div>
      </div>
    )
  }

  return null
})

