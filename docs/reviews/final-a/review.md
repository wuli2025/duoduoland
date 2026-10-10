结论：**CHANGES_REQUIRED**

所附服务端代码里，第 3 轮的 4 条问题以及取消/超时、状态标记、缓存身份、监听原因这 4 条推断，都能看到对应实现。阻塞点在理由回退：模板、40/20 字截断、16 字选题和“理由必须互异”叠在一起，有允许证据时仍会把整批精排打失败，或把截断后的破冰句当成成功结果。本审查没有运行测试，处置里的 81/81、13/13、0/130 只是声明。

## 审查范围与缺失材料

对照了 `disposition.md` 中的 4 条问题与 4 条推断，以及所附的 `listen.js`、`index.js`、两份 `reason-policy.js`、`prompt-input.js`、`llm.js`、`upstream.js`、`llm-schema.js`、`prompts/rerank.md`、`tests/round5.test.js`、`tests/round4-server.test.js`。

这些路径在所附代码中对得上：

- 兴趣、简介、经历不在 `grounded` 证据表里；无话题时 `repair` 抛 `NO_SAFE_REASON`。
- `text()` 能盖住「微信/QQ/vx + 号/是/为/冒号」这类样例。
- 精排提示词、兜底句、破冰句使用「你」；`rerank` 对模型原文和回退结果都做「您」→「你」。
- `rerank`/`intent` 有统一 `boundary`；HTTP 4xx/5xx 走 `logError`。监听失败会把 `error.code` 当作 `causeCode`。
- 超时与取消分别 `abort(error)`；`upstream` 只在 `signal.reason.code === 'LLM_TIMEOUT'` 时记超时。
- `compact()` 只输出 `id`、`profile`、`intent`，以及 `local` 的 `id`/`score`。
- 缓存身份用的是 `versions`、`policy.version` 和提示词文本，没有把匹配配置模块整包放进键里。

未发现假进度或假成功：上游会真实 `fetch`；缓存命中带回的是以前的调用结果；没有安全话题时抛错，不会补造技能或行业。

下列材料未附。按本批范围列出，**不作为失败依据**：

- 第 3 轮 `review.md` 原文（仅有处置表的转述）
- `server/error-log.js`（跨层是否只记一条）、`server/cache.js`、`server/cache-versions.js`、`server/config.js`
- `src/core/matcher.js`（MMR、`blankIntent`、本地理由是否还引用兴趣）
- AI 人物数据、`tests/round4-fixtures.js`、`prompts/intent.md`
- `src/ui` 文案、功能树、README
- `tests-round5.txt`、`match-eval.md`、`lines-round5.json`、`docs/evals/round-5/`
- 本轮浏览器/布局证据（处置写明没有新截图）

因此界面是否还有「您」、去重是否按关联号生效、MMR 是否仍在排序链路里，本批都不能复核。

## 问题列表

### 1. 中：回退句和最终字数预算不一致，有证据也会整批失败

文件：`server/reason-policy.js` 12–17 行；`src/config/reason-policy.js` 10–11 行；`src/core/llm-schema.js` 16–25、44、91–101 行。

证据：

- 兜底句是 `{name}擅长{topic}，你可以从这个方向聊起。`。除姓名和话题外固定 15 字，理由上限 40，姓名+话题只有 25 字预算。
- 选题条件是 `[...v].length <= 16`，姓名却由 `text()` 默认放到 300 字。话题 16 字时，姓名超过 9 字就会在 40 字截断里切掉话题或姓名。
- 截断发生在 `repair` 返回之后：`output.reason = text(address(output.reason), 40)`，接着 `grounded` 要求理由同时包含**完整**姓名和**完整**证据，否则 `UNGROUNDED_REASON`。
- 技能/offer 等列表项允许到 80 字。唯一证据若是 17–80 字，选题直接跳过；模型原文又放不进 40 字时，`repair` 走 `NO_SAFE_REASON`。
- 破冰句 `你最近在{topic}方向有哪些尝试？` 固定 12 字，上限 20，话题超过 8 字必被截断。9–16 字的合法话题仍会返回 200，破冰句停在半句上。

