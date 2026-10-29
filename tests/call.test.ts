import { describe, expect, test } from 'bun:test';

import { KuGouClient } from '../src/client';
import { KuGouApiError } from '../src/error';
import { md5, signature, trackerKey } from '../src/sign';
import type { SessionSnapshot } from '../src/index';
import { FetchMock, errorEnvelope, okEnvelope, type MockedResponse } from './helpers';

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

describe('call()：常规 GET 派发', () => {
    test('默认参数合并 / 签名 / router / 身份注入', async () => {
        const { mock, client } = makeClient([okEnvelope({ id: 1 })]);
        const data = await client.call('rank.list');
        expect(data).toEqual({ id: 1 });

        const call = mock.calls[0]!;
        expect(call.url.startsWith('https://gateway.kugou.com/ocean/v6/rank/list?')).toBe(true);
        const query = mock.lastQuery();
        expect(query.get('appid')).toBe('1005');
        expect(query.get('dfid')).toBe('-');
        expect(query.get('plat')).toBe('2');
        expect(query.get('signature')).toHaveLength(32);

        const sent = Object.fromEntries(
            [...query.entries()].filter(([k]) => k !== 'signature'),
        ) as Record<string, string | number>;
        expect(query.get('signature')).toBe(signature(sent, { platform: 'standard' }));
    });

    test('会话身份自动携带', async () => {
        const { mock, client } = makeClient([okEnvelope(1)], { session: SESSION });
        await client.call('rank.list');
        const query = mock.lastQuery();
        expect(query.get('dfid')).toBe('DFID1');
        expect(query.get('token')).toBe('TOKEN1');
        expect(query.get('userid')).toBe('42');
    });
});

describe('call()：POST 派发', () => {
    test('body JSON 序列化 + Content-Type + 签名覆盖 body', async () => {
        const { mock, client } = makeClient([okEnvelope({ added: true })]);
        const data = await client.call('playlist.tracks.add', {
            listid: 9001,
            data: '晴天|hash123|0|0',
        });
        expect(data).toEqual({ added: true });

        const call = mock.calls[0]!;
        expect(call.init.method).toBe('POST');
        expect(
            call.url.startsWith('https://gateway.kugou.com/cloudlist.service/v6/add_song?'),
        ).toBe(true);

        const body = JSON.parse(String(call.init.body)) as Record<string, any>;
        expect(body.listid).toBe(9001);
        expect(body.data[0].hash).toBe('hash123');

        const headers = mock.lastHeaders();
        expect(headers.get('content-type')).toBe('application/json');
    });

    test('listen.together 端点：query + body 同时携带', async () => {
        const { mock, client } = makeClient([okEnvelope({ ok: 1 })]);
        await client.call('listen.together.music.initialize', { roomid: 'R1' });

        const query = mock.lastQuery();
        expect(query.get('roomid')).toBe('R1');
        const body = JSON.parse(String(mock.calls[0]!.init.body)) as Record<string, any>;
        expect(body.audios).toEqual([]);
        expect(body.sendall).toBe(1);
    });
});

