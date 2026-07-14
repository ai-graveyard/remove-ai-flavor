import { getValidAccessToken, getApiUrl, clearAuthData } from "./token";

const API_URL_V1 = `${getApiUrl()}/api/v1`;

/**
 * 处理未授权错误（401）
 * 
 * 功能说明:
 * - 清除所有认证信息
 * - 跳转到登录页面
 */
function handleUnauthorized() {
  // 清除认证信息
  clearAuthData();
  
  // 触发全局事件，通知其他组件用户已登出
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('user-logged-out'));
    
    // 获取当前语言设置
    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const locale = segments[0] === 'en' ? 'en' : 'zh';
    
    // 跳转到登录页
    window.location.href = `/${locale}/login`;
  }
}

/**
 * 获取当前用户的语言设置
 * 
 * 功能说明:
 * - 从 URL 路径中提取当前语言设置
 * - 支持 Next.js 国际化路由格式 /[locale]/...
 * - 默认返回中文 (zh)
 * 
 * 返回:
 * - string: 语言代码 (zh 或 en)
 */
function getAcceptLanguage(): string {
    if (typeof window === 'undefined') {
        // 服务端渲染时返回默认语言
        return 'zh';
    }
    
    // 从当前 URL 路径中提取语言
    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(Boolean);
    
    // 检查第一个路径段是否是语言代码
    if (segments.length > 0) {
        const firstSegment = segments[0];
        if (firstSegment === 'en' || firstSegment === 'zh') {
            return firstSegment;
        }
    }
    
    // 默认返回中文
    return 'zh';
}

type FetchOptions = RequestInit & {
    /** 是否自动附加有效的 Bearer Token。 */
    auth?: boolean;
    /** 是否按文本流读取响应。 */
    stream?: boolean;
    /** 收到 401 时是否清除登录态并跳转登录页，认证表单应设为 false。 */
    redirectOnUnauthorized?: boolean;
};

/**
 * 获取原生 fetch 函数
 * 
 * 功能说明:
 * - 确保使用浏览器原生的 fetch API，避免 polyfill 干扰
 * - 在 Next.js 等框架中，可能会被 polyfill 替换，导致流式响应失效
 * - 优先使用 window.fetch，如果不存在则使用全局 fetch
 */
function getNativeFetch(): typeof fetch {
    // 在浏览器环境中，优先使用 window.fetch（原生实现）
    if (typeof window !== 'undefined' && window.fetch) {
        return window.fetch.bind(window);
    }
    
    // 如果没有 window.fetch，使用全局 fetch
    if (typeof globalThis !== 'undefined' && globalThis.fetch) {
        return globalThis.fetch.bind(globalThis);
    }
    
    // 最后回退到标准 fetch
    return fetch;
}

/**
 * 检查流式响应支持
 * 
 * 功能说明:
 * - 检查当前环境是否支持 ReadableStream 和 Response.body.getReader()
 * - 如果不支持，会在控制台输出警告信息
 */
function checkStreamSupport(): boolean {
    if (typeof window === 'undefined') {
        // 服务端渲染环境，跳过检查
        return false;
    }
    
    const hasReadableStream = typeof ReadableStream !== 'undefined';
    const hasResponseBody = typeof Response !== 'undefined' && 
                           Response.prototype.hasOwnProperty('body');
    
    if (!hasReadableStream || !hasResponseBody) {
        console.warn('流式响应不支持：当前环境缺少 ReadableStream 或 Response.body 支持');
        return false;
    }
    
    return true;
}

/**
 * 发送统一 API 请求，并集中处理认证、语言和流式响应。
 *
 * @param url - 相对于 `/api/v1` 的接口路径。
 * @param options - 请求配置及认证行为选项。
 * @param onData - 流式响应的数据块回调。
 * @returns JSON 响应数据；流式请求完成后不返回数据。
 */
export async function fetcher<T>(
    url: string,
    options: FetchOptions = {},
    onData?: (chunk: string) => void
): Promise<T | void> {
    const {
        auth = false,
        stream = false,
        redirectOnUnauthorized = true,
        ...requestOptions
    } = options;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept-Language': getAcceptLanguage(),  // 自动添加语言头
    };

    if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
            headers[key] = value;
        });
    } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
            headers[key] = value;
        });
    } else if (typeof options.headers === 'object' && options.headers) {
        Object.assign(headers, options.headers);
    }

    // Automatically add Authorization header
    if (auth) {
        const token = await getValidAccessToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    // 使用原生 fetch
    const nativeFetch = getNativeFetch();
    
    // 流式请求的特殊头部设置
    if (stream) {
        // 确保不会被压缩或缓存
        headers['Accept'] = 'text/plain';
        headers['Cache-Control'] = 'no-cache';
        headers['Connection'] = 'keep-alive';
        
        // 检查流式响应支持
        if (!checkStreamSupport()) {
            throw new Error('当前环境不支持流式响应');
        }
    }


    const fullUrl = `${API_URL_V1}${url}`;
    
    const res = await nativeFetch(fullUrl, {
        ...requestOptions,
        headers,
    });

    if (!res.ok) {
        // 处理 401 未授权错误
        if (res.status === 401) {
            let errorMessage = '未授权，请重新登录';
            let errorDetails = null;
            try {
                const error = await res.json();
                errorMessage = error.detail || error.message || errorMessage;
                errorDetails = error;
            } catch {
                // 401 响应没有 JSON 正文时保留通用提示。
            }

            if (redirectOnUnauthorized) {
                console.warn('收到 401 未授权响应，跳转到登录页');
                handleUnauthorized();
            }

            // 抛出带状态与详情的认证错误，供登录表单展示服务端本地化信息。
            const authError = new Error(errorMessage) as Error & {
                status: number;
                isAuthError: boolean;
                details: unknown;
            };
            authError.status = 401;
            authError.isAuthError = true;
            authError.details = errorDetails;
            throw authError;
        }
        
        let errorMessage = 'Request failed';
        let errorDetails = null;
        
        try {
            const error = await res.json();
            errorMessage = error.detail || error.message || `HTTP ${res.status}: ${res.statusText}`;
            errorDetails = error;
        } catch (error) {
            console.error('Failed to parse error response:', error)
            // If JSON cannot be parsed, use HTTP status information
            errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        // 创建包含更多信息的错误对象（使用类型断言避免 TS 报错）
        const newError = new Error(errorMessage) as Error & {
            status?: number;
            statusText?: string;
            url?: string;
            details?: any;
        };
        newError.status = res.status;
        newError.statusText = res.statusText;
        newError.url = fullUrl;
        newError.details = errorDetails;

        throw newError;
    }

    if (stream) {
        if (!res.body) {
            throw new Error('响应体为空，无法进行流式读取');
        }
        
        // 检查响应体是否支持 getReader
        if (typeof res.body.getReader !== 'function') {
            throw new Error('响应体不支持 getReader 方法');
        }
        
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        
        try {
            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                
                if (value) {
                    const chunk = decoder.decode(value, { stream: !done });
                    
                    if (onData) {
                        onData(chunk);
                    }
                }
            }
            
        } catch (error) {
            throw error;
        } finally {
            // 确保释放 reader
            try {
                reader.releaseLock();
            } catch (e) {
                console.warn('释放 reader 锁失败:', e);
            }
        }
        
        return;
    } else {
        return res.json();
    }
}