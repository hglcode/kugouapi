/**
 * 组队（team_*）端点。
 *
 * team 族与 login_device_kick 共用"h5 token 封装 + web 签名"协议。
 *
 * 注：上游已移除 top_tag_card_youth 模块（接口迁移至 top_card_youth 的
 * card_id=3103 分支，见 special/search.ts），此处不再保留 legacy 条目。
 *
 * @module
 */

import { Buffer } from 'node:buffer';

import { e, type CallCtx, type EndpointDef } from '../types';

/** h5 token 封装：'h5' + RSA-OAEP 无填充（128 字节零填充）大写 hex */
function h5Token(ctx: CallCtx, rawToken: string): string {
    const prefix = 'moc.uoguk.59::';
    const input = Buffer.from(prefix + rawToken, 'utf8');
    const padded = Buffer.alloc(128);
    input.copy(padded);
    return `h5${ctx.rsaEncryptRaw(padded).toUpperCase()}`;
}

/** team 族共用请求（web 签名 + h5 token） */
function teamRequest(ctx: CallCtx, url: string, extra: Record<string, unknown>): Promise<unknown> {
    const token = h5Token(ctx, ctx.token);
    const query: Record<string, unknown> = {
        srcappid: ctx.srcappid,
        clientver: ctx.clientver,
        clienttime: Date.now(),
        mid: ctx.mid,
        uuid: ctx.uuid,
        dfid: ctx.dfid,
        appid: ctx.appid,
        userid: ctx.userid,
        token,
        ...extra,
    };
    return ctx.request(url, {
        method: 'GET',
        sign: 'web',
        query: query as Record<string, string | number>,
    });
}

export const teamSpecialEndpoints: EndpointDef[] = [
    // ── 组队记录 ──
    e('team_history', 'GET', '/youth/v1/ut/get_team_record', {
        salt: 'web',
        auth: true,
        handler: async (p, ctx) =>
            teamRequest(ctx, '/youth/v1/ut/get_team_record', {
                page: p.page || 1,
                page_size: p.page_size || 10,
            }),
    }),

    // ── 我的队伍信息 ──
    e('team_my_info', 'GET', '/youth/v1/ut/get_my_team_info', {
        salt: 'web',
        auth: true,
        handler: async (p, ctx) =>
            teamRequest(ctx, '/youth/v1/ut/get_my_team_info', {
                period_id: p.period_id,
            }),
    }),

    // ── 组队状态 ──
    e('team_my_status', 'GET', '/youth/v1/ut/get_user_status', {
        salt: 'web',
        auth: true,
        handler: async (p, ctx) =>
            teamRequest(ctx, '/youth/v1/ut/get_user_status', {
                period_id: p.period_id,
            }),
    }),

    // ── 期次信息 ──
    e('team_period_info', 'GET', '/youth/v1/ut/get_period_info', {
        salt: 'web',
        auth: true,
        handler: async (_p, ctx) => teamRequest(ctx, '/youth/v1/ut/get_period_info', {}),
    }),
];
