/**
 * 评论 / 弹幕族（_comment 协议）。
 *
 * 统一走 `m.comment.service.kugou.com/index.php`：
 * `r` 指定路由，`code` 区分资源类型（歌曲/专辑/歌单/弹幕），
 * `key` = signParamsKey(clienttime[+mid(+data)])，不参与 android 签名。
 *
 * @module
 */

import { e, type CallCtx, type CallParams, type EndpointDef } from '../types';
import { compact, firstValue } from '../../util';

const COMMENT_HOST = 'm.comment.service.kugou.com';
const SONG_COMMENT_CODE = 'fc4be23b4e972707f36b8a828a93ba8a';
const ALBUM_COMMENT_CODE = '94f1792ced1df89aa68a7939eaf2efca';
const PLAYLIST_COMMENT_CODE = 'ca53b96fe5a1d9c22d71c8f522ef7c4f';
const SONG_BARRAGE_CODE = 'articulossong';
const VIDEO_BARRAGE_CODE = 'db3664c219a6e350b00ab08d7f723a79';

/** 评论族鉴权参数（对齐参考 getListAuthParams） */
function listAuthParams(p: CallParams, ctx: CallCtx): Record<string, unknown> {
    return {
        kugouid: ctx.userid,
        ver: firstValue(p.ver, 6) ?? 6,
        clienttoken: ctx.token,
        appid: ctx.appid,
        clientver: ctx.clientver,
        mid: ctx.mid,
        clienttime: ctx.clienttime,
        key: ctx.signParamsKey(String(ctx.clienttime)),
        uuid: ctx.uuid,
        dfid: ctx.dfid,
    };
}

/** 评论族请求（index.php + 不签名 + 清默认参数） */
function commentRequest(
    ctx: CallCtx,
    query: Record<string, unknown>,
    method: 'GET' | 'POST' = 'GET',
    data?: unknown,
): Promise<unknown> {
    return ctx.request('/index.php', {
        method,
        router: COMMENT_HOST,
        sign: false,
        clearParams: true,
        query: compact(query) as Record<string, string | number>,
        json: data,
        headers: data !== undefined ? { 'Content-Type': 'application/json; charset=UTF-8' } : {},
    });
}

function resolveCommentCode(p: CallParams): string {
    const explicitCode = firstValue(p.code);
    if (explicitCode) return String(explicitCode);
    const resourceType = String(firstValue(p.resource_type, p.resourceType, 'song')).toLowerCase();
    if (resourceType === 'album') return ALBUM_COMMENT_CODE;
    if (resourceType === 'playlist') return PLAYLIST_COMMENT_CODE;
    return SONG_COMMENT_CODE;
}

/** 从评论列表响应解析资源 id / 名称（send 类端点缺 name 时自动补查） */
function extractResolvedResource(body: unknown): { id: unknown; name: unknown } {
    const record = (body && typeof body === 'object' ? body : {}) as Record<string, any>;
    const list = Array.isArray(record.list) ? record.list : [];
    const first = list[0] || {};
    return {
        id: firstValue(record.childrenid, first.special_child_id),
        name: firstValue(first.special_child_name, first.song_show_text),
    };
}

