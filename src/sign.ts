/**
 * 酷狗请求签名。
 *
 * 算法：`md5(salt + 按 key 排序的 "k=v" 串 + [data] + salt)`，
 * 盐值来自公开的客户端逆向资料。
 *
 * @module
 */

import { createHash } from 'node:crypto';

import type { Platform, QueryRecord } from './types';

/** 签名类型 */
export type SignKind = 'android' | 'register' | 'web';

/** 各签名类型的盐值；android 盐值随平台变化 */
export const SIGN_SALTS = {
    android: {
        standard: 'OIlwieks28dk2k092lksi2UIkp',
        lite: 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA',
    },
    register: '1014',
    web: 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt',
} as const;

/** trackercdn（/v5/url）key 参数的盐值，同样随平台变化 */
export const TRACKER_KEY_SALTS = {
    standard: '57ae12eb6890223e355ccfcb74edf70d',
    lite: '185672dd44712f60bb1736df5a377e82',
} as const;

/** signParamsKey 使用的平台盐值（与 android 签名同盐） */
const PARAMS_KEY_SALTS = {
    standard: 'OIlwieks28dk2k092lksi2UIkp',
    lite: 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA',
} as const;

/** 云盘（user_cloud_url）key 盐值 */
export const CLOUD_KEY_SALT = 'ebd1ac3134c880bda6a2194537843caa0162e2e7';

export interface TrackerKeyInput {
    /** 音乐文件 hash（小写） */
    hash: string;
    /** 设备 MID（与请求中携带的 mid 一致） */
    mid: string;
    userid: number;
    appid: number;
    /** 平台，默认 standard */
    platform?: Platform;
}

/**
 * 生成 trackercdn 接口的 `key` 参数：
 * `md5(hash + 盐 + appid + mid + userid)`，盐随平台变化。
 *
 * 注意：key 加入 query 后，signature 必须对含 key 的全部参数重新计算。
 */
export function trackerKey(input: TrackerKeyInput): string {
    const { hash, mid, userid, appid, platform = 'standard' } = input;
    const salt = TRACKER_KEY_SALTS[platform];
    return md5(`${hash}${salt}${appid}${mid}${userid}`);
}

/** 便捷 MD5（小写 hex） */
export function md5(data: string): string {
    return createHash('md5').update(data, 'utf8').digest('hex');
}

export interface SignOptions {
    /** 签名类型，默认 android */
    kind?: SignKind;
    /** android 签名时使用的平台，默认 standard */
    platform?: Platform;
    /** 参与签名的请求体（字符串或字节） */
    data?: string | Uint8Array;
}

/**
 * 生成请求签名。
 *
 * - query 按 key 字典序拼接为 `k1=v1k2=v2...`（值为原始值，不做 URL 编码）
 * - undefined / null 的键不参与签名（与“不发送该参数”保持一致）
 * - data 仅在非空时参与
 */
export function signature(query: QueryRecord, options: SignOptions = {}): string {
    const { kind = 'android', platform = 'standard', data } = options;
    const salt = kind === 'android' ? SIGN_SALTS.android[platform] : SIGN_SALTS[kind];

    const hasher = createHash('md5');
    hasher.update(salt, 'utf8');
    hasher.update(canonicalQuery(query), 'utf8');
    if (typeof data === 'string') hasher.update(data, 'utf8');
    else if (data && data.length > 0) hasher.update(data);
    hasher.update(salt, 'utf8');
    return hasher.digest('hex');
}

/** 拼接参与签名的规范化查询串（与参考实现一致：对象值 JSON.stringify） */
function canonicalQuery(query: QueryRecord): string {
    return Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('');
}

export interface ParamsKeyOptions {
    platform?: Platform;
    appid?: number;
    clientver?: number;
}

/**
 * `signParamsKey`：`md5(appid + 盐 + clientver + data)`。
 *
 * 大量网关端点用它作为 `key` 查询参数（评论、云盘、收藏等）。
 */
export function signParamsKey(data: string | number, options: ParamsKeyOptions = {}): string {
    const { platform = 'standard', appid, clientver } = options;
    const salt = PARAMS_KEY_SALTS[platform];
    const realAppid = appid ?? (platform === 'lite' ? 3116 : 1005);
    const realClientver = clientver ?? (platform === 'lite' ? 11440 : 20489);
    return md5(`${realAppid}${salt}${realClientver}${data}`);
}

/** 云盘播放（user_cloud_url）key：`md5("musicclound" + hash + pid + 盐)` */
export function cloudKey(hash: string, pid: string | number): string {
    return md5(`musicclound${hash}${pid}${CLOUD_KEY_SALT}`);
}
