'use client'

import React, { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Bot, Edit2, Plus, Trash2, RotateCcw, Eye, EyeOff, Zap, ZapOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MembershipIcon } from '@/components/common/membership-icon'
import { TableCell, TableRow } from '@/components/ui/table'
import AgentAvailabilityStatus from '@/components/admin/components/agent-availability-status'
import { formatDateTime } from '@/util/dateFormat'
import type { Agent, AgentUpdateRequest, AgentSource, MembershipType } from '@/app/[locale]/types'

/**
 * Agent 行组件属性
 */
export interface AgentRowProps {
  agent: Agent
  onUpdate: (agentId: number, updates: AgentUpdateRequest) => void
  onDelete: (agent: Agent) => void
  onEdit: (agent: Agent) => void
  onCreate?: () => void
  showCreateButton?: boolean
}

/**
 * Agent 表格行组件
 * 
 * 功能：
 * - 显示 Agent 的所有信息
 * - 支持行内编辑
 * - 支持删除/恢复操作
 * - 显示可用性状态
 * 
 * 性能优化：
 * - 使用 React.memo 避免不必要的重渲染
 * - 使用 useCallback 优化事件处理函数
 */
export const AgentRow = React.memo(function AgentRow({ 
  agent, 
  onUpdate, 
  onDelete, 
  onEdit, 
  onCreate, 
  showCreateButton 
}: AgentRowProps) {
  const t = useTranslations()
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<AgentUpdateRequest>({
    name: agent.name,
    source: agent.source,
    api_url: agent.api_url,
    api_key: agent.api_key,
    model_conf: agent.model_conf,
    is_think: agent.is_think,
    is_stream: agent.is_stream,
    required_membership_type: agent.required_membership_type,
  })

  /**
   * 保存编辑
   */
  const handleSave = useCallback(() => {
    onUpdate(agent.id, editData)
    setIsEditing(false)
  }, [agent.id, editData, onUpdate])

  /**
   * 取消编辑并恢复原始数据
   */
  const handleCancel = useCallback(() => {
    setEditData({
      name: agent.name,
      source: agent.source,
      api_url: agent.api_url,
      api_key: agent.api_key,
      model_conf: agent.model_conf,
      is_think: agent.is_think,
      is_stream: agent.is_stream,
      required_membership_type: agent.required_membership_type,
    })
    setIsEditing(false)
  }, [agent])

  /**
   * 获取 Agent 来源图标
   */
  const getSourceIcon = useCallback(() => {
    return <Bot className="w-3 h-3 mr-1" />
  }, [])

  /**
   * 获取 Agent 来源文本
   */
  const getSourceText = useCallback((source: string) => {
    switch (source) {
      case 'llm':
        return t('admin.agents.sources.llm')
      case 'dify':
        return t('admin.agents.sources.dify')
      case 'fastgpt':
        return t('admin.agents.sources.fastgpt')
      case 'coze':
        return t('admin.agents.sources.coze')
      case 'custom':
        return t('admin.agents.sources.custom')
      default:
        return source
    }
  }, [t])

  /**
   * 掩码 API Key（只显示前4位和后4位）
   */
  const maskApiKey = useCallback((apiKey: string | null | undefined) => {
    if (!apiKey || apiKey.length <= 8) return '***'
    return apiKey.slice(0, 4) + '***' + apiKey.slice(-4)
  }, [])

  return (
    <TableRow className="hover:bg-muted/50 h-16">
      {/* ID */}
      <TableCell className="text-sm text-foreground">{agent.id}</TableCell>

      {/* Agent Name */}
      <TableCell className="text-sm text-foreground">
        {isEditing ? (
          <Input
            value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            className="w-full text-sm"
            placeholder={t('agent.namePlaceholder')}
          />
        ) : (
          <div className="flex items-center">
            <Bot className="w-4 h-4 mr-2 text-primary" />
            <span className="text-sm text-foreground">{agent.name}</span>
          </div>
        )}
      </TableCell>

      {/* Source */}
      <TableCell className="text-sm text-foreground">
        {isEditing ? (
          <select
            value={editData.source}
            onChange={(e) => setEditData({ ...editData, source: e.target.value as AgentSource })}
            className="w-full text-sm border border-border rounded px-2 py-1 bg-background"
          >
            <option value="llm">{t('source.llm')}</option>
            <option value="dify">{t('source.dify')}</option>
            <option value="fastgpt">{t('source.fastgpt')}</option>
            <option value="coze">{t('source.coze')}</option>
            <option value="custom">{t('source.custom')}</option>
          </select>
        ) : (
          <div className="flex items-center">
            {getSourceIcon()}
            <span className="text-sm text-foreground">{getSourceText(agent.source)}</span>
          </div>
        )}
      </TableCell>

      {/* API URL */}
      <TableCell className="text-sm text-foreground">
        {isEditing ? (
          <Input
            value={editData.api_url}
            onChange={(e) => setEditData({ ...editData, api_url: e.target.value })}
            className="w-full text-sm"
            placeholder={t('agent.apiUrlPlaceholder')}
          />
        ) : (
          <span className="text-sm text-muted-foreground truncate max-w-xs" title={agent.api_url}>
            {agent.api_url}
          </span>
        )}
      </TableCell>

      {/* API Key */}
      <TableCell className="text-sm text-foreground">
        {isEditing ? (
          <Input
            type="password"
            value={editData.api_key}
            onChange={(e) => setEditData({ ...editData, api_key: e.target.value })}
            className="w-full text-sm"
            placeholder={t('agent.apiKeyPlaceholder')}
          />
        ) : (
          <span className="text-sm text-muted-foreground font-mono">
            {maskApiKey(agent.api_key)}
          </span>
        )}
      </TableCell>

      {/* Model Config */}
      <TableCell className="text-sm text-foreground">
        {isEditing ? (
          <textarea
            value={editData.model_conf ? JSON.stringify(editData.model_conf, null, 2) : ''}
            onChange={(e) => {
              try {
                const parsed = e.target.value ? JSON.parse(e.target.value) : null
                setEditData({ ...editData, model_conf: parsed })
              } catch {
                // Invalid JSON, keep as null to allow continued editing
                setEditData({ ...editData, model_conf: null })
              }
            }}
            className="w-full text-xs border border-border rounded px-2 py-1 bg-background font-mono h-16 resize-none"
            placeholder={t('agent.modelConfPlaceholder')}
          />
        ) : (
          <div className="text-xs text-muted-foreground">
            {agent.model_conf ? (
              <div className="font-mono max-w-xs">
                <details className="cursor-pointer">
                  <summary className="text-primary hover:underline">
                    View Config
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(agent.model_conf, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <span className="text-muted-foreground">No config</span>
            )}
          </div>
        )}
      </TableCell>

      {/* Thinking Mode */}
      <TableCell className="text-sm text-foreground">
        {isEditing ? (
          <input
            type="checkbox"
            checked={editData.is_think}
            onChange={(e) => setEditData({ ...editData, is_think: e.target.checked })}
            className="rounded"
          />
        ) : (
          <div className="flex items-center">
            {agent.is_think ? (
              <Eye className="w-4 h-4 text-chart-4" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="ml-1 text-sm text-foreground">
              {agent.is_think ? t('ui.enabled') : t('ui.disabled')}
            </span>
          </div>
        )}
      </TableCell>

      {/* Stream Mode */}
      <TableCell className="text-sm text-foreground">
        {isEditing ? (
          <input
            type="checkbox"
            checked={editData.is_stream}
            onChange={(e) => setEditData({ ...editData, is_stream: e.target.checked })}
            className="rounded"
          />
        ) : (
          <div className="flex items-center">
            {agent.is_stream ? (
              <Zap className="w-4 h-4 text-primary" />
            ) : (
              <ZapOff className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="ml-1 text-sm text-foreground">
              {agent.is_stream ? t('ui.enabled') : t('ui.disabled')}
            </span>
          </div>
        )}
      </TableCell>

      {/* Required Membership */}
      <TableCell className="text-sm text-foreground">
        {isEditing ? (
          <select
            value={editData.required_membership_type}
            onChange={(e) => setEditData({ ...editData, required_membership_type: e.target.value as MembershipType })}
            className="w-full text-sm border border-border rounded px-2 py-1 bg-background"
          >
            <option value="free">{t('membership.free')}</option>
            <option value="monthly">{t('membership.monthly')}</option>
            <option value="yearly">{t('membership.yearly')}</option>
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <MembershipIcon 
              type={agent.required_membership_type} 
              size="lg" 
            />
            <span className="text-sm text-foreground">
              {t(`membership.${agent.required_membership_type}`)}
            </span>
          </div>
        )}
      </TableCell>

      {/* Status */}
      <TableCell className="text-sm text-foreground">
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${agent.is_deleted ? 'bg-destructive' : 'bg-chart-4'}`}></div>
          <span className={`text-sm ${agent.is_deleted ? 'text-destructive' : 'text-chart-4'}`}>
            {agent.is_deleted ? t('ui.deleted') : t('ui.normal')}
          </span>
        </div>
      </TableCell>

      {/* Availability */}
      <TableCell className="text-sm text-foreground">
        <AgentAvailabilityStatus agentId={agent.id} agentName={agent.name} />
      </TableCell>

      {/* Created Time */}
      <TableCell className="text-sm text-muted-foreground">
        {formatDateTime(agent.created_at)}
      </TableCell>

      {/* Actions */}
      <TableCell className="text-sm text-foreground">
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <Button size="sm" onClick={handleSave}>
                {t('ui.save')}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                {t('ui.cancel')}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(agent)}
                title={t('agent.editAgent')}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant={agent.is_deleted ? "outline" : "destructive"}
                onClick={() => onDelete(agent)}
                title={agent.is_deleted ? t('agent.restoreAgent') : t('agent.deleteAgent')}
              >
                {agent.is_deleted ? (
                  <RotateCcw className="w-3 h-3" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </Button>
              {showCreateButton && onCreate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCreate}
                  title={t('agent.createAgent')}
                  className="ml-1"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              )}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
})

