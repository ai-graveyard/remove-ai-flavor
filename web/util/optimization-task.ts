/**
 * 优化任务使用的本地存储键。
 *
 * 集中维护这些键，确保恢复和新建任务使用同一套数据边界。
 */
export const OPTIMIZATION_TASK_STORAGE_KEYS = {
  originalText: 'remove-flavor-original-text',
  optimizedText: 'remove-flavor-optimized-text',
  chatDate: 'remove-flavor-chat-date',
  chatId: 'remove-flavor-chat-id',
} as const

/**
 * 判断当前 URL 是否携带一次性的新建优化任务指令。
 *
 * @param searchParams - 当前页面的查询参数。
 * @returns `action=new` 时返回 `true`。
 */
export function isNewOptimizationTask(searchParams: URLSearchParams): boolean {
  return searchParams.get('action') === 'new'
}

/**
 * 清除当前优化任务的草稿和对话关联，不影响访客额度、主题等其他数据。
 *
 * @param storage - 浏览器存储实现。
 */
export function clearOptimizationTaskStorage(storage: Storage): void {
  Object.values(OPTIMIZATION_TASK_STORAGE_KEYS).forEach(key => {
    storage.removeItem(key)
  })
}
