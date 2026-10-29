/**
 * radio 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const radioEndpoints: EndpointDef[] = [
    e('fm_class', 'POST', '/v1/class_fm_song', {
        router: 'fm.service.kugou.com',
        body: (p, ctx) => ({
            kguid: ctx.userid,
            clienttime: ctx.clienttime,
            mid: ctx.mid,
            platform: 'android',
            clientver: ctx.clientver,
            uid: ctx.userid,
            get_tracker: 1,
            key: ctx.signParamsKey(ctx.clienttime),
            appid: ctx.appid,
        }),
    }),
    e('fm_image', 'POST', '/v1/fm_info', {
        router: 'fm.service.kugou.com',
        body: (p, ctx) => ({
            appid: ctx.appid,
            clienttime: ctx.clienttime,
            clientver: ctx.clientver,
            data: (p.fmid || '').split(',').map((s: any) => ({
                fields: 'imgUrl100,imgUrl50',
                fmid: s,
                fmtype: 2,
            })),
            dfid: ctx.dfid,
            key: ctx.signParamsKey(ctx.clienttime),
            mid: ctx.mid,
            ...(ctx.userid ? { userid: ctx.userid } : {}),
            ...(ctx.token ? { token: ctx.token } : {}),
        }),
    }),
    e('fm_recommend', 'POST', '/v1/rcmd_list', {
        router: 'fm.service.kugou.com',
        body: (p, ctx) => ({
            appid: ctx.appid,
            clientver: ctx.clientver,
            clienttime: ctx.clienttime,
            mid: ctx.mid,
            key: ctx.signParamsKey(ctx.clienttime),
            rcmdsongcount: 1,
            level: 0,
            area_code: 1,
            get_tracker: 1,
            uid: 0,
        }),
    }),
    e('pc_diantai', 'POST', '/v3/pc_diantai', {
        origin: 'https://adservice.kugou.com',
        body: (p, ctx) => ({
            isvip: 0,
            userid: ctx.userid,
            vipType: 0,
        }),
    }),
    e('personal_fm', 'POST', '/v2/personal_recommend', {
        router: 'persnfm.service.kugou.com',
        body: (p, ctx) => ({
            appid: ctx.appid,
            clienttime: ctx.clienttime,
            mid: ctx.mid,
            action: p.action || 'play',
            recommend_source_locked: 0,
            song_pool_id: Number(p.song_pool_id || 0),
            callerid: 0,
            m_type: 1,
            platform: p.platform || 'ios',
            area_code: 1,
            remain_songcnt: Number(p.remain_songcnt || 0),
            clientver: ctx.clientver,
            is_overplay: p.is_overplay ? 1 : 0,
            mode: p.mode || 'normal',
            fakem: 'ca981cfc583a4c37f28d2d49000013c16a0a',
            key: ctx.signParamsKey(ctx.clienttime),
            ...(ctx.userid ? { userid: ctx.userid } : {}),
            ...(ctx.userid ? { kguid: ctx.userid } : {}),
            ...(ctx.token ? { token: ctx.token } : {}),
            ...(ctx.vipType || p.vipType || 0 ? { vip_type: ctx.vipType || p.vipType || 0 } : {}),
            ...(p.hash ? { hash: p.hash } : {}),
            ...(p.songid ? { songid: p.songid } : {}),
            ...(p.playtime ? { playtime: p.playtime } : {}),
            ...(p.cur_mark ? { cur_mark: p.cur_mark } : {}),
        }),
    }),
    e('yueku', 'GET', '/v1/yueku/recommend_v2', {
        router: 'service.mobile.kugou.com',
        query: (_p, _ctx) => ({
            operator: 7,
            plat: 0,
            type: 11,
            area_code: 1,
            req_multi: 1,
        }),
    }),
    e('yueku_banner', 'POST', '/ads.gateway/v3/listen_banner', {
        body: (p, ctx) => ({
            plat: 0,
            channel: 201,
            operator: 7,
            networktype: 2,
            userid: p.userid || ctx.userid || 0,
            vip_type: 0,
            m_type: 0,
            tags: [],
            apiver: 5,
            ability: 2,
            mode: 'normal',
        }),
    }),
    e('yueku_fm', 'GET', '/v1/time_fm_info', {
        router: 'fm.service.kugou.com',
        query: (_p, _ctx) => ({
            operator: 7,
            plat: 0,
            type: 11,
            area_code: 1,
            req_multi: 1,
        }),
    }),
];
