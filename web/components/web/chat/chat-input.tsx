'use client'

import React, { useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Bot, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MembershipIcon } from '@/components/common/membership-icon'
import type { Agent } from '@/app/[locale]/types'

/**
 * 聊天输入组件属性
 */
interface ChatInputProps {
  /** 输入内容 */
  input: string
  /** 输入内容变化回调 */
  onInputChange: (value: string) => void
  /** 发送消息回调 */
  onSend: () => void
  /** 停止生成回调 */
  onStopGeneration: () => void
  /** 是否正在加载 */
  isLoading: boolean
  /** 输入框是否禁用 */
  isDisabled: boolean
  /** 是否可以发送 */
  canSend: boolean
  /** 当前 Agent */
  currentAgent: Agent | null
  /** 占位符文本 */
  placeholder: string
  /** 是否显示紧急重置按钮 */
  showEmergencyReset?: boolean
  /** 紧急重置回调 */
  onEmergencyReset?: () => void
}

/**
 * 聊天输入组件
 * 
 * 功能：
 * - 多行文本输入
 * - 自动调整高度
 * - 显示当前 Agent 信息
 * - 发送/停止按钮
 * - 紧急重置按钮（可选）
 * 
 * 性能优化：
 * - 使用 React.memo 避免不必要的重渲染
 * - 使用 useCallback 优化事件处理
 */
export const ChatInput = React.memo(function ChatInput({
  input,
  onInputChange,
  onSend,
  onStopGeneration,
  isLoading,
  isDisabled,
  canSend,
  currentAgent,
  placeholder,
  showEmergencyReset = false,
  onEmergencyReset,
}: ChatInputProps) {
  const t = useTranslations()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /**
   * 自动调整文本框高度
   */
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 144) + 'px'
    }
  }, [input])

  /**
   * 处理输入变化
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onInputChange(e.target.value)
    },
    [onInputChange]
  )

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && canSend) {
        e.preventDefault()
        await onSend()
      }
    },
    [canSend, onSend]
  )

  /**
   * 处理发送/停止按钮点击
   */
  const handleButtonClick = useCallback(async () => {
    if (isLoading) {
      onStopGeneration()
    } else if (canSend) {
      await onSend()
    }
  }, [isLoading, canSend, onSend, onStopGeneration])

  return (
    <div className="p-4 border-t bg-background sticky bottom-0 z-10">
      {/* 文本输入区域 */}
      <textarea
        ref={textareaRef}
        className={`w-full text-lg rounded-md bg-background outline-none resize-none focus:ring-0 transition-opacity overflow-hidden ${
          isDisabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{
          height: 'auto',
          maxHeight: '15rem',
        }}
        placeholder={placeholder}
        value={input}
        onChange={handleChange}
        disabled={isDisabled}
        rows={2}
        onKeyDown={handleKeyDown}
      />

      {/* 底部信息和按钮区域 */}
      <div className="flex items-center justify-between mt-2">
        {/* 显示当前 Agent 信息 */}
        {currentAgent ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
            <Bot className="w-4 h-4" />
            <span>{t('chat.currentAgent')}:</span>
            <MembershipIcon type={currentAgent.required_membership_type} />
            <span>{currentAgent.name}</span>
          </div>
        ) : (
          <div></div>
        )}

        {/* 按钮区域 */}
        <div className="flex items-center gap-2">
          {/* 紧急重置按钮 */}
          {showEmergencyReset && onEmergencyReset && (
            <Button
              size="sm"
              variant="outline"
              onClick={onEmergencyReset}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              title={t('common.actions.resetChatStatus')}
            >
              {t('common.actions.reset')}
            </Button>
          )}

          {/* 发送/停止按钮 */}
          <Button
            className={`w-10 h-10 rounded-full flex items-center justify-center p-0 border-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 ${
              isLoading
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
            title={
              isLoading
                ? t('chat.actions.stopGeneration')
                : t('common.actions.send')
            }
            onClick={handleButtonClick}
            disabled={isLoading ? false : !canSend}
          >
            {isLoading ? (
              <Square className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
})

