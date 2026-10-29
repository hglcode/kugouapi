import { describe, expect, test } from 'bun:test';

import { KuGouClient } from '../src/client';
import { DEFAULT_DEVICE, deriveMid } from '../src/device';
import { KuGouApiError } from '../src/error';
import { signature, trackerKey } from '../src/sign';
import type { CryptoProvider, EncryptedRequest, SessionSnapshot } from '../src/index';
import { FetchMock, errorEnvelope, okEnvelope, type MockedResponse } from './helpers';

/** 固定密钥的桩加密器：请求体 = 原文，便于断言 */
function stubCrypto(): CryptoProvider {
    return {
        encryptRequest(data: unknown): EncryptedRequest {
            return { body: `BODY:${JSON.stringify(data)}`, key: 'abcdef' };
        },
        decryptResponse(payload: string): unknown {
            return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
        },
        encryptKey(): string {
            return 'P-PARAM';
        },
    };
}

const SESSION: SessionSnapshot = {
    dfid: 'DFID1',
    mid: 'MID1',
    uuid: 'UUID1',
    token: 'TOKEN1',
    userid: 42,
};

function makeClient(responses: MockedResponse[] = [], init: object = {}) {
    const mock = new FetchMock(responses);
    const client = new KuGouClient({ fetch: mock.fetch, ...init });
    return { mock, client };
}

// ─────────────────────────────────────────────────────────────

describe('KuGouClient.search', () => {
    test('URL / 查询参数 / 请求头 / 签名均按协议构造', async () => {
        const { mock, client } = makeClient([okEnvelope({ lists: [], total: 0 })]);
        const data = await client.search({ keyword: '周杰伦', page: 2, pageSize: 10 });

        expect(data).toEqual({ lists: [], total: 0 });
        expect(mock.calls).toHaveLength(1);

        const call = mock.calls[0]!;
        expect(call.url.startsWith('https://gateway.kugou.com/v2/search/song?')).toBe(true);
        expect(call.init.method).toBe('GET');

        const query = mock.lastQuery();
        expect(query.get('keyword')).toBe('周杰伦');
        expect(query.get('page')).toBe('2');
        expect(query.get('pagesize')).toBe('10');
        expect(query.get('appid')).toBe('1005');
        expect(query.get('clientver')).toBe('20489');
        expect(query.get('dfid')).toBe('-');
        // 未注册时 mid = deriveMid(dfid) = md5('-')
        expect(query.get('mid')).toBe('336d5ebc5436534e61d16e63ddfca327');
        expect(query.get('platform')).toBe('AndroidFilter');
        expect(query.get('iscorrection')).toBe('1');
        expect(query.get('clienttime')).toMatch(/^\d+$/);

        // 签名 = 对“实际发送的其余参数”重算的结果（standard 盐）
        const sent = Object.fromEntries(
            [...query.entries()].filter(([k]) => k !== 'signature'),
        ) as Record<string, string | number>;
        expect(query.get('signature')).toBe(signature(sent, { platform: 'standard' }));

        const headers = mock.lastHeaders();
        expect(headers.get('x-router')).toBe('complexsearch.kugou.com');
        expect(headers.get('kg-rc')).toBe('1');
        expect(headers.get('mid')).toBeTruthy();
        expect(headers.get('clienttime')).toMatch(/^\d+$/);
    });

    test('已注册会话的 dfid / mid / token / userid 自动携带', async () => {
        const { mock, client } = makeClient([okEnvelope({ lists: [], total: 0 })], {
            session: SESSION,
        });
        await client.search({ keyword: 'k' });

        const query = mock.lastQuery();
        expect(query.get('dfid')).toBe('DFID1');
        expect(query.get('mid')).toBe('MID1');
        expect(query.get('token')).toBe('TOKEN1');
        expect(query.get('userid')).toBe('42');
        expect(mock.lastHeaders().get('dfid')).toBe('DFID1');
    });

    test('lite 平台使用 lite 签名盐', async () => {
        const { mock, client } = makeClient([okEnvelope({ lists: [], total: 0 })], {
            platform: 'lite',
        });
        await client.search({ keyword: 'k' });

        const query = mock.lastQuery();
        expect(query.get('appid')).toBe('3116');
        const sent = Object.fromEntries(
            [...query.entries()].filter(([k]) => k !== 'signature'),
        ) as Record<string, string | number>;
        expect(query.get('signature')).toBe(signature(sent, { platform: 'lite' }));
    });
});

// ─────────────────────────────────────────────────────────────

