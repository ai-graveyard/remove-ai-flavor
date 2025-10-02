'use client'

import React from 'react'
import { Star, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MembershipType } from '@/app/[locale]/types'

/**
 * 图标大小
 */
export type IconSize = 'sm' | 'md' | 'lg'

/**
 * 会员类型图标组件属性
 */
export interface MembershipIconProps {
  /** 会员类型 */
  type: MembershipType
  /** 图标大小，默认 md */
  size?: IconSize
  /** 是否显示文本标签 */
  showLabel?: boolean
  /** 文本标签内容（如果不提供，则使用默认的会员类型名称） */
  label?: string
  /** 额外的 className */
  className?: string
}

/**
 * 会员类型图标组件
 * 
 * 功能：
 * - 根据会员类型显示对应的图标（星/月/日）
 * - 支持不同尺寸
 * - 可选择性显示文本标签
 * - 统一的样式和颜色
 * 
 * 性能优化：
 * - 使用 React.memo 避免不必要的重渲染
 * 
 * 使用示例：
 * ```tsx
 * // 仅图标
 * <MembershipIcon type="monthly" />
 * 
 * // 带标签
 * <MembershipIcon type="yearly" showLabel label="年度会员" />
 * 
 * // 自定义大小
 * <MembershipIcon type="free" size="lg" />
 * ```
 */
export const MembershipIcon = React.memo(function MembershipIcon({
  type,
  size = 'md',
  showLabel = false,
  label,
  className
}: MembershipIconProps) {
  // 根据大小确定图标尺寸类名
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  }

  // 根据会员类型确定图标和颜色
  const iconConfig = {
    free: {
      Icon: Star,
      colorClass: 'text-muted-foreground',
      defaultLabel: '免费会员'
    },
    monthly: {
      Icon: Moon,
      colorClass: 'text-primary',
      defaultLabel: '月度会员'
    },
    yearly: {
      Icon: Sun,
      colorClass: 'text-primary',
      defaultLabel: '年度会员'
    }
  }

  const config = iconConfig[type]
  const IconComponent = config.Icon
  const displayLabel = label || config.defaultLabel

  if (showLabel) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <IconComponent 
          className={cn(
            sizeClasses[size],
            config.colorClass,
            'flex-shrink-0'
          )}
        />
        <span className="truncate">{displayLabel}</span>
      </div>
    )
  }

  return (
    <IconComponent 
      className={cn(
        sizeClasses[size],
        config.colorClass,
        'flex-shrink-0',
        className
      )}
    />
  )
})

/**
 * 会员类型徽章组件（带背景的版本）
 * 
 * 性能优化：
 * - 使用 React.memo 避免不必要的重渲染
 * 
 * 使用示例：
 * ```tsx
 * <MembershipBadge type="monthly" />
 * ```
 */
export const MembershipBadge = React.memo(function MembershipBadge({
  type,
  size = 'md',
  className
}: Omit<MembershipIconProps, 'showLabel' | 'label'>) {
  const badgeConfig = {
    free: {
      bgClass: 'bg-muted',
      textClass: 'text-muted-foreground'
    },
    monthly: {
      bgClass: 'bg-primary/10',
      textClass: 'text-primary'
    },
    yearly: {
      bgClass: 'bg-accent',
      textClass: 'text-accent-foreground'
    }
  }

  const config = badgeConfig[type]

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-md',
      config.bgClass,
      config.textClass,
      className
    )}>
      <MembershipIcon type={type} size={size} />
    </div>
  )
})

