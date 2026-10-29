/**
 * search 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const searchEndpoints: EndpointDef[] = [
    e('search_complex', 'GET', '/v6/search/complex', {
        origin: 'https://complexsearch.kugou.com',
        query: (p, _ctx) => ({
            platform: 'AndroidFilter',
            keyword: p.keywords,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
            cursor: 0,
        }),
    }),
    e('search_default', 'POST', '/searchnofocus/v1/search_no_focus_word', {
        query: (_p, _ctx) => ({
            clientver: 12329,
        }),
        body: (p, ctx) => ({
            plat: 0,
            userid: Number(ctx.userid),
            tags: '{}',
            vip_type: p.vip_type || ctx.vipType || 65530,
            m_type: 0,
            own_ads: {},
            ability: '3',
            sources: [],
            bitmap: 2,
            mode: 'normal',
        }),
    }),
    e('search_hot', 'GET', '/api/v3/search/hot_tab', {
        router: 'msearch.kugou.com',
        query: (_p, _ctx) => ({
            navid: 1,
            plat: 2,
        }),
    }),
    e('search_lyric', 'GET', '/v1/search', {
        origin: 'https://lyrics.kugou.com',
        query: (p, ctx) => ({
            album_audio_id: p.album_audio_id || 0,
            appid: ctx.appid,
            clientver: ctx.clientver,
            duration: p.duration || 0,
            hash: p.hash || '',
            keyword: p.keywords || '',
            lrctxt: 1,
            man: p.man ?? 'no',
        }),
        clearParams: true,
    }),
    e('search_suggest', 'GET', '/v2/getSearchTip', {
        router: 'searchtip.kugou.com',
        query: (p, _ctx) => ({
            keyword: p.keywords,
            AlbumTipCount: p.albumTipCount || 10,
            CorrectTipCount: p.correctTipCount || 10,
            MVTipCount: p.mvTipCount || 10,
            MusicTipCount: p.musicTipCount || 10,
            radiotip: 1,
        }),
    }),
];
