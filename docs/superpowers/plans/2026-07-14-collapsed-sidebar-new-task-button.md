# 折叠侧边栏新建任务按钮实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 侧边栏折叠后在左上角显示可直接新建优化任务的“+”按钮，并保持侧边栏折叠。

**Architecture:** 新增一个无 UI 依赖的状态映射函数，将侧边栏状态转换为头部显示模式；`AppSidebar` 根据该模式显式渲染标题或新建任务入口。这样可以用轻量单元测试锁定折叠态语义，同时不引入新的测试依赖。

**Tech Stack:** React 19、TypeScript、Next.js 15、Vitest、Tailwind CSS、Lucide React

## Global Constraints

- 折叠态“+”点击后进入 `/?action=new`，侧边栏保持折叠。
- 展开态保留当前标题折叠按钮和右侧新建任务按钮。
- 新增函数和关键交互使用中文注释。
- 不新增依赖，不修改任务创建流程。
- 未经用户明确要求，不创建 Git 提交。

---

### Task 1: 根据侧边栏状态切换头部入口

**Files:**
- Create: `web/components/web/sidebar/sidebar-header.ts`
- Create: `web/components/web/sidebar/sidebar-header.test.ts`
- Modify: `web/components/web/sidebar/app-sidebar.tsx:32-84`

**Interfaces:**
- Consumes: `state: 'expanded' | 'collapsed'`
- Produces: `getSidebarHeaderMode(state): 'title' | 'new-task'`

- [ ] **Step 1: 编写失败测试**

```typescript
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
```

- [ ] **Step 2: 运行测试并确认因实现缺失而失败**

Run: `cd web && pnpm test -- components/web/sidebar/sidebar-header.test.ts`

Expected: FAIL，提示无法找到 `./sidebar-header` 模块。

- [ ] **Step 3: 实现最小状态映射函数**

```typescript
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
```

- [ ] **Step 4: 让 `AppSidebar` 显式渲染对应入口**

将 `useSidebar` 解构改为：

```typescript
const { state, toggleSidebar, setOpen } = useSidebar()
const headerMode = getSidebarHeaderMode(state)
```

将头部菜单项改为：

```tsx
<SidebarMenuItem className="flex items-center gap-1">
  {headerMode === 'new-task' ? (
    <SidebarMenuButton
      size="lg"
      tooltip={t('editor.newTask')}
      className="cursor-pointer text-primary [&>svg]:size-5"
      asChild
    >
      <Link
        href="/?action=new"
        onClick={handleNewTaskClick}
        title={t('editor.newTask')}
        aria-label={t('editor.newTask')}
      >
        <Plus />
      </Link>
    </SidebarMenuButton>
  ) : (
    <>
      <SidebarMenuButton
        size="lg"
        onClick={handleTitleClick}
        className="min-w-0 flex-1 cursor-pointer"
        tooltip={t('app.fullName')}
      >
        <div className="relative min-w-0 truncate text-xl font-semibold">
          <span className="text-foreground">{t('app.fullName')}</span>
        </div>
      </SidebarMenuButton>
      <Button
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 text-primary"
        asChild
      >
        <Link
          href="/?action=new"
          onClick={handleNewTaskClick}
          title={t('editor.newTask')}
          aria-label={t('editor.newTask')}
        >
          <Plus className="size-5" />
        </Link>
      </Button>
    </>
  )}
</SidebarMenuItem>
```

- [ ] **Step 5: 运行单元测试并确认通过**

Run: `cd web && pnpm test -- components/web/sidebar/sidebar-header.test.ts`

Expected: 2 tests PASS。

- [ ] **Step 6: 执行前端静态检查**

Run: `cd web && pnpm exec eslint components/web/sidebar/app-sidebar.tsx components/web/sidebar/sidebar-header.ts components/web/sidebar/sidebar-header.test.ts`

Expected: 退出码为 0，无新增 ESLint 错误。

Run: `cd web && pnpm exec tsc --noEmit`

Expected: 退出码为 0，无新增 TypeScript 错误。

- [ ] **Step 7: 手动验证交互**

1. 展开侧边栏，确认标题与右侧“+”同时显示。
2. 点击标题折叠侧边栏，确认左上角变为“+”。
3. 点击折叠态“+”，确认地址变为 `/?action=new` 且侧边栏没有展开。
