/**
 * 用户域特殊端点：等级信息、听歌上报（CSCC）、私信聊天、
 * 头像上传、偏好配置、访客、黑名单、会员批量查询。
 *
 * @module
 */

import { Buffer } from 'node:buffer';
import {
    createCipheriv,
    createDecipheriv,
    createHash,
    publicEncrypt,
    randomBytes,
    randomUUID,
    constants as cryptoConstants,
    createPublicKey,
} from 'node:crypto';
import { deflateSync } from 'node:zlib';

import { e, type CallCtx, type EndpointDef } from '../types';
import { LITE_RSA_PUBLIC_KEY } from '../../crypto';
import { md5, signature } from '../../sign';
import { isImageBuffer, normalizeBase64 } from '../../util';

const CSCC_APPKEY = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA';
const CSCC_VERSION = '10597';

export const userSpecialEndpoints: EndpointDef[] = [
    // ── /v2/get_grade_info（等级信息 / 等级同步） ──
    e('user_grade_info', 'POST', '/v2/get_grade_info', {
        origin: 'http://userinfo.user.kugou.com',
        salt: 'none',
        auth: true,
        note: '传 d_sec/diff_sec 时为等级同步上报',
        handler: async (p, ctx) => {
            const clienttime = Math.floor(Date.now() / 1000);
            const key = md5(`3116${CSCC_APPKEY}10597${clienttime}`);
            const dataMap: Record<string, unknown> = {
                mid: ctx.mid,
                type: p.type || 1,
                uuid: ctx.uuid,
                userid: ctx.userid,
            };
            const isReport = p.d_sec != null && p.diff_sec != null;
            let pParam: string;
            if (isReport) {
                const dSec = Number(p.d_sec);
                const diffSec = Number(p.diff_sec);
                const yType = p.y_type || 0;
                const mType = p.m_type || 0;
                const md5Value = md5(`${dSec}${diffSec}${yType}${mType}`);
                pParam = ctx.rsaEncryptRaw({ token: ctx.token, md5: md5Value }).toUpperCase();
                Object.assign(dataMap, {
                    d_sec: dSec,
                    diff_sec: diffSec,
                    y_type: yType,
                    m_type: mType,
                });
            } else {
                pParam = ctx
                    .rsaEncryptRaw(JSON.stringify({ clienttime, userid: ctx.userid }))
                    .toUpperCase();
            }
            dataMap['p'] = pParam;
            Object.assign(dataMap, { appid: '3116', clientver: '10597', clienttime, key });
            return ctx.request('/v2/get_grade_info', {
                method: 'POST',
                baseUrl: 'http://userinfo.user.kugou.com',
                sign: false,
                clearParams: true,
                query: { dfid: ctx.dfid },
                json: dataMap,
                headers: {
                    'Content-Type': 'text/plain; charset=ISO-8859-1',
                    'User-Agent': `Android15-1070-10597-201-0-get_user_grade_info-wifi`,
                    'KG-THash': randomHex7(),
                    'KG-Rec': '1',
                    'KG-RC': '1',
                },
            });
        },
    }),

    // ── CSCC 听歌上报（/v3/qrydid + /v2/gen + /v2/post） ──
    e('user_listen_report', 'POST', '/v2/post', {
        origin: 'http://d.kugou.com',
        salt: 'none',
        auth: true,
        note: 'CSCC 协议：设备注册 → 会话协商 → 加密上报；传 d_sec/diff_sec 时同步等级',
        handler: async (p, ctx) => {
            const uuid = String(p.uuid || ctx.uuid || '').replace(/-/g, '');
            const mid = String(p.mid || ctx.mid || '');
            const userid = String(p.userid || ctx.userid || '');
            const token = String(p.token || ctx.token || '');
            const song = String(p.mixsongid || '');
            const event = p.event;
            const state = p.state || '完整播放';
            const sync = p.d_sec != null || p.diff_sec != null;
            const deviceModel = String(
                p.device_model ?? p.dev ?? ctx.client.deviceInfo.device ?? 'KuGouMusicApi',
            );
            const systemVersion = String(p.system_version ?? '9');
            const screenWidth = p.screen_width ?? 1920;
            const screenHeight = p.screen_height ?? 1080;
            const localIp = p.local_ip ?? '0.0.0.0';
            if (!uuid || !mid || !userid || !token) {
                throw new Error('需要 token、userid、mid 和 uuid（登录后自动取会话）');
            }
            if (!song || !['start', 'end'].includes(event)) {
                throw new Error('需要有效 mixsongid 和 event=start|end');
            }

            const csccRequest = async (
                url: string,
                method: 'GET' | 'POST',
                query: Record<string, string | number>,
                data?: Uint8Array,
                kind = '',
            ) => {
                const headers: Record<string, string> = {
                    ...(method === 'POST' ? { 'Content-Type': 'application/octet-stream' } : {}),
                    ...(url !== '/v3/qrydid'
                        ? {
                              'KG-Rec': '1',
                              'User-Agent': `Android${systemVersion}-1070-${CSCC_VERSION}-18-0-Cscc${kind}-wifi`,
                          }
                        : {}),
                };
                return ctx.raw({
                    method,
                    url: `http://d.kugou.com${url}`,
                    query,
                    headers,
                    body: data,
                    retries: 0,
                });
            };

            // 设备注册（本地缓存会话，30 分钟）
            const cacheKey = md5(
                JSON.stringify([
                    uuid,
                    mid,
                    userid,
                    token,
                    deviceModel,
                    systemVersion,
                    Number(screenWidth),
                    Number(screenHeight),
                ]),
            );
            let session = csccSessions.get(cacheKey);
            if (!session || session.expires <= Date.now()) {
                session = await csccHandshake(
                    csccRequest,
                    uuid,
                    mid,
                    deviceModel,
                    Number(screenWidth),
                    Number(screenHeight),
                );
                csccSessions.set(cacheKey, session);
            }

            // 上报载荷
            const fields =
                event === 'start'
                    ? [
                          'type_id=20431',
                          'action=play',
                          'fo3=3878,4320,4326,5747,5749,7229,7289,7863',
                          'spt=0',
                          'sty=手动',
                          `mixsongid=${song}`,
                          'source=46',
                          'ivar1=1',
                          'fo=/专辑播放页',
                      ]
                    : [
                          'type_id=4',
                          'action=play',
                          'fo3=3878,4320,4326,5747,5749,7229,7289,7863',
                          `duration=${p.duration}`,
                          'svar3=0',
                          'svar2=0',
                          'fo=我的音乐/主态/自建歌单/RU',
                          'sty=手动',
                          `state=${state}`,
                          `mixsongid=${song}`,
                          'source=46',
                          'ivar3=0',
                          'type=1',
                          'fs=1.0',
                          'ivar1=1',
                      ];
            fields.push(
                `mid=${mid}`,
                `uuid=${uuid}`,
                'ss1=1',
                'ss2=1',
                `sys=${systemVersion}`,
                `mod=${deviceModel}`,
                'channelid=18',
                `ip=${localIp}`,
                'net=1',
                `ver=${CSCC_VERSION}`,
                'gitversion=7aa8a76',
                `time=${Date.now()}`,
                `userid=${userid}`,
                `ss3=${md5(randomUUID())}`,
            );
            const eventBuffer = Buffer.from(fields.join('&'), 'utf8');
            const line1 = [
                '4',
                '1',
                uuid,
                '0',
                '3116',
                CSCC_VERSION,
                '18',
                systemVersion,
                deviceModel,
                uuid,
                mid,
                '0',
                '000000000000000000000000000000000000',
            ].join('\t');
            const line2 = [
                eventBuffer.length,
                '10048',
                '0',
                Math.floor(Date.now() / 1000),
                '1',
                userid,
                '0',
                '0',
            ].join('\t');
            const plain = Buffer.concat([
                Buffer.from(`${line1}\r\n${line2}\r\n`, 'utf8'),
                deflateSync(eventBuffer),
            ]);
            const key = md5(uuid + session.clienttime + session.field2 + session.serverstr);
            const cipher = createCipheriv(
                'aes-256-cbc',
                Buffer.from(key, 'utf8'),
                Buffer.from(uuid.slice(0, 16), 'utf8'),
            );
            const encrypted = Buffer.concat([cipher.update(deflateSync(plain)), cipher.final()]);
            const query: Record<string, string> = {
                cookie: session.cookie,
                length: String(plain.length),
                appid: '3116',
                _t: String(Math.floor(Date.now() / 1000)),
            };
            const sorted = Object.keys(query)
                .sort()
                .map((k) => k + query[k])
                .join('');
            query['sign'] = createHash('md5')
                .update(Buffer.concat([Buffer.from(sorted + CSCC_APPKEY, 'utf8'), encrypted]))
                .digest('hex');
            await csccRequest('/v2/post', 'POST', query, encrypted, 'Post');

            if (!sync) return { status: 1, data: { accepted: true } };

            // 等级同步
            let gradeSynced = false;
            let grade: unknown = null;
            try {
                grade = await ctx.callInner('user.grade.info', { ...p, uuid, mid, userid, token });
                gradeSynced = true;
            } catch {
                grade = null;
            }
            return {
                status: 1,
                data: { report: { accepted: true }, grade, grade_synced: gradeSynced },
            };
        },
    }),

    // ── 私信发送（/v1/chat/send，可自动上传图片） ──
    e('user_follow_chat', 'POST', '/v1/chat/send', {
        router: 'msg.mobile.kugou.com',
        auth: true,
        note: 'msgtype=202 时可传 imgFile(base64/dataURL) 或 data(二进制) 自动走 BSS 图床',
        handler: async (p, ctx) => {
            const tag = p.tag || '';
            const tuid = Number(p.tuid || 0);
            if (!tag && !tuid) throw new Error('tuid 与 tag 至少需要传一个');
            const msgtype = Number(p.msgtype || 201);
            const message: Record<string, unknown> = {
                msgtype,
                alert: p.alert || '',
                nickname: p.nickname || '',
                source: Number(p.source || 0),
                follow_source: Number(p.follow_source || 0),
                nt: p.nt || '',
            };
            if (p.location) message['location'] = p.location;
            if (p.groupid) message['groupid'] = Number(p.groupid);
            if (msgtype === 202) {
                message['alert'] = message['alert'] || '[图片]';
                let url = p.url || '';
                if (!url) {
                    const image =
                        p.data instanceof Uint8Array
                            ? Buffer.from(p.data)
                            : normalizeBase64(String(p.imgFile ?? ''));
                    if (!image || !image.length) {
                        throw new Error(
                            '图片消息需要提供 url，或通过 data / imgFile(base64/dataURL) 传入图片',
                        );
                    }
                    url = await uploadChatImage(ctx, image, {
                        extendname: p.extendname,
                        isOriginal: !!(p.is_original || p.isOriginal),
                    });
                }
                message['url'] = url;
                if (p.width) message['width'] = Number(p.width);
                if (p.height) message['height'] = Number(p.height);
                message['isOriginal'] = !!(p.is_original || p.isOriginal);
                if (message['isOriginal'] && (p.original_size || p.originalSize)) {
                    message['originalSize'] = Number(p.original_size || p.originalSize);
                }
            } else if (msgtype === 205) {
                message['alert'] = message['alert'] || '[表情]';
                if (!p.url || !p.thumbUrl) throw new Error('表情消息需要提供 url 与 thumbUrl');
                message['url'] = String(p.url);
                message['thumbUrl'] = String(p.thumbUrl);
            } else if (msgtype === 201) {
                if (!message['alert']) throw new Error('文本消息缺少 alert 内容');
            } else {
                if (p.url) message['url'] = String(p.url);
                if (p.thumbUrl) message['thumbUrl'] = String(p.thumbUrl);
                if (p.timelen) message['timelen'] = Number(p.timelen);
                if (!message['alert'] && !message['url']) {
                    throw new Error(`msgtype=${msgtype} 需要提供 alert 或 url`);
                }
            }
            if (p.fakeid) message['fakeid'] = String(p.fakeid);
            const sourcePath = p.source_path || p.ingress || '';
            const body: Record<string, unknown> = tag ? { tag } : { tuid };
            if (sourcePath) body['ingress'] = sourcePath;
            if (p.retry) body['retry'] = 1;
            body['message'] = message;
            const data = JSON.stringify(body).split('/').join('\\/');
            return ctx.request('/v1/chat/send', {
                method: 'POST',
                router: 'msg.mobile.kugou.com',
                headers: {
                    'User-Agent': `Android15-AndroidPhone-${ctx.clientver}-201-0-ChatSend-wifi`,
                    'Content-Type': 'text/plain; charset=UTF-8',
                },
                query: {},
                json: data,
            });
        },
    }),

    // ── 头像上传（图床 + user_update 组合） ──
    e('user_update_avatar', 'POST', '/v1/profile', {
        salt: 'none',
        auth: true,
        note: 'imgFile 支持 Buffer / base64 / dataURL；上传图床后自动调 user.update 写入 photo',
        handler: async (p, ctx) => {
            const raw = p.imgFile ?? p.img ?? p.file;
            const image =
                raw instanceof Uint8Array
                    ? Buffer.from(raw)
                    : typeof raw === 'string'
                      ? normalizeBase64(raw)
                      : null;
            if (!image || !image.length || !isImageBuffer(image)) {
                throw new Error(
                    '图片数据无效（imgFile 需为 Buffer / base64 / dataURL，且为 JPEG/PNG/GIF/BMP/WEBP 格式）',
                );
            }
            const date = new Date();
            const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
            const md5Token = createHash('md5').update(`${ymd}hewry678WEK23D`).digest('hex');
            // imgphp 图床：multipart 字段名固定为 file
            const boundary = `----KuGouFormBoundary${randomHex7()}`;
            const bodyParts: Buffer[] = [];
            const field = (name: string, value: string) => {
                bodyParts.push(
                    Buffer.from(
                        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
                        'utf8',
                    ),
                );
            };
            field('type', 'kugouicon');
            field('md5', md5Token);
            bodyParts.push(
                Buffer.from(
                    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${p.filename || 'avatar.jpg'}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
                    'utf8',
                ),
            );
            bodyParts.push(image);
            bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));

            const uploadResp = await ctx.raw({
                method: 'POST',
                url: 'http://imgphp.kugou.com/imageupload/post.php',
                headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                body: Buffer.concat(bodyParts),
                retries: 0,
            });
            const uploadBody = (uploadResp.json() ?? {}) as Record<string, any>;
            const fileName = Array.isArray(uploadBody.FileName) ? uploadBody.FileName[0] : '';
            if (!uploadBody.IsSuccess || !fileName) {
                const msg =
                    (Array.isArray(uploadBody.Message) && uploadBody.Message[0]) || '图床上传失败';
                throw new Error(String(msg));
            }
            const result = await ctx.callInner<Record<string, any>>('user.update', {
                ...p,
                photo: fileName,
            });
            return {
                ...(typeof result === 'object' && result !== null ? result : {}),
                photo: fileName,
                pic: `http://c1.kgimg.com/v2/kugouicon/${fileName}`,
            };
        },
    }),

    // ── 用户偏好读取（userpreferservice） ──
    e('user_preference', 'POST', '/userpreferservice/v1/get_user_conf', {
        salt: 'none',
        auth: true,
        handler: async (p, ctx) => {
            const clienttime = Math.floor(Date.now() / 1000);
            const strG2 = randomBytes(8).toString('hex');
            const body = {
                plat: 1,
                userid: ctx.userid,
                p: ctx.rsaEncryptHex(
                    JSON.stringify({ key: strG2, clienttime: String(clienttime) }),
                ),
                params: ctx.aesHex(JSON.stringify({ token: ctx.token }), { key: strG2 }),
            };
            return ctx.request('/userpreferservice/v1/get_user_conf', {
                method: 'POST',
                sign: false,
                clearParams: true,
                query: {
                    appid: ctx.appid,
                    clientver: ctx.clientver,
                    clienttime,
                    mid: ctx.mid,
                    dfid: ctx.dfid,
                    uuid: ctx.uuid,
                },
                json: body,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': `Android15-1070-${ctx.clientver}-201-0-get_user_conf-wifi`,
                    'KG-Rec': '1',
                    'KG-RC': '1',
                },
            });
        },
    }),

    // ── 用户偏好更新 ──
    e('user_preference_update', 'POST', '/userpreferservice/v1/update_user_conf', {
        salt: 'none',
        auth: true,
        handler: async (p, ctx) => {
            const clienttime = Math.floor(Date.now() / 1000);
            const dataFields = [
                'mode',
                'gender',
                'age',
                'lang',
                'style',
                'song_lang',
                'stylerec_taglist',
                'wish_taglist',
                'inactive_taglist',
                'inactive_singerlist',
            ];
            const hasData = dataFields.some((k) => p[k] != null);
            if (!hasData) throw new Error('至少需要提供 gender/age/lang/style 等偏好字段之一');
            const strG2 = randomBytes(8).toString('hex');
            const data: Record<string, string> = {};
            for (const k of dataFields) {
                if (p[k] != null) {
                    data[k] = typeof p[k] === 'object' ? JSON.stringify(p[k]) : String(p[k]);
                }
            }
            const body = {
                plat: 1,
                userid: ctx.userid,
                p: ctx.rsaEncryptHex(
                    JSON.stringify({ key: strG2, clienttime: String(clienttime) }),
                ),
                data,
                params: ctx.aesHex(JSON.stringify({ token: ctx.token }), { key: strG2 }),
            };
            return ctx.request('/userpreferservice/v1/update_user_conf', {
                method: 'POST',
                sign: false,
                clearParams: true,
                query: {
                    appid: ctx.appid,
                    clientver: ctx.clientver,
                    clienttime,
                    mid: ctx.mid,
                    dfid: ctx.dfid,
                    uuid: ctx.uuid,
                },
                json: body,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': `Android15-1070-${ctx.clientver}-201-0-update_user_conf-wifi`,
                    'KG-Rec': '1',
                    'KG-RC': '1',
                },
            });
        },
    }),

    // ── 访客列表（无填充 RSA + 自签名） ──
    e('user_visitors', 'POST', '/v2/get_visitors', {
        origin: 'http://usercenter.kugou.com',
        salt: 'none',
        auth: true,
        handler: async (p, ctx) => {
            const appidUsed = Number(p.appid || ctx.appid);
            const clientverUsed = Number(p.clientver || (appidUsed === 3116 ? 10672 : 20809));
            const tUserid = Number(p.t_userid || p.visit_userid || ctx.userid);
            const clienttime = Math.floor(Date.now() / 1000);
            const pPlain = `{"clienttime":${clienttime},"token":"${ctx.token}","t_userid":${tUserid}}`;
            const buf = Buffer.alloc(128);
            buf.write(pPlain, 0);
            const pParam = publicEncrypt(
                {
                    key: createPublicKey(LITE_RSA_PUBLIC_KEY),
                    padding: cryptoConstants.RSA_NO_PADDING,
                },
                buf,
            )
                .toString('hex')
                .toUpperCase();
            const data: Record<string, unknown> = {
                userid: ctx.userid,
                t_userid: tUserid,
                p: pParam,
                page: Number(p.page || 1),
            };
            if (p.busi_type) data['busi_type'] = p.busi_type;
            const query: Record<string, string> = {
                dfid: ctx.dfid,
                plat: '1',
                clienttime: String(clienttime),
                mid: ctx.mid,
                uuid: ctx.uuid,
                clientver: String(clientverUsed),
                appid: String(appidUsed),
            };
            const salt =
                appidUsed === 3116
                    ? 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA'
                    : 'OIlwieks28dk2k092lksi2UIkp';
            const s = Object.keys(query)
                .sort()
                .map((k) => `${k}=${query[k]}`)
                .join('');
            query['signature'] = md5(`${salt}${s}${JSON.stringify(data)}${salt}`);
            return ctx.request('/v2/get_visitors', {
                method: 'POST',
                baseUrl: 'http://usercenter.kugou.com',
                sign: false,
                clearParams: true,
                query,
                json: data,
                headers: {
                    'Content-Type': 'text/plain; charset=ISO-8859-1',
                    'User-Agent': `Android15-1070-${clientverUsed}-201-0-User-wifi`,
                    'KG-RC': '1',
                    'KG-Rec': '1',
                    'KG-THash': '3980f3c',
                    ...(p.kg_devid ? { 'KG-DEVID': String(p.kg_devid) } : {}),
                    ...(p.kg_clienttimems ? { 'KG-CLIENTTIMEMS': String(p.kg_clienttimems) } : {}),
                },
            });
        },
    }),

    // ── 黑名单编辑 ──
    e('blacklist', 'POST', '/v1/edit_list_items', {
        origin: 'https://relationuser.kugou.com',
        auth: true,
        note: 'items 为 "k|v" 对象数组；缺省时按 hash/singerid 自动构造',
        handler: async (p, ctx) => {
            const label = p.label === 'singer' ? 'singer' : 'song';
            const clienttime = Math.floor(Date.now() / 1000);
            const timestamp = String(clienttime);
            let items = p.items;
            if (typeof items === 'string') {
                try {
                    items = JSON.parse(items);
                } catch {
                    items = undefined;
                }
            }
            if (!Array.isArray(items) || items.length === 0) {
                if (label === 'song') {
                    items = [
                        {
                            k: String(p.hash || '').toLowerCase(),
                            v: JSON.stringify({
                                n: p.name || '',
                                m: String(p.mixsongid || ''),
                                t: timestamp,
                            }),
                        },
                    ];
                } else {
                    items = [
                        {
                            k: String(p.singerid || ''),
                            v: JSON.stringify({ n: p.name || '', t: timestamp }),
                        },
                    ];
                }
            }
            return ctx.request('/v1/edit_list_items', {
                method: 'POST',
                baseUrl: 'https://relationuser.kugou.com',
                json: {
                    userid: ctx.userid,
                    source: Number(p.source || (label === 'song' ? 3 : 4)),
                    label,
                    items,
                    action: p.isDelete ? 'delete' : 'add',
                    p: ctx.rsaEncryptRaw(JSON.stringify({ clienttime, token: ctx.token })),
                },
                headers: { 'KG-TID': String(p.moduleId || 473) },
            });
        },
    }),

    // ── 概念版会员产品批量查询 ──
    e('user_batch_union_vipinfo', 'POST', '/v2/batch_union_vipinfo', {
        origin: 'https://kugouvip.kugou.com',
        auth: true,
        note: 'userids 最多 20 个（自动去重）',
        query: (p) => {
            const list = Array.isArray(p.useridlist)
                ? p.useridlist
                : typeof p.useridlist === 'string'
                  ? p.useridlist.split(/[,\s]+/)
                  : (p.userids ?? p.userid_list ?? []);
            const ids: number[] = [];
            const seen = new Set<string>();
            for (const item of list) {
                const id = Number(item);
                if (!Number.isFinite(id) || id <= 0) continue;
                const key = String(id);
                if (seen.has(key)) continue;
                seen.add(key);
                ids.push(id);
                if (ids.length >= 20) break;
            }
            return { userids: ids.join(',') };
        },
    }),
];

