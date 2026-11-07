# 新增旅行流程核对记录

核对日期：2026-11-07。此次验证可复用流程与练习草稿，不代表新增了真实旅行。

## 可复用流程

1. 请求：明确目的地、出发地、日期/天数、人数/预算、交通与拍摄重点，以及本次是否要求上传/上线。
2. 资料与经典成片：建立来源台账，摄影师原作与官方资料交叉核对，区分发布日、拍摄日和未核实内容。
3. 路书与封面：完成逐日行程、整合地图、机位、吃住与补能；保留署名、原作链接和许可边界。
4. 清单：将完整路书与必需资产放入 `public/`，补回首页入口，填写 `src/data/trips.js`；草稿留在 `work/`。
5. 检查：执行 `npm run check`，确认资料/路径、生产构建与 Sites 构建契约。
6. 桌面与手机：在实际浏览器检查搜索/筛选、首页往返、图片、地图和核心交互，保存证据。
7. 发布：只按用户当次要求提交精确文件、推送；等待对应 commit 的 Pages 工作流，再单独核对公网内容。

细则见 [新增旅行流程](add-a-trip.md)，输入从 [需求模板](../templates/trip-brief.md) 与 [入口字段模板](../templates/trip-entry.json) 开始。

## 文档与代码一致性

- 核对 README、流程、两个模板、仓库技能、草稿脚本、清单、首页、Vite 与 Pages 工作流。
- 八个相对 Markdown 链接均指向存在的文件。
- `trip:new` 只生成草稿，不接入清单、不写 `public/`、不发布；非法 slug、已有 ID/路书或草稿均拒绝覆盖。
- 入口字段与检查约定一致；路线至少两个地点、题材至少一个，署名必填，本人照片可留空 `imageSource`。
- 首页主推首个 `planned`，无则首项；年份、数量、署名与无 JavaScript 链接来自清单，清单须非空。
- Pages 推送目标为 `main`，运行 `npm run check` 后发布 `dist/client/`。

## 练习草稿实测

实际运行：

```sh
npm run trip:new -- workflow-demo-2027
```

- 首次退出码 `0`，创建 `work/trips/workflow-demo-2027/`，目录恰好包含 `brief.md` 与 `entry.json`。
- `id` 为 `workflow-demo-2027`，`path` 为 `trips/workflow-demo-2027/`，`image` 为 `images/workflow-demo-2027.webp`。
- brief 中 slug 已替换，没有 `@@SLUG@@` 残留。
- 再运行退出码 `1`，提示“草稿已存在，请继续编辑原草稿；未覆盖任何文件。”
- 重跑前后两文件的 SHA256 相同；完整 `public/` 文件内容快照与清单 SHA256 也保持相同。
- `git check-ignore -v` 对两文件均命中 `.gitignore:9` 的 `work/` 规则。
- 练习草稿未加入公开清单或 `public/`，也未暂存、提交或推送。

## 本地检查与技能入口

- Node.js `v24.14.0`，npm `11.1.0`。
- 本轮 `npm run check` 退出码 `0`：内容/流程测试 `9/9`、Vite 生产构建成功、Sites 检查 `4/4`。
- 构建具备 `dist/client/index.html`、`dist/server/index.js` 与 `dist/.openai/hosting.json`。
- 本机 `~/.codex/skills/travel-journal` 是指向仓库 `skills/travel-journal/` 的符号链接，真实 `SKILL.md` 仍在仓库。
- 本机 `.codex/skills` 与 `.agents/skills` 未发现第二份同名入口；配置没有该技能的启停覆盖，未改本机配置或 memories。
- 根代理用 `uv run --quiet --with pyyaml python` 执行系统技能工具的 `quick_validate.py skills/travel-journal`，返回 `Skill is valid!`，技能格式验收通过。

## 浏览器验收

- 根代理实际使用 IAB 验收正式生产预览 `http://127.0.0.1:4180/travel-journal/`，视口为 `1280×720` 与 `390×844`。
- 两视口标题与三个首页图像正常，首个 `planned` 主推正确；搜索“方塘 电车”得一项，与历史状态交集为 Empty，恢复全部两项。
- 推荐→皖南→首页实际往返成功；两视口 `scrollWidth` 等于视口宽度，日志 warn/error 为零。
- 正式截图：`work/screenshots/workflow-main-desktop.jpg`、`work/screenshots/workflow-main-mobile.jpg`，根代理已通过 `view_image` 检查。
- 隔离三项样例在 `http://127.0.0.1:4181/travel-journal/` 经桌面1280px与手机390px验证，主推 `yunnan-2027-eval`，卡片年份为2027。
- 样例本人照片空 `imageSource` 渲染为署名 SPAN，无空链接；云南搜索一项、历史交集 Empty及恢复、推荐→无脚本静态样例→首页均成功。
- 样例手机返回入口44px，`scrollWidth=390`，日志为零；根代理核对隔离 `eval-results.json` 与第三份桌面/手机截图。
- 样例截图：`work/screenshots/workflow-third-desktop.jpg`、`work/screenshots/workflow-third-mobile.jpg`，已通过 `view_image` 检查；样例未迁入真实清单或 `public/`。

## 待独立验收的边界

- 公网结果等待本次提交部署后独立验收；本记录不提前宣称上线或线上通过。
- 本轮未开展真实新旅行研究，未重新验证地图服务、现场物候、路况、酒店、桩况与第三方图片转载许可。
- 手机为 IAB 视口验证，不代表真实手机硬件；发布授权仍以用户当次请求为准。
