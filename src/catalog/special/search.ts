/**
 * 搜索域特殊端点：search 多类型分发、综合搜索（search_mixed）、
 * IP 音乐（ip）、概念版卡片（top_card_youth）、频道订阅（youth_channel_sub）、
 * 歌单导入（import_playlist）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';
import { md5 } from '../../sign';

const SEARCH_TYPES = ['special', 'lyric', 'song', 'album', 'author', 'mv'];

export const searchSpecialEndpoints: EndpointDef[] = [
    // ── search（type 分发：song / album / 其他） ──
    e('search', 'GET', '/v2/search/song', {
        router: 'complexsearch.kugou.com',
        note: 'type=song（默认）/ album / special|lyric|author|mv 分发到不同端点；keyword 同 keywords',
        urlOf: (p) => {
            const type = SEARCH_TYPES.includes(p.type) ? p.type : 'song';
            if (type === 'song') return '/v2/search/song';
            if (type === 'album') return '/v1/search/album';
            return `/v1/search/${type}`;
        },
        query: (p, ctx) => {
            const type = SEARCH_TYPES.includes(p.type) ? p.type : 'song';
            const keyword = p.keywords || p.keyword || '';
            if (type === 'song') {
                const dataMap: Record<string, unknown> = {
                    keyword,
                    page: p.page || 1,
                    pagesize: p.pagesize || 30,
                    platform: 'AndroidFilter',
                    iscorrection: p.iscorrection ?? 1,
                    privilegefilter: p.privilegefilter ?? 0,
                    area_code: p.area_code || 1,
                    dopicfull: 1,
                };
                if (p.tag) dataMap['tag'] = p.tag;
                if (ctx.platform === 'lite') dataMap['clientver'] = 201;
                return dataMap as Record<string, string | number>;
            }
            if (type === 'album') {
                const dataMap: Record<string, unknown> = {
                    keyword,
                    page: p.page || 1,
                    pagesize: p.pagesize || 20,
                    platform: 'AndroidFilter',
                    iscorrection: p.iscorrection ?? 1,
                    category: p.category || '1',
                    sorttype: Number(p.sorttype) === 1 ? 1 : 0,
                    searchsong: Number(p.searchsong) === 1 ? 1 : 0,
                };
                if (p.tag) dataMap['tag'] = p.tag;
                if (ctx.platform === 'lite') dataMap['clientver'] = 201;
                return dataMap as Record<string, string | number>;
            }
            return {
                albumhide: 0,
                iscorrection: 1,
                keyword,
                nocollect: 0,
                page: p.page || 1,
                pagesize: p.pagesize || 30,
                platform: 'AndroidFilter',
            } as Record<string, string | number>;
        },
    }),

    // ── /v3/search/mixed（综合搜索） ──
    e('search_mixed', 'GET', '/v3/search/mixed', {
        router: 'complexsearch.kugou.com',
        headersFn: (_p) => ({ 'kg-clienttimems': String(Date.now()) }),
        query: (p, ctx) => {
            const time = Date.now();
            if (ctx.platform === 'lite') {
                return {
                    keyword: p.keyword,
                    platform: 'AndroidFilter',
                    tag: 'em',
                    area_code: p.area_code || 1,
                    iscorrection: p.iscorrection ?? 1,
                    cursor: p.cursor || 0,
                    apiver: 22,
                    osversion: '15',
                    ability: 1,
                    clientver: p.clientver || 201,
                    vip_status: p.vip_status || ctx.vipType || 0,
                } as Record<string, string | number>;
            }
            return {
                ab_tag: 0,
                ability: 511,
                albumhide: 0,
                apiver: 22,
                area_code: 1,
                clientver: p.clientver || 20125,
                cursor: 0,
                is_gpay: 0,
                iscorrection: 1,
                keyword: p.keyword,
                nocollect: 0,
                osversion: 16.5,
                platform: 'IOSFilter',
                recver: 2,
                req_ai: 1,
                requestid: `${md5(`bdaa53d04e7475feb9024164a47032f9${time}`)}_0`,
                search_ability: 3,
                sec_aggre: 1,
                sec_aggre_bitmap: 0,
                style_type: 3,
                tag: 'em',
            } as Record<string, string | number>;
        },
    }),

    // ── /openapi/v1/ip/{type}（IP 音乐） ──
    e('ip', 'POST', '/openapi/v1/ip/audios', {
        note: 'type ∈ audios(默认) / albums / videos / author_list',
        urlOf: (p) => {
            const type = ['audios', 'albums', 'videos', 'author_list'].includes(p.type)
                ? p.type
                : 'audios';
            return `/openapi/v1/ip/${type}`;
        },
        body: (p) => ({
            is_publish: 1,
            ip_id: p.id,
            sort: 3,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
            query: 1,
        }),
    }),

    // ── 概念版歌曲卡片推荐 ──
    e('top_card_youth', 'POST', '/youth/v1/song/single_card_recommend', {
        note: 'card_id=3103 且未传 tagid 时走 tag_card_recommend',
        urlOf: (p) =>
            `/youth/v1/song/${Number(p.card_id) === 3103 && typeof p.tagid === 'undefined' ? 'tag_card_recommend' : 'single_card_recommend'}`,
        query: (p) => ({
            card_id: p.card_id || 3005,
            area_code: 1,
            platform: 'ios',
            module_id: 1,
            ver: 'v2',
            pagesize: p.pagesize ?? 30,
            clientver: 12500,
        }),
        body: (p) => ({
            tagid: p.tagid ?? '',
            u_info: '',
            source_mixsong: '',
        }),
    }),

    // ── 概念版频道订阅/退订 ──
    e('youth_channel_sub', 'DELETE', '/youth/v1/channel_un_subscribe', {
        note: 't=0 为退订（DELETE _un_subscribe），否则 POST 订阅',
        handler: async (p, ctx) => {
            const t = Number(p.t) === 0 ? 0 : 1;
            return ctx.request(`/youth/v1/channel${t === 0 ? '_un' : ''}_subscribe`, {
                method: t === 0 ? 'DELETE' : 'POST',
                query: { global_collection_id: p.global_collection_id, source: 1 },
            });
        },
    }),

    // ── 歌单导入（assetservice，operation 分发） ──
    e('import_playlist', 'POST', '/assetservice/import/v1/add_task', {
        note: 'operation ∈ add_task(默认) / submit_img / task_count / query_task_status / query_task',
        handler: async (p, ctx) => {
            const operation = p.operation || 'add_task';
            const common = {
                method: 'POST' as const,
                headers: { 'Content-Type': 'application/json;charset=utf-8' },
                sign: 'android' as const,
                clearParams: true,
                query: {
                    appid: String(ctx.appid),
                    clientver: String(ctx.clientver),
                    clienttime: String(ctx.clienttime),
                    mid: ctx.mid,
                    uuid: ctx.uuid,
                    dfid: ctx.dfid,
                },
            };
            if (operation === 'add_task') {
                const taskType = Number(p.task_type || 0);
                const data: Record<string, unknown> = {
                    userid: ctx.userid,
                    token: ctx.token,
                    source: Number(p.source || 3),
                    task_type: taskType,
                };
                if (taskType === 0) {
                    data['url'] = String(p.url || '');
                } else {
                    data['listid'] = Number(p.listid || 0);
                    if (p.list_name) data['list_name'] = String(p.list_name);
                    data['task_sn'] = String(p.task_sn || `${ctx.userid}${Date.now()}`);
                }
                return ctx.request('/assetservice/import/v1/add_task', { ...common, json: data });
            }
            if (operation === 'submit_img') {
                const imgBase64 = String(p.img_base64 || '').replace(
                    /^data:image\/[^;]+;base64,/,
                    '',
                );
                return ctx.request('/assetservice/import/v1/submit_img', {
                    ...common,
                    json: {
                        userid: ctx.userid,
                        token: ctx.token,
                        img_base64: imgBase64,
                        task_sn: String(p.task_sn || ''),
                    },
                });
            }
            if (operation === 'task_count') {
                return ctx.request('/assetservice/import/v1/task_count', {
                    ...common,
                    json: {
                        userid: ctx.userid,
                        token: ctx.token,
                        classify: Number(p.classify || 1),
                    },
                });
            }
            if (operation === 'query_task_status') {
                const ids = parseIds(p.ids);
                return ctx.request('/assetservice/import/v1/query_task_status', {
                    ...common,
                    json: { userid: ctx.userid, token: ctx.token, ids },
                });
            }
            if (operation === 'query_task') {
                return ctx.request('/pubsongs/v1/query_task', {
                    ...common,
                    json: {
                        userid: ctx.userid,
                        token: ctx.token,
                        listid: String(p.listid || ''),
                        page: Math.max(1, Number(p.page || 1)),
                        pagesize: Math.max(1, Number(p.pagesize || 30)),
                        show_missed: Number(p.show_missed ?? 1) ? 1 : 0,
                    },
                });
            }
            throw new Error(`不支持的操作: ${operation || ''}`);
        },
    }),
];

function parseIds(value: unknown): number[] {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite);
        } catch {
            // 回退逗号分隔
        }
        return value.split(',').map(Number).filter(Number.isFinite);
    }
    const id = Number(value);
    return Number.isFinite(id) ? [id] : [];
}
