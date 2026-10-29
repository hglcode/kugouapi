/**
 * 测试辅助：可编程的 fetch mock。
 */

export interface RecordedCall {
    url: string;
    init: RequestInit;
}

export type MockedResponse =
    { status?: number; body?: string | Uint8Array; headers?: Record<string, string> } | Error;

/**
 * 按 fifo 顺序返回预设响应的 fetch mock；
 * 未知调用行为可通过 onCall 钩子自定义。
 */
export class FetchMock {
    readonly calls: RecordedCall[] = [];

    private readonly queue: MockedResponse[];

    constructor(responses: MockedResponse[] = []) {
        this.queue = [...responses];
    }

    readonly fetch = (url: string, init: RequestInit): Promise<Response> => {
        this.calls.push({ url, init });
        const next: MockedResponse =
            this.queue.length > 0
                ? (this.queue.shift() as MockedResponse)
                : { status: 200, body: '' };
        if (next instanceof Error) return Promise.reject(next);

        const body =
            next.body === undefined
                ? ''
                : typeof next.body === 'string'
                  ? next.body
                  : new Uint8Array(next.body);
        return Promise.resolve(
            new Response(body, { status: next.status ?? 200, headers: next.headers }),
        );
    };

    /** 最近一次调用的 URL 查询参数 */
    lastQuery(): URLSearchParams {
        const last = this.calls.at(-1);
        if (!last) throw new Error('no recorded call');
        return new URLSearchParams(last.url.split('?')[1] ?? '');
    }

    /** 最近一次调用的请求头 */
    lastHeaders(): Headers {
        const last = this.calls.at(-1);
        if (!last) throw new Error('no recorded call');
        return new Headers(last.init.headers);
    }
}

/** 构造一个始终返回同一信封的成功响应 */
export function okEnvelope(data: unknown): MockedResponse {
    return { status: 200, body: JSON.stringify({ status: 1, error_code: 0, data }) };
}

export function errorEnvelope(errorCode: number, message = 'error'): MockedResponse {
    return {
        status: 200,
        body: JSON.stringify({ status: 1, error_code: errorCode, error_text: message }),
    };
}
