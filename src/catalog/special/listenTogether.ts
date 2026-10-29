/**
 * 一起听（listen_together_*）端点。
 *
 * 参考实现按 `operation` 分发到不同 URL；这里拆成独立端点 id
 * （如 `listen.together.music.list`），调用更直观。
 *
 * @module
 */

import { e, type CallCtx, type CallParams, type EndpointDef } from '../types';

const YOUTH_BASE = 'https://youth.kugou.com';
const SELF_STUDY_BIZ = '1000';
const MUSIC_ROOM_BIZ = '1009';
const DEFAULT_MUSIC_ROOM_BG =
    'https://youthimgbssdl.kugou.com/6e9cdcef8d163d06225d8cbeaa2f1ece.JPEG';
const PAGE_ID = 711586122;
const PARENT_PAGE_ID = '356753938';

/** 会话身份（登录后自动取会话，可被参数覆盖） */
function authBody(p: CallParams, ctx: CallCtx): { userid: number; token: string } {
    return {
        userid: Number(p.userid ?? ctx.userid ?? 0),
        token: String(p.token ?? ctx.token ?? ''),
    };
}

function parseArray(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.startsWith('[')) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function parseObject(value: unknown): Record<string, any> {
    const parsed =
        typeof value === 'string'
            ? (() => {
                  try {
                      return JSON.parse(value);
                  } catch {
                      return undefined;
                  }
              })()
            : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function musicRoomAudios(p: CallParams): unknown[] {
    return parseArray(p.audios)
        .slice(0, 50)
        .map((audio: any) => ({
            hash: audio?.hash || '',
            mixsongid: audio?.mixsongid ?? audio?.mixSongId ?? '',
            fid: audio?.fid ?? 0,
        }))
        .filter((audio) => audio.hash);
}

function groupOperation(_url: string) {
    return (p: CallParams, ctx: CallCtx) => ({
        ...authBody(p, ctx),
        biz: p.biz || SELF_STUDY_BIZ,
        groupid: p.groupid || p.room_id || '',
    });
}

export const listenTogetherEndpoints: EndpointDef[] = [
    // ── listen_together_chat ──
    e('listen_together_chat', 'POST', '/rmservice/v1/group/chat', {
        id: 'listen.together.chat.send',
        auth: true,
        body: (p, ctx) => ({
            ...authBody(p, ctx),
            biz: p.biz || SELF_STUDY_BIZ,
            groupid: p.groupid || p.room_id || '',
            message: {
                msgtype: p.msgtype || 801,
                nickname: p.nickname || '',
                img: p.img || '',
                alert: p.alert || p.message || '',
            },
        }),
    }),
    e('listen_together_chat', 'POST', '/rmservice/v1/group/msg_history', {
        id: 'listen.together.chat.history',
        auth: true,
        body: (p, ctx) => ({
            ...authBody(p, ctx),
            biz: p.biz || SELF_STUDY_BIZ,
            groupid: p.groupid || p.room_id || '',
            maxid: p.maxid || '0',
            pagesize: p.pagesize || '20',
        }),
    }),

    // ── listen_together_discovery ──
    e('listen_together_discovery', 'GET', '/v1/search/channel', {
        id: 'listen.together.discovery.channel_search',
        origin: YOUTH_BASE,
        query: (p) => ({ keyword: p.keyword || '', page: p.page || 1, position: p.position || 1 }),
    }),
    e('listen_together_discovery', 'GET', '/v1/kugroup/square', {
        id: 'listen.together.discovery.kugroup_square',
        origin: YOUTH_BASE,
        query: (p) => ({
            page: p.page || 1,
            pagesize: p.pagesize || 20,
            order_type: p.order_type || 1,
        }),
    }),
    e('listen_together_discovery', 'GET', '/v1/genting/square', {
        id: 'listen.together.discovery.genting_square',
        origin: YOUTH_BASE,
        query: (p) => ({
            page: p.page || 1,
            pagesize: p.pagesize || 20,
            order_type: p.order_type || 1,
        }),
    }),
    e('listen_together_discovery', 'GET', '/v1/kugroup/get_streamer_list', {
        id: 'listen.together.discovery.kugroup_streamers',
        origin: YOUTH_BASE,
        query: (p) => ({ longitude: p.longitude || 0, latitude: p.latitude || 0 }),
    }),
    e('listen_together_discovery', 'GET', '/v1/genting/get_streamer_list', {
        id: 'listen.together.discovery.genting_streamers',
        origin: YOUTH_BASE,
        query: (p) => ({ page: p.page || 1, pagesize: p.pagesize || 20 }),
    }),
    e('listen_together_discovery', 'GET', '/v3/user/recent_room_dynamic', {
        id: 'listen.together.discovery.recent_rooms',
        origin: YOUTH_BASE,
        query: () => ({}),
    }),
    e('listen_together_discovery', 'GET', '/v1/privilege/operate', {
        id: 'listen.together.discovery.privilege',
        origin: YOUTH_BASE,
        query: (p) => ({ event_type: p.event_type || 4 }),
    }),
    e('listen_together_discovery', 'POST', '/v1/genting/recommend', {
        id: 'listen.together.discovery.genting_recommend',
        origin: 'https://concepts.kugou.com',
        query: (p) => ({
            page: p.page || 1,
            pagesize: p.pagesize || 20,
            room_biz: p.room_biz || 1006,
        }),
        body: () => ({}),
    }),

    // ── listen_together_music ──
    e('listen_together_music', 'GET', '/youth/v1/genting/history', {
        id: 'listen.together.music.history',
        query: (p) => ({ last_id: Number(p.last_id || 0) }),
    }),
    e('listen_together_music', 'POST', '/youth/v2/genting/recommend', {
        id: 'listen.together.music.list',
        query: (p) => ({
            page: Math.max(0, Number(p.page || 1) - 1),
            pagesize: Number(p.pagesize || 20),
            loop_pick: Number(p.loop_pick || 0),
            tags: p.tags || '',
            room_biz: MUSIC_ROOM_BIZ,
            ...(p.mixsongid ? { mixsongid: p.mixsongid } : {}),
        }),
        body: (p) => ({ data: parseArray(p.behaviors) }),
    }),
    e('listen_together_music', 'GET', '/youth/v1/genting/get_musicroom_info', {
        id: 'listen.together.music.detail',
        query: (p) => ({ roomid: p.roomid || p.room_id || '', biz: p.biz || MUSIC_ROOM_BIZ }),
    }),
    e('listen_together_music', 'GET', '/youth/v1/genting/get_musicroom_member', {
        id: 'listen.together.music.members',
        query: (p) => ({
            roomid: p.roomid || p.room_id || '',
            page: Math.max(1, Number(p.page || 1)),
            pagesize: Number(p.pagesize || 100),
            apiver: '3',
        }),
    }),
    e('listen_together_music', 'POST', '/youth/v1/genting/init_musicroom', {
        id: 'listen.together.music.initialize',
        query: (p) => ({ roomid: p.roomid || p.room_id || '' }),
        body: (p) => {
            const body: Record<string, unknown> = {
                sendall: Number(p.sendall ?? 1),
                audios: musicRoomAudios(p),
            };
            const progressInfo = parseObject(p.progress_info);
            if (Object.keys(progressInfo).length) body['progress_info'] = progressInfo;
            return body;
        },
    }),
    e('listen_together_music', 'POST', '/youth/v1/genting/music_sync_player', {
        id: 'listen.together.music.sync_player',
        query: (p) => ({ roomid: p.roomid || p.room_id || '', frm: Number(p.frm || 2) }),
        body: () => ({}),
    }),
    e('listen_together_music', 'POST', '/youth/v1/genting/music_reqcmd', {
        id: 'listen.together.music.playback_url',
        query: () => ({ page_id: 147780134, ppage_id: '356753938' }),
        body: (p, ctx) => ({
            ...authBody(p, ctx),
            roomid: p.roomid || p.room_id || '',
            audio: { hash: p.hash || '', mixsongid: p.mixsongid ?? '' },
        }),
    }),
    e('listen_together_music', 'POST', '/youth/v1/genting/music_sw', {
        id: 'listen.together.music.switch_song',
        query: (p) => ({ roomid: p.roomid || p.room_id || '' }),
        body: (p) => ({
            act_type: Number(p.act_type || 1),
            list_version: String(p.list_version || ''),
            is_auto: Number(p.is_auto || 0) ? '1' : '0',
            audio: { hash: p.hash || '', mixsongid: p.mixsongid ?? '' },
        }),
    }),
    e('listen_together_music', 'POST', '/youth/v1/genting/music_player_opr', {
        id: 'listen.together.music.player_operation',
        query: (p) => ({ roomid: p.roomid || p.room_id || '' }),
        body: (p) => {
            const action = Number(p.action || 3);
            const body: Record<string, unknown> = { action };
            if (action === 1) body['play_mode'] = Number(p.play_mode || 1);
            if (action === 2) body['progress'] = Math.max(0, Math.floor(Number(p.progress || 0)));
            if (action === 3) body['pause'] = Number(p.pause || 2) === 1 ? '1' : '2';
            return body;
        },
    }),
    e('listen_together_music', 'POST', '/youth/v1/genting/music_fetch_list', {
        id: 'listen.together.music.playlist',
        query: (p) => ({ roomid: p.roomid || p.room_id || '' }),
        body: (p) => {
            const body: Record<string, unknown> = { pagesize: Number(p.pagesize || 50) };
            const audio = parseObject(p.audio);
            if (audio?.hash) {
                body['audio'] = {
                    hash: audio.hash,
                    mixsongid: audio.mixsongid ?? audio.mixSongId ?? '',
                };
            }
            return body;
        },
    }),
    e('listen_together_music', 'POST', '/youth/v1/genting/music_recent_list', {
        id: 'listen.together.music.recent_playlist',
        query: (p) => ({ roomid: p.roomid || p.room_id || '' }),
        body: () => '',
    }),
    e('listen_together_music', 'POST', '/youth/v1/genting/order_song', {
        id: 'listen.together.music.order_song',
        query: (p) => ({ roomid: p.roomid || p.room_id || '' }),
        body: (p) => ({ mixsongid: p.mixsongid ?? '', hash: p.hash || '' }),
    }),
    e('listen_together_music', 'GET', '/youth/v1/genting/song_order_list', {
        id: 'listen.together.music.song_order_list',
        query: (p) => ({ roomid: p.roomid || p.room_id || '' }),
    }),
    e('listen_together_music', 'POST', '/youth/v1/genting/remove_song', {
        id: 'listen.together.music.remove_song',
        query: (p) => ({ roomid: p.roomid || p.room_id || '' }),
        body: (p) => ({
            mixsongid: p.mixsongid ?? '',
            hash: p.hash || '',
            order_userid: String(p.order_userid || ''),
        }),
    }),
    e('listen_together_music', 'POST', '/youth/v1/genting/music_add', {
        id: 'listen.together.music.music_add',
        query: (p) => ({
            roomid: p.roomid || p.room_id || '',
            ...(p.order_userid
                ? { order_userid: String(p.order_userid), source: String(p.source || 1) }
                : {}),
        }),
        body: (p) => {
            const body: Record<string, unknown> = {
                action: Number(p.action || 4),
                list_version: String(p.list_version || ''),
                sendall: Number(p.sendall ?? 1),
                audios: musicRoomAudios(p),
            };
            const progressInfo = parseObject(p.progress_info);
            if (Object.keys(progressInfo).length) body['progress_info'] = progressInfo;
            return body;
        },
    }),

    // ── listen_together_room ──
    e('listen_together_room', 'POST', '/rmservice/v1/group/create', {
        id: 'listen.together.room.create',
        auth: true,
        body: (p, ctx) => {
            const biz = String(p.biz || SELF_STUDY_BIZ);
            const roomPrivacy = Number(p.room_privacy ?? (biz === MUSIC_ROOM_BIZ ? 1 : 3));
            const passThroughData: Record<string, unknown> = {
                ...parseObject(p.pass_through_data),
                room_privacy: roomPrivacy,
                cp_notice: 1,
            };
            const body: Record<string, unknown> = {
                ...authBody(p, ctx),
                biz,
                pass_through_data: passThroughData,
            };
            if (biz === MUSIC_ROOM_BIZ) {
                body['introduction'] = p.introduction || p.room_name || '';
                passThroughData['room_bg_content'] = JSON.stringify({
                    bg_img: p.background_url || DEFAULT_MUSIC_ROOM_BG,
                    room_bg_type: String(p.room_bg_type || 2),
                });
                if (roomPrivacy === 1)
                    passThroughData['global_collection_id'] = p.global_collection_id || '';
                else body['capacity'] = Number(p.capacity || 5);
            } else {
                const bizDefinedData = parseArray(p.biz_defined_data);
                body['biz_defined_data'] = bizDefinedData.length
                    ? bizDefinedData
                    : [{ key: 'lyric_switch', value: 1 }];
            }
            return body;
        },
    }),
    e('listen_together_room', 'POST', '/rmservice/v1/group/join', {
        id: 'listen.together.room.join',
        auth: true,
        body: (p, ctx) => ({
            ...authBody(p, ctx),
            biz: p.biz || SELF_STUDY_BIZ,
            groupid: p.groupid || p.room_id || '',
            pass_through_data: p.pass_through_data || { cp_notice: 1 },
        }),
    }),
    e('listen_together_room', 'POST', '/rmservice/v1/group/info', {
        id: 'listen.together.room.state',
        auth: true,
        query: (p) => ({ biz: p.biz || SELF_STUDY_BIZ }),
        body: (p) => ({ groupid: p.groupid || p.room_id || '' }),
    }),
    e('listen_together_room', 'POST', '/rmservice/v1/group/heartbeat', {
        id: 'listen.together.room.heartbeat',
        auth: true,
        body: groupOperation('/rmservice/v1/group/heartbeat'),
    }),
    e('listen_together_room', 'POST', '/rmservice/v1/user/get_status', {
        id: 'listen.together.room.status',
        auth: true,
        body: groupOperation('/rmservice/v1/user/get_status'),
    }),
    e('listen_together_room', 'POST', '/rmservice/v1/group/leave', {
        id: 'listen.together.room.leave',
        auth: true,
        body: groupOperation('/rmservice/v1/group/leave'),
    }),
    e('listen_together_room', 'POST', '/rmservice/v1/group/dismiss', {
        id: 'listen.together.room.dismiss',
        auth: true,
        body: groupOperation('/rmservice/v1/group/dismiss'),
    }),
    e('listen_together_room', 'POST', '/rmservice/v1/group/update_info', {
        id: 'listen.together.room.update_chat',
        auth: true,
        body: (p) => ({
            groupid: p.groupid || p.room_id || '',
            biz: MUSIC_ROOM_BIZ,
            switch: { chat: Number(p.chat) === 1 ? 1 : 2 },
        }),
    }),
    e('listen_together_room', 'GET', '/v1/risk/check_minor', {
        id: 'listen.together.room.check_minor',
        origin: YOUTH_BASE,
        query: () => ({}),
    }),

    // ── listen_together_study ──
    e('listen_together_study', 'GET', '/v1/study/user_create_room_list', {
        id: 'listen.together.study.created_rooms',
        origin: YOUTH_BASE,
        query: () => ({}),
    }),
    e('listen_together_study', 'DELETE', '/youth/v1/room/delete_room', {
        id: 'listen.together.study.delete_created_room',
        query: (p) => ({
            global_collection_id: p.global_collection_id || p.channel_id || '',
            roomid: p.roomid || p.room_id || '',
        }),
    }),
    e('listen_together_study', 'GET', '/v1/room/get_room_list_by_tag', {
        id: 'listen.together.study.list',
        origin: YOUTH_BASE,
        query: (p) => ({
            page: p.page || 1,
            pagesize: p.pagesize || 20,
            sort: p.sort || 0,
            page_id: p.page_id || 191708212,
            ppage_id: p.ppage_id || PARENT_PAGE_ID,
            tag_id: p.tag_id || '',
        }),
    }),
    e('listen_together_study', 'GET', '/v1/room/get_room_detail', {
        id: 'listen.together.study.detail',
        origin: YOUTH_BASE,
        query: (p) => ({ room_id: p.room_id || '' }),
    }),
    e('listen_together_study', 'GET', '/v1/room/get_member_list', {
        id: 'listen.together.study.members',
        origin: YOUTH_BASE,
        query: (p) => ({
            room_id: p.room_id || '',
            page: p.page || 1,
            pagesize: p.pagesize || 20,
            member_type: Number(p.member_type ?? 1),
        }),
    }),
    e('listen_together_study', 'POST', '/v1/user/make_room', {
        id: 'listen.together.study.configure',
        origin: YOUTH_BASE,
        auth: true,
        query: (p) => {
            const pageIds: Record<number, number> = { 1: PAGE_ID, 2: 971343961, 3: 711357575 };
            return {
                page_id: p.page_id || pageIds[Number(p.music_type || 1)] || PAGE_ID,
                ppage_id: p.ppage_id || PARENT_PAGE_ID,
                type: p.type ?? 1,
            };
        },
        body: (p) => {
            const body: Record<string, unknown> = {
                room_id: p.room_id || '',
                room_name: p.room_name || '',
                global_collection_id: p.global_collection_id || '',
                room_notice: p.room_notice || '',
                allow_chat: p.allow_chat ?? 1,
                room_tag: p.room_tag || '2',
                music_type: Number(p.music_type || 1),
            };
            if (body['music_type'] === 1 || body['music_type'] === 2) {
                if (p.music_style) body['music_style'] = p.music_style;
                const audios = parseArray(p.audios);
                if (audios.length) body['audios'] = audios;
            } else if (body['music_type'] === 3) {
                body['white_noise_type'] = p.white_noise_type || 1;
            }
            return body;
        },
    }),
    e('listen_together_study', 'POST', '/v1/music/sync_player', {
        id: 'listen.together.study.sync_player',
        origin: YOUTH_BASE,
        auth: true,
        query: (p) => ({ page_id: p.page_id || PAGE_ID, ppage_id: p.ppage_id || PARENT_PAGE_ID }),
        body: (p, ctx) => ({
            roomid: p.roomid || p.room_id || '',
            frm: p.frm || 2,
            ...authBody(p, ctx),
        }),
    }),
    e('listen_together_study', 'POST', '/v1/music/fetch_list', {
        id: 'listen.together.study.playlist',
        origin: YOUTH_BASE,
        auth: true,
        query: (p) => ({ page_id: p.page_id || PAGE_ID, ppage_id: p.ppage_id || PARENT_PAGE_ID }),
        body: (p, ctx) => ({
            roomid: p.roomid || p.room_id || '',
            frm: p.frm || 2,
            pagesize: p.pagesize || 50,
            ...authBody(p, ctx),
        }),
    }),
];
