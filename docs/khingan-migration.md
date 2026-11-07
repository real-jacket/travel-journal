# 大兴安岭路书公开迁移

源文件：`原项目：outputs/2026-daxinganling-south-route.html`。
发布入口：`public/trips/khingan/index.html`。原文件未修改。

## 迁移范围

只复制 HTML、两份本地动画脚本、hero 原图及九张 opt2 图片，共 13 个运行必需文件。图片保持原始内容和来源署名；`spotImage()` 保留将数据图片路径转换至 opt2 的行为。

- `ScrollTrigger.min.js`
- `gsap.min.js`
- `index.html`
- `xhs-spots/haraha-river.webp`
- `xhs-spots/opt2/blue-house.webp`
- `xhs-spots/opt2/chaihe-rock-painting-verified.webp`
- `xhs-spots/opt2/chaihe-ten-bays.webp`
- `xhs-spots/opt2/dujuan-lake.webp`
- `xhs-spots/opt2/erguna-free-wetland.webp`
- `xhs-spots/opt2/haraha-river.webp`
- `xhs-spots/opt2/molger-3.webp`
- `xhs-spots/opt2/tongxin-lake.webp`
- `xhs-spots/opt2/wusu-photographer.webp`

## 发布副本调整

- 删除 24 处 xsec_token 和 23 处 xsec_source 临时签名查询参数，保留原笔记 ID 与作者/出处。
- 在原导航中新增 `../../` 的“回旅行首页”链接。桌面和手机可见，保持原纸色、边框和字体风格。
- 旧版两处清单 JSON.parse 会因损坏存储终止页面初始化。新增最小读取容错：格式错误、null、数组和非对象返回原默认空对象，不删除或重写用户存储。
- 对存储不可访问时的 getItem/setItem 加容错，使初始页面与当次交互继续运行。正常存储读写与原 key 保持一致。
- 不复制 `.amap.local.json`。默认仍执行 Leaflet 初始化，不注入或申请高德密钥。

## 检查结果

- 发布目录精确包含 13 个文件；复制的 12 个资产与源文件逐字节相同。
- 两段内联 JavaScript 经 Node `--check` 检查通过。
- 存储断言覆盖正常对象、缺失值、无效 JSON、null、非对象、数组与禁止读写；均通过，损坏记录保持原值。
- 发布 HTML 无 xsec_token/xsec_source、私有配置文件引用、绝对本地路径或本地服务地址；与原私有配置的实际值比对，无匹配。检查过程不输出密钥。
- 源 HTML SHA-256 保持不变。

## 运行边界

远程依赖保留：Google Fonts、Lucide 0.468.0、Leaflet 1.9.4 的 JS/CSS 和 OSM 瓦片。Lucide、Leaflet及样例瓦片在审计时 HTTP 200；GSAP 和 Leaflet 有加载失败处理。地图线路为方向示意。

未开启浏览器、未 Git 操作、未发布。迁移后的桌面/手机布局、返回首页与照片交互需要由主任务浏览器 QA 验证。
