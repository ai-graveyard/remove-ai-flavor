'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { TextEditorPanel } from '@/components/web/editor/text-editor-panel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fetcher } from '@/util/fetcher'
import { useGlobalDataCache } from '@/hooks/use-global-data-cache'
import { useGlobalChatState } from '@/hooks/use-global-chat-state'
import type { Chat } from '@/app/[locale]/types'

/**
 * 去除 AI 味编辑器组件
 * 
 * 核心功能：
 * - 左右两个可编辑的文本面板
 * - 左侧输入原始文本，右侧展示优化后的文本
 * - 每个面板都可以折叠
 * - 自动保存到 localStorage
 * - 基于 chat 系统进行文本优化
 * - 每天第一次请求自动创建默认 chat
 * - 所有对话记录保存在当天的 chat 中
 */
export default function RemoveFlavorEditor() {
  const t = useTranslations('editor')
  
  // 文本状态
  const [originalText, setOriginalText] = useState('')
  const [optimizedText, setOptimizedText] = useState('')
  
  // UI 状态
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const [isRightCollapsed, setIsRightCollapsed] = useState(false)
  
  // Chat 状态
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)
  const [isLoadingChat, setIsLoadingChat] = useState(true)
  const abortController = useRef<AbortController | null>(null)
  
  // Agent 状态
  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>(undefined)
  
  // 全局数据缓存和对话状态
  const { agents, agentsLoading, fetchAgents, addChatToCache, addMessageToChat } = useGlobalDataCache()
  const { canSendMessage, startChat, endChat } = useGlobalChatState()

  /**
   * 切换左侧面板折叠状态
   * 如果右侧已折叠，则不允许折叠左侧（至少保持一个面板展开）
   */
  const handleToggleLeft = () => {
    if (!isLeftCollapsed && isRightCollapsed) {
      // 如果要折叠左侧，但右侧已经折叠，则展开右侧
      setIsRightCollapsed(false)
    }
    setIsLeftCollapsed(!isLeftCollapsed)
  }

  /**
   * 切换右侧面板折叠状态
   * 如果左侧已折叠，则不允许折叠右侧（至少保持一个面板展开）
   */
  const handleToggleRight = () => {
    if (!isRightCollapsed && isLeftCollapsed) {
      // 如果要折叠右侧，但左侧已经折叠，则展开左侧
      setIsLeftCollapsed(false)
    }
    setIsRightCollapsed(!isRightCollapsed)
  }

  // localStorage 的键名
  const STORAGE_KEY_ORIGINAL = 'remove-flavor-original-text'
  const STORAGE_KEY_OPTIMIZED = 'remove-flavor-optimized-text'
  const STORAGE_KEY_CHAT_DATE = 'remove-flavor-chat-date'
  const STORAGE_KEY_CHAT_ID = 'remove-flavor-chat-id'

  /**
   * 获取今日日期字符串（YYYY-MM-DD 格式）
   */
  const getTodayDateString = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  /**
   * 获取或创建当天的默认 chat
   * @param agentId 可选的 agent ID，如果提供则使用该 agent
   */
  const getOrCreateTodayChat = async (agentId?: number): Promise<Chat | null> => {
    try {
      const today = getTodayDateString()
      const savedDate = localStorage.getItem(STORAGE_KEY_CHAT_DATE)
      const savedChatId = localStorage.getItem(STORAGE_KEY_CHAT_ID)
      
      // 如果是同一天且有保存的 chat ID，尝试使用已有的 chat
      if (savedDate === today && savedChatId) {
        try {
          const chatId = parseInt(savedChatId)
          const response = await fetcher(`/chat/${chatId}`, {
            method: 'GET',
            auth: true,
          })
          const chat = response as Chat
          return chat
        } catch {
          console.warn('保存的 chat 不存在或已被删除，将创建新的 chat')
        }
      }
      
      // 创建新的 chat
      // 首先获取可用的 agent 列表
      const agents = await fetchAgents()
      if (agents.length === 0) {
        toast.error(t('messages.noAgentAvailable') || '暂无可用的智能体')
        return null
      }
      
      // 使用指定的 agent 或第一个 agent（ID 最小的）
      const targetAgent = agentId ? agents.find(a => a.id === agentId) : agents[0]
      if (!targetAgent) {
        toast.error(t('messages.noAgentAvailable') || '暂无可用的智能体')
        return null
      }
      
      const chatTitle = `文本优化 - ${today}`
      
      const response = await fetcher('/chat', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          title: chatTitle,
          agent_id: targetAgent.id
        })
      })
      
      const newChat = response as Chat
      
      // 保存到 localStorage
      localStorage.setItem(STORAGE_KEY_CHAT_DATE, today)
      localStorage.setItem(STORAGE_KEY_CHAT_ID, newChat.id.toString())
      
      // 添加到全局缓存
      addChatToCache(newChat)
      
      return newChat
    } catch (error) {
      console.error('Failed to get or create today chat:', error)
      toast.error(t('messages.chatInitFailed') || '初始化对话失败')
      return null
    }
  }

  // 初始化：获取 agents 列表
  useEffect(() => {
    const initAgents = async () => {
      try {
        const agentsList = await fetchAgents()
        // 设置默认 Agent 为第一个
        if (agentsList.length > 0 && !selectedAgentId) {
          setSelectedAgentId(agentsList[0].id)
        }
      } catch (error) {
        console.error('Failed to load agents:', error)
      }
    }
    
    initAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 初始化：获取或创建当天的 chat
  useEffect(() => {
    const initChat = async () => {
      if (!selectedAgentId) return
      
      setIsLoadingChat(true)
      const chat = await getOrCreateTodayChat(selectedAgentId)
      setCurrentChat(chat)
      setIsLoadingChat(false)
    }
    
    initChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgentId])

  // 从 localStorage 加载保存的文本
  useEffect(() => {
    try {
      const savedOriginal = localStorage.getItem(STORAGE_KEY_ORIGINAL)
      const savedOptimized = localStorage.getItem(STORAGE_KEY_OPTIMIZED)
      
      if (savedOriginal) setOriginalText(savedOriginal)
      if (savedOptimized) setOptimizedText(savedOptimized)
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
    }
  }, [])

  // 保存原始文本到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ORIGINAL, originalText)
    } catch (error) {
      console.error('Failed to save original text:', error)
    }
  }, [originalText])

  // 保存优化后文本到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_OPTIMIZED, optimizedText)
    } catch (error) {
      console.error('Failed to save optimized text:', error)
    }
  }, [optimizedText])

  /**
   * 生成优化后的文本
   * 通过 chat 消息系统调用 AI 进行文本优化
   */
  const handleGenerate = async () => {
    // 验证输入
    if (!originalText.trim()) {
      toast.error(t('messages.emptyInput'))
      return
    }

    // 检查 chat 是否已初始化
    if (!currentChat) {
      toast.error(t('messages.chatNotReady') || 'Chat 未就绪，请稍后重试')
      return
    }

    // 检查是否可以发送消息
    if (!canSendMessage(currentChat.id)) {
      toast.error(t('messages.chatLocked') || '有其他对话正在进行中，请等待完成')
      return
    }

    setIsGenerating(true)
    setOptimizedText('') // 清空之前的优化结果
    
    // 开始对话状态
    startChat(currentChat.id, currentChat.title)

    try {
      // 创建新的 AbortController
      abortController.current = new AbortController()
      
      let assistantContent = ''
      
      // 发送消息到 chat（使用流式响应）
      await fetcher('/chat/message?stream=true', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          content: originalText.trim(),
          chat_id: currentChat.id,
          role: 'user'
        }),
        headers: { 'Content-Type': 'application/json' },
        stream: true,
        signal: abortController.current.signal,
      },
      (chunk: string) => {
        // 检查是否是 token 统计信息
        if (chunk.includes('__TOKEN_USAGE__') && chunk.includes('__END__')) {
          // 忽略 token 统计信息
          return
        }
        
        assistantContent += chunk
        setOptimizedText(assistantContent)
      })
      
      // 流式响应完成
      toast.success(t('messages.generateSuccess'))
      
      // 更新全局缓存（添加用户消息和 AI 回复）
      const now = new Date().toISOString()
      addMessageToChat(currentChat.id, {
        id: Date.now(),
        content: originalText.trim(),
        role: 'user',
        created_at: now,
        updated_at: now
      })
      
      addMessageToChat(currentChat.id, {
        id: Date.now() + 1,
        content: assistantContent,
        role: 'assistant',
        created_at: now,
        updated_at: now
      })
      
    } catch (error: unknown) {
      // 错误处理
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info(t('messages.generateCancelled') || '已取消优化')
      } else {
        console.error('Failed to generate optimized text:', error)
        const errorMessage = (error as { detail?: string; message?: string })?.detail || 
                            (error as { detail?: string; message?: string })?.message || 
                            t('messages.generateFailed')
        toast.error(errorMessage)
      }
    } finally {
      setIsGenerating(false)
      endChat()
    }
  }
  
  /**
   * 停止生成
   */
  const handleStopGeneration = () => {
    if (abortController.current) {
      abortController.current.abort()
      abortController.current = null
    }
    setIsGenerating(false)
    endChat()
  }

  /**
   * 切换 Agent 处理函数
   */
  const handleAgentChange = async (agentId: number) => {
    if (agentId === selectedAgentId) return
    
    setSelectedAgentId(agentId)
    
    // 如果存在当前 chat，更新其 agent_id；否则会触发 useEffect 创建新的
    if (currentChat) {
      try {
        const response = await fetcher(`/chat/${currentChat.id}`, {
          method: 'PUT',
          auth: true,
          body: JSON.stringify({ agent_id: agentId })
        })
        const updatedChat = response as Chat
        setCurrentChat(updatedChat)
        toast.success(t('messages.agentSwitched') || '智能体已切换')
      } catch (error) {
        console.error('Failed to update chat agent:', error)
        toast.error(t('messages.agentSwitchFailed') || '切换智能体失败')
        // 失败时回退到之前的 agent
        setSelectedAgentId(currentChat.agent_id)
      }
    } else {
      // 清空当前 chat，会触发 useEffect 重新创建
      setCurrentChat(null)
    }
    
    // 清空优化结果
    setOptimizedText('')
  }

  return (
    <div className="flex flex-col w-full h-full">
      {/* 主编辑区域 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 左侧面板 - 原始文本 */}
        <TextEditorPanel
          title={t('originalText')}
          value={originalText}
          onChange={setOriginalText}
          placeholder={t('placeholder.original')}
          isCollapsed={isLeftCollapsed}
          onToggleCollapse={handleToggleLeft}
          collapsePosition="left"
          panelType="original"
          maxLength={4096}
          agents={agents || []}
          selectedAgentId={selectedAgentId}
          onAgentChange={handleAgentChange}
          agentsLoading={agentsLoading}
        />

        {/* 中间竖线分隔符 */}
        {!isLeftCollapsed && !isRightCollapsed && (
          <div className="w-px bg-border flex-shrink-0" />
        )}

        {/* 中间悬浮生成按钮 */}
        {!isLeftCollapsed && !isRightCollapsed && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <Button
              onClick={isGenerating ? handleStopGeneration : handleGenerate}
              disabled={isLoadingChat || !currentChat || (!isGenerating && !originalText.trim())}
              size="icon"
              className={cn(
                "h-16 w-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-300",
                isGenerating 
                  ? "bg-red-500 hover:bg-red-600" 
                  : "bg-primary hover:bg-primary/90"
              )}
              title={
                isLoadingChat 
                  ? t('actions.initializing') || '初始化中...'
                  : isGenerating 
                  ? t('actions.stop') || '停止' 
                  : t('actions.generate')
              }
            >
              {isLoadingChat ? (
                <div className="h-7 w-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isGenerating ? (
                <div className="h-6 w-6 border-2 border-white" />
              ) : (
                <Sparkles className="h-7 w-7" />
              )}
            </Button>
          </div>
        )}

        {/* 右侧面板 - 优化后文本 */}
        <TextEditorPanel
          title={t('optimizedText')}
          value={optimizedText}
          onChange={setOptimizedText}
          placeholder={t('placeholder.optimized')}
          isCollapsed={isRightCollapsed}
          onToggleCollapse={handleToggleRight}
          collapsePosition="right"
          panelType="optimized"
        />
      </div>
    </div>
  )
}

