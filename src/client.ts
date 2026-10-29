/**
 * KuGouClient：酷狗 API 客户端。
 *
 * 设计要点：
 * - 少量高频端点提供类型化方法（search / songUrl / registerDevice）
 * - `call(id, params)` 通过端点目录覆盖其余全部端点（200+），
 *   `request()` 作为通用逃生舱可调用任意端点
 * - registerDevice() / 登录类端点成功后自动维护会话凭证
 *   （dfid / mid / token / userid / vipType），后续请求自动携带；会话可导出恢复
 * - HTTP 层基于 @hglcode/httpclient（重试 / per-attempt 超时 / 熔断），
 *   实例可注入（options.httpClient），默认自动创建并由 close() 管理
 * - 签名、平台常量、加密均可定制，详见各模块
 *
 * @module
 */

import { Buffer } from 'node:buffer';

import { createKuGouHttpClient, type HttpClient, type HttpClientLike } from './adapters/httpclient';

import {
    CLIENT_HEADERS,
    DEFAULT_BASE_URL,
    DEFAULT_MID,
    DEFAULT_USER_AGENT,
    PLATFORMS,
    REGISTER_BASE_URL,
    TRACKER_PARAMS,
    SRCAPPID,
    type PlatformConfig,
} from './config';
import {
    aesHexDecrypt,
    aesHexEncrypt,
    DefaultCryptoProvider,
    md5Of,
    rsaEncryptHex,
    rsaEncryptRaw,
    sessionCipherDecrypt,
    sessionCipherEncrypt,
    type CryptoProvider,
} from './crypto';
import { DEFAULT_DEVICE, deriveMid } from './device';
import { KuGouApiError } from './error';
import { Http } from './http';
import { signature, signParamsKey, trackerKey, type SignKind } from './sign';
import type {
    ClientOptions,
    Device,
    JsonObject,
    JsonValue,
    Logger,
    Platform,
    QueryRecord,
    RegisterData,
    RegisterDeviceParams,
    RequestOptions,
    SearchData,
    SearchParams,
    SessionSnapshot,
    SongUrlData,
    SongUrlParams,
} from './types';
import { ENDPOINTS, type EndpointId } from './catalog';
import type {
    CallCtx,
    CallParams,
    EndpointDef,
    GatewayRequestOptions,
    RawRequestOptions,
    RawResult,
} from './catalog/types';

/** magic_ 前缀音质（走特殊音效通道） */
const MAGIC_QUALITIES = new Set(['piano', 'acappella', 'subwoofer', 'ancient', 'dj', 'surnay']);

/** 静默 logger：默认不产生任何输出 */
const silentLogger: Logger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
};

/**
 * 类型源桥：HttpClient（undici FetchInit 声明）与 HttpClientLike
 * （全局 RequestInit 声明）运行时结构一致，声明互不兼容，断言桥接。
 */
function asClientLike(client: HttpClient): HttpClientLike {
    return client as unknown as HttpClientLike;
}

export class KuGouClient {
    private readonly http: Http;
    private readonly crypto: CryptoProvider;
    private readonly logger: Logger;
    private readonly conf: PlatformConfig;
    private readonly platform: Platform;
    private readonly device: Readonly<Device>;
    private readonly baseUrl: string;
    private readonly ip: string | undefined;
    /** 内部创建的 HTTP 客户端实例（close() 时优雅关闭）；注入实例由调用方管理 */
    private readonly ownedHttpClient: HttpClient | null;
    private sessionData: SessionSnapshot | null;

