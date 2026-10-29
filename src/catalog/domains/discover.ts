/**
 * discover 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const discoverEndpoints: EndpointDef[] = [
    e('ai_recommend', 'POST', '/recommend', {
        router: 'songlistairec.kugou.com',
        body: (p, ctx) => ({
            platform: 'ios',
            clientver: ctx.clientver,
            clienttime: ctx.clienttime,
            userid: ctx.userid,
            client_playlist: [],
            source_type: 2,
            playlist_ver: 2,
            area_code: 1,
            appid: ctx.appid,
            key: ctx.signParamsKey(ctx.clienttime.toString()),
            mid: ctx.mid,
            recommend_source: (p.album_audio_id || '').split(',').map((s: any) => ({
                ID: Number(s),
            })),
        }),
        clearParams: true,
    }),
    e('ai_recommend_song', 'POST', '/concepts/v1/ai/recommend_song', {
        body: (p, _ctx) => ({
            apiver: 2,
            source: 2,
            pagesize: p.pagesize || 30,
            page: p.page || 1,
        }),
    }),
    e('brush', 'POST', '/genesisapi/v1/newepoch_song_rec/feed', {
        query: (_p, _ctx) => ({
            sort_type: 1,
            platform: 'ios',
            page: 1,
            content_ver: 4,
            clientver: 11850,
        }),
        body: (p, ctx) => ({
            behaviors: [],
            abtest: {
                abtest: {
                    shuashua: {
                        commentcard: 2,
                    },
                },
            },
            personal_recommend_params: {
                userid: ctx.userid,
                appid: ctx.appid,
                playlist_ver: 2,
                clienttime: ctx.clienttime,
                mid: ctx.mid,
                new_sync_point: ctx.clienttime,
                module_id: 1,
                action: 'login',
                vip_type: ctx.vipType || p.vipType || 0,
                vip_flags: 3,
                recommend_source_locked: 0,
                song_pool_id: Number(p.song_pool_id || 0),
                callerid: 0,
                m_type: 1,
                kguid: ctx.userid,
                platform: 'ios',
                area_code: 1,
                fakem: 'ca981cfc583a4c37f28d2d49000013c16a0a',
                clientver: 11850,
                mode: p.mode || 'normal',
                active_swtich: 'on',
                key: ctx.signParamsKey(ctx.clienttime),
            },
        }),
    }),
    e('everyday_friend', 'POST', '/sing7/relation/json/v3/friend_rec_by_using_song_list', {
        origin: 'https://acsing.service.kugou.com',
        headers: { pid: '126556797' },
        query: (_p, _ctx) => ({
            channel: 130,
            isteen: 0,
            platform: 2,
            usemkv: 1,
        }),
        body: (_p, _ctx) => ({
            list: [
                {
                    user_id: 853927886,
                    mixsong_ids: [
                        290083753, 251724346, 571554587, 250126644, 208831644, 40328518, 250504076,
                        581706850, 318347675, 585258401, 288481998, 407414475, 28239430, 280584633,
                        291957521, 64556644, 243149863, 488725103, 32114153, 39951172, 29019580,
                        40397606, 327507651, 32029382, 32218359, 340353127, 276448762, 177071956,
                        100031397, 249251602,
                    ],
                },
            ],
        }),
    }),
    e('everyday_history', 'POST', '/everyday/api/v1/get_history', {
        router: 'everydayrec.service.kugou.com',
        query: (p, _ctx) => ({
            mode: p.mode || 'list',
            platform: p.platform || 'ios',
            ...(p.history_name ? { history_name: p.history_name } : {}),
            ...(p.date ? { date: p.date } : {}),
        }),
    }),
    e('everyday_recommend', 'POST', '/everyday_song_recommend', {
        router: 'everydayrec.service.kugou.com',
        query: (p, _ctx) => ({
            platform: p.platform || 'ios',
        }),
    }),
    e('everyday_style_recommend', 'POST', '/everydayrec.service/everyday_style_recommend', {
        query: (p, _ctx) => ({
            tagids: p.tagids ?? '',
        }),
        body: (_p, _ctx) => ({}),
    }),
    e('home_discover', 'POST', '/homediscoverrec/v1/client/home_discover_rec', {
        query: (p, ctx) => ({
            module_key: 'home_discover_rec',
            module_id: 1,
            area_code: 1,
            platform: 'android',
            userid: ctx.userid,
            clientver: 20809,
        }),
        body: (p, ctx) => ({
            support: p.support || 'only_song',
            userid: ctx.userid,
            recall_type: p.recall_type || 'song',
            today_play_num: p.today_play_num || 0,
            pagesize: p.pagesize || 4,
            go_ky_extra: p.go_ky_extra || [
                {
                    key: 'network',
                    val: '2',
                },
                {
                    key: 'play_mode',
                    val: '2',
                },
                {
                    key: 'no_mv_ret',
                    val: '1',
                },
            ],
        }),
    }),
    e('lastest_songs_listen', 'POST', '/playque/devque/v1/get_latest_songs', {
        body: (p, ctx) => ({
            area_code: '1',
            sources: ['pc', 'mobile', 'tv', 'car'],
            userid: ctx.userid,
            ret_info: 1,
            token: ctx.token,
            pagesize: Number(p.pagesize || 30),
        }),
    }),
    e('rank_audio', 'POST', '/openapi/kmr/v2/rank/audio', {
        headers: { 'kg-tid': '369' },
        body: (p, _ctx) => ({
            show_portrait_mv: 1,
            show_type_total: 1,
            filter_original_remarks: 1,
            area_code: 1,
            pagesize: p.pagesize || 30,
            rank_cid: p.rank_cid || 0,
            type: 1,
            page: p.page || 1,
            rank_id: p.rankid,
        }),
    }),
    e('rank_info', 'GET', '/ocean/v6/rank/info', {
        query: (p, _ctx) => ({
            rank_cid: p.rank_cid || 0,
            rankid: p.rankid,
            with_album_img: p.album_img || 1,
            zone: p.zone || '',
        }),
    }),
    e('rank_list', 'GET', '/ocean/v6/rank/list', {
        query: (p, _ctx) => ({
            plat: 2,
            withsong: p.withsong || 1,
            parentid: 0,
        }),
    }),
    e('rank_top', 'GET', '/mobileservice/api/v5/rank/rec_rank_list'),
    e('rank_vol', 'GET', '/ocean/v6/rank/vol', {
        query: (p, _ctx) => ({
            rank_cid: p.rank_cid || 0,
            rankid: p.rankid,
            ranktype: 1,
            type: 0,
            plat: 2,
        }),
    }),
    e('recommend_songs', 'POST', '/everyday_song_recommend', {
        router: 'everydayrec.service.kugou.com',
        body: (p, ctx) => ({
            platform: p.platform || 'android',
            userid: p.userid || ctx.userid || '0',
        }),
    }),
    e('server_now', 'POST', '/v1/server_now', {
        router: 'usercenter.kugou.com',
        query: (_p, _ctx) => ({
            plat: 3,
        }),
        body: (p, ctx) => ({
            token: ctx.token,
            userid: ctx.userid,
        }),
    }),
    e('top_album', 'POST', '/musicadservice/v1/mobile_newalbum_sp', {
        body: (p, ctx) => ({
            apiver: 20,
            token: p.token || ctx.token || '',
            page: p.page || 1,
            pagesize: p.pagesize || 30,
            withpriv: 1,
        }),
    }),
    e('top_card', 'POST', '/singlecardrec.service/v1/single_card_recommend', {
        query: (p, _ctx) => ({
            card_id: p.card_id || 1,
            fakem: '60f7ebf1f812edbac3c63a7310001701760f',
            area_code: 1,
            platform: 'ios',
        }),
        body: (p, ctx) => ({
            appid: ctx.appid,
            clientver: ctx.clientver,
            platform: 'android',
            clienttime: ctx.clienttime,
            userid: p.userid || ctx.userid || 0,
            key: ctx.signParamsKey(ctx.clienttime),
            fakem: '60f7ebf1f812edbac3c63a7310001701760f',
            area_code: 1,
            mid: ctx.mid,
            uuid: '-',
            client_playlist: [],
            u_info: 'a0c35cd40af564444b5584c2754dedec',
        }),
    }),
    e('top_ip', 'POST', '/v1/daily_recommend', {
        origin: 'http://musicadservice.kugou.com',
        query: (_p, _ctx) => ({
            clientver: 12349,
            area_code: 1,
        }),
        body: (_p, _ctx) => ({
            tags: {},
        }),
    }),
    e('top_playlist', 'POST', '/v2/special_recommend', {
        router: 'specialrec.service.kugou.com',
        body: (p, ctx) => ({
            appid: ctx.appid,
            mid: ctx.mid,
            clientver: ctx.clientver,
            platform: 'android',
            clienttime: ctx.clienttime,
            userid: p.userid || ctx.userid || 0,
            module_id: p.module_id || 1,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
            key: ctx.signParamsKey(ctx.clienttime.toString()),
            special_recommend: {
                withtag: p.withtag || 1,
                withsong: p.withsong || 1,
                sort: p.sort || 1,
                ugc: 1,
                is_selected: 0,
                withrecommend: 1,
                area_code: 1,
                categoryid: p.category_id || 0,
            },
            req_multi: 1,
            retrun_min: 5,
            return_special_falg: 1,
        }),
    }),
    e('top_song', 'POST', '/musicadservice/container/v1/newsong_publish', {
        body: (p, ctx) => ({
            rank_id: p.type || 21608,
            userid: p.userid || ctx.userid || 0,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
            tags: [],
        }),
    }),
];
