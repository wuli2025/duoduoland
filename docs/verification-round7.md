# 第7轮验收：真实调用、活动参会者与思考状态

## 实现

- 在线匹配走`idle → reading → recalled → llm-pending → done/cached/failed`。前两步由实际本地计算推进，第三步由客户端POST发出回调推进。计时从该回调提供的真实起点计算；250ms计时刷新只更新文字，不推进任何阶段。
- 等待期间不展示最终排名；展示本场实际参与评分的人数、本地实际候选数和候选公开头像。黑色细线圆环与亮黄轨道点使用CSS动画；减少动态效果时保持位置不动，仅做缓慢透明度脉冲。
- 成功后Top5按最终分数降序、依次淡入。标题下显示服务端模型名、用时和完成时间。响应meta含`model/durationMs/cached/cachedAt/correlationId`，以及原计算时长`upstreamMs`、`completedAt/sourceCorrelationId`；不含Key或提示词。客户端校验并按白名单接收元信息，缺失或不合法则本地降级。
- 缓存命中显示“使用x分钟前的大模型结果”，同时展示原模型计算耗时与时间。“重新计算”发送`bypassCache:true`，绕过命中和进行中的共享请求，真实调用上游并更新原缓存。旧请求迟到不能覆盖较新的计算结果。
- 超时/失败停止动效，显示“推荐服务暂未响应，已改用本地规则”、本地Top5和重试按钮。file或关闭LLM时不进入思考状态，直接本地计算。页面离开/改变筛选仍中止旧请求，过期结果不能覆盖新状态。
- 活动详情/卡片显示登记报名数与实际公开名单中的签到数，并说明统计口径。详情最多24人，余下显示+N；卡片叠放4人。签到优先、hover公开姓名/职位、点击本场名片；隐藏头像用首字占位，其他隐藏字段显示锁。名单少于报名总数时说明实际公开人数。

沿用现有`.env.local`中的提供方及模型，没有更换API或读取Key到输出。真实模型名为`gpt-6-astra`。

## 真实上游证据

浏览器入口：`http://127.0.0.1:8787`。本轮该端口空闲，服务正常监听；脚本结束时只关闭自己创建的进程。占用端口顺延仍有Node回归测试。

服务端[结构化日志](server-round7.txt)与[浏览器响应记录](browser-round7.json)可相互对应：

| 动作 | correlationId | 服务端上游耗时 | HTTP响应meta耗时 | 是否命中缓存 |
| --- | --- | ---: | ---: | --- |
| 首次匹配 | `de5d7fa6-953e-4fd4-8390-edd455263720` | 28527ms | 28529ms | 否 |
| 再次进入 | `a8001b92-0db4-407f-84ea-86608a6be36f` | 无新增上游调用 | 0ms | 是 |
| 点击重新计算 | `fb5619fd-4b97-4c64-8461-128d9fc8be49` | 25991ms | 25992ms | 否 |

首次完成时间`2026-10-08T12:36:20.350Z`；缓存保留相同时间及来源请求号。重新计算完成时间`2026-10-08T12:36:48.526Z`。两次真实上游调用均无理由回退或候选移除；不把缓存访问计为第三次模型计算。

截图：

- [思考中：41位公开参会者、10位候选、真实模型与计时](screenshots/round-7/01-thinking.png)
- [完成：真实模型、耗时与时间](screenshots/round-7/02-completed.png)
- [缓存命中：原结果时间与重新计算按钮](screenshots/round-7/03-cached.png)
- [重新计算完成](screenshots/round-7/04-recalculated.png)
- [活动详情头像墙](screenshots/round-7/05-attendee-wall.png)
- [本场公开名片浮层](screenshots/round-7/06-public-card.png)
- [注入失败后的本地结果与重试](screenshots/round-7/07-failed.png)
- [file本地降级](screenshots/round-7/08-file-local.png)
- [活动卡片真实头像叠放](screenshots/round-7/09-event-cards.png)

首次调用、缓存、重新计算使用真实API；只有失败场景显式注入异常。浏览器无页面错误或未处理rejection。补充[视觉检查](browser-round7-visual.json)验证1024px无横向溢出、reduced-motion计算样式为`match-pulse`；没有用动画模拟接口进度。

## 复测

| 命令 | 结果 |
| --- | --- |
| `node --test tests` | 98/98通过，0失败、0跳过；[输出](tests-round7.txt) |
| `node --test tests/round7.test.js` | 新增8项：阶段/真实时钟、失败离线/过期、meta/绕过缓存、并发旧结果隔离、客户端实际fetch起点与body、非法meta拒绝、实际评分人数、活动投影隐私 |
| `py -3 scripts/browser-round7.py` | 真实首次调用、缓存、bypass、头像墙/浮层/占位、失败重试、file均通过；脚本只管理自己启动的Node进程 |
| `py -3 "C:\Users\mi\Desktop\_skill_extract\项目skill\scripts\check_lines.py" .` | 200个文件，无超限、无读取错误；最大386行（matcher.js）；[输出](lines-round7.json) |

已更新[README](../README.md)和[功能树](feature-tree.md)。本轮未重跑13项匹配质量评测，因为排序算法和人物数据未更改；确定性匹配检查仍包含在98项测试内，第6轮质量评测报告保留。旧轮次浏览器脚本保留历史阶段契约，当前验收入口为`browser-round7.py`。

未完成项：无。
