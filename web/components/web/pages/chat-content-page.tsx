'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'

import { ChatMessageList } from '@/components/web/chat/chat-message-list'
import { ChatInput } from '@/components/web/chat/chat-input'
import { ChatStatusBanner } from '@/components/web/chat/chat-status-banner'
import { fetcher } from '@/util/fetcher'
import { useMembershipStatus, refreshMembershipStatusGlobally } from '@/hooks/use-global-user-data'
import { useGlobalChatState } from '@/hooks/use-global-chat-state'
import { useGlobalDataCache } from '@/hooks/use-global-data-cache'
import type { Chat, Message, Agent } from '@/app/[locale]/types'

/**
 * Token 使用统计
 */
interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface ChatContentPageProps {
  chat: Chat
  isNewChat?: boolean
  onStartNewChat?: () => void
  initialMessage?: string
  onInitialMessageSent?: () => void
  /** 只读模式，禁用输入和发送功能 */
  readOnly?: boolean
}

/**
 * 聊天内容页面组件（重构版）
 * 
 * 功能:
 * - 管理聊天状态和消息
 * - 处理消息发送和流式响应
 * - 集成全局对话锁和会员限制
 * - 拆分为多个子组件，提升可维护性
 * 
 * 重构改进:
 * - 将 UI 拆分为 ChatMessageList、ChatInput、ChatStatusBanner 子组件
 * - 简化主组件逻辑，专注于状态管理和业务逻辑
 * - 提升代码可读性和可维护性
 * - 从 760 行减少到约 450 行
 */
