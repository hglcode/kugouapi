/**
 * 媒体域特殊端点：音频/专辑详情（signParamsKey 协议）、
 * 图片族（自算签名 + URL 内嵌参数）、歌词（KRC 解码）、
 * 伴奏/K 歌（专用 sign）、歌手关注（AES+RSA）。
 *
 * @module
 */

import { Buffer } from 'node:buffer';

import { e, type CallCtx, type EndpointDef } from '../types';
import { md5, signature } from '../../sign';
import { decodeKrc } from '../../util';

const STANDARD_SALT = 'OIlwieks28dk2k092lksi2UIkp';

/** 参考实现 signatureStandardParams（对象值 JSON.stringify） */
function signatureStandard(params: Record<string, unknown>): string {
    const paramsString = Object.keys(params)
        .sort()
        .map(
            (key) =>
                `${key}=${typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key]}`,
        )
        .join('');
    return md5(`${STANDARD_SALT}${paramsString}${STANDARD_SALT}`);
}

/** kmr 音频/专辑协议共用体（Date.now 毫秒 + signParamsKey） */
function kmrPayload(p: Record<string, any>, ctx: CallCtx, rows: unknown[]) {
    const dateTime = Date.now();
    const dataMap: Record<string, unknown> = {
        appid: ctx.appid,
        clienttime: dateTime,
        clientver: ctx.clientver,
        data: rows,
        dfid: ctx.dfid,
        key: ctx.signParamsKey(dateTime),
        mid: ctx.mid,
    };
    if (ctx.token) dataMap['token'] = ctx.token;
    if (ctx.userid) dataMap['userid'] = ctx.userid;
    return dataMap;
}

/** 图片族：参数内嵌 URL + 自算签名（对齐 images / images_audio / album_dycover） */
async function signedImageUrl(
    ctx: CallCtx,
    url: string,
    paramsMap: Record<string, unknown>,
    origin: string,
    extraHeaders?: Record<string, string>,
): Promise<unknown> {
    const sign = signatureStandard(paramsMap);
    const query = Object.keys(paramsMap)
        .sort()
        .map(
            (s) =>
                `${s}=${encodeURIComponent(typeof paramsMap[s] === 'object' ? JSON.stringify(paramsMap[s]) : String(paramsMap[s] ?? ''))}`,
        )
        .join('&');
    return ctx.request(`${url}?${query}`, {
        method: 'GET',
        baseUrl: origin,
        sign: false,
        clearParams: true,
        query: { signature: sign },
        headers: extraHeaders,
    });
}

