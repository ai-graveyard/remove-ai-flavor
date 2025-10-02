/**
 * 会员计划配置工具函数
 */

import type { MembershipType } from '@/app/[locale]/types'

/**
 * 计划功能项
 */
export interface PlanFeature {
  text: string
  included: boolean
}

/**
 * 计划选项
 */
export interface PlanOption {
  id: string
  name: string
  price: string
  originalPrice?: string
  period: string
  popular?: boolean
  features: PlanFeature[]
  buttonText: string
  buttonVariant: 'outline' | 'default' | 'secondary'
}

/**
 * 后端会员计划数据结构
 */
export interface MembershipPlan {
  id: number
  type: MembershipType
  name: string
  price: number
  currency?: string
  daily_message_limit: number
  daily_token_limit: number
  conversation_turn_limit: number
}

/**
 * 计划配置生成器参数
 */
export interface PlanGeneratorParams {
  membershipPlans: MembershipPlan[]
  currentMembershipType: MembershipType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
  formatCurrency: (amount: number, currency: string) => string
  formatTokenCount: (count: number) => string
}

/**
 * 计划顺序
 */
const PLAN_ORDER: MembershipType[] = ['free', 'monthly', 'yearly']

/**
 * 默认的静态计划配置
 */
export function getDefaultPlans(
  currentMembershipType: MembershipType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
): PlanOption[] {
  return [
    {
      id: 'free',
      name: t('upgrade.plans.free.name'),
      price: t('upgrade.plans.free.price'),
      period: '',
      features: [
        { text: t('upgrade.features.basicChat'), included: true },
        { text: t('upgrade.features.dailyMessagesWithCount', { count: 100 }), included: true },
        { text: t('upgrade.features.dailyTokensWithCount', { count: '1M' }), included: true },
        { text: t('upgrade.features.conversationTurnsWithCount', { count: 10 }), included: true },
        { text: t('upgrade.features.advancedSettings'), included: false },
        { text: t('upgrade.features.prioritySupport'), included: false },
      ],
      buttonText: currentMembershipType === 'free' ? t('upgrade.currentPlan') : t('upgrade.plans.free.buttonText'),
      buttonVariant: 'outline',
    },
    {
      id: 'monthly',
      name: t('upgrade.plans.monthly.name'),
      price: t('upgrade.plans.monthly.price'),
      period: t('upgrade.plans.monthly.period'),
      popular: currentMembershipType !== 'monthly',
      features: [
        { text: t('upgrade.features.basicChat'), included: true },
        { text: t('upgrade.features.dailyMessagesWithCount', { count: 800 }), included: true },
        { text: t('upgrade.features.dailyTokensWithCount', { count: '8M' }), included: true },
        { text: t('upgrade.features.conversationTurnsWithCount', { count: 30 }), included: true },
        { text: t('upgrade.features.advancedSettings'), included: true },
        { text: t('upgrade.features.prioritySupport'), included: true },
      ],
      buttonText: currentMembershipType === 'monthly' ? t('upgrade.currentPlan') : t('upgrade.plans.monthly.buttonText'),
      buttonVariant: currentMembershipType === 'monthly' ? 'outline' : 'default',
    },
    {
      id: 'yearly',
      name: t('upgrade.plans.yearly.name'),
      price: t('upgrade.plans.yearly.price'),
      originalPrice: t('upgrade.plans.yearly.originalPrice'),
      period: t('upgrade.plans.yearly.period'),
      popular: false,
      features: [
        { text: t('upgrade.features.basicChat'), included: true },
        { text: t('upgrade.features.dailyMessagesWithCount', { count: 1000 }), included: true },
        { text: t('upgrade.features.dailyTokensWithCount', { count: '10M' }), included: true },
        { text: t('upgrade.features.conversationTurnsWithCount', { count: 50 }), included: true },
        { text: t('upgrade.features.advancedSettings'), included: true },
        { text: t('upgrade.features.prioritySupport'), included: true },
      ],
      buttonText: currentMembershipType === 'yearly' ? t('upgrade.currentPlan') : t('upgrade.plans.yearly.buttonText'),
      buttonVariant: currentMembershipType === 'yearly' ? 'outline' : 'default',
    },
  ]
}

