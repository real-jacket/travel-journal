# 旅行清单规范（trip.json）

首页只做入口：它读取 `trips.json` 里登记的清单地址，抓取每份 `trip.json`，校验后生成首页卡片。旅行本身放在任何公开的 https 站点上，**不要求是 GitHub 仓库**。

## 字段

| 字段 | 规则 |
|---|---|
| `id` | 唯一 slug，`^[a-z0-9]+(-[a-z0-9]+)*$` |
| `title`、`subtitle`、`region` | 非空字符串：旅行名、一句话、目的地片区 |
| `status`、`statusLabel` | `planned`（计划中）或 `archived`（历史路书）；`statusLabel` 非空，如“计划中”“历史路书”。日期已过不等于旅行完成 |
| `date`、`dateNote`、`duration` | `date` 以四位年份开头，如 `2027.03.12 — 03.15`；`dateNote` 说明候选/已定口径；`duration` 如 `3天2晚` |
| `transport`、`description`、`highlights` | 非空字符串 |
| `route` | 2–30 个非空字符串 |
| `tags` | 1–12 个非空字符串 |
| `image` | 封面地址，可相对 `trip.json` 所在地址；解析后必须是 https，且返回 `200` 与 `image/*` |
| `imageAlt`、`imageCredit` | 非空；`imageCredit` 必填署名 |
| `imageSource` | 原作 https 链接；本人照片写 `""` |
| `url` | 可选。路书本身的 https 地址；缺省为 `trip.json` 所在目录，如 `https://host/trip-x/` |

所有字符串不超过 300 个字符，`trip.json` 不超过 64 KB。解析后的 `url`、`image`、`imageSource` 只接受 `https:`，`http:`、`javascript:`、`data:` 等一律拒绝。未知字段被忽略。可抄的完整示例见 [examples/trip.json](examples/trip.json)。

## 托管要求

- 公开 https，无需登录；`trip.json` 与封面都能被匿名访问。
- 只想收录一篇别处的文章或页面时，托管一份 `trip.json`，把 `url` 指向该文章即可，不必做站点。

## 登记与检查

在 `trips.json`（地址数组，顺序即首页顺序）加一行清单地址并提 PR，见 [新增旅行](add-a-trip.md)。PR 的 `pnpm check` 会执行 `pnpm trips:sync`：地址唯一且为 https，清单可抓取（15 秒超时、3 次尝试）并通过校验，`id` 不重复，封面返回 `image/*`。任一失败即非零退出并指出地址，PR 不能合并；已上线的首页不受影响。

首页每天定时重建一次，所以在旅行仓库里改 `trip.json` 无需向首页提 PR，一天内自动更新；改坏了则当天重建失败，旧页面继续在线。
