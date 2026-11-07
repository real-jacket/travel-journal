# 山野取景 · 旅行路书

一个集中管理摄影旅行项目的入口网站。目前包含皖南四天秋日自驾与大兴安岭九天南线追秋的完整路书。

- 首页可以按目的地、路线、题材搜索，并按“计划中 / 历史路书”筛选。
- 两份完整路书各自保留原有地图、行程、照片参考、住宿与出行准备。
- 皖南以 2026.11.19—22 为四天候选窗口；大兴安岭为当时行程的历史归档，不表示旅行已完成。

网站：<https://real-jacket.github.io/travel-journal/>

## 开发

使用 React、Vite、Tailwind CSS 和 shadcn/ui。Node.js 24，npm。

```sh
npm ci
npm run dev
```

默认路径为 `/travel-journal/`，与 GitHub Pages 项目路径一致。

```sh
npm test
npm run build
npm run preview
```

构建产物在 `dist/client/`。`main` 分支推送会由 `.github/workflows/pages.yml` 自动检查、构建并部署 GitHub Pages。Product Design 模板的可选 Sites 运行文件保留，但不会发布到 Pages。

## 新增旅行的标准流程

完整步骤见 [新增一份旅行路书](docs/add-a-trip.md)。从新计划开始和接入已有 HTML 都走同一条流程：需求 → 资料与专业成片 → 完整路书 → 清单接入 → 验证 → 按本次要求发布。

```sh
npm run trip:new -- yunnan-2027
```

命令只生成 `work/trips/yunnan-2027/brief.md` 与 `entry.json` 草稿，拒绝覆盖已有旅行。将示例 ID 换成下一次旅行的唯一名称，再填写 [需求模板](templates/trip-brief.md) 和 [入口字段模板](templates/trip-entry.json)。

把完整路书放到 `public/trips/<slug>/index.html`，加上 `../../` 返回首页；把封面与必需资产放到 `public/`，再把填写完成的清单项加入 `src/data/trips.js`。首页的推荐、年份、数量、搜索和无 JavaScript 入口由清单更新，不需要改首页组件或为第三份旅行修改测试。

首页推荐第一个“计划中”的项目，没有时回退到首项。要推荐新旅行，将它放在其他计划中项目之前。`planned` 表示计划中，`archived` 表示历史路书。

```sh
npm run check
```

这会运行资料/接入检查、生产构建和构建契约检查。之后实际验证桌面、手机与首页往返，再按本次要求提交；`main` 的 Pages 工作流会运行同样的检查并发布。

## 用 Codex 继续添加

仓库提供可复用技能 [travel-journal](skills/travel-journal/SKILL.md)。它读取上述流程与模板；本机安装后，下次可以直接说：

> 使用 $travel-journal 新增一份旅行计划：目的地、出发地、日期/天数、人数/预算、交通和拍摄重点如下……本次请接入首页并发布到 GitHub Pages。

也可以指定已有路书源文件，让它完成资产迁移、署名、入口和检查。仅需要本地草稿时，在请求中说明范围即可。本机技能入口指向仓库中的维护副本。

换电脑时先检出这个仓库，再在项目根目录建立技能链接；如果目标已存在，先核对它指向哪里，不覆盖已有技能：

```sh
ln -s "$PWD/skills/travel-journal" "$HOME/.codex/skills/travel-journal"
```

链接保留技能与仓库流程、模板的关系，拉取更新后无需复制多个版本。

## 资产与发布范围

首页图片放在 `public/images/`。正文及图片保留作者与原作出处；摄影作品没有自动获得转载授权，不把参考作品称为本人摄影。远程地图、平台原帖和大兴安岭页的 CDN 依赖需要网络。

本项目仅迁移运行所需资产；原始工作目录不变。私有地图配置、临时平台签名、`.env` 与研究缓存未发布。
