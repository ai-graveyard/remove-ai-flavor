import { describe, expect, it } from 'vitest'

import {
  clearOptimizationTaskStorage,
  isNewOptimizationTask,
} from './optimization-task'

/**
 * 创建可观察的内存存储，验证任务清理不会影响其他浏览器数据。
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

describe('新建优化任务', () => {
  it('仅识别 action=new 查询参数', () => {
    expect(isNewOptimizationTask(new URLSearchParams('action=new'))).toBe(true)
    expect(isNewOptimizationTask(new URLSearchParams('action=edit'))).toBe(false)
    expect(isNewOptimizationTask(new URLSearchParams())).toBe(false)
  })

  it('只清除当前优化任务数据', () => {
    const storage = createStorageMock()
    storage.setItem('remove-flavor-original-text', '原文')
    storage.setItem('remove-flavor-optimized-text', '结果')
    storage.setItem('remove-flavor-chat-date', '2026-07-14')
    storage.setItem('remove-flavor-chat-id', '42')
    storage.setItem('guest-optimize-count', '2')
    storage.setItem('theme', 'dark')

    clearOptimizationTaskStorage(storage)

    expect(storage.getItem('remove-flavor-original-text')).toBeNull()
    expect(storage.getItem('remove-flavor-optimized-text')).toBeNull()
    expect(storage.getItem('remove-flavor-chat-date')).toBeNull()
    expect(storage.getItem('remove-flavor-chat-id')).toBeNull()
    expect(storage.getItem('guest-optimize-count')).toBe('2')
    expect(storage.getItem('theme')).toBe('dark')
  })
})
