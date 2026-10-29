/**
 * song_url / song_auth / privilege_lite 特殊端点。
 *
 * 播放地址族涉及 trackercdn key、/v6/priv_url 新协议与 auth 复合链路。
 *
 * @module
 */

import { e, type CallParams, type EndpointDef } from '../types';

const MAGIC_QUALITIES = new Set(['piano', 'acappella', 'subwoofer', 'ancient', 'dj', 'surnay']);

function normalizeQuality(quality: unknown): string {
    const q = String(quality ?? '');
    return MAGIC_QUALITIES.has(q) ? `magic_${q}` : q;
}

/** song_url / song_url_auth 共用的 tracker 平台参数 */
function trackerPageIds(
    p: CallParams,
    platform: string,
): { pageId: number; pPageIds: string; pid: number } {
    const isLite = platform === 'lite';
    return {
        pageId: isLite ? 967177915 : 151369488,
        pPageIds: isLite
            ? String(p.ppage_id || '356753938,823673182,967485191')
            : '463467626,350369493,788954147',
        pid: isLite ? 411 : 2,
    };
}

export const songSpecialEndpoints: EndpointDef[] = [
    // ── /v5/url（经典 tracker 播放地址，参考 song_url 模块） ──
    e('song_url', 'GET', '/v5/url', {
        router: 'trackercdn.kugou.com',
        trackerKey: true,
        auth: false,
        note: '参考实现以随机 dfid 发请求但 key 只依赖 mid/userid；这里沿用会话身份（线上验证通过）',
        query: (p, ctx) => ({
            album_id: Number(p.album_id ?? 0),
            area_code: 1,
            hash: String(p.hash || '').toLowerCase(),
            ssa_flag: 'is_fromtrack',
            version: 11430,
            page_id: trackerPageIds(p, ctx.platform).pageId,
            quality: normalizeQuality(p.quality) || 128,
            album_audio_id: Number(p.album_audio_id ?? 0),
            behavior: 'play',
            pid: trackerPageIds(p, ctx.platform).pid,
            cmd: 26,
            pidversion: 3001,
            IsFreePart: p.free_part ? 1 : 0,
            ppage_id: trackerPageIds(p, ctx.platform).pPageIds,
            cdnBackup: 1,
            module: '',
            clientver: 11430,
        }),
    }),

    // ── /tracker/v5/url（auth 版播放地址，参考 song_url_auth 模块） ──
    e('song_url_auth', 'GET', '/tracker/v5/url', {
        trackerKey: true,
        auth: true,
        note: '需先经 song.auth / song.url.auth.merge 获取 auth 与 open_time',
        query: (p, ctx) => ({
            album_id: Number(p.album_id ?? 0),
            area_code: 1,
            module: '',
            hash: String(p.hash || '').toLowerCase(),
            need_m: 0,
            ssa_flag: 'is_fromtrack',
            version: 11430,
            open_time: p.open_time || 0,
            ptype: 0,
            need_ogg: 1,
            page_id: trackerPageIds(p, ctx.platform).pageId,
            auth: p.auth || '',
            mtype: 0,
            quality: normalizeQuality(p.quality) || 128,
            album_audio_id: Number(p.album_audio_id ?? 0),
            behavior: 'play',
            pid: trackerPageIds(p, ctx.platform).pid,
            module_id: 51,
            cmd: 26,
            ppage_id: trackerPageIds(p, ctx.platform).pPageIds,
            clientver: 11561,
            pidversion: 3001,
            cdnBackup: 1,
        }),
    }),

    // ── /v6/priv_url（新协议播放地址，参考 song_url_new 模块） ──
    e('song_url_new', 'POST', '/v6/priv_url', {
        router: 'tracker.kugou.com',
        auth: true,
        note: 'tracker_param.key 固定使用 lite 盐（与参考实现一致）',
        body: (p, ctx) => ({
            area_code: '1',
            behavior: 'play',
            qualities: [
                '128',
                '320',
                'flac',
                'high',
                'multitrack',
                'viper_atmos',
                'viper_tape',
                'viper_clear',
                'super',
            ],
            resource: {
                album_audio_id: p.album_audio_id,
                collect_list_id: '3',
                collect_time: Date.now(),
                hash: p.hash,
                id: 0,
                page_id: 1,
                type: 'audio',
            },
            token: ctx.token,
            tracker_param: {
                all_m: 1,
                auth: '',
                is_free_part: p.free_part ? 1 : 0,
                key: ctx.md5(
                    `${p.hash}185672dd44712f60bb1736df5a377e82${ctx.appid}${ctx.mid}${ctx.userid}`,
                ),
                module_id: 0,
                need_climax: 1,
                need_xcdn: 1,
                open_time: '',
                pid: '411',
                pidversion: '3001',
                priv_vip_type: '6',
                viptoken: ctx.vipToken,
            },
            userid: `${ctx.userid}`,
            vip: ctx.vipType,
        }),
    }),

    // ── /v1/authorization（获取歌曲 auth，参考 song_auth 模块） ──
    e('song_auth', 'GET', '/v1/authorization', {
        router: 'trackercdngz.kugou.com',
        auth: true,
        query: (p) => ({
            authorization: p.auth || '',
            module_id: 51,
            album_audio_id: Number(p.album_audio_id ?? 0),
            clientver: 11561,
            hash: String(p.hash || '').toLowerCase(),
        }),
    }),

    // ── 复合：song_auth + song_url_auth（参考 song_url_auth_merge 模块） ──
    e('song_url_auth_merge', 'GET', '/v1/authorization', {
        router: 'trackercdngz.kugou.com',
        auth: true,
        note: '复合端点：先取 auth/open_time，再请求 auth 版播放地址',
        handler: async (p, ctx) => {
            const hash = String(p.hash || '').toLowerCase();
            const albumAudioId = Number(p.album_audio_id ?? 0);
            const authData = await ctx.request<Record<string, any>>('/v1/authorization', {
                router: 'trackercdngz.kugou.com',
                query: {
                    authorization: p.auth || '',
                    module_id: 51,
                    album_audio_id: albumAudioId,
                    clientver: 11561,
                    hash,
                },
            });
            const auth = authData?.auth;
            const openTime = authData?.open_time;
            if (!auth && !openTime) {
                throw new Error('获取 auth 和 open_time 失败');
            }
            return ctx.callInner('song.url.auth', {
                ...p,
                auth,
                open_time: openTime,
                hash,
                album_audio_id: albumAudioId,
            });
        },
    }),

    // ── /v2/get_res_privilege/lite（音质权益聚合，参考 privilege_lite 模块） ──
    e('privilege_lite', 'POST', '/v2/get_res_privilege/lite', {
        router: 'media.store.kugou.com',
        note: '返回体附加 quality_vip 汇总（各音质的免 VIP 可得性）',
        handler: async (p, ctx) => {
            const hashList = String(p.hash || '')
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
            const albumIdList = String(p.album_id || '').split(',');
            const albumAudioIdList = String(p.album_audio_id || '').split(',');
            const qualitiesParam = String(p.qualities || '')
                .trim()
                .toLowerCase();
            const qualities =
                qualitiesParam === 'all'
                    ? [...UPSTREAM_QUALITIES]
                    : (qualitiesParam || '128,320,flac,high,viper_tape,viper_clear,viper_atmos')
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);
            const data = await ctx.request<any[]>('/v2/get_res_privilege/lite', {
                router: 'media.store.kugou.com',
                headers: { 'Content-Type': 'application/json' },
                json: {
                    appid: ctx.appid,
                    area_code: 1,
                    behavior: 'play',
                    clientver: ctx.clientver,
                    need_hash_offset: 1,
                    relate: 1,
                    support_verify: 1,
                    resource: hashList.map((hash, index) => ({
                        type: 'audio',
                        page_id: 0,
                        hash,
                        album_id: albumIdList[index] || 0,
                    })),
                    qualities: UPSTREAM_QUALITIES,
                },
            });
            const list = Array.isArray(data) ? data : [];
            return {
                quality_vip: hashList.map((hash, index) =>
                    buildQualityVip(
                        hash,
                        albumIdList[index],
                        albumAudioIdList[index],
                        list.find((x) => String(x?.hash || '').toLowerCase() === hash) ||
                            list[index] ||
                            {},
                        qualities,
                        ctx.platform === 'lite',
                    ),
                ),
            };
        },
    }),
];