describe('KuGouClient.songUrl', () => {
    test('hash 转小写、特殊音质加 magic_ 前缀，key 自动生成', async () => {
        const { mock, client } = makeClient([okEnvelope({ url: ['http://a'] })]);
        const data = await client.songUrl({ hash: 'ABC123', quality: 'dj' });

        expect(data.url).toEqual(['http://a']);
        const query = mock.lastQuery();
        expect(query.get('hash')).toBe('abc123');
        expect(query.get('quality')).toBe('magic_dj');
        expect(query.get('pid')).toBe('2');
        expect(query.get('page_id')).toBe('151369488');
        expect(mock.lastHeaders().get('x-router')).toBe('trackercdn.kugou.com');

        // tracker key：与最终 query 的 mid / userid / appid 一致地计算
        expect(query.get('key')).toBe(
            trackerKey({
                hash: 'abc123',
                mid: deriveMid('-'),
                userid: 0,
                appid: 1005,
                platform: 'standard',
            }),
        );

        // signature 覆盖含 key 的全部参数
        const sent = Object.fromEntries(
            [...query.entries()].filter(([k]) => k !== 'signature'),
        ) as Record<string, string | number>;
        expect(query.get('signature')).toBe(signature(sent, { platform: 'standard' }));
    });

    test('常规音质不加前缀；freePart 生效', async () => {
        const { mock, client } = makeClient([okEnvelope({})]);
        await client.songUrl({ hash: 'abc', quality: 'flac', freePart: true });

        const query = mock.lastQuery();
        expect(query.get('quality')).toBe('flac');
        expect(query.get('IsFreePart')).toBe('1');
    });

    test('lite 平台使用 lite tracker 参数与 lite key 盐', async () => {
        const { mock, client } = makeClient([okEnvelope({})], { platform: 'lite' });
        await client.songUrl({ hash: 'abc' });

        const query = mock.lastQuery();
        expect(query.get('pid')).toBe('411');
        expect(query.get('page_id')).toBe('967177915');
        expect(query.get('ppage_id')).toBe('356753938,823673182,967485191');
        expect(query.get('key')).toBe(
            trackerKey({
                hash: 'abc',
                mid: deriveMid('-'),
                userid: 0,
                appid: 3116,
                platform: 'lite',
            }),
        );
    });
});

// ─────────────────────────────────────────────────────────────

