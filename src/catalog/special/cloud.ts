/**
 * 加密 POST 族（mv_collect / playlist_del / user_cloud*）与
 * cloudlist 协议（playlist_pic / sort / tracks_sort / update）。
 *
 * 两族协议：
 * - 加密 POST：sessionCipher 加密 body，`p` = RSA({aes,uid,token})，
 *   `key` = signParamsKey(clienttime)，响应为同 key 密文
 * - cloudlist：`p` = RSA({aes,uid,token})，`key` = md5(appid+盐+clientver+clienttime)，
 *   请求/响应均为 AES-CBC（md5(aes) 派生 key/iv）
 *
 * @module
 */

import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';

import { e, type CallCtx, type EndpointDef } from '../types';
import { cloudKey, md5, signature } from '../../sign';
import { randomString, randomThash } from '../../crypto';
import { splitList } from '../../util';

interface EncryptedPostOptions {
    url: string;
    origin?: string;
    data: unknown;
    /** 额外查询参数（覆盖默认） */
    extraQuery?: Record<string, unknown>;
    /** body 传输形态：二进制（Buffer.from(base64)）或 base64 文本 */
    bodyBinary?: boolean;
    headers?: Record<string, string>;
    noMid?: boolean;
    clearParams?: boolean;
}

/** 加密 POST 族共用管线（对齐参考实现 playlistAesEncrypt + rsaEncrypt2） */
async function encryptedPost(ctx: CallCtx, options: EncryptedPostOptions): Promise<unknown> {
    const { body, key } = ctx.sessionCipher(options.data);
    const p = ctx.rsaEncryptHex({ aes: key, uid: ctx.userid, token: ctx.token }).toUpperCase();
    const query: Record<string, unknown> = {
        clienttime: ctx.clienttime,
        ...(options.noMid ? {} : { mid: ctx.mid }),
        key: ctx.signParamsKey(String(ctx.clienttime)),
        clientver: ctx.clientver,
        appid: ctx.appid,
        p,
        ...options.extraQuery,
    };
    const result = await ctx.raw({
        method: 'POST',
        url: `${options.origin ?? 'https://gateway.kugou.com'}${options.url}`,
        query: query as Record<string, string | number>,
        headers: { 'Content-Type': 'application/json', ...options.headers },
        body: options.bodyBinary === false ? body : Buffer.from(body, 'base64'),
        retries: 0,
    });
    if (!result.ok) {
        throw new Error(`HTTP ${result.status}: ${options.url}`);
    }
    const payload = Buffer.from(result.bytes).toString('base64');
    try {
        return ctx.sessionCipherDecrypt(payload, key);
    } catch {
        return result.json();
    }
}

/** cloudlist 协议共用管线（对齐参考 createCloudRequest） */
async function cloudRequest(ctx: CallCtx, url: string, data: unknown): Promise<unknown> {
    const conf =
        ctx.platform === 'lite'
            ? { appid: 3116, clientver: 11440, appkey: 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA' }
            : { appid: 1005, clientver: 20489, appkey: 'OIlwieks28dk2k092lksi2UIkp' };
    const clienttime = Math.floor(Date.now() / 1000);
    const aes = randomString(6).toLowerCase();
    const digest = md5(aes);
    const aesKey = digest.slice(0, 16);
    const aesIv = digest.slice(16, 32);
    const key = md5(`${conf.appid}${conf.appkey}${conf.clientver}${clienttime}`).toLowerCase();
    const p = ctx.rsaEncryptHex({ aes, uid: ctx.userid, token: ctx.token }).toUpperCase();
    const body = Buffer.from(JSON.stringify(data ?? {}), 'utf8');
    // AES-CBC 加密请求体
    const cipher = createCipheriv(
        'aes-128-cbc',
        Buffer.from(aesKey, 'utf8'),
        Buffer.from(aesIv, 'utf8'),
    );
    const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);

    const result = await ctx.raw({
        method: 'POST',
        url: `https://gateway.kugou.com${url}`,
        query: {
            appid: conf.appid,
            clientver: conf.clientver,
            mid: ctx.mid,
            clienttime,
            key,
            dfid: ctx.dfid,
            p,
        },
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'x-router': 'cloudlist.service.kugou.com',
            dfid: ctx.dfid,
            clienttime: String(clienttime),
            mid: ctx.mid,
            'kg-rc': '1',
            'kg-thash': '5d816a0',
            'kg-rec': '1',
        },
        body: encrypted,
        retries: 0,
    });
    if (!result.ok) {
        throw new Error(`HTTP ${result.status}: ${url}`);
    }
    const raw = Buffer.from(result.bytes);
    let text = '';
    try {
        const decipher = createDecipheriv(
            'aes-128-cbc',
            Buffer.from(aesKey, 'utf8'),
            Buffer.from(aesIv, 'utf8'),
        );
        text = Buffer.concat([decipher.update(raw), decipher.final()]).toString('utf8');
    } catch {
        text = '';
    }
    if (!text) text = raw.toString('utf8');
    try {
        return JSON.parse(text) as unknown;
    } catch {
        throw new Error(text.slice(0, 200));
    }
}

