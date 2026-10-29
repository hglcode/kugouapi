/**
 * 酷狗协议加密原语。
 *
 * 与社区参考实现（KuGouMusicApi）逐一对齐的公开协议：
 * - `sessionCipher`（playlistAes）：随机 6 位小写字母数字 key，
 *   AES key = md5(key)[0:16]、IV = md5(key)[16:32]，密文 base64。
 *   用于 register_dev / 云盘 / 收藏 / 歌单删除等"加密 POST"族。
 * - `rsaEncryptHex`（rsaEncrypt2）：RSA PKCS#1 v1.5，输出 hex。
 * - `aesHex`（cryptoAesEncrypt）：随机 16 位 key，AES-256-CBC
 *   （key = md5(k)[0:32]，IV = md5(k)[16:32]），密文 hex。登录族使用。
 * - `rsaEncryptRaw`（cryptoRSAEncrypt）：无填充 RSA（零填充后 modPow），hex。登录族 pk 使用。
 *
 * CryptoProvider 仍可整体注入替换（registerDevice 链路）。
 *
 * @module
 */

import {
    constants as cryptoConstants,
    createCipheriv,
    createDecipheriv,
    createPublicKey,
    publicEncrypt,
    randomBytes,
} from 'node:crypto';
import { Buffer } from 'node:buffer';

import { KuGouApiError } from './error';
import { md5 } from './sign';
import type { Platform } from './types';

/** 标准版内置 RSA 公钥（社区公开资料） */
export const STANDARD_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIAG7QOELSYoIJvTFJhMpe1s/g
bjDJX51HBNnEl5HXqTW6lQ7LC8jr9fWZTwusknp+sVGzwd40MwP6U5yDE27M/X1+
UR4tvOGOqp94TJtQ1EPnWGWXngpeIW5GxoQGao1rmYWAu6oi1z9XkChrsUdC6DJE
5E221wf/4WLFxwAtRQIDAQAB
-----END PUBLIC KEY-----`;

/** 概念版（lite）内置 RSA 公钥 */
export const LITE_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDECi0Np2UR87scwrvTr72L6oO0
1rBbbBPriSDFPxr3Z5syug0O24QyQO8bg27+0+4kBzTBTBOZ/WWU0WryL1JSXRTX
LgFVxtzIY41Pe7lPOgsfTCn5kZcvKhYKJesKnnJDNr5/abvTGf+rHG3YRwsCHcQ08
/q6ifSioBszvb3QiwIDAQAB
-----END PUBLIC KEY-----`;

// ─────────────────────────────────────────────────────────────
// 低层原语（纯函数，无状态）
// ─────────────────────────────────────────────────────────────

/** 参考实现的 randomString：大写字母 + 数字 */
export function randomString(len = 16): string {
    const pool = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let out = '';
    for (let i = 0; i < len; i++) out += pool[Math.floor(Math.random() * pool.length)];
    return out;
}

export interface SessionCipherResult {
    /** AES 密文（base64），作为 POST body */
    body: string;
    /** 6 位会话 key（RSA p 参数中回传服务端） */
    key: string;
}

/** "playlistAes"：随机 6 位 key → md5 派生 AES-128 key/IV → base64 密文 */
export function sessionCipherEncrypt(data: unknown): SessionCipherResult {
    const key = randomString(6).toLowerCase();
    return { key, body: sessionCipherRaw(data, key) };
}

function sessionCipherRaw(data: unknown, key: string): string {
    const digest = md5(key);
    const aesKey = Buffer.from(digest.slice(0, 16), 'utf8');
    const iv = Buffer.from(digest.slice(16, 32), 'utf8');
    const cipher = createCipheriv('aes-128-cbc', aesKey, iv);
    const plaintext = Buffer.from(
        typeof data === 'string' ? data : JSON.stringify(data ?? {}),
        'utf8',
    );
    return Buffer.concat([cipher.update(plaintext), cipher.final()]).toString('base64');
}

