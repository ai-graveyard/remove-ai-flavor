'use client'

import React, { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Bot, User, Copy, RefreshCw, Loader2, FileText } from 'lucide-react'

import AIStreamText from '@/components/common/ai-stream-text'
import type { Message } from '@/app/[locale]/types'

/**
 * 格式化时间显示
 */
function formatTime(ts: string) {
  const date = new Date(ts)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toLocaleDateString() + ' ' + localDate.toLocaleTimeString([])
}

/**
 * 聊天消息组件属性
 */
interface ChatMessageProps {
  message: Message
  messageIndex: number
  isLoading: boolean
  isStreaming: boolean
  showRawText: boolean
  onCopy: (content: string) => void
  onToggleRawText: (index: number) => void
  onRefresh: (index: number) => void
  onStreamComplete: (index: number) => void
}

/**
 * 聊天消息组件
 * 
 * 功能：
 * - 显示用户和 AI 的消息
 * - 支持复制、重新生成等操作
 * - 显示 Token 使用统计
 * - 支持原始文本查看
 * 
 * 性能优化：
 * - 使用 React.memo 避免不必要的重渲染
 */
export const ChatMessage = React.memo(function ChatMessage({
  message,
  messageIndex,
  isLoading,
  isStreaming,
  showRawText,
  onCopy,
  onToggleRawText,
  onRefresh,
  onStreamComplete,
}: ChatMessageProps) {
  const t = useTranslations()

  const handleCopy = useCallback(() => {
    onCopy(message.content)
  }, [message.content, onCopy])

  const handleToggleRawText = useCallback(() => {
    onToggleRawText(messageIndex)
  }, [messageIndex, onToggleRawText])

  const handleRefresh = useCallback(() => {
    onRefresh(messageIndex)
  }, [messageIndex, onRefresh])

  const handleStreamComplete = useCallback(() => {
    onStreamComplete(messageIndex)
  }, [messageIndex, onStreamComplete])

  return (
    <div
      className={`group flex mb-2 items-start ${
        message.role === 'user' ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* AI 头像 */}
      {message.role === 'assistant' && (
        <div className="w-10 h-10 rounded-full mr-2 mt-1 flex items-center justify-center">
          <Bot className="w-7 h-7 text-foreground" />
        </div>
      )}

      {/* 消息内容区域 */}
      <div className="flex flex-col items-end max-w-[80%]">
        {/* 时间戳和操作按钮 */}
        <div
          className={`flex items-center gap-1 mb-1 ${
            message.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'
          }`}
        >
          <span className="text-xs text-muted-foreground">
            {formatTime(message.created_at!)}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* 复制按钮 */}
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-muted rounded"
              title={t('chat.actions.copy')}
            >
              <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
            </button>

            {/* AI 消息的原始文本切换 */}
            {message.role === 'assistant' && (
              <button
                onClick={handleToggleRawText}
                className="p-1 hover:bg-muted rounded"
                title={t('chat.ai.showRawText')}
              >
                <FileText className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}

            {/* 用户消息的重新生成按钮 */}
            {message.role === 'user' && (
              <button
                onClick={handleRefresh}
                className="p-1 hover:bg-muted rounded"
                title={t('chat.actions.regenerate')}
                disabled={isLoading}
              >
                <RefreshCw className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* 消息气泡 */}
        <div
          className={`px-3 py-2 rounded-lg break-words shadow ${
            message.role === 'user'
              ? 'bg-primary/10 text-foreground self-end'
              : 'bg-muted text-foreground self-start'
          }`}
        >
          {message.role === 'assistant' ? (
            <div className="relative">
              {message.content === '' && isLoading ? (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-sm">{t('chat.ai.thinking')}</span>
                </div>
              ) : (
                <AIStreamText
                  text={message.content}
                  speed={10}
                  enableTypewriter={true}
                  isLoading={isStreaming}
                  onComplete={handleStreamComplete}
                  showRaw={showRawText}
                  isHistoryMessage={!isStreaming}
                />
              )}
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>

        {/* Token 使用统计 - 仅对 assistant 消息显示 */}
        {message.role === 'assistant' && message.token_usage && (
          <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-90 transition-opacity self-start pt-1">
            <span>
              {message.token_usage.prompt_tokens} /{' '}
              {message.token_usage.completion_tokens} /{' '}
              {message.token_usage.total_tokens} {t('chat.tokens.tokens')}
            </span>
          </div>
        )}
      </div>

      {/* 用户头像 */}
      {message.role === 'user' && (
        <div className="w-10 h-10 rounded-full ml-2 mt-1 flex items-center justify-center">
          <User className="w-7 h-7 text-foreground" />
        </div>
      )}
    </div>
  )
})

