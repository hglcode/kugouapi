/**
 * 从端点目录生成 docs/ENDPOINTS.md 覆盖对照表。
 *
 * 运行：bun run docs:endpoints
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { ALL_ENDPOINTS, endpointId } from '../src/catalog';

const groups = new Map();
for (const def of ALL_ENDPOINTS) {
    const id = def.id ?? endpointId(def.module);
    const domain = id
        .split('.')
        .slice(0, id.startsWith('listen.together') ? 2 : 1)
        .join('.');
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain).push({ id, def });
}

const lines = [];
lines.push('# 端点目录（ENDPOINTS）');
lines.push('');
lines.push(
    `共 **${ALL_ENDPOINTS.length}** 个端点，覆盖参考实现（KuGouMusicApi）的 ${new Set(ALL_ENDPOINTS.map((d) => d.module)).size} 个模块。`,
);
lines.push('');
lines.push(
    '调用方式：`client.call(id, params)`；id 由参考模块名下划线转点得到（如 `rank_list` → `rank.list`）。',
);
lines.push('');
lines.push('| 端点 id | 参考模块 | 方法 | 路径 | 说明 |');
lines.push('|---|---|---|---|---|');
for (const [domain, entries] of [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    lines.push(`| **${domain}** | | | | |`);
    for (const { id, def } of entries.sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const url = def.handler ? (def.handler ? '(handler)' : def.url) : def.url;
        const extra = [
            def.origin ? `@${def.origin.replace(/^https?:\/\//, '')}` : '',
            def.router ? `router:${def.router}` : '',
            def.salt && def.salt !== 'android' ? `盐:${def.salt}` : '',
            def.auth ? '需登录' : '',
            def.trackerKey ? 'trackerKey' : '',
        ]
            .filter(Boolean)
            .join(' ');
        lines.push(
            `| \`${id}\` | ${def.module} | ${def.method} | ${url}${extra ? `<br/>${extra}` : ''} | ${def.note ?? ''} |`,
        );
    }
}

mkdirSync('docs', { recursive: true });
writeFileSync('docs/ENDPOINTS.md', lines.join('\n') + '\n');
console.log(`docs/ENDPOINTS.md 已生成：${ALL_ENDPOINTS.length} 个端点 / ${groups.size} 个域`);
