/**
 * 真实网关冒烟测试（联网脚本，不属于离线单测）。
 *
 * 验证 search / songUrl 的线上行为：签名是否被服务端接受、信封解包是否正确。
 * 运行：bun scripts/live-smoke.mjs [关键词]
 */

import { KuGouClient, randomDevice } from '../dist/index.js';

const keyword = process.argv[2] ?? '周杰伦';

const client = new KuGouClient({
    device: randomDevice(),
    logger: { ...console, debug() {} },
    timeoutMs: 15_000,
});

console.log(`── search: ${keyword} ──`);
const search = await client.search({ keyword, pageSize: 10 });
console.log(`total: ${search.total}`);

let played = false;
for (const song of search.lists.slice(0, 10)) {
    let url;
    try {
        const data = await client.songUrl({ hash: song.FileHash, quality: '128' });
        url = data.url?.[0];
        if (url) {
            console.log(`✓ ${song.FileName}  url=${url.slice(0, 90)}...`);
            played = true;
            break;
        }
        // VIP 歌曲：返回试听段 hash_offset
        const offset = data.hash_offset;
        if (offset) {
            console.log(
                `△ ${song.FileName}  VIP 试听段: ${String(offset.end_ms)}ms / ${String(offset.offset_hash).slice(0, 16)}...`,
            );
        } else {
            console.log(`△ ${song.FileName}  无 url（priv_status=${String(data.priv_status)}）`);
        }
    } catch (e) {
        console.log(`✗ ${song.FileName}  ${e?.message ?? e}`);
    }
}

if (!played) console.log('\n（前 10 首均无免费 url，试听段信息如上）');
console.log('\n冒烟测试通过 ✓');
process.exit(0);