    constructor(options: ClientOptions = {}) {
        this.platform = options.platform ?? 'standard';
        const base = PLATFORMS[this.platform];
        this.conf = {
            appid: options.appid ?? base.appid,
            clientver: options.clientver ?? base.clientver,
        };
        this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
        this.device = options.device ?? DEFAULT_DEVICE;
        this.logger = options.logger ?? silentLogger;
        this.ip = options.ip;
        this.sessionData = options.session ?? null;
        this.crypto =
            options.crypto?.provider ??
            new DefaultCryptoProvider({
                rsaPublicKey: options.crypto?.rsaPublicKey,
                platform: this.platform,
            });
        // HTTP 后端：注入实例 > 注入 fetch（mock/特殊用途）> 自动创建（含酷狗预设）
        // HttpClient（undici 类型源）与 HttpClientLike（全局 RequestInit 类型源）
        // 声明不兼容但运行时结构一致，统一经 asClientLike 桥接
        let httpClient: HttpClientLike | undefined = options.httpClient as
            HttpClientLike | undefined;
        if (!httpClient && !options.fetch) {
            const created = createKuGouHttpClient({
                timeout: options.timeoutMs ?? 10_000,
                retry: { maxRetries: options.retries ?? 1 },
            });
            this.ownedHttpClient = created;
            httpClient = asClientLike(created);
        } else {
            this.ownedHttpClient = null;
        }
        this.http = new Http({
            httpClient,
            fetch: options.fetch,
            timeoutMs: options.timeoutMs,
            retries: options.retries,
            logger: this.logger,
        });
    }

    // ─────────────────────────────────────────────────────────
    // 状态
    // ─────────────────────────────────────────────────────────

    /** 当前平台 */
    get platformId(): Platform {
        return this.platform;
    }

    /** 当前设备信息（只读） */
    get deviceInfo(): Readonly<Device> {
        return this.device;
    }

    /** 当前会话凭证（只读副本；未注册时为 null） */
    get session(): Readonly<SessionSnapshot> | null {
        return this.sessionData ? { ...this.sessionData } : null;
    }

    /** 手工设置会话凭证（用于恢复已保存的注册/登录状态） */
    setSession(session: SessionSnapshot): this {
        this.sessionData = { ...session };
        this.logger.info(`[kugou] session restored: dfid=${session.dfid} userid=${session.userid}`);
        return this;
    }

    /**
     * 优雅关闭内部创建的 HTTP 客户端（连接回收 / cookie 落盘）。
     * 仅关闭构造时自动创建的实例；注入的实例由调用方自行管理。
     * 进程退出前调用一次即可，重复调用安全。
     */
    async close(): Promise<void> {
        if (this.ownedHttpClient) await this.ownedHttpClient.close();
    }

    // ─────────────────────────────────────────────────────────
    // 类型化端点
    // ─────────────────────────────────────────────────────────

    /**
     * 搜索歌曲。
     *
     * @example
     * ```ts
     * const data = await client.search({ keyword: '周杰伦', page: 1, pageSize: 30 });
     * for (const song of data.lists) console.log(song.FileName, song.FileHash);
     * ```
     */
    async search(params: SearchParams): Promise<SearchData> {
        const { keyword, page = 1, pageSize = 30, correction = true } = params;
        return this.request<SearchData>('/v2/search/song', {
            router: 'complexsearch.kugou.com',
            query: {
                keyword,
                page,
                pagesize: pageSize,
                area_code: 1,
                dopicfull: 1,
                iscorrection: correction ? 1 : 0,
                platform: 'AndroidFilter',
                privilegefilter: 0,
            },
        });
    }

    /**
     * 获取播放地址。
     *
     * trackercdn 专属的 `key` 参数会自动生成并参与签名；
     * VIP 歌曲会返回试听段（hash_offset）而非完整 url。
     *
     * @example
     * ```ts
     * const data = await client.songUrl({ hash });
     * console.log(data.url?.[0]);
     * ```
     */
    async songUrl(params: SongUrlParams): Promise<SongUrlData> {
        const tracker = TRACKER_PARAMS[this.platform];
        const quality = normalizeQuality(params.quality ?? '128');
        const hash = params.hash.toLowerCase();

        // key 用与最终 query 一致的 mid / userid / appid 计算
        const identity = this.baseQuery();
        const key = trackerKey({
            hash,
            mid: String(identity['mid'] ?? '-'),
            userid: Number(identity['userid'] ?? 0),
            appid: this.conf.appid,
            platform: this.platform,
        });

        return this.request<SongUrlData>('/v5/url', {
            router: 'trackercdn.kugou.com',
            query: {
                hash,
                quality,
                key,
                album_id: Number(params.albumId ?? 0),
                album_audio_id: Number(params.albumAudioId ?? 0),
                area_code: 1,
                behavior: 'play',
                cmd: 26,
                pid: tracker.pid,
                pidversion: 3001,
                page_id: tracker.pageId,
                ppage_id: tracker.pPageIds,
                ssa_flag: 'is_fromtrack',
                version: tracker.version,
                clientver: tracker.clientver,
                cdnBackup: 1,
                module: '',
                IsFreePart: params.freePart ? 1 : 0,
            },
        });
    }

