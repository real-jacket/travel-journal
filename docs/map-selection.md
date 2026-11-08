# 路书地图选型（调研日期 2026-11-07）

结论先行：**MapLibre GL JS + 自托管 Protomaps PMTiles（矢量底图）+ Mapterhorn 地形 PMTiles（山体阴影）**，全部放在 GitHub Pages 同源，不引入任何第三方运行时域名或密钥。路线用 OSRM 公共 demo 在作者本机一次性生成 WGS-84 GeoJSON。引用方括号见文末，除特别标注外访问日期均为 2026-11-07。

> 网络说明：本机所有流量经代理/TUN，下文的延迟/可达性结论**不是**中国大陆实测。中国可达性只依据文档和公开报告，凡无依据处均列入“未验证”。

## 0. 落地结果（2026-11-07，以此为准）

下文第 1–9 节是选型调研，保留原样；实际实现与调研建议不同之处以本节为准。

- 共用模块 `public/vendor/map/trip-map.js`（`window.TripMap`）+ `trip-map.css`，两份路书都用它；`pnpm map:build` 生成每趟数据（用法见 [新增路书](add-a-trip.md) 的“地图和机位”）。
- 底图四层：ESA WorldCover 2021 v200 土地覆盖栅格（10 m，众数滤波去碎斑，512 px 无损 WebP）→ 浅山体阴影 → Protomaps 矢量道路/水系/境界/地名 → 路线与点位。用户要求的是“用颜色区分山地森林、植被、城镇”的土地覆盖图，单纯山体阴影不够。
- 色板：林地 `#b5c79e`、灌丛 `#cbd5ac`、草地 `#dde2b6`、农田 `#efe2b2`、建成区 `#d9bfae`、裸地 `#e5dac6`、水体 `#b7cdcf`、湿地 `#c3d7c9`。试过按高程着色（`reliefTint`），会让各类颜色发浑，最终关闭。
- 署名：`© OpenStreetMap · Protomaps · Mapterhorn · ESA WorldCover`（WorldCover 为 CC-BY 4.0）。
- 境界只画省/地市/县（虚线），国界、争议线、海上界线过滤；标注只取 `script: Han`。
- MapLibre 的 raster / raster-dem 源缺瓦片时不会回退到父级，会出现空洞。土地覆盖因此用同一文件再挂一个封顶 `landcoverFullZoom`（z9）的源垫底；底图/地形用分层抽取（低缩放大范围、高缩放走廊）+ `maxBounds` 控制。
- 高德导航：`TripMap.navSegments` / `TripMap.amapRoute` 把每个方案/天切成“起点 → 途经 → 终点”段并转 GCJ-02，皖南 74 条链接与旧实现逐字节一致（测试锁定）。
- 体积：皖南 base 14.7 + terrain 18.7 + landcover 4.7 ≈ 38.0 MB；大兴安岭 9.7 + 16.4 + 10.8 ≈ 36.9 MB；每趟上限 40 MB。
- 已知局限：拖到已制作范围以外的高缩放区域只剩土地覆盖、没有道路和阴影；大兴安岭 z12 片区之间的土地覆盖是 z9 放大，偏软。

## 1. 需求（来自项目约束）

- 纯静态、GitHub Pages `/travel-journal/`，无后端、无处存密钥；每个旅行是独立 HTML。
- 目的地在中国大陆山区（皖南、大兴安岭），观众多为手机、偶尔弱网。
- 要能配色到纸色 / 深林绿 / 锈红的杂志风；要地形、水系、中文地名、分级道路、铁路/机场（加分）、沿真实道路的每日路线、拍摄点标记。
- 导航交给高德/百度 App 深链；页面内不需要实时路况。**同意不做实时路况**：静态站拿不到路况数据，且路况对“候选计划/历史路书”没有价值。
- 现状：anhui 12.5 MB HTML（内嵌 base64 浮雕图 + OSM GeoJSON），khingan 用 OSM 标准栅格（粉色道路、蒙古文/西里尔标注）+ 直线箭头。

## 2. 方案逐项评估

