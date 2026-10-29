/**
 * 特殊协议端点汇总（登录族 / 加密 POST 族 / 评论族 / 一起听 / 复合流程）。
 *
 * @module
 */

import type { EndpointDef } from '../types';
import { accountSpecialEndpoints } from './account';
import { cloudSpecialEndpoints } from './cloud';
import { commentSpecialEndpoints } from './comment';
import { listenTogetherEndpoints } from './listenTogether';
import { mediaSpecialEndpoints } from './media';
import { searchSpecialEndpoints } from './search';
import { songSpecialEndpoints } from './song';
import { teamSpecialEndpoints } from './team';
import { userSpecialEndpoints } from './user';

export const specialEndpoints: EndpointDef[] = [
    ...songSpecialEndpoints,
    ...accountSpecialEndpoints,
    ...cloudSpecialEndpoints,
    ...commentSpecialEndpoints,
    ...listenTogetherEndpoints,
    ...userSpecialEndpoints,
    ...mediaSpecialEndpoints,
    ...searchSpecialEndpoints,
    ...teamSpecialEndpoints,
];

/** 特殊端点 id 字面量（EndpointId 类型推导用；与上面条目 1:1 对应） */
export const SPECIAL_ENDPOINT_IDS = [
    // song.ts
    'song.url',
    'song.url.auth',
    'song.url.new',
    'song.url.auth.merge',
    'song.auth',
    'privilege.lite',
    // account.ts
    'login',
    'login.cellphone',
    'login.token',
    'login.device',
    'login.device.kick',
    'login.qq',
    'login.openplat',
    'login.qr.key',
    'login.qr.create',
    'login.qr.check',
    'login.qr.authorize',
    'login.qq.qr.create',
    'login.qq.qr.check',
    'login.wx.create',
    'login.wx.check',
    'register.dev',
    'sidedt',
    'verify.user.info',
    'user.verify',
    // cloud.ts
    'mv.collect',
    'mv.collect.del',
    'playlist.del',
    'playlist.add',
    'playlist.tracks.add',
    'playlist.pic',
    'playlist.sort',
    'playlist.tracks.sort',
    'playlist.update',
    'user.cloud',
    'user.cloud.del',
    'user.cloud.match',
    'user.cloud.url',
    'user.cloud.upload',
    'playlist.pic.upload',
    // comment.ts
    'song.barrage',
    'song.barrage.send',
    'video.barrage',
    'video.barrage.send',
    'comment.floor',
    'comment.music.send',
    'comment.album.send',
    'comment.playlist.send',
    'comment.floor.send',
    'comment.music.del',
    // listenTogether.ts
    'listen.together.chat.send',
    'listen.together.chat.history',
    'listen.together.discovery.channel_search',
    'listen.together.discovery.kugroup_square',
    'listen.together.discovery.genting_square',
    'listen.together.discovery.kugroup_streamers',
    'listen.together.discovery.genting_streamers',
    'listen.together.discovery.recent_rooms',
    'listen.together.discovery.privilege',
    'listen.together.discovery.genting_recommend',
    'listen.together.music.history',
    'listen.together.music.list',
    'listen.together.music.detail',
    'listen.together.music.members',
    'listen.together.music.initialize',
    'listen.together.music.sync_player',
    'listen.together.music.playback_url',
    'listen.together.music.switch_song',
    'listen.together.music.player_operation',
    'listen.together.music.playlist',
    'listen.together.music.recent_playlist',
    'listen.together.music.order_song',
    'listen.together.music.song_order_list',
    'listen.together.music.remove_song',
    'listen.together.music.music_add',
    'listen.together.room.create',
    'listen.together.room.join',
    'listen.together.room.state',
    'listen.together.room.heartbeat',
    'listen.together.room.status',
    'listen.together.room.leave',
    'listen.together.room.dismiss',
    'listen.together.room.update_chat',
    'listen.together.room.check_minor',
    'listen.together.study.created_rooms',
    'listen.together.study.delete_created_room',
    'listen.together.study.list',
    'listen.together.study.detail',
    'listen.together.study.members',
    'listen.together.study.configure',
    'listen.together.study.sync_player',
    'listen.together.study.playlist',
    // user.ts
    'user.grade.info',
    'user.listen.report',
    'user.follow.chat',
    'user.update.avatar',
    'user.preference',
    'user.preference.update',
    'user.visitors',
    'blacklist',
    'user.batch.union.vipinfo',
    // media.ts
    'audio',
    'album',
    'album.dycover',
    'audio.match',
    'audio.related',
    'fm.songs',
    'images',
    'images.audio',
    'lyric',
    'artist.follow',
    'artist.unfollow',
    // search.ts
    'search',
    'search.mixed',
    'ip',
    'top.card.youth',
    'youth.channel.sub',
    'import.playlist',
    // team.ts
    'team.history',
    'team.my.info',
    'team.my.status',
    'team.period.info',
] as const;