    /**
     * 注册设备，成功后自动缓存 dfid / mid / token / userid。
     *
     * 内置加密与社区参考实现（playlistAes + rsaEncrypt2）逐位对齐，
     * 公钥内置，开箱即用；如需替换可注入 options.crypto.provider。
     */
    async registerDevice(params: RegisterDeviceParams = {}): Promise<RegisterData> {
        const { userid = 0, token = '', ...deviceOverrides } = params;
        const payload = { ...this.device, ...stripEmpty(deviceOverrides) };

        const { body, key } = this.crypto.encryptRequest(payload);
        const p = this.crypto.encryptKey(key, userid, token);

        const clienttime = Math.floor(Date.now() / 1000);
        // register 沿用参考实现的 calculateMid 形态 mid；
        // 搜索/播放链路则用 deriveMid(dfid)（已线上验证，见 baseQuery）
        const mid = this.sessionData?.mid ?? DEFAULT_MID;
        const uuid = this.device.uuid || '-';
        const query: QueryRecord = {
            dfid: '-',
            mid,
            uuid,
            appid: this.conf.appid,
            clientver: this.conf.clientver,
            clienttime,
            part: 1,
            platid: 1,
            p,
        };
        query['signature'] = signature(query, { kind: 'android', platform: this.platform });

        const headers: Record<string, string> = {
            'User-Agent': DEFAULT_USER_AGENT,
            dfid: '-',
            mid,
            clienttime: String(clienttime),
            ...ipHeaders(this.ip),
        };

        const result = await this.http.request(`${REGISTER_BASE_URL}/risk/v3/r_register_dev`, {
            method: 'POST',
            query,
            headers,
            body,
        });
        if (!result.ok) {
            throw new KuGouApiError(`HTTP ${result.status}: register_dev 失败`, {
                code: result.status,
                payload: tryDecodeText(result.bytes),
            });
        }

        const decrypted = this.crypto.decryptResponse(
            Buffer.from(result.bytes).toString('base64'),
            key,
        );
        const data = unwrapEnvelope(decrypted) as RegisterData;
        this.applySession(data, decrypted);
        return data;
    }

    // ─────────────────────────────────────────────────────────
    // 端点目录派发
    // ─────────────────────────────────────────────────────────