### a) MapLibre + OpenFreeMap 矢量 + DEM 山体阴影
- 免 key、无请求上限、需署名；但**无 SLA**，条款写明“不保证可用性”，可随时下线 [1][2]。公共实例用专用服务器、避免 Cloudflare 代理（轮询 DNS 问题）[3]；**没有找到任何大陆实测**，可达性未验证。
- 官方样式的 place 标注是 `coalesce(name_en, name)`，非汉字名会拼成 `name:latin\nname:nonlatin`（实测 liberty 样式 JSON）[4]；在中国会先显示拼音（如 “Jing Xian”），**必须改写 text-field 为 `name`**。
- OpenMapTiles 道路分类 motorway/trunk/primary/secondary/tertiary/minor/service/track/path，铁路在 subclass，无 contour/hillshade 图层 [5]。
- 优点：零存储、免构建；缺点：运行时依赖第三方且大陆体验未知，仍要自己加 DEM。**适合做快速原型，不适合做唯一方案。**

### b) MapLibre + 自托管 Protomaps PMTiles（推荐）
- 同源 Range 请求：GitHub Pages 返回 `accept-ranges: bytes`、206、正确 `Content-Range`，并自带 `access-control-allow-origin: *`（对本站已发布的 HTML/JS 实测，经代理）[6]。同源无需 CORS 配置。
- **已知坑**：该 issue 报告 Pages 曾对 206 响应加 `Content-Encoding: gzip`，Firefox 会失败；PMTiles 作者在 2026-03-13 确认最小复现已正常并关闭 issue，旧版绕法是改名 `.pmtiles.gz` [7]。我对**可压缩类型**（HTML）实测：带 `Accept-Encoding: gzip` 的 Range 返回 206 + `content-encoding: gzip`，且 `Content-Range` 总长是压缩后长度（7.79 MB，原文件 12.55 MB），说明 Pages 对可压缩类型仍会“先压缩再切片”；`.pmtiles` 当前是否被压缩**我没有部署验证**，上线后必须用 curl 复测（见第 5 节）。若在 Pages 前再套 Cloudflare 代理，Range 会被破坏（maplibre/demotiles 的说明）[8]。
- 体积实测（`pmtiles extract --dry-run`，Protomaps 2026-11-07 日构建，整包约 139 GB）[9][10]：
  - 皖南 bbox `118.1,30.2,119.7,31.5`（约 150×145 km）：maxzoom 13 = 11 MB，14 = 17 MB，15 = 29 MB；maxzoom 14 已实际抽取，文件 16.5 MB。
  - 大兴安岭 bbox `119.0,46.8,121.8,49.4`（约 210×290 km，更大）：maxzoom 13 = 6.1 MB，15 = 19 MB（人烟稀少）。
  - 地形（Mapterhorn，皖南同 bbox，dry-run）：maxzoom 10 = 8.2 MB，11 = 17 MB，12 = 51 MB [11][12]。
- 地形数据：Mapterhorn 中国区只有 Copernicus GLO-30（30 m）——我核对其 attribution.json 的 151 个源，没有中国本土源 [13]。GLO-30 在 30°N、512 px 瓦片 z11 约 32 m/像素（按 40075 km/(512·2^11)·cos(30.8°) 推算），所以 **z11 已到数据原生分辨率，z12 只是多占 34 MB**。编码 terrarium、512 px、WebP [12][14]。
- 数据：Protomaps v4 图层 boundaries/buildings/earth/landcover(z0–7)/landuse/places/pois/roads/water，transit 目前为空；道路 `kind` = highway/major_road/minor_road/path/rail/aeroway/ferry [15]。实测皖南 z12/z14 瓦片：`major_road/{trunk,primary,secondary,tertiary}`、`minor_road/{residential,unclassified,service}`、`path/{track,path}`，places 为 city/town/village/hamlet [本机解码]。
- 中文名：汉字地名直接在 `name`，并带 `script: "Han"`；实测 places 有 `name:zh-Hans`，**没有 `name:zh`**；pois 只有 `name`（实测解码泾县 z12/z14 瓦片）。文档写法同为 `name:zh-Hans/zh-Hant` [16]。所以标注用 `name`，不用 `name:zh`。
- 样式：官方 `@protomaps/basemaps`（npm 5.7.2）的 Flavor 是纯色板对象，可 `{...namedFlavor("light"), ...}` 覆写 [17]，天然适合配色。
- 缺点：无等高线/山体阴影，要靠 DEM；无 SLA 问题但自己负责更新；文件进 git 后历史永久变大（见第 5 节）。

