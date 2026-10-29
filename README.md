# kugou-api

非官方酷狗音乐 API 的 TypeScript 客户端库。基于 [@hglcode/httpclient](https://github.com/hglcode/httpclient)（重试 / 熔断 / per-attempt 超时），Bun / Node.js 26.13+ 双运行时，tsdown 构建。

- **271 个端点目录**：覆盖参考实现 [KuGouMusicApi](https://github.com/MakcRe/KuGouMusicApi)（main\@5d6c9f7，v1.6.2）的全部 234 个功能模块（搜索 / 播放地址 / 歌词 / 歌单 / 用户 / 评论 / 登录 / 云盘 / 一起听 / 概念版……），`client.call(id, params)` 一致调用、id 自动补全
- **内置会话**：注册 / 登录成功后 dfid / mid / token / userid / vip 信息自动携带，可导出恢复
- **协议完备**：android / web / register 签名、trackercdn key、加密 POST（sessionCipher）、cloudlist、登录族（AES+RSA）、评论族、KRC 歌词解码等全部对齐参考实现
- **生产级 HTTP 层**：@hglcode/httpclient 驱动——GET 幂等重试（Retry-After + 抖动）、per-attempt 超时、熔断器、可选限流与遥测；实例可注入，默认自动创建
- **可注入**：httpClient / fetch / logger / CryptoProvider 均可替换，测试友好（全部离线单测）

## 安装

```bash
bun add kugou-api      # Bun
npm add kugou-api      # Node.js ≥ 26.13
```

> 依赖 `@hglcode/httpclient`（未发布 npm）。本打包内已附带其本地源码副本（`../httpclient`，`file:` 依赖，含已构建 `dist/`），`bun install` 直接可用；单独获取时改用 git 源 `bun add github:hglcode/httpclient`（仓库带 `prepare` 脚本以在安装时产出 `dist/`，本库已声明 `trustedDependencies`）。

## 快速开始

```ts
import { KuGouClient, randomDevice } from 'kugou-api';

const client = new KuGouClient({ device: randomDevice() });

// ── 高频端点：类型化方法 ──
const result = await client.search({ keyword: '周杰伦', pageSize: 30 });
for (const song of result.lists) {
    const url = await client.songUrl({ hash: song.FileHash });
    console.log(song.FileName, url.url?.[0] ?? '(VIP 试听段)');
}

// ── 其余端点：目录派发（271 个，id 自动补全） ──
const rank = await client.call('rank.list');
const lyric = await client.call('lyric', { id, accesskey, decode: true });
const hot = await client.call('search.hot');
const comments = await client.call('comment.music', { mixsongid, page: 1 });
```

端点 id 由参考实现的模块名转换而来（下划线 → 点）：`rank_list` → `rank.list`、`song_url_new` → `song.url.new`、`login_qr_key` → `login.qr.key`。完整对照表见 [docs/ENDPOINTS.md](docs/ENDPOINTS.md)。

## 会话管理

酷狗网关 API **不依赖 HTTP Cookie**：身份凭证（dfid / mid / token / userid）以查询参数与请求头形式携带，由 `SessionSnapshot` 显式管理——注册 / 登录成功后自动写入，后续请求自动携带，可导出恢复。少数网页互操作端点（如 QQ 扫码登录 `login.qq.qr.create` → `login.qq.qr.check`）需要标准 Cookie，由端点将 cookie 字符串作为显式返回字段 / 入参透传，跨进程同样可用。

```ts
// 设备注册（内置参考协议加密与公钥，开箱即用）
await client.registerDevice();

// 登录成功后凭证自动写入（密码 / 验证码 / 扫码 / QQ / 微信）
await client.call('login.cellphone', { mobile, code });
await client.call('login.qr.check', { key }); // status=4 时自动写入
await client.call('login.token', { token, userid }); // 刷新登录

// 导出 / 恢复（跨进程持久化）
const snapshot = client.session;
const client2 = new KuGouClient({ session: snapshot! });
```

## 平台

```ts
// 概念版（lite）：appid / clientver / 签名盐自动切换
const lite = new KuGouClient({ platform: 'lite' });
```

## 定制

```ts
const client = new KuGouClient({
    device: myDevice, // 自定义设备信息
    httpClient: myHttp, // 注入 HTTP 客户端实例（默认自动创建）
    logger: console, // 注入日志（默认静默）
    ip: '1.2.3.4', // 透传真实 IP
    timeoutMs: 15_000, // per-attempt 超时（httpclient 路径）
    retries: 2, // GET 重试次数（httpclient 路径下为其 retry.maxRetries）
    crypto: { provider }, // 整体替换加密实现
});

await client.close(); // 优雅关闭内部创建的 HTTP 实例（进程退出前）
```

## HTTP 层（@hglcode/httpclient）

0.5.0 起库以 [@hglcode/httpclient](https://github.com/hglcode/httpclient)（[gitcode 镜像](https://gitcode.com/hglcode/httpclient)）作为运行时 HTTP 后端，默认自动创建并附带酷狗预设：`cookies: false`（网关会话走查询参数，避免 WAF Set-Cookie 自动回传）、`throwOnHttpError: false`（fetch 语义，2xx 判断由本库统一完成）。带来的能力：GET 幂等重试（指数退避 + 抖动 + Retry-After）、per-attempt 超时（每次尝试独立计时）、滑动窗口熔断（5xx 比例过高快速失败）、Bun 原生支持。

需要限流 / 遥测 / 连接池调优时，先建实例再注入：

```ts
import { KuGouClient, createKuGouHttpClient, randomDevice } from 'kugou-api';

const http = createKuGouHttpClient({
    timeout: 15_000,
    retry: { maxRetries: 2 },
    rateLimit: { requestsPerSecond: 10 }, // 令牌桶 QPS，降低风控风险
    // telemetry: { onEvent: (e) => console.log(e.type) },
});
const client = new KuGouClient({ device: randomDevice(), httpClient: http });
// ... http.stats 可读 P50/P95/P99、重试数、状态码分布
await http.close(); // 注入实例由调用方管理
```

测试与特殊用途仍可注入 `fetch`（`FetchLike` 形状，设置后不创建默认 HTTP 实例）；`wrapHttpClient()` 可把任意 `fetch(url, init)` 形状客户端包装为 `FetchLike`。完整示例见 [examples/httpclient.ts](examples/httpclient.ts)。

## 主要协议族

| 协议族     | 端点（示例）                                                     | 说明                                                          |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| 常规网关   | `search.song`、`rank.list`、`user.detail`…                       | android 签名 + 身份参数自动注入（绝大多数端点）               |
| trackercdn | `song.url`、`song.url.auth`、`video.url`                         | 自动生成 `key` 并参与签名（线上验证）                         |
| 加密 POST  | `user.cloud`、`mv.collect`、`playlist.del`                       | sessionCipher 加密 body，`p` = RSA({aes,uid,token})，响应解密 |
| cloudlist  | `playlist.update`、`playlist.sort`、`playlist.pic`               | RSA 会话串 + AES-CBC 请求/响应                                |
| 登录族     | `login`、`login.cellphone`、`login.token`、`login.qr.*`          | AES+RSA 参数加密，secu_params 自动解密并写会话                |
| 评论族     | `comment.*`、`song.barrage`                                      | `m.comment.service` 协议，`key` = signParamsKey               |
| 复合流程   | `song.url.auth.merge`、`user.cloud.upload`、`user.update.avatar` | 多步编排（取 auth → 播放 / BSS 分片上传 / 图床）              |
| 一起听     | `listen.together.*`（50 个操作）                                 | 原按 operation 分发，拆成独立端点                             |

## 线上验证状态

| 能力                       | 状态        | 说明                                                                    |
| -------------------------- | ----------- | ----------------------------------------------------------------------- |
| `search()` / `search.song` | ✅ 线上验证 | 真实结果 480 条                                                         |
| `songUrl()` / `song.url`   | ✅ 线上验证 | 免费歌返回真实 CDN URL；VIP 返回试听段（hash_offset）                   |
| 其余 269 个端点            | 🟡 协议对齐 | 参数与协议逐位对齐参考实现（含 60+ 特殊协议族手工移植），未逐一线上验证 |

`bun run smoke` 可随时跑真实链路冒烟（search + songUrl）。

## 开发

```bash
bun install            # 安装依赖（tsdown / oxlint / prettier 等）
bun run lint           # oxlint --type-aware（tsgolint 类型感知门禁）
bun run format         # prettier 全量格式化
bun run format:check   # 格式一致性检查
bun test               # 105 个离线单测（mock fetch + 真实 httpclient 集成）
bun run typecheck      # tsc --noEmit 严格检查
bun run build          # tsdown 构建 dist/
node scripts/node-compat.mjs   # 原生 Node 产物验证（含 RSA 私钥还原）
bun run docs:endpoints # 重新生成 docs/ENDPOINTS.md
bun run check          # 全部门禁（format + lint + typecheck + test + build）
```

### 质量门禁

CI 强制执行（见 `.github/workflows/ci.yml`，含 Node 26.13 / 24 兼容矩阵）：

- **lint**：oxlint + tsgolint 类型感知规则，`no-floating-promises` / `no-misused-promises` / `await-thenable` 开启为 error。未使用参数约定 `_` 前缀；目录协议层有意保留参考实现的宽松字符串转换（`no-base-to-string` / `restrict-template-expressions` 关闭）
- **format**：prettier（printWidth 100 / 4 空格缩进 / 单引号 / LF），`docs/ENDPOINTS.md` 由 `docs:endpoints` 生成后自动格式化
- **覆盖度**：`tests/catalog.test.ts` 内嵌官方模块清单（GitHub main\@5d6c9f7，234 个公开模块）——上游新增模块未覆盖时测试即失败，同步上游后更新该清单即可

## 与 0.4 版的差异（Breaking）

- **HTTP 后端替换**：运行时依赖 [@hglcode/httpclient](https://github.com/hglcode/httpclient)（git 源，未发布 npm），全局 fetch 默认路径替换为自动创建的客户端实例（cookies 关闭 / GET 重试 1 次 / 超时 10s / 熔断开启）；重试与超时语义升级为 per-attempt（此前为单 signal 覆盖含重试的全过程）
- **Node 最低版本 18 → 26.13**（httpclient 依赖 undici\@8）；Bun 1.x 不受影响
- 新增 `createKuGouHttpClient()` 预设工厂与 `KuGouClient.close()`（优雅关闭内部实例）；`options.httpClient` 注入实例，`options.fetch` 保留为测试 / 特殊用途
- 构建目标 node18 → node22

## 与 0.3 版的差异

- 新增 `playlist.share.official`（官方分享链接上报，对齐上游 \#293）
- 移除 `top.tag.card.youth`：上游已删除该模块，接口迁移至 `top.card.youth` 的 `card_id=3103` 分支（仍在调用旧 id 的请改传 `card_id: 3103`）
- 工程化：oxlint + tsgolint 类型感知 lint 门禁、prettier 统一格式、GitHub Actions CI（含 Node 兼容矩阵）

## 与 0.2 版的差异（Breaking）

- **加密协议对齐参考实现**：`CryptoProvider` 的 `encryptRequest` 返回 6 位会话 key（string），`encryptKey(key, userid, token)` 输出 RSA hex 大写；`registerDevice` 使用 android 签名（覆盖含 `p` 的全部参数）。公钥内置，无需再提供 `rsaPublicKey`
- `call(id, params)` 端点目录上线；`request()` 通用逃生舱保留
- 构建工具 tsup → **tsdown**
- `SessionSnapshot` 新增可选 `vipType` / `vipToken`

## License

MIT
