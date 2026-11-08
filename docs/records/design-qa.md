# 山野取景 · 设计与浏览器验收

> 历史记录（2026-11-07 验收时写成），仅供回溯，当前流程以 [SOP](../add-a-trip.md) 为准。

final result: passed

## 视觉来源与比较

用户已选择既有路书的暖纸色、深绿摄影杂志风；不属于逐像素复制单一新页面。

- source visual truth: `docs/reference/anhui-editorial.png`，1395×768像素，既有皖南路书桌面截图。
- implementation: `work/screenshots/home-desktop-first.png`，1280×2305像素，IAB全页截图；CSS viewport 1280×720。
- full-view comparison: `work/screenshots/source-portal-comparison.png`，1568×560像素；将来源和实现首屏等比缩放到760像素宽同屏比较，不声称不同页面为逐像素一致。
- mobile: `work/screenshots/home-mobile-first.png`，390×3297像素；CSS viewport 390×844。另有 `home-mobile-viewport.png` 原始首屏截图。
- state: 首页默认全部路书；皖南计划中，大兴安岭历史路书。
- 通过view_image打开来源、桌面/手机实现及联合比较图，核对视觉；重点按钮与小字进一步使用DOM尺寸和状态验证。

## 必查表面

1. 字体：同类中文宋体大标题、Manrope配系统中文正文，深绿字与铁锈色重点；两行入口标题完整，卡片中文标题不截断，手机搜索16px防止输入放大。
2. 留白与布局：沿用杂志式大留白、左文右图、完整细边框；首页增加双路书卡片是入口产品所需内容，不复刻皖南的三行大标题或密集章节导航。桌面2列、手机1列，scrollWidth分别1280/390，与viewport一致。
3. 颜色：实际body背景为rgb(246,243,235)，与暖纸色来源一致，主文字/按钮使用#263b32。未增加背景渐变或单侧粗边条。
4. 图像：方塘原作和哈拉哈河原路书素材正确载入，首屏树列与倒影完整，卡片有对应来源链接；未把摄影参考当用户自摄。3个首页img complete且naturalWidth非零。
5. 文案：入口标题、目的地、候选日期、4天/9天、计划中/历史路书与真实来源一致；页面没有框架、接口、Key或部署说明。导航和CTA均指向完整路书。

## 功能验收

- 阿尔山+柴河搜索仅显示大兴安岭；计划中与该查询交集为空，显示Empty并可恢复全部2项。
- 计划中、历史路书与全部筛选实际更新；清除与重置正常。
- 桌面和390px手机的首页→大兴安岭→首页→皖南→首页均完成。
- 两页回首页按钮都保持44px点击高度且可见；两页手机无横向溢出。
- 大兴安岭D4照片正确读取opt2资源；追加额尔古纳与纯南线路线切换有效。
- 皖南D2地图同步日期、机位、住宿与山路补能；方塘成片放大/关闭有效。
- IAB日志未出现warn/error。临时手机viewport在结束后重置。
- Node回归4项通过，两个路书各2段内联脚本实际匹配并编译；Sites构建契约4项通过。

## 比较历史与剩余边界

本次首轮视觉比较没有发现P0/P1/P2问题；无需重复视觉修补。适配既有视觉系统的页面内容与比例变化是用户所需入口网站的明确范围。

手机验证使用IAB 390px viewport，不宣称真实手机硬件测试。地图外部服务及第三方平台原帖受网络影响，未逐项验证所有历史攻略外链和当日现场信息。摄影参考作品转载许可不由项目源码授权。

## 2026-11-07 · 新增旅行流程标准化验收

本次沿用既有暖纸色、深绿与摄影杂志主风格，仅让首页推荐、年份、署名和入口跟随清单，并补齐可复用工作流；未发现需要视觉修补的问题。

- 根代理在正式生产预览 IAB `1280×720` 和 `390×844` 验证标题、三个首页图像、首个计划中主推、搜索/状态交集与 Empty 恢复，以及推荐→皖南→首页。
- 正式两视口 `scrollWidth` 等于1280/390，warn/error日志为零；截图为 `work/screenshots/workflow-main-desktop.jpg` 与 `workflow-main-mobile.jpg`，均经 `view_image` 检查。
- 隔离第三份2027计划在1280px桌面与390px手机验证三项清单、首推新计划、2027年份、空原作链接分支的署名 SPAN、搜索/Empty恢复和静态样例往返；手机返回入口44px，无横向溢出，日志为零。图像仍为既有方塘摄影参考，非用户本人摄影，仅模拟空 `imageSource` 行为。
- 隔离截图为 `work/screenshots/workflow-third-desktop.jpg` 与 `workflow-third-mobile.jpg`，均经 `view_image` 检查；隔离行为结果文件也已核对，样例不进入真实清单或公开资产。
- 当前回归为内容/流程9项、生产构建及Sites契约4项通过；技能格式检查通过。详细证据见 [新增旅行流程核对记录](workflow-verification.md)。
- 实现 commit `1997bc916d5bb5e1692c5fa243d84ec551b3d221` 的 [Pages run 42350271692](https://github.com/real-jacket/travel-journal/actions/runs/42350271692) 已由根代理 gh 核对为 `completed/success`。根代理公网 IAB `1280×720` 验证新版推荐CTA、皖南摘要、两项清单、阿尔山搜索仅大兴安岭及重置后推荐→皖南→首页；`390×844` 两项与摘要正确，无溢出，warn/error日志为零。
- 公网截图为 `work/screenshots/workflow-online-desktop.jpg` 与 `workflow-online-mobile.jpg`；这些证据对应上述实现 commit。
- 本轮未重新验证真实路书地图、现场物候、路况、酒店、桩况或转载许可；手机仍为浏览器视口测试。