### c) 高德 JS API 2.0 + 自定义样式
- 2021-12-02 之后的 key 必须配 `securityJsCode`；官方“强烈建议”用代理转发，**明文设置“不建议在生产环境使用（不安全）”**；自定义地图 `/v4/map/styles` 也要在代理里加 jscode [18][19]。静态站没有后端 → 只能明文暴露，或另起代理（违反“无后端”）。我在官方页没有找到域名白名单的说明。
- 个人开发者配额页（更新于 2023-09-06）：搜索类 100 次/日，路线规划类 5,000 次/日；地图加载不在该表内 [20]。2024–2026 年许可条款变化：**没有查到官方公告，未验证**。第三方文章称商用需购买授权 [21]，个人使用边界不清。
- 2D 样式：`mapStyle: "amap://styles/<id>"`，可 `setFeatures` 开关 bg/point/road/building [22]；**未找到 2D 山体阴影**，只有 3D 模式的 `terrain: true`（v2.1Beta 起）[23]。要在高德样式里做浮雕，无法实现。
- 坐标是 GCJ-02，需与路线、点位全部转换。
- 结论：能出“好看的国内底图”，但密钥暴露 + 无浮雕 + 条款不确定 + 样式受平台限制，**否决**。

### d) 天地图
- 浏览器端 key（tk）在控制台按应用创建，可绑域名白名单；服务端 key 用 IP 白名单；日配额各来源数字不一（1 万/5 万/卫星 5 千），**以控制台为准** [24][25]。官方站点 lbs.tianditu.gov.cn 从本机连不上，条款/配额未能直接核对。
- WMTS：`t0–t7.tianditu.gov.cn/{vec|img|ter|cva|cia|cta}_{w|c}/wmts`，`_w` 球面墨卡托、`_c` 经纬度（CGCS2000/EPSG:4490）；ter 晕渲 + cta 地形注记；ter 只到 14 级仅有一篇旧博客提到，**未验证** [24][26]。
- 样式**不可改**（固定栅格），无法配色到杂志风；道路层级和注记由平台决定。
- 优点：国家官方图源，属“已审图”来源，国内可达性应最好（推断，未验证）。作为**兜底**合适。

### e) Mapbox / MapTiler / Stadia / Thunderforest
- Mapbox：50,000 map loads/月免费，超出 $5/千次起 [27]；MapTiler 免费 100k 请求/月，限“测试/个人/非商业”，超额暂停，页面带 MapTiler 标识 [28]；Stadia 免费 200k credits/月，禁止商用 [29]；Thunderforest 免费 150k 瓦片/月，必须署名 [30]。
- 都需要把 key/token 放进页面（可否域名限制未逐家核对）；**大陆可达性无任何依据**；样式依赖平台。对本项目无优势，**否决**。

### f) 保留 Leaflet 栅格 + 滤镜
- OSM 官方瓦片政策：禁止预取/批量，必须署名，**无 SLA**，用量过大可被封 [31]；CSS filter 只能整体调色，改不了道路层级、标注语言、标注密度。能立刻“少花一点”，但路网粉色和蒙古文标注是**数据层**问题，滤镜解决不了。**否决**。

## 3. 决策矩阵

等级：强 / 中 / 弱 / ? = 未验证。

| 维度 | a OFM | b 自托管 PMTiles（推荐） | c 高德 | d 天地图 | e 海外商业 | f Leaflet 栅格 |
|---|---|---|---|---|---|---|
| 外观/可定制 | 强（改 JSON） | 强（Flavor+图层） | 中（平台模板） | 弱（固定） | 中–强 | 弱（只能滤镜） |
| 地形/浮雕 | 需自加 DEM | 需自加 DEM（已量化） | 2D 无 | 有 ter（最高 14 级?） | 各家有 | 弱 |
| 国内路网/交通 | OSM，农村不全 | 同 a | 最好（商业数据） | 好（官方数据） | OSM 类 | OSM |
| 大陆可达性 | ?（无实测） | 取决于 Pages（?） | 好（推断） | 好（推断） | ? | ? |
| 密钥/机密 | 无 | 无 | 明文密钥 | tk+白名单 | token | 无 |
| 费用/配额 | 免费无 SLA | 免费，Pages 1 GB 上限 | 个人配额小，条款? | 免费，限额? | 有限免费 | 免费 |
| 离线/体积 | 无 | 每趟约 35 MB 二进制 | 无 | 无 | 无 | 无 |
| 复杂度 | 低 | 中（一次性构建） | 中（代理/密钥） | 低 | 低 | 最低 |

