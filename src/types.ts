/**
 * 公共类型定义（库的全部对外类型面）。
 *
 * @module
 */

import type { CryptoProvider } from './crypto';
import type { HttpClient, HttpClientLike } from './adapters/httpclient';
import type { SignKind } from './sign';

// ─────────────────────────────────────────────────────────────
// 基础
// ─────────────────────────────────────────────────────────────

/** 客户端平台标识 */
export type Platform = 'standard' | 'lite';

/** 音质标识；带 magic_ 前缀的场景（piano/acappella 等）由库内部处理 */
export type Quality =
    | 'piano'
    | 'acappella'
    | 'subwoofer'
    | 'ancient'
    | 'surnay'
    | 'dj'
    | '128'
    | '320'
    | 'flac'
    | 'high'
    | 'viper_atmos'
    | 'viper_clear'
    | 'viper_tape'
    | 'super';

/** 查询参数值：undefined / null 的键在签名与请求中都会被剔除；对象/数组以 JSON 文本发送 */
export type QueryValue =
    string | number | boolean | undefined | null | QueryValue[] | { [key: string]: QueryValue };
export type QueryRecord = Record<string, QueryValue>;

/** 通用 JSON 值（酷狗返回结构较松散，未显式声明的字段原样保留） */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

// ─────────────────────────────────────────────────────────────
// 设备
// ─────────────────────────────────────────────────────────────

/** 设备信息（register_dev 请求体，字段与酷狗协议一致） */
export interface Device {
    /** 可用内存，字节 */
    availableRamSize: number;
    /** 内部存储可用空间，字节 */
    availableRomSize: number;
    /** 外部存储可用空间，字节 */
    availableSDSize: number;
    /** 基带版本 */
    basebandVer: string;
    /** 电池电量百分比 0-100 */
    batteryLevel: number;
    /** 电池状态（3 = 正常） */
    batteryStatus: number;
    /** 品牌 */
    brand: string;
    /** 设备序号 */
    buildSerial: string;
    /** 设备代号 */
    device: string;
    /** IMEI 号 */
    imei: string;
    /** SIM 卡号序号 */
    imsi: string;
    /** 厂商 */
    manufacturer: string;
    /** 设备 UUID */
    uuid: string;
    /** 是否有加速度传感器 */
    accelerometer: boolean;
    accelerometerValue: string;
    /** 是否有重力传感器 */
    gravity: boolean;
    gravityValue: string;
    /** 是否有陀螺仪 */
    gyroscope: boolean;
    gyroscopeValue: string;
    /** 是否有光线传感器 */
    light: boolean;
    lightValue: string;
    /** 是否有磁力传感器 */
    magnetic: boolean;
    magneticValue: string;
    /** 是否有方向传感器 */
    orientation: boolean;
    orientationValue: string;
    /** 是否有压力传感器 */
    pressure: boolean;
    pressureValue: string;
    /** 是否有步数传感器 */
    step_counter: boolean;
    step_counterValue: string;
    /** 是否有温度传感器 */
    temperature: boolean;
    temperatureValue: string;
}

// ─────────────────────────────────────────────────────────────
// 会话
// ─────────────────────────────────────────────────────────────

/**
 * 注册/登录会话凭证：registerDevice() / 登录类端点成功后自动写入，
 * 后续请求自动携带；也可手工构造后通过 options.session 恢复。
 */
export interface SessionSnapshot {
    /** 设备指纹 ID */
    dfid: string;
    /** 设备 MID */
    mid: string;
    /** 设备 UUID */
    uuid: string;
    /** 用户登录令牌 */
    token: string;
    /** 用户 ID */
    userid: number;
    /** 会员类型（登录后可选） */
    vipType?: number;
    /** 会员令牌（登录后可选） */
    vipToken?: string;
    /** 注册时间（Unix 秒），仅本地记录 */
    registeredAt?: number;
}

// ─────────────────────────────────────────────────────────────
// 日志
// ─────────────────────────────────────────────────────────────

/** 注入式日志接口；console 可直接作为实现传入 */
export interface Logger {
    debug(message: string, ...meta: unknown[]): void;
    info(message: string, ...meta: unknown[]): void;
    warn(message: string, ...meta: unknown[]): void;
    error(message: string, ...meta: unknown[]): void;
}

// ─────────────────────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────────────────────

/** 可注入的 fetch 实现（默认使用全局 fetch） */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** 通用请求选项（client.request() 的入参） */
export interface RequestOptions {
    /** HTTP 方法，默认 GET */
    method?: 'GET' | 'POST' | 'DELETE';
    /** 端点专属查询参数（会与客户端基础参数合并，同名覆盖） */
    query?: QueryRecord;
    /** 附加请求头 */
    headers?: Record<string, string>;
    /** POST 请求体 */
    body?: string | Uint8Array;
    /** 覆盖基础 URL（默认网关地址） */
    baseUrl?: string;
    /** x-router 头：网关按此转发到对应后端服务 */
    router?: string;
    /** 签名方式，默认 'android'；false 关闭签名 */
    sign?: SignKind | false;
    /** 不注入默认身份参数（对齐参考实现的 clearDefaultParams） */
    clearParams?: boolean;
    /** 单次请求超时（毫秒） */
    timeoutMs?: number;
    /** 单次请求重试次数（仅 GET 生效） */
    retries?: number;
}

