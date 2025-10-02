'use client'

import { useState, useCallback, useEffect } from 'react'
import { fetcher } from '@/util/fetcher'
import type { 
  Agent, 
  AgentSearchParams, 
  AgentListResponse,
  AgentUpdateRequest
} from '@/app/[locale]/types'

/**
 * 分页信息
 */
export interface PaginationInfo {
  total: number
  total_pages: number
  current_page: number
  has_next: boolean
  has_prev: boolean
}

/**
 * useAgentsAdmin Hook 返回值
 */
export interface UseAgentsAdminReturn {
  /** Agent 列表 */
  agents: Agent[]
  /** 是否正在加载 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 分页信息 */
  paginationInfo: PaginationInfo
  /** 搜索参数 */
  searchParams: AgentSearchParams
  /** 设置搜索参数 */
  setSearchParams: (params: AgentSearchParams | ((prev: AgentSearchParams) => AgentSearchParams)) => void
  /** 刷新 Agent 列表 */
  refreshAgents: () => Promise<void>
  /** 更新 Agent */
  updateAgent: (agentId: number, updates: AgentUpdateRequest) => Promise<void>
  /** 删除或恢复 Agent */
  deleteAgent: (agentId: number, restore?: boolean) => Promise<void>
}

/**
 * useAgentsAdmin Hook 参数
 */
export interface UseAgentsAdminOptions {
  /** 初始搜索参数 */
  initialSearchParams?: Partial<AgentSearchParams>
  /** 是否自动加载 */
  autoLoad?: boolean
}

/**
 * 管理后台的 Agent 管理 Hook
 * 
 * 功能：
 * - 获取 Agent 列表（带分页）
 * - 搜索和筛选
 * - 更新 Agent
 * - 删除/恢复 Agent
 * 
 * 使用示例：
 * ```tsx
 * const {
 *   agents,
 *   loading,
 *   error,
 *   paginationInfo,
 *   searchParams,
 *   setSearchParams,
 *   refreshAgents,
 *   updateAgent,
 *   deleteAgent
 * } = useAgentsAdmin()
 * ```
 */
export function useAgentsAdmin(options: UseAgentsAdminOptions = {}): UseAgentsAdminReturn {
  const {
    initialSearchParams = {},
    autoLoad = true
  } = options

  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    total: 0,
    total_pages: 0,
    current_page: 1,
    has_next: false,
    has_prev: false,
  })
  const [searchParams, setSearchParams] = useState<AgentSearchParams>({
    limit: 10,
    offset: 0,
    sort_by: 'id',
    sort_order: 'asc',
    ...initialSearchParams,
  })

  /**
   * 获取 Agent 列表
   */
  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // 构建查询参数
      const queryParams = new URLSearchParams()
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value))
        }
      })

      const url = `/admin/agents?${queryParams.toString()}`
      const response = await fetcher<AgentListResponse>(url, { auth: true })

      if (response) {
        setAgents(response.agents || [])
        setPaginationInfo({
          total: response.total || 0,
          total_pages: response.total_pages || 0,
          current_page: response.current_page || 1,
          has_next: response.has_next || false,
          has_prev: response.has_prev || false,
        })
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err)
      setError('Failed to load agent data')
      setAgents([])
      setPaginationInfo({
        total: 0,
        total_pages: 0,
        current_page: 1,
        has_next: false,
        has_prev: false,
      })
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  /**
   * 刷新 Agent 列表
   */
  const refreshAgents = useCallback(async () => {
    await fetchAgents()
  }, [fetchAgents])

  /**
   * 更新 Agent
   */
  const updateAgent = useCallback(async (agentId: number, updates: AgentUpdateRequest) => {
    try {
      await fetcher(`/admin/agents/${agentId}`, {
        method: 'PUT',
        auth: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      // 更新成功后刷新列表
      await fetchAgents()
    } catch (err) {
      console.error('Failed to update agent:', err)
      throw new Error('Failed to update agent')
    }
  }, [fetchAgents])

  /**
   * 删除或恢复 Agent
   */
  const deleteAgent = useCallback(async (agentId: number, restore = false) => {
    try {
      await fetcher(`/admin/agents/${agentId}`, {
        method: 'DELETE',
        auth: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restore }),
      })
      // 删除成功后刷新列表
      await fetchAgents()
    } catch (err) {
      console.error('Failed to delete agent:', err)
      throw new Error('Failed to delete agent')
    }
  }, [fetchAgents])

  // 自动加载
  useEffect(() => {
    if (autoLoad) {
      fetchAgents()
    }
  }, [autoLoad, fetchAgents])

  return {
    agents,
    loading,
    error,
    paginationInfo,
    searchParams,
    setSearchParams,
    refreshAgents,
    updateAgent,
    deleteAgent,
  }
}