## 4. 推荐栈与兜底

**推荐**：MapLibre GL JS + 本地 `base.pmtiles`（Protomaps，maxzoom 14）+ 本地 `terrain.pmtiles`（Mapterhorn，maxzoom 11）+ 本地 glyph/sprite + 本地路线/点位 GeoJSON，全部同源。
**为什么**：外观完全可控；零第三方域名；零密钥；无运行时配额；体积可控（皖南约 34 MB，大兴安岭约 30 MB，替掉 anhui 的 12.5 MB HTML 内嵌数据）。
**兜底（按顺序）**：
1. 若 Pages 的 PMTiles Range 复测失败：改名 `*.pmtiles.gz`（旧 issue 记录的做法）[7]。
2. 仍失败：把 PMTiles 放到其他对象存储（Cloudflare R2 等，需 CORS 允许 GET/HEAD、`range`、暴露 `etag`）[32]，大陆速度未验证。
3. 手机/WebGL 不可用：降级到 Leaflet + 天地图 `vec_w`+`cva_w`（+`ter_w`），接受固定外观，并显示审图号（见第 7 节）。

### 与高德/百度的关系
**不**把高德当底图；只把它当导航目的地。

## 5. 单趟旅行配方

目录约定（沿用现有 `public/trips/<slug>/`、khingan 已本地 vendor gsap）：
```
public/vendor/map/maplibre-gl/5.24.0/{maplibre-gl.js,maplibre-gl.css,LICENSE.txt}
public/vendor/map/pmtiles/4.5.0/pmtiles.js
public/vendor/map/{fonts/Noto Sans Regular|Medium|Italic/0-255.pbf, sprites/v4/light.{json,png}}
public/trips/<slug>/map/{base.pmtiles,terrain.pmtiles,routes.geojson,spots.geojson,style.json}
work/trips/<slug>/   # 被忽略：bbox.txt、osrm 原始响应、gen-style.mjs
```
页面在 `/travel-journal/trips/<slug>/index.html`，用 `../../vendor/map/...` 相对路径。

**步骤**
1. 定 bbox（含全部住宿/拍摄点外扩 ~15 km）。Khingan 靠边境：bbox 北移避开外蒙，或标注过滤 `["==",["get","script"],"Han"]` 隐藏蒙古/西里尔标注。
2. 安装 `pmtiles` CLI（go-pmtiles v1.31.2 Darwin arm64，本次已验证可用）[33]：
   ```sh
   pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles public/trips/<slug>/map/base.pmtiles --bbox=W,S,E,N --maxzoom=14
   pmtiles extract https://download.mapterhorn.com/planet.pmtiles public/trips/<slug>/map/terrain.pmtiles --bbox=W,S,E,N --maxzoom=11
   ```
   先加 `--dry-run` 看体积。文档建议不要热链官方构建，所以抽取后自己保存（构建保留期限未核实，用当天日期） [10]。
3. 本地矢量库：`maplibre-gl@5.24.0` 的 `dist/maplibre-gl.js`（1.06 MB，gzip 约 277 KB）+ css（约 70 KB）、`pmtiles@4.5.0` 的 `dist/pmtiles.js`（约 20 KB）。`maplibre-gl` 现已发 6.x（6.16.0，ESM 产物 `.mjs`+worker）；roadbook 是单文件 HTML，用 5.24.0 的 UMD 更省事（6.x 在 `<script type="module">` 下是否可用**未验证**）[34][35]。
4. 路线（作者时一次性，无运行时 key）：对每天的“出发 → 拍摄点 → 住宿”按顺序请求
   `https://router.project-osrm.org/route/v1/driving/lon,lat;lon,lat;...?overview=full&geometries=geojson`
   设置明确 `User-Agent`，**≤1 请求/秒，非商用**[36]。本机实测皖南 泾县→宁国 返回 99.4 km、815 点（经代理，仅验证格式）。保存为 `routes.geojson`（WGS-84，坐标保留 5 位）。必须逐段叠加底图人工检查：山路/土路是否被默认 car 剖面跳过（**未验证**）；若缺失，改本机 BRouter（Docker 镜像 `ghcr.io/abrensch/brouter`，皖南只需 `E115_N30.rd5` 24.6 MB，大兴安岭 `E120_N45.rd5` 3.1 MB，实测头信息）[37]。
