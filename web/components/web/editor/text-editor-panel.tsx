'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Clipboard, Copy, Download, Trash2 } from 'lucide-react'

import type { Agent } from '@/app/[locale]/types'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MembershipIcon } from '@/components/common/membership-icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

/**
 * 文本编辑面板组件属性
 */
interface TextEditorPanelProps {
  /** 面板标题 */
  title: string
  /** 文本内容 */
  value: string
  /** 内容改变回调 */
  onChange: (value: string) => void
  /** 占位符文本 */
  placeholder: string
  /** 是否只读 */
  readOnly?: boolean
  /** 是否折叠 */
  isCollapsed: boolean
  /** 折叠状态改变回调 */
  onToggleCollapse: () => void
  /** 折叠按钮位置（左侧或右侧） */
  collapsePosition: 'left' | 'right'
  /** 面板类型（原始文本或优化后文本） */
  panelType?: 'original' | 'optimized'
  /** 最大字符数限制 */
  maxLength?: number
  /** Agent 列表（仅原始文本面板使用） */
  agents?: Agent[]
  /** 选中的 Agent ID */
  selectedAgentId?: number
  /** Agent 改变回调 */
  onAgentChange?: (agentId: number) => void
  /** Agent 列表加载状态 */
  agentsLoading?: boolean
}

/**
 * 文本编辑面板组件
 * 
 * 功能：
 * - 显示和编辑文本
 * - 显示字符、字数、行数统计
 * - 支持粘贴（原始文本）、复制（优化后文本）、清空、下载操作
 * - 支持折叠/展开
 */
export function TextEditorPanel({
  title,
  value,
  onChange,
  placeholder,
  readOnly = false,
  isCollapsed,
  onToggleCollapse,
  collapsePosition,
  panelType = 'original',
  maxLength,
  agents = [],
  selectedAgentId,
  onAgentChange,
  agentsLoading = false
}: TextEditorPanelProps) {
  const t = useTranslations('editor')
  const [stats, setStats] = useState({ characters: 0, words: 0, lines: 0 })

  // 计算文本统计信息
  useEffect(() => {
    const characters = value.length
    const words = value.trim() ? value.trim().split(/\s+/).length : 0
    const lines = value ? value.split('\n').length : 0
    setStats({ characters, words, lines })
  }, [value])

  // 粘贴文本到编辑器
  const handlePaste = async () => {
    if (readOnly) {
      return
    }
    
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        toast.error(t('messages.pasteEmpty'))
        return
      }
      onChange(text)
      toast.success(t('messages.pasteSuccess'))
    } catch (error) {
      console.error('Paste failed:', error)
      toast.error(t('messages.pasteFailed'))
    }
  }

  // 复制文本到剪贴板
  const handleCopy = async () => {
    if (!value) {
      toast.error(t('messages.copyFailed'))
      return
    }
    
    try {
      await navigator.clipboard.writeText(value)
      toast.success(t('messages.copySuccess'))
    } catch (error) {
      console.error('Copy failed:', error)
      toast.error(t('messages.copyFailed'))
    }
  }

  // 清空文本
  const handleClear = () => {
    onChange('')
  }

  // 下载文本文件
  const handleDownload = () => {
    if (!value) {
      return
    }

    const blob = new Blob([value], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(t('messages.downloadSuccess'))
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full transition-all duration-300',
        isCollapsed ? 'w-12' : 'flex-1'
      )}
    >
      {/* 折叠状态 */}
      {isCollapsed ? (
        <div className="flex flex-col items-center h-full bg-muted/30 border-r">
          <div className="flex h-16 w-full items-center justify-center border-b bg-muted/30 px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              title={t('actions.expand')}
            >
              {collapsePosition === 'left' ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex-1 flex items-center">
            <span className="writing-mode-vertical text-sm text-muted-foreground whitespace-nowrap">
              {title}
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* 标题栏 */}
          <div className="flex h-16 items-center justify-between border-b bg-muted/30 px-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{title}</h2>
              {/* 原始文本面板显示 Agent 选择器 */}
              {panelType === 'original' && agents && agents.length > 0 && (
                <Select
                  value={selectedAgentId?.toString()}
                  onValueChange={(value) => onAgentChange?.(parseInt(value))}
                  disabled={agentsLoading}
                >
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder={agentsLoading ? t('loading') : t('selectAgent')} />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        <div className="flex items-center gap-2">
                          <MembershipIcon type={agent.required_membership_type} />
                          <span className="truncate">{agent.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 操作按钮 */}
              {/* 原始文本显示粘贴按钮 */}
              {panelType === 'original' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePaste}
                  disabled={readOnly}
                  title={t('actions.paste')}
                >
                  <Clipboard className="h-4 w-4 text-primary" />
                </Button>
              )}
              {/* 优化后文本显示复制按钮 */}
              {panelType === 'optimized' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  disabled={!value}
                  title={t('actions.copy')}
                >
                  <Copy className="h-4 w-4 text-primary" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                disabled={!value}
                title={t('actions.download')}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                disabled={!value || readOnly}
                title={t('actions.clear')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                title={t('actions.collapse')}
              >
                {collapsePosition === 'left' ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 文本编辑区 */}
          <div className="flex-1 p-3 overflow-hidden">
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              readOnly={readOnly}
              maxLength={maxLength}
              className="w-full h-full resize-none font-mono text-sm"
            />
          </div>

          {/* 状态栏 */}
          <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className={cn(maxLength && stats.characters >= maxLength && "text-red-500 font-semibold")}>
                {t('stats.characters')}: {stats.characters}{maxLength ? ` / ${maxLength}` : ''}
              </span>
              <span>
                {t('stats.words')}: {stats.words}
              </span>
              <span>
                {t('stats.lines')}: {stats.lines}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

