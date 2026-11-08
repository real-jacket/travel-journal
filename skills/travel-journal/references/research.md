# 新旅行调研手册（小红书 / 抖音 / B站）

路径相对项目根。平台访问统一走 `agent-reach` 技能，不自造方案；本文只补充摄影路书的查法、取舍和落盘规则。全程只读：不登录、不读浏览器 Cookie、不发帖/评论/点赞。

## 1. 开工前体检

```sh
agent-reach doctor --json
```

- 看 `xiaohongshu`、`douyin`、`bilibili`、`youtube`、`exa` 的 `active_backend`，开工前写一句「使用 agent-reach 的 X 平台 / Y 后端」。`active_backend: null` 只是未实时验证。
- OpenCLI 连通性用一条只读命令验证，如 `opencli xiaohongshu search "黄山 日出" --limit 1 -f yaml`；返回非空内容才算通。扩展未连接时不要自动登录，请用户打开装有 OpenCLI 扩展的 Chrome（可输入 `! opencli doctor`），否则走降级链并在台账注明。
- 降级链：
  - 小红书：OpenCLI → xiaohongshu-mcp（`mcporter call xiaohongshu.search_feeds`）→ xhs-cli（`xhs search`）→ Exa/网页搜索拿笔记 URL。
  - 抖音：OpenCLI（`opencli douyin search`）→ 网页搜索。
  - B站：bili-cli → OpenCLI（`opencli bilibili search`）→ 搜索 API curl（见 agent-reach `references/video.md`）。不要用 yt-dlp 读 B站。
- 小红书请求间隔 2-3 秒，不批量深翻评论；不用裸 note_id 读笔记，用搜索结果里的完整 URL。

## 2. 查询配方

每个主题用「地名 + 季节/月份 + 年份」组合，每条查询只筛前 5-10 条（抖音 `--limit 10`），命中好作者后再进其主页（`opencli xiaohongshu user <id>`、`opencli douyin user-videos <sec_uid>`、`bili user-videos`）。

| 主题 | 关键词示例 |
|---|---|
| 机位 | `<地点> 机位`、`<地点> 拍摄点 停车` |
| 构图/摄影 | `<地点> 摄影 构图`、`<地点> 风光摄影` |
| 航拍/地面 | `<地点> 航拍`、`<地点> 地面机位 观景台`，两类分开记 |
| 光线时段 | `<地点> 日出`、`<地点> 晨雾`、`<地点> 逆光 几点` |
| 物候 | `<地点> 红叶 <年份>`、`<地点> 金秋 <月份> 最佳时间`，按年份对比 |
| 路线路况 | `<地点> 自驾 攻略`、`<地点> 封路`、`<地点> 路况 山路` |
| 补能 | `<地点> 充电桩`、`<地点> 电车 自驾 充电` |
| 住宿 | `<地点> 民宿 日出`、`<地点> 住宿 停车 充电` |
| 美食 | `<地点> 美食 本地菜`、`<地点> 饭店 推荐` |

抖音另可用 `opencli douyin location <地点>` 做 POI 搜索。

## 3. 筛选规则

- 优先摄影师本人作品且标明具体地点；游记、攻略号、重复搬运降级为线索，不当机位证据。
- 发布日期与拍摄日期分开记；标题写「去年/本周」时按发布日换算并注明；未标写「未标」。
- 抖音图文的原图对构图参考重要，与视频封面、完整视频分别标注；推荐流里的其他作品不能算作被打开视频的内容。
- 小红书看笔记正文和评论里的修正（封路、关门、物候变化），评论只作线索。
- B站：先 `bili video BV…` 看 `subtitle.available`；有字幕用 `opencli bilibili subtitle BV…`；无字幕用 `bili audio BV…` 配 `agent-reach transcribe` 转写，抽取路线/时间/路况时记录时间戳。长视频只写实际核对过的片段，未看全就标「仅核对 mm:ss–mm:ss」。
- 摘要、封面、完整内容分别标清，不声称看过未读取的内容。

## 4. 存放规则

- 原始命令输出、笔记正文、下载文件放 `work/trips/<slug>/research/`（已 Git 忽略）。本项目规则覆盖 agent-reach 的「只用 /tmp」默认，因为台账需跨会话保留；`brief.md` 同目录。
- 小红书下载：`opencli xiaohongshu download "<含 xsec_token 的完整 URL>" --output work/trips/<slug>/research/xhs-<note-id>`。
- 公开文件（路书、`entry`、`src/data/trips.js`、`public/**`）永不出现 `xsec_token`、`xsec_source`、签名参数、本地路径；`tests/portal.test.mjs` 会拦截。发布前统一规范链接：
  - 小红书 `https://www.xiaohongshu.com/explore/<note-id>`
  - 抖音 `https://www.douyin.com/video/<aweme_id>`（图文用笔记页 URL）
  - B站 `https://www.bilibili.com/video/<BV…>`，必要时加 `?t=<秒>`
- 带 token 的原始 URL 只留在 `research/` 的原始输出里；`brief.md` 链接列同样使用规范链接。

## 5. 图片与封面

- 下载原图留在 `research/`，不直接放入 `public/`。封面优先本人照片；使用他人作品前核对作者授权，链接本身不是转载许可。
- 选定封面后转成 webp，扩展名与格式必须一致。本机 `cwebp`/`magick` 缺失，`sips` 与 `ffmpeg` 都不能写 webp，已验证可用：

```sh
uv run --quiet --with pillow python -I -c "
from PIL import Image
im=Image.open('work/trips/<slug>/research/cover-src.jpg').convert('RGB')
im.thumbnail((1600,1600)); im.save('public/images/<slug>.webp','WEBP',quality=82)"
file public/images/<slug>.webp   # 应显示 Web/P image
```

- `imageCredit` 写作者与平台，`imageSource` 写规范化后的原作链接。

## 6. 交叉核对

机位、物候、路线结论用官方来源交叉：文旅局/景区公告、气象预报、路况与封路通知、充电运营方 App/官网、住宿/餐厅官方页。无官方证据的项目标「未核实」，旧帖物候不代表今年叶量，旧酒店设施不代表当天可用。

## 7. 台账格式

落在 `work/trips/<slug>/brief.md` 的「来源台账」，列固定为：

| 主题 | 平台 | 后端/命令 | 作品ID | 作者/机构 | 作者主页 | 规范链接 | 发布日 | 拍摄/生效日 | 地点与入口 | 已核实 | 未核实 | 查看日 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 落羽杉讲解 | B站 | bili-cli `bili video` | BV1J9UaBjEz9 | 永远追梦的一颗心 | 未取 | https://www.bilibili.com/video/BV1J9UaBjEz9 | 未取 | 未标 | 方塘乡落羽红杉林景区，入口未核 | 标题与时长 64:51 | 无字幕，内容未逐段核对 | 2026-11-07 |

## 8. 调研完成标准

- [ ] 已跑 `agent-reach doctor --json`，台账写明各平台实际后端与降级。
- [ ] 每个核心机位至少一条摄影师本人作品，含地点、视角（地面/航拍）、日期。
- [ ] 路线、封路、补能、住宿、美食各有来源，官方来源已交叉核对，其余标未核实。
- [ ] 链接均已规范化，台账与公开文件无 `xsec_token`/`xsec_source`。
- [ ] 下载素材只在 `work/`；封面格式与扩展名一致，署名齐全。
- [ ] 未读取/未看全的内容在台账与交付说明中有明确边界。