5. 样式：`gen-style.mjs` 用 `@protomaps/basemaps` 的 `layers("protomaps", flavor)` 生成，写入 `style.json`；之后脚本把所有 `text-field` 改成 `["get","name"]`（`layers()` 是否有内置 `lang` 选项**未核实**，所以不依赖它）[16][17]。
6. 注册协议并加载：
   ```js
   const protocol = new pmtiles.Protocol(); maplibregl.addProtocol('pmtiles', protocol.tile);
   new maplibregl.Map({container, style, localIdeographFontFamily:
     "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC',sans-serif", ...});
   ```
   `localIdeographFontFamily` 默认 `sans-serif`，用本地字体生成中日韩字符而不请求字形服务器 [38]；glyph URL 指向本地 `fonts/`，只需拉拉丁/数字范围（`Noto Sans Regular/0-255.pbf` 约 76 KB）。
7. 地形：`raster-dem` 源 `{type:"raster-dem", url:"pmtiles://.../terrain.pmtiles", encoding:"terrarium", tileSize:512}`，加 `hillshade` 图层（属性：`hillshade-exaggeration`、`hillshade-shadow-color`、`hillshade-highlight-color`、`hillshade-accent-color`、`hillshade-illumination-direction`）[39][40]。
8. 部署后复测 Range（失败则回到第 4 节兜底 1）：
   ```sh
   curl -s -o /dev/null -D - -H "Range: bytes=0-16383" -H "Accept-Encoding: gzip, br, zstd" https://real-jacket.github.io/travel-journal/trips/<slug>/map/base.pmtiles
   ```
   期望 `206`、`Content-Range: bytes 0-16383/<原文件大小>`、**无** `Content-Encoding`。
9. 深链（只由 WGS-84 数据在构建时生成）：
   - 高德单点：`https://uri.amap.com/marker?position=lon,lat&name=…&coordinate=wgs84&src=<站点名>&callnative=1`，官方明确 `coordinate=gaode|wgs84` [41]。
   - 高德导航：`https://uri.amap.com/navigation?from=lon,lat,名&to=lon,lat,名&via=lon,lat,名&mode=car&policy=0&src=…&callnative=1`；官方导航页**没有列出 coordinate 参数**，所以导航深链的坐标先转 GCJ-02（`gcoord`/`coordtransform` 类库），默认即 gaode [42]。
   - 百度：`https://api.map.baidu.com/direction?origin=…&destination=…&mode=driving&coord_type=wgs84&output=html&src=webapp.<公司>.<应用>`；官方列出 `coord_type` 可取 `bd09ll/bd09mc/gcj02/wgs84`，且各端点此参数要显式传 [43]。`origin` 的经纬度顺序按官方示例核对（本次未逐字验证）。
10. 配色（取自 khingan 页现有变量：`--paper:#f5f2e9`、`--paper-strong:#fffdf8`、`--sand:#e8e1d1`、`--forest-950:#142c23`、`--forest-900:#203d30`、`--ink:#263c31`、`--rust:#97502e`、`--gold:#e4b965`；任务描述里的 #f6f3eb/#263b32 与之相差极小，统一用页面实际变量）：
    - 陆地 `#f3eee1`（paper 略偏暖），水 `#cfd9d0`，林地/公园 `#dfe5d2`，居住区 `#ece5d3`。
    - 道路：高速 `#97502e` 2.4 px；国省道 `#c07a4c` 1.8 px；县乡道 `#fffdf8` + 描边 `#d9cfb8`；山路/步道 `#8a7a5c` 虚线。
    - 山体阴影：shadow `#263c31`、highlight `#fffdf8`、accent `#587a62`，exaggeration 0.35–0.5，叠在陆地色之上，水系在 hillshade 之上。
    - 标注：镇/村 `#203d30` + 描边 `#f5f2e9`，山峰/地名用 `#97502e`；每日路线用锈红/金/森林三色轮换，粗 4 px + 纸色白边，拍摄点用锈红圆点 + 数字。
    - 以上为设计建议，不是已验证的最终视觉；落地时按 AGENTS.md 要求以 `docs/reference/anhui-editorial.png` 对照验收。