const UPSTREAM_QUALITIES = [
    '128',
    '320',
    'flac',
    'high',
    'viper_atmos',
    'viper_tape',
    'viper_clear',
    'super',
    'multitrack',
];

const QUALITY_ORDER = [
    '128',
    '320',
    'flac',
    'high',
    'super',
    'viper_clear',
    'viper_tape',
    'viper_atmos',
    'multitrack',
];
const QUALITY_VIP_TYPE: Record<string, string> = {
    viper_tape: 'suvip',
    viper_clear: 'suvip',
    viper_atmos: 'suvip',
};
const QUALITY_LEVEL: Record<string, number[]> = {
    128: [1, 2],
    320: [4],
    flac: [5],
    high: [6],
    super: [7],
};

function formatSize(bytes: unknown): string {
    const n = Number(bytes) || 0;
    if (n <= 0) return '';
    if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)}G`;
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}M`;
    return `${(n / 1024).toFixed(1)}K`;
}

function pickRelate(relateGoods: any[], quality: string): any {
    for (const level of QUALITY_LEVEL[quality] || []) {
        const hit = relateGoods.find((item) => item.level === level && item.quality === quality);
        if (hit) return hit;
    }
    return relateGoods.find((item) => item.quality === quality);
}

function oggOf(quality: string, resource: any): { hash: string; size: number } {
    const transParam = resource?.trans_param || {};
    if (quality === '128')
        return { hash: transParam.ogg_128_hash || '', size: transParam.ogg_128_filesize || 0 };
    if (quality === '320')
        return { hash: transParam.ogg_320_hash || '', size: transParam.ogg_320_filesize || 0 };
    return { hash: '', size: 0 };
}

