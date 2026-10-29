/**
 * SSA 二次验证模拟（sid / edt 生成）。
 *
 * 对齐参考实现 generateSimulate：
 * - 随机鼠标轨迹（贝塞尔曲线 + 抖动）拼装事件流
 * - edt = AES-128-CBC(md5(rand16)[0:16], iv 固定) 加密事件串
 * - sid = RSA-OAEP-SHA256 加密 AES key，base64
 *
 * @module
 */

import {
    createCipheriv,
    createHash,
    publicEncrypt,
    constants as cryptoConstants,
    randomBytes,
} from 'node:crypto';

import { randomString } from './crypto';
import { md5 } from './sign';

const SECURITY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoW2+Ylo8ALePSQTP0xBF
lFmEOHvBD9tS+s7DBlfKEu3RzzvZTaX1JtYbX4+AVUqj6ARz8IM+CKByqGFvbHN/
W64XxNI+q7z36ajCL3VTJ2W5G9MCJitc6oGbire4NQfhaEq0nC+hxBWQvCbIFflA
2ItrLUbSU7z1bHA/a+jlQm4OWvY+IKnTryOJTPuT1yNOVjbJ8wBLKy2DgQr9pPqW
PmEQtGpR5IM9V8Kao6PaSdKYOWGbX3i2+RzIKhvZUxxtJwdVbqPlDPlW9h4/xIBc
56Lgvr4aIl8nFtwbj4UJVUTFuGrs0tY9H/tXvZ22dUCKuGxW/gW7ZF+gXz6vHtYa
rQIDAQAB
-----END PUBLIC KEY-----`;

const SECURITY_IV = 'kugousecurity123';

/** Node 环境下的 WebGL 指纹模拟：随机 uint64 字符串 */
export function generateWebGLHash(): string {
    const hi = Math.floor(Math.random() * 0xffffffff);
    const lo = Math.floor(Math.random() * 0xffffffff);
    return (BigInt(hi) * BigInt(0x100000000) + BigInt(lo)).toString();
}

function ri(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 三阶贝塞尔轨迹（带随机抖动） */
function bezierPath(
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    n: number,
): { x: number; y: number }[] {
    const c1x = sx + (ex - sx) * 0.3 + ri(-80, 80);
    const c1y = sy + (ey - sy) * 0.2 + ri(-60, 60);
    const c2x = sx + (ex - sx) * 0.7 + ri(-60, 60);
    const c2y = sy + (ey - sy) * 0.8 + ri(-40, 40);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        const x = u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex;
        const y = u * u * u * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey;
        const jitter = Math.max(0.5, 3 - t * 2.5);
        pts.push({ x: x + (Math.random() - 0.5) * jitter, y: y + (Math.random() - 0.5) * jitter });
    }
    return pts;
}

/** 模拟事件流（鼠标 / 滚动 / 窗口事件 + 哨兵记录） */
function generateEdtData(
    opts: { startX: number; startY: number; endX: number; endY: number; mousePoints: number },
    sentinel: number,
): string {
    const { startX, startY, endX, endY, mousePoints } = opts;
    const entries: string[] = [];
    let ts = 0;
    let ei = 0;
    const f3 = (t: number, i: number, x: number, y: number) => `3,${t},${i},${x},${y}`;
    const f5 = (t: number, i: number) => `5,${t},${i}`;
    const f6 = (t: number, i: number, x: number, y: number) => `6,${t},${i},${x},${y}`;
    const fs3 = (i: number, x: number, y: number) => `3,${sentinel},${i},${x},${y}`;
    const fs5 = (i: number) => `5,${sentinel},${i}`;
    const fs6 = (i: number, x: number, y: number) => `6,${sentinel},${i},${x},${y}`;

    entries.push(f5(0, 0), fs5(0), f5(0, 0), fs5(0));
    ts += ri(5, 20);
    entries.push(f6(ts, ei, 750, 500), fs6(ei, 750, 500));
    ei++;
    for (let i = 0; i < 3; i++) {
        ts += ri(80, 600);
        entries.push(f5(ts, ei), fs5(ei));
        ei++;
    }
    const path = bezierPath(startX, startY, endX, endY, mousePoints);
    let si = 0;
    for (let i = 0; i < path.length; i++) {
        const point = path[i] ?? { x: 0, y: 0 };
        const { x, y } = point;
        ts += ri(8, 50);
        entries.push(
            f3(ts, si, Math.round(x), Math.round(y)),
            fs3(si, Math.round(x), Math.round(y)),
        );
        if (i > 0 && i % 12 === 0) {
            ts += ri(20, 60);
            entries.push(f5(ts, ei), fs5(ei));
            ei++;
        }
        si = (si + 1) % 2;
    }
    ts += ri(5, 30);
    entries.push(f3(ts, 1, Math.round(endX + ri(-5, 5)), Math.round(endY + ri(-5, 5))));
    entries.push(fs3(1, Math.round(endX), Math.round(endY)));
    return entries.join(':');
}

export interface SimulateInput {
    mid?: string | number;
    userid?: string | number;
    dfid?: string;
    webglHash?: string;
}

/** 生成 sid / edt（对齐参考 generateSimulate） */
export function generateSimulate(input: SimulateInput = {}): { edt: string; sid: string } {
    const sentinel = 0xffffffff - Math.floor(Math.random() * 20);
    const key = md5(randomString(16)).substring(0, 16);
    const points = ri(30, 60);
    const startX = ri(200, 600);
    const startY = ri(200, 500);
    const endX = ri(500, 700);
    const endY = ri(80, 150);
    const mid = input.mid || 0;
    const userid = input.userid || 0;
    const dfid = input.dfid || 0;
    const webglHash = input.webglHash || generateWebGLHash();
    const ts = Date.now();

    const data = generateEdtData({ startX, startY, endX, endY, mousePoints: points }, sentinel);
    const sidPlaintext = `mid=${mid};userid=${userid};dfid=${dfid};webgl=${webglHash};webdriver=0;ts=${ts};data=${data}`;

    const cipher = createCipheriv(
        'aes-128-cbc',
        Buffer.from(key, 'utf8'),
        Buffer.from(SECURITY_IV, 'utf8'),
    );
    const edt = Buffer.concat([
        cipher.update(Buffer.from(sidPlaintext, 'utf8')),
        cipher.final(),
    ]).toString('base64');

    const sid = publicEncrypt(
        {
            key: SECURITY_PUBLIC_KEY,
            padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        Buffer.from(key, 'utf8'),
    ).toString('base64');
    return { edt, sid };
}

/** 供 verify 类接口使用的辅助：随机 hex（8 字节） */
export function randomHex8(): string {
    return randomBytes(8).toString('hex');
}

/** createHash 暴露（login_device_kick 等模块用） */
export { createHash };
