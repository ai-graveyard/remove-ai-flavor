import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetcher } from './fetcher'

/**
 * 验证认证表单可以自行处理 401，同时保留受保护接口原有的全局登出行为。
 */
describe('fetcher 的 401 处理', () => {
  const fetchMock = vi.fn()
  const removeItem = vi.fn()
  const dispatchEvent = vi.fn()
  const location = {
    pathname: '/zh/login',
    href: 'https://www.removeaiflavor.com/zh/login',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    location.pathname = '/zh/login'
    location.href = 'https://www.removeaiflavor.com/zh/login'
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('localStorage', { removeItem })
    vi.stubGlobal('CustomEvent', class {
      constructor(public type: string) {}
    })
    vi.stubGlobal('window', {
      fetch: fetchMock,
      location,
      dispatchEvent,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('允许认证表单捕获 401，不清理登录态或强制跳转', async () => {
    const request = fetcher('/auth/verify', {
      method: 'POST',
      redirectOnUnauthorized: false,
    })

    await expect(request).rejects.toMatchObject({
      message: 'Invalid token',
      status: 401,
      isAuthError: true,
    })

    expect(removeItem).not.toHaveBeenCalled()
    expect(dispatchEvent).not.toHaveBeenCalled()
    expect(location.href).toBe('https://www.removeaiflavor.com/zh/login')
  })

  it('受保护接口默认仍会清理登录态并跳转登录页', async () => {
    location.pathname = '/zh/admin'
    location.href = 'https://www.removeaiflavor.com/zh/admin'

    await expect(fetcher('/auth/me')).rejects.toMatchObject({
      status: 401,
      isAuthError: true,
    })

    expect(removeItem).toHaveBeenCalledTimes(4)
    expect(dispatchEvent).toHaveBeenCalledTimes(1)
    expect(location.href).toBe('/zh/login')
  })
})
