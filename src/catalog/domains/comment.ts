/**
 * comment 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const commentEndpoints: EndpointDef[] = [
    e('comment_album', 'POST', '/m.comment.service/v1/cmtlist', {
        query: (p, _ctx) => ({
            childrenid: p.id,
            need_show_image: 1,
            p: p.page || 1,
            pagesize: p.pagesize || 30,
            show_classify: p.show_classify || 1,
            show_hotword_list: p.show_hotword_list || 1,
            code: '94f1792ced1df89aa68a7939eaf2efca',
        }),
    }),
    e('comment_count', 'GET', '/index.php', {
        router: 'sum.comment.service.kugou.com',
        salt: 'web',
        query: (_p, _ctx) => ({
            r: 'comments/getcommentsnum',
            code: 'fc4be23b4e972707f36b8a828a93ba8a',
        }),
    }),
    e('comment_music', 'POST', '/mcomment/v1/cmtlist', {
        query: (p, _ctx) => ({
            ver: Number((process.env.CMT_VER as string | undefined) || 6),
            mixsongid: p.mixsongid,
            need_show_image: 1,
            p: p.page || 1,
            pagesize: p.pagesize || 30,
            show_classify: p.show_classify || 1,
            show_hotword_list: p.show_hotword_list || 1,
            extdata: '0',
            code: 'fc4be23b4e972707f36b8a828a93ba8a',
        }),
    }),
    e('comment_music_classify', 'POST', '/mcomment/v1/cmt_classify_list', {
        query: (p, _ctx) => ({
            mixsongid: p.mixsongid,
            need_show_image: 1,
            page: p.page || 1,
            pagesize: p.pagesize || 30,
            type_id: p.type_id,
            extdata: '0',
            code: 'fc4be23b4e972707f36b8a828a93ba8a',
            sort_method: Number(p.sort) === 2 ? p.sort : 1,
        }),
    }),
    e('comment_music_hotword', 'POST', '/mcomment/v1/get_hot_word', {
        query: (p, _ctx) => ({
            mixsongid: p.mixsongid,
            need_show_image: 1,
            p: p.page || 1,
            pagesize: p.pagesize || 30,
            hot_word: p.hot_word,
            extdata: '0',
            code: 'fc4be23b4e972707f36b8a828a93ba8a',
        }),
    }),
    e('comment_playlist', 'POST', '/m.comment.service/v1/cmtlist', {
        query: (p, _ctx) => ({
            childrenid: p.id,
            need_show_image: 1,
            p: p.page || 1,
            pagesize: p.pagesize || 30,
            show_classify: p.show_classify || 1,
            show_hotword_list: p.show_hotword_list || 1,
            code: 'ca53b96fe5a1d9c22d71c8f522ef7c4f',
            content_type: 0,
            tag: 5,
        }),
    }),
];
