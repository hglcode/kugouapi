/**
 * album 域端点（由脚本从参考实现生成，人工复核）。
 *
 * @module
 */

import { e, type EndpointDef } from '../types';

export const albumEndpoints: EndpointDef[] = [
    e('album_detail', 'POST', '/kmr/v2/albums', {
        router: 'openapi.kugou.com',
        headers: { 'kg-tid': '255' },
        body: (p, _ctx) => ({
            data: [
                {
                    album_id: p.id,
                },
            ],
            is_buy: p.is_buy || 0,
            fields: 'album_id,album_name,publish_date,sizable_cover,intro,language,is_publish,heat,type,quality,authors,exclusive,author_name,trans_param',
        }),
    }),
    e('album_shop', 'GET', '/zhuanjidata/v3/album_shop_v2/get_classify_data'),
    e('album_songs', 'POST', '/v1/album_audio/lite', {
        router: 'openapi.kugou.com',
        headers: { 'kg-tid': '255' },
        body: (p, _ctx) => ({
            album_id: p.id,
            is_buy: p.is_buy || '',
            page: p.page || 1,
            pagesize: p.pagesize || 30,
        }),
    }),
];
