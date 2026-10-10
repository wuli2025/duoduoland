# 第10轮验收：多多群岛

完成品牌改名、统一字体与颜色变量、真实活动驱动的居中轮播。appVersion=10.0.0。

## 验收与结果

- `node --test tests`：126/126通过，0失败；新增轮播负索引/越界循环、空/单活动、切换标签重置、编辑推荐来源、报名排序、上海周界及空周检查。
- `py -3 scripts/browser-round10.py`：使用自有 http://127.0.0.1:8788 实例。8787被占用时顺延；结束时仅关闭本脚本创建的子进程，未操作用户窗口。
- 1440与1024各11张，共22张截图。逐页DOM审计：无横向溢出、无正文截断、可见文本最小13px、无pageerror或未处理rejection。屏幕阅读器专用隐藏标签不计入可见布局审计。
- 轮播循环箭头、侧卡点击、圆点、左右键、鼠标拖拽、真实touch事件、5秒自动播放、悬停暂停、reduced-motion禁用自动播放均已通过。file://品牌与轮播加载正常。
- 正文16px，辅助13–15px，卡片标题20px，区块标题28px，页面标题48–52px；标题800、正文500、正文行高1.7。发现页取消固定正文/标签高度，匹配序号列加宽，标题平衡换行。
- 说明色 `#5e6558` 对暖白 `#fafaf7` 对比度5.77:1，对浅色卡片 `#e8ecde`为5.03:1；暗底说明色 `#b8c1ad` 对 `#1d211a` 为8.77:1。
- 匹配页排版验收使用真实本地引擎并明确标注，没有伪造模型结果；本轮未要求重跑真实LLM效果评测，既有推荐逻辑未改。
- 保留本地存储键，已有名片与参与设置不因品牌改名清空。所有名片与头像继续使用本场公开投影。

## 截图索引

| 页面 | 1440 | 1024 |
| --- | --- | --- |
| 首页·精选 | [home-featured](screenshots/round-10/1440-home-featured.png) | [home-featured](screenshots/round-10/1024-home-featured.png) |
| 首页·本周 | [home-week](screenshots/round-10/1440-home-week.png) | [home-week](screenshots/round-10/1024-home-week.png) |
| 首页·榜单 | [home-ranking](screenshots/round-10/1440-home-ranking.png) | [home-ranking](screenshots/round-10/1024-home-ranking.png) |
| 活动详情 | [detail](screenshots/round-10/1440-detail.png) | [detail](screenshots/round-10/1024-detail.png) |
| 本场设置 | [join](screenshots/round-10/1440-join.png) | [join](screenshots/round-10/1024-join.png) |
| 匹配页（明确本地规则） | [match](screenshots/round-10/1440-match.png) | [match](screenshots/round-10/1024-match.png) |
| 找工作 | [jobs](screenshots/round-10/1440-jobs.png) | [jobs](screenshots/round-10/1024-jobs.png) |
| 我的名片 | [cards](screenshots/round-10/1440-cards.png) | [cards](screenshots/round-10/1024-cards.png) |
| 发现 | [discover](screenshots/round-10/1440-discover.png) | [discover](screenshots/round-10/1024-discover.png) |
| 现场大屏 | [live](screenshots/round-10/1440-live.png) | [live](screenshots/round-10/1024-live.png) |
| 快捷搜索 | [search](screenshots/round-10/1440-search.png) | [search](screenshots/round-10/1024-search.png) |

## 证据与复现

- [浏览器审计](browser-round10.json)、[服务日志](server-round10.txt)、[Node测试](tests-round10.txt)、[行数检查](lines-round10.json)。
- 行数命令：`py -3 "C:\Users\mi\Desktop\_skill_extract\项目skill\scripts\check_lines.py" .`；0超限、0读取错误，自有代码最长401行，均≤500。
- 轮播「本周」使用实际上海日期。演示活动固定在2026年10月，其他周可能为空，此时展示真实空状态，不替换成精选冒充。
- 本轮未完成项：无。用户8787服务窗口仍交由Claude重启，以更新健康检查版本。
