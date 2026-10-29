/**
 * 目录与特殊 handler 共用的工具函数。
 *
 * @module
 */

import { inflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

/** _comment 族的 firstValue：第一个非空值（空串视为缺省） */
export function firstValue(...values: unknown[]): unknown {
    for (const value of values) {
        if (value !== undefined && value !== null && `${value}` !== '') return value;
    }
    return undefined;
}

/** compact：剔除 undefined/null/空串字段 */
export function compact<T extends Record<string, unknown>>(object: T): Partial<T> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(object)) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'string' && value === '') continue;
        out[key] = value;
    }
    return out as Partial<T>;
}

/** KRC 歌词解码：跳过 4 字节头 → 16 字节 XOR → zlib 解压 */
const KRC_XOR_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105];

export function decodeKrc(content: string): string {
    const bytes = new Uint8Array(Buffer.from(content, 'base64'));
    const body = bytes.slice(4);
    for (let i = 0; i < body.length; i++) {
        body[i] = (body[i] ?? 0) ^ (KRC_XOR_KEY[i % KRC_XOR_KEY.length] ?? 0);
    }
    try {
        return inflateSync(Buffer.from(body)).toString('utf8');
    } catch {
        return '';
    }
}

/** base64 / dataURL → Buffer（无效返回 null） */
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function normalizeBase64(input: string): Buffer | null {
    const base64 = (
        input.startsWith('data:') ? input.slice(input.indexOf(',') + 1) : input
    ).replace(/\s/g, '');
    if (base64 === '' || base64.length % 4 !== 0 || !BASE64_RE.test(base64)) return null;
    return Buffer.from(base64, 'base64');
}

/** 图片魔数检测（JPEG/PNG/GIF/BMP/WEBP） */
export function isImageBuffer(buf: Uint8Array): boolean {
    if (buf.length < 12) return false;
    const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    return (
        (b[0] === 0xff && b[1] === 0xd8) ||
        (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ||
        (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) ||
        (b[0] === 0x42 && b[1] === 0x4d) ||
        (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP')
    );
}

/** 解析 "a,b,c" / "a|b|c" / JSON 数组 → string[]（参考 splitList 简化版） */
export function splitList(value: unknown): string[] {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
    const text = String(value).trim();
    if (!text) return [];
    if (text.startsWith('[')) {
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
        } catch {
            // 回退到逗号分隔
        }
    }
    return text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
