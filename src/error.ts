/**
 * 统一错误类型。
 *
 * code 约定：
 * - `> 0`：酷狗业务错误（envelope 中的 error_code）或 HTTP 状态码
 * - `-1`：网络错误 / 超时（原始异常挂在 cause 上）
 * - `0`：未分类
 *
 * @module
 */

export interface KuGouErrorOptions {
    code?: number;
    /** 服务端返回的原始数据（JSON 已解析），便于排查 */
    payload?: unknown;
    cause?: unknown;
}

export class KuGouApiError extends Error {
    readonly code: number;
    readonly payload?: unknown;

    constructor(message: string, options: KuGouErrorOptions = {}) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = 'KuGouApiError';
        this.code = options.code ?? 0;
        this.payload = options.payload;
    }
}
