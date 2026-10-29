/**
 * 端点目录注册表。
 *
 * `ENDPOINTS`：id（模块名下划线 → 点）→ EndpointDef；
 * `EndpointId`：全部可用端点 id 的字面量联合（自动补全 / 拼写检查）。
 *
 * @module
 */

import type { EndpointDef } from './types';
import { AUTO_ENDPOINT_IDS } from './ids.generated';
import { SPECIAL_ENDPOINT_IDS, specialEndpoints } from './special';
import { accountEndpoints } from './domains/account';
import { albumEndpoints } from './domains/album';
import { artistEndpoints } from './domains/artist';
import { commentEndpoints } from './domains/comment';
import { discoverEndpoints } from './domains/discover';
import { mediaEndpoints } from './domains/media';
import { playlistEndpoints } from './domains/playlist';
import { radioEndpoints } from './domains/radio';
import { sceneEndpoints } from './domains/scene';
import { searchEndpoints } from './domains/search';
import { songEndpoints } from './domains/song';
import { userEndpoints } from './domains/user';
import { verticalsEndpoints } from './domains/verticals';

/** 全部端点定义（常规生成 + 特殊协议手工移植） */
export const ALL_ENDPOINTS: EndpointDef[] = [
    ...searchEndpoints,
    ...songEndpoints,
    ...accountEndpoints,
    ...userEndpoints,
    ...playlistEndpoints,
    ...artistEndpoints,
    ...albumEndpoints,
    ...commentEndpoints,
    ...mediaEndpoints,
    ...discoverEndpoints,
    ...radioEndpoints,
    ...sceneEndpoints,
    ...verticalsEndpoints,
    ...specialEndpoints,
];

/** 目录条目 id：默认模块名下划线 → 点；多操作模块可 def.id 覆盖 */
export function endpointId(module: string, override?: string): string {
    return override ?? module.replace(/_/g, '.');
}

/** id → EndpointDef 注册表 */
export const ENDPOINTS: Readonly<Record<string, EndpointDef>> = Object.fromEntries(
    ALL_ENDPOINTS.map((def) => [endpointId(def.module, def.id), def]),
);

/** 全部端点 id 列表（含字面量类型，用于 call() 的自动补全） */
export const ENDPOINT_IDS = [...AUTO_ENDPOINT_IDS, ...SPECIAL_ENDPOINT_IDS] as const;

export type EndpointId = (typeof ENDPOINT_IDS)[number];

/** 按参考实现的模块名反查 */
export function endpointByModule(module: string): EndpointDef | undefined {
    return ENDPOINTS[endpointId(module)];
}
