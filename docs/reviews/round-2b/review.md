结论：**INCOMPLETE**。已附源码里，匹配页在大模型请求失败时不会走已测试的降级状态机；隐私、超时、重试、路径穿越和评测数字所依赖的实现与证据不在材料中，不能把这些验收项判为通过。

## 审查范围与缺失材料

已读：`docs/reviews/round-2-brief.md`、`docs/reviews/round-1/disposition.md`、`src/core/matcher.js`、`src/core/service.js`、`src/core/store.js`、`src/config/matching.js`、`src/data/ai-people.js`、`src/ui/pages/match.js`、`tests/matcher.test.js`、`tests/round3.test.js`。

这些文件里的物理行数都在 500 以内（最大是 `matcher.js` 的 368 行）。`match.js` 有数行超长模板，文件仍为 225 行，看不到为压过 500 行而把逻辑挤进一行的做法。

本轮验收要看、但材料未附的实现与证据：

- `server/`（超时、并发上限、只对网络错误做有界重试、schema、具名错误、静态目录穿越、`.env.local` 不可读、日志是否打出 Key 或完整提示词、结果缓存的键）
- `src/core/llm-client.js`、`src/core/llm-schema.js`、`src/core/progressive.js`（仅能从 `round3.test.js` 看到状态机的一部分）
- `src/config` 中的 `llm` 文案与 `reasons` / `synonyms` / 职位数据
- 提示词正文、`docs/match-eval.md`、`docs/screenshots/round-2/`、`docs/browser-round2.json`、`启动演示.bat`
- 处置记录里提到的“捕获上游 fetch payload”的测试；本次只看到 19 个 `test()`（`matcher.test.js` 13 个、`round3.test.js` 6 个）

文档计数彼此对不上，且都不是我执行的结果：处置记录写测试 44/44、评估 8/8、行数检查 72 个文件；brief 写测试 57/57、画像 13/13、行数检查 114 个文件、最大 381 行。我没有运行测试，不能把任一数字当成通过。

已在附带代码里核对过的第 1 轮公式：`matching.js` 将总分上限设为 97，`matcher.js` 按非负权重和与 `boostCeiling` 归一化；`need` 按角色/行业/技能覆盖比例计算；`reach` 为签到 0.75 或已报名 0.45 或其它 0.1，再加欢迎聊天 0.25；`service.js` 的 `jobFit` 为 `matched / total`，空要求为 0，求职版缺失时投影为空。职位文案是否 16 套且彼此不同，材料里没有职位文件，无法复核。

## 问题列表

### 1. 高 — 大模型请求一旦抛错，页面停在“等待精排”，本地结果不会标成失败

文件：`src/ui/pages/match.js` 第 24–36 行，对照 `tests/round3.test.js` 第 69–86 行。

证据：`setTimeout` 里直接 `await ctx.llm.rerank(...)`，没有 `try/catch`。只有 `progress.settle(...)` 成功时才会把 `engineName` 改成 `progress.get().phase` 并重绘。`round3.test.js` 证明失败路径应变成 `phase === 'failed'` 且保留 `begin` 时的本地行；抛错时 `settle` 不会被调用。

影响：服务进程起不来、网络中断、客户端超时后 reject，都会留下未处理的拒绝。列表仍是本地召回，横幅继续用进入请求前写入的 `engineName`（HTTP 且开启 LLM 时为 `'pending'`）。这和验收“服务失败时用本地规则，并标注真实引擎”不一致。`disposed` 也包不住这个路径。

最小修复：`try/catch` 里调用已有的 `settle`，失败结果使用 `{ engine: 'local', rows: [] }` 这类能让状态机落到 `failed` 并保留本地行的值；离开页面时同时中止未完成请求。

### 2. 中 — 引擎标签和渐进状态机不是同一套相位；离线仍会发起精排

文件：`src/ui/pages/match.js` 第 24–33、122–123 行；`tests/round3.test.js` 第 73–84 行。

证据：请求发出前，HTTP 且 `config.llm.enabled` 时把 `engineName` 设为 `'pending'`。测试里的 `begin()` 相位是 `'local'`（另有 `pending: true`），随后只出现 `'llm'`、`'failed'`、`'local'`。标签读 `config.llm.labels[engineName]`，`data-phase` 读的却是 `progress.get().phase`。`file:` 或关闭 LLM 时虽然 `begin(..., { offline: true })`，超时回调仍调用 `rerank`。测试只覆盖了离线时 `settle({ engine: 'local' })` 仍为 `local`，没有覆盖离线时 `settle({ engine: 'llm' })`。

影响：首屏本地名次和横幅相位可能不一致。若配置里没有 `labels.pending`，`textContent` 会变成字符串 `"undefined"`。若 `progressive` 在 `offline` 时仍接受 `engine: 'llm'`，用文件协议打开也会把本地结果标成大模型。`llm` 文案配置和 `progressive.js` 不在材料中，后半句是风险，前半句的相位分裂是代码已写明的。

最小修复：横幅只使用状态机相位；`offline` 时不要发请求；`settle` 在 `offline` 时忽略 `engine: 'llm'`。补测试锁住这两个分支。

### 3. 中 — 本次能看到的隐私测试，测不到“上游白名单”

文件：`tests/round3.test.js` 第 45–54 行；调用点在 `src/ui/pages/match.js` 第 28–29 行。