/** privilege_lite 的音质权益汇总（与参考实现字段一致） */
function buildQualityVip(
    hash: string,
    albumId: unknown,
    albumAudioId: unknown,
    resource: any,
    qualities: string[],
    isLite: boolean,
) {
    const relateGoods = Array.isArray(resource?.relate_goods) ? resource.relate_goods : [];
    const list = qualities.map((quality) => {
        const relateItem = pickRelate(relateGoods, quality);
        const exists = Boolean(relateItem);
        const neesuvip = exists && relateItem.privilege !== 0;
        const freeListen = isLite && quality === '128' && neesuvip;
        const obtainable = freeListen || (exists && !neesuvip && relateItem.status !== 0);
        const ogg = oggOf(quality, resource);
        const size = exists ? ogg.size || relateItem?.info?.filesize || 0 : 0;
        return {
            quality,
            exists,
            level: relateItem?.level ?? 0,
            bitrate: relateItem?.info?.bitrate ?? 0,
            extname: exists ? (ogg.hash ? 'ogg' : (relateItem?.info?.extname ?? '')) : '',
            hash: exists ? ogg.hash || relateItem?.hash || '' : '',
            size,
            size_text: formatSize(size),
            privilege: relateItem?.privilege ?? -1,
            status: relateItem?.status ?? 0,
            pay_type: relateItem?.pay_type ?? -1,
            price: relateItem?.price ?? 0,
            fail_process: relateItem?.fail_process ?? 0,
            need_vip: neesuvip,
            obtainable,
            free_listen: freeListen,
            require_vip_type:
                exists && !obtainable && neesuvip ? QUALITY_VIP_TYPE[quality] || 'concept' : '',
            msg: relateItem?._msg ?? '',
        };
    });
    const freeQualities = list.filter((item) => item.obtainable).map((item) => item.quality);
    const vipQualities = list
        .filter((item) => item.exists && item.need_vip && !item.obtainable)
        .map((item) => item.quality);
    const blockedQualities = list
        .filter((item) => item.exists && !item.obtainable && !item.need_vip)
        .map((item) => item.quality);
    const missingQualities = list.filter((item) => !item.exists).map((item) => item.quality);
    const suvipQualities = list
        .filter((item) => item.require_vip_type === 'suvip')
        .map((item) => item.quality);
    const freeSong = list.length > 0 && list.every((item) => !item.need_vip);
    const bestFree = list
        .filter((item) => item.obtainable)
        .sort(
            (a, b) =>
                (a.level || 0) - (b.level || 0) ||
                QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality),
        )
        .pop();
    return {
        hash,
        album_id: String(resource?.album_id ?? albumId ?? ''),
        album_audio_id: String(resource?.album_audio_id ?? albumAudioId ?? ''),
        name: resource?.name ?? '',
        singername: resource?.singername ?? '',
        albumname: resource?.albumname ?? '',
        free_song: freeSong,
        free_listen: list.some((item) => item.free_listen),
        qualities: list,
        free_qualities: freeQualities,
        vip_qualities: vipQualities,
        super_vip_qualities: suvipQualities,
        blocked_qualities: blockedQualities,
        missing_qualities: missingQualities,
        best_free_quality: bestFree ? bestFree.quality : '',
    };
}
