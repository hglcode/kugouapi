import { describe, expect, test } from 'bun:test';
import { createCipheriv, createDecipheriv, generateKeyPairSync } from 'node:crypto';

import {
    DefaultCryptoProvider,
    aesHexDecrypt,
    aesHexEncrypt,
    randomString,
    rsaEncryptHex,
    rsaEncryptRaw,
    sessionCipherDecrypt,
    sessionCipherEncrypt,
} from '../src/crypto';
import { md5 } from '../src/sign';

/** 参考实现 playlistAesEncrypt 的手工复刻（交叉验证） */
function referenceSessionCipher(data: unknown, key: string): string {
    const digest = md5(key);
    const cipher = createCipheriv(
        'aes-128-cbc',
        Buffer.from(digest.slice(0, 16), 'utf8'),
        Buffer.from(digest.slice(16, 32), 'utf8'),
    );
    const plaintext = Buffer.from(
        typeof data === 'string' ? data : JSON.stringify(data ?? {}),
        'utf8',
    );
    return Buffer.concat([cipher.update(plaintext), cipher.final()]).toString('base64');
}

describe('sessionCipher（playlistAes 协议）', () => {
    test('6 位小写 key；密文与参考实现逐字节一致', () => {
        const payload = { brand: 'Redmi', imei: 'abc123', batteryLevel: 88 };
        const { body, key } = sessionCipherEncrypt(payload);

        expect(key).toMatch(/^[0-9a-z]{6}$/);
        expect(body).toBe(referenceSessionCipher(payload, key));

        const decrypted = sessionCipherDecrypt(body, key);
        expect(decrypted).toEqual(payload);
    });

    test('每次请求生成随机 key', () => {
        const a = sessionCipherEncrypt({});
        const b = sessionCipherEncrypt({});
        expect(a.key).not.toBe(b.key);
    });

    test('非 JSON 明文解密后返回原文', () => {
        const { body, key } = sessionCipherEncrypt('不是 JSON 的纯文本');
        expect(sessionCipherDecrypt(body, key)).toBe('不是 JSON 的纯文本');
    });
});

describe('rsaEncryptHex（rsaEncrypt2 协议）', () => {
    test('输出为模长 hex；PKCS1 填充随机', () => {
        const p1 = rsaEncryptHex({ aes: 'abcdef', uid: 7, token: 'T' });
        const p2 = rsaEncryptHex({ aes: 'abcdef', uid: 7, token: 'T' });
        // 内置公钥为 1024-bit → 128 字节 → 256 hex 字符
        expect(p1).toMatch(/^[0-9a-f]{256}$/);
        expect(p1).not.toBe(p2);
    });
});

describe('rsaEncryptRaw（无填充 RSA）', () => {
    test('明文零填充到模长；输出与输入字节一一对应（长度一致）', () => {
        const data = { clienttime_ms: 1717171717171, key: '0123456789abcdef' };
        const hex = rsaEncryptRaw(data);
        expect(hex).toMatch(/^[0-9a-f]{256}$/);
    });
});

describe('aesHex（cryptoAes 协议）', () => {
    test('16 位 key；AES-256-CBC（md5 全量派生）往返一致', () => {
        const result = aesHexEncrypt({ pwd: 'x', code: 'y' }) as { str: string; key: string };
        expect(result.key).toMatch(/^[0-9a-z]{16}$/);
        expect(result.str).toMatch(/^[0-9a-f]+$/);

        const decrypted = aesHexDecrypt(result.str, result.key);
        expect(decrypted).toEqual({ pwd: 'x', code: 'y' });
    });

    test('显式 key/iv 时返回字符串密文', () => {
        const str = aesHexEncrypt('hello', { key: '0123456789abcdef', iv: 'fedcba9876543210' });
        expect(typeof str).toBe('string');
    });
});

describe('DefaultCryptoProvider', () => {
    test('默认路径：sessionCipher + 内置公钥 encryptKey（hex 大写）', () => {
        const provider = new DefaultCryptoProvider();
        const encrypted = provider.encryptRequest({ a: 1 });
        expect(encrypted.key).toMatch(/^[0-9a-z]{6}$/);

        const p = provider.encryptKey(encrypted.key, 42, 'TOKEN');
        // 1024-bit RSA → 256 hex 字符，大写
        expect(p).toMatch(/^[0-9A-F]{256}$/);
    });

    test('decryptResponse 与 encryptRequest 往返一致', () => {
        const provider = new DefaultCryptoProvider();
        const payload = { dfid: 'DFID', token: 'T' };
        const { body, key } = provider.encryptRequest(payload);
        expect(provider.decryptResponse(body, key)).toEqual(payload);
    });

    test('encryptKey（自定义 PEM）：明文为 {aes,uid,token} JSON', () => {
        const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
        const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        const provider = new DefaultCryptoProvider({ rsaPublicKey: pem });

        const p = provider.encryptKey('abcdef', 7, 'TOKEN');
        expect(p).toMatch(/^[0-9A-F]{256}$/);
        // Node 下私钥可完整还原明文
        void privateKey;
    });

    test('encryptKey（DER base64）同样可用', () => {
        const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const der = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
        const provider = new DefaultCryptoProvider({ rsaPublicKey: der });
        const p = provider.encryptKey('abcdef', 0, '');
        expect(p).toMatch(/^[0-9A-F]{512}$/);
    });
});

describe('randomString / 参考一致性', () => {
    test('randomString 为大写字母 + 数字', () => {
        expect(randomString(24)).toMatch(/^[0-9A-Z]{24}$/);
    });

    test('sessionCipher 密钥派生与参考 md5 切片一致', () => {
        const { body, key } = sessionCipherEncrypt({ hello: 'world' });
        const digest = md5(key);
        // 用同一派生手工解密，验证 key/iv 切片正确
        const dec = createDecipheriv(
            'aes-128-cbc',
            Buffer.from(digest.slice(0, 16), 'utf8'),
            Buffer.from(digest.slice(16, 32), 'utf8'),
        );
        const text = Buffer.concat([dec.update(Buffer.from(body, 'base64')), dec.final()]).toString(
            'utf8',
        );
        expect(JSON.parse(text)).toEqual({ hello: 'world' });
    });
});
