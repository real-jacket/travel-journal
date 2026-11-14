# 新增旅行

首页只是入口：每趟旅行放在自己的站点，首页读取 `trip.json` 来收录。以下路径相对项目根目录；清单字段与检查见 [旅行清单规范](trip-spec.md)。

## 执行分工

协调者负责需求与路线、设计决策、计划与任务拆解，以及独立最终验收。协调者同时负责分析与审核；实际执行交给用户指定的 Sonnet 5.5 子代理（high effort），分派时明确目标文件、预期行为与验收证据。执行者提交实际产物和检查结果，不能以自报成功代替协调者验收。发布仍遵守用户当前授权。

## 路线 A：做一份完整路书

从模板新建仓库（含地图工具、调研手册、brief 模板与制作技能），然后按该仓库的 [制作指南](https://github.com/real-jacket/trip-template/blob/main/docs/add-a-trip.md) 完成并发布：

```sh
gh repo create <name> --template real-jacket/trip-template --public --clone
```

路书站点需要发布 `trip.json`，并在路书里放回首页的入口：`https://real-jacket.github.io/travel-journal/`。

## 路线 B：已经有页面或文章

文章、相册或别人的网页都行，不必做站点。在任意公开 https 地址托管一份 `trip.json`（参照 [示例](examples/trip.json)），用可选的 `url` 指向该页面，封面放在可匿名访问的地址。

## 两条路线的最后一步

1. 确认 `trip.json` 与封面能被匿名访问。
2. 向本仓库提 PR，在 `trips.json` 加一行清单地址（顺序即首页顺序）。
3. 本地运行 `pnpm check`（会先抓取全部清单并校验）。若直连失败，本机经代理时用 `NODE_USE_ENV_PROXY=1 pnpm check`。
4. 在浏览器核对桌面（1280px）与手机（390px）：新卡片封面加载、可搜索、链接打开路书，无横向溢出。

首页主推第一个 `planned` 项，没有则取首项；要主推新计划，把它放在其他 `planned` 前面。清单至少保留一项，不为新旅行改首页组件、文案或测试。

## 发布

PR 合并到 `main` 才会部署 GitHub Pages；首页也会每天定时重建，让旅行仓库里对 `trip.json` 的修改自动生效。是否合并、推送或发布以用户当次要求为准：本流程和技能不授予未来任意旅行的空白发布授权。公开文件不含私有配置、平台临时签名或密钥。