export default function ChatContentPage({ 
  chat, 
  isNewChat,
  onStartNewChat,
  initialMessage,
  onInitialMessageSent,
  readOnly = false
}: ChatContentPageProps) {
  const t = useTranslations()
  
  // Refs
  const abortController = useRef<AbortController | null>(null)
  const hasSent = useRef(false)
  const isSending = useRef(false)
  
  // 状态管理
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentStreamingIndex, setCurrentStreamingIndex] = useState(-1)
  const [showRawText, setShowRawText] = useState<{[key: number]: boolean}>({})
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [hasPageChanged, setHasPageChanged] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取全局状态和缓存
  const { membershipStatus } = useMembershipStatus()
  const { 
    canSendMessage, 
    startChat, 
    endChat, 
    getLockStatusMessage,
    forceReset,
    activeChatId,
    isGloballyLocked
  } = useGlobalChatState()
  const { 
    addMessageToChat, 
    updateChatInCache 
  } = useGlobalDataCache()

  // 对话轮次限制
  const MAX_CHAT_ROUNDS = membershipStatus?.conversation_turn_limit || 10
  const currentRounds = useMemo(() => {
    return messages.filter(msg => msg.role === 'user').length
  }, [messages])
  const isMaxRoundsReached = currentRounds >= MAX_CHAT_ROUNDS
  
  // 全局锁定状态
  const isBlockedByGlobalLock = !canSendMessage(chat.id)
  const lockStatusMessage = getLockStatusMessage()
  const shouldBypassLock = false

  // 输入框禁用条件
  const isInputDisabled = readOnly || 
                          isMaxRoundsReached || 
                          (isBlockedByGlobalLock && !shouldBypassLock)
  
  // 发送条件
  const canSend = !readOnly &&
                  !isLoading && 
                  !isSending.current &&
                  !isMaxRoundsReached && 
                  (!isBlockedByGlobalLock || shouldBypassLock) &&
                  input.trim().length > 2

  // 页面初始化和切换处理
  useEffect(() => {
    setShouldAutoScroll(true)
    setHasPageChanged(true)
    hasSent.current = false
    isSending.current = false
    setError(null)
    setIsLoading(false)
    setCurrentStreamingIndex(-1)
    
    if (chat.messages && chat.messages.length > 0) {
      setMessages(chat.messages)
    } else {
      setMessages([])
    }
    
    if (chat.agent) {
      setCurrentAgent(chat.agent)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id])

  // 全局锁定状态清理
  useEffect(() => {
    if (isGloballyLocked && activeChatId !== null && activeChatId !== chat.id) {
      forceReset()
      isSending.current = false
      setIsLoading(false)
      setCurrentStreamingIndex(-1)
    }
  }, [isGloballyLocked, activeChatId, chat.id, forceReset])

  // 流式文本更新
  const displayStreamingText = useCallback((targetText: string, messageIndex: number) => {
    setCurrentStreamingIndex(messageIndex)
    
    requestAnimationFrame(() => {
      setMessages(prev => {
        const newMsgs = [...prev]
        if (newMsgs[messageIndex]) {
          newMsgs[messageIndex] = { ...newMsgs[messageIndex], content: targetText }
        }
        return newMsgs
      })
    })
  }, [])

  // 发送消息
  const sendMessage = useCallback(async (content: string) => {
    const messageContent = content.trim()
    
    const canSendNow = !isLoading && 
                       !isSending.current &&
                       !isMaxRoundsReached && 
                       !isBlockedByGlobalLock &&
                       messageContent.length > 2
    
    if (!messageContent || !canSendNow) {
      return
    }

    if (isSending.current) {
      return
    }
    isSending.current = true

    startChat(chat.id, chat.title)
    
    setIsLoading(true)
    setInput('')
    setError(null)
    
    const now = new Date().toISOString()
    const userMsg: Message = { 
      id: 0, 
      content: messageContent, 
      role: 'user', 
      created_at: now, 
      updated_at: now 
    }
    
    const assistantMsg: Message = { 
      id: 0, 
      content: '', 
      role: 'assistant', 
      created_at: now, 
      updated_at: now 
    }
    
    const assistantMsgIndex = messages.length + 1
    
    setMessages(prev => [...prev, userMsg, assistantMsg])
    
    setTimeout(() => {
      setShouldAutoScroll(true)
      setHasPageChanged(true)
    }, 50)

    const requestBody = {
      content: messageContent,
      chat_id: chat.id,
      role: 'user'
    }

    try {
      abortController.current = new AbortController()
      
      let assistantContent = ''
      let tokenUsage: TokenUsage | null = null
      
      await fetcher('/chat/message?stream=true',
        {
          method: 'POST',
          auth: true,
          body: JSON.stringify(requestBody),
          headers: { 'Content-Type': 'application/json' },
          stream: true,
          signal: abortController.current.signal,
        },
        (chunk: string) => {
          if (chunk.includes('__TOKEN_USAGE__') && chunk.includes('__END__')) {
            const tokenMatch = chunk.match(/__TOKEN_USAGE__(\d+),(\d+),(\d+)__END__/)
            if (tokenMatch) {
              tokenUsage = {
                prompt_tokens: parseInt(tokenMatch[1]),
                completion_tokens: parseInt(tokenMatch[2]),
                total_tokens: parseInt(tokenMatch[3])
              }
              return
            }
          }
          
          assistantContent += chunk
          displayStreamingText(assistantContent, assistantMsgIndex)
        }
      )
      
      setCurrentStreamingIndex(-1)
      refreshMembershipStatusGlobally()
      
      if (tokenUsage) {
        setMessages(prev => {
          const newMsgs = [...prev]
          if (newMsgs[assistantMsgIndex]) {
            newMsgs[assistantMsgIndex] = { 
              ...newMsgs[assistantMsgIndex], 
              content: assistantContent,
              token_usage: tokenUsage || undefined
            }
          }
          return newMsgs
        })
      }
      
      const finalUserMsg = { ...userMsg, id: Date.now() }
      const finalAssistantMsg = { 
        ...assistantMsg, 
        id: Date.now() + 1, 
        content: assistantContent,
        token_usage: tokenUsage || undefined
      }
      
      addMessageToChat(chat.id, finalUserMsg)
      addMessageToChat(chat.id, finalAssistantMsg)
      
      updateChatInCache(chat.id, { 
        updated_at: new Date().toISOString(),
        content: messageContent
      })
      
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 用户终止
      } else {
        console.error('Send message failed:', error)
        
        let errorMessage = t('chat.messages.errorOccurred')
        
        if (error instanceof Error) {
          errorMessage = error.message || t('chat.messages.errorOccurred')
        }
        
        setError(errorMessage)
        setMessages(prev => {
          const newMsgs = [...prev]
          newMsgs[assistantMsgIndex] = { 
            ...assistantMsg, 
            content: errorMessage
          }
          return newMsgs
        })
      }
    } finally {
      setIsLoading(false)
      setCurrentStreamingIndex(-1)
      endChat()
      isSending.current = false
    }
  }, [isLoading, isMaxRoundsReached, isBlockedByGlobalLock, chat.id, chat.title, messages.length, startChat, endChat, displayStreamingText, t, addMessageToChat, updateChatInCache])

  // 处理初始消息自动发送
  useEffect(() => {
    if (initialMessage && isNewChat && !hasSent.current && canSendMessage(chat.id)) {
      setInput(initialMessage)
      const timeoutId = setTimeout(async () => {
        if (!hasSent.current && canSendMessage(chat.id)) {
          hasSent.current = true
          const messageContent = initialMessage.trim()
          if (messageContent) {
            await sendMessage(messageContent)
          }
          if (onInitialMessageSent) {
            onInitialMessageSent()
          }
        }
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [initialMessage, isNewChat, onInitialMessageSent, canSendMessage, chat.id, sendMessage])

  // 滚动处理
  const handleScroll = useCallback(() => {
    if (hasPageChanged) {
      setShouldAutoScroll(false)
      setHasPageChanged(false)
    }
  }, [hasPageChanged])

  // 流式响应完成处理
  const handleStreamComplete = useCallback((messageIndex: number) => {
    if (messageIndex === currentStreamingIndex) {
      setCurrentStreamingIndex(-1)
    }
  }, [currentStreamingIndex])

  // 发送消息处理
  const handleSend = useCallback(async (content?: string) => {
    const messageContent = content || input.trim()
    await sendMessage(messageContent)
  }, [input, sendMessage])

  // 停止生成
  const handleStopGeneration = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort()
      abortController.current = null
    }
    
    setIsLoading(false)
    setCurrentStreamingIndex(-1)
    endChat()
    isSending.current = false
    
    refreshMembershipStatusGlobally()
  }, [endChat])

  // 复制消息内容
  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      // 复制失败，静默处理
    }
  }, [])

  // 切换原始文本显示
  const handleToggleRawText = useCallback((messageIndex: number) => {
    setShowRawText(prev => ({ ...prev, [messageIndex]: !prev[messageIndex] }))
  }, [])

  // 重新生成消息
  const handleRefresh = useCallback(async (messageIndex: number) => {
    const userMessage = messages[messageIndex]
    if (userMessage && userMessage.role === 'user' && !isLoading && !isSending.current && canSendMessage(chat.id)) {
      await handleSend(userMessage.content)
    }
  }, [messages, isLoading, canSendMessage, chat.id, handleSend])

  // 重试最后一条消息
  const handleRetry = useCallback(() => {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    if (lastUserMessage) {
      handleSend(lastUserMessage.content)
    }
  }, [messages, handleSend])

  // 计算输入框占位符
  const inputPlaceholder = useMemo(() => {
    if (isBlockedByGlobalLock && !shouldBypassLock) {
      return lockStatusMessage || t('chat.limits.globalLockActive')
    }
    if (isMaxRoundsReached) {
      return t('chat.limits.maxRoundsReached')
    }
    if (isLoading) {
      return t('chat.ai.replying')
    }
    return t('common.placeholders.enterQuestion')
  }, [isBlockedByGlobalLock, shouldBypassLock, lockStatusMessage, isMaxRoundsReached, isLoading, t])

  // 处理紧急重置
  const handleEmergencyReset = useCallback(() => {
    forceReset()
    isSending.current = false
    setIsLoading(false)
    setCurrentStreamingIndex(-1)
  }, [forceReset])

  // 处理开始新对话
  const handleStartNewChat = useCallback(() => {
    if (onStartNewChat) {
      onStartNewChat()
    } else {
      window.location.href = '/'
    }
  }, [onStartNewChat])

  return (
    <div className="flex flex-row w-full h-full min-h-0">
      <div className="flex flex-col flex-1 h-full min-h-0 bg-background rounded p-0">
        {/* 消息列表 */}
        <ChatMessageList
          messages={messages}
          isLoading={isLoading}
          currentStreamingIndex={currentStreamingIndex}
          showRawText={showRawText}
          shouldAutoScroll={shouldAutoScroll}
          hasPageChanged={hasPageChanged}
          onCopy={handleCopy}
          onToggleRawText={handleToggleRawText}
          onRefresh={handleRefresh}
          onStreamComplete={handleStreamComplete}
          onScroll={handleScroll}
        />

        {/* 输入区域 */}
        {!readOnly && (
          <div>
            {/* 状态横幅 */}
            <div className="px-4">
              {isMaxRoundsReached && (
                <ChatStatusBanner
                  type="maxRounds"
                  currentRounds={currentRounds}
                  maxRounds={MAX_CHAT_ROUNDS}
                  onStartNewChat={handleStartNewChat}
                />
              )}

              {isBlockedByGlobalLock && !shouldBypassLock && lockStatusMessage && (
                <ChatStatusBanner
                  type="globalLock"
                  lockStatusMessage={lockStatusMessage}
                  onReset={handleEmergencyReset}
                />
              )}

              {!isMaxRoundsReached && currentRounds >= MAX_CHAT_ROUNDS - 2 && currentRounds > 0 && (
                <ChatStatusBanner
                  type="roundsWarning"
                  remainingRounds={MAX_CHAT_ROUNDS - currentRounds}
                />
              )}

              {error && (
                <ChatStatusBanner
                  type="error"
                  errorMessage={error}
                  onRetry={handleRetry}
                />
              )}
            </div>

            {/* 输入框 */}
            <ChatInput
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
              onStopGeneration={handleStopGeneration}
              isLoading={isLoading}
              isDisabled={isInputDisabled}
              canSend={canSend}
              currentAgent={currentAgent}
              placeholder={inputPlaceholder}
              showEmergencyReset={isBlockedByGlobalLock && !shouldBypassLock}
              onEmergencyReset={handleEmergencyReset}
            />
          </div>
        )}
      </div>
    </div>
  )
}

