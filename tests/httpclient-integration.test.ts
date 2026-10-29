/**
 * 真实 @glcoding/httpclient 集成测试（离线：stub 全局 fetch）。
 *
 * Bun 下 httpclient 走全局 fetch 等价拦截链（bun-compat），
 * 因此 stub globalThis.fetch 即可覆盖：默认链路、重试、
 * cookies 关闭语义、close() 生命周期。
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { KuGouClient, createKuGouHttpClient } from '../src/index';

const realFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = realFetch as typeof fetch;
});

/** 可编程全局 fetch stub：按序返回预设响应并记录调用 */
function stubGlobalFetch(
    responses: { status?: number; body?: string; headers?: Record<string, string> }[],
) {
    const calls: { url: string; init: RequestInit }[] = [];
    const queue = [...responses];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
        const urlStr =
            typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        calls.push({ url: urlStr, init: init ?? {} });
        const next = queue.shift() ?? { status: 200, body: '' };
        return Promise.resolve(
            new Response(next.body ?? '', { status: next.status ?? 200, headers: next.headers }),
        );
    }) as typeof fetch;
    return calls;
}

const okBody = JSON.stringify({
    status: 1,
    error_code: 0,
    data: { lists: [{ FileName: '晴天', FileHash: 'abc' }], total: 1 },
});

describe('默认 HTTP 后端（自动创建 httpclient）', () => {
    test('默认构造走真实 httpclient 链路：search 成功', async () => {
        const calls = stubGlobalFetch([{ status: 200, body: okBody }]);
        const client = new KuGouClient({ retries: 0 });

        const data = await client.search({ keyword: '周杰伦' });

        expect(data.lists[0]!.FileName).toBe('晴天');
        expect(calls.length).toBe(1);
        expect(calls[0]!.url.startsWith('https://gateway.kugou.com/v2/search/song?')).toBe(true);
        await client.close();
    });

    test('GET 遇 502 由 httpclient 自动重试后成功（per-attempt 超时）', async () => {
        const calls = stubGlobalFetch([
            { status: 502, body: 'bad gateway' },
            { status: 200, body: okBody },
        ]);
        const client = new KuGouClient({ timeoutMs: 5_000 });

        const data = await client.search({ keyword: '晴天' });

        expect(data.lists[0]!.FileHash).toBe('abc');
        expect(calls.length).toBe(2); // 首次 502 + 重试成功
        await client.close();
    });

    test('retries: 0 时不重试，502 直接抛出', async () => {
        const calls = stubGlobalFetch([{ status: 502, body: 'bad gateway' }]);
        const client = new KuGouClient({ retries: 0 });

        await expect(client.call('rank.list')).rejects.toThrow(/HTTP 502/);
        expect(calls.length).toBe(1);
        await client.close();
    });

    test('cookies 预设关闭：Set-Cookie 不会被自动回传', async () => {
        const calls = stubGlobalFetch([
            { status: 200, body: okBody, headers: { 'set-cookie': 'waf_token=xyz; Path=/' } },
            { status: 200, body: okBody },
        ]);
        const client = new KuGouClient({ retries: 0 });

        await client.search({ keyword: '周杰伦' });
        await client.search({ keyword: '晴天' });

        const second = new Headers(calls[1]!.init.headers);
        expect(second.get('cookie')).toBe(null); // 网关链路无 cookie 副作用
        await client.close();
    });

    test('close() 幂等安全（重复调用不抛错）', async () => {
        stubGlobalFetch([{ status: 200, body: okBody }]);
        const client = new KuGouClient({ retries: 0 });

        await client.search({ keyword: '周杰伦' });
        await client.close();
        await client.close(); // 重复调用安全
    });
});

describe('注入实例（options.httpClient）', () => {
    test('注入 createKuGouHttpClient 实例：stats 统计真实请求数', async () => {
        const calls = stubGlobalFetch([{ status: 200, body: okBody }]);
        const http = createKuGouHttpClient({ retry: false, circuitBreaker: false });
        const client = new KuGouClient({ httpClient: http, retries: 0 });

        await client.search({ keyword: '周杰伦' });

        expect(calls.length).toBe(1);
        expect(http.stats.totalRequests).toBe(1);
        expect(http.stats.statusCounts['2xx']).toBe(1);
        await http.close();
    });
});