describe('call()：协议旗标', () => {
    test('trackerKey 自动注入并参与签名（song.url）', async () => {
        const { mock, client } = makeClient([okEnvelope({ url: ['x'] })]);
        await client.call('song.url', { hash: 'ABC123', album_audio_id: 5 });

        const query = mock.lastQuery();
        expect(query.get('hash')).toBe('abc123');
        expect(query.get('key')).toBe(
            trackerKey({
                hash: 'abc123',
                mid: '336d5ebc5436534e61d16e63ddfca327',
                userid: 0,
                appid: 1005,
                platform: 'standard',
            }),
        );
        const sent = Object.fromEntries(
            [...query.entries()].filter(([k]) => k !== 'signature'),
        ) as Record<string, string | number>;
        expect(query.get('signature')).toBe(signature(sent, { platform: 'standard' }));
    });

    test('salt=none 的端点不签名（comment.music）', async () => {
        const { mock, client } = makeClient([okEnvelope({ list: [] })]);
        await client.call('comment.music', { mixsongid: 123 });
        // comment.music 为 GET /mcomment/v1/cmtlist（android 签名）
        const query = mock.lastQuery();
        expect(query.get('signature')).toHaveLength(32);
    });

    test('clearParams 端点不注入身份（user.cloud 的 handler 内部验证见 cloud 协议测试）', async () => {
        // search.lyric 是 clearParams 的自动条目
        const { mock, client } = makeClient([okEnvelope({ status: 200, candidates: [] })]);
        await client.call('search.lyric', { keywords: '晴天', duration: 100 });
        const query = mock.lastQuery();
        expect(query.get('dfid')).toBeNull();
        expect(query.get('keyword')).toBe('晴天');
    });

    test('playlist.share.official：t.service 网关 + md5 链路 + 仅自定义头（上游 #293）', async () => {
        const { mock, client } = makeClient([okEnvelope({ status: 1 })], { session: SESSION });
        await client.call('playlist.share.official', { id: 'zj001' });

        const call = mock.calls[0]!;
        expect(call.url.startsWith('http://t.service.kugou.com/app?')).toBe(true);

        const query = mock.lastQuery();
        expect(query.get('caller')).toBe('mlist');
        expect(query.get('cmid')).toBe('5');
        // clearParams + salt=none：无签名、无身份参数
        expect(query.get('signature')).toBeNull();
        expect(query.get('appid')).toBeNull();
        expect(query.get('dfid')).toBeNull();

        const link = query.get('url')!;
        expect(link).toBe(
            'https://activity.kugou.com/share/v-a00a45b0/index.html?u=42' +
                '&h1=143298444507010930495471534764048014549' +
                '&h2=406dd14b2efd5e51affd6da64c84d0f6' +
                '&specialid=-2147483648&global_specialid=zj001&cType=0',
        );
        expect(query.get('md5')).toBe(md5(`kgclientshare${md5(link)}`));

        const headers = mock.lastHeaders();
        expect(headers.get('user-agent')).toBe('Android9-1070-10597-18-0-Share-wifi');
        expect(headers.get('kg-thash')).toMatch(/^[0-9a-f]{7}$/);
        // clearHeaders：不携带默认请求头
        expect(headers.get('content-type')).toBeNull();
    });

    test('playlist.share.official：type 非 1 走收藏歌单分支；缺 id 抛错', async () => {
        const { mock, client } = makeClient([okEnvelope({})]);
        // 与上游一致：type || 1，数字 0 短路为自建歌单；非 1 值（如 2）走收藏歌单
        await client.call('playlist.share.official', { id: 'p2', type: 2, userid: 7 });
        const url = mock.lastQuery().get('url')!;
        expect(url).toContain('?u=7&');
        expect(url).toContain('specialid=0&global_specialid=p2&cType=1');

        const { client: c2 } = makeClient([]);
        await expect(c2.call('playlist.share.official', {})).rejects.toThrow('歌单id不得为空');
    });

    test('urlOf 分发：search 的 type 路由', async () => {
        const { mock, client } = makeClient([okEnvelope({}), okEnvelope({})]);
        await client.call('search', { keyword: 'k', type: 'album' });
        expect(mock.calls[0]!.url).toContain('/v1/search/album');
        await client.call('search', { keyword: 'k', type: 'mv' });
        expect(mock.calls[1]!.url).toContain('/v1/search/mv');
    });

    test('动态 headersFn（search.mixed 的 kg-clienttimems）', async () => {
        const { mock, client } = makeClient([okEnvelope({})]);
        await client.call('search.mixed', { keyword: 'k' });
        expect(mock.lastHeaders().get('kg-clienttimems')).toMatch(/^\d+$/);
    });
});