证据：测试先把 `visibleFields` 收成 `name/industry/bio`，再把技能、合作、报酬等改成 `HIDDEN-SENSITIVE`，然后对 `after.public` 调用 `llm-schema.projection`。`after.public` 来自 `matcher.project`，隐藏字段本来就不会复制进去。`projection` 即使原样返回，断言也会过。真正发往上游的是 `rerank(project(me), me.session.intent, recalled, ...)`：第二参是未再裁剪的 `session.intent`，第三参是完整排序行（含 `public`、`factors`、`score`、本地 `reason` / `icebreaker`）。

影响：不能据此接受“候选人只有白名单字段、理由不泄露隐藏字段、日志不打印 Key 或完整提示词”。处置记录里的 fetch payload 测试没有附在材料中。

最小修复：把仍带隐藏字段的原始档案送进 `projection`，并断言客户端实际 `fetch` 的 body 只有白名单键。服务端再滤一次的代码需要纳入审查。

### 4. 低 — 无 `versions` 且带 `intent` 的对象会整份当作公开投影

文件：`src/core/matcher.js` 第 26–30 行。

证据：注释写明缺版本应失败关闭。实现在查版本之前，对“有 `intent` 且没有 `versions`”的对象直接 `return person`。已投影结果必须走这条短路，否则再次 `project` 会被清空。副作用是：完整档案若只有 `intent`、没有 `versions`，`profile.contact` 等会进入 `score().public` 以及任何把该对象交给模型的路径。

影响：当前 `ai-people.js` 的人物都有 `versions`，演示主路径不会走到这里。这是边界缺陷，不是材料已证明的线上失败。

最小修复：短路只接受已经是投影形状的对象（例如只含 `id/profile/visibleFields/intent/status/openToChat`）；其它情况继续按可见字段过滤，缺版本得到空 `profile`。

### 5. 低 — 名次是 MMR 顺序，分数可以倒挂

文件：`src/core/matcher.js` 第 311–332 行；`src/ui/pages/match.js` 第 19–22、63–65 行；`src/config/matching.js` 第 21 行。

证据：召回使用 `lambda: 1`，展示前再 `mmr(..., topK)`，默认 `mmrLambda` 为 0.88。排序值是 `0.88 * score / 100 - 0.12 * 相似度`。相似度差超过约 0.42 时，低 5 分的人可以排到前面。列表用 `01/02/03` 加百分数展示，没有多样性说明。处置记录里的默认 Top5 `80/79/74/79/73` 已经不是分数降序。brief 里的“第 2 名 87、第 3 名 92”与这段算法一致，我没有看到评测报告原文。

影响：这是多样性重排的结果，不是假分数或静态名单。用户会把名次理解成分数序。

最小修复：若产品要按匹配分排序，展示列表按 `score` 稳定排序，MMR 只用于换一批的候选池；若保留 MMR，名次旁注明多样性调整。

### 6. 低 — 新增 18 人的头像编号、兴趣和教育文案与“独立撰写”不一致

文件：`src/data/ai-people.js` 第 48–51 行。处置记录写明当时只有 48 张不同头像，49–60 号用首字占位。

证据：新人物头像为 `p49`–`p66`。兴趣是 `i % 2` 的“徒步/摄影”，教育全是“大学 · 计算机与相关专业”。`round3.test.js` 第 56–67 行只断言头像字符串和技能组合，不断言图片文件存在。

影响：这 18 人在现有素材约定下会落到占位或加载失败。共享兴趣会进入 `tokens()`，轻微拉高 MMR 相似度。技能、简介和合作偏好在表里是分人写的，打分主路径仍然有区别。头像文件本身不在本次材料里，我没有打开图片目录。

## 推断风险（材料没有证明失败）

- brief 提到理由中出现“反向需求未披露”“仅登记未签到”。已附源码、测试和两份文档正文都没有这两句。本地 `reason()` 只从公开投影取姓名、技能、行业、经历和简介。若提示词把 `status`、`publicIntent` 的内部分类交给模型，模型仍可能复述出来。需要提示词和评测原文才能定责。
- brief 提到 8787 被无关进程占用、启动脚本端口固定。脚本不在材料中，无法核对。
- 服务端缓存若只按候选人 id 缓存，招呼/见面后的本地分会变，精排结果可能仍是旧顺序。缓存实现未附。
- `jobFit` 的同义词表只合并了行业、角色和可提供项。技能同义词是否参与职位要求，取决于未附的 `synonyms.js` 与职位文案；字面包含仍然有效。

## 建议的验证步骤

下列步骤都还没有在这次审查里执行。

1. 对 `rerank` 分别做 reject、超时、HTTP 500 和非 schema JSON。预期：列表仍是本地行，横幅为失败/本地规则，控制台没有未处理拒绝，且不会先显示“大模型”。
2. 用 `file://` 打开同一页。预期：不请求 `/api/llm/rerank`，横幅为本地规则。
3. 在客户端测试里抓取真实 `fetch` body：候选只含白名单；伪造的联系方式、隐藏意图、完整档案不在 body 里；响应理由也不含这些值。日志断言不含 Key 和完整提示词。
4. 服务端测试：并发超过上限、上游超时、DNS 失败与 4xx/5xx 的重试次数不同；`id` 不在入参内、分数越界、理由过长都被拒绝并具名返回。静态文件请求 `../.env.local` 与编码后的路径均失败。
5. 固定一份召回，打印 MMR 前后的 `id` 与 `score`，确认倒挂只来自 `mmrLambda`。需要单调展示时再改 UI 或排序。
6. 对照 `docs/match-eval.md` 原文核对 8/8 与 13/13 哪一份是当前结果，并抽查含内部措辞的理由是否仍在。
7. 在 8787 已被占用时运行启动脚本，确认失败方式对用户可见，且页面不会把未完成请求标成大模型。
