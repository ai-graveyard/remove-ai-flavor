'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Crown, Check, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MembershipIcon } from '@/components/common/membership-icon'
import OrdersDialog from '@/components/web/dialogs/orders-dialog'
import { useGlobalUserData } from '@/hooks/use-global-user-data'
import { createStripeCheckout } from '@/util/user-api'
import { formatTokenCount } from '@/util/user-utils'
import { formatCurrency } from '@/util/currency'
import {
  generatePlanOptionsFromBackend,
  canUpgradeToType,
  getUpgradeRestrictionMessage,
  type PlanOption,
} from '@/util/membership-plans'
import type { MembershipType } from '@/app/[locale]/types'

interface UpgradePlanDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * 会员升级对话框组件（重构版）
 * 
 * 功能：
 * - 显示会员计划和价格
 * - 处理升级流程
 * - 管理待支付订单
 * 
 * 重构改进：
 * - 提取计划生成逻辑到 util/membership-plans.ts
 * - 使用 MembershipIcon 统一图标显示
 * - 添加性能优化（useMemo、useCallback）
 * - 使用语义化颜色变量
 * - 提取 PlanCard 子组件
 */
export default function UpgradePlanDialog({ 
  open: externalOpen, 
  onOpenChange 
}: UpgradePlanDialogProps = {}) {
  const t = useTranslations()
  const {
    userProfile,
    userProfileLoading,
    membershipPlans,
    membershipPlansLoading,
    pendingOrders,
    userOrdersLoading,
    refreshUserOrders
  } = useGlobalUserData()

  const [isUpgrading, setIsUpgrading] = useState(false)
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null)
  const [internalOpen, setInternalOpen] = useState(false)
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false)

  // 使用外部控制的 open 状态，如果没有提供则使用内部状态
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  // 计算状态
  const isLoading = userProfileLoading || membershipPlansLoading
  const hasPendingOrder = pendingOrders.length > 0
  const isRefreshingOrders = userOrdersLoading
  const isExternallyControlled = externalOpen !== undefined
  const currentMembershipType: MembershipType = userProfile?.membership_type || 'free'

  // 如果是外部控制模式，总是渲染；否则判断是否为付费会员
  const shouldRender = isExternallyControlled || 
    !(userProfile && (currentMembershipType === 'monthly' || currentMembershipType === 'yearly'))

  /**
   * 生成计划选项
   * 使用 useMemo 优化，避免每次渲染都重新生成
   */
  const planOptions = useMemo(() => {
    return generatePlanOptionsFromBackend({
      membershipPlans,
      currentMembershipType,
      t,
      formatCurrency,
      formatTokenCount,
    })
  }, [membershipPlans, currentMembershipType, t])

  /**
   * 刷新待支付订单
   */
  const handleRefreshPendingOrders = useCallback(async () => {
    try {
      await refreshUserOrders('pending')

      if (pendingOrders.length === 0) {
        toast.success(t('order.messages.noPendingOrders'))
      } else {
        toast.success(t('order.messages.refreshSuccess'))
      }
    } catch (error) {
      console.error('Refresh pending orders failed:', error)
      toast.error(t('order.messages.refreshFailed'))
    }
  }, [refreshUserOrders, pendingOrders.length, t])

  /**
   * 处理升级
   */
  const handleUpgrade = useCallback(async (planId: string) => {
    // 如果点击的是当前计划或免费会员，不执行升级
    if (planId === 'free' || planId === currentMembershipType) return

    // 检查是否有待支付订单
    if (hasPendingOrder) {
      toast.error(t('order.messages.hasPendingOrder'))
      return
    }

    // 检查会员类型限制
    if (!canUpgradeToType(currentMembershipType, planId)) {
      const message = getUpgradeRestrictionMessage(currentMembershipType, planId, t)
      if (message) {
        toast.error(message)
      }
      return
    }

    setIsUpgrading(true)
    setUpgradingPlan(planId)

    try {
      // 找到对应的会员计划
      const selectedPlan = membershipPlans.find(plan => plan.type === planId)
      if (!selectedPlan) {
        toast.error(t('upgrade.messages.planNotFound'))
        return
      }

      // 创建 Stripe 支付会话
      const checkoutData = {
        membership_plan_id: selectedPlan.id,
        success_url: `${window.location.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/payment/cancel`,
        discount_code: null
      }

      const response = await createStripeCheckout(checkoutData)

      if (response.checkout_url) {
        window.location.href = response.checkout_url
      } else {
        toast.error(t('upgrade.messages.paymentFailed'))
      }
    } catch (error) {
      // 检查是否是待支付订单错误
      if (error instanceof Error && error.message.includes('pending order')) {
        toast.error(t('order.messages.hasPendingOrder'))
        try {
          await refreshUserOrders('pending')
        } catch {
          // 忽略获取订单失败的错误
        }
      } else {
        toast.error(t('upgrade.messages.paymentFailed'))
      }
    } finally {
      setIsUpgrading(false)
      setUpgradingPlan(null)
    }
  }, [currentMembershipType, hasPendingOrder, membershipPlans, refreshUserOrders, t])

  /**
   * 打开订单对话框
   */
  const handleOpenOrdersDialog = useCallback(() => {
    setOrdersDialogOpen(true)
  }, [])

  if (!shouldRender) {
    return null
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen} modal={true}>
        {!isExternallyControlled && (
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 mr-4 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 border-primary/30 hover:from-primary/30 hover:via-primary/20 hover:to-primary/10 hover:border-primary/40 shadow-md hover:shadow-lg transition-all duration-300"
            >
              <Crown className="h-4 w-4 text-primary" />
              {t('upgrade.buttonText')}
            </Button>
          </DialogTrigger>
        )}

        <DialogContent
          className="max-w-[920px] w-[95vw] max-h-[95vh] overflow-y-auto p-12 sm:p-10"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="space-y-4 pb-4">
            <DialogTitle className="text-3xl font-bold text-center flex items-center justify-center gap-3">
              <Sparkles className="h-8 w-8 text-primary" />
              {t('upgrade.title')}
            </DialogTitle>

            <p className="text-center text-muted-foreground text-lg max-w-2xl mx-auto">
              {t('upgrade.description')}
            </p>

            {/* 待支付订单警告 */}
            {hasPendingOrder && (
              <PendingOrderBanner
                onViewOrders={handleOpenOrdersDialog}
                onRefresh={handleRefreshPendingOrders}
                isRefreshing={isRefreshingOrders}
                t={t}
              />
            )}
          </DialogHeader>

          {/* 加载状态 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">{t('common.actions.loading')}</span>
            </div>
          ) : (
            <>
              {/* 计划卡片列表 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-4 justify-items-center">
                {planOptions.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    currentMembershipType={currentMembershipType}
                    isUpgrading={isUpgrading}
                    upgradingPlan={upgradingPlan}
                    onUpgrade={handleUpgrade}
                    t={t}
                  />
                ))}
              </div>

              {/* 页脚信息 */}
              <div className="mt-8 pt-6 border-t border-border">
                <div className="text-center space-y-3">
                  <p className="text-base text-muted-foreground font-medium">
                    {t('upgrade.footer.securePayment')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('upgrade.footer.cancelAnytime')}
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 订单弹框 */}
      <OrdersDialog
        open={ordersDialogOpen}
        onOpenChange={setOrdersDialogOpen}
      />
    </>
  )
}