/** "a|b,c|d" → 对象数组（cloudlist 族通用入参格式） */
function parsePipeList(value: unknown, fields: string[]): Record<string, string>[] {
    return splitList(value).map((item) => {
        const parts = item.split('|');
        const row: Record<string, string> = {};
        fields.forEach((f, i) => {
            row[f] = parts[i] ?? '';
        });
        return row;
    });
}

export const cloudSpecialEndpoints: EndpointDef[] = [
    // ── /v1/collect（收藏 MV，加密 POST） ──
    e('mv_collect', 'POST', '/v1/collect', {
        origin: 'https://collectservice.kugou.com',
        salt: 'none',
        auth: true,
        handler: async (p, ctx) =>
            encryptedPost(ctx, {
                url: '/v1/collect',
                origin: 'https://collectservice.kugou.com',
                data: { ctype: 2, data: [{ obj_id: Number(p.id) }] },
                headers: {
                    'User-Agent': 'Android9-1070-18-0-MV/Care-wifi',
                    'KG-THash': String(randomThash()),
                },
            }),
    }),

    // ── /v1/cancel_collect（取消收藏 MV，加密 POST） ──
    e('mv_collect_del', 'POST', '/v1/cancel_collect', {
        origin: 'https://collectservice.kugou.com',
        salt: 'none',
        auth: true,
        handler: async (p, ctx) =>
            encryptedPost(ctx, {
                url: '/v1/cancel_collect',
                origin: 'https://collectservice.kugou.com',
                data: { ctype: 2, data: [{ obj_id: Number(p.id) }] },
                headers: {
                    'User-Agent': 'Android9-1070-18-0-MV/UnCare-wifi',
                    'KG-THash': String(randomThash()),
                },
            }),
    }),

    // ── /v2/delete_list（删除歌单，加密 POST） ──
    e('playlist_del', 'POST', '/v2/delete_list', {
        router: 'cloudlist.service.kugou.com',
        salt: 'none',
        auth: true,
        handler: async (p, ctx) =>
            encryptedPost(ctx, {
                url: '/v2/delete_list',
                data: { listid: Number(p.listid), total_ver: 0, type: 1 },
                extraQuery: { last_area: 'gztx', last_time: ctx.clienttime },
            }),
    }),

    // ── /cloudlist.service/v5/add_list（新建歌单） ──
    e('playlist_add', 'POST', '/cloudlist.service/v5/add_list', {
        salt: 'none',
        auth: true,
        note: 'type=0 时附加 last_time/last_area/userid/token 查询参数',
        handler: async (p, ctx) => {
            const type = p.type || 0;
            const body: Record<string, unknown> = {
                userid: ctx.userid,
                token: ctx.token,
                total_ver: 0,
                name: p.name,
                type,
                source: p.source === 0 ? 0 : p.source || 1,
                is_pri: type === 0 ? p.is_pri || 0 : 0,
                list_create_userid: p.list_create_userid,
                list_create_listid: p.list_create_listid,
                list_create_gid: p.list_create_gid || '',
                from_shupinmv: 0,
            };
            return ctx.request('/cloudlist.service/v5/add_list', {
                method: 'POST',
                json: body,
                query:
                    type === 0
                        ? {
                              last_time: ctx.clienttime,
                              last_area: 'gztx',
                              userid: ctx.userid,
                              token: ctx.token,
                          }
                        : {},
            });
        },
    }),

    // ── /cloudlist.service/v6/add_song（歌单加歌） ──
    e('playlist_tracks_add', 'POST', '/cloudlist.service/v6/add_song', {
        salt: 'none',
        auth: true,
        note: 'data 格式 "name|hash|album_id|mixsongid,..."',
        handler: async (p, ctx) => {
            const resource = String(p.data || '')
                .split(',')
                .map((s) => {
                    const parts = s.split('|');
                    return {
                        number: 1,
                        name: parts[0] || '',
                        hash: parts[1] || '',
                        size: 0,
                        sort: 0,
                        timelen: 0,
                        bitrate: 0,
                        album_id: Number(parts[2] || 0),
                        mixsongid: Number(parts[3] || 0),
                    };
                });
            return ctx.request('/cloudlist.service/v6/add_song', {
                method: 'POST',
                json: {
                    userid: ctx.userid,
                    token: ctx.token,
                    listid: p.listid,
                    list_ver: 0,
                    type: 0,
                    slow_upload: 1,
                    scene: 'false;null',
                    data: resource,
                },
                query: {
                    last_time: ctx.clienttime,
                    last_area: 'gztx',
                    userid: ctx.userid,
                    token: ctx.token,
                },
            });
        },
    }),

    // ── /v1/modify_list_pic（歌单封面，cloudlist 协议） ──
    e('playlist_pic', 'POST', '/v1/modify_list_pic', {
        salt: 'none',
        auth: true,
        note: 'data 格式 "listid|type|pic,...（pic 自动补 stdmusic/ 前缀）"',
        handler: async (p, ctx) => {
            const resource = String(p.data || '')
                .split(',')
                .map((s) => {
                    const [listid, type, pic] = s.split('|');
                    const cover = !String(pic || '').startsWith('stdmusic/')
                        ? `stdmusic/${String(pic).split('/').pop()}`
                        : pic;
                    return { listid: Number(listid), type: Number(type || 0), pic: cover };
                });
            return cloudRequest(ctx, '/v1/modify_list_pic', {
                total_ver: Number(p.total_ver || 0),
                data: resource,
            });
        },
    }),

    // ── /v1/modify_list_sort（歌单排序，cloudlist 协议） ──
    e('playlist_sort', 'POST', '/v1/modify_list_sort', {
        salt: 'none',
        auth: true,
        note: 'data 格式 "listid|type|sort,..."',
        handler: async (p, ctx) =>
            cloudRequest(ctx, '/v1/modify_list_sort', {
                total_ver: Number(p.total_ver || 0),
                data: parsePipeList(p.data, ['listid', 'type', 'sort']).map((r) => ({
                    listid: Number(r.listid),
                    type: Number(r.type || 0),
                    sort: Number(r.sort || 0),
                })),
            }),
    }),

    // ── /v1/modify_song_sort（歌单曲目排序，cloudlist 协议） ──
    e('playlist_tracks_sort', 'POST', '/v1/modify_song_sort', {
        salt: 'none',
        auth: true,
        note: 'data 格式 "fileid|sort,..."',
        handler: async (p, ctx) =>
            cloudRequest(ctx, '/v1/modify_song_sort', {
                listid: Number(p.listid),
                list_ver: Number(p.list_ver || 0),
                type: Number(p.type || 0),
                data: parsePipeList(p.data, ['fileid', 'sort']).map((r) => ({
                    fileid: Number(r.fileid),
                    sort: Number(r.sort || 0),
                })),
            }),
    }),

    // ── /v1/modify_list（编辑歌单，cloudlist 协议） ──
    e('playlist_update', 'POST', '/v1/modify_list', {
        salt: 'none',
        auth: true,
        handler: async (p, ctx) =>
            cloudRequest(ctx, '/v1/modify_list', {
                total_ver: Number(p.total_ver || 0),
                listid: Number(p.listid),
                type: Number(p.type || 0),
                sort: Number(p.sort || 0),
                tags: p.tags || '',
                intro: p.intro || '',
                ...(p.name ? { name: p.name } : {}),
                ...(p.pic ? { pic: p.pic } : {}),
            }),
    }),

    // ── /v1/get_list（云盘列表，加密 POST） ──
    e('user_cloud', 'POST', '/v1/get_list', {
        origin: 'https://mcloudservice.kugou.com',
        salt: 'none',
        auth: true,
        handler: async (p, ctx) =>
            encryptedPost(ctx, {
                url: '/v1/get_list',
                origin: 'https://mcloudservice.kugou.com',
                data: { page: p.page ?? 1, pagesize: p.pagesize ?? 30, getkmr: 1 },
            }),
    }),

    // ── /v1/del_files（云盘删除，加密 POST） ──
    e('user_cloud_del', 'POST', '/v1/del_files', {
        origin: 'https://mcloudservice.kugou.com',
        salt: 'none',
        auth: true,
        handler: async (p, ctx) => {
            const fileids = splitList(p.fileids || p.fileid || p.kv_ids || p.kv_id);
            const albumAudioIds = splitList(p.album_audio_ids || p.album_audio_id);
            if (!fileids.length) throw new Error('请传入 fileid 或 kv_id');
            return encryptedPost(ctx, {
                url: '/v1/del_files',
                origin: 'https://mcloudservice.kugou.com',
                data: {
                    data: fileids.map((id, index) => ({
                        kv_id: Number(id) || id,
                        album_audio_id: Number(
                            albumAudioIds[index] || albumAudioIds[0] || p.mixid || p.mix_id || 0,
                        ),
                    })),
                },
            });
        },
    }),

    // ── /v2/album_audio/audio（云盘匹配） ──
    e('user_cloud_match', 'POST', '/v2/album_audio/audio', {
        origin: 'http://kmr.service.kugou.com',
        router: 'kmr.service.kugou.com',
        salt: 'none',
        headers: { 'Content-Type': 'application/json' },
        note: '返回体附加 match / match_list 归一化字段',
        handler: async (p, ctx) => {
            const hashes = splitList(p.hash || p.filename);
            if (!hashes.length && p.data?.length) {
                hashes.push(fileMd5(p.data as Uint8Array));
            }
            if (!hashes.length) throw new Error('请传入 hash');
            const albumAudioIds = splitList(
                p.album_audio_ids || p.album_audio_id || p.mixid || p.mix_id,
            );
            const data = await ctx.request<any[]>('/v2/album_audio/audio', {
                baseUrl: 'http://kmr.service.kugou.com',
                router: 'kmr.service.kugou.com',
                headers: { 'Content-Type': 'application/json' },
                sign: false,
                clearParams: true,
                json: {
                    appid: ctx.appid,
                    clienttime: ctx.clienttime,
                    clientver: ctx.clientver,
                    data: hashes.map((hash, index) => {
                        const item: Record<string, unknown> = { hash: String(hash).toLowerCase() };
                        const albumAudioId = albumAudioIds[index] || albumAudioIds[0];
                        if (Number(albumAudioId) > 0) item['album_audio_id'] = String(albumAudioId);
                        return item;
                    }),
                    dfid: ctx.dfid,
                    key: ctx.signParamsKey(String(ctx.clienttime)),
                    mid: ctx.mid,
                    show_privilege: 0,
                    show_author_alias: 0,
                    show_rel_album_audio_info: 0,
                    show_remarks: 0,
                },
            });
            const list = Array.isArray(data) ? data : [];
            const matchList = list
                .map((item) => normalizeMatch(Array.isArray(item) ? item[0] : item))
                .filter(Boolean);
            return { data: list, match_list: matchList, match: matchList[0] ?? null };
        },
    }),

    // ── /bsstrackercdngz/v2/query_musicclound_url（云盘播放地址） ──
    e('user_cloud_url', 'GET', '/bsstrackercdngz/v2/query_musicclound_url', {
        auth: true,
        query: (p) => {
            const hash = String(p.hash).toLocaleLowerCase();
            return {
                hash,
                ssa_flag: 'is_fromtrack',
                version: '20102',
                ssl: 0,
                album_audio_id: p.album_audio_id ?? 0,
                pid: 20026,
                audio_id: p.audio_id ?? 0,
                kv_id: 2,
                key: cloudKey(hash, 20026),
                bucket: 'musicclound',
                name: p.name ?? '',
                with_res_tag: 0,
            };
        },
    }),

    // ── /v1/add_files（云盘上传，BSS 分片 + 加密 POST 登记） ──
    e('user_cloud_upload', 'POST', '/v1/add_files', {
        origin: 'https://mcloudservice.kugou.com',
        salt: 'none',
        auth: true,
        note: 'p.data 传文件二进制（Uint8Array/Buffer）；可先自动走 user.cloud.match 匹配元数据',
        handler: async (p, ctx) => {
            const fileData = p.data instanceof Uint8Array ? p.data : Buffer.alloc(0);
            if (!fileData.length) throw new Error('请通过 params.data 传入文件二进制数据');
            const filename = String(p.filename || fileMd5(fileData)).toLowerCase();
            const extendname = String(p.extendname || 'mp3').replace(/^\./, '');
            const bucket = 'musicclound';

            let matchInfo: ReturnType<typeof normalizeMatch> = null;
            const needMatch =
                (p.auto_match === undefined ||
                    p.auto_match === true ||
                    String(p.auto_match) === 'true') &&
                !(p.hash_std && p.audio_id && (p.album_audio_id || p.mixid || p.mix_id));
            if (needMatch) {
                try {
                    const matchRes = await ctx.callInner<Record<string, any>>('user.cloud.match', {
                        ...p,
                        data: undefined,
                        hash: filename,
                    });
                    if (matchRes?.match) matchInfo = matchRes.match;
                } catch {
                    // 匹配失败不阻断上传
                }
            }
            const hashStd = String(p.hash_std || matchInfo?.hash_std || filename).toLowerCase();
            const audioId = Number(p.audio_id || matchInfo?.audio_id) || 0;
            const albumAudioId =
                Number(p.album_audio_id || p.mixid || p.mix_id || matchInfo?.album_audio_id) || 0;
            const authorName = p.author_name || matchInfo?.author_name || '';
            const trackName = p.track_name || p.songname || matchInfo?.audio_name || filename;
            const name =
                p.name || `${authorName ? `${authorName} - ` : ''}${trackName}.${extendname}`;

            // BSS 授权 → 初始化 → 分片上传 → 完成
            const authParams: Record<string, unknown> = {
                bucket,
                filename,
                method: 'POST',
                loginType: ctx.token && ctx.userid !== 0 ? 1 : 0,
                buVerifyCode: ctx.md5(`${ctx.appid}${bucket}8ae10344e9738dcb`),
                extranet: 1,
                userid: ctx.userid,
                token: ctx.token,
                version: ctx.clientver,
                dfid: ctx.dfid,
                mid: ctx.mid,
                uuid: ctx.uuid,
                appid: ctx.appid,
                clientver: ctx.clientver,
                clienttime: ctx.clienttime,
            };
            const authRes = await bssRequest(ctx, '/bsstrackercdngz/v1/upload/auth', {
                method: 'GET',
                query: authParams,
            });
            const authorization = authRes?.data?.data?.authorization;
            if (!authorization) throw new Error(JSON.stringify(authRes?.data) || '获取授权失败');

            const initParams: Record<string, unknown> = {
                bucket,
                filename,
                ssl: 1,
                extendname,
                version: ctx.clientver,
                userid: ctx.userid,
                token: ctx.token,
                authorization,
                dfid: ctx.dfid,
                mid: ctx.mid,
                uuid: ctx.uuid,
                appid: ctx.appid,
                clientver: ctx.clientver,
                clienttime: ctx.clienttime,
            };
            const initRes = await bssRequest(
                ctx,
                'http://bssulbig.kugou.com/v2/multipart/initiate/music',
                {
                    method: 'POST',
                    query: initParams,
                    headers: { Authorization: authorization },
                },
            );
            const initData = initRes?.data?.data || {};
            const { external_host, upload_id } = initData;
            let bssFileHash: string = initData['x-bss-filename'] || filename;
            if (upload_id) {
                if (!external_host)
                    throw new Error(JSON.stringify(initRes?.data) || '初始化上传失败');
                const partSize = 1024 * 1024;
                const partCount = Math.max(1, Math.ceil(fileData.length / partSize));
                for (let i = 0; i < partCount; i++) {
                    const part = fileData.slice(i * partSize, (i + 1) * partSize);
                    const uploadRes = await bssRequest(
                        ctx,
                        `${withProtocol(external_host)}/v3/multipart/upload`,
                        {
                            method: 'POST',
                            query: {
                                bucket,
                                authorization,
                                filename,
                                partnumber: i + 1,
                                upload_id,
                                body_empty: 1,
                                version: ctx.clientver,
                                userid: ctx.userid,
                                token: ctx.token,
                                dfid: ctx.dfid,
                                mid: ctx.mid,
                                uuid: ctx.uuid,
                                appid: ctx.appid,
                                clientver: ctx.clientver,
                                clienttime: ctx.clienttime,
                            },
                            headers: {
                                Authorization: authorization,
                                'Content-Type': 'application/octet-stream',
                            },
                            body: part,
                        },
                    );
                    if (uploadRes?.data?.status !== 1)
                        throw new Error(JSON.stringify(uploadRes?.data) || '分片上传失败');
                }
                const completeRes = await bssRequest(
                    ctx,
                    `${withProtocol(external_host)}/v3/multipart/complete`,
                    {
                        method: 'POST',
                        query: {
                            bucket,
                            authorization,
                            filename,
                            partnumber: partCount,
                            upload_id,
                            md5: filename,
                            version: ctx.clientver,
                            userid: ctx.userid,
                            token: ctx.token,
                            if_id3: 1,
                            dfid: ctx.dfid,
                            mid: ctx.mid,
                            uuid: ctx.uuid,
                            appid: ctx.appid,
                            clientver: ctx.clientver,
                            clienttime: ctx.clienttime,
                        },
                        headers: { Authorization: authorization },
                    },
                );
                if (completeRes?.data?.status !== 1)
                    throw new Error(JSON.stringify(completeRes?.data) || '完成上传失败');
                bssFileHash = completeRes?.data?.data?.['x-bss-filename'] || bssFileHash;
            }

            const body = await encryptedPost(ctx, {
                url: '/v1/add_files',
                origin: 'https://mcloudservice.kugou.com',
                data: {
                    data: [
                        {
                            name,
                            ext: extendname,
                            author_name: authorName,
                            hash: bssFileHash,
                            hash_std: hashStd,
                            audio_id: audioId,
                            bitrate: Number(p.bitrate) || 4,
                            album_audio_id: albumAudioId,
                            size: fileData.length,
                            timelen: Number(p.timelen) || 0,
                        },
                    ],
                    list_ver: Number(p.list_ver) || 0,
                },
            });
            return {
                ...(typeof body === 'object' && body !== null ? body : {}),
                uploadInfo: {
                    authorization,
                    external_host,
                    upload_id,
                    hash: bssFileHash,
                    local_hash: filename,
                    hash_std: hashStd,
                    audio_id: audioId,
                    album_audio_id: albumAudioId,
                    matched: Boolean(matchInfo),
                    filesize: fileData.length,
                },
            };
        },
    }),

    // ── 图床上传（歌单封面文件，octet-stream） ──
    e('playlist_pic_upload', 'POST', '/stream.php', {
        origin: 'http://imgphp.kugou.com/imageupload',
        salt: 'none',
        note: '返回上传后的 FileName（配合 playlist.pic 使用）',
        handler: async (p, ctx) => {
            const image = p.data instanceof Uint8Array ? p.data : null;
            if (!image || !image.length) throw new Error('请通过 params.data 传入图片二进制数据');
            const date = new Date();
            const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
            const result = await ctx.raw({
                method: 'POST',
                url: 'http://imgphp.kugou.com/imageupload/stream.php',
                query: {
                    type: p.type || 'custom',
                    extendName: p.extendName || '.jpg',
                    md5: p.md5 || ctx.md5(`${dateStr}hewry678WEK23D`),
                    jsonResponse: 1,
                },
                headers: { 'Content-Type': 'application/octet-stream' },
                body: image,
                timeoutMs: 30_000,
            });
            const body = result.json() as Record<string, any> | undefined;
            if (body?.IsSuccess) return { status: 1, FileName: body.FileName };
            throw new Error(body?.Message || '上传失败');
        },
    }),
];

