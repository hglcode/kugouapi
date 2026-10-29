/**
 * playlist 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { randomThash } from '../../crypto';
import { e, type EndpointDef } from '../types';

export const playlistEndpoints: EndpointDef[] = [
    e('playlist_detail', 'POST', '/v3/get_list_info', {
        router: 'pubsongs.kugou.com',
        body: (p, ctx) => ({
            data: (p.ids || '').split(',').map((s: any) => ({
                "'global_collection_id'": s,
            })),
            userid: p.userid || ctx.userid || 0,
            token: p.token || ctx.token || '',
        }),
    }),
    e('playlist_effect', 'POST', '/pubsongs/v1/get_sound_effect_list', {
        body: (p, _ctx) => ({
            page: p.page || 1,
            pagesize: p.pagesize || 30,
        }),
    }),
    e('playlist_similar', 'POST', '/pubsongs/v1/kmr_get_similar_lists', {
        body: (p, ctx) => ({
            appid: ctx.appid,
            clientver: ctx.clientver,
            clienttime: ctx.clienttime,
            key: ctx.signParamsKey(ctx.clienttime),
            userid: p.userid || ctx.userid || 0,
            ugc: 1,
            show_list: 1,
            need_songs: 1,
            data: (p.ids || '').split(',').map((s: any) => ({
                "'global_collection_id'": s,
            })),
        }),
    }),
    e('playlist_tags', 'POST', '/pubsongs/v1/get_tags_by_type', {
        body: (_p, _ctx) => ({
            tag_type: 'collection',
            tag_id: 0,
            source: 3,
        }),
    }),
    e('playlist_track_all', 'GET', '/pubsongs/v2/get_other_list_file_nofilt', {
        query: (p, _ctx) => ({
            area_code: 1,
            begin_idx: (Number(p.page || 1) - 1) * (p.pagesize || 30),
            plat: 1,
            type: 1,
            mode: 1,
            personal_switch: 1,
            extend_fields: 'abtags,hot_cmt,popularization',
            pagesize: p.pagesize || 30,
            global_collection_id: p.id,
        }),
    }),
    e('playlist_track_all_new', 'POST', '/v4/get_list_all_file_v3', {
        router: 'cloudlist.service.kugou.com',
        body: (p, ctx) => ({
            listid: p.listid,
            userid: ctx.userid,
            type: Number(p.type || 0),
            page: Number(p.page || 1),
            pagesize: Number(p.pagesize || 300),
            area_code: 1,
            allplatform: 1,
            show_cover: 1,
            token: ctx.token,
        }),
    }),
    e('playlist_tracks_del', 'POST', '/v4/delete_songs', {
        router: 'cloudlist.service.kugou.com',
        body: (p, ctx) => ({
            listid: p.listid,
            userid: ctx.userid,
            data: (p.fileids || '').split(',').map((s: any) => ({
                fileid: Number(s),
            })),
            type: 0,
            token: ctx.token,
            list_ver: 0,
        }),
    }),
    e('sheet_collection', 'GET', '/miniyueku/v1/opern_square/get_home_module_config', {
        salt: 'web',
        query: (p, ctx) => ({
            srcappid: ctx.srcappid,
            position: p.position ?? 2,
        }),
    }),
    e('sheet_detail', 'GET', '/opern/v1/detail/info', {
        query: (p, _ctx) => ({
            opern_id: p.id,
        }),
    }),
    e('sheet_explore', 'POST', '/opern/v1/home/get_rec_opern', {
        query: (p, _ctx) => ({
            pagesize: p.pagesize || 30,
            page: p.page || 1,
            opern_level: p.level || 0,
            instruments: p.instruments || 1,
            tagid: p.tagid || 0,
        }),
        body: (_p, _ctx) => ({
            exposure_mixids: '',
        }),
    }),
    e('sheet_rank', 'POST', '/opern/v1/home/get_rank_opern', {
        query: (p, _ctx) => ({
            pagesize: p.pagesize || 30,
            page: p.page || 1,
            opern_level: p.level || 0,
            instruments: p.instruments || 1,
            tagid: p.tagid || 0,
        }),
    }),
    e('sheet_song', 'GET', '/opern/v1/detail/song_info', {
        query: (p, _ctx) => ({
            mixsongid: p.album_audio_id,
            instruments: p.instruments ?? 1,
            opern_level: p.level ?? 0,
        }),
    }),
    e('sheet_tags', 'GET', '/opern/v1/home/get_tags'),

    // ── 官方分享链接上报（上游 #293 新增，t.service 短链服务） ──
    e('playlist_share_official', 'GET', '/app', {
        origin: 'http://t.service.kugou.com',
        salt: 'none',
        clearParams: true,
        clearHeaders: true,
        note: '自建歌单 type=1（默认）；md5 = md5("kgclientshare" + md5(link))',
        headersFn: () => ({
            'User-Agent': 'Android9-1070-10597-18-0-Share-wifi',
            'KG-THash': randomThash(),
        }),
        query: (p, ctx) => {
            if (p.id === undefined || p.id === null || p.id === '')
                throw new Error('歌单id不得为空！请检查重试。');
            const isType1 = Number(p.type || 1) === 1;
            const link =
                'https://activity.kugou.com/share/v-a00a45b0/index.html' +
                `?u=${p.userid || ctx.userid || 0}` +
                '&h1=143298444507010930495471534764048014549' +
                '&h2=406dd14b2efd5e51affd6da64c84d0f6' +
                `&specialid=${isType1 ? '-2147483648' : '0'}` +
                `&global_specialid=${p.id}` +
                `&cType=${isType1 ? '0' : '1'}`;
            return {
                caller: 'mlist',
                url: link,
                cmid: 5,
                md5: ctx.md5(`kgclientshare${ctx.md5(link)}`),
            };
        },
    }),
];
