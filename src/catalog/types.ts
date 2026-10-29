/**
 * 端点目录类型定义。
 *
 * 目录条目描述"如何调用一个酷狗端点"：
 * - 常规条目：静态 method/url + query/body 构建函数（由脚本从参考实现生成）
 * - 特殊条目：`handler` 完全接管（登录族 / 加密 POST 族 / 复合流程）
 *
 * @module
 */

import type { KuGouClient } from '../client';
import type { QueryRecord } from '../types';

/** 目录条目的 HTTP 方法 */
export type EndpointMethod = 'GET' | 'POST' | 'DELETE';

/** call() 的宽松参数类型：原样传给端点的模块级参数 */
export type CallParams = Record<string, any>;

/**
 * query / body 构建函数与 handler 共享的调用上下文：
 * 身份字段与会话来自客户端当前状态，时间戳每次调用刷新。
 */
export interface CallCtx {
    /** 当前秒级时间戳 */
    clienttime: number;
    /** 平台（standard / lite） */
    platform: 'standard' | 'lite';
    appid: number;
    clientver: number;
    srcappid: number;
    /** 会话身份（未注册时 dfid='-'、mid=md5(dfid)、token/userid 为空/0） */
    mid: string;
    dfid: string;
    uuid: string;
    token: string;
    userid: number;
    /** 会员信息（登录后写入会话；未登录为 0 / ''） */
    vipType: number;
    vipToken: string;
    /** signParamsKey(data)：md5(appid+盐+clientver+data)；可显式覆盖 appid/clientver */
    signParamsKey(data: string | number, appid?: number, clientver?: number): string;
    /** tracker key：md5(hash+盐+appid+mid+userid) */
    trackerKey(hash: string): string;
    /** 参考实现的 cryptoMd5（对象会先 JSON 序列化） */
    md5(data: unknown): string;
    /** 无填充 RSA（登录族 pk 参数）：hex */
    rsaEncryptRaw(data: unknown): string;
    /** RSA PKCS#1 v1.5（加密 POST 族 p 参数）：hex 小写 */
    rsaEncryptHex(data: unknown): string;
    /** sessionCipher 加密（加密 POST 族 body）：{body(base64), key(6位)} */
    sessionCipher(data: unknown): { body: string; key: string };
    /** sessionCipher 解密（base64 密文） */
    sessionCipherDecrypt(payload: string, key: string): unknown;
    /** cryptoAes 加密（登录族 params 字段）：{str(hex), key(16位)} */
    aesHex(
        data: unknown,
        opt?: { key?: string; iv?: string },
    ): { str: string; key: string } | string;
    /** cryptoAes 解密（hex 密文） */
    aesHexDecrypt(data: string, key: string, iv?: string): unknown;
    /** 发起一次常规网关请求（自动注入身份参数并解包信封） */
    request<T = unknown>(path: string, options?: GatewayRequestOptions): Promise<T>;
    /** 在 handler 内调用目录中的另一个端点（避免构建完整 ctx） */
    callInner<T = unknown>(id: string, params?: CallParams): Promise<T>;
    /** 发起一次原始请求（不解包、不注身份），供特殊协议使用 */
    raw(options: RawRequestOptions): Promise<RawResult>;
    /** 持久化登录结果（token/userid 等）到客户端会话 */
    applyLogin(data: Record<string, unknown>): void;
    /** 客户端实例（会话导出等高级用法） */
    client: KuGouClient;
}

/** ctx.request 的选项（client.request 的子集） */
export interface GatewayRequestOptions {
    method?: EndpointMethod;
    query?: QueryRecord;
    /** JSON 请求体（对象自动序列化） */
    json?: unknown;
    router?: string;
    headers?: Record<string, string>;
    baseUrl?: string;
    sign?: 'android' | 'web' | false;
    clearParams?: boolean;
}

/** ctx.raw 的选项 */
export interface RawRequestOptions {
    method?: EndpointMethod;
    url: string;
    query?: QueryRecord;
    headers?: Record<string, string>;
    body?: string | Uint8Array;
    timeoutMs?: number;
    retries?: number;
    /** fetch 重定向策略（QR 登录链路需 manual） */
    redirect?: 'follow' | 'manual' | 'error';
}

/** ctx.raw 的返回 */
export interface RawResult {
    status: number;
    ok: boolean;
    bytes: Uint8Array;
    contentType: string;
    /** 响应头（fetch Headers 实例，可用于读 set-cookie） */
    responseHeaders: Headers;
    /** 文本形式（懒解析） */
    text(): string;
    /** JSON 解析（失败返回 undefined） */
    json(): unknown;
}

/** 端点目录条目 */
export interface EndpointDef {
    /** 目录 id（默认由 module 名下划线→点生成；多操作模块可覆盖） */
    readonly id?: string;
    /** 对应 KuGouMusicApi 模块名（下划线形式），用于覆盖度对账 */
    readonly module: string;
    readonly method: EndpointMethod;
    /** 请求路径（以 / 开头；默认走网关，origin 覆盖协议与主机） */
    readonly url: string;
    /** 覆盖源站（默认 https://gateway.kugou.com） */
    readonly origin?: string;
    /** x-router 头 */
    readonly router?: string;
    /** 额外请求头（静态字面量） */
    readonly headers?: Record<string, string>;
    /** 动态请求头（含 x-router / KG-THash 等运行时值） */
    readonly headersFn?: (p: CallParams, ctx: CallCtx) => Record<string, string>;
    /** 签名盐：android（默认）/ web / none */
    readonly salt?: 'android' | 'web' | 'none';
    /** 动态 URL（含路径参数 / 条件分支） */
    readonly urlOf?: (p: CallParams, ctx: CallCtx) => string;
    /** 查询参数构建（返回值与身份参数合并） */
    readonly query?: (p: CallParams, ctx: CallCtx) => QueryRecord;
    /** POST JSON 请求体构建 */
    readonly body?: (p: CallParams, ctx: CallCtx) => unknown;
    /** 注入 trackercdn key（基于 p.hash 计算，随后参与签名） */
    readonly trackerKey?: boolean;
    /** 不注入默认身份参数 */
    readonly clearParams?: boolean;
    /** 仅使用条目声明的请求头 */
    readonly clearHeaders?: boolean;
    /** 完全自定义处理器（登录族 / 加密 POST 族 / 复合流程） */
    readonly handler?: (p: CallParams, ctx: CallCtx) => Promise<unknown>;
    /** 需要登录态（文档性标记） */
    readonly auth?: boolean;
    /** 备注（协议族 / 已知问题） */
    readonly note?: string;
}

/** 条目构建辅助：module 名自动成为 id（下划线 → 点） */
export function e(
    module: string,
    method: EndpointMethod,
    url: string,
    options: Omit<EndpointDef, 'module' | 'method' | 'url'> = {},
): EndpointDef {
    return { module, method, url, ...options };
}
