/**
 * 登录 / 注册 / 验证族端点。
 *
 * 覆盖：密码登录、验证码登录、token 刷新、设备管理、扫码（酷狗自有 /
 * QQ / 微信）、register_dev、人机验证（sid/edt）。
 *
 * 登录成功后 token / userid / vip 信息自动写入客户端会话。
 *
 * @module
 */

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import { e, type CallCtx, type CallParams, type EndpointDef } from '../types';
import { randomString } from '../../crypto';
import { generateSimulate } from '../../security';

// 登录族 lite 加密参数（参考实现常量）
const LITE_T2 = { key: 'fd14b35e3f81af3817a20ae7adae7020', iv: '17a20ae7adae7020' };
const LITE_T1 = { key: '5e4ef500e9597fe004bd09a46d8add98', iv: '04bd09a46d8add98' };
const T3 = 'MCwwLDAsMCwwLDAsMCwwLDA=';

/** 设备标识（登录族 t1/t2 需要）：可由参数覆盖，默认取设备信息 */
function deviceIdentity(p: CallParams, ctx: CallCtx): { guid: string; mac: string; dev: string } {
    const device = ctx.client.deviceInfo;
    return {
        guid: String(p.guid || p.uuid || ctx.uuid || device.uuid || '-'),
        mac: String(p.mac || ''),
        dev: String(p.dev || p.device || device.device || ''),
    };
}

/** 登录响应解包：secu_params 解密 + 合并 + 写会话 */
async function settleLogin(
    ctx: CallCtx,
    data: Record<string, any> | undefined,
    encryptKey: string,
): Promise<Record<string, any>> {
    const merged: Record<string, any> = { ...data };
    if (merged.secu_params) {
        const token = ctx.aesHexDecrypt(String(merged.secu_params), encryptKey);
        if (token && typeof token === 'object') {
            Object.assign(merged, token);
        } else if (typeof token === 'string') {
            merged['token'] = token;
        }
    }
    if (merged.token || merged.userid) {
        ctx.applyLogin(merged);
    }
    return merged;
}

/** /v6/login_by_openplat（QQ / 微信登录共用；secu_params 解密由调用方完成） */
async function loginByOpenplat(
    ctx: CallCtx,
    p: CallParams,
    extra: { partnerid: number; openid: string; params: string; pk: string; thirdAppid?: string },
): Promise<Record<string, any>> {
    const isLite = ctx.platform === 'lite';
    const dateNow = Date.now();
    const { guid, mac, dev } = deviceIdentity(p, ctx);
    const t2 = ctx.aesHex(
        `${guid}|0f607264fc6318a92b9e13c65db7cd3c|${mac}|${dev}|${dateNow}`,
        LITE_T2,
    );
    const t1 = ctx.aesHex(`|${dateNow}`, LITE_T1);
    const dataMap: Record<string, unknown> = {
        dev,
        force_login: 1,
        partnerid: extra.partnerid,
        clienttime_ms: dateNow,
        t1: isLite ? t1 : 0,
        t2: isLite ? t2 : 0,
        t3: T3,
        ...(extra.thirdAppid ? { third_appid: extra.thirdAppid } : {}),
        openid: extra.openid,
        params: extra.params,
        pk: extra.pk,
    };
    return ctx.request<Record<string, any>>('/v6/login_by_openplat', {
        method: 'POST',
        router: 'login.user.kugou.com',
        json: dataMap,
    });
}

