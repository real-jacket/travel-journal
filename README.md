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

## 管理旅行

项目资料集中在 `src/data/trips.js`：标题、状态、时间、路线、题材、封面署名和路书路径。新增旅行时，把完整路书与其相对依赖放在 `public/trips/<旅行名>/`，并在该清单添加一项。

首页图片放在 `public/images/`。正文及图片保留作者与原作出处；摄影作品没有自动获得转载授权，不把参考作品称为本人摄影。远程地图、平台原帖和大兴安岭页的 CDN 依赖需要网络。

本项目仅迁移运行所需资产；原始工作目录不变。私有地图配置、临时平台签名、`.env` 与研究缓存未发布。
