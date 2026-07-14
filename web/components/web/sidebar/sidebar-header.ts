export type SidebarHeaderMode = 'title' | 'new-task'

/**
 * 根据侧边栏状态确定头部主入口。
 *
 * @param state - 当前侧边栏展开状态。
 * @returns 展开时返回标题入口，折叠时返回新建任务入口。
 */
export function getSidebarHeaderMode(
  state: 'expanded' | 'collapsed',
): SidebarHeaderMode {
  return state === 'collapsed' ? 'new-task' : 'title'
}