export const accountSpecialEndpoints: EndpointDef[] = [
    // ── 密码登录（/v9/login_by_pwd） ──
    e('login', 'POST', '/v9/login_by_pwd', {
        router: 'login.user.kugou.com',
        auth: false,
        handler: async (p, ctx) => {
            const dateNow = Date.now();
            const isLite = ctx.platform === 'lite';
            const encrypt = ctx.aesHex({
                pwd: p.password || '',
                code: p.code || '',
                clienttime_ms: dateNow,
            }) as { str: string; key: string };
            const { guid, mac, dev } = deviceIdentity(p, ctx);
            const t2 = ctx.aesHex(
                `${guid}|0f607264fc6318a92b9e13c65db7cd3c|${mac}|${dev}|${dateNow}`,
                LITE_T2,
            );
            const t1 = ctx.aesHex(`|${dateNow}`, LITE_T1);
            const dataMap: Record<string, unknown> = {
                plat: 1,
                support_multi: 1,
                clienttime_ms: dateNow,
                t1: isLite ? t1 : 0,
                t2: isLite ? t2 : 0,
                t3: T3,
                dev,
                username: p.username,
                params: encrypt.str,
                pk: ctx.rsaEncryptRaw({ clienttime_ms: dateNow, key: encrypt.key }).toUpperCase(),
            };
            const data = await ctx.request<Record<string, any>>('/v9/login_by_pwd', {
                method: 'POST',
                router: 'login.user.kugou.com',
                json: dataMap,
            });
            return settleLogin(ctx, data, encrypt.key);
        },
    }),

    // ── 验证码登录（/v7/login_by_verifycode） ──
    e('login_cellphone', 'POST', '/v7/login_by_verifycode', {
        origin: 'https://loginserviceretry.kugou.com',
        auth: false,
        handler: async (p, ctx) => {
            const dateTime = Date.now();
            const isLite = ctx.platform === 'lite';
            const encrypt = ctx.aesHex({ mobile: p.mobile || '', code: p.code || '' }) as {
                str: string;
                key: string;
            };
            const mobile = p.mobile
                ? `${p.mobile.toString().substring(0, 2)}*****${p.mobile.toString().substring(10, 11)}`
                : undefined;
            const { guid, mac, dev } = deviceIdentity(p, ctx);
            const t2 = ctx.aesHex(
                `${guid}|0f607264fc6318a92b9e13c65db7cd3c|${mac}|${dev}|${dateTime}`,
                LITE_T2,
            );
            const t1 = ctx.aesHex(`|${dateTime}`, LITE_T1);
            const dataMap: Record<string, unknown> = {
                plat: 1,
                support_multi: 1,
                t1: isLite ? t1 : 0,
                t2: isLite ? t2 : 0,
                clienttime_ms: dateTime,
                mobile,
                key: ctx.signParamsKey(dateTime),
                pk: ctx.rsaEncryptRaw({ clienttime_ms: dateTime, key: encrypt.key }).toUpperCase(),
                params: encrypt.str,
                ...(p.userid ? { userid: p.userid } : {}),
            };
            if (isLite) {
                dataMap['dfid'] = ctx.dfid;
                dataMap['dev'] = dev;
                dataMap['gitversion'] = '5f0b7c4';
            } else {
                dataMap['t3'] = T3;
            }
            const data = await ctx.request<Record<string, any>>('/v7/login_by_verifycode', {
                method: 'POST',
                baseUrl: 'https://loginserviceretry.kugou.com',
                json: dataMap,
                headers: {
                    'support-calm': '1',
                    'User-Agent': 'Android16-1070-11440-130-0-LOGIN-wifi',
                },
            });
            return settleLogin(ctx, data, encrypt.key);
        },
    }),

    // ── token 刷新登录（/v5/login_by_token） ──
    e('login_token', 'POST', '/v5/login_by_token', {
        origin: 'http://login.user.kugou.com',
        auth: true,
        handler: async (p, ctx) => {
            const dateNow = Date.now();
            const isLite = ctx.platform === 'lite';
            const key = isLite
                ? { key: 'c24f74ca2820225badc01946dba4fdf7', iv: 'adc01946dba4fdf7' }
                : { key: '90b8382a1bb4ccdcf063102053fd75b8', iv: 'f063102053fd75b8' };
            const token = String(p.token || ctx.token || '');
            const userid = String(p.userid || ctx.userid || '0');
            const encrypt = ctx.aesHex(
                { clienttime: Math.floor(dateNow / 1000), token },
                key,
            ) as string;
            const encryptParams = ctx.aesHex({}) as { str: string; key: string };
            const { guid, mac, dev } = deviceIdentity(p, ctx);
            const t2 = ctx.aesHex(
                `${guid}|0f607264fc6318a92b9e13c65db7cd3c|${mac}|${dev}|${dateNow}`,
                LITE_T2,
            );
            const t1 = ctx.aesHex(`|${dateNow}`, LITE_T1);
            const dataMap: Record<string, unknown> = {
                dfid: ctx.dfid || '-',
                p3: encrypt,
                plat: 1,
                t1: isLite ? t1 : 0,
                t2: isLite ? t2 : 0,
                t3: T3,
                pk: ctx.rsaEncryptRaw({ clienttime_ms: dateNow, key: encryptParams.key }),
                params: encryptParams.str,
                userid,
                clienttime_ms: dateNow,
            };
            if (isLite) dataMap['dev'] = dev;
            const data = await ctx.request<Record<string, any>>('/v5/login_by_token', {
                method: 'POST',
                baseUrl: 'http://login.user.kugou.com',
                json: dataMap,
            });
            return settleLogin(ctx, data, encryptParams.key);
        },
    }),

    // ── 设备列表（/v2/get_dev） ──
    e('login_device', 'POST', '/v2/get_dev', {
        origin: 'https://userinfoservice.kugou.com',
        auth: true,
        handler: async (p, ctx) => {
            const clienttimeMs = Date.now();
            const encrypt = ctx.aesHex({ token: p.token || ctx.token }) as {
                str: string;
                key: string;
            };
            return ctx.request('/v2/get_dev', {
                method: 'POST',
                baseUrl: 'https://userinfoservice.kugou.com',
                json: {
                    plat: 1,
                    userid: p.userid || ctx.userid || 0,
                    clienttime_ms: clienttimeMs,
                    pk: ctx
                        .rsaEncryptRaw({ clienttime_ms: clienttimeMs, key: encrypt.key })
                        .toUpperCase(),
                    params: encrypt.str,
                },
            });
        },
    }),

    // ── 设备踢下线（/loginservice/v1/dev_logout，web 签名 + RSA 无填充 token） ──
    e('login_device_kick', 'GET', '/loginservice/v1/dev_logout', {
        auth: true,
        note: 'token 以 "h5" + RSA-OAEP 无填充大写 hex 形式封装',
        handler: async (p, ctx) => {
            const rawToken = String(p.token || ctx.token || '');
            const prefix = 'moc.uoguk.59::';
            const input = Buffer.from(prefix + rawToken, 'utf8');
            const padded = Buffer.alloc(128);
            input.copy(padded);
            const encrypted = ctx.rsaEncryptRaw(padded).toUpperCase();
            const token = `h5${encrypted}`;
            const dataMap: Record<string, unknown> = {
                appid: ctx.appid,
                clientver: ctx.clientver,
                clienttime: Date.now(),
                mid: ctx.mid,
                uuid: ctx.uuid,
                dfid: ctx.dfid,
                plat: 1,
                userid: p.userid || ctx.userid || 0,
                token,
                srcappid: ctx.srcappid,
                t_mid: p.t_mid,
                t: p.t,
                t_appid: p.t_appid,
                t_clientver: p.t_clientver,
            };
            return ctx.request('/loginservice/v1/dev_logout', {
                method: 'GET',
                sign: 'web',
                query: dataMap as Record<string, string | number>,
            });
        },
    }),

    // ── QQ 令牌登录（/v6/login_by_openplat） ──
    e('login_qq', 'POST', '/v6/login_by_openplat', {
        router: 'login.user.kugou.com',
        auth: false,
        note: '需先经 QQ 扫码流程拿到 openid / access_token',
        handler: async (p, ctx) => {
            const openid = p.openid || '';
            const accessToken = p.access_token || '';
            if (!openid || !accessToken) throw new Error('缺少 openid 或 access_token');
            const dateNow = Date.now();
            const encrypt = ctx.aesHex({ access_token: accessToken }) as {
                str: string;
                key: string;
            };
            const data = await loginByOpenplat(ctx, p, {
                partnerid: 1,
                openid,
                params: encrypt.str,
                pk: ctx.rsaEncryptRaw({ clienttime_ms: dateNow, key: encrypt.key }).toUpperCase(),
                thirdAppid: ctx.platform === 'lite' ? '101706348' : '205141',
            });
            return settleLogin(ctx, data, encrypt.key);
        },
    }),

    // ── 微信令牌登录（/v6/login_by_openplat） ──
    e('login_openplat', 'POST', '/v6/login_by_openplat', {
        router: 'login.user.kugou.com',
        auth: false,
        note: '需先经微信 OAuth（code）换取 access_token',
        handler: async (p, ctx) => {
            const code = p.code || '';
            if (!code) throw new Error('缺少 code（微信 OAuth 授权码）');
            const isLite = ctx.platform === 'lite';
            const appid = p.wx_appid || (isLite ? 'wx72b795aca60ad321' : 'wx79f2c4418704b4f8');
            const secret =
                p.wx_secret ||
                (isLite ? '33e486041e5e25729a4e3d2da7502f9a' : '4efcab88b700769e376e3f6087b8abc9');
            const tokenResp = await ctx.raw({
                method: 'POST',
                url: 'https://api.weixin.qq.com/sns/oauth2/access_token',
                query: { secret, appid, code, grant_type: 'authorization_code' },
                retries: 0,
            });
            const tokenData = (tokenResp.json() ?? {}) as Record<string, any>;
            if (!tokenData.access_token || !tokenData.openid) {
                throw new Error(JSON.stringify(tokenData));
            }
            const dateNow = Date.now();
            const encrypt = ctx.aesHex({ access_token: tokenData.access_token }) as {
                str: string;
                key: string;
            };
            const data = await loginByOpenplat(ctx, p, {
                partnerid: 36,
                openid: tokenData.openid,
                params: encrypt.str,
                pk: ctx.rsaEncryptRaw({ clienttime_ms: dateNow, key: encrypt.key }).toUpperCase(),
            });
            return settleLogin(ctx, data, encrypt.key);
        },
    }),

    // ── 酷狗扫码：获取二维码 key ──
    e('login_qr_key', 'GET', '/v2/qrcode', {
        origin: 'https://login-user.kugou.com',
        salt: 'web',
        note: 'qrcode_txt 中的 appid 沿用平台 appid（与参考实现一致）',
        query: (p, ctx) => ({
            appid: p.type === 'web' ? 1014 : 1001,
            type: 1,
            plat: 4,
            qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${ctx.appid}&`,
            srcappid: ctx.srcappid,
        }),
    }),

    // ── 酷狗扫码：生成二维码内容 ──
    e('login_qr_create', 'GET', '/', {
        salt: 'none',
        note: '本地构造登录 URL（零依赖不内置二维码图片渲染，base64 仅在提供 qrimg 参数时返回空串，可自行用 url 生成）',
        handler: async (p) => {
            const url = `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${p.key}`;
            return { url, base64: p.qrimg ? '' : '' };
        },
    }),

    // ── 酷狗扫码：轮询状态 ──
    e('login_qr_check', 'GET', '/v2/get_userinfo_qrcode', {
        origin: 'https://login-user.kugou.com',
        salt: 'web',
        note: 'status=4 表示扫码成功，token/userid 自动写入会话',
        handler: async (p, ctx) => {
            const { dev } = deviceIdentity(p, ctx);
            const data = await ctx.request<Record<string, any>>('/v2/get_userinfo_qrcode', {
                baseUrl: 'https://login-user.kugou.com',
                sign: 'web',
                query: {
                    plat: 4,
                    appid: ctx.appid,
                    srcappid: ctx.srcappid,
                    qrcode: p.key,
                    dev,
                },
            });
            if (data?.status === 4 && data?.token) {
                ctx.applyLogin({ token: data.token, userid: data.userid });
            }
            return data;
        },
    }),

    // ── 酷狗扫码：授权（已登录账号扫其他端二维码） ──
    e('login_qr_authorize', 'POST', '/v2/scan', {
        origin: 'https://login-user.kugou.com',
        salt: 'web',
        auth: true,
        note: '复合端点：/v2/scan 通过后自动调 /v2/authorize',
        handler: async (p, ctx) => {
            const qrcode = p.qrcode;
            if (!qrcode || !/^[\w-]+$/.test(qrcode)) throw new Error('缺少有效的 qrcode 参数');
            if (!ctx.token || !ctx.userid) throw new Error('缺少已登录账号的 token 或 userid');
            const requestAppid = p.appid || ctx.appid;
            const requestOptions = () => ({
                baseUrl: 'https://login-user.kugou.com',
                method: 'POST' as const,
                sign: 'web' as const,
                query: {
                    appid: requestAppid,
                    srcappid: ctx.srcappid,
                    clientver: ctx.clientver,
                },
            });
            const scanData = await ctx.request<Record<string, any>>('/v2/scan', {
                ...requestOptions(),
                json: {
                    plat: p.plat === 2 ? 2 : 1,
                    userid: ctx.userid,
                    token: ctx.token,
                    qrcode,
                    type: 1,
                },
            });
            if (String(scanData?.userid) !== String(ctx.userid)) {
                return { ...scanData, qrcode, appid: requestAppid, authorized: false };
            }
            const authorizeData = await ctx.request<Record<string, any>>(
                '/v2/authorize',
                requestOptions(),
            );
            return {
                ...authorizeData,
                qrcode,
                appid: requestAppid,
                authorized: String(authorizeData?.userid) === String(ctx.userid),
            };
        },
    }),

    // ── QQ 扫码：生成二维码（QQ 开放平台网页流程） ──
    e('login_qq_qr_create', 'GET', '/', {
        salt: 'none',
        note: '返回二维码 base64 与轮询所需的 qrsig / ptqrtoken / pt_login_sig / xlogin_url',
        handler: async (p, ctx) => {
            const clientId = ctx.platform === 'lite' ? '101706348' : '205141';
            const time = Math.floor(Date.now() / 1000);
            const sign = ctx.md5(`fe4a24d80fcf253a00676a808f62c2c6_${time}`);
            const authParams = new URLSearchParams({
                cancel_display: '1',
                sdkp: 'a',
                display: 'mobile',
                format: 'json',
                sign,
                sdkv: '3.5.11.lite',
                response_type: 'token',
                status_os: '11',
                client_id: clientId,
                switch: '1',
                status_version: '30',
                show_download_ui: 'true',
                pf: 'openmobile_android',
                scope: 'all',
                compat_v: '1',
                status_machine: 'MEIZU+18+Pro',
                style: 'qr',
                time: String(time),
                redirect_uri: 'auth://tauth.qq.com/',
            });
            const UA =
                'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
            const authResp = await ctx.raw({
                url: `https://openmobile.qq.com/oauth2.0/m_authorize?${authParams.toString()}`,
                headers: { 'User-Agent': UA, Referer: 'https://xui.ptlogin2.qq.com/' },
                retries: 0,
            });
            const authText = authResp.text();
            const srcMatch = authText.match(/src = "([^"]+)"/);
            if (!srcMatch) throw new Error('m_authorize 响应异常，未找到 xlogin 地址');
            const xloginUrl = (srcMatch[1] ?? '').replace(/\\x([0-9A-Fa-f]{2})/g, (_m, h) =>
                String.fromCharCode(parseInt(h, 16)),
            );
            const xloginQuery = xloginUrl.split('?')[1] || '';
            const ptOpenloginData = encodeURIComponent(xloginQuery);
            const cookieJar = new Map<string, string>();
            const cookieStr = () =>
                Array.from(cookieJar.entries())
                    .map(([k, v]) => `${k}=${v}`)
                    .join('; ');
            const collectCookies = (headers: Headers) => {
                for (const c of headers.getSetCookie?.() ?? []) {
                    const kv = (c.split(';')[0] ?? '').trim();
                    const idx = kv.indexOf('=');
                    if (idx > 0) cookieJar.set(kv.slice(0, idx), kv.slice(idx + 1));
                }
            };
            const xloginResp = await ctx.raw({
                url: xloginUrl,
                headers: { 'User-Agent': UA, Referer: 'https://xui.ptlogin2.qq.com/' },
                retries: 0,
            });
            collectCookies(xloginResp.responseHeaders);
            const ptLoginSig = cookieJar.get('pt_login_sig') ?? '';
            const qrResp = await ctx.raw({
                url: `https://xui.ptlogin2.qq.com/ssl/ptqrshow?s=8&e=0&appid=716027609&type=0&t=${Math.random()}&daid=381&pt_3rd_aid=${clientId}`,
                headers: { 'User-Agent': UA, Referer: xloginUrl, Cookie: cookieStr() },
                retries: 0,
            });
            collectCookies(qrResp.responseHeaders);
            const qrsig = cookieJar.get('qrsig');
            if (!qrsig) throw new Error('未获取到 qrsig');
            return {
                qrcode: Buffer.from(qrResp.bytes).toString('base64'),
                qrsig,
                ptqrtoken: hash33(qrsig),
                pt_login_sig: ptLoginSig,
                pt_openlogin_data: ptOpenloginData,
                xlogin_url: xloginUrl,
                cookie: cookieStr(),
            };
        },
    }),

    // ── QQ 扫码：轮询状态（成功后自动走 login_by_openplat） ──
    e('login_qq_qr_check', 'GET', '/', {
        salt: 'none',
        note: '返回 status=wait/expired/登录结果；成功时 token/userid 写入会话',
        handler: async (p, ctx) => {
            const qrsig = p.qrsig || '';
            const ptqrtoken = p.ptqrtoken || '';
            const ptLoginSig = p.pt_login_sig || '';
            const ptOpenloginData = p.pt_openlogin_data || '';
            const xloginUrl = p.xlogin_url || '';
            let cookie = typeof p.cookie === 'string' ? p.cookie : '';
            if (ptLoginSig && !cookie.includes('pt_login_sig')) {
                cookie = `${cookie ? `${cookie}; ` : ''}pt_login_sig=${ptLoginSig}`;
            }
            const missing: string[] = [];
            if (!qrsig) missing.push('qrsig');
            if (!ptqrtoken) missing.push('ptqrtoken');
            if (!ptLoginSig) missing.push('pt_login_sig');
            if (!ptOpenloginData) missing.push('pt_openlogin_data');
            if (!xloginUrl) missing.push('xlogin_url');
            if (!cookie || !cookie.includes('qrsig=')) missing.push('cookie');
            if (missing.length)
                throw new Error(
                    `缺少 ${missing.join('、')}（请先调用 login.qq.qr.create，并将返回字段原样传入）`,
                );

            const clientId = ctx.platform === 'lite' ? '101706348' : '205141';
            const UA =
                'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
            const sUrl = 'http://connect.qq.com';
            const u1 = encodeURIComponent(sUrl);
            const pollUrl = `https://xui.ptlogin2.qq.com/ssl/ptqrlogin?u1=${u1}&from_ui=1&type=1&ptlang=2052&ptqrtoken=${ptqrtoken}&daid=381&aid=716027609&pt_3rd_aid=${clientId}&pt_openlogin_data=${ptOpenloginData}&device=2&ptopt=1&pt_uistyle=35&jsver=v1.36.0&login_sig=${encodeURIComponent(ptLoginSig)}&r=${Math.random()}`;
            const pollResp = await ctx.raw({
                url: pollUrl,
                headers: {
                    'User-Agent': UA,
                    Referer: xloginUrl || 'https://xui.ptlogin2.qq.com/',
                    Cookie: cookie,
                },
                retries: 0,
            });
            for (const c of pollResp.responseHeaders.getSetCookie?.() ?? []) {
                const kv = (c.split(';')[0] ?? '').trim();
                const idx = kv.indexOf('=');
                if (idx > 0 && !cookie.includes(kv.slice(0, idx))) {
                    cookie = `${cookie ? `${cookie}; ` : ''}${kv}`;
                }
            }
            const body = pollResp.text();
            const match = body.match(/ptuiCB\((.+)\)/);
            if (!match) throw new Error(`ptqrlogin 响应解析失败: ${body.slice(0, 200)}`);
            const parts = (match[1] ?? '').match(/'([^']*)'/g)?.map((x) => x.slice(1, -1)) ?? [];
            const code = parts[0] ?? '';
            const url = parts[2] ?? '';
            const msg = parts[4] ?? '';
            if (code === '66') return { status: 'wait', qrsig, ptqrtoken, msg: '等待扫码' };
            if (code === '65')
                return { status: 'expired', qrsig, ptqrtoken, msg: '二维码已失效，请重新生成' };
            if (code === '0') {
                let openid = url.match(/openid=([^&#]+)/)?.[1] || '';
                let accessToken = url.match(/access_token=([^&#]+)/)?.[1] || '';
                if (!openid || !accessToken) {
                    let sigUrl = url.startsWith('http') ? url : `https://${url}`;
                    for (let hop = 0; hop < 10; hop++) {
                        try {
                            const sigResp = await ctx.raw({
                                url: sigUrl,
                                redirect: 'manual',
                                headers: {
                                    'User-Agent': UA,
                                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                                    'Accept-Language': 'zh-CN,zh;q=0.9',
                                    Referer: xloginUrl || 'https://xui.ptlogin2.qq.com/',
                                    Cookie: cookie,
                                },
                                retries: 0,
                            });
                            const loc = sigResp.responseHeaders.get('location');
                            openid = sigUrl.match(/openid=([^&#]+)/)?.[1] || openid;
                            accessToken = sigUrl.match(/access_token=([^&#]+)/)?.[1] || accessToken;
                            if (openid && accessToken) break;
                            if (!loc) {
                                const text = sigResp.text();
                                openid =
                                    text.match(/openid["']?[:=]["']?([^&"'\s]+)/)?.[1] || openid;
                                accessToken =
                                    text.match(/access_token["']?[:=]["']?([^&"'\s]+)/)?.[1] ||
                                    accessToken;
                                break;
                            }
                            sigUrl = loc.startsWith('http') ? loc : new URL(loc, sigUrl).toString();
                            if (/^[a-z]+:\/\//.test(loc) && !/^https?:/.test(loc)) {
                                openid = sigUrl.match(/openid=([^&#]+)/)?.[1] || '';
                                accessToken = sigUrl.match(/access_token=([^&#]+)/)?.[1] || '';
                                break;
                            }
                        } catch {
                            break;
                        }
                    }
                }
                if (!openid || !accessToken) {
                    throw new Error(`登录成功但未获取到 openid/access_token: ${url}`);
                }
                return loginByOpenplatWithToken(ctx, p, openid, accessToken);
            }
            return { status: code, qrsig, ptqrtoken, msg };
        },
    }),

    // ── 微信扫码：生成二维码 ──
    e('login_wx_create', 'GET', '/', {
        salt: 'none',
        note: '依赖微信开放平台 appid/secret（默认内置常量，可在参数覆盖）',
        handler: async (p, ctx) => {
            const isLite = ctx.platform === 'lite';
            const appid = p.wx_appid || (isLite ? 'wx72b795aca60ad321' : 'wx79f2c4418704b4f8');
            const secret =
                p.wx_secret ||
                (isLite ? '33e486041e5e25729a4e3d2da7502f9a' : '4efcab88b700769e376e3f6087b8abc9');
            const accessTokenResp = await ctx.raw({
                url: 'https://api.weixin.qq.com/cgi-bin/token',
                query: { appid, secret, grant_type: 'client_credential' },
                retries: 0,
            });
            const accessToken = (accessTokenResp.json() ?? {}) as Record<string, any>;
            if (!accessToken.access_token) throw new Error(JSON.stringify(accessToken));
            const ticketResp = await ctx.raw({
                url: 'https://api.weixin.qq.com/cgi-bin/ticket/getticket',
                query: { access_token: accessToken.access_token, type: 2 },
                retries: 0,
            });
            const ticketData = (ticketResp.json() ?? {}) as Record<string, any>;
            if (ticketData.errcode !== 0) throw new Error(JSON.stringify(ticketData));
            const timestamp = Date.now();
            const noncestr = ctx.md5(randomString());
            const signature = sha1(
                `appid=${appid}&noncestr=${noncestr}&sdk_ticket=${ticketData.ticket}&timestamp=${timestamp}`,
            );
            const connectResp = await ctx.raw({
                url: 'https://open.weixin.qq.com/connect/sdk/qrconnect',
                query: {
                    appid,
                    noncestr,
                    timestamp: String(timestamp),
                    scope: 'snsapi_userinfo',
                    signature,
                },
                retries: 0,
            });
            const connect = (connectResp.json() ?? {}) as Record<string, any>;
            if (connect.errcode !== 0) throw new Error(JSON.stringify(connect));
            if (connect.qrcode) {
                connect.qrcode['qrcodeurl'] =
                    `https://open.weixin.qq.com/connect/confirm?uuid=${connect.uuid}`;
            }
            return connect;
        },
    }),

    // ── 微信扫码：轮询状态 ──
    e('login_wx_check', 'GET', '/', {
        salt: 'none',
        handler: async (p, ctx) => {
            const result = await ctx.raw({
                url: `https://long.open.weixin.qq.com/connect/l/qrconnect?f=json&uuid=${p.uuid || ''}`,
                retries: 0,
            });
            return result.json();
        },
    }),

    // ── register_dev（复用客户端实现） ──
    e('register_dev', 'POST', '/risk/v3/r_register_dev', {
        origin: 'https://userservice.kugou.com',
        note: '与 client.registerDevice() 等价；成功后 dfid/token 写入会话',
        handler: async (p, ctx) => ctx.client.registerDevice(p),
    }),

    // ── 人机验证信息提交（sid/edt 自动模拟） ──
    e('sidedt', 'POST', '/v4/verify_user_info', {
        origin: 'https://verifyservice.kugou.com',
        auth: true,
        note: '自动生成 sid/edt 后提交 verify_user_info（v_type 默认 23）',
        handler: async (p, ctx) => {
            const value = generateSimulate({
                mid: String(p.mid || ctx.mid || '0'),
                userid: String(p.userid || ctx.userid || '0'),
                dfid: String(p.dfid || ctx.dfid || '0'),
            });
            return ctx.callInner('verify.user.info', { ...p, edt: value.edt, sid: value.sid });
        },
    }),

    // ── 人机验证信息提交 ──
    e('verify_user_info', 'POST', '/v4/verify_user_info', {
        origin: 'https://verifyservice.kugou.com',
        note: 'v_type=23/32 时 params/pk 自动加密',
        handler: async (p, ctx) => {
            const vType = Number(p.v_type || 23);
            const userid = Number(p.userid || ctx.userid || 0);
            let dataMap: Record<string, unknown> = {
                eventid: p.eventid,
                userid,
                platid: p.platid || 2,
                v_type: vType,
                wasm: 1,
                i: '',
                sid: decodeURIComponent(String(p.sid || '')),
                edt: decodeURIComponent(String(p.edt || '')),
            };
            if (vType === 23) {
                const encrypt = ctx.aesHex({}) as { str: string; key: string };
                dataMap = {
                    ...dataMap,
                    verifycode: decodeURIComponent(String(p.verifycode || '')),
                    pk: ctx.rsaEncryptRaw({ key: encrypt.key }),
                    params: encrypt.str,
                };
            }
            if (vType === 32) {
                const encrypt = ctx.aesHex({ code: p.verifycode || '' }) as {
                    str: string;
                    key: string;
                };
                dataMap = {
                    ...dataMap,
                    code: decodeURIComponent(String(p.verifycode || '')),
                    pk: ctx.rsaEncryptRaw({ key: encrypt.key }),
                    params: encrypt.str,
                };
            }
            return ctx.request('/v4/verify_user_info', {
                method: 'POST',
                baseUrl: 'https://verifyservice.kugou.com',
                json: dataMap,
                query: { clientver: 11510 },
            });
        },
    }),

    // ── 用户人机验证状态 ──
    e('user_verify', 'GET', '/v1/user_verify', {
        router: 'trackercdngz.kugou.com',
        query: () => ({ module_id: 51 }),
    }),
];

/** QQ 令牌登录（login_qq_qr_check 成功分支复用） */
async function loginByOpenplatWithToken(
    ctx: CallCtx,
    p: CallParams,
    openid: string,
    accessToken: string,
): Promise<Record<string, any>> {
    const dateNow = Date.now();
    const encrypt = ctx.aesHex({ access_token: accessToken }) as { str: string; key: string };
    const data = await loginByOpenplat(ctx, p, {
        partnerid: 1,
        openid,
        params: encrypt.str,
        pk: ctx.rsaEncryptRaw({ clienttime_ms: dateNow, key: encrypt.key }).toUpperCase(),
        thirdAppid: ctx.platform === 'lite' ? '101706348' : '205141',
    });
    return settleLogin(ctx, data, encrypt.key);
}

/** QQ qrsig → ptqrtoken 的 hash33 */
function hash33(str: string): number {
    let e = 0;
    for (let i = 0; i < str.length; i++) {
        e += (e << 5) + str.charCodeAt(i);
    }
    return 2147483647 & e;
}

/** SHA1（微信二维码签名） */
function sha1(data: string): string {
    return createHash('sha1').update(data, 'utf8').digest('hex');
}
