import { describe, expect, test } from 'bun:test';

import { DEFAULT_DEVICE, calculateMid, deriveMid, randomDevice } from '../src/device';
import type { Device } from '../src/types';

describe('deriveMid / calculateMid', () => {
    test('deriveMid = md5(dfid)，固定向量（md5sum 外部计算）', () => {
        expect(deriveMid('-')).toBe('336d5ebc5436534e61d16e63ddfca327');
    });

    test('calculateMid：md5 hex 转十进制大整数，固定向量', () => {
        // md5('test-guid') = 77f0e1b81fcb6aa7e0ab3815b53c41d7
        expect(calculateMid('test-guid')).toBe('159428860874436022670369870932220854743');
    });

    test('calculateMid 输出为纯数字字符串（38~39 位）', () => {
        const mid = calculateMid('any-guid');
        expect(mid).toMatch(/^\d+$/);
        expect(mid.length).toBeGreaterThanOrEqual(38);
        expect(mid.length).toBeLessThanOrEqual(39);
    });
});

describe('device', () => {
    test('DEFAULT_DEVICE 满足 Device 类型且关键字段非空', () => {
        const d: Device = { ...DEFAULT_DEVICE };
        expect(d.brand).toBe('Redmi');
        expect(d.imei).toHaveLength(32);
        expect(d.uuid).toHaveLength(32);
    });

    test('randomDevice 每次生成不同标识', () => {
        const a = randomDevice();
        const b = randomDevice();
        expect(a.imei).not.toBe(b.imei);
        expect(a.uuid).not.toBe(b.uuid);
        expect(a.buildSerial).not.toBe(b.buildSerial);
    });

    test('randomDevice 保持 imei === uuid（协议惯例）', () => {
        const d = randomDevice();
        expect(d.imei).toBe(d.uuid);
        expect(d.imei).toMatch(/^[0-9a-f]{32}$/);
    });

    test('randomDevice 覆盖字段生效', () => {
        const d = randomDevice({ brand: 'HUAWEI', imei: 'x'.repeat(32) });
        expect(d.brand).toBe('HUAWEI');
        expect(d.imei).toBe('x'.repeat(32));
        expect(d.device).toBe(DEFAULT_DEVICE.device);
    });

    test('randomDevice 电量与存储在合理区间', () => {
        for (let i = 0; i < 20; i++) {
            const d = randomDevice();
            expect(d.batteryLevel).toBeGreaterThanOrEqual(20);
            expect(d.batteryLevel).toBeLessThanOrEqual(100);
            expect(d.availableRamSize).toBeGreaterThan(0);
        }
    });
});
