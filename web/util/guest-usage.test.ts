import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GUEST_USAGE_LIMIT,
  canGuestOptimize,
  clearGuestUsage,
  getGuestId,
  getGuestUsageCount,
  incrementGuestUsage,
  setGuestUsageCount,
  setGuestUsageExhausted,
} from './guest-usage'

/**
 * 创建可观察的内存 localStorage，避免测试依赖浏览器环境。
 */
function createStorageMock(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('访客使用量本地存储', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' })
  })

  it('缺少或非法次数时返回零', () => {
    expect(getGuestUsageCount()).toBe(0)

    localStorage.setItem('guest-optimize-count', 'invalid')

    expect(getGuestUsageCount()).toBe(0)
  })

  it('成功次数递增但不会超过上限', () => {
    for (let count = 1; count <= GUEST_USAGE_LIMIT; count += 1) {
      expect(incrementGuestUsage()).toBe(count)
    }

    expect(incrementGuestUsage()).toBe(GUEST_USAGE_LIMIT)
  })

  it('前十次允许提交，达到十次后拒绝下一次', () => {
    expect(canGuestOptimize()).toBe(true)

    setGuestUsageCount(GUEST_USAGE_LIMIT)

    expect(canGuestOptimize()).toBe(false)
  })

  it('将服务端额度耗尽状态同步到本地', () => {
    setGuestUsageExhausted()

    expect(getGuestUsageCount()).toBe(GUEST_USAGE_LIMIT)
  })

  it('按服务端权威次数同步并限制范围', () => {
    setGuestUsageCount(2)
    expect(getGuestUsageCount()).toBe(2)

    setGuestUsageCount(99)
    expect(getGuestUsageCount()).toBe(GUEST_USAGE_LIMIT)
  })

  it('为同一浏览器返回稳定的访客 ID', () => {
    expect(getGuestId()).toBe('11111111-1111-4111-8111-111111111111')
    expect(getGuestId()).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('已保存的访客 ID 格式错误时重新生成', () => {
    localStorage.setItem('guest-id', 'invalid-id')

    expect(getGuestId()).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('登录后清除访客 ID 和次数', () => {
    getGuestId()
    incrementGuestUsage()

    clearGuestUsage()

    expect(localStorage.getItem('guest-id')).toBeNull()
    expect(localStorage.getItem('guest-optimize-count')).toBeNull()
  })

  it('本地存储不可用时安全降级', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
    })

    expect(getGuestUsageCount()).toBe(0)
    expect(getGuestId()).toBe('')
    expect(() => clearGuestUsage()).not.toThrow()
  })
})