/** 对应解密：base64 密文 → JSON（失败时返回原文） */
export function sessionCipherDecrypt(payload: string, key: string): unknown {
    const digest = md5(key);
    const aesKey = Buffer.from(digest.slice(0, 16), 'utf8');
    const iv = Buffer.from(digest.slice(16, 32), 'utf8');
    const decipher = createDecipheriv('aes-128-cbc', aesKey, iv);
    const text = Buffer.concat([
        decipher.update(Buffer.from(payload, 'base64')),
        decipher.final(),
    ]).toString('utf8');
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

/** rsaEncrypt2：RSA PKCS#1 v1.5 加密 JSON 串，hex 小写（调用方按需大写） */
export function rsaEncryptHex(data: unknown, platform: Platform = 'standard'): string {
    const pem = platform === 'lite' ? LITE_RSA_PUBLIC_KEY : STANDARD_RSA_PUBLIC_KEY;
    const plaintext = Buffer.from(
        typeof data === 'string' ? data : JSON.stringify(data ?? {}),
        'utf8',
    );
    return publicEncrypt(
        { key: createPublicKey(pem), padding: cryptoConstants.RSA_PKCS1_PADDING },
        plaintext,
    ).toString('hex');
}

export interface AesHexResult {
    /** AES-256-CBC 密文（hex） */
    str: string;
    /** 随机 16 位 key（解密与 pk 参数使用） */
    key: string;
}

/** cryptoAesEncrypt：随机 16 位 key → md5 全量派生 AES-256 key / IV → hex 密文 */
export function aesHexEncrypt(
    data: unknown,
    opt: { key?: string; iv?: string } = {},
): AesHexResult | string {
    if (opt.key && opt.iv) {
        return aesHexRaw(data, opt.key, opt.iv);
    }
    const tempKey = opt.key || randomString(16).toLowerCase();
    return { str: aesHexRaw(data, tempKey), key: tempKey };
}

function aesHexRaw(data: unknown, tempKey: string, explicitIv?: string): string {
    const digest = md5(tempKey);
    const aesKey = Buffer.from(digest.slice(0, 32), 'utf8');
    const iv = Buffer.from(explicitIv ?? digest.slice(16, 32), 'utf8');
    const cipher = createCipheriv('aes-256-cbc', aesKey, iv);
    const plaintext = Buffer.from(
        typeof data === 'string' ? data : JSON.stringify(data ?? ''),
        'utf8',
    );
    return Buffer.concat([cipher.update(plaintext), cipher.final()]).toString('hex');
}

/** cryptoAesDecrypt：hex 密文 → JSON（失败时返回原文） */
export function aesHexDecrypt(data: string, key: string, iv?: string): unknown {
    const digest = md5(key);
    const aesKey = Buffer.from(digest.slice(0, 32), 'utf8');
    const realIv = Buffer.from(iv ?? digest.slice(16, 32), 'utf8');
    const decipher = createDecipheriv('aes-256-cbc', aesKey, realIv);
    const text = Buffer.concat([
        decipher.update(Buffer.from(data, 'hex')),
        decipher.final(),
    ]).toString('utf8');
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

/**
 * cryptoRSAEncrypt：无填充 RSA（明文零填充到模长后直接 modPow），hex。
 * 登录族的 pk 参数使用。
 */
export function rsaEncryptRaw(
    data: unknown,
    publicKeyPem?: string,
    platform: Platform = 'standard',
): string {
    const pem =
        publicKeyPem ?? (platform === 'lite' ? LITE_RSA_PUBLIC_KEY : STANDARD_RSA_PUBLIC_KEY);
    const key = createPublicKey(pem);
    const modulus = (key.asymmetricKeyDetails?.modulusLength ?? 1024) / 8;
    const buffer = Buffer.from(
        typeof data === 'string' ? data : JSON.stringify(data ?? {}),
        'utf8',
    );
    if (buffer.length > modulus) {
        throw new KuGouApiError('RSA 明文长度超过密钥长度', { code: 0 });
    }
    const padded = Buffer.alloc(modulus);
    buffer.copy(padded);
    return publicEncrypt({ key, padding: cryptoConstants.RSA_NO_PADDING }, padded).toString('hex');
}

/** RSA 公钥兼容 PEM / DER base64（SPKI / PKCS#1） */
export function loadPublicKey(key: string): ReturnType<typeof createPublicKey> {
    if (key.includes('-----')) return createPublicKey(key);
    const der = Buffer.from(key, 'base64');
    for (const type of ['spki', 'pkcs1'] as const) {
        try {
            return createPublicKey({ key: der, format: 'der', type });
        } catch {
            // 尝试下一种格式
        }
    }
    throw new KuGouApiError('无效的 RSA 公钥：既不是 PEM 也不是 DER base64（SPKI/PKCS#1）。', {
        code: 0,
    });
}

// ─────────────────────────────────────────────────────────────
// CryptoProvider（registerDevice 等可整体替换）
// ─────────────────────────────────────────────────────────────

/** encryptRequest() 的返回：密文请求体 + 会话 key */
export interface EncryptedRequest {
    /** AES 密文（base64），直接作为 POST body 发送 */
    body: string;
    /** 6 位会话 key（encryptKey 使用；响应解密也用它） */
    key: string;
}

/**
 * 加密提供者接口（对齐参考协议语义）：
 * - `encryptRequest(data)` — sessionCipher 加密，返回 {body, key}
 * - `decryptResponse(payload, key)` — payload 为响应字节的 base64
 * - `encryptKey(key, userid, token)` — 生成查询参数 `p`：
 *   `rsaEncryptHex({aes: key, uid: userid, token}).toUpperCase()`
 */
export interface CryptoProvider {
    encryptRequest(data: unknown): EncryptedRequest;
    decryptResponse(payload: string, key: string): unknown;
    encryptKey(key: string, userid: number, token: string): string;
}

/** 内置默认实现（参考协议逐位对齐，公钥内置，开箱即用） */
export class DefaultCryptoProvider implements CryptoProvider {
    private readonly platform: Platform;
    private readonly rsaPublicKey: string | undefined;

    constructor(options: { platform?: Platform; rsaPublicKey?: string } = {}) {
        this.platform = options.platform ?? 'standard';
        this.rsaPublicKey = options.rsaPublicKey;
    }

    encryptRequest(data: unknown): EncryptedRequest {
        return sessionCipherEncrypt(data);
    }

    decryptResponse(payload: string, key: string): unknown {
        return sessionCipherDecrypt(payload, key);
    }

    encryptKey(key: string, userid: number, token: string): string {
        const pem = this.rsaPublicKey;
        if (!pem) {
            return rsaEncryptHex({ aes: key, uid: userid, token }, this.platform).toUpperCase();
        }
        // 用户注入了自定义公钥：保持与默认路径同样的明文格式
        const publicKey = loadPublicKey(pem);
        const plaintext = Buffer.from(JSON.stringify({ aes: key, uid: userid, token }), 'utf8');
        return publicEncrypt(
            { key: publicKey, padding: cryptoConstants.RSA_PKCS1_PADDING },
            plaintext,
        )
            .toString('hex')
            .toUpperCase();
    }
}

/** 便捷：按字节数据取 md5（与参考 cryptoMd5 的对象序列化行为一致） */
export function md5Of(data: unknown): string {
    return md5(typeof data === 'object' && data !== null ? JSON.stringify(data) : String(data));
}

/** 生成随机 KG-THash（7 位 hex） */
export function randomThash(): string {
    return randomBytes(4).toString('hex').slice(0, 7);
}