// ─────────────────────────────────────────────────────────────
// CSCC 会话缓存
// ─────────────────────────────────────────────────────────────

interface CsccSession {
    cookie: string;
    clienttime: string;
    serverstr: string;
    field2: string;
    expires: number;
}

const csccSessions = new Map<string, CsccSession>();

type CsccRequestFn = (
    url: string,
    method: 'GET' | 'POST',
    query: Record<string, string | number>,
    data?: Uint8Array,
    kind?: string,
) => Promise<{ json(): unknown; text(): string; status: number; ok: boolean }>;

/** CSCC 握手：qrydid（设备注册）→ gen（会话协商） */
async function csccHandshake(
    request: CsccRequestFn,
    uuid: string,
    mid: string,
    deviceModel: string,
    screenWidth: number,
    screenHeight: number,
): Promise<CsccSession> {
    let t = String(Math.floor(Date.now() / 1000));
    const deviceData = JSON.stringify({
        machine: deviceModel,
        mid,
        uuid,
        wh: [screenWidth, screenHeight],
    });
    const device = await request(
        '/v3/qrydid',
        'POST',
        {
            appid: 'and02',
            _t: t,
            sign: md5(`_t${t}appidand02pbKC7zn{4U*ydo2M1Rir${deviceData}`),
        },
        Buffer.from(deviceData, 'utf8'),
        'Gen',
    );
    const deviceBody = (device.json() ?? {}) as Record<string, any>;
    const deviceid = deviceBody?.data?.deviceid;
    if (!deviceid) throw new Error('CSCC 未返回 deviceid');
    const field2 = randomBytes(16).toString('hex');
    const s = publicEncrypt(
        { key: createPublicKey(LITE_RSA_PUBLIC_KEY), padding: cryptoConstants.RSA_PKCS1_PADDING },
        Buffer.from(`${uuid}\t${field2}\t${Date.now()}\t${deviceid}`),
    ).toString('base64');
    t = String(Math.floor(Date.now() / 1000));
    const genResp = await request(
        '/v2/gen',
        'GET',
        {
            s,
            appid: '3116',
            _t: t,
            sign: md5(`_t${t}appid3116s${s}${CSCC_APPKEY}`),
        },
        undefined,
        'Gen',
    );
    const genBody = (genResp.json() ?? {}) as Record<string, any>;
    const decipher = createDecipheriv(
        'aes-256-cbc',
        Buffer.from(field2, 'utf8'),
        Buffer.from(uuid.slice(0, 16), 'utf8'),
    );
    const session = JSON.parse(
        Buffer.concat([
            decipher.update(Buffer.from(genBody.data, 'base64')),
            decipher.final(),
        ]).toString(),
    ) as { cookie: string; clienttime: string; serverstr: string };
    if (!session.cookie || session.clienttime == null || !session.serverstr) {
        throw new Error('CSCC 会话响应无效');
    }
    return { ...session, field2, expires: Date.now() + 30 * 60 * 1000 };
}