export const mediaSpecialEndpoints: EndpointDef[] = [
    // ── /v1/audio/audio（批量音频详情） ──
    e('audio', 'POST', '/v1/audio/audio', {
        origin: 'http://kmr.service.kugou.com',
        router: 'kmr.service.kugou.com',
        headers: { 'Content-Type': 'application/json' },
        body: (p, ctx) =>
            kmrPayload(
                p,
                ctx,
                String(p.hash || '')
                    .split(',')
                    .map((s) => ({ hash: s, audio_id: 0 })),
            ),
    }),

    // ── /v1/album（批量专辑详情） ──
    e('album', 'POST', '/v1/album', {
        origin: 'http://kmr.service.kugou.com',
        router: 'kmr.service.kugou.com',
        headers: { 'Content-Type': 'application/json' },
        handler: async (p, ctx) => {
            const dataMap = kmrPayload(
                p,
                ctx,
                String(p.album_id || '')
                    .split(',')
                    .map((s) => ({ album_id: s, album_name: '', author_name: '' })),
            );
            (dataMap as Record<string, unknown>)['fields'] = p.fields || '';
            return ctx.request('/v1/album', {
                method: 'POST',
                baseUrl: 'http://kmr.service.kugou.com',
                router: 'kmr.service.kugou.com',
                headers: { 'Content-Type': 'application/json' },
                json: dataMap,
            });
        },
    }),

    // ── /v2/album/audio（专辑动态封面） ──
    e('album_dycover', 'GET', '/v2/album/audio', {
        origin: 'https://kmrcdn.service.kugou.com',
        salt: 'none',
        note: '参数内嵌 URL 并自算签名；clearHeaders 复刻参考实现',
        handler: async (p, ctx) => {
            const data = String(p.album_audio_id || '')
                .split(',')
                .map((s, index) => {
                    const albumId = Number(String(p.album_id || '').split(',')[index]) || 0;
                    const obj: Record<string, unknown> = { album_audio_id: Number(s) };
                    if (albumId > 0) obj['album_id'] = albumId;
                    return obj;
                });
            const paramsMap: Record<string, unknown> = {
                appid: ctx.appid,
                clientver: ctx.clientver,
                data,
                isCdn: 1,
                query: p.query || 'audioPlay',
            };
            return signedImageUrl(
                ctx,
                '/v2/album/audio',
                paramsMap,
                'https://kmrcdn.service.kugou.com',
                {
                    dfid: '-',
                    mid: 'undefined',
                    clienttime: String(Math.floor(Date.now() / 1000)),
                },
            );
        },
    }),

    // ── /fingerprint.service/v1/music_trackid_mulit（听歌识曲） ──
    e('audio_match', 'POST', '/fingerprint.service/v1/music_trackid_mulit', {
        note: 'p.data 传音频指纹二进制（octet-stream）',
        handler: async (p, ctx) => audioMatchHandler(p, ctx),
    }),

    // ── /v3/album_audio/related（相关音频） ──
    e('audio_related', 'GET', '/v3/album_audio/related', {
        origin: 'https://listkmrp3cdnretry.kugou.com',
        salt: 'none',
        note: 'show_detail=1 时走 /v2/audio_related/total 汇总接口',
        handler: async (p, ctx) => {
            const showDetail = Number(p.show_detail) === 1;
            const sortType: Record<string, number> = { all: 1, hot: 2, new: 3 };
            let dataMap: Record<string, unknown> = {
                album_audio_id: Number(p.album_audio_id),
                appid: 1005,
                area_code: 1,
                clientver: 12329,
            };
            if (!showDetail) {
                dataMap = {
                    ...dataMap,
                    page: p.page || 1,
                    pagesize: p.pagesize || 30,
                    show_input: 1,
                    show_type: p.show_type || 0,
                    sort: sortType[p.sort] || 1,
                    type: p.type || 0,
                };
            }
            dataMap['version'] = 1;
            dataMap['signature'] = signatureStandard(dataMap);
            const url = showDetail ? '/v2/audio_related/total' : '/v3/album_audio/related';
            const query = Object.keys(dataMap)
                .sort()
                .map(
                    (key) =>
                        `${key}=${encodeURIComponent(typeof dataMap[key] === 'object' ? JSON.stringify(dataMap[key]) : String(dataMap[key] ?? ''))}`,
                )
                .join('&');
            return ctx.request(`${url}?${query}`, {
                method: 'GET',
                baseUrl: 'https://listkmrp3cdnretry.kugou.com',
                sign: false,
                clearParams: true,
                query: {},
            });
        },
    }),

    // ── 电台图片（fm_info 协议，逐元素合并 fmtype/offset/size） ──
    e('fm_songs', 'POST', '/v1/fm_info', {
        router: 'fm.service.kugou.com',
        headers: { 'Content-Type': 'application/json' },
        body: (p, ctx) => {
            const fmData = String(p.fmid || '')
                .split(',')
                .map((s) => ({
                    fields: 'imgUrl100,imgUrl50',
                    fmid: s,
                    fmtype: p.type || 2,
                    offset: p.offset || -1,
                    size: p.size || 20,
                }));
            String(p.fmtype || '')
                .split(',')
                .forEach((s, l) => {
                    if (fmData[l]) fmData[l].fmtype = Number(s) || fmData[l].fmtype;
                });
            String(p.fmoffset || '')
                .split(',')
                .forEach((s, l) => {
                    if (fmData[l]) fmData[l].offset = Number(s) || fmData[l].offset;
                });
            String(p.fmsize || '')
                .split(',')
                .forEach((s, l) => {
                    if (fmData[l]) fmData[l].size = Number(s) || fmData[l].size;
                });
            const dataMap: Record<string, unknown> = {
                appid: ctx.appid,
                clienttime: Date.now(),
                clientver: ctx.clientver,
                data: fmData,
                dfid: ctx.dfid,
                key: ctx.signParamsKey(Date.now()),
                mid: ctx.mid,
            };
            if (ctx.userid) dataMap['userid'] = ctx.userid;
            if (ctx.token) dataMap['token'] = ctx.token;
            return dataMap;
        },
    }),

    // ── 歌手/专辑图片 ──
    e('images', 'GET', '/container/v2/image', {
        origin: 'https://expendablekmr.kugou.com',
        salt: 'none',
        note: 'hash/album_id/album_audio_id 支持逗号分隔多曲',
        handler: async (p, ctx) => {
            const data = String(p.hash || '')
                .split(',')
                .map((s): Record<string, any> => ({ album_id: 0, hash: s, album_audio_id: 0 }));
            String(p.album_id || '')
                .split(',')
                .forEach((s, index) => {
                    if (index <= data.length - 1) data[index]!['album_id'] = s || 0;
                });
            String(p.album_audio_id || '')
                .split(',')
                .forEach((s, index) => {
                    if (index <= data.length - 1) data[index]!['album_audio_id'] = s || 0;
                });
            return signedImageUrl(
                ctx,
                '/container/v2/image',
                {
                    album_image_type: '-3',
                    appid: ctx.appid,
                    clientver: ctx.clientver,
                    author_image_type: '3,4,5',
                    count: p.count || 5,
                    data,
                    isCdn: 1,
                    publish_time: 1,
                },
                'https://expendablekmr.kugou.com',
            );
        },
    }),

    // ── 音频关联图片 ──
    e('images_audio', 'GET', '/v2/author_image/audio', {
        origin: 'https://expendablekmr.kugou.com',
        salt: 'none',
        handler: async (p, ctx) => {
            const data = String(p.hash || '')
                .split(',')
                .map((s): Record<string, any> => ({
                    audio_id: 0,
                    hash: s,
                    album_audio_id: 0,
                    filename: '',
                }));
            String(p.audio_id || '')
                .split(',')
                .forEach((s, index) => {
                    if (index <= data.length - 1) data[index]!['audio_id'] = s || 0;
                });
            String(p.album_audio_id || '')
                .split(',')
                .forEach((s, index) => {
                    if (index <= data.length - 1) data[index]!['album_audio_id'] = s || 0;
                });
            String(p.filename || '')
                .split(',')
                .forEach((s, index) => {
                    if (index <= data.length - 1) data[index]!['filename'] = s;
                });
            return signedImageUrl(
                ctx,
                '/v2/author_image/audio',
                {
                    appid: ctx.appid,
                    clientver: ctx.clientver,
                    count: p.count || 5,
                    data,
                    isCdn: 1,
                    publish_time: 1,
                    show_authors: 1,
                },
                'https://expendablekmr.kugou.com',
            );
        },
    }),

    // ── 歌词下载（支持 KRC 解码） ──
    e('lyric', 'GET', '/download', {
        origin: 'https://lyrics.kugou.com',
        note: 'decode=true 时附 decodeContent（krc 自动解密解压，lrc 直接 base64 解码）',
        handler: async (p, ctx) => {
            const data = await ctx.request<Record<string, any>>('/download', {
                baseUrl: 'https://lyrics.kugou.com',
                query: {
                    ver: 1,
                    client: p.client || 'android',
                    id: p.id,
                    accesskey: p.accesskey,
                    fmt: p.fmt || 'krc',
                    charset: 'utf8',
                },
            });
            if (p.decode && data?.content) {
                data['decodeContent'] =
                    p.fmt === 'lrc' || Number(data.contenttype) !== 0
                        ? Buffer.from(data.content, 'base64').toString()
                        : decodeKrc(data.content);
            }
            return data;
        },
    }),

    // ── 关注歌手（AES+RSA p 参数） ──
    e('artist_follow', 'POST', '/followservice/v3/follow_singer', {
        auth: true,
        handler: async (p, ctx) =>
            followSinger(ctx, p, '/followservice/v3/follow_singer', Number(p.id)),
    }),

    // ── 取消关注歌手 ──
    e('artist_unfollow', 'POST', '/followservice/v3/unfollow_singer', {
        auth: true,
        handler: async (p, ctx) => followSinger(ctx, p, '/followservice/v3/unfollow_singer', p.id),
    }),
];

