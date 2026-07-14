# 深色模式主按钮对比度修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正深色主题主按钮的前景色，使全站默认主按钮和侧边栏主操作使用高对比度近白色文字。

**Architecture:** 保留组件的语义化颜色样式，只修正深色主题中的 `--primary-foreground` 和 `--sidebar-primary-foreground` 令牌。通过浏览器读取实际计算颜色并对比修复前后的对比度，同时检查登录页其他按钮和链接。

**Tech Stack:** Tailwind CSS 4、Shadcn UI、CSS Variables、Next.js 15

## Global Constraints

- 深色主题的 `--primary-foreground` 和 `--sidebar-primary-foreground` 使用与 `--foreground` 相同的 `oklch(0.985 0 0)` 近白色。
- 不在页面或 Button 组件中硬编码白色。
- 不修改浅色主题及其他按钮变体。
- 不新增依赖，不修改后端，不提交 Git commit。

---

### Task 1: 修复深色主题主按钮前景色

**Files:**
- Modify: `web/app/globals.css`

**Interfaces:**
- Consumes: Button 默认变体使用的 `text-primary-foreground`。
- Produces: 深色模式下全站默认主按钮和侧边栏主操作的近白色文字。

- [x] **Step 1: 记录修复前的浏览器颜色与对比度**

在深色模式登录页读取默认登录按钮的 `color` 和 `backgroundColor`，计算 WCAG 对比度。

Expected: 文字和背景均为蓝色，对比度明显低于 4.5:1。

- [x] **Step 2: 修改深色主题令牌**

```css
.dark {
  /* 其他主题变量保持不变。 */
  --primary-foreground: oklch(0.985 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
}
```

- [x] **Step 3: 运行自动化验证**

Run: `pnpm test`

Expected: 全部前端测试通过。

Run: `pnpm exec tsc --noEmit`

Expected: 退出码 0。

Run: `pnpm exec eslint "app/[locale]/login/page.tsx" "components/ui/button.tsx"`

Expected: 退出码 0。

- [x] **Step 4: 浏览器验收**

1. 读取修复后登录按钮的计算颜色与对比度，确认启用状态达到至少 4.5:1。
2. 检查验证码登录、密码登录、注册和重置密码的主按钮均为近白色文字。
3. 检查游客入口、发送验证码和登录方式链接仍清晰可读。
4. 检查侧边栏主操作按钮也使用近白色文字。
5. 切换浅色模式，确认主按钮外观未改变。

