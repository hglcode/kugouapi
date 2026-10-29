import { describe, expect, test } from 'bun:test';

import { wrapHttpClient } from '../src/adapters/httpclient';
import type { HttpClientLike } from '../src/adapters/httpclient';
import { KuGouClient } from '../src/client';

/** 模拟 @hglcode/httpclient 形状的客户端：记录调用并返回可编程响应 */
class HttpClientMock implements HttpClientLike {
    readonly calls: { url: string; init: RequestInit }[] = [];

    private readonly queue: { status?: number; body?: string }[];

    constructor(responses: { status?: number; body?: string }[] = []) {
        this.queue = [...responses];
    }

    fetch(url: string, init?: RequestInit): Promise<Response> {
        this.calls.push({ url, init: init ?? {} });
        const next = this.queue.shift() ?? { status: 200, body: '' };
        return Promise.resolve(new Response(next.body ?? '', { status: next.status ?? 200 }));
    }
}

describe('wrapHttpClient', () => {
    test('URL 与 init 字段纯透传（method/headers/body/redirect/signal）', async () => {
        const http = new HttpClientMock([{ status: 204, body: '' }]);
        const fetch = wrapHttpClient(http);
        const signal = new AbortController().signal;

        const response = await fetch('https://example.com/a?b=1', {
            method: 'POST',
            headers: { 'x-router': 'complexsearch.kugou.com' },
            body: '{"k":1}',
            redirect: 'manual',
            signal,
        });

        expect(response.status).toBe(204);
        expect(http.calls.length).toBe(1);
        expect(http.calls[0]!.url).toBe('https://example.com/a?b=1');
        expect(http.calls[0]!.init.method).toBe('POST');
        expect(http.calls[0]!.init.redirect).toBe('manual');
        expect(http.calls[0]!.init.signal).toBe(signal);
        expect(new Headers(http.calls[0]!.init.headers).get('x-router')).toBe(
            'complexsearch.kugou.com',
        );
        expect(http.calls[0]!.init.body).toBe('{"k":1}');
    });

    test('缺省 init 时以空对象透传（库内 Http 层总是显式传 init）', async () => {
        const http = new HttpClientMock([{ status: 200, body: 'ok' }]);
        const fetch = wrapHttpClient(http);

        await fetch('https://example.com/', {});

        expect(http.calls[0]!.init).toEqual({});
    });
});

describe('KuGouClient + wrapHttpClient 集成', () => {
    test('search 全链路：注入客户端收到网关请求并正确解析信封', async () => {
        const http = new HttpClientMock([
            {
                status: 200,
                body: JSON.stringify({
                    status: 1,
                    error_code: 0,
                    data: { lists: [{ FileName: '晴天', FileHash: 'abc' }], total: 1 },
                }),
            },
        ]);
        const client = new KuGouClient({
            fetch: wrapHttpClient(http),
            retries: 0,
        });

        const data = await client.search({ keyword: '周杰伦' });

        expect(data.lists[0]!.FileName).toBe('晴天');
        const call = http.calls[0]!;
        expect(call.url.startsWith('https://gateway.kugou.com/v2/search/song?')).toBe(true);
        expect(call.init.method).toBe('GET');
        const headers = new Headers(call.init.headers);
        expect(headers.get('x-router')).toBe('complexsearch.kugou.com');
        const params = new URLSearchParams(call.url.split('?')[1] ?? '');
        expect(params.get('keyword')).toBe('周杰伦');
        expect(params.get('signature')).toBeTruthy();
    });

    test('retries=0 时库内重试关闭，错误直接抛出（重试交由注入客户端管理）', async () => {
        const http = new HttpClientMock([{ status: 503, body: 'unavailable' }]);
        const client = new KuGouClient({
            fetch: wrapHttpClient(http),
            retries: 0,
        });

        await expect(client.call('rank.list')).rejects.toThrow(/HTTP 503/);
        expect(http.calls.length).toBe(1);
    });

    test('POST 端点：请求体与 Content-Type 透传', async () => {
        const http = new HttpClientMock([
            {
                status: 200,
                body: JSON.stringify({ status: 1, error_code: 0, data: { accepted: true } }),
            },
        ]);
        const client = new KuGouClient({
            fetch: wrapHttpClient(http),
            session: { dfid: 'd1', mid: 'm1', uuid: 'u1', token: 't1', userid: 42 },
        });

        await client.call('comment.music.send', {
            special_id: 487203,
            name: '晴天',
            content: 'hello',
            mixed: false,
        });

        const call = http.calls[0]!;
        expect(call.init.method).toBe('POST');
        expect(new Headers(call.init.headers).get('content-type')).toContain('application/json');
        expect(typeof call.init.body).toBe('string');
        expect(String(call.init.body).includes('hello')).toBe(true);
    });
});