**仓库体积**：Pages 站点上限 1 GB、软带宽约 100 GB/月 [44]；git 单文件 >50 MiB 警告、>100 MiB 拒绝，仓库建议 <1 GB [45]。每趟约 35 MB，z12 地形 51 MB 会触发警告，故地形用 z11。二进制每次重新提交都会永久留在历史里，**抽取后别频繁重生成**；删除 anhui 里 12 MB 的内嵌数据还能抵消一部分。

## 6. OSM 数据质量（农村与中文名）
- OSM Wiki：中国大陆对象主名称 `name` 应为简体中文，有多语言名时也应标注 `name:zh` [46]。实际缺失率没有统计，本次只对泾县一个区域做了解码抽样。
- 农村道路不全：研究称遗漏的多为私有道路或未命名的单车道公路，但高流量道路 80% 以上已收录；城乡差异明显 [47][48]。研究年代较早，**对皖南山间村道/大兴安岭林道的完整度没有一手数据**，所以每条路线都要人工叠图检查。
- 坐标：OSM 用 WGS-84；国内商业图用 GCJ-02（高德/腾讯），百度 BD-09；叠 GCJ 底图需转换 [46][49]。本方案全用 WGS-84，只在深链时转。

## 7. 署名、许可、审图号
- OSM（ODbL）：Protomaps 底图是 ODbL Produced Work，需署名 “© OpenStreetMap”（是否已写入 PMTiles 元数据未核实，页面须自行显示）[10][15]；自行保留可见署名。
- Mapterhorn：TileJSON 署名 `© Mapterhorn`（链接到 mapterhorn.com/attribution）；中国区底层是 Copernicus GLO-30（“full, free and open license”）[13][14]。署名的具体措辞以其 attribution 页为准——**未逐字核实**。
- MapLibre GL JS：BSD-3，随包保留 `LICENSE.txt`（版本 5.24.0 的 dist 里有）[34]。
- OpenFreeMap（若作为原型）：需署名 OpenFreeMap（可选）、OpenMapTiles、OpenStreetMap [3]。
- 审图号（简述）：《地图管理条例》要求向公众发布的地图须经审核，互联网地图服务需标注审图号（“服务器须在境内”一说未核实）；评论文章称 OSM、Mapbox 等无中国审图号的图源属“不合规”，罚款上限 20 万元 [50][51]。没有一条资料专门说到“个人非商业静态页”，所以**风险边界不明**。缓解：不绘制国界/境界线（样式里去掉 `boundaries` 图层）、不标注争议区域、不声称“标准地图”、站点定位为非商业个人记录、以路线和摄影点为主而非地图服务。要严格合规，只能改用天地图/高德/百度等已审图来源。本节不是法律意见。

## 8. 风险
1. Pages 对 `.pmtiles` 的 Range/压缩行为未实测（见第 5 节第 8 步），Firefox 路径最易出问题。
2. GitHub Pages 本身在大陆的可达性和速度——**无依据**，但这是整站已有依赖，本方案没有增加新的域名。
3. 手机端 CJK：依赖系统字体（iOS 有苹方、安卓各厂商不同），个别设备可能回落到无衬线字体；已采用 fallback 链但未在真机验证。
4. 低端机 WebGL/内存：MapLibre 需要 WebGL，每页约 1 MB JS；未实测弱机。
5. OSM 农村路网/地名不全；路线需叠图核对。
6. 审图/合规风险（第 7 节）。
7. 国界邻近区域（阿尔山）的标注与境界线需要过滤。

## 9. 未验证清单
- Pages 对 `.pmtiles` 的 206 + 压缩现状（仅对 HTML 实测过压缩切片问题）。
- 大陆对 github.io、OpenFreeMap、Mapterhorn、jsDelivr、unpkg 的可达性和速度（jsDelivr 在大陆的 ICP 问题：2022 issue 称无法恢复，2024–2025 博客称默认节点可用性低，IPv6/镜像域名有差异，均未实测 [52]；本方案本地 vendor 即为规避）。
- 高德 2024–2026 个人开发者条款/配额变化、高德 2D 山体阴影的有无、高德导航 URI 是否接受 `coordinate=wgs84`。
- 天地图的官方配额/条款/审图号要求（官网从本机不可达）、`ter_w` 的最大级别。
- Protomaps 瓦片中 `highway`（高速）、铁路、车站、机场、山峰 POI 在皖南/大兴安岭的实际出现情况（本次只解码了泾县附近 z12/z14 两个瓦片）。
- `@protomaps/basemaps` 的 `layers()` 是否有语言选项；`maplibre-gl@6` 的 UMD/ESM 用法；Mapterhorn 署名确切措辞与用量限制（官方页未写）。
- OSRM 默认 car 剖面对山路/林道的覆盖；皖南/大兴安岭路网完整度。
- 百度 `direction` 的 `origin` 经纬度顺序、`src` 实际校验。
- 手机真机的 CJK 字体回落与 WebGL 性能。

