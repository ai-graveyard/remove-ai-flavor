/** 访客最多可成功优化的次数。 */
export const GUEST_USAGE_LIMIT = 10

const GUEST_ID_KEY = 'guest-id'
const GUEST_USAGE_COUNT_KEY = 'guest-optimize-count'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * 获取当前浏览器的访客标识；首次调用时创建并保存。
 *
 * @returns 稳定的 UUID 访客标识；服务端渲染时返回空字符串。
 */
export function getGuestId(): string {
  try {
    if (typeof localStorage === 'undefined') return ''

    const savedGuestId = localStorage.getItem(GUEST_ID_KEY)
    if (savedGuestId && UUID_PATTERN.test(savedGuestId)) return savedGuestId

    const guestId = crypto.randomUUID()
    localStorage.setItem(GUEST_ID_KEY, guestId)
    return guestId
  } catch {
    // 隐私模式或浏览器策略禁用存储时不允许创建不稳定的访客身份。
    return ''
  }
}

/**
 * 获取访客已成功优化的次数。
 *
 * @returns 钳制在 0 到访客上限之间的整数。
 */
export function getGuestUsageCount(): number {
  try {
    if (typeof localStorage === 'undefined') return 0

    const parsedCount = Number.parseInt(localStorage.getItem(GUEST_USAGE_COUNT_KEY) ?? '0', 10)
    if (!Number.isFinite(parsedCount)) return 0

    return Math.min(GUEST_USAGE_LIMIT, Math.max(0, parsedCount))
  } catch {
    return 0
  }
}

/**
 * 判断访客是否仍可提交一次文本优化。
 *
 * @returns 已成功使用少于十次时返回 `true`。
 */
export function canGuestOptimize(): boolean {
  return getGuestUsageCount() < GUEST_USAGE_LIMIT
}

/**
 * 使用服务端返回的权威值同步访客次数。
 *
 * @param usageCount - 服务端确认的累计使用次数。
 */
export function setGuestUsageCount(usageCount: number): void {
  try {
    if (typeof localStorage === 'undefined') return

    const normalizedCount = Math.min(
      GUEST_USAGE_LIMIT,
      Math.max(0, Math.trunc(usageCount)),
    )
    localStorage.setItem(GUEST_USAGE_COUNT_KEY, normalizedCount.toString())
  } catch {
    // 本地存储不可用时由服务端额度继续提供最终保护。
  }
}

/**
 * 在一次访客优化成功后递增本地次数。
 *
 * @returns 递增后的次数，最大为访客上限。
 */
export function incrementGuestUsage(): number {
  const nextCount = Math.min(GUEST_USAGE_LIMIT, getGuestUsageCount() + 1)
  setGuestUsageCount(nextCount)
  return nextCount
}

/**
 * 将本地次数同步为额度耗尽状态。
 */
export function setGuestUsageExhausted(): void {
  setGuestUsageCount(GUEST_USAGE_LIMIT)
}

/**
 * 登录成功后清除访客身份和使用次数。
 */
export function clearGuestUsage(): void {
  try {
    if (typeof localStorage === 'undefined') return

    localStorage.removeItem(GUEST_ID_KEY)
    localStorage.removeItem(GUEST_USAGE_COUNT_KEY)
  } catch {
    // 存储受限时无需清理。
  }
}
