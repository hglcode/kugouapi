/**
 * kugou-api + @glcoding/httpclient 集成示例。
 *
 * 0.5.0 起库以 @glcoding/httpclient 作为运行时 HTTP 后端（git 源依赖）：
 * 默认自动创建（cookies 关闭 / GET 重试 1 次 / 超时 10s / 熔断开启）。
 * 运行：bun examples/httpclient.ts [关键词]
 * Node >= 22.19（undici@8）；Bun 1.x 原生支持。
 */

import { KuGouClient, createKuGouHttpClient, randomDevice } from '../src/index.js';

const keyword = process.argv[2] ?? '周杰伦';

// ── 1. 默认即可用（自动创建 HTTP 客户端） ──────────────────
// 需要限流 / 遥测 / 连接池调优时，先建实例再注入：
const http = createKuGouHttpClient({
    timeout: 15_000, // per-attempt 超时（每次尝试独立计时）
    retry: { maxRetries: 2 }, // GET 重试交由 httpclient 全权管理
    rateLimit: { requestsPerSecond: 10 }, // 令牌桶 QPS，降低风控风险
    // telemetry: { onEvent: (e) => console.log(e.type) },
});

// ── 2. 注入实例（close 由调用方管理） ──────────────────────
const client = new KuGouClient({
    device: randomDevice(),
    httpClient: http,
    logger: console,
});

// ── 3. 用法与之前完全一致 ─────────────────────────────────
const search = await client.search({ keyword, pageSize: 10 });
console.log(`搜索 "${keyword}"：共 ${search.total} 条`);
for (const song of search.lists.slice(0, 5)) {
    console.log(`  ${song.FileName}  (hash=${song.FileHash})`);
}

const hot = await client.call('search.hot');
console.log(`\n热搜（search.hot）：${JSON.stringify(hot).slice(0, 120)}...`);

// ── 4. 遥测（httpclient 内置统计，可桥接任意 APM） ────────
const stats = http.stats;
console.log(
    `\n遥测：${stats.totalRequests} 次请求，重试 ${stats.totalRetries} 次，` +
        `P50=${stats.duration.p50}ms P95=${stats.duration.p95}ms`,
);

// 优雅关闭（内部创建的实例则调用 client.close()）
await client.close();
