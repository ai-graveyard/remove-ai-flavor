# 登录页游客入口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在登录页增加“随便看看”入口，让验证码或密码登录状态下的用户直接进入游客模式。

**Architecture:** 使用纯函数统一判断游客入口是否应显示，登录页通过国际化描边按钮导航到当前语言首页。现有首页和游客用量模块继续负责匿名访问与游客 ID 的按需创建，不新增后端接口或持久化状态。

**Tech Stack:** Next.js 15、React 19、TypeScript、next-intl、Vitest、Shadcn UI

## Global Constraints

- 游客入口仅在验证码登录和密码登录状态显示。
- 中文文案为“随便看看”，英文文案为“Explore as guest”。
- 点击后导航到 `/`，不清除已有游客 ID 或游客使用次数。
- 所有新增函数使用中文 JSDoc，复杂逻辑使用中文注释。
- 不新增依赖，不修改后端，不提交 Git commit。

---

### Task 1: 登录页游客入口

**Files:**
- Create: `web/util/login-page.ts`
- Create: `web/util/login-page.test.ts`
- Modify: `web/app/[locale]/login/page.tsx`
- Modify: `web/app/messages/zh.json`
- Modify: `web/app/messages/en.json`

**Interfaces:**
- Produces: `AuthMode` 类型和 `canEnterGuestMode(mode: AuthMode): boolean`。
- Consumes: 登录页当前的 `mode` 状态与 next-intl 路由 `Link`。

- [x] **Step 1: 编写游客入口可见性的失败测试**

```typescript
import { describe, expect, it } from 'vitest'

import { canEnterGuestMode } from './login-page'

describe('登录页游客入口', () => {
  it.each(['code-login', 'password-login'] as const)('在 %s 状态显示', mode => {
    expect(canEnterGuestMode(mode)).toBe(true)
  })

  it.each(['register', 'reset-password'] as const)('在 %s 状态隐藏', mode => {
    expect(canEnterGuestMode(mode)).toBe(false)
  })
})
```

- [x] **Step 2: 运行测试并确认因模块尚未实现而失败**

Run: `pnpm test -- util/login-page.test.ts`

Expected: FAIL，提示无法解析 `./login-page`。

- [x] **Step 3: 实现最小可见性判断**

```typescript
export type AuthMode = 'code-login' | 'password-login' | 'register' | 'reset-password'

/**
 * 判断当前登录表单是否允许进入游客模式。
 *
 * @param mode - 当前认证表单模式。
 * @returns 验证码或密码登录状态返回 true，其余状态返回 false。
 */
export function canEnterGuestMode(mode: AuthMode): boolean {
  return mode === 'code-login' || mode === 'password-login'
}
```

- [x] **Step 4: 运行单测并确认通过**

Run: `pnpm test -- util/login-page.test.ts`

Expected: PASS，4 个参数化用例通过。

- [x] **Step 5: 接入登录页和国际化文案**

在登录页从 `@/i18n/navigation` 引入 `Link`，从 `@/util/login-page` 引入 `AuthMode` 与 `canEnterGuestMode`，删除页面内重复的 `AuthMode` 定义。在登录主按钮后增加：

```tsx
{canEnterGuestMode(mode) && (
  <Button asChild variant="outline" className="w-full h-11">
    <Link href="/">{t('pages.login.exploreAsGuest')}</Link>
  </Button>
)}
```

在中英文 `pages.login` 中分别增加：

```json
"exploreAsGuest": "随便看看"
```

```json
"exploreAsGuest": "Explore as guest"
```

- [x] **Step 6: 运行自动化验证**

Run: `pnpm test -- util/login-page.test.ts`

Expected: PASS。

Run: `pnpm exec tsc --noEmit`

Expected: 退出码 0，无新增类型错误。

Run: `pnpm exec eslint "app/[locale]/login/page.tsx" "util/login-page.ts" "util/login-page.test.ts"`

Expected: 退出码 0，无新增检查错误。

- [x] **Step 7: 浏览器验收**

启动前端后检查：

1. 验证码登录页显示“随便看看”。
2. 密码登录页显示“随便看看”。
3. 注册和重置密码页隐藏该入口。
4. 点击入口进入当前语言首页。
5. `guest-id` 和 `guest-optimize-count` 在点击前后保持不变。

