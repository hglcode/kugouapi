import { describe, expect, test } from 'bun:test';

import { SIGN_SALTS, TRACKER_KEY_SALTS, md5, signature, trackerKey } from '../src/sign';

// 期望值由 GNU coreutils md5sum 独立计算（tests/vectors.md），
// 与实现本身无共享代码路径，可作外部交叉验证。

describe('signature', () => {
    test('register 盐：固定向量（md5sum 外部计算）', () => {
        expect(signature({ a: 1, b: 2 }, { kind: 'register' })).toBe(
            '47e07c526393f9ba10275796777b85d8',
        );
    });

    test('web 盐：含 UTF-8 关键词的固定向量', () => {
        expect(signature({ keyword: '周杰伦', page: 1 }, { kind: 'web' })).toBe(
            'b55b6d374a2ec6840000b8247afd237d',
        );
    });

    test('android standard 盐：固定向量', () => {
        expect(signature({ a: 1 }, { kind: 'android', platform: 'standard' })).toBe(
            '1e327cbf961f35919716aeabf27f8701',
        );
    });

    test('android lite 盐：固定向量', () => {
        expect(signature({ a: 1 }, { kind: 'android', platform: 'lite' })).toBe(
            '4b319095ce4ff6cac9023c646fb8e0eb',
        );
    });

    test('data 参与签名（非空时）', () => {
        expect(signature({ a: 1, b: 2 }, { kind: 'register', data: 'x' })).toBe(
            '292a0589917dc08ddd6750880c691944',
        );
        // 空 data 与不传 data 等价
        expect(signature({ a: 1, b: 2 }, { kind: 'register', data: '' })).toBe(
            signature({ a: 1, b: 2 }, { kind: 'register' }),
        );
    });

    test('key 排序不影响结果', () => {
        expect(signature({ b: 2, a: 1 }, { kind: 'register' })).toBe(
            signature({ a: 1, b: 2 }, { kind: 'register' }),
        );
    });

    test('undefined / null 键不参与签名', () => {
        expect(signature({ a: 1, b: undefined, c: null }, { kind: 'register' })).toBe(
            signature({ a: 1 }, { kind: 'register' }),
        );
    });

    test('android 各平台盐值互不相同', () => {
        expect(SIGN_SALTS.android.standard).not.toBe(SIGN_SALTS.android.lite);
        expect(SIGN_SALTS.register).toBe('1014');
        expect(SIGN_SALTS.web).toBe('NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt');
    });
});

describe('trackerKey（trackercdn key 参数）', () => {
    test('standard 盐：固定向量（md5sum 外部计算）', () => {
        expect(trackerKey({ hash: 'abc', mid: 'm', userid: 0, appid: 1005 })).toBe(
            '3044a4b4a532665d2a0859411f8f35ed',
        );
    });

    test('lite 盐：固定向量', () => {
        expect(
            trackerKey({ hash: 'abc', mid: 'm', userid: 7, appid: 3116, platform: 'lite' }),
        ).toBe('e3fc84a69ee6bc675cf64c48b587784e');
    });

    test('盐值随平台区分', () => {
        expect(TRACKER_KEY_SALTS.standard).not.toBe(TRACKER_KEY_SALTS.lite);
    });
});

describe('md5', () => {
    test('与 md5sum 外部计算一致', () => {
        expect(md5('-')).toBe('336d5ebc5436534e61d16e63ddfca327');
        expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    });
});
