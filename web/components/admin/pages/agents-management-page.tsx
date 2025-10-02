'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AgentRow } from '@/components/admin/components/agent-row'
import CreateAgentModal from '@/components/admin/dialogs/create-agent-modal'
import DeleteAgentModal from '@/components/admin/dialogs/delete-agent-modal'
import { useAgentsAdmin } from '@/hooks/use-agents-admin'
import type { 
  Agent, 
  AgentUpdateRequest
} from '@/app/[locale]/types'

/**
 * Agents 管理页面（重构版）
 * 
 * 功能：
 * - 显示所有 Agent 列表
 * - 支持搜索、筛选、排序
 * - 支持创建、编辑、删除 Agent
 * - 分页加载
 * 
 * 重构改进：
 * - 使用 useAgentsAdmin Hook 简化 API 调用逻辑
 * - 减少 ~50 行状态管理代码
 * - 提升代码可读性和可维护性
 */
export default function AgentsManagementPage() {
  const t = useTranslations()

  // 使用自定义 Hook 管理 Agent 数据
  const {
    agents,
    loading,
    error,
    paginationInfo,
    searchParams,
    setSearchParams,
    refreshAgents,
    updateAgent,
    deleteAgent
  } = useAgentsAdmin()

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null)

  /**
   * 处理分页变化
   * 使用 useCallback 优化，避免子组件不必要的重渲染
   */
  const handlePageChange = useCallback((page: number) => {
    const newOffset = (page - 1) * searchParams.limit
    setSearchParams(prev => ({
      ...prev,
      offset: newOffset,
    }))
  }, [searchParams.limit, setSearchParams])

  /**
   * 更新 Agent
   */
  const handleUpdateAgent = useCallback(async (agentId: number, updates: AgentUpdateRequest) => {
    try {
      await updateAgent(agentId, updates)
    } catch (err) {
      console.error('Failed to update agent:', err)
    }
  }, [updateAgent])

  /**
   * 删除 Agent
   */
  const handleDeleteAgent = useCallback((agent: Agent) => {
    setDeletingAgent(agent)
  }, [])

  /**
   * 创建 Agent
   */
  const handleCreateAgent = useCallback(() => {
    setShowCreateModal(true)
  }, [])

  /**
   * 编辑 Agent
   */
  const handleEditAgent = useCallback((agent: Agent) => {
    setEditingAgent(agent)
  }, [])

  /**
   * Agent 保存回调（创建/更新后）
   */
  const handleAgentSaved = useCallback(() => {
    refreshAgents()
    setShowCreateModal(false)
    setEditingAgent(null)
  }, [refreshAgents])

  /**
   * Agent 删除确认回调
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingAgent) return

    try {
      await deleteAgent(deletingAgent.id, deletingAgent.is_deleted)
      setDeletingAgent(null)
    } catch (err) {
      console.error('Failed to delete agent:', err)
    }
  }, [deletingAgent, deleteAgent])

  /**
   * 计算分页显示的起止记录数
   * 使用 useMemo 避免每次渲染都重新计算
   */
  const { startRecord, endRecord } = useMemo(() => ({
    startRecord: searchParams.offset + 1,
    endRecord: Math.min(searchParams.offset + searchParams.limit, paginationInfo.total)
  }), [searchParams.offset, searchParams.limit, paginationInfo.total])

  return (
    <div className="p-6 max-w-full mx-auto overflow-x-hidden">
      {/* 搜索和筛选 */}
      <div className="bg-card rounded-lg p-6 shadow-sm border border-border mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Search className="text-muted-foreground" />
            <Input
              placeholder={t('admin.agents.search')}
              value={searchParams.name || ''}
              onChange={(e) => setSearchParams(prev => ({ ...prev, name: e.target.value, offset: 0 }))}
              className="flex-1 max-w-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={searchParams.source || ''}
              onChange={(e) => setSearchParams(prev => ({ ...prev, source: e.target.value, offset: 0 }))}
              className="border border-border rounded px-3 py-2 bg-background text-sm"
            >
              <option value="">{t('admin.agents.allSources')}</option>
              <option value="llm">{t('source.llm')}</option>
              <option value="dify">{t('source.dify')}</option>
              <option value="fastgpt">{t('source.fastgpt')}</option>
              <option value="coze">{t('source.coze')}</option>
              <option value="custom">{t('source.custom')}</option>
            </select>
            <select
              value={searchParams.is_deleted === undefined ? 'all' : searchParams.is_deleted ? 'deleted' : 'active'}
              onChange={(e) => {
                const value = e.target.value === 'all' ? undefined : e.target.value === 'deleted'
                setSearchParams(prev => ({ ...prev, is_deleted: value, offset: 0 }))
              }}
              className="border border-border rounded px-3 py-2 bg-background text-sm"
            >
              <option value="all">{t('admin.agents.allStatuses')}</option>
              <option value="active">{t('admin.agents.activeOnly')}</option>
              <option value="deleted">{t('admin.agents.deletedOnly')}</option>
            </select>
            <Button onClick={handleCreateAgent} size="sm">
              {t('admin.agents.createAgent')}
            </Button>
          </div>
        </div>
      </div>

      {/* Agent 列表 */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto">
        {loading && (
          <div className="p-8 text-center text-muted-foreground">
            {t('common.actions.loading')}
          </div>
        )}
        {error && !loading && (
          <div className="p-8 text-center text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && agents.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            {t('admin.agents.noAgents')}
          </div>
        )}
        {!loading && !error && agents.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 backdrop-blur-sm border-b border-primary/20">
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[60px]">
                    {t('table.id')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[120px]">
                    {t('agent.name')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[80px]">
                    {t('agent.source')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[150px]">
                    {t('agent.apiUrl')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[100px]">
                    {t('agent.apiKey')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[100px]">
                    {t('agent.modelConf')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[100px]">
                    {t('agent.thinkingMode')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[100px]">
                    {t('agent.streamMode')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[120px]">
                    {t('agent.requiredMembership')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[80px]">
                    {t('table.status')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[100px]">
                    {t('agent.availability')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[140px]">
                    {t('table.createdTime')}
                  </TableHead>
                  <TableHead className="text-primary dark:text-primary font-semibold min-w-[80px]">
                    {t('table.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    onUpdate={handleUpdateAgent}
                    onDelete={handleDeleteAgent}
                    onEdit={handleEditAgent}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* 分页 */}
      {!loading && !error && paginationInfo.total > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t('table.pagination.showing', {
              start: startRecord,
              end: endRecord,
              total: paginationInfo.total
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(paginationInfo.current_page - 1)}
              disabled={!paginationInfo.has_prev}
            >
              {t('table.pagination.previous')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('table.pagination.page', {
                current: paginationInfo.current_page,
                total: paginationInfo.total_pages
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(paginationInfo.current_page + 1)}
              disabled={!paginationInfo.has_next}
            >
              {t('table.pagination.next')}
            </Button>
          </div>
        </div>
      )}

      {/* 创建/编辑 Agent Modal */}
      <CreateAgentModal
        isOpen={showCreateModal || editingAgent !== null}
        onClose={() => {
          setShowCreateModal(false)
          setEditingAgent(null)
        }}
        onAgentSaved={handleAgentSaved}
        editingAgent={editingAgent}
      />

      {/* 删除 Agent Modal */}
      <DeleteAgentModal
        agent={deletingAgent}
        onClose={() => setDeletingAgent(null)}
        onAgentUpdated={handleDeleteConfirm}
      />
    </div>
  )
}

