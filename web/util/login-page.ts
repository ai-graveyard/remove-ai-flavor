/**
 * 登录页支持的认证表单模式。
 */
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