describe('call()：特殊 handler', () => {
    test('本地 handler（login.qr.create）不发起请求', async () => {
        const { mock, client } = makeClient([]);
        const result = await client.call('login.qr.create', { key: 'QRKEY' });
        expect(result).toEqual({
            url: 'https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=QRKEY',
            base64: '',
        });
        expect(mock.calls).toHaveLength(0);
    });

    test('lyric handler：decode=true 时附 decodeContent', async () => {
        const lrcContent = Buffer.from('[00:00.00]hello').toString('base64');
        const { client } = makeClient([
            {
                status: 200,
                body: JSON.stringify({ status: 200, content: lrcContent, contenttype: 1 }),
            },
        ]);
        const data = await client.call('lyric', {
            id: 'X',
            accesskey: 'K',
            fmt: 'lrc',
            decode: true,
        });
        expect((data as Record<string, any>).decodeContent).toContain('[00:00.00]hello');
    });

    test('login.qr.check 成功后写入会话', async () => {
        const { mock, client } = makeClient([
            {
                status: 200,
                body: JSON.stringify({
                    status: 1,
                    error_code: 0,
                    data: { status: 4, token: 'T9', userid: 99 },
                }),
            },
        ]);
        const data = await client.call('login.qr.check', { key: 'QRKEY' });
        expect((data as Record<string, any>).status).toBe(4);
        expect(client.session?.token).toBe('T9');
        expect(client.session?.userid).toBe(99);
        // 请求应发往 login-user 源站且带 web 签名
        expect(
            mock.calls[0]!.url.startsWith('https://login-user.kugou.com/v2/get_userinfo_qrcode?'),
        ).toBe(true);
        expect(mock.lastQuery().get('signature')).toHaveLength(32);
    });

    test('加密 POST 族（user.cloud）：sessionCipher body + p/key 参数 + 响应回退', async () => {
        // 服务端返回未加密 JSON 时走回退解析（加密往返在 crypto.test.ts 覆盖）
        const { mock, client } = makeClient(
            [{ status: 200, body: JSON.stringify({ status: 1, data: { files: [1, 2] } }) }],
            { session: SESSION },
        );
        const data = await client.call('user.cloud', { page: 1, pagesize: 30 });
        expect(data).toEqual({ status: 1, data: { files: [1, 2] } });

        const call = mock.calls[0]!;
        expect(call.url.startsWith('https://mcloudservice.kugou.com/v1/get_list?')).toBe(true);
        const query = mock.lastQuery();
        expect(query.get('p')).toMatch(/^[0-9A-F]+$/);
        expect(query.get('key')).toHaveLength(32);
        // body 为 AES 密文（二进制）
        expect(call.init.body).toBeInstanceOf(Uint8Array);
        expect((call.init.body as Uint8Array).length).toBeGreaterThan(0);
    });

    test('import.playlist 按 operation 分发', async () => {
        const { mock, client } = makeClient([okEnvelope({ task_id: 1 }), okEnvelope({ count: 2 })]);
        await client.call('import.playlist', { url: 'https://x', task_type: 0 });
        expect(mock.calls[0]!.url).toContain('/assetservice/import/v1/add_task');
        await client.call('import.playlist', { operation: 'task_count' });
        expect(mock.calls[1]!.url).toContain('/assetservice/import/v1/task_count');
    });
});

describe('call()：错误处理', () => {
    test('未知端点抛出 KuGouApiError', async () => {
        const { client } = makeClient([]);
        const error = await client.call('no.such.endpoint' as never).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(KuGouApiError);
        expect((error as KuGouApiError).message).toContain('未知端点');
    });

    test('业务错误信封透传（rank.list）', async () => {
        const { client } = makeClient([errorEnvelope(30001, '签名错误')]);
        const error = await client.call('rank.list').catch((e: unknown) => e);
        expect(error).toBeInstanceOf(KuGouApiError);
        expect((error as KuGouApiError).code).toBe(30001);
    });

    test('tracker 错误信封（errcode/errmsg）抛出', async () => {
        const { client } = makeClient([
            {
                status: 200,
                body: JSON.stringify({ errcode: '20006', status: 0, errmsg: 'err signature' }),
            },
        ]);
        const error = await client.call('song.url', { hash: 'abc' }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(KuGouApiError);
        expect((error as KuGouApiError).code).toBe(20006);
    });
});
