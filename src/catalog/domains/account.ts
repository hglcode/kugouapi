/**
 * account 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const accountEndpoints: EndpointDef[] = [
    e('captcha_sent', 'POST', '/v7/send_mobile_code', {
        origin: 'http://login.user.kugou.com',
        body: (p, _ctx) => ({
            businessid: 5,
            mobile: `${p.mobile}`,
            plat: 3,
        }),
    }),
    e('get_mode_info', 'GET', '/api/v5/earphone/get_model_info', {
        origin: 'http://mobileservice.kugou.com',
        query: (p, ctx) => ({
            model_id: Number(p.model_id || 0),
            req_src: 'collection',
            earphone_vip: 1,
            sound_ver: 2,
            key: ctx.signParamsKey(Date.now()),
            page: p.page || 1,
            pagesize: p.pagesize || 30,
        }),
    }),
    e('get_model', 'GET', '/ocean/v6/sound/list', {
        query: (p, _ctx) => ({
            super_vip: 1,
            sound_ver: 2,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
            apiver: 3,
            classify: '2,3',
            plat: 2,
            privilege: 1,
            sort: p.sort || 2,
        }),
    }),
    e('get_verify_info', 'POST', '/verifyservice/v3/get_verify_info', {
        body: (p, ctx) => ({
            eventid: p.eventid,
            userid: ctx.userid,
            platid: p.platid || 2,
            rtype: 1,
            wasm: 1,
            i: '',
            sid: '',
            edt: '',
        }),
    }),
];