export const commentSpecialEndpoints: EndpointDef[] = [
    // ── 歌曲弹幕列表 ──
    e('song_barrage', 'GET', '/index.php', {
        salt: 'none',
        note: 'special_id 与 hash 至少传一个',
        handler: async (p, ctx) => {
            const specialId = firstValue(p.special_id, p.childrenid, p.id);
            const hash = firstValue(p.hash, p.schash, p.extdata);
            if (!specialId && !hash) throw new Error('special_id 和 hash 至少需要传入一个');
            return commentRequest(ctx, {
                r: 'comments/getCommentWithLike',
                code: SONG_BARRAGE_CODE,
                childrenid: specialId,
                extdata: specialId ? undefined : hash,
                childrenname: firstValue(p.name, p.song_name, p.childrenname),
                mixsongid: firstValue(p.mixsongid, p.album_audio_id),
                p: firstValue(p.page, p.p, 1) ?? 1,
                pagesize: firstValue(p.pagesize, 20) ?? 20,
                ...listAuthParams(p, ctx),
            });
        },
    }),

    // ── 歌曲弹幕发送（缺 special_id 时自动按 hash 反查） ──
    e('song_barrage_send', 'POST', '/index.php', {
        salt: 'none',
        auth: true,
        handler: async (p, ctx) => {
            if (!`${p.content || ''}`.trim()) throw new Error('content 不能为空');
            let specialId = firstValue(p.special_id, p.childrenid, p.id);
            let name = firstValue(p.name, p.song_name, p.childrenname);
            if (!specialId) {
                const hash = firstValue(p.hash, p.schash, p.extdata);
                if (!hash) throw new Error('special_id 和 hash 至少需要传入一个');
                const lookup = await commentRequest(ctx, {
                    r: 'comments/getCommentWithLike',
                    code: SONG_BARRAGE_CODE,
                    childrenid: undefined,
                    extdata: hash,
                    childrenname: name,
                    mixsongid: firstValue(p.mixsongid, p.album_audio_id),
                    p: 1,
                    pagesize: 1,
                    ...listAuthParams(p, ctx),
                });
                const resolved = extractResolvedResource(lookup);
                specialId = resolved.id;
                name = name ?? resolved.name;
            }
            if (!specialId) throw new Error('无法根据 hash 解析歌曲弹幕 special_id');
            return commentRequest(
                ctx,
                {
                    r: 'comments/addcomment',
                    code: SONG_BARRAGE_CODE,
                    childrenid: specialId,
                    childrenname: name,
                    ver: firstValue(p.ver, '1.02') ?? '1.02',
                    content: p.content,
                    pid: p.pid,
                    clientver: ctx.clientver,
                    mid: ctx.mid,
                    clienttoken: ctx.token,
                    kugouid: ctx.userid,
                    appid: ctx.appid,
                },
                'POST',
            );
        },
    }),

    // ── 视频弹幕列表 ──
    e('video_barrage', 'GET', '/index.php', {
        salt: 'none',
        note: 'video_id 与 hash 至少传一个',
        handler: async (p, ctx) => {
            const videoId = firstValue(p.video_id, p.childrenid, p.id);
            const hash = firstValue(p.hash, p.mvhash, p.extdata);
            if (!videoId && !hash) throw new Error('video_id 和 hash 至少需要传入一个');
            return commentRequest(ctx, {
                r: 'comments/getCommentWithLike',
                code: VIDEO_BARRAGE_CODE,
                childrenid: videoId,
                extdata: videoId ? undefined : hash,
                childrenname: firstValue(p.name, p.video_name, p.childrenname),
                mixsongid: firstValue(p.mixsongid, p.album_audio_id),
                p: firstValue(p.page, p.p, 1) ?? 1,
                pagesize: firstValue(p.pagesize, 20) ?? 20,
                ...listAuthParams(p, ctx),
            });
        },
    }),

    // ── 视频弹幕发送（缺 video_id 时自动按 hash 反查） ──
    e('video_barrage_send', 'POST', '/index.php', {
        salt: 'none',
        auth: true,
        handler: async (p, ctx) => {
            if (!`${p.content || ''}`.trim()) throw new Error('content 不能为空');
            let videoId = firstValue(p.video_id, p.childrenid, p.id);
            let name = firstValue(p.name, p.video_name, p.childrenname);
            if (!videoId) {
                const hash = firstValue(p.hash, p.mvhash, p.extdata);
                if (!hash) throw new Error('video_id 和 hash 至少需要传入一个');
                const lookup = await commentRequest(ctx, {
                    r: 'comments/getCommentWithLike',
                    code: VIDEO_BARRAGE_CODE,
                    childrenid: undefined,
                    extdata: hash,
                    childrenname: name,
                    mixsongid: firstValue(p.mixsongid, p.album_audio_id),
                    p: 1,
                    pagesize: 1,
                    ...listAuthParams(p, ctx),
                });
                const resolved = extractResolvedResource(lookup);
                videoId = resolved.id;
                name = name ?? resolved.name;
            }
            if (!videoId) throw new Error('无法根据 hash 解析视频弹幕 video_id');
            return commentRequest(
                ctx,
                {
                    r: 'comments/addcomment',
                    code: VIDEO_BARRAGE_CODE,
                    childrenid: videoId,
                    childrenname: name,
                    ver: firstValue(p.ver, '1.02') ?? '1.02',
                    content: p.content,
                    pid: p.pid,
                    clientver: ctx.clientver,
                    mid: ctx.mid,
                    clienttoken: ctx.token,
                    kugouid: ctx.userid,
                    appid: ctx.appid,
                },
                'POST',
            );
        },
    }),

    // ── 楼层评论 ──
    e('comment_floor', 'POST', '/mcomment/v1/hot_replylist', {
        salt: 'none',
        note: '歌单/专辑楼层走 m.comment.service 域，歌曲楼层走 mcomment 域',
        handler: async (p, ctx) => {
            const resourceType = String(p.resource_type || p.resourceType || '').toLowerCase();
            const code = String(
                firstValue(p.code) ||
                    (resourceType === 'playlist'
                        ? PLAYLIST_COMMENT_CODE
                        : resourceType === 'album'
                          ? ALBUM_COMMENT_CODE
                          : SONG_COMMENT_CODE),
            );
            const useService =
                resourceType === 'playlist' ||
                resourceType === 'album' ||
                code === PLAYLIST_COMMENT_CODE ||
                code === ALBUM_COMMENT_CODE;
            const paramsMap: Record<string, unknown> = {
                childrenid: p.special_id,
                need_show_image: 1,
                p: p.page || 1,
                pagesize: p.pagesize || 30,
                show_classify: p.show_classify ?? 1,
                show_hotword_list: p.show_hotword_list ?? 1,
                code,
                tid: p.tid,
            };
            if (`${p.mixsongid ?? ''}`.trim()) paramsMap['mixsongid'] = p.mixsongid;
            return ctx.request(
                useService ? '/m.comment.service/v1/hot_replylist' : '/mcomment/v1/hot_replylist',
                {
                    method: 'POST',
                    query: paramsMap as Record<string, string | number>,
                },
            );
        },
    }),

    // ── 发送评论（歌曲，缺 special_id/name 时自动反查） ──
    e('comment_music_send', 'POST', '/index.php', {
        salt: 'none',
        auth: true,
        handler: async (p, ctx) => sendComment(p, ctx, SONG_COMMENT_CODE, 'music'),
    }),

    // ── 发送评论（专辑） ──
    e('comment_album_send', 'POST', '/index.php', {
        salt: 'none',
        auth: true,
        handler: async (p, ctx) => sendComment(p, ctx, ALBUM_COMMENT_CODE, 'album'),
    }),

    // ── 发送评论（歌单） ──
    e('comment_playlist_send', 'POST', '/index.php', {
        salt: 'none',
        auth: true,
        handler: async (p, ctx) => sendComment(p, ctx, PLAYLIST_COMMENT_CODE, 'playlist'),
    }),

    // ── 楼层评论回复 ──
    e('comment_floor_send', 'POST', '/index.php', {
        salt: 'none',
        auth: true,
        handler: async (p, ctx) => {
            if (!`${p.content || ''}`.trim()) throw new Error('content 不能为空');
            const specialId = firstValue(p.special_id, p.childrenid, p.id);
            if (!specialId) throw new Error('special_id 不能为空');
            const tid = firstValue(p.tid);
            if (!tid) throw new Error('tid 不能为空');
            const code = resolveCommentCode(p);
            let name = firstValue(
                p.name,
                p.song_name,
                p.album_name,
                p.playlist_name,
                p.childrenname,
            );
            if (!name) {
                const lookup = await ctx.callInner('comment.floor', {
                    ...p,
                    special_id: specialId,
                    code,
                    page: 1,
                    pagesize: 1,
                });
                name = extractResolvedResource(lookup).name;
            }
            const pid = firstValue(p.pid, 0) ?? 0;
            const isTopLevelReply = firstValue(p.is_t, p.isT, `${pid}` === '0' ? 1 : 0) ?? 0;
            const replyUserName = firstValue(p.reply_user_name, p.puser);
            const replyContent = firstValue(p.reply_content, p.pcontent);
            const content =
                replyUserName && replyContent && !`${p.content}`.includes('//@')
                    ? `${p.content}//@${replyUserName}:${replyContent}`
                    : p.content;
            return commentRequest(
                ctx,
                {
                    r: 'commentsv2/reply',
                    code,
                    childrenid: specialId,
                    childrenname: name,
                    kugouid: ctx.userid,
                    ver: firstValue(p.ver, 6) ?? 6,
                    clienttoken: ctx.token,
                    appid: ctx.appid,
                    clientver: ctx.clientver,
                    mid: ctx.mid,
                    clienttime: ctx.clienttime,
                    key: ctx.signParamsKey(`${ctx.clienttime}${ctx.mid}`),
                    uuid: ctx.uuid,
                    dfid: ctx.dfid,
                    extdata: p.extdata,
                    content,
                    tid: p.tid,
                    is_t: isTopLevelReply,
                    pid,
                    source: p.source,
                },
                'POST',
            );
        },
    }),

    // ── 删除评论（歌曲族，缺 special_id 时自动反查） ──
    e('comment_music_del', 'GET', '/index.php', {
        salt: 'none',
        auth: true,
        handler: async (p, ctx) => {
            const cid = firstValue(p.cid, p.comment_id);
            if (!cid) throw new Error('cid（评论 ID）不能为空，可从评论列表接口获取');
            const mixsongid = firstValue(p.mixsongid, p.album_audio_id);
            let specialId = firstValue(p.special_id, p.childrenid);
            if (!specialId && mixsongid) {
                const lookup = await ctx.callInner('comment.music', {
                    ...p,
                    mixsongid,
                    page: 1,
                    pagesize: 1,
                });
                specialId = extractResolvedResource(lookup).id;
            }
            if (!specialId)
                throw new Error('无法解析评论资源 special_id，请传入 special_id 或 mixsongid');
            return commentRequest(ctx, {
                r: 'commentsv2/delcomment',
                code: resolveCommentCode(p),
                childrenid: specialId,
                cid,
                tid: p.tid,
                kugouid: ctx.userid,
                ver: firstValue(p.ver, 6) ?? 6,
                clienttoken: ctx.token,
                appid: ctx.appid,
                clientver: ctx.clientver,
                mid: ctx.mid,
                clienttime: ctx.clienttime,
                key: ctx.signParamsKey(`${ctx.clienttime}${ctx.mid}`),
                uuid: ctx.uuid,
                dfid: ctx.dfid,
            });
        },
    }),
];

