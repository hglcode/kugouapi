/**
 * HTTP 后端：基于 [@glcoding/httpclient](https://github.com/hglcode/httpclient)。
 *
 * 库自 0.5.0 起将其作为运行时依赖（git 源直接安装，无需发布 npm）：
 * - 重试：指数退避 + half/full jitter、遵循 Retry-After、幂等方法白名单
 *   （POST 不在默认白名单，与"写操作不重试"的旧语义一致）
 * - 超时：per-attempt 语义（每次尝试独立计时，优于单 signal 覆盖全程）
 * - 熔断：滑动窗口失败率三态机，酷狗网关 5xx 比例过高时快速失败
 * - Bun 走全局 fetch 路径（等价拦截链），Node 走 undici dispatcher
 *
 * `createKuGouHttpClient()` 附带酷狗预设：cookies 关闭（网关会话走查询参数，
 * 避免 WAF Set-Cookie 被自动回传）、fetch 语义（2xx 判断由本库统一完成）。
 *
 * @example
 * ```ts
 * import { KuGouClient } from 'kugou-api';
 *
 * // 默认：自动创建（超时 10s / GET 重试 1 次 / 熔断开启）
 * const client = new KuGouClient({ device: randomDevice() });
 * await client.search({ keyword: '周杰伦' });
 * await client.close(); // 优雅关闭内部实例
 *
 * // 定制：先建实例再注入（限流 / 遥测 / 连接池在此配置）
 * const http = createKuGouHttpClient({
 *     timeout: 15_000,
 *     retry: { maxRetries: 2 },
 *     rateLimit: { requestsPerSecond: 10 },
 * });
 * const client2 = new KuGouClient({ httpClient: http });
 * ```
 *
 * @module
 */

import { createHttpClient, type HttpClient, type HttpClientOptions } from '@glcoding/httpclient';

import type { FetchLike } from '../types';

/**
 * 任何提供标准 fetch 形状方法的对象即可注入
 * （`@glcoding/httpclient` 的 HttpClient / undici 包装器 / 自研客户端）。
 *
 * init 为标准 RequestInit 加 per-attempt `timeout` 扩展字段；
 * 仅实现标准 RequestInit 的客户端同样兼容（timeout 可选）。
 */
export interface HttpClientLike {
    fetch(url: string, init?: RequestInit & { timeout?: number }): Promise<Response>;
}

/** 酷狗预设的 HttpClientOptions 子集（其余选项原样透传给 httpclient） */
export interface KuGouHttpClientOptions extends HttpClientOptions {
    /**
     * Cookie 会话：强制关闭语义提示。
     * 酷狗网关不依赖 cookie（身份走查询参数），默认 `false`
     * 避免 WAF Set-Cookie 被自动回传；确需 cookie 的网页互操作
     * 端点（QQ 扫码登录等）由端点 handler 显式管理 cookie 字符串。
     */
    cookies?: HttpClientOptions['cookies'];
}

/**
 * 创建酷狗预设的 HTTP 客户端。
 *
 * 预设：`cookies: false`（网关无 cookie）、`throwOnHttpError: false`
 * （保持 fetch 语义，2xx 判断由 KuGouClient 统一完成）。
 * 其余（timeout / retry / 熔断 / 限流 / 遥测 / 连接池）用 httpclient 默认或自行覆盖。
 */
export function createKuGouHttpClient(options: KuGouHttpClientOptions = {}): HttpClient {
    const { ...rest } = options;
    return createHttpClient({
        cookies: false,
        throwOnHttpError: false,
        ...rest,
    });
}

/**
 * 把 HTTP 客户端包装为库的 FetchLike 注入物（测试 / 特殊用途）。
 *
 * 纯透传：URL、方法、请求头、请求体、redirect、AbortSignal
 * 原样交给底层客户端；返回标准 Response。
 *
 * 注：`HttpClient`（undici 类型源）与 `HttpClientLike`（全局 RequestInit 类型源）
 * 声明不兼容但运行时结构一致，此处统一断言桥接。
 */
export function wrapHttpClient(client: HttpClient | HttpClientLike): FetchLike {
    const unified = client as HttpClientLike;
    return (url, init) => unified.fetch(url, init);
}

// 类型再导出，统一公共类型面
export type { HttpClient, HttpClientOptions } from '@glcoding/httpclient';