/** 听歌识曲（二进制 body） */
async function audioMatchHandler(p: Record<string, any>, ctx: CallCtx): Promise<unknown> {
    const data = p.data instanceof Uint8Array ? p.data : null;
    if (!data) throw new Error('请通过 params.data 传入音频指纹二进制数据');
    const query = {
        fpid: Date.now(),
        area_code: 1,
        include_unpublish: 1,
        useid: p.userid || ctx.userid || 0,
        multi_result: 1,
    };
    const result = await ctx.raw({
        method: 'POST',
        url: 'https://gateway.kugou.com/fingerprint.service/v1/music_trackid_mulit',
        query: {
            ...query,
            signature: signature(query, { kind: 'android', platform: ctx.platform }),
        },
        headers: {
            'Content-Type': 'application/octet-stream',
            'User-Agent': 'KuGou/11490 (Android)',
        },
        body: data,
        retries: 0,
    });
    if (!result.ok) throw new Error(`HTTP ${result.status}`);
    return result.json();
}

/** 关注/取关歌手（对齐参考 artist_follow） */
async function followSinger(
    ctx: CallCtx,
    p: Record<string, any>,
    url: string,
    singerid: unknown,
): Promise<unknown> {
    const clienttime = Math.floor(Date.now() / 1000);
    const encrypt = ctx.aesHex({ singerid, token: ctx.token }) as { str: string; key: string };
    return ctx.request(url, {
        method: 'POST',
        json: {
            plat: 0,
            userid: ctx.userid,
            singerid,
            source: 7,
            p: ctx.rsaEncryptHex({ clienttime, key: encrypt.key }),
            params: encrypt.str,
        },
        query: { clienttime },
    });
}