// ─────────────────────────────────────────────────────────────
// 客户端选项
// ─────────────────────────────────────────────────────────────

export interface ClientOptions {
    /** 平台，默认 standard */
    platform?: Platform;
    /** 网关基础 URL，默认 https://gateway.kugou.com */
    baseUrl?: string;
    /** 设备信息，默认内置示例设备（建议 randomDevice() 或自备） */
    device?: Device;
    /** 恢复已有会话凭证 */
    session?: SessionSnapshot;
    /** 日志实现，默认静默 */
    logger?: Logger;
    /** 注入自定义 fetch（测试 mock / 特殊用途）；设置后不创建默认 HTTP 客户端 */
    fetch?: FetchLike;
    /** 注入结构化 HTTP 客户端（@hglcode/httpclient 的 HttpClient，或等价的
     * fetch(url, init) 形状实现）；未提供且未提供 fetch 时自动创建
     * （cookies 关闭 / GET 重试 1 次 / 超时 10s） */
    httpClient?: HttpClientLike | HttpClient;
    /** 默认请求超时（毫秒），默认 10_000；httpclient 路径下为 per-attempt 语义 */
    timeoutMs?: number;
    /** GET 默认重试次数，默认 1；httpclient 路径下映射为其 retry.maxRetries */
    retries?: number;
    /** 透传客户端真实 IP（X-Real-IP / X-Forwarded-For） */
    ip?: string;
    /** 加密定制 */
    crypto?: CryptoOptions;
    /** 覆盖平台 appid */
    appid?: number;
    /** 覆盖平台 clientver */
    clientver?: number;
}

/** 加密定制选项 */
export interface CryptoOptions {
    /** 整体替换加密实现 */
    provider?: CryptoProvider;
    /** register_dev 内置实现所用的 RSA 公钥（PEM 或 DER base64） */
    rsaPublicKey?: string;
}

// 由 crypto.ts 提供，在此集中再导出以统一公共类型面
export type { CryptoProvider, EncryptedRequest } from './crypto';
export type { HttpClientLike } from './adapters/httpclient';

// ─────────────────────────────────────────────────────────────
// 端点参数
// ─────────────────────────────────────────────────────────────

/** search() 入参 */
export interface SearchParams {
    /** 搜索关键词 */
    keyword: string;
    /** 页码，默认 1 */
    page?: number;
    /** 每页数量，默认 30 */
    pageSize?: number;
    /** 是否开启纠错，默认 true */
    correction?: boolean;
}

/** songUrl() 入参 */
export interface SongUrlParams {
    /** 音乐文件 hash */
    hash: string;
    /** 音质，默认 '128' */
    quality?: Quality;
    /** 专辑 id */
    albumId?: string | number;
    /** 专辑音频 id */
    albumAudioId?: number;
    /** 是否返回试听片段（仅部分歌曲） */
    freePart?: boolean;
}

/** registerDevice() 入参：直接覆盖设备字段（imei / uuid 等） */
export type RegisterDeviceParams = Partial<Device> & {
    /** 已登录用户 id（可选） */
    userid?: number;
    /** 已登录令牌（可选） */
    token?: string;
};

// ─────────────────────────────────────────────────────────────
// 端点返回（字段与酷狗返回保持一致，未列出的原样保留）
// ─────────────────────────────────────────────────────────────

/** 搜索结果中的歌曲条目（未列出的字段以 unknown 原样保留） */
export interface SearchSong {
    /** 展示名，如 "周杰伦 - 晴天" */
    FileName: string;
    /** 音乐 hash */
    FileHash: string;
    /** HQ 音质 hash */
    HQFileHash?: string;
    /** SQ 音质 hash */
    SQFileHash?: string;
    /** 专辑 id */
    AlbumID?: string;
    /** 歌曲时长（秒） */
    Duration?: number;
    /** 歌手 id 列表 */
    SingerId?: number[];
    [key: string]: unknown;
}

/** search() 返回 */
export interface SearchData {
    lists: SearchSong[];
    total: number;
    [key: string]: unknown;
}

/** songUrl() 返回 */
export interface SongUrlData {
    /** 播放地址列表（免费歌曲） */
    url?: string[];
    /** 备用地址 */
    backup_url?: string[];
    /** 时长（秒） */
    timelength?: number;
    /** 文件大小（字节） */
    file_size?: number;
    /** 实际音质 */
    quality?: string;
    /** VIP 歌曲的试听段信息（end_ms 通常为 60000） */
    hash_offset?: {
        start_byte?: number;
        end_byte?: number;
        start_ms?: number;
        end_ms?: number;
        file_type?: number;
        offset_hash?: string;
        [key: string]: unknown;
    };
    /** 权益状态（0 = 需要版权/付费判定） */
    priv_status?: number;
    /** 无法播放的原因：pkg / buy / copyright 等 */
    fail_process?: string[];
    [key: string]: unknown;
}

/** registerDevice() 返回 */
export interface RegisterData {
    dfid?: string;
    mid?: string;
    token?: string;
    userid?: number;
    [key: string]: unknown;
}