/**
 * 从后端数据生成计划选项
 */
export function generatePlanOptionsFromBackend({
  membershipPlans,
  currentMembershipType,
  t,
  formatCurrency,
  formatTokenCount,
}: PlanGeneratorParams): PlanOption[] {
  // 如果没有后端数据，返回默认计划
  if (!membershipPlans.length) {
    return getDefaultPlans(currentMembershipType, t)
  }

  // 按照指定顺序重新排列计划
  const sortedPlans = PLAN_ORDER
    .map(type => membershipPlans.find(plan => plan.type === type))
    .filter(Boolean) as MembershipPlan[]

  return sortedPlans.map(plan => {
    const isCurrentPlan = currentMembershipType === plan.type
    const isPopular = plan.type === 'monthly' && currentMembershipType !== 'monthly'

    return {
      id: plan.type,
      name: plan.name,
      price: plan.type === 'free' 
        ? t('upgrade.plans.free.price') 
        : formatCurrency(plan.price, plan.currency || 'USD'),
      originalPrice: plan.type === 'yearly' 
        ? formatCurrency((plan.price * 12 / 10), plan.currency || 'USD') 
        : undefined,
      period: plan.type === 'monthly' 
        ? t('upgrade.plans.monthly.period') 
        : plan.type === 'yearly' 
        ? t('upgrade.plans.yearly.period') 
        : '',
      popular: isPopular,
      features: [
        { text: t('upgrade.features.basicChat'), included: true },
        { 
          text: t('upgrade.features.dailyMessagesWithCount', { count: plan.daily_message_limit }), 
          included: true 
        },
        { 
          text: t('upgrade.features.dailyTokensWithCount', { count: formatTokenCount(plan.daily_token_limit) }), 
          included: true 
        },
        { 
          text: t('upgrade.features.conversationTurnsWithCount', { count: plan.conversation_turn_limit }), 
          included: true 
        },
        { text: t('upgrade.features.advancedSettings'), included: plan.type !== 'free' },
        { text: t('upgrade.features.prioritySupport'), included: plan.type === 'yearly' },
      ],
      buttonText: isCurrentPlan 
        ? t('upgrade.currentPlan') 
        : t(`upgrade.plans.${plan.type}.buttonText`),
      buttonVariant: isCurrentPlan ? 'outline' : (plan.type === 'free' ? 'outline' : 'default'),
    }
  })
}

/**
 * 检查是否可以升级到指定的会员类型
 * 月度会员期间不能开通年付会员，年付会员期间不能开通月度会员
 */
export function canUpgradeToType(
  currentMembershipType: MembershipType,
  targetType: string
): boolean {
  // 免费用户可以升级到任何类型
  if (currentMembershipType === 'free') return true

  // 不能升级到相同类型
  if (targetType === currentMembershipType) return false

  // 月度会员期间不能开通年付会员
  if (currentMembershipType === 'monthly' && targetType === 'yearly') return false

  // 年付会员期间不能开通月度会员
  if (currentMembershipType === 'yearly' && targetType === 'monthly') return false

  return true
}

/**
 * 获取不能升级的原因提示
 */
export function getUpgradeRestrictionMessage(
  currentMembershipType: MembershipType,
  targetType: string,
  t: (key: string) => string
): string | null {
  if (currentMembershipType === 'monthly' && targetType === 'yearly') {
    return t('membership.upgrade.cannotUpgradeMonthlyToYearly')
  }
  if (currentMembershipType === 'yearly' && targetType === 'monthly') {
    return t('membership.upgrade.cannotUpgradeYearlyToMonthly')
  }
  return null
}

