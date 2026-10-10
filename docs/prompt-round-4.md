# 第 4 轮：Grok 第 2 轮复审修复 + 体验收尾

阅读 Grok 第 2 轮复审：docs/reviews/round-2b/review.md（前端/引擎/数据）与 docs/reviews/round-2a/review.md（server/LLM，若存在）。逐条处置，写入 docs/reviews/round-2/disposition.md（问题 / 严重度 / 采纳或有证据驳回 / 修改 / 复测命令与结果）。保持既有约束（≤500 行、配置化、无 emoji、Bonjour 风格、隐私投影、不打印 .env.local 中的 Key）。

## 必修（来自 Grok + Claude 验收）
1. **LLM 失败路径**（2b-1 高）：match 页 rerank 调用包 try/catch，任何 reject/超时/HTTP 错误/非法 JSON 都走 progressive.settle 落到 `failed`，保留本地行并标注"本地规则计算（推荐服务未响应）"；离开页面时 AbortController 中止请求；无未处理 rejection。
2. **相位统一 + 离线不请求**（2b-2）：横幅只读状态机相位；file:// 或 llm 关闭时完全不发请求；offline 时 settle 忽略 engine:'llm'；补测试。
3. **真实上游白名单测试**（2b-3）：客户端测试抓取实际 fetch body（注入假 fetch），用仍含隐藏字段/联系方式/隐藏意图的原始档案作输入，断言 body 只含白名单键；服务端再过滤一次，同样测试；我的本场意图也只发必要字段。
4. **project 短路**（2b-4）：只接受投影形状对象，其它情况按可见字段过滤，缺版本得空 profile；测试。
5. **排名与分数一致**（2b-5，Claude 也发现）：展示列表按最终分数稳定降序，MMR 只用于决定"哪 5 人入选"（多样性），入选后按分数排序显示；测试断言显示顺序分数单调不增。
6. **AI 人群细节**（2b-6）：18 位 AI 人物的兴趣、教育背景各自撰写，不用 i%2 模板；测试断言 p49–p66 文件真实存在且每人唯一。
7. **LLM 理由去内部措辞**（Claude 发现：评测里出现"反向需求未披露""仅登记未签到""当前不开放聊天"等）：提示词中不要把 status/publicIntent/openToChat 等内部字段以可复述的形式交给模型（或明确禁止在 reason 中提及签到状态、是否公开意图、是否开放聊天、数据缺失）；理由必须是面向用户的自然一句话，聚焦"为什么值得见面"。服务端后处理加一层禁用词过滤（配置化词表：未披露、未签到、仅登记、不开放、暂无证据、反向需求 等），命中则回退本地理由并记录。match-eval 增加"理由措辞检查"。
8. **端口占用**（Claude 发现：本机 8787 被其他无关 node 进程占用；不要结束该进程）：server 在 EADDRINUSE 时自动尝试后续端口（8787→8788→…，上限可配），控制台打印实际地址，`启动演示.bat` 打开实际端口（例如由 server 自己 `--open` 打开实际 URL）；前端 llm endpoint 使用相对路径（同源），不写死端口；测试端口回退。
9. 缓存键需包含会影响结果的输入（候选集合与其本地分/状态、意图、模型、提示词版本），招呼/见面后不会命中旧结果；测试。
10. 2a 中的服务端问题按同样标准修复。

## 收尾
- 重跑 `node scripts/eval-match.js`（含真实 LLM），更新 docs/match-eval.md，汇总通过率与理由措辞检查结果如实记录。
- 浏览器验收：http（实际端口）下匹配页"本地初排 → 大模型精排"过程；关闭 server 后再进入匹配页显示失败降级；file:// 降级。截图存 docs/screenshots/round-4/。
- `node --test tests` 全通过；check_lines 通过；更新 docs/feature-tree.md 与 README（启动方式、端口说明）。
- 最终回复：处置摘要、测试数、行数、评测通过率、实际端口行为、未完成项（如实）。

## 补充：docs/reviews/round-2a/review.md 已生成（7 条服务端问题），全部按第 10 条处理；其中端口问题按本文件第 8 条（自动尝试后续端口 + 打印实际地址）实现，同时监听 error 事件给出具名错误。