/** 发送评论共用逻辑（对齐参考 buildCommentSendConfig + send 模块的反查） */
async function sendComment(
    p: CallParams,
    ctx: CallCtx,
    code: string,
    kind: 'music' | 'album' | 'playlist',
): Promise<unknown> {
    if (!`${p.content || ''}`.trim()) throw new Error('content 不能为空');
    const mixsongid = firstValue(p.mixsongid, p.album_audio_id);
    let specialId = firstValue(p.special_id, p.childrenid, p.id);
    let name = firstValue(p.name, p.song_name, p.album_name, p.playlist_name, p.childrenname);
    if ((!specialId || !name) && mixsongid) {
        const lookupModule =
            kind === 'music'
                ? 'comment.music'
                : kind === 'album'
                  ? 'comment.album'
                  : 'comment.playlist';
        const lookup = await ctx.callInner(lookupModule, {
            ...p,
            id: specialId,
            mixsongid,
            page: 1,
            pagesize: 1,
        });
        const resolved = extractResolvedResource(lookup);
        specialId = specialId || resolved.id;
        name = name || resolved.name;
    }
    if (!specialId) throw new Error('无法解析评论资源 special_id，请传入 mixsongid 或 special_id');

    const contentData = compact({
        content: p.content,
        album_audio_id: firstValue(p.mixsongid, p.album_audio_id),
        title: p.title,
        extdata: p.content_extdata,
        images: Array.isArray(p.images) ? p.images : [],
    });
    const data = JSON.stringify({ data: contentData });
    return commentRequest(
        ctx,
        {
            r: 'commentsv3/add',
            code,
            childrenid: specialId,
            childrenname: name,
            kugouid: ctx.userid,
            ver: firstValue(p.ver, 6) ?? 6,
            clienttoken: ctx.token,
            appid: ctx.appid,
            clientver: ctx.clientver,
            mid: ctx.mid,
            clienttime: ctx.clienttime,
            key: ctx.signParamsKey(`${ctx.clienttime}${ctx.mid}${data}`),
            uuid: ctx.uuid,
            dfid: ctx.dfid,
            source: p.source,
        },
        'POST',
        data,
    );
}
