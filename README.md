# 山野取景 · 旅行路书

摄影旅行项目的入口网站：首页按目的地、路线、题材搜索，按“计划中 / 历史路书”筛选。每趟旅行是自己的站点（任何公开 https 地址均可），首页只读取各自的 `trip.json` 并链接过去。例如皖南是四天候选计划，大兴安岭是历史归档，不表示旅行已完成。

网站：<https://real-jacket.github.io/travel-journal/>

## 快速开始

React + Vite + Tailwind CSS + shadcn/ui，Node ≥ 24（见 `.nvmrc`），pnpm 11（已由 volta 提供，无需 corepack）。

```sh
pnpm install --frozen-lockfile
pnpm dev        # 先同步旅行清单，再起 http://localhost:5173/travel-journal/
pnpm check      # 同步清单 + 测试 + 生产构建 + Sites 契约检查
pnpm preview    # 预览 dist/client 构建结果
pnpm trips:sync # 只抓取并校验清单，写入 src/data/trips.generated.json
```

站点路径固定为 `/travel-journal/`，与 GitHub Pages 一致。`dev`、`build`、`test` 都会先联网同步清单；本机若经代理而直连失败，在命令前加 `NODE_USE_ENV_PROXY=1`。

## 目录

| 路径 | 内容 |
|---|---|
| `trips.json` | 已收录旅行的清单地址（数组，顺序即首页顺序） |
| `src/` | 首页应用；`src/data/trip-schema.js` 校验清单，`trips.generated.json` 由同步生成（Git 忽略） |
| `scripts/` | `sync-trips.mjs` 与 Sites 构建脚本 |
| `public/trips/` | 旧路书地址的跳转页，指向新站点 |
| `skills/travel-journal/` | 把旅行加入首页的可复用技能 |
| `docs/` | 流程、清单规范与设计，索引见 [docs/README.md](docs/README.md) |

## 新增一趟旅行

见 [新增旅行](docs/add-a-trip.md)，字段规范见 [旅行清单规范](docs/trip-spec.md)：

- 做完整路书：`gh repo create <name> --template real-jacket/trip-template --public --clone`，按模板仓库的指南完成。
- 已有页面或文章：托管一份 `trip.json`，可选 `url` 指向该页面。
- 然后提 PR，在 `trips.json` 加一行清单地址；PR 的检查会抓取并校验它。

## 用 Claude Code / Codex

仓库技能 [travel-journal](skills/travel-journal/SKILL.md) 读取上述流程。Claude Code 通过 `.claude/skills/travel-journal` 自动发现，无需安装。Codex 需要在本机建一次链接；目标已存在时先核对指向，不要覆盖：

```sh
ln -s "$PWD/skills/travel-journal" "$HOME/.codex/skills/travel-journal"
```

## 部署

推送 `main` 触发 `.github/workflows/pages.yml`：同步清单、检查、构建并部署 GitHub Pages；每天另有一次定时重建，让旅行站点里 `trip.json` 的修改自动上首页。Pull Request 只运行 `pnpm check`，不部署。清单抓取失败会让检查或重建失败，已上线的首页保持不变。是否发布以用户当次要求为准。

## 资产与授权边界

- 封面和署名由各旅行站点提供，首页展示 `imageCredit` 并链接原作；摄影作品没有自动获得转载授权。
- 公开文件不含私有配置、平台临时签名、`.env` 和研究缓存。