/** 私信图片 BSS 上传 */
async function uploadChatImage(
    ctx: CallCtx,
    image: Buffer,
    opts: { extendname?: unknown; isOriginal?: boolean },
): Promise<string> {
    const extendname = String(opts.extendname || 'jpg').replace(/^\./, '');
    const appidUsed = ctx.appid;
    const clientverUsed = ctx.clientver;
    const authParams: Record<string, unknown> = {
        bucket: 'imagemsg',
        filename: '',
        method: 'POST',
        loginType: ctx.token ? 1 : 0,
        buVerifyCode: ctx.md5(`${appidUsed}imagemsgb8a37aa141c842f9`),
        extranet: 1,
        userid: ctx.userid,
        token: ctx.token,
        version: clientverUsed,
        dfid: ctx.dfid,
        mid: ctx.mid,
        uuid: ctx.uuid,
        appid: appidUsed,
        clientver: clientverUsed,
        clienttime: Math.floor(Date.now() / 1000),
    };
    const signedQuery = { ...authParams } as Record<string, string | number>;
    signedQuery['signature'] = signature(signedQuery, {
        kind: 'android',
        platform: ctx.platform,
        data: '',
    });
    const authResp = await ctx.raw({
        method: 'GET',
        url: 'https://encounter.kugou.com/v1/upload/auth',
        query: signedQuery,
        headers: { 'x-router': 'bsstrackercdngz.kugou.com', Host: 'gateway.kugou.com' },
        retries: 0,
    });
    const authData = (authResp.json() ?? {}) as Record<string, any>;
    const authorization = authData?.data?.authorization;
    if (!authorization) throw new Error(`获取上传授权失败: ${JSON.stringify(authData)}`);
    const uploadParams: Record<string, unknown> = {
        bucket: 'imagemsg',
        authorization,
        extendname,
        userid: ctx.userid,
        token: ctx.token,
        dfid: ctx.dfid,
        mid: ctx.mid,
        appid: appidUsed,
        clientver: clientverUsed,
        body_empty: 1,
    };
    const signedUpload = { ...uploadParams } as Record<string, string | number>;
    signedUpload['signature'] = signature(signedUpload, {
        kind: 'android',
        platform: ctx.platform,
        data: '',
    });
    const uploadResp = await ctx.raw({
        method: 'POST',
        url: 'https://bssul.service.kugou.com/v3/upload',
        query: signedUpload,
        headers: {
            Authorization: authorization,
            'Content-Type': 'application/octet-stream',
            'User-Agent': `Android15-AndroidPhone-${clientverUsed}-201-0-UploadImageChatMsg-wifi`,
        },
        body: image,
        retries: 0,
    });
    const uploadData = (uploadResp.json() ?? {}) as Record<string, any>;
    if (uploadData?.status !== 1 || !uploadData?.data?.['x-bss-filename']) {
        throw new Error(`图片上传失败: ${JSON.stringify(uploadData)}`);
    }
    const bucketName = uploadData.data['x-bss-bucket'];
    const bssFilename = uploadData.data['x-bss-filename'];
    const host = opts.isOriginal ? 'bssdlbig.kugou.com' : 'bssdl.kugou.com';
    return `http://${bucketName}.${host}/${bssFilename}`;
}

function randomHex7(): string {
    return randomBytes(4).toString('hex').slice(0, 7);
}
