/**
 * 极简 HTTP 分发层：URL 构建、超时、GET 重试。
 *
 * 两条路径：
 * - httpClient（默认）：@hglcode/httpclient 实例，重试 / per-attempt 超时 /
 *   熔断由其全权管理，本层不重复实现
 * - fetch（注入）：任意 FetchLike（测试 mock / 代理），沿用内置
 *   单 signal 超时 + GET 重试退避
 *
 * 不做 JSON 解析与业务解包——那是 client 的职责。
 *
 * @module
 */

import { KuGouApiError } from './error';
import type { HttpClientLike } from './adapters/httpclient';
import type { FetchLike, Logger, QueryRecord } from './types';

export interface HttpInit {
    /** 结构化 HTTP 客户端：重试 / 超时 / 熔断由其管理（优先于 fetch） */
    httpClient?: HttpClientLike;
    /** 注入 fetch（测试 mock / 特殊用途）；与 httpClient 互斥 */
    fetch?: FetchLike;
    /** 默认超时（毫秒） */
    timeoutMs?: number;
    /** GET 默认重试次数（POST 不重试）；仅 fetch 路径生效 */
    retries?: number;
    logger?: Logger;
}

export interface HttpRequestOptions {
    method?: 'GET' | 'POST' | 'DELETE';
    query?: QueryRecord;
    headers?: Record<string, string>;
    body?: string | Uint8Array;
    timeoutMs?: number;
    retries?: number;
    redirect?: 'follow' | 'manual' | 'error';
}

export interface HttpResult {
    status: number;
    ok: boolean;
    /** 原始响应字节（文本与二进制统一处理） */
    bytes: Uint8Array;
    contentType: string;
    /** 响应头（fetch Headers 实例） */
    headers: Headers;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 1;
/** 可重试的 HTTP 状态码 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
/** 可重试的网络层异常名（fetch 网络故障为 TypeError；超时为 Abort/TimeoutError） */
const RETRYABLE_ERRORS = new Set(['TypeError', 'AbortError', 'TimeoutError']);

/** 分发 init：标准 RequestInit + httpclient 的 per-attempt timeout 扩展 */
type DispatchInit = RequestInit & { timeout?: number };

export class Http {
    private readonly fetcher: (url: string, init: DispatchInit) => Promise<Response>;
    /** true = 重试 / 超时语义外置到结构化客户端，本层不重复处理 */
    private readonly managed: boolean;
    private readonly defaultTimeoutMs: number;
    private readonly defaultRetries: number;
    private readonly logger: Logger | undefined;

    constructor(init: HttpInit = {}) {
        if (init.httpClient) {
            const client = init.httpClient;
            this.fetcher = (url, request) => client.fetch(url, request);
            this.managed = true;
        } else {
            const fetcher =
                init.fetch ?? ((url: string, request: DispatchInit) => fetch(url, request));
            this.fetcher = fetcher;
            this.managed = false;
        }
        this.defaultTimeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.defaultRetries = init.retries ?? DEFAULT_RETRIES;
        this.logger = init.logger;
    }

    async request(url: string, options: HttpRequestOptions = {}): Promise<HttpResult> {
        const method = options.method ?? 'GET';
        // httpclient 路径重试全权外置；fetch 路径：带请求体的方法默认不重试，避免重复副作用
        const retries = this.managed
            ? 0
            : (options.retries ?? (method === 'GET' ? this.defaultRetries : 0));
        const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
        const target = withQuery(url, options.query);

        for (let attempt = 0; ; attempt++) {
            const startedAt = Date.now();
            try {
                const init: DispatchInit = {
                    method,
                    headers: options.headers,
                    body: options.body,
                    redirect: options.redirect,
                };
                if (this.managed) {
                    // per-attempt 超时（每次尝试独立计时）
                    if (timeoutMs > 0) init.timeout = timeoutMs;
                } else if (timeoutMs > 0) {
                    // 单 signal 覆盖含重试的全过程
                    init.signal = AbortSignal.timeout(timeoutMs);
                }
                const response = await this.fetcher(target, init);
                const elapsed = Date.now() - startedAt;
                this.logger?.debug(
                    `[kugou] ${method} ${target} -> ${response.status} (${elapsed}ms)`,
                );

                if (!this.managed && RETRYABLE_STATUS.has(response.status) && attempt < retries) {
                    await backoff(attempt);
                    continue;
                }
                const bytes = new Uint8Array(await response.arrayBuffer());
                return {
                    status: response.status,
                    ok: response.ok,
                    bytes,
                    contentType: response.headers.get('content-type') ?? '',
                    headers: response.headers,
                };
            } catch (cause) {
                if (!this.managed && attempt < retries && isRetryable(cause)) {
                    await backoff(attempt);
                    continue;
                }
                throw new KuGouApiError(`请求失败：${method} ${target}`, { code: -1, cause });
            }
        }
    }
}

/** 追加查询串：undefined / null 的键直接剔除；对象/数组以 JSON 文本编码 */
export function withQuery(url: string, query: QueryRecord | undefined): string {
    if (!query) return url;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        params.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    const qs = params.toString();
    if (!qs) return url;
    return `${url}${url.includes('?') ? '&' : '?'}${qs}`;
}

/** 指数退避 + 抖动：300ms * 2^n + 0~200ms */
function backoff(attempt: number): Promise<void> {
    const ms = 300 * 2 ** attempt + Math.random() * 200;
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(cause: unknown): boolean {
    return cause instanceof Error && RETRYABLE_ERRORS.has(cause.name);
}
