/**
 * kugou-api 库入口。
 *
 * @example
 * ```ts
 * import { KuGouClient, randomDevice } from 'kugou-api';
 *
 * const client = new KuGouClient({ device: randomDevice() });
 * // 高频端点：类型化方法
 * const data = await client.search({ keyword: '周杰伦' });
 * // 其余端点：目录派发（270+，自动补全）
 * const rank = await client.call('rank.list');
 * const lyric = await client.call('lyric', { hash, decode: true });
 * ```
 *
 * @module
 */

// 客户端
export { KuGouClient } from './client';

// HTTP 后端（@glcoding/httpclient 集成）
export { createKuGouHttpClient, wrapHttpClient } from './adapters/httpclient';
export type { HttpClientLike, KuGouHttpClientOptions } from './adapters/httpclient';
export type { HttpClient, HttpClientOptions } from '@glcoding/httpclient';

// 端点目录
export { ENDPOINTS, ENDPOINT_IDS, ALL_ENDPOINTS, endpointId, endpointByModule } from './catalog';
export type { EndpointId } from './catalog';
export { e as defineEndpoint } from './catalog/types';
export type {
    EndpointDef,
    EndpointMethod,
    CallParams,
    CallCtx,
    GatewayRequestOptions,
    RawRequestOptions,
    RawResult,
} from './catalog/types';

// 签名
export {
    signature,
    trackerKey,
    signParamsKey,
    cloudKey,
    md5,
    SIGN_SALTS,
    TRACKER_KEY_SALTS,
    CLOUD_KEY_SALT,
} from './sign';
export type { SignKind, SignOptions, TrackerKeyInput, ParamsKeyOptions } from './sign';

// 加密原语（对齐参考协议）
export {
    DefaultCryptoProvider,
    sessionCipherEncrypt,
    sessionCipherDecrypt,
    rsaEncryptHex,
    rsaEncryptRaw,
    aesHexEncrypt,
    aesHexDecrypt,
    randomString,
    randomThash,
    md5Of,
    STANDARD_RSA_PUBLIC_KEY,
    LITE_RSA_PUBLIC_KEY,
    loadPublicKey,
} from './crypto';
export type { CryptoProvider, EncryptedRequest, SessionCipherResult, AesHexResult } from './crypto';

// 安全（SSA 模拟）
export { generateSimulate, generateWebGLHash } from './security';
export type { SimulateInput } from './security';

// 工具
export { decodeKrc, splitList, firstValue, compact } from './util';

// 设备
export { DEFAULT_DEVICE, randomDevice, deriveMid, calculateMid } from './device';

// 配置常量
export {
    PLATFORMS,
    TRACKER_PARAMS,
    DEFAULT_BASE_URL,
    REGISTER_BASE_URL,
    SRCAPPID,
    DEFAULT_MID,
    CLIENT_HEADERS,
    DEFAULT_USER_AGENT,
} from './config';
export type { PlatformConfig, TrackerParams } from './config';

// 错误
export { KuGouApiError } from './error';
export type { KuGouErrorOptions } from './error';

// 类型
export type {
    ClientOptions,
    CryptoOptions,
    Device,
    FetchLike,
    JsonObject,
    JsonPrimitive,
    JsonValue,
    Logger,
    Platform,
    Quality,
    QueryRecord,
    QueryValue,
    RegisterData,
    RegisterDeviceParams,
    RequestOptions,
    SearchData,
    SearchParams,
    SearchSong,
    SessionSnapshot,
    SongUrlData,
    SongUrlParams,
} from './types';