// ─────────────────────────────────────────────────────────────
// 内部工具
// ─────────────────────────────────────────────────────────────

function fileMd5(data: Uint8Array): string {
    return createHash('md5').update(data).digest('hex');
}

function withProtocol(host: string): string {
    return /^https?:\/\//i.test(host || '') ? host : `http://${host}`;
}

/** BSS 上传请求（android 签名 + 通用客户端头） */
async function bssRequest(
    ctx: CallCtx,
    url: string,
    options: {
        method: 'GET' | 'POST';
        query: Record<string, unknown>;
        headers?: Record<string, string>;
        body?: Uint8Array;
    },
): Promise<{ data: any }> {
    const query = { ...options.query } as Record<string, string | number>;
    query['signature'] = signature(query, { kind: 'android', platform: ctx.platform, data: '' });
    const result = await ctx.raw({
        method: options.method,
        url,
        query,
        headers: {
            'User-Agent': `Android15-1070-${ctx.clientver}-201-0-wifi`,
            'KG-RC': '1',
            'KG-Rec': '1',
            'KG-THash': randomThash(),
            ...options.headers,
        },
        body: options.body,
        retries: 0,
    });
    const data = result.json();
    return { data };
}

function normalizeMatch(candidate: any): {
    album_audio_id: number;
    audio_id: number;
    hash_std: string;
    hash: string;
    author_name: string;
    audio_name: string;
    suffix_audio_name: string;
} | null {
    if (!candidate || typeof candidate !== 'object') return null;
    const audioInfo = candidate.audio_info || {};
    const albumAudioId = Number(candidate.album_audio_id) || 0;
    const audioId = Number(audioInfo.audio_id || candidate.audio_id) || 0;
    const hashStd = audioInfo.hash || candidate.hash || '';
    if (!albumAudioId && !audioId && !hashStd) return null;
    return {
        album_audio_id: albumAudioId,
        audio_id: audioId,
        hash_std: hashStd,
        hash: hashStd,
        author_name: candidate.author_name || '',
        audio_name: candidate.ori_audio_name || candidate.audio_name || candidate.songname || '',
        suffix_audio_name: candidate.suffix_audio_name || '',
    };
}
