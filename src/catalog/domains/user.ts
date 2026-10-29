/**
 * user 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const userEndpoints: EndpointDef[] = [
    e('blacklist_list', 'POST', '/v2/get_list_items', {
        origin: 'https://relationuser.kugou.com',
        headersFn: (p, _ctx) => ({
            'KG-TID': String(p.moduleId || 473),
        }),
        body: (p, ctx) => ({
            userid: ctx.userid,
            source: Number(
                p.source ||
                    (
                        {
                            song: 3,
                            singer: 4,
                        } as any
                    )[p.label === 'singer' ? 'singer' : 'song'],
            ),
            label: p.label === 'singer' ? 'singer' : 'song',
            p: ctx.rsaEncryptRaw(
                JSON.stringify({
                    clienttime: ctx.clienttime,
                    token: ctx.token,
                }),
            ),
            page: Number(p.page || 1),
            pagesize: Math.min(Number(p.pagesize || 30), 500),
        }),
    }),
    e('favorite_count', 'GET', '/count/v1/audio/mget_collect', {
        query: (p, _ctx) => ({
            mixsongids: p.mixsongids,
        }),
    }),
    e('playhistory_upload', 'POST', '/playhistory/v1/upload_songs', {
        query: (_p, _ctx) => ({
            plat: 3,
        }),
        body: (p, ctx) => ({
            songs: [
                {
                    mxid: Number(p.mxid),
                    op: 1,
                    ot: Number(p.time || Math.floor(Date.now() / 1000)),
                    pc: Number(p.pc || 1),
                },
            ],
            token: ctx.token,
            userid: ctx.userid,
        }),
    }),
    e('user_detail', 'POST', '/v3/get_my_info', {
        router: 'usercenter.kugou.com',
        query: (_p, _ctx) => ({
            plat: 1,
        }),
        body: (p, ctx) => ({
            visit_time: Math.floor(Date.now() / 1000),
            usertype: 1,
            p: ctx
                .rsaEncryptRaw({
                    token: ctx.token,
                    clienttime: Math.floor(Date.now() / 1000),
                })
                .toUpperCase(),
            userid: ctx.userid,
        }),
    }),
    e('user_fans', 'POST', '/v2/fans_list', {
        origin: 'https://relationuser.kugou.com',
        salt: 'none',
        query: (p, ctx) => ({
            dfid: ctx.dfid,
        }),
        body: (p, ctx) => ({
            userid: ctx.userid,
            dfid: ctx.dfid,
            plat: 1,
            nickimg: 1,
            appid: ctx.platform === 'lite' ? 3116 : ctx.appid,
            clientver: ctx.platform === 'lite' ? 11440 : ctx.clientver,
            mid: ctx.mid,
            clienttime: ctx.clienttime,
            key: ctx.signParamsKey(
                String(ctx.clienttime),
                ctx.platform === 'lite' ? 3116 : ctx.appid,
                ctx.platform === 'lite' ? 11440 : ctx.clientver,
            ),
            p: ctx
                .rsaEncryptRaw({
                    clienttime: ctx.clienttime,
                    token: ctx.token,
                })
                .toUpperCase(),
        }),
        clearParams: true,
    }),
    e('user_follow', 'POST', '/v4/follow_list', {
        router: 'relationuser.kugou.com',
        query: (_p, _ctx) => ({
            plat: 1,
        }),
        body: (p, ctx) => ({
            merge: 2,
            need_iden_type: 1,
            ext_params: 'k_pic,jumptype,singerid,score',
            userid: ctx.userid,
            type: 0,
            id_type: 0,
            p: ctx
                .rsaEncryptRaw({
                    clienttime: ctx.clienttime,
                    token: ctx.token,
                })
                .toUpperCase(),
        }),
    }),
    e('user_follow_add', 'POST', '/v2/follow', {
        router: 'relation.user.kugou.com',
        headersFn: (p, ctx) => ({
            'KG-FAKE-TYPE': '0,0',
            'KG-FAKE-SUBTYPE': '0,0',
            'KG-RFB': '0',
            'User-Agent': `Android15-AndroidPhone-${ctx.platform === 'lite' ? 11440 : ctx.clientver}-201-0-User-wifi`,
            'KG-FAKE': String(ctx.userid),
        }),
        salt: 'none',
        query: (p, ctx) => ({
            dfid: ctx.dfid,
        }),
        body: (p, ctx) => ({
            userid: ctx.userid,
            source: Number(p.source || 0),
            clienttime: ctx.clienttime,
            mid: ctx.mid,
            key: ctx.signParamsKey(
                String(ctx.clienttime),
                ctx.platform === 'lite' ? 3116 : ctx.appid,
                ctx.platform === 'lite' ? 11440 : ctx.clientver,
            ),
            dfid: ctx.dfid,
            clientver: ctx.platform === 'lite' ? 11440 : ctx.clientver,
            appid: ctx.platform === 'lite' ? 3116 : ctx.appid,
            p: ctx
                .rsaEncryptRaw({
                    clienttime: ctx.clienttime,
                    token: ctx.token,
                    t_userid: Number(p.tuid || p.t_userid || 0),
                })
                .toUpperCase(),
        }),
        clearParams: true,
    }),
    e('user_follow_del', 'POST', '/v1/unfollow', {
        router: 'relationuser.kugou.com',
        headersFn: (p, ctx) => ({
            'KG-FAKE-TYPE': '0,0',
            'KG-FAKE-SUBTYPE': '0,0',
            'KG-RFB': '0',
            'User-Agent': `Android15-AndroidPhone-${ctx.platform === 'lite' ? 11440 : ctx.clientver}-201-0-User-wifi`,
            'KG-FAKE': String(ctx.userid),
        }),
        salt: 'none',
        query: (p, ctx) => ({
            dfid: ctx.dfid,
        }),
        body: (p, ctx) => ({
            userid: ctx.userid,
            source: Number(p.source || 0),
            clienttime: ctx.clienttime,
            mid: ctx.mid,
            key: ctx.signParamsKey(
                String(ctx.clienttime),
                ctx.platform === 'lite' ? 3116 : ctx.appid,
                ctx.platform === 'lite' ? 11440 : ctx.clientver,
            ),
            dfid: ctx.dfid,
            clientver: ctx.platform === 'lite' ? 11440 : ctx.clientver,
            appid: ctx.platform === 'lite' ? 3116 : ctx.appid,
            p: ctx
                .rsaEncryptRaw({
                    clienttime: ctx.clienttime,
                    token: ctx.token,
                    t_userid: Number(p.tuid || p.t_userid || 0),
                })
                .toUpperCase(),
        }),
        clearParams: true,
    }),
    e('user_follow_message', 'GET', '/msg.mobile/v3/msgtag/history', {
        query: (p, ctx) => ({
            filter: 1,
            maxid: p.maxid ?? 0,
            pagesize: p.pagesize ?? 30,
            tag: p.tag || `chat:${p.id}_${ctx.userid}`,
        }),
    }),
    e('user_friends', 'POST', '/v1/friends_list', {
        origin: 'https://relationuser.kugou.com',
        salt: 'none',
        query: (p, ctx) => ({
            dfid: ctx.dfid,
        }),
        body: (p, ctx) => ({
            userid: ctx.userid,
            dfid: ctx.dfid,
            plat: 1,
            nickimg: 1,
            appid: ctx.platform === 'lite' ? 3116 : ctx.appid,
            clientver: ctx.platform === 'lite' ? 11440 : ctx.clientver,
            mid: ctx.mid,
            clienttime: ctx.clienttime,
            key: ctx.signParamsKey(
                String(ctx.clienttime),
                ctx.platform === 'lite' ? 3116 : ctx.appid,
                ctx.platform === 'lite' ? 11440 : ctx.clientver,
            ),
            p: ctx
                .rsaEncryptRaw({
                    clienttime: ctx.clienttime,
                    token: ctx.token,
                })
                .toUpperCase(),
        }),
        clearParams: true,
    }),
    e('user_history', 'POST', '/playhistory/v1/get_songs', {
        body: (p, ctx) => ({
            token: ctx.token,
            userid: ctx.userid,
            source_classify: 'app',
            to_subdivide_sr: 1,
            ...(p.bp ? { bp: p.bp } : {}),
        }),
    }),
    e('user_info', 'POST', '/v1/get_my_userinfo', {
        origin: 'http://relation.user.kugou.com',
        headers: { Host: 'relation.user.kugou.com' },
        body: (p, ctx) => ({
            p: ctx
                .rsaEncryptRaw({
                    clienttime: ctx.clienttime,
                    token: ctx.token,
                })
                .toUpperCase(),
            appid: ctx.appid,
            mid: ctx.mid,
            clientver: ctx.clientver,
            source: 0,
            clienttime: ctx.clienttime,
            uuid: '-',
            userid: ctx.userid,
            key: ctx.signParamsKey(ctx.clienttime),
        }),
    }),
    e('user_listen', 'POST', '/v2/get_list', {
        origin: 'https://listenservice.kugou.com',
        query: (p, ctx) => ({
            clienttime: ctx.clienttime,
            plat: 0,
        }),
        body: (p, ctx) => ({
            t_userid: ctx.userid,
            userid: ctx.userid,
            list_type: p.type || 0,
            area_code: 1,
            cover: 2,
            p: ctx
                .rsaEncryptRaw({
                    clienttime: ctx.clienttime,
                    token: ctx.token,
                })
                .toUpperCase(),
        }),
    }),
    e('user_playlist', 'POST', '/v7/get_all_list', {
        router: 'cloudlist.service.kugou.com',
        query: (p, ctx) => ({
            plat: 1,
            userid: Number(ctx.userid),
            token: ctx.token,
        }),
        body: (p, ctx) => ({
            userid: ctx.userid,
            token: ctx.token,
            total_ver: 979,
            type: 2,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
        }),
    }),
    e('user_purchased_albums', 'POST', '/openapi/v1/copyright/get_album_goods', {
        body: (p, ctx) => ({
            appid: ctx.appid,
            userid: Number(ctx.userid) || 0,
            token: ctx.token || '',
            page: Number(p.page) || 1,
            pagesize: Number(p.pagesize) || 15,
            clientver: String(ctx.clientver),
            deleted: 0,
        }),
    }),
    e('user_purchased_songs', 'POST', '/openapi/copyright/v1/audio/get_goods', {
        body: (p, ctx) => ({
            appid: ctx.appid,
            userid: Number(ctx.userid) || 0,
            token: ctx.token || '',
            page: Number(p.page) || 1,
            pagesize: Number(p.pagesize) || 50,
            clientver: String(ctx.clientver),
            deleted: 0,
            need_audio_info: 1,
            area_code: '1',
        }),
    }),
    e('user_update', 'POST', '/v1/update_userinfo', {
        origin: 'http://update.user.kugou.com',
        salt: 'none',
        body: (p, ctx) => ({
            clienttime: ctx.clienttime,
            appid: ctx.platform === 'lite' ? 3116 : ctx.appid,
            clientver: ctx.platform === 'lite' ? 11440 : ctx.clientver,
            mid: ctx.mid,
            uuid: '-',
            userid: ctx.userid,
            key: ctx.signParamsKey(
                ctx.clienttime,
                ctx.platform === 'lite' ? 3116 : ctx.appid,
                ctx.platform === 'lite' ? 11440 : ctx.clientver,
            ),
            p: ctx
                .rsaEncryptRaw(
                    JSON.stringify({
                        clienttime: ctx.clienttime,
                        token: ctx.token,
                    }),
                )
                .toUpperCase(),
            data: {},
        }),
        clearParams: true,
    }),
    e('user_video_collect', 'POST', '/collectservice/v2/collect_list_mixvideo', {
        query: (_p, _ctx) => ({
            plat: 1,
        }),
        body: (p, ctx) => ({
            userid: ctx.userid,
            token: ctx.token,
            page: p.page ?? 1,
            pagesize: p.pagesize ?? 30,
        }),
    }),
    e('user_video_love', 'GET', '/m.comment.service/v1/get_user_like_video', {
        query: (p, ctx) => ({
            kugouid: ctx.userid,
            pagesize: p.pagesize ?? 30,
            load_video_info: 1,
            p: 1,
            plat: 1,
        }),
    }),
    e('user_vip_detail', 'GET', '/v1/get_union_vip', {
        origin: 'https://kugouvip.kugou.com',
        query: (_p, _ctx) => ({
            busi_type: 'concept',
        }),
    }),
];
