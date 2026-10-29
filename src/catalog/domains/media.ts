/**
 * media 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const mediaEndpoints: EndpointDef[] = [
    e('kmr_audio_mv', 'POST', '/kmr/v1/audio/mv', {
        router: 'openapi.kugou.com',
        headers: { 'KG-TID': '38' },
        body: (p, _ctx) => ({
            data: (p.album_audio_id || '').split(',').map((s: any) => ({
                album_audio_id: s,
            })),
            fields: p.fields || '',
        }),
    }),
    e('krm_audio', 'POST', '/kmr/v2/audio', {
        router: 'openapi.kugou.com',
        headers: { 'KG-TID': '238' },
        body: (p, _ctx) => ({
            data: (p.album_audio_id || '').split(',').map((s: any) => ({
                entity_id: Number(s),
            })),
            fields: p.fields || 'base',
        }),
    }),
    e('video_detail', 'POST', '/v1/video', {
        router: 'kmr.service.kugou.com',
        body: (p, ctx) => ({
            appid: ctx.appid,
            clientver: ctx.clientver,
            clienttime: ctx.clienttime,
            mid: ctx.mid,
            uuid: ctx.uuid,
            dfid: ctx.dfid,
            token: ctx.token || '',
            key: ctx.signParamsKey(ctx.clienttime.toString()),
            show_resolution: 1,
            data: (p.id || '').split(',').map((s: any) => ({
                video_id: s,
            })),
        }),
        clearParams: true,
    }),
    e('video_privilege', 'POST', '/v1/get_video_privilege', {
        router: 'media.store.kugou.com',
        body: (p, ctx) => ({
            appid: ctx.appid,
            area_code: 1,
            behavior: 'play',
            clientver: ctx.clientver,
            dfid: ctx.dfid,
            mid: ctx.mid,
            resource: (p.hash || '').split(',').map((s: any) => ({
                hash: s,
                id: 0,
                name: '',
            })),
            token: ctx.token || '',
            userid: ctx.userid || 0,
            vip: ctx.vipType || 0,
        }),
    }),
    e('video_url', 'GET', '/v2/interface/index', {
        router: 'trackermv.kugou.com',
        query: (p, _ctx) => ({
            backupdomain: 1,
            cmd: 123,
            ext: 'mp4',
            ismp3: 0,
            hash: p.hash,
            pid: 1,
            type: 1,
        }),
        trackerKey: true,
    }),
];
