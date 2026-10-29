/**
 * kugou-api 基础用法示例。
 *
 * 运行：bun examples/basic.ts [关键词]
 * Node：node --experimental-strip-types examples/basic.ts（Node 22.6+）
 */

import { KuGouClient, randomDevice } from '../src/index.js';

const keyword = process.argv[2] ?? '周杰伦';

const client = new KuGouClient({
    device: randomDevice(),
    logger: console, // 需要调试时打开；默认静默
    timeoutMs: 15_000,
});

// ── 1. 搜索（类型化方法） ─────────────────────────────────
const search = await client.search({ keyword, pageSize: 10 });
console.log(`搜索 "${keyword}"：共 ${search.total} 条`);
for (const song of search.lists.slice(0, 5)) {
    console.log(`  ${song.FileName}  (hash=${song.FileHash})`);
}

// ── 2. 获取播放地址 ─────────────────────────────────────
const first = search.lists[0]!;
const url = await client.songUrl({ hash: first.FileHash, quality: '128' });
if (url.url?.length) {
    console.log(`\n播放地址：${url.url[0]}`);
} else if (url.hash_offset) {
    console.log(
        `\nVIP 歌曲，仅试听段：${url.hash_offset.end_ms}ms（offset_hash=${url.hash_offset.offset_hash}）`,
    );
} else {
    console.log(`\n无可用地址：fail_process=${JSON.stringify(url.fail_process)}`);
}

// ── 3. 端点目录派发（271 个端点） ────────────────────────
const hot = await client.call('search.hot');
console.log(`\n热搜（search.hot）：${JSON.stringify(hot).slice(0, 120)}...`);

const rank = await client.call('rank.list');
console.log(
    `排行榜（rank.list）类型：${Array.isArray(rank) ? `数组 ${rank.length} 项` : typeof rank}`,
);

// ── 4. 会话（注册后自动携带 dfid/mid/token/userid） ──────
// 注册设备（内置参考协议加密与公钥，开箱即用）：
// await client.registerDevice();
// 登录（成功后凭证自动写入会话）：
// await client.call('login.cellphone', { mobile, code });
// 持久化后下次启动恢复：
// new KuGouClient({ session: client.session! });
console.log(`\n当前会话：${client.session ? client.session.dfid : '未注册'}`);
