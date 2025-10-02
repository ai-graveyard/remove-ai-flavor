export function getApiUrl() {
  console.log(process.env.NODE_ENV);
  if (process.env.NODE_ENV === 'development') {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    console.log(window.location.origin);
    return window.location.origin;
  }
  return 'http://localhost:8080';
}

const API_URL_V1 = `${getApiUrl()}/api/v1`;

function getTokenExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.exp ? decoded.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
}

/**
 * 清除用户认证信息
 * 
 * 功能说明:
 * - 清除 localStorage 中的所有认证相关数据
 * - 在 token 失效时调用
 */
export function clearAuthData() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('email');
  localStorage.removeItem('user_type');
}

/**
 * 获取有效的 access token
 * 
 * 功能说明:
 * - 检查 access token 是否过期
 * - 如果过期，尝试使用 refresh token 刷新
 * - 如果刷新失败，清除认证信息并返回 null
 * 
 * @returns Promise<string | null> - 返回有效的 access token，失败返回 null
 */
export async function getValidAccessToken() {
  const accessToken = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');

  // Get expiration timestamp from accessToken
  const accessTokenExp = accessToken ? getTokenExp(accessToken) : null;

  // Check if access_token is expired
  if (accessToken && accessTokenExp && Date.now() < accessTokenExp) {
    return accessToken;
  }

  // If access_token is expired, try to refresh using refresh_token
  if (refreshToken) {
    try {
      const res = await fetch(`${API_URL_V1}/auth/refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      
      if (res.ok) {
        const data = await res.json() as { access_token: string; refresh_token: string };
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        return data.access_token;
      } else {
        // refresh token 也失效了，清除所有认证信息
        console.warn('Refresh token 失效，清除认证信息');
        clearAuthData();
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      // 刷新失败，清除认证信息
      clearAuthData();
    }
  }

  return null;
}
