'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { WandSparkles } from 'lucide-react'
import { toast } from 'sonner'

import { useRouter } from '@/i18n/navigation'
import { TextEditorPanel } from '@/components/web/editor/text-editor-panel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { fetcher } from '@/util/fetcher'
import { useGlobalDataCache } from '@/hooks/use-global-data-cache'
import { useGlobalChatState } from '@/hooks/use-global-chat-state'
import type { Chat } from '@/app/[locale]/types'
import {
  canGuestOptimize,
  getGuestId,
  setGuestUsageCount,
  setGuestUsageExhausted,
} from '@/util/guest-usage'
import {
  clearOptimizationTaskStorage,
  isNewOptimizationTask,
  OPTIMIZATION_TASK_STORAGE_KEYS,
} from '@/util/optimization-task'
import { getValidAccessToken } from '@/util/token'

interface GuestOptimizeResponse {
  /** 优化后的文本。 */
  optimized_text: string
  /** 本次模型调用消耗的 token 数。 */
  tokens_used: number
  /** 服务端记录的访客累计次数。 */
  usage_count: number
  /** 服务端配置的访客次数上限。 */
  usage_limit: number
}

/**
 * 去除 AI 味编辑器组件
 * 
 * 核心功能：
 * - 左右两个可编辑的文本面板
 * - 左侧输入原始文本，右侧展示优化后的文本
 * - 每个面板都可以折叠
 * - 自动保存到 localStorage
 * - 登录用户基于 chat 系统进行文本优化
 * - 未登录访客可进行三次无状态文本优化
 * - 登录用户首次生成时按需创建新的 chat
 * - 用户可通过侧边栏新建并重置当前优化任务
 */
