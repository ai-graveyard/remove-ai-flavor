'use client'

import {
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type UIEvent,
} from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Clipboard, Copy, Download, Trash2 } from 'lucide-react'

import type { Agent } from '@/app/[locale]/types'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

interface EditorActionButtonProps {
  /** 按钮的可访问名称与悬浮提示。 */
  label: string
  /** 点击按钮时执行的操作。 */
  onClick: () => void
  /** 是否禁用按钮。 */
  disabled?: boolean
  /** 按钮在工具栏中的视觉层级。 */
  tone?: 'primary' | 'neutral' | 'danger'
  /** 按钮图标。 */
  children: ReactNode
}

/**
 * 编辑器标题栏中的图标操作按钮，统一尺寸、状态和悬浮提示。
 *
 * @param label - 按钮的可访问名称与悬浮提示。
 * @param onClick - 点击按钮时执行的操作。
 * @param disabled - 是否禁用按钮。
 * @param tone - 按钮的视觉层级。
 * @param children - 按钮图标。
 */
function EditorActionButton({
  label,
  onClick,
  disabled = false,
  tone = 'neutral',
  children,
}: EditorActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            'size-8 rounded-md text-muted-foreground transition-colors',
            tone === 'primary' &&
              'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
            tone === 'danger' &&
              'hover:bg-destructive/10 hover:text-destructive'
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
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
  const lineNumberLayerRef = useRef<HTMLDivElement>(null)
  // 空编辑器也保留第 1 行；软换行产生的续行不额外编号。
  const textLines = useMemo(() => value.split('\n'), [value])

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

  /**
   * 同步正文与行号层的垂直滚动位置。
   *
   * @param event - 文本域滚动事件。
   */
  const handleEditorScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (lineNumberLayerRef.current) {
      lineNumberLayerRef.current.scrollTop = event.currentTarget.scrollTop
    }
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
            <div className="flex min-w-0 items-center gap-3">
              {/* 左侧使用中性色标记输入区，右侧使用主色标记处理结果。 */}
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-5 w-1 shrink-0 rounded-full',
                    panelType === 'optimized'
                      ? 'bg-primary'
                      : 'bg-muted-foreground/40'
                  )}
                />
                <h2 className="truncate text-base font-semibold tracking-tight">
                  {title}
                </h2>
              </div>
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
            <div className="flex shrink-0 items-center rounded-lg border bg-background/70 p-1">
              {/* 操作按钮 */}
              {/* 原始文本显示粘贴按钮 */}
              {panelType === 'original' && (
                <EditorActionButton
                  onClick={handlePaste}
                  disabled={readOnly}
                  label={t('actions.paste')}
                  tone="primary"
                >
                  <Clipboard className="size-4" />
                </EditorActionButton>
              )}
              {/* 优化后文本显示复制按钮 */}
              {panelType === 'optimized' && (
                <EditorActionButton
                  onClick={handleCopy}
                  disabled={!value}
                  label={t('actions.copy')}
                  tone="primary"
                >
                  <Copy className="size-4" />
                </EditorActionButton>
              )}
              <EditorActionButton
                onClick={handleDownload}
                disabled={!value}
                label={t('actions.download')}
              >
                <Download className="size-4" />
              </EditorActionButton>
              <EditorActionButton
                onClick={handleClear}
                disabled={!value || readOnly}
                label={t('actions.clear')}
                tone="danger"
              >
                <Trash2 className="size-4" />
              </EditorActionButton>
              <div aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
              <EditorActionButton
                onClick={onToggleCollapse}
                label={t('actions.collapse')}
              >
                {collapsePosition === 'left' ? (
                  <ChevronLeft className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </EditorActionButton>
            </div>
          </div>

          {/* 文本编辑区：镜像文本负责让真实行号跟随软换行后的段落高度。 */}
          <div className="flex-1 overflow-hidden py-3 pr-3">
            <div className="relative h-full overflow-hidden rounded-md">
              <div
                ref={lineNumberLayerRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
              >
                <div className="select-none py-2 font-mono text-sm leading-5">
                  {textLines.map((line, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1.75rem_minmax(0,1fr)]"
                    >
                      <span className="pr-1 text-right text-xs leading-5 tabular-nums text-muted-foreground/45">
                        {index + 1}
                      </span>
                      <span className="invisible whitespace-pre-wrap break-words px-2">
                        {line || '\u200b'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleEditorScroll}
                aria-label={title}
                placeholder={placeholder}
                readOnly={readOnly}
                maxLength={maxLength}
                wrap="soft"
                className="relative z-10 h-full w-full resize-none bg-transparent py-2 pr-3 pl-9 font-mono text-sm leading-5 dark:bg-transparent"
              />
            </div>
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