可复现影响：姓名 10 字、话题 16 字时，完整回退句 41 字，截断后完整话题不在理由里，整单精排失败。唯一技能为 41 字（schema 允许）时，有公开技能仍报无安全理由。话题 9–16 字时请求可以成功，但破冰句不再是完整问句。

`round5.test.js` 只用「陈屿」和「多模态视频生成」（2 字 + 7 字，理由 24 字、破冰 19 字）。这条回退锁的是短字段。处置若属实（130 位次 0 回退），那次真实评测也没走进这条路径。

最小修复：按「40 − 固定字数 − 姓名字数」选择仍能完整放进理由的证据；放不下时换更短的模板，或只失败该候选人。破冰句用同一预算生成，截断后仍须是完整问句。补一条长姓名、一条 17 字以上唯一技能、一条 9–16 字话题的回归。

### 2. 中：确定性回退句与“理由必须互异”冲突，多人同话题会整批失败

文件：`server/reason-policy.js` 16–17 行；`src/core/llm-schema.js` 36–49、104 行。

证据：

- `fill` 只替换 `{name}` 和 `{topic}`。姓名缺省时替换成空串，句式变为 `擅长{topic}，你可以从这个方向聊起。`
- `projection` 不要求姓名。姓名可以不在 `visibleFields` 里。
- 话题取技能、行业、offer、合作条件里第一个措辞合法且不超过 16 字的值。两人第一技能相同，就会得到同一句。
- `rerank` 在逐条回退之后检查 `new Set(reasons).size !== results.length`，然后抛 `DUPLICATE_REASON`。抛错点在整表 `map` 里，一名候选人失败，最多 24 人全部没有结果。

可复现影响：两名未公开姓名的候选人，模型理由都没引用允许证据，且第一项技能都是「端侧推理」。各自的回退句都合法，整单仍因重复理由失败，调用方得到 502。同名且首选话题相同也一样。

所附测试只回退 1 名候选人，看不到这个分支。

最小修复：回退句在仍包含完整允许证据的前提下，用职称、城市或其他可见字段区分；区分后仍超长或仍重复时，只丢掉该条并记录 `candidateId`。不要让 `DUPLICATE_REASON` 覆盖已经生成的其他人结果。补“两名无姓名、同一技能”的用例。

## 建议的验证步骤

下面前两条是代码里已经能确定的失败条件，需要新测试证实端到端行为。其余是推断或未附实现，不能当成已经失败，也不能当成已经通过。

1. 构造姓名 10 字、唯一技能 16 字的候选人，模型只返回兴趣理由。期望：回退后理由仍包含完整技能和完整姓名，接口 200。按现在的截断，会得到 `UNGROUNDED_REASON`。
2. 构造两名无姓名、第一技能同为「端侧推理」、模型理由无证据的候选人。期望：两条都返回，或只丢弃无法区分的那条并各记一条 repair 日志。按现在的实现，会得到 `DUPLICATE_REASON`，且整单失败。
3. 再补一条唯一证据为 40 字以上技能的请求，确认产品选择的是“缩短模板后引用全文”还是“该条降级”。现在会走 `NO_SAFE_REASON`。
4. 取消与超时：所附 `llm.js` 和 `upstream.js` 已把具名原因传给 `AbortController`。要用真实 `upstream.request` 加中途断开再跑一次；`round5` 的断开用例替换的是 `fetchImpl`，胜出的是 `cancellation` 那个 Promise，没有走到 `upstream` 里按 `signal.reason` 分类的分支。
5. 日志去重以未附的 `error-log.js` 为准。`llm.js` 的 `boundary`、`index.js` 的 `catch` 和 `json()` 对同一次失败最多会调用三次 `logError`。集成测试写了“只许一条”，我没有执行，不能把该断言当作结果。
6. 状态标记、循环配置、EACCES：对应实现和用例都在所附文件里。需要实际跑 `node --test tests` 才能说通过。缓存键是否随规则变化而失效，还要看未附的 `cache-versions.js` 是否真的跟着匹配规则改版本。
7. MMR 和人物数据未附。提示词写明多样性交给后续 MMR；这条链路本次无法审查。真实评测 13/13、称呼 0 处「您」、理由回退 0/130，都要看到 `docs/evals/round-5/` 原文后再采信。