/**
 * 待支付订单横幅组件
 */
const PendingOrderBanner = React.memo(function PendingOrderBanner({
  onViewOrders,
  onRefresh,
  isRefreshing,
  t,
}: {
  onViewOrders: () => void
  onRefresh: () => void
  isRefreshing: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}) {
  return (
    <div className="bg-accent border border-accent-foreground/30 rounded-lg p-4 mx-auto max-w-2xl">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-accent-foreground" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-accent-foreground">
            {t('order.messages.pendingOrderTitle')}
          </h3>
          <p className="mt-1 text-sm text-accent-foreground/80">
            {t('order.messages.pendingOrderDescription')}
          </p>
          <div className="mt-3 flex space-x-3">
            <Button
              variant="outline"
              size="sm"
              className="text-accent-foreground border-accent-foreground/30 hover:bg-accent/80"
              onClick={onViewOrders}
            >
              {t('order.messages.viewPendingOrders')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-accent-foreground border-accent-foreground/30 hover:bg-accent/80"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})

/**
 * 计划卡片组件
 */
const PlanCard = React.memo(function PlanCard({
  plan,
  currentMembershipType,
  isUpgrading,
  upgradingPlan,
  onUpgrade,
  t,
}: {
  plan: PlanOption
  currentMembershipType: string
  isUpgrading: boolean
  upgradingPlan: string | null
  onUpgrade: (planId: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}) {
  const handleUpgrade = useCallback(() => {
    onUpgrade(plan.id)
  }, [plan.id, onUpgrade])

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 min-h-[360px] w-full max-w-[220px] flex flex-col ${
        plan.popular
          ? 'border-primary shadow-lg ring-4 ring-primary/10 hover:shadow-2xl hover:ring-primary/30 hover:scale-108'
          : 'border-border hover:border-primary/40 hover:shadow-lg hover:ring-2 hover:ring-primary/10 hover:scale-105'
      }`}
    >
      {/* 背景装饰图标 */}
      <div className={`absolute -top-7 -left-7 w-48 h-48 pointer-events-none z-0 opacity-10 ${
        plan.id !== 'free' ? 'bg-primary/5 rounded-full' : ''
      }`}>
        <MembershipIcon
          type={plan.id as MembershipType}
          size="lg"
          className="w-full h-full"
        />
      </div>

      {/* 热门标签 */}
      {plan.popular && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <Badge className="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary border-primary/30 dark:border-primary/40 px-2 py-0.5 text-xs font-medium">
            {t('upgrade.popular')}
          </Badge>
        </div>
      )}

      {/* 节省标签 */}
      {plan.id === 'yearly' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 px-1 py-0.5 text-xs font-medium">
            {t('upgrade.savePercent', { percent: '20%' })}
          </Badge>
        </div>
      )}

      <CardHeader className="relative z-10 text-center pb-4 pt-6">
        <CardTitle className="text-lg font-bold mb-3">{plan.name}</CardTitle>
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold text-primary">{plan.price}</span>
              {plan.period && (
                <span className="text-muted-foreground text-base">/{plan.period}</span>
              )}
            </div>
            <span className="text-sm text-muted-foreground line-through h-2">
              {plan.originalPrice ?? ''}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 flex-1 flex flex-col justify-between px-5 pb-3">
        <ul className="space-y-2">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check
                className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  feature.included
                    ? 'text-green-500'
                    : 'text-muted-foreground opacity-50'
                }`}
              />
              <span
                className={`text-xs leading-relaxed ${
                  feature.included
                    ? 'text-foreground'
                    : 'text-muted-foreground opacity-70'
                }`}
              >
                {feature.text}
              </span>
            </li>
          ))}
        </ul>

        <Button
          className={`w-full h-10 text-sm font-medium mt-6 ${
            plan.popular
              ? 'bg-gradient-to-r from-primary to-primary/70 hover:from-primary/90 hover:to-primary/60 text-primary-foreground shadow-xl border-0'
              : ''
          }`}
          variant={plan.buttonVariant}
          onClick={handleUpgrade}
          disabled={
            plan.id === 'free' ||
            plan.id === currentMembershipType ||
            isUpgrading
          }
        >
          {isUpgrading && upgradingPlan === plan.id ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('upgrade.upgrading')}
            </>
          ) : (
            plan.buttonText
          )}
        </Button>
      </CardContent>
    </Card>
  )
})

