# 山野取景 · 旅行路书

集中管理摄影旅行项目的入口网站：首页按目的地、路线、题材搜索，按“计划中 / 历史路书”筛选；每份完整路书保留自己的地图、行程、照片参考、住宿与出行准备。例如皖南是四天候选计划，大兴安岭是历史归档，不表示旅行已完成。

网站：<https://real-jacket.github.io/travel-journal/>

## 快速开始

React + Vite + Tailwind CSS + shadcn/ui，Node ≥ 24（见 `.nvmrc`），pnpm 11（已由 volta 提供，无需 corepack）。

```sh
pnpm install --frozen-lockfile
pnpm dev        # http://localhost:5173/travel-journal/
pnpm check      # 测试 + 生产构建 + Sites 契约检查
pnpm preview    # 预览 dist/client 构建结果
```

站点路径固定为 `/travel-journal/`，与 GitHub Pages 一致；开发和预览服务都能直接打开 `/travel-journal/trips/<slug>/`。

## 目录

| 路径 | 内容 |
|---|---|
| `src/` | 首页应用 |
| `src/data/trips.js` | 旅行清单，首页由它生成 |
| `public/trips/<slug>/` | 每份完整路书及其运行资产 |
| `public/images/` | 首页封面 |
| `public/vendor/map/` | 路书共用的地图模块与本地 vendor（见 [地图选型](docs/map-selection.md)） |
| `scripts/` | 新建草稿、地图构建、Sites 构建脚本 |
| `templates/` | 需求 brief 与入口字段模板 |
| `skills/travel-journal/` | 新增旅行的可复用技能与调研手册 |
| `docs/` | 流程、设计与记录，索引见 [docs/README.md](docs/README.md) |
| `work/` | 本机草稿与研究资料，Git 忽略，不发布 |

## 新增一趟旅行

完整步骤见 [新增一份旅行路书](docs/add-a-trip.md)，新计划和已有 HTML 走同一条流程：

1. `pnpm trip:new <slug>` 生成 `work/trips/<slug>/` 草稿（不覆盖已有旅行）。
2. 填需求 brief，用 agent-reach 调研并记台账。
3. 做完整路书放入 `public/trips/<slug>/`，封面放 `public/images/`。
4. 把入口对象加入 `src/data/trips.js`，不必改首页组件或测试。
5. `pnpm check`，再在浏览器验收桌面与手机。

## 用 Claude Code / Codex

仓库技能 [travel-journal](skills/travel-journal/SKILL.md) 读取上述流程与模板。Claude Code 通过 `.claude/skills/travel-journal` 自动发现，无需安装。Codex 需要在本机建一次链接；目标已存在时先核对指向，不要覆盖：

```sh
ln -s "$PWD/skills/travel-journal" "$HOME/.codex/skills/travel-journal"
```

示例请求：

> 使用 $travel-journal 新增一份旅行计划：目的地、出发地、日期/天数、人数/预算、交通和拍摄重点如下……本次请接入首页并发布到 GitHub Pages。

## 部署

推送 `main` 触发 `.github/workflows/pages.yml`：检查、构建并部署 GitHub Pages。Pull Request 只运行 `pnpm check`，不部署。是否发布以用户当次要求为准。

## 资产与授权边界

- 正文和图片保留作者与原作出处；摄影作品没有自动获得转载授权，不把参考作品称为本人摄影。
- 远程地图瓦片、平台原帖和部分 CDN 依赖需要网络。
- 只迁移运行所需资产；私有地图配置、平台临时签名、`.env` 和研究缓存不进入公开文件。

## 文档

[docs/README.md](docs/README.md) 列出全部流程、设计、调研手册、模板与历史记录。
