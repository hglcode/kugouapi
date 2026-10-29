import { describe, expect, test } from 'bun:test';

import {
    ALL_ENDPOINTS,
    ENDPOINTS,
    ENDPOINT_IDS,
    endpointByModule,
    endpointId,
} from '../src/catalog';
import type { EndpointDef } from '../src/catalog/types';

/**
 * 官方模块清单（GitHub MakcRe/KuGouMusicApi main@5d6c9f7，2026-10-27，v1.6.2）：
 * 236 个模块（含 2 个内部模块）。覆盖度以此为准：每个非内部模块必须在目录中有对应条目。
 */
const OFFICIAL_MODULES = `
_comment
_listen_together_common
ai_recommend
ai_recommend_song
album
album_detail
album_dycover
album_shop
album_songs
artist_albums
artist_audios
artist_audios_new
artist_detail
artist_follow
artist_follow_newsongs
artist_honour
artist_lists
artist_unfollow
artist_videos
audio
audio_accompany_matching
audio_ktv_total
audio_match
audio_related
blacklist
blacklist_list
brush
captcha_sent
comment_album
comment_album_send
comment_count
comment_floor
comment_floor_send
comment_music
comment_music_classify
comment_music_del
comment_music_hotword
comment_music_send
comment_playlist
comment_playlist_send
effects_artist
effects_brand
effects_brand_detail
effects_car_brand
effects_car_brand_lists
effects_match
everyday_friend
everyday_history
everyday_recommend
everyday_style_recommend
favorite_count
fm_class
fm_image
fm_recommend
fm_songs
get_mode_info
get_model
get_verify_info
home_discover
images
images_audio
import_playlist
ip
ip_dateil
ip_playlist
ip_zone
ip_zone_home
kmr_audio_mv
krm_audio
lastest_songs_listen
listen_together_chat
listen_together_discovery
listen_together_music
listen_together_room
listen_together_study
login
login_cellphone
login_device
login_device_kick
login_openplat
login_qq
login_qq_qr_check
login_qq_qr_create
login_qr_authorize
login_qr_check
login_qr_create
login_qr_key
login_token
login_wx_check
login_wx_create
longaudio_album_audios
longaudio_album_detail
longaudio_album_list
longaudio_daily_recommend
longaudio_rank_recommend
longaudio_search
longaudio_tag_list
longaudio_vip_recommend
longaudio_week_recommend
lyric
mv_collect
mv_collect_del
pc_diantai
personal_fm
playhistory_upload
playlist_add
playlist_del
playlist_detail
playlist_effect
playlist_pic
playlist_pic_upload
playlist_share_official
playlist_similar
playlist_sort
playlist_tags
playlist_track_all
playlist_track_all_new
playlist_tracks_add
playlist_tracks_del
playlist_tracks_sort
playlist_update
privilege_lite
rank_audio
rank_info
rank_list
rank_top
rank_vol
recommend_songs
register_dev
scene_audio_list
scene_collection_list
scene_lists
scene_lists_v2
scene_module
scene_module_info
scene_music
scene_video_list
search
search_complex
search_default
search_hot
search_lyric
search_mixed
search_suggest
server_now
sheet_collection
sheet_detail
sheet_explore
sheet_rank
sheet_song
sheet_tags
sidedt
singer_list
song_auth
song_barrage
song_barrage_send
song_climax
song_ranking
song_ranking_filter
song_url
song_url_auth
song_url_auth_merge
song_url_new
team_history
team_join
team_my
team_my_info
team_my_status
team_period_info
theme_music
theme_music_detail
theme_playlist
theme_playlist_track
top_album
top_card
top_card_youth
top_ip
top_playlist
top_song
user_batch_union_vipinfo
user_cloud
user_cloud_del
user_cloud_match
user_cloud_upload
user_cloud_url
user_detail
user_fans
user_follow
user_follow_add
user_follow_chat
user_follow_del
user_follow_message
user_friends
user_grade_info
user_history
user_info
user_listen
user_listen_report
user_playlist
user_preference
user_preference_update
user_purchased_albums
user_purchased_songs
user_update
user_update_avatar
user_verify
user_video_collect
user_video_love
user_vip_detail
user_visitors
verify_user_info
video_barrage
video_barrage_send
video_detail
video_privilege
video_url
youth_channel_all
youth_channel_amway
youth_channel_detail
youth_channel_similar
youth_channel_song
youth_channel_song_detail
youth_channel_song_list
youth_channel_sub
youth_day_vip
youth_day_vip_upgrade
youth_dynamic
youth_dynamic_recent
youth_listen_song
youth_month_vip_record
youth_union_vip
youth_user_song
youth_vip
yueku
yueku_banner
yueku_fm
`
    .trim()
    .split('\n');

/** 内部辅助模块（无独立路由） */
const INTERNAL_MODULES = new Set(['_comment', '_listen_together_common']);