    /**
     * 调用目录中的任意端点（覆盖参考实现的全部模块）。
     *
     * 参数使用各端点的原生命名（与参考实现一致），
     * 会话身份参数自动携带；返回值为解包后的 data。
     *
     * @example
     * ```ts
     * const data = await client.call('lyric', { hash, decode: true });
     * const list = await client.call('rank.list');
     * ```
     */
    async call<T = unknown>(id: EndpointId, params: CallParams = {}): Promise<T> {
        const def = ENDPOINTS[id] as EndpointDef | undefined;
        if (!def) throw new KuGouApiError(`未知端点：${id}`, { code: 0 });
        const p = params ?? {};
        const ctx = this.createCtx();

        if (def.handler) return def.handler(p, ctx) as Promise<T>;

        const path = def.urlOf ? def.urlOf(p, ctx) : def.url;
        const mapped = def.query ? def.query(p, ctx) : {};
        const query: QueryRecord = def.clearParams
            ? { ...stripEmpty(mapped) }
            : { ...this.baseQuery(), ...stripEmpty(mapped) };

        if (def.trackerKey && typeof query['hash'] === 'string' && query['hash'] !== '') {
            query['key'] = trackerKey({
                hash: String(query['hash']).toLowerCase(),
                mid: String(query['mid'] ?? ctx.mid),
                userid: Number(query['userid'] ?? ctx.userid ?? 0),
                appid: Number(query['appid'] ?? this.conf.appid),
                platform: this.platform,
            });
        }

        let body: string | undefined;
        if (def.body) {
            const payload = def.body(p, ctx);
            if (payload !== undefined)
                body = typeof payload === 'string' ? payload : JSON.stringify(payload);
        }

        const headers: Record<string, string> = def.clearHeaders ? {} : { ...this.commonHeaders() };
        if (def.router) headers['x-router'] = def.router;
        if (def.headers) Object.assign(headers, def.headers);
        if (def.headersFn) Object.assign(headers, def.headersFn(p, ctx));
        if (body !== undefined && !hasContentType(headers))
            headers['Content-Type'] = 'application/json';

        const signKind: SignKind | false = def.salt === 'none' ? false : (def.salt ?? 'android');
        if (signKind !== false && query['signature'] === undefined) {
            query['signature'] = signature(query, {
                kind: signKind,
                platform: this.platform,
                data: body,
            });
        }

        const origin = def.origin ?? this.baseUrl;
        const result = await this.http.request(`${origin}${path}`, {
            method: def.method,
            query,
            headers,
            body,
        });
        if (!result.ok) {
            throw new KuGouApiError(`HTTP ${result.status}: ${def.method} ${path}`, {
                code: result.status,
                payload: tryParseJson(result.bytes),
            });
        }
        const parsed = tryParseJson(result.bytes);
        if (parsed === undefined) {
            throw new KuGouApiError(`响应不是有效 JSON：${def.method} ${path}`, {
                code: 0,
                payload: tryDecodeText(result.bytes),
            });
        }
        return unwrapEnvelope(parsed) as T;
    }

    // ─────────────────────────────────────────────────────────
    // 通用请求
    // ─────────────────────────────────────────────────────────

    /**
     * 调用任意端点（自动附加平台基础参数与签名，可逐项关闭）。
     *
     * @example
     * ```ts
     * // 调用库未封装的端点
     * const data = await client.request('/v1/search/lyric', {
     *   query: { keyword: '晴天' },
     *   router: 'complexsearch.kugou.com',
     * });
     * ```
     */
    async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
        const method = options.method ?? 'GET';
        const query: QueryRecord = options.clearParams
            ? { ...stripEmpty(options.query) }
            : { ...this.baseQuery(), ...stripEmpty(options.query) };
        const signKind: SignKind | false = options.sign ?? 'android';
        if (signKind !== false && query['signature'] === undefined) {
            query['signature'] = signature(query, {
                kind: signKind,
                platform: this.platform,
                data: typeof options.body === 'string' ? options.body : undefined,
            });
        }

        const baseUrl = options.baseUrl ?? this.baseUrl;
        const headers: Record<string, string> = {
            ...this.commonHeaders(),
            ...(options.router ? { 'x-router': options.router } : {}),
            ...options.headers,
        };
        // JSON 请求体默认 application/json（对齐 axios 行为）
        if (options.body !== undefined && !hasContentType(headers)) {
            headers['Content-Type'] = 'application/json';
        }
        const result = await this.http.request(`${baseUrl}${path}`, {
            method,
            query,
            headers,
            body: options.body,
            timeoutMs: options.timeoutMs,
            retries: options.retries,
        });

