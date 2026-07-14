import { describe, expect, it } from 'vitest'

import { getSidebarHeaderMode } from './sidebar-header'

describe('侧边栏头部显示模式', () => {
  it('折叠时显示新建任务入口', () => {
    expect(getSidebarHeaderMode('collapsed')).toBe('new-task')
  })

  it('展开时显示应用标题', () => {
    expect(getSidebarHeaderMode('expanded')).toBe('title')
  })
})
