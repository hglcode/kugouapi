import { describe, expect, test } from 'bun:test';

import { Http, withQuery } from '../src/http';
import { KuGouApiError } from '../src/error';
import { FetchMock, okEnvelope } from './helpers';

describe('withQuery', () => {
    test('拼接查询串并编码特殊字符', () => {
        const url = withQuery('https://example.com/a', { b: 2, a: 'x y', kw: '周杰伦' });
        const params = new URLSearchParams(url.split('?')[1]!);
        expect(params.get('a')).toBe('x y');
        expect(params.get('b')).toBe('2');
        expect(params.get('kw')).toBe('周杰伦');
        expect(url.startsWith('https://example.com/a?')).toBe(true);
    });

    test('剔除 undefined / null；无有效参数时不追加 ?', () => {
        expect(withQuery('https://example.com/a', { a: undefined, b: null })).toBe(
            'https://example.com/a',
        );
        expect(withQuery('https://example.com/a', undefined)).toBe('https://example.com/a');
    });
});

describe('Http.request', () => {
    test('GET 返回原始字节与状态', async () => {
        const mock = new FetchMock([{ status: 200, body: '{"ok":true}' }]);
        const http = new Http({ fetch: mock.fetch });
        const result = await http.request('https://example.com/x', { query: { a: 1 } });

        expect(result.status).toBe(200);
        expect(result.ok).toBe(true);
        expect(new TextDecoder().decode(result.bytes)).toBe('{"ok":true}');
        expect(mock.calls[0]!.url).toBe('https://example.com/x?a=1');
        expect(mock.calls[0]!.init.method).toBe('GET');
    });

    test('可重试状态码触发重试后成功', async () => {
        const mock = new FetchMock([
            { status: 502, body: 'bad gateway' },
            { status: 502, body: 'bad gateway' },
            okEnvelope({ value: 1 }),
        ]);
        const http = new Http({ fetch: mock.fetch, retries: 2 });
        const result = await http.request('https://example.com/x');

        expect(result.status).toBe(200);
        expect(mock.calls).toHaveLength(3);
    });

    test('网络错误触发重试，最终仍失败则抛 KuGouApiError(code=-1)', async () => {
        const mock = new FetchMock([new TypeError('fetch failed'), new TypeError('fetch failed')]);
        const http = new Http({ fetch: mock.fetch, retries: 1 });

        const error = await http.request('https://example.com/x').catch((e: unknown) => e);
        expect(error).toBeInstanceOf(KuGouApiError);
        expect((error as KuGouApiError).code).toBe(-1);
        expect(mock.calls).toHaveLength(2);
    });

    test('POST 默认不重试', async () => {
        const mock = new FetchMock([
            { status: 500, body: 'err' },
            { status: 200, body: '' },
        ]);
        const http = new Http({ fetch: mock.fetch, retries: 2 });
        const result = await http.request('https://example.com/x', { method: 'POST', body: 'p' });

        // 第一份 500 响应直接返回（不重试）
        expect(result.status).toBe(500);
        expect(mock.calls).toHaveLength(1);
    });

    test('超时：signal 已传给 fetch 且超时错误可被识别', async () => {
        const hang = (url: string, init: RequestInit): Promise<Response> =>
            new Promise((_, reject) => {
                init.signal?.addEventListener('abort', () =>
                    reject(new DOMException('timeout', 'TimeoutError')),
                );
            });
        const http = new Http({ fetch: hang, retries: 0, timeoutMs: 30 });

        const error = await http.request('https://example.com/x').catch((e: unknown) => e);
        expect(error).toBeInstanceOf(KuGouApiError);
        expect((error as KuGouApiError).code).toBe(-1);
        expect((error as Error).cause).toBeInstanceOf(DOMException);
    });
});
