'use client'

import React, { useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'

import { ChatMessage } from './chat-message'
import type { Message } from '@/app/[locale]/types'

/**
 * 消息列表组件属性
 */
interface ChatMessageListProps {
  /** 消息列表 */
  messages: Message[]
  /** 是否正在加载 */
  isLoading: boolean
  /** 当前流式响应的消息索引 */
  currentStreamingIndex: number
  /** 显示原始文本的消息索引映射 */
  showRawText: { [key: number]: boolean }
  /** 是否应该自动滚动 */
  shouldAutoScroll: boolean
  /** 页面是否已改变 */
  hasPageChanged: boolean
  /** 复制消息内容回调 */
  onCopy: (content: string) => void
  /** 切换原始文本显示回调 */
  onToggleRawText: (index: number) => void
  /** 重新生成消息回调 */
  onRefresh: (index: number) => void
  /** 流式响应完成回调 */
  onStreamComplete: (index: number) => void
  /** 滚动事件回调 */
  onScroll: () => void
}

/**
 * 聊天消息列表组件
 * 
 * 功能：
 * - 显示所有聊天消息
 * - 自动滚动到底部
 * - 处理滚动事件
 * 
 * 性能优化：
 * - 使用 React.memo 避免不必要的重渲染
 */
export const ChatMessageList = React.memo(function ChatMessageList({
  messages,
  isLoading,
  currentStreamingIndex,
  showRawText,
  shouldAutoScroll,
  hasPageChanged,
  onCopy,
  onToggleRawText,
  onRefresh,
  onStreamComplete,
  onScroll,
}: ChatMessageListProps) {
  const t = useTranslations()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  /**
   * 自动滚动到底部 - 页面变化时
   */
  useEffect(() => {
    if (hasPageChanged && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [messages, hasPageChanged])

  /**
   * 自动滚动到底部 - 消息变化时
   */
  useEffect(() => {
    if (shouldAutoScroll && !hasPageChanged) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, shouldAutoScroll, hasPageChanged])

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto px-4 py-2"
      onScroll={onScroll}
    >
      {messages.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          {t('chat.noMessages')}
        </div>
      ) : (
        messages.map((msg, idx) => (
          <ChatMessage
            key={idx}
            message={msg}
            messageIndex={idx}
            isLoading={isLoading}
            isStreaming={currentStreamingIndex === idx}
            showRawText={showRawText[idx] || false}
            onCopy={onCopy}
            onToggleRawText={onToggleRawText}
            onRefresh={onRefresh}
            onStreamComplete={onStreamComplete}
          />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  )
})

