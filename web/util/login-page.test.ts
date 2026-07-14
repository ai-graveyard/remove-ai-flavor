import { describe, expect, it } from 'vitest'

import { canEnterGuestMode } from './login-page'

/**
 * 验证游客入口只出现在两种登录状态，避免注册和重置密码流程受到干扰。
 */
describe('登录页游客入口', () => {
  it.each(['code-login', 'password-login'] as const)('在 %s 状态显示', mode => {
    expect(canEnterGuestMode(mode)).toBe(true)
  })

  it.each(['register', 'reset-password'] as const)('在 %s 状态隐藏', mode => {
    expect(canEnterGuestMode(mode)).toBe(false)
  })
})