        if (!result.ok) {
            throw new KuGouApiError(`HTTP ${result.status}: ${method} ${path}`, {
                code: result.status,
                payload: tryParseJson(result.bytes),
            });
        }
        const parsed = tryParseJson(result.bytes);
        if (parsed === undefined) {
            throw new KuGouApiError(`响应不是有效 JSON：${method} ${path}`, {
                code: 0,
                payload: tryDecodeText(result.bytes),
            });
        }
        return unwrapEnvelope(parsed) as T;
    }

    // ─────────────────────────────────────────────────────────
    // 内部
    // ─────────────────────────────────────────────────────────

    /** 构建目录调用上下文（身份 + 加密原语 + 请求能力） */
    private createCtx(): CallCtx {
        const session = this.sessionData;
        const dfid = session?.dfid ?? '-';
        const identity = this.baseQuery();
        const mid = String(identity['mid'] ?? '-');
        const platform = this.platform;
        return {
            clienttime: Math.floor(Date.now() / 1000),
            platform,
            appid: this.conf.appid,
            clientver: this.conf.clientver,
            srcappid: SRCAPPID,
            mid,
            dfid,
            uuid: String(identity['uuid'] ?? '-'),
            token: session?.token ?? '',
            userid: session?.userid ?? 0,
            vipType: session?.vipType ?? 0,
            vipToken: session?.vipToken ?? '',
            signParamsKey: (data, appid, clientver) =>
                signParamsKey(data, {
                    platform,
                    appid: appid ?? this.conf.appid,
                    clientver: clientver ?? this.conf.clientver,
                }),
            trackerKey: (hash) =>
                trackerKey({
                    hash,
                    mid,
                    userid: session?.userid ?? 0,
                    appid: this.conf.appid,
                    platform,
                }),
            md5: md5Of,
            rsaEncryptRaw: (data) => rsaEncryptRaw(data, undefined, platform),
            rsaEncryptHex: (data) => rsaEncryptHex(data, platform),
            sessionCipher: sessionCipherEncrypt,
            sessionCipherDecrypt,
            aesHex: (data, opt) => aesHexEncrypt(data, opt),
            aesHexDecrypt,
            request: <T = unknown>(path: string, options: GatewayRequestOptions = {}) =>
                this.request<T>(path, {
                    method: options.method,
                    query: options.query,
                    headers: {
                        ...(options.router ? { 'x-router': options.router } : {}),
                        ...options.headers,
                    },
                    body:
                        options.json === undefined
                            ? undefined
                            : typeof options.json === 'string'
                              ? options.json
                              : JSON.stringify(options.json),
                    baseUrl: options.baseUrl,
                    sign: options.sign,
                    clearParams: options.clearParams,
                }),
            callInner: <T = unknown>(id: string, params: CallParams = {}) =>
                this.call<T>(id as EndpointId, params),
            raw: (options: RawRequestOptions) =>
                this.http
                    .request(options.url, {
                        method: options.method,
                        query: options.query,
                        headers: options.headers,
                        body: options.body,
                        timeoutMs: options.timeoutMs,
                        retries: options.retries,
                        redirect: options.redirect,
                    })
                    .then((result): RawResult => ({
                        status: result.status,
                        ok: result.ok,
                        bytes: result.bytes,
                        contentType: result.contentType,
                        responseHeaders: result.headers,
                        text: () => new TextDecoder('utf-8', { fatal: false }).decode(result.bytes),
                        json: () => tryParseJson(result.bytes),
                    })),
            applyLogin: (data) => this.applySession(data as RegisterData, data),
            client: this,
        };
    }

    private baseQuery(): QueryRecord {
        const session = this.sessionData;
        const dfid = session?.dfid ?? '-';
        return {
            appid: this.conf.appid,
            clientver: this.conf.clientver,
            dfid,
            mid: session?.mid ?? deriveMid(dfid),
            uuid: session?.uuid ?? '-',
            clienttime: Math.floor(Date.now() / 1000),
            ...(session?.token ? { token: session.token } : {}),
            ...(session?.userid ? { userid: session.userid } : {}),
        };
    }

    private commonHeaders(): Record<string, string> {
        const session = this.sessionData;
        const dfid = session?.dfid ?? '-';
        const clienttime = String(Math.floor(Date.now() / 1000));
        return {
            ...CLIENT_HEADERS,
            dfid,
            mid: session?.mid ?? deriveMid(dfid),
            clienttime,
            ...ipHeaders(this.ip),
        };
    }

    /** 从注册/登录响应中提取凭证并合并进会话 */
    private applySession(data: RegisterData, raw: unknown): void {
        const source: JsonObject = (data && typeof data === 'object' ? data : {}) as JsonObject;
        const fallback: JsonObject =
            raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as JsonObject) : {};
        const pick = (key: string): JsonValue | undefined => source[key] ?? fallback[key];

        const dfidRaw = pick('dfid');
        const token = pick('token');
        const mid = pick('mid');
        const userid = pick('userid');
        const vipType = pick('vip_type');
        const vipToken = pick('vip_token');
        if (
            dfidRaw === undefined &&
            token === undefined &&
            mid === undefined &&
            userid === undefined &&
            vipType === undefined
        ) {
            this.logger.warn('[kugou] 响应中未发现凭证字段');
            return;
        }
        const previous = this.sessionData;
        const dfid = typeof dfidRaw === 'string' ? dfidRaw : (previous?.dfid ?? '-');
        this.sessionData = {
            dfid,
            mid: typeof mid === 'string' && mid ? mid : (previous?.mid ?? deriveMid(dfid)),
            uuid: typeof this.device.uuid === 'string' ? this.device.uuid : '-',
            token: typeof token === 'string' ? token : (previous?.token ?? ''),
            userid: typeof userid === 'number' ? userid : (previous?.userid ?? 0),
            vipType: typeof vipType === 'number' ? vipType : previous?.vipType,
            vipToken: typeof vipToken === 'string' ? vipToken : previous?.vipToken,
            registeredAt: Math.floor(Date.now() / 1000),
        };
        this.logger.info(`[kugou] session updated: dfid=${this.sessionData.dfid}`);
    }
}

