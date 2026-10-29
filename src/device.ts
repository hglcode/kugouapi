/**
 * 设备信息：内置示例设备与随机生成器。
 *
 * @module
 */

import { createHash, randomUUID } from 'node:crypto';

import type { Device } from './types';

const md5 = (data: string) => createHash('md5').update(data, 'utf8').digest('hex');

/**
 * 从 dfid 派生 MID：`md5(dfid)`。
 *
 * 已在线上验证：dfid 缺省（'-'）时 mid = md5('-') 可通过
 * trackercdn 的 key 校验；注册后优先使用服务端返回的 mid。
 */
export function deriveMid(dfid: string): string {
    return md5(dfid);
}

/**
 * KuGouMusicApi 生态的 MID 形态：把 md5 的十六进制串
 * 视作 128-bit 大整数并转为十进制字符串（38~39 位数字）。
 *
 * 如需与既有 Cookie 体系（KUGOU_API_MID）保持兼容时使用。
 */
export function calculateMid(input: string): string {
    let value = 0n;
    for (const ch of md5(input)) value = value * 16n + BigInt(parseInt(ch, 16));
    return value.toString();
}

/** 内置示例设备（Redmi marble，来自参考实现的抓包值） */
export const DEFAULT_DEVICE: Readonly<Device> = Object.freeze({
    availableRamSize: 4_983_533_568,
    availableRomSize: 48_114_719,
    availableSDSize: 48_114_717,
    basebandVer: '',
    batteryLevel: 100,
    batteryStatus: 3,
    brand: 'Redmi',
    buildSerial: 'unknown',
    device: 'marble',
    imei: '36ec3614ad302c846b72bed309aeb598',
    imsi: '',
    manufacturer: 'Xiaomi',
    uuid: '36ec3614ad302c846b72bed309aeb598',
    accelerometer: false,
    accelerometerValue: '',
    gravity: false,
    gravityValue: '',
    gyroscope: false,
    gyroscopeValue: '',
    light: false,
    lightValue: '',
    magnetic: false,
    magneticValue: '',
    orientation: false,
    orientationValue: '',
    pressure: false,
    pressureValue: '',
    step_counter: false,
    step_counterValue: '',
    temperature: false,
    temperatureValue: '',
});

const RAM_CHOICES = [2, 3, 4, 6, 8, 12, 16];

/**
 * 生成随机设备：随机 imei / uuid / buildSerial / 电量 / 存储空间，
 * 其余字段沿用内置机型。可通过 overrides 覆盖任意字段。
 */
export function randomDevice(overrides: Partial<Device> = {}): Device {
    const id = randomUUID().replace(/-/g, '');
    const ram = RAM_CHOICES[Math.floor(Math.random() * RAM_CHOICES.length)]! * 1024 ** 3;
    const rom = 32 * 1024 ** 2 + Math.floor(Math.random() * 4096) * 1024 ** 2;
    return {
        ...DEFAULT_DEVICE,
        imei: id,
        uuid: id,
        buildSerial: randomUUID().replace(/-/g, '').slice(0, 10),
        availableRamSize: ram,
        availableRomSize: rom,
        availableSDSize: rom,
        batteryLevel: 20 + Math.floor(Math.random() * 81),
        ...overrides,
    };
}
