/**
 * artist 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const artistEndpoints: EndpointDef[] = [
    e('artist_albums', 'POST', '/kmr/v1/author/albums', {
        router: 'openapi.kugou.com',
        headers: { 'kg-tid': '36' },
        body: (p, _ctx) => ({
            author_id: p.id,
            pagesize: p.pagesize || 30,
            page: p.page || 1,
            sort: p.sort === 'hot' ? 3 : 1,
            category: 1,
            area_code: 'all',
        }),
    }),
    e('artist_audios', 'POST', '/kmr/v1/audio_group/author', {
        origin: 'https://openapi.kugou.com',
        router: 'openapi.kugou.com',
        headers: { 'kg-tid': '220' },
        body: (p, ctx) => ({
            appid: ctx.appid,
            clientver: ctx.clientver,
            mid: ctx.mid,
            clienttime: ctx.clienttime,
            key: ctx.signParamsKey(ctx.clienttime),
            author_id: p.id,
            pagesize: p.pagesize || 30,
            page: p.page || 1,
            sort: p.sort === 'hot' ? 1 : 2,
            area_code: 'all',
        }),
    }),
    e('artist_audios_new', 'GET', '/openapi/kmr/v2/audio_group/author', {
        headers: { 'kg-tid': '36' },
        query: (p, _ctx) => ({
            author_id: p.id,
            area_code: 'all',
            sort: p.sort === 'hot' ? 1 : 2,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
            replace_api_version: 1,
            mvdata_need: 1,
            show_audio_honor: 1,
            show_audio_tag: 1,
            replace_need: 1,
        }),
    }),
    e('artist_detail', 'POST', '/kmr/v3/author', {
        router: 'openapi.kugou.com',
        headers: { 'kg-tid': '36' },
        body: (p, _ctx) => ({
            author_id: p.id,
        }),
    }),
    e('artist_follow_newsongs', 'POST', '/feed/v1/follow/newsong_album_list', {
        query: (p, _ctx) => ({
            last_album_id: p.last_album_id || 0,
            page_size: p.pagesize || 30,
            opt_sort: p.opt_sort === 2 ? 2 : 1,
        }),
        body: (p, _ctx) => ({
            last_album_id: p.last_album_id || 0,
        }),
    }),
    e('artist_honour', 'POST', '/v1/query_singer_honour_detail', {
        origin: 'http://h5activity.kugou.com',
        query: (p, _ctx) => ({
            singer_id: p.id,
            pagesize: p.pagesize || 30,
            page: p.page || 1,
        }),
    }),
    e('artist_lists', 'GET', '/ocean/v6/singer/list', {
        query: (p, _ctx) => ({
            musician: Number(p.musician || 0),
            sextype: p.sextypes || 0,
            showtype: 2,
            type: p.type || 0,
            hotsize: Number(p.hotsize || 30),
        }),
    }),
    e('artist_videos', 'GET', '/kmr/v1/author/videos', {
        origin: 'https://openapicdn.kugou.com',
        query: (p, _ctx) => ({
            author_id: p.id,
            is_fanmade: '',
            tag_idx:
                (
                    {
                        official: 18,
                        live: 20,
                        fan: 23,
                        artist: 42419,
                        all: '',
                    } as any
                )[p.tag || 'all'] || '',
            pagesize: p.pagesize || 30,
            page: p.page || 1,
        }),
    }),
    e('singer_list', 'GET', '/ocean/v6/singer/list', {
        query: (p, _ctx) => ({
            hotsize: p.hotsize ?? 200,
            musician: 0,
            sextype: p.sextype ?? 0,
            showtype: 2,
            type: p.type ?? 0,
        }),
    }),
];