## 引用
[1] https://openfreemap.org/quick_start/  [2] https://openfreemap.org/tos/  [3] https://github.com/hyperknot/openfreemap
[4] https://tiles.openfreemap.org/styles/liberty （实测 JSON）  [5] https://openmaptiles.org/schema/
[6] https://real-jacket.github.io/travel-journal/ 本站已发布文件的 curl 头（经代理）
[7] https://github.com/protomaps/PMTiles/issues/584  [8] https://github.com/maplibre/demotiles
[9] https://docs.protomaps.com/pmtiles/cli  [10] https://docs.protomaps.com/basemaps/downloads
[11] https://download.mapterhorn.com/planet.pmtiles （zoom 0–12，经 `pmtiles extract --dry-run`）
[12] https://mapterhorn.com/data-access  [13] https://download.mapterhorn.com/attribution.json
[14] https://tiles.mapterhorn.com/tilejson.json  [15] https://docs.protomaps.com/basemaps/layers
[16] https://docs.protomaps.com/basemaps/localization  [17] https://docs.protomaps.com/basemaps/flavors
[18] https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode  [19] https://lbs.amap.com/api/javascript-api-v2/guide/abc/prerequisites
[20] https://lbs.amap.com/api/javascript-api-v2/flowlevel  [21] https://blog.csdn.net/Marco_Marco135/article/details/162691110（第三方，转述）
[22] https://lbs.amap.com/api/javascript-api-v2/guide/map/map-style  [23] https://lbs.amap.com/api/javascript-api-v2/
[24] http://lbs.tianditu.gov.cn/server/MapService.html（搜索摘要；本机直连失败）  [25] http://lbs.tianditu.gov.cn/authorization/authorization.html（同上）
[26] https://github.com/muyao1987/leaflet-tileLayer-baidugaode  [27] https://www.mapbox.com/pricing
[28] https://www.maptiler.com/cloud/pricing/  [29] https://stadiamaps.com/pricing/  [30] https://www.thunderforest.com/pricing/
[31] https://operations.osmfoundation.org/policies/tiles/  [32] https://docs.protomaps.com/pmtiles/cloud-storage
[33] https://github.com/protomaps/go-pmtiles/releases/tag/v1.31.2
[34] https://data.jsdelivr.com/v1/packages/npm/maplibre-gl@5.24.0（`npm view` 另显示 6.16.0 / 6.0.0 发布于 2026-07-22）
[35] https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/maplibre-gl.js（头信息：1,056,837 B，gzip 276,839 B）
[36] https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server  [37] https://github.com/abrensch/brouter ；https://brouter.de/brouter/segments4/
[38] https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/  [39] https://maplibre.org/maplibre-style-spec/sources/
[40] https://maplibre.org/maplibre-style-spec/layers/#hillshade
[41] https://lbs.amap.com/api/uri-api/guide/mobile-web/point  [42] https://lbs.amap.com/api/uri-api/guide/travel/route
[43] https://lbsyun.baidu.com/faq/api?title=webapi/uri/web
[44] https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
[45] https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
[46] https://wiki.openstreetmap.org/wiki/China  及 Zh-hans:中国标注指南  [47] https://arxiv.org/abs/1909.04323
[48] https://www.tandfonline.com/doi/full/10.1080/10095020.2024.2356238  [49] https://en.wikipedia.org/wiki/Restrictions_on_geographic_data_in_China
[50] https://www.mee.gov.cn/zcwj/gwywj/202001/t20200114_759322.shtml（地图管理条例）  [51] https://www.lindapatent.com/cn/info/insights_others/2023/0309/1834.html
[52] https://github.com/jsdelivr/jsdelivr/issues/18407 ；https://ksh7.com/posts/cdn-static-file-recommend/index.html
