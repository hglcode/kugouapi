/**
 * song 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const songEndpoints: EndpointDef[] = [
    e(
        'audio_accompany_matching',
        'GET',
        '/sing7/accompanywan/json/v2/cdn/optimal_matching_accompany_2_listen.do',
        {
            origin: 'https://nsongacsing.kugou.com',
            salt: 'none',
            query: (p, ctx) => ({
                isteen: 0,
                mixId: Number(p.mixId) || 0,
                usemkv: 1,
                platform: 2,
                fileName: p.fileName || '',
                hash: p.hash,
                version: 12375,
                appid: ctx.appid,
                sign: ctx
                    .md5(
                        `${Object.keys({
                            isteen: 0,
                            mixId: Number(p.mixId) || 0,
                            usemkv: 1,
                            platform: 2,
                            fileName: p.fileName || '',
                            hash: p.hash,
                            version: 12375,
                            appid: ctx.appid,
                        })
                            .sort()
                            .map(
                                (key: any) =>
                                    `${key}=${
                                        typeof (
                                            {
                                                isteen: 0,
                                                mixId: Number(p.mixId) || 0,
                                                usemkv: 1,
                                                platform: 2,
                                                fileName: p.fileName || '',
                                                hash: p.hash,
                                                version: 12375,
                                                appid: ctx.appid,
                                            } as any
                                        )[key] === 'object'
                                            ? JSON.stringify(
                                                  (
                                                      {
                                                          isteen: 0,
                                                          mixId: Number(p.mixId) || 0,
                                                          usemkv: 1,
                                                          platform: 2,
                                                          fileName: p.fileName || '',
                                                          hash: p.hash,
                                                          version: 12375,
                                                          appid: ctx.appid,
                                                      } as any
                                                  )[key],
                                              )
                                            : (
                                                  {
                                                      isteen: 0,
                                                      mixId: Number(p.mixId) || 0,
                                                      usemkv: 1,
                                                      platform: 2,
                                                      fileName: p.fileName || '',
                                                      hash: p.hash,
                                                      version: 12375,
                                                      appid: ctx.appid,
                                                  } as any
                                              )[key]
                                    }`,
                            )
                            .join('&')}${'*s&iN#G70*'}`,
                    )
                    .substring(8, 24),
            }),
            clearParams: true,
        },
    ),
    e(
        'audio_ktv_total',
        'GET',
        '/sing7/listenguide/json/v2/cdn/listenguide/get_total_opus_num_v02.do',
        {
            origin: 'https://acsing.service.kugou.com',
            salt: 'none',
            query: (p, ctx) => ({
                isteen: 0,
                songId: Number(p.songId),
                usemkv: 1,
                platform: 2,
                singerName: p.singerName,
                songHash: p.songHash,
                version: 12375,
                appid: ctx.appid,
                sign: ctx
                    .md5(
                        `${Object.keys({
                            isteen: 0,
                            songId: Number(p.songId),
                            usemkv: 1,
                            platform: 2,
                            singerName: p.singerName,
                            songHash: p.songHash,
                            version: 12375,
                            appid: ctx.appid,
                        })
                            .sort()
                            .map(
                                (key: any) =>
                                    `${key}=${
                                        typeof (
                                            {
                                                isteen: 0,
                                                songId: Number(p.songId),
                                                usemkv: 1,
                                                platform: 2,
                                                singerName: p.singerName,
                                                songHash: p.songHash,
                                                version: 12375,
                                                appid: ctx.appid,
                                            } as any
                                        )[key] === 'object'
                                            ? JSON.stringify(
                                                  (
                                                      {
                                                          isteen: 0,
                                                          songId: Number(p.songId),
                                                          usemkv: 1,
                                                          platform: 2,
                                                          singerName: p.singerName,
                                                          songHash: p.songHash,
                                                          version: 12375,
                                                          appid: ctx.appid,
                                                      } as any
                                                  )[key],
                                              )
                                            : (
                                                  {
                                                      isteen: 0,
                                                      songId: Number(p.songId),
                                                      usemkv: 1,
                                                      platform: 2,
                                                      singerName: p.singerName,
                                                      songHash: p.songHash,
                                                      version: 12375,
                                                      appid: ctx.appid,
                                                  } as any
                                              )[key]
                                    }`,
                            )
                            .join('&')}${'*s&iN#G70*'}`,
                    )
                    .substring(8, 24),
            }),
            clearParams: true,
        },
    ),
    e('song_climax', 'GET', '/v1/audio_climax/audio', {
        origin: 'https://expendablekmrcdn.kugou.com',
        query: (p, _ctx) => ({
            data: JSON.stringify(
                (p.hash || '').split(',').map((s: any) => ({
                    hash: s,
                })),
            ),
        }),
    }),
    e('song_ranking', 'GET', '/grow/v1/song_ranking/play_page/ranking_info', {
        query: (p, _ctx) => ({
            album_audio_id: p.album_audio_id,
        }),
    }),
    e('song_ranking_filter', 'GET', '/grow/v1/song_ranking/unlock/v2/ranking_filter', {
        query: (p, _ctx) => ({
            album_audio_id: p.album_audio_id,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
        }),
    }),
];