describe('端点目录覆盖度（以官方模块清单为准）', () => {
    test('官方清单中每个非内部模块都有目录条目', () => {
        const covered = new Set(ALL_ENDPOINTS.map((def) => def.module));
        const missing = OFFICIAL_MODULES.filter(
            (module) => !INTERNAL_MODULES.has(module) && !covered.has(module),
        );
        expect(missing).toEqual([]);
    });

    test('目录不包含清单之外的模块（无野生条目）', () => {
        const extra = [...new Set(ALL_ENDPOINTS.map((def) => def.module))].filter(
            (module) => !OFFICIAL_MODULES.includes(module),
        );
        expect(extra).toEqual([]);
    });

    test('非内部模块全覆盖（覆盖率 100%）', () => {
        const publicModules = OFFICIAL_MODULES.filter((m) => !INTERNAL_MODULES.has(m));
        const covered = new Set(ALL_ENDPOINTS.map((def) => def.module));
        const coveredCount = publicModules.filter((m) => covered.has(m)).length;
        expect(coveredCount).toBe(publicModules.length);
    });
});

describe('目录一致性', () => {
    test('ENDPOINT_IDS 与条目集合完全同步', () => {
        const entryIds = ALL_ENDPOINTS.map((def) => def.id ?? endpointId(def.module));
        expect(new Set<string>(ENDPOINT_IDS)).toEqual(new Set<string>(entryIds));
        expect(ENDPOINT_IDS.length as number).toBe(new Set<string>(ENDPOINT_IDS).size);
    });

    test('id 无重复注册', () => {
        const counts = new Map<string, number>();
        for (const id of ALL_ENDPOINTS.map((def) => def.id ?? endpointId(def.module))) {
            counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        const dup = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        expect(dup).toEqual([]);
    });

    test('每个条目结构完整（url 以 / 开头、method 合法、module 对应参考实现）', () => {
        for (const def of ALL_ENDPOINTS) {
            expect(def.module).toMatch(/^[a-z_][a-z0-9_]*$/);
            expect(['GET', 'POST', 'DELETE']).toContain(def.method);
            if (!def.handler) {
                expect(def.url.startsWith('/')).toBe(true);
            }
        }
    });

    test('endpointByModule 可按参考模块名反查', () => {
        expect(endpointByModule('rank_list')?.url).toContain('rank');
        expect(endpointByModule('song_url_new')?.module).toBe('song_url_new');
        expect(endpointByModule('no_such_module')).toBeUndefined();
    });

    test('多操作模块（listen_together）拆分为独立端点', () => {
        const musicOps = ALL_ENDPOINTS.filter((def) => def.module === 'listen_together_music');
        expect(musicOps.length).toBeGreaterThanOrEqual(15);
        expect(ENDPOINTS['listen.together.music.list']).toBeDefined();
        expect(ENDPOINTS['listen.together.music.detail']).toBeDefined();
    });

    test('目录规模：不少于 250 个端点', () => {
        expect(ALL_ENDPOINTS.length).toBeGreaterThanOrEqual(250);
    });
});

describe('关键端点抽样（协议字段正确性）', () => {
    const find = (module: string): EndpointDef => {
        const def = ALL_ENDPOINTS.find((d) => d.module === module);
        if (!def) throw new Error(`missing ${module}`);
        return def;
    };

    test('search 支持类型分发（song/album/其他）', () => {
        const def = find('search');
        expect(def.urlOf).toBeDefined();
    });

    test('song_url / song_url_auth 声明 trackerKey', () => {
        expect(find('song_url').trackerKey).toBe(true);
        expect(find('song_url_auth').trackerKey).toBe(true);
        expect(find('video_url').trackerKey).toBe(true);
    });

    test('登录族端点均为 handler；已有会话的登录标记 auth', () => {
        for (const module of ['login', 'login_cellphone', 'login_token']) {
            const def = find(module);
            expect(def.handler).toBeDefined();
        }
        // login_token 依赖已有 token，标记 auth
        expect(find('login_token').auth).toBe(true);
    });

    test('web 签名端点使用 web 盐', () => {
        expect(find('login_qr_key').salt).toBe('web');
        expect(find('login_qr_check').salt).toBe('web');
        expect(find('sheet_collection').salt).toBe('web');
    });

    test('notSignature 端点使用 none 盐（抽样）', () => {
        expect(find('user_cloud').salt).toBe('none');
        expect(find('audio_accompany_matching').salt).toBe('none');
    });

    test('playlist_share_official：t.service 网关、无签名、清参数、仅自定义头（上游 #293）', () => {
        const def = find('playlist_share_official');
        expect(def.origin).toBe('http://t.service.kugou.com');
        expect(def.salt).toBe('none');
        expect(def.clearParams).toBe(true);
        expect(def.clearHeaders).toBe(true);
        expect(def.headersFn).toBeDefined();
        expect(def.query).toBeDefined();
    });

    test('上游已移除的 top_tag_card_youth 不再保留 legacy 条目', () => {
        expect(ALL_ENDPOINTS.find((d) => d.module === 'top_tag_card_youth')).toBeUndefined();
        // 同功能由 top_card_youth 的 card_id=3103 分支覆盖
        expect(find('top_card_youth').urlOf).toBeDefined();
    });
});
