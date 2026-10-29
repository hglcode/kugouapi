/**
 * 协议常量与平台预设。
 *
 * 所有“魔法数字”集中在此，来源为公开的酷狗协议逆向资料与客户端抓包，
 * 可通过 ClientOptions 的 appid / clientver 覆盖。
 *
 * @module
 */

import type { Platform } from './types';

/** 平台基础配置 */
export interface PlatformConfig {
    appid: number;
    clientver: number;
}

export const PLATFORMS: Record<Platform, PlatformConfig> = {
    standard: { appid: 1005, clientver: 20489 },
    lite: { appid: 3116, clientver: 11440 },
};

/** 默认 API 网关 */
export const DEFAULT_BASE_URL = 'https://gateway.kugou.com';

/** 用户服务（register_dev）基础地址 */
export const REGISTER_BASE_URL = 'https://userservice.kugou.com';

/** 第三方登录 srcappid（登录族端点使用） */
export const SRCAPPID = 2919;

/** 微信 / QQ 开放平台参数（login_wx_* / login_qq_* 使用，可被 ClientOptions 覆盖） */
export const WX_APPIDS = {
    standard: { appid: 'wx79f2c4418704b4f8', secret: '4efcab88b700769e376e3f6087b8abc9' },
    lite: { appid: 'wx72b795aca60ad321', secret: '33e486041e5e25729a4e3d2da7502f9a' },
} as const;

export const QQ_APPIDS = {
    standard: '205141',
    lite: '101706348',
} as const;

/**
 * trackercdn（/v5/url）的平台相关固定参数，来自 Android 客户端抓包。
 */
export interface TrackerParams {
    pageId: number;
    pPageIds: string;
    pid: number;
    version: number;
    clientver: number;
}

export const TRACKER_PARAMS: Record<Platform, TrackerParams> = {
    standard: {
        pageId: 151369488,
        pPageIds: '463467626,350369493,788954147',
        pid: 2,
        version: 11430,
        clientver: 11430,
    },
    lite: {
        pageId: 967177915,
        pPageIds: '356753938,823673182,967485191',
        pid: 411,
        version: 11430,
        clientver: 11430,
    },
};

/** 未注册时的默认 mid（参考实现中的常量，可通过会话覆盖） */
export const DEFAULT_MID = '31460504985089440976998453790954693734';

/** 客户端标识请求头（酷狗服务端用于识别请求来源） */
export const CLIENT_HEADERS: Readonly<Record<string, string>> = {
    'kg-rc': '1',
    'kg-thash': '5d816a0',
    'kg-rec': '1',
    'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
};

/** register_dev 使用的 User-Agent */
export const DEFAULT_USER_AGENT = 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi';