describe('KuGouClient.registerDevice', () => {
    test('加密请求体 / p 参数 / register 签名 / 自动会话', async () => {
        const { mock, client } = makeClient(
            [okEnvelope({ dfid: 'DFID2', token: 'TOKEN2', userid: 9, mid: 'MID2' })],
            { crypto: { provider: stubCrypto() } },
        );
        const data = await client.registerDevice({ imei: 'i'.repeat(32) });

        expect(data.dfid).toBe('DFID2');
        const call = mock.calls[0]!;
        expect(call.url.startsWith('https://userservice.kugou.com/risk/v3/r_register_dev?')).toBe(
            true,
        );
        expect(call.init.method).toBe('POST');
        expect(call.init.body).toBe(
            `BODY:${JSON.stringify({ ...DEFAULT_DEVICE, imei: 'i'.repeat(32) })}`,
        );

        const query = mock.lastQuery();
        expect(query.get('p')).toBe('P-PARAM');
        expect(query.get('appid')).toBe('1005');
        expect(query.get('part')).toBe('1');
        expect(query.get('platid')).toBe('1');
        const sent = Object.fromEntries(
            [...query.entries()].filter(([k]) => k !== 'signature'),
        ) as Record<string, string | number>;
        // 与参考实现对齐：register_dev 使用 android 签名（覆盖含 p 的全部参数）
        expect(query.get('signature')).toBe(
            signature(sent, { kind: 'android', platform: 'standard' }),
        );

        expect(mock.lastHeaders().get('user-agent')).toBe(
            'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
        );

        // 会话自动更新
        const session = client.session;
        expect(session?.dfid).toBe('DFID2');
        expect(session?.token).toBe('TOKEN2');
        expect(session?.userid).toBe(9);
        expect(session?.mid).toBe('MID2');
        expect(session?.uuid).toBe(DEFAULT_DEVICE.uuid);
    });

    test('注册后的凭证会被后续 search 携带', async () => {
        const { mock, client } = makeClient(
            [okEnvelope({ dfid: 'DFID3' }), okEnvelope({ lists: [], total: 0 })],
            { crypto: { provider: stubCrypto() } },
        );
        await client.registerDevice();
        await client.search({ keyword: 'k' });

        const query = mock.lastQuery();
        expect(query.get('dfid')).toBe('DFID3');
    });

    test('无凭证字段时保持会话为空并告警', async () => {
        const logs: string[] = [];
        const { client } = makeClient([okEnvelope({ nothing: 1 })], {
            crypto: { provider: stubCrypto() },
            logger: {
                debug() {},
                info() {},
                warn: (m: string) => logs.push(m),
                error() {},
            },
        });
        await client.registerDevice();

        expect(client.session).toBeNull();
        expect(logs.some((m) => m.includes('未发现凭证字段'))).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────

describe('KuGouClient.request（通用逃生舱）', () => {
    test('合并基础参数并签名；sign:false 关闭签名', async () => {
        const { mock, client } = makeClient([okEnvelope(1), okEnvelope(1)]);
        await client.request('/v9/anything', { query: { keyword: 'x' } });

        let query = mock.lastQuery();
        expect(query.get('keyword')).toBe('x');
        expect(query.get('appid')).toBe('1005');
        expect(query.get('signature')).toHaveLength(32);
        expect(mock.calls[0]!.url.startsWith('https://gateway.kugou.com/v9/anything?')).toBe(true);

        await client.request('/v9/raw', { query: { keyword: 'x' }, sign: false });
        query = mock.lastQuery();
        expect(query.get('signature')).toBeNull();
    });

    test('自定义 baseUrl 与 headers', async () => {
        const { mock, client } = makeClient([okEnvelope(1)]);
        await client.request('/x', {
            baseUrl: 'https://example.com',
            sign: false,
            headers: { 'x-custom': '1' },
        });
        expect(mock.calls[0]!.url.startsWith('https://example.com/x?')).toBe(true);
        expect(mock.lastHeaders().get('x-custom')).toBe('1');
    });

    test('非信封 JSON 原样返回', async () => {
        const { client } = makeClient([{ status: 200, body: '{"plain":true}' }]);
        const data = await client.request('/x', { sign: false });
        expect(data).toEqual({ plain: true });
    });
});

// ─────────────────────────────────────────────────────────────

describe('错误处理', () => {
    test('业务错误信封抛出 KuGouApiError（含 code 与 payload）', async () => {
        const { client } = makeClient([errorEnvelope(30001, '签名错误')]);
        const error = await client.search({ keyword: 'k' }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(KuGouApiError);
        const apiError = error as KuGouApiError;
        expect(apiError.code).toBe(30001);
        expect((apiError.payload as { error_text: string }).error_text).toBe('签名错误');
        expect(apiError.name).toBe('KuGouApiError');
    });

    test('HTTP 非 2xx 抛错并携带状态码', async () => {
        // 两次 503：第一次触发重试，重试后仍失败
        const { client } = makeClient([
            { status: 503, body: 'oops' },
            { status: 503, body: 'oops' },
        ]);
        const error = await client.search({ keyword: 'k' }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(KuGouApiError);
        expect((error as KuGouApiError).code).toBe(503);
    });

    test('tracker 错误信封（errcode/errmsg）抛出 KuGouApiError', async () => {
        const { client } = makeClient([
            {
                status: 200,
                body: JSON.stringify({ errcode: '20006', status: 0, errmsg: 'err signature' }),
            },
        ]);
        const error = await client.songUrl({ hash: 'abc' }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(KuGouApiError);
        expect((error as KuGouApiError).code).toBe(20006);
        expect((error as KuGouApiError).message).toContain('err signature');
    });

    test('tracker 风控响应（errcode=20028）抛出并携带 payload', async () => {
        const { client } = makeClient([
            {
                status: 200,
                body: JSON.stringify({
                    fail_process: ['pkg'],
                    errcode: 20028,
                    status: 2,
                    error: '本次请求需要验证',
                }),
            },
        ]);
        const error = await client.songUrl({ hash: 'abc' }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(KuGouApiError);
        expect((error as KuGouApiError).code).toBe(20028);
    });

    test('非 JSON 响应抛错', async () => {
        const { client } = makeClient([{ status: 200, body: '<html>not json</html>' }]);
        await expect(client.search({ keyword: 'k' })).rejects.toBeInstanceOf(KuGouApiError);
    });
});

// ─────────────────────────────────────────────────────────────

describe('会话管理', () => {
    test('setSession 可恢复会话并支持链式调用', async () => {
        const { mock, client } = makeClient([okEnvelope({ lists: [], total: 0 })]);
        const returned = client.setSession(SESSION);
        expect(returned).toBe(client);

        await client.search({ keyword: 'k' });
        expect(mock.lastQuery().get('dfid')).toBe('DFID1');
        expect(client.session?.token).toBe('TOKEN1');
    });

    test('session getter 返回副本，外部修改不影响内部状态', async () => {
        const { mock, client } = makeClient([okEnvelope({ lists: [], total: 0 })], {
            session: SESSION,
        });
        const snapshot = client.session! as SessionSnapshot;
        snapshot.dfid = 'TAMPERED';

        await client.search({ keyword: 'k' });
        expect(mock.lastQuery().get('dfid')).toBe('DFID1');
    });
});