// ─────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────

function normalizeQuality(quality: string): string {
    return MAGIC_QUALITIES.has(quality) ? `magic_${quality}` : quality;
}

function hasContentType(headers: Record<string, string>): boolean {
    return Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
}

function ipHeaders(ip: string | undefined): Record<string, string> {
    if (!ip) return {};
    return { 'X-Real-IP': ip, 'X-Forwarded-For': ip };
}

/** 解包响应信封；非信封结构原样返回。
 *
 * 支持两族信封：
 * - 网关族 `{status, error_code, data}`
 * - tracker 族 `{status, errcode, errmsg}`（如 /v5/url 出错时）
 */
function unwrapEnvelope(parsed: unknown): unknown {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
    const record = parsed as Record<string, unknown>;

    // tracker 族：出错时携带 errcode / errmsg（errcode 可能为字符串）
    if ('errcode' in record) {
        const errcode = Number(record['errcode']);
        const status = record['status'];
        if (errcode !== 0 && status !== 1) {
            throw new KuGouApiError(
                `酷狗 API 错误（errcode=${String(record['errcode'])}${
                    typeof record['errmsg'] === 'string' ? ` ${record['errmsg']}` : ''
                }）`,
                { code: errcode, payload: parsed },
            );
        }
    }

    // 网关族
    if ('status' in record && 'error_code' in record) {
        const status = record['status'];
        const errorCode = record['error_code'];
        const ok = (status === 1 || status === 200) && errorCode === 0;
        if (ok) return 'data' in record ? record['data'] : record;
        throw new KuGouApiError(`酷狗 API 错误（error_code=${String(errorCode)}）`, {
            code: typeof errorCode === 'number' ? errorCode : 0,
            payload: parsed,
        });
    }
    return parsed;
}

/** 剔除 undefined / null 条目（避免覆盖默认值；保留原类型） */
function stripEmpty<T extends object>(record: T | undefined | null): T {
    if (!record) return {} as T;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
        if (value === undefined || value === null) continue;
        result[key] = value;
    }
    return result as T;
}

function tryParseJson(bytes: Uint8Array): unknown {
    const text = tryDecodeText(bytes);
    if (!text) return undefined;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return undefined;
    }
}

function tryDecodeText(bytes: Uint8Array): string | undefined {
    try {
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
        return undefined;
    }
}
