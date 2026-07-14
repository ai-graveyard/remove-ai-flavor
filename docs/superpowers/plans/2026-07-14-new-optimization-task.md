# 新建优化任务实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将侧边栏入口改为可可靠重置编辑器并延迟创建新对话的“新建”功能。

**Architecture:** 侧边栏通过首页查询参数发出一次性新建指令，编辑器消费指令并清理任务本地状态。对话创建从页面初始化调整为首次生成时按需执行，普通页面刷新仍恢复已有任务。

**Tech Stack:** Next.js 15、React 19、TypeScript、next-intl、Vitest。

## Global Constraints

- 所有新增或修改的代码注释使用中文。
- 保留当前 Agent 选择、访客额度和已有历史对话。
- 当前有文本时必须确认，生成期间不得执行新建。
- 不新增第三方依赖。

---

### Task 1: 新建任务状态工具

**Files:**
- Create: `web/util/optimization-task.ts`
- Test: `web/util/optimization-task.test.ts`

**Interfaces:**
- Produces: `isNewOptimizationTask(searchParams: URLSearchParams): boolean`
- Produces: `clearOptimizationTaskStorage(storage: Storage): void`

- [ ] **Step 1: 编写失败测试**

验证仅 `action=new` 被识别为新建指令，并且清理函数只删除原文、结果、对话日期和对话 ID。

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `pnpm test util/optimization-task.test.ts`

- [ ] **Step 3: 编写最小实现**

集中定义编辑器本地存储键，提供参数识别和定向清理函数。

- [ ] **Step 4: 运行测试并确认通过**

Run: `pnpm test util/optimization-task.test.ts`

### Task 2: 侧边栏入口和编辑器流程

**Files:**
- Modify: `web/components/web/sidebar/app-sidebar.tsx`
- Modify: `web/components/web/editor/remove-flavor-editor.tsx`
- Modify: `web/app/messages/zh.json`
- Modify: `web/app/messages/en.json`

**Interfaces:**
- Consumes: `isNewOptimizationTask(searchParams)`
- Consumes: `clearOptimizationTaskStorage(localStorage)`

- [ ] **Step 1: 将“工作台”入口改为“新建”并导航到 `/?action=new`**

替换图标、文案和相关注释，保留自动折叠侧边栏行为。

- [ ] **Step 2: 消费新建指令**

编辑器检测参数；生成中拒绝新建；存在文本时显示确认框；确认后清理本地状态、恢复面板并清理 URL。

- [ ] **Step 3: 改为延迟创建新对话**

页面初始化仅恢复有效的已有对话；没有当前对话时，在首次生成前创建对话并继续发送。

- [ ] **Step 4: 验证**

Run: `pnpm test`

Run: `pnpm exec tsc --noEmit`