export default function RemoveFlavorEditor() {
  const t = useTranslations('editor')
  const tCommonActions = useTranslations('common.actions')
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // 文本状态
  const [originalText, setOriginalText] = useState('')
  const [optimizedText, setOptimizedText] = useState('')
  
  // UI 状态
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const [isRightCollapsed, setIsRightCollapsed] = useState(false)
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false)
  
  // Chat 状态
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)
  const [isLoadingChat, setIsLoadingChat] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
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

  /**
   * 获取今日日期字符串（YYYY-MM-DD 格式）
   */
  const getTodayDateString = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  /**
   * 恢复当天保存的对话。
   *
   * @returns 当天对话仍然存在时返回对话，否则返回 `null`。
   */
  const getSavedTodayChat = async (): Promise<Chat | null> => {
    try {
      const today = getTodayDateString()
      const savedDate = localStorage.getItem(OPTIMIZATION_TASK_STORAGE_KEYS.chatDate)
      const savedChatId = localStorage.getItem(OPTIMIZATION_TASK_STORAGE_KEYS.chatId)

      if (savedDate !== today || !savedChatId) {
        return null
      }

      const chatId = parseInt(savedChatId, 10)
      if (Number.isNaN(chatId)) {
        localStorage.removeItem(OPTIMIZATION_TASK_STORAGE_KEYS.chatDate)
        localStorage.removeItem(OPTIMIZATION_TASK_STORAGE_KEYS.chatId)
        return null
      }

      const response = await fetcher(`/chat/${chatId}`, {
        method: 'GET',
        auth: true,
      })
      return response as Chat
    } catch (error) {
      console.warn('保存的对话不存在或已被删除，将在首次生成时创建新对话', error)
      localStorage.removeItem(OPTIMIZATION_TASK_STORAGE_KEYS.chatDate)
      localStorage.removeItem(OPTIMIZATION_TASK_STORAGE_KEYS.chatId)
      return null
    }
  }

  /**
   * 为当前优化任务创建新的对话。
   *
   * @param agentId - 新对话使用的 Agent ID。
   * @returns 创建成功的对话，失败时返回 `null`。
   */
  const createOptimizationChat = async (agentId?: number): Promise<Chat | null> => {
    try {
      const availableAgents = await fetchAgents()
      if (availableAgents.length === 0) {
        toast.error(t('messages.noAgentAvailable') || '暂无可用的智能体')
        return null
      }

      // 优先使用用户当前选择的 Agent，否则回退到列表中的第一个。
      const targetAgent = agentId
        ? availableAgents.find(agent => agent.id === agentId)
        : availableAgents[0]
      if (!targetAgent) {
        toast.error(t('messages.noAgentAvailable') || '暂无可用的智能体')
        return null
      }

      const now = new Date()
      const chatTitle = `文本优化 - ${getTodayDateString()} ${now.toTimeString().slice(0, 5)}`

      const response = await fetcher('/chat', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          title: chatTitle,
          agent_id: targetAgent.id
        })
      })

      const newChat = response as Chat
      localStorage.setItem(OPTIMIZATION_TASK_STORAGE_KEYS.chatDate, getTodayDateString())
      localStorage.setItem(OPTIMIZATION_TASK_STORAGE_KEYS.chatId, newChat.id.toString())
      addChatToCache(newChat)

      return newChat
    } catch (error) {
      console.error('Failed to create optimization chat:', error)
      toast.error(t('messages.chatInitFailed') || '初始化对话失败')
      return null
    }
  }

  // 初始化登录态，访客不会继续请求需要认证的数据。
  useEffect(() => {
    const initializeAuthentication = async () => {
      const accessToken = await getValidAccessToken()
      setIsAuthenticated(Boolean(accessToken))
      if (!accessToken) {
        setIsLoadingChat(false)
      }
    }

    initializeAuthentication()
  }, [])

  // 登录用户初始化可用 Agent 列表。
  useEffect(() => {
    const initAgents = async () => {
      if (!isAuthenticated) return

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
  }, [isAuthenticated])

  // 登录用户仅恢复当天已有对话；新对话延迟到首次生成时创建。
  useEffect(() => {
    const initChat = async () => {
      if (!isAuthenticated || !selectedAgentId) return

      setIsLoadingChat(true)
      const chat = await getSavedTodayChat()
      setCurrentChat(chat)
      setIsLoadingChat(false)
    }
    
    initChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedAgentId])

  // 从 localStorage 加载保存的文本
  useEffect(() => {
    try {
      const savedOriginal = localStorage.getItem(OPTIMIZATION_TASK_STORAGE_KEYS.originalText)
      const savedOptimized = localStorage.getItem(OPTIMIZATION_TASK_STORAGE_KEYS.optimizedText)

      if (savedOriginal) setOriginalText(savedOriginal)
      if (savedOptimized) setOptimizedText(savedOptimized)
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
    } finally {
      setIsDraftLoaded(true)
    }
  }, [])

  /**
   * 清空当前优化任务，并消费地址栏中的新建指令。
   */
  const resetOptimizationTask = useCallback(() => {
    try {
      clearOptimizationTaskStorage(localStorage)
    } catch (error) {
      console.error('Failed to clear optimization task storage:', error)
    }

    setOriginalText('')
    setOptimizedText('')
    setCurrentChat(null)
    setIsLoadingChat(false)
    setIsLeftCollapsed(false)
    setIsRightCollapsed(false)
    setIsNewTaskDialogOpen(false)
    router.replace('/')
  }, [router])

  /**
   * 处理新建任务确认弹框的开关状态。
   *
   * 取消或关闭弹框时仅消费新建指令，保留当前编辑内容。
   *
   * @param open - 弹框是否打开。
   */
  const handleNewTaskDialogOpenChange = (open: boolean) => {
    setIsNewTaskDialogOpen(open)
    if (!open) {
      router.replace('/')
    }
  }

  // 消费侧边栏发出的一次性新建指令。
  useEffect(() => {
    if (!isDraftLoaded || !isNewOptimizationTask(new URLSearchParams(searchParams.toString()))) {
      return
    }

    // 流式请求期间拒绝重置，避免消息写入错误的对话。
    if (isGenerating) {
      toast.error(t('messages.newTaskGenerating'))
      router.replace('/')
      return
    }

    const hasDraft = Boolean(originalText || optimizedText)
    if (hasDraft) {
      setIsNewTaskDialogOpen(true)
      return
    }

    resetOptimizationTask()
  }, [
    isDraftLoaded,
    isGenerating,
    optimizedText,
    originalText,
    resetOptimizationTask,
    router,
    searchParams,
    t,
  ])

  // 保存原始文本到 localStorage
  useEffect(() => {
    if (!isDraftLoaded) return

    try {
      if (originalText) {
        localStorage.setItem(OPTIMIZATION_TASK_STORAGE_KEYS.originalText, originalText)
      } else {
        localStorage.removeItem(OPTIMIZATION_TASK_STORAGE_KEYS.originalText)
      }
    } catch (error) {
      console.error('Failed to save original text:', error)
    }
  }, [isDraftLoaded, originalText])

  // 保存优化后文本到 localStorage
  useEffect(() => {
    if (!isDraftLoaded) return

    try {
      if (optimizedText) {
        localStorage.setItem(OPTIMIZATION_TASK_STORAGE_KEYS.optimizedText, optimizedText)
      } else {
        localStorage.removeItem(OPTIMIZATION_TASK_STORAGE_KEYS.optimizedText)
      }
    } catch (error) {
      console.error('Failed to save optimized text:', error)
    }
  }, [isDraftLoaded, optimizedText])

  /**
   * 生成优化后的文本
   * 登录用户走 chat 流式接口，访客走带三次额度限制的无状态接口。
   */
  const handleGenerate = async () => {
    // 验证输入
    if (!originalText.trim()) {
      toast.error(t('messages.emptyInput'))
      return
    }

    if (isAuthenticated === null) {
      return
    }

    // 访客不创建聊天，直接调用无状态文本优化接口。
    if (!isAuthenticated) {
      if (!canGuestOptimize()) {
        toast.error(t('messages.guestLimitReached'))
        router.push('/login')
        return
      }

      setIsGenerating(true)
      setOptimizedText('')
      abortController.current = new AbortController()

      try {
        const guestId = getGuestId()
        if (!guestId) {
          throw new Error(t('messages.guestStorageUnavailable'))
        }

        const response = await fetcher<GuestOptimizeResponse>('/text-optimizer/guest-optimize', {
          method: 'POST',
          auth: false,
          body: JSON.stringify({
            text: originalText.trim(),
            agent_id: selectedAgentId,
          }),
          headers: {
            'Content-Type': 'application/json',
            'X-Guest-ID': guestId,
          },
          signal: abortController.current.signal,
        })

        if (!response) {
          throw new Error(t('messages.generateFailed'))
        }

        setOptimizedText(response.optimized_text)
        setGuestUsageCount(response.usage_count)
        toast.success(t('messages.generateSuccess'))

        if (response.usage_count < response.usage_limit) {
          toast.info(t('messages.guestRemaining', {
            count: response.usage_limit - response.usage_count,
          }))
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          toast.info(t('messages.generateCancelled'))
        } else {
          const requestError = error as Error & { status?: number }
          if (requestError.status === 429) {
            setGuestUsageExhausted()
            toast.error(t('messages.guestLimitReached'))
            router.push('/login')
          } else {
            console.error('Failed to generate guest optimized text:', error)
            toast.error(requestError.message || t('messages.generateFailed'))
          }
        }
      } finally {
        abortController.current = null
        setIsGenerating(false)
      }
      return
    }

    // 新任务首次生成时才创建对话，避免“新建”产生无消息的空记录。
    let activeChat = currentChat
    if (!activeChat) {
      setIsLoadingChat(true)
      activeChat = await createOptimizationChat(selectedAgentId)
      setIsLoadingChat(false)

      if (!activeChat) {
        return
      }
      setCurrentChat(activeChat)
    }

    // 检查是否可以发送消息
    if (!canSendMessage(activeChat.id)) {
      toast.error(t('messages.chatLocked') || '有其他对话正在进行中，请等待完成')
      return
    }

    setIsGenerating(true)
    setOptimizedText('') // 清空之前的优化结果
    
    // 开始对话状态
    startChat(activeChat.id, activeChat.title)

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
          chat_id: activeChat.id,
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
      addMessageToChat(activeChat.id, {
        id: Date.now(),
        content: originalText.trim(),
        role: 'user',
        created_at: now,
        updated_at: now
      })
      
      addMessageToChat(activeChat.id, {
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
      {/* 使用 Shadcn Dialog 确认是否清空当前内容并新建任务。 */}
      <Dialog
        open={isNewTaskDialogOpen}
        onOpenChange={handleNewTaskDialogOpenChange}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('messages.newTaskConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('messages.newTaskConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleNewTaskDialogOpenChange(false)}
            >
              {tCommonActions('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={resetOptimizationTask}
            >
              {t('newTask')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              disabled={
                isAuthenticated === null
                || (isAuthenticated && isLoadingChat)
                || (!isGenerating && !originalText.trim())
              }
              size="icon"
              className={cn(
                "h-16 w-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-300",
                isGenerating 
                  ? "bg-red-500 hover:bg-red-600" 
                  : "bg-primary hover:bg-primary/90"
              )}
              title={
                isAuthenticated === null || (isAuthenticated && isLoadingChat)
                  ? t('actions.initializing') || '初始化中...'
                  : isGenerating 
                  ? t('actions.stop') || '停止' 
                  : t('actions.generate')
              }
            >
              {isAuthenticated === null || (isAuthenticated && isLoadingChat) ? (
                <div className="h-7 w-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isGenerating ? (
                <div className="h-7 w-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <WandSparkles className="size-6" />
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

