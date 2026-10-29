/**
 * verticals 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const verticalsEndpoints: EndpointDef[] = [
    e('ip_dateil', 'POST', '/openapi/v1/ip', {
        body: (p, _ctx) => ({
            data: (p.id || '').split(',').map((s: any) => ({
                ip_id: s,
            })),
            is_publish: 1,
        }),
    }),
    e('ip_playlist', 'POST', '/ocean/v6/pubsongs/list_info_for_ip', {
        query: (p, _ctx) => ({
            ip: p.id,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
        }),
    }),
    e('ip_zone', 'GET', '/v1/zone/index', {
        router: 'yuekucategory.kugou.com',
    }),
    e('ip_zone_home', 'GET', '/v1/zone/home', {
        router: 'yuekucategory.kugou.com',
        query: (p, _ctx) => ({
            id: p.id,
            share: 0,
        }),
    }),
    e('longaudio_album_audios', 'POST', '/longaudio/v2/album_audios', {
        router: 'openapi.kugou.com',
        headers: { 'KG-TID': '78' },
        body: (p, _ctx) => ({
            album_id: p.album_id,
            area_code: 1,
            tagid: 0,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
        }),
    }),
    e('longaudio_album_detail', 'POST', '/openapi/v2/broadcast', {
        headers: { 'KG-TID': '78' },
        body: (p, _ctx) => ({
            data: (p.album_id || '').split(',').map((s: any) => ({
                album_id: s,
            })),
            show_album_tag: 1,
            fields: 'album_name,album_id,category,authors,sizable_cover,intro,author_name,trans_param,album_tag,mix_intro,full_intro,is_publish',
        }),
    }),
    e('longaudio_album_list', 'GET', '/longaudio/v1/album/list', {
        query: (p, _ctx) => ({
            api_ver: 2,
            gender: Math.max(0, parseInt(p.gender) || 0),
            sort: Math.max(0, parseInt(p.sort) || 0),
            tag_id: Math.max(0, parseInt(p.tag_id) || 906),
            free: 1,
            status: Math.max(0, parseInt(p.status) || 0),
            page: Math.max(1, parseInt(p.page) || 1),
            page_size: Math.max(1, parseInt(p.page_size) || 20),
            clientver: 20789,
        }),
    }),
    e('longaudio_daily_recommend', 'POST', '/longaudio/v1/home_new/daily_recommend', {
        query: (p, _ctx) => ({
            module_id: 1,
            size: p.pagesize || 30,
            page: p.page || 1,
        }),
    }),
    e('longaudio_rank_recommend', 'GET', '/longaudio/v1/home_new/rank_card_recommend', {
        query: (_p, _ctx) => ({
            platform: 'ios',
        }),
    }),
    e('longaudio_search', 'GET', '/complexsearch/v4/search/song', {
        query: (p, ctx) => ({
            area_code: 1,
            albumhide: 1,
            com_user_type: 0,
            privilegefilter: 0,
            dopicfull: 1,
            filter: 12,
            platform: 'AndroidFilter',
            tag: 'em',
            recver: 2,
            iscorrection: 1,
            search_ability: 223,
            sec_aggre: 1,
            sec_aggre_bitmap: 0,
            mode_ability: 1,
            nocollect: 1,
            user_type: 0,
            userid: p.userid ?? ctx.userid ?? '0',
            keyword: p.keywords ?? p.keyword,
            page: Math.max(1, parseInt(p.page) || 1),
            pagesize: Math.max(1, parseInt(p.pagesize) || 30),
            clientver: 20789,
        }),
    }),
    e('longaudio_tag_list', 'GET', '/v3/list_audiobook_tags', {
        router: 'longaudio.kugou.com',
        query: (_p, _ctx) => ({
            platform: 'android',
            clientver: 20789,
        }),
    }),
    e('longaudio_vip_recommend', 'POST', '/longaudio/v1/home_new/vip_select_recommend', {
        query: (_p, _ctx) => ({
            position: '2',
            clientver: 12329,
        }),
        body: (_p, _ctx) => ({
            album_playlist: [],
        }),
    }),
    e('longaudio_week_recommend', 'POST', '/longaudio/v1/home_new/week_new_albums_recommend', {
        query: (_p, _ctx) => ({
            clientver: 12329,
        }),
        body: (_p, _ctx) => ({
            album_playlist: [],
        }),
    }),
    e('team_join', 'POST', '/youth/v1/ut/join_team', {
        headers: { Host: 'gateway.kugou.com' },
        query: (_p, ctx) => ({
            srcappid: ctx.srcappid,
            clientver: ctx.clientver,
            clienttime: ctx.clienttime,
            mid: ctx.mid,
            uuid: ctx.uuid,
            dfid: ctx.dfid,
            appid: ctx.appid,
            userid: ctx.userid,
            token: ctx.token,
        }),
        body: (p, _ctx) => ({
            team_code: p.team_code,
        }),
    }),
    e('team_my', 'POST', '/youth/v1/ut/create_team', {
        headers: { Host: 'gateway.kugou.com' },
        query: (_p, ctx) => ({
            srcappid: ctx.srcappid,
            clientver: ctx.clientver,
            clienttime: ctx.clienttime,
            mid: ctx.mid,
            uuid: ctx.uuid,
            dfid: ctx.dfid,
            appid: ctx.appid,
            userid: ctx.userid,
            token: ctx.token,
        }),
        body: (p, _ctx) => ({
            period_id: p.period_id,
        }),
    }),
    e('youth_channel_all', 'GET', '/youth/v2/channel/channel_all_list', {
        query: (p, _ctx) => ({
            page: p.page || 1,
            pagesize: p.pagesize || 30,
            type: 1,
        }),
    }),
    e('youth_channel_amway', 'GET', '/youth/api/amway/v2/index', {
        query: (p, _ctx) => ({
            global_collection_id: p.global_collection_id,
        }),
    }),
    e('youth_channel_detail', 'POST', '/youth/api/channel/v1/channel_list_by_id', {
        body: (p, _ctx) => ({
            data: (p.global_collection_id || '').split(',').map((s: any) => ({
                global_collection_id: s,
            })),
        }),
    }),
    e('youth_channel_similar', 'POST', '/youth/v1/channel/get_friendly_channel', {
        query: (p, _ctx) => ({
            channel_id: p.channel_id,
        }),
        body: (p, ctx) => ({
            area_code: 1,
            playlist_ver: 2,
            vip_type: p.vip_type || ctx.vipType || 0,
            platform: 'ios',
        }),
    }),
    e('youth_channel_song', 'GET', '/youth/api/channel/v1/channel_get_song_audit_passed', {
        query: (p, _ctx) => ({
            global_collection_id: p.global_collection_id,
            pagesize: p.pagesize || 30,
            page: p.page || 1,
            is_filter: 0,
        }),
    }),
    e('youth_channel_song_detail', 'GET', '/youth/v2/post/get_song_detail', {
        query: (p, _ctx) => ({
            global_collection_id: p.global_collection_id,
            fileid: p.fileid,
        }),
    }),
    e('youth_channel_song_list', 'GET', '/api/channel/v1/channel_get_song_list', {
        origin: 'https://youth.kugou.com',
        query: (p, _ctx) => ({
            global_collection_id: p.global_collection_id,
            pagesize: p.pagesize || 20,
            page: p.page || 1,
            types: 2,
            is_filter: 0,
            apiver: 3,
        }),
    }),
    e('youth_day_vip', 'POST', '/youth/v1/recharge/receive_vip_listen_song', {
        query: (p, _ctx) => ({
            source_id: 90139,
            receive_day: p.receive_day,
        }),
    }),
    e('youth_day_vip_upgrade', 'POST', '/youth/v1/listen_song/upgrade_vip_reward', {
        query: (p, ctx) => ({
            kugouid: Number(p.userid || ctx.userid || 0),
            ad_type: 1,
        }),
    }),
    e('youth_dynamic', 'GET', '/youth/v3/user/get_dynamic'),
    e('youth_dynamic_recent', 'GET', '/youth/v3/user/recent_dynamic'),
    e('youth_listen_song', 'POST', '/youth/v2/report/listen_song', {
        headers: { 'user-agent': 'Android13-1070-10566-201-0-ReportPlaySongToServerProtocol-wifi' },
        query: (_p, _ctx) => ({
            clientver: 10566,
        }),
        body: (p, _ctx) => ({
            mixsongid: p.mixsongid || 666075191,
        }),
    }),
    e('youth_month_vip_record', 'GET', '/youth/v1/activity/get_month_vip_record', {
        query: (_p, _ctx) => ({
            latest_limit: 100,
        }),
    }),
    e('youth_union_vip', 'GET', '/v1/get_union_vip', {
        origin: 'https://kugouvip.kugou.com',
        query: (_p, _ctx) => ({
            busi_type: 'concept',
            opt_product_types: 'dvip,qvip',
            product_type: 'svip',
        }),
    }),
    e('youth_user_song', 'GET', '/youth/v1/get_user_song_public', {
        query: (p, _ctx) => ({
            filter_video: 0,
            type: p.type || 0,
            userid: p.userid,
            pagesize: p.pagesize || 30,
            page: p.page || 1,
            is_filter: 0,
        }),
    }),
    e('youth_vip', 'POST', '/youth/v1/ad/play_report', {
        body: (_p, _ctx) => ({
            ad_id: 12307537187,
            play_end: Date.now(),
            play_start: Date.now() - 30000,
        }),
    }),
];
