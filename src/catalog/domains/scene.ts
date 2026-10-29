/**
 * scene 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const sceneEndpoints: EndpointDef[] = [
    e('effects_artist', 'GET', '/api/v3/sound/list', {
        origin: 'http://mobilecdngz.kugou.com',
        query: (p, _ctx) => ({
            plat: 2,
            version: 12460,
            apiver: 2,
            sort: 1,
            pagesize: p.pagesize || 30,
            page: p.page || 1,
            classify: 1,
        }),
        clearParams: true,
    }),
    e('effects_brand', 'GET', '/api/v5/earphone/get_brand', {
        origin: 'http://mobilecdngz.kugou.com',
        query: (p, _ctx) => ({
            sort: 1,
            pagesize: p.pagesize || 30,
            page: p.page || 1,
        }),
        clearParams: true,
    }),
    e('effects_brand_detail', 'GET', '/api/v5/earphone/get_model', {
        origin: 'http://mobilecdngz.kugou.com',
        query: (p, _ctx) => ({
            brand_id: p.brand_id || 0,
            pagesize: p.pagesize || 30,
            page: p.page || 1,
        }),
        clearParams: true,
    }),
    e('effects_car_brand', 'GET', '/api/v5/car_sound/get_brand', {
        origin: 'http://mobilecdngz.kugou.com',
        clearParams: true,
    }),
    e('effects_car_brand_lists', 'GET', '/api/v3/sound/list', {
        origin: 'http://mobilecdngz.kugou.com',
        query: (p, _ctx) => ({
            plat: 2,
            version: 12460,
            apiver: 2,
            sort: 1,
            pagesize: p.pagesize || 30,
            page: p.page || 1,
            classify: 5,
            rel_id: p.rel_id || 0,
        }),
        clearParams: true,
    }),
    e('effects_match', 'GET', '/api/v5/earphone/match', {
        origin: 'http://mobilecdngz.kugou.com',
        query: (_p, _ctx) => ({
            plat: 2,
            version: 12460,
        }),
        clearParams: true,
    }),
    e('scene_audio_list', 'POST', '/scene/v1/scene/audio_list', {
        query: (p, _ctx) => ({
            scene_id: p.id,
            module_id: p.module_id,
            tag: p.tag,
            page: p.page || 1,
            page_size: p.pagesize || 30,
        }),
        body: (p, ctx) => ({
            appid: ctx.appid,
            clientver: ctx.clientver,
            token: ctx.token,
            userid: ctx.userid,
        }),
    }),
    e('scene_collection_list', 'POST', '/scene/v1/distribution/collection_list', {
        body: (p, ctx) => ({
            appid: ctx.appid,
            clientver: ctx.clientver,
            token: ctx.token,
            userid: ctx.userid,
            tag_id: p.tag_id,
            page: p.page || 1,
            page_size: p.pagesize || 30,
            exposed_data: [],
        }),
    }),
    e('scene_lists', 'GET', '/scene/v1/scene/list'),
    e('scene_lists_v2', 'POST', '/scene/v1/scene/list_v2', {
        query: (p, ctx) => ({
            scene_id: p.id,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
            sort_type:
                (
                    {
                        rec: 1,
                        hot: 2,
                        new: 3,
                    } as any
                )[p.sort || 'rec'] || 1,
            kugouid: ctx.userid,
        }),
        body: (_p, _ctx) => ({
            exposure: [],
        }),
    }),
    e('scene_module', 'POST', '/scene/v1/scene/module', {
        query: (p, _ctx) => ({
            scene_id: p.id,
        }),
    }),
    e('scene_module_info', 'GET', '/scene/v1/scene/module_info', {
        query: (p, _ctx) => ({
            scene_id: p.id,
            module_id: p.module_id,
        }),
    }),
    e('scene_music', 'POST', '/genesisapi/v1/scene_music/rec_music', {
        query: (p, _ctx) => ({
            scene_id: p.id,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
        }),
        body: (_p, _ctx) => ({
            exposure: [],
        }),
    }),
    e('scene_video_list', 'POST', '/scene/v1/distribution/video_list', {
        body: (p, ctx) => ({
            appid: ctx.appid,
            clientver: ctx.clientver,
            token: ctx.token,
            userid: ctx.userid,
            tag_id: p.tag_id,
            page: p.page || 1,
            page_size: p.pagesize || 30,
            exposed_data: [],
        }),
    }),
    e('theme_music', 'POST', '/everydayrec.service/v1/mul_theme_category_recommend', {
        body: (p, ctx) => ({
            platform: 'android',
            clienttime: Math.floor(Date.now() / 1000),
            show_theme_category_ids: p.ids,
            userid: p.userid || ctx.userid || 0,
            module_id: 508,
        }),
    }),
    e('theme_music_detail', 'POST', '/everydayrec.service/v1/theme_category_recommend', {
        body: (p, ctx) => ({
            platform: 'android',
            clienttime: Math.floor(Date.now() / 1000),
            theme_category_id: p.id,
            show_theme_category_id: 0,
            userid: p.userid || ctx.userid || 0,
            module_id: 508,
        }),
    }),
    e('theme_playlist', 'POST', '/v2/getthemelist', {
        router: 'everydayrec.service.kugou.com',
        body: (p, ctx) => ({
            platform: 'android',
            clientver: ctx.clientver,
            clienttime: Date.now(),
            area_code: 1,
            module_id: 1,
            userid: p.userid || ctx.userid || 0,
        }),
    }),
    e('theme_playlist_track', 'POST', '/v2/gettheme_songidlist', {
        router: 'everydayrec.service.kugou.com',
        body: (p, ctx) => ({
            platform: 'android',
            clientver: ctx.clientver,
            clienttime: Date.now(),
            area_code: 1,
            module_id: 1,
            userid: p.userid || ctx.userid || 0,
            theme_id: p.theme_id,
        }),
    }),
];
