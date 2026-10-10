结论：**INCOMPLETE**。本次只阅读了材料里的源码，没有运行测试。所给范围内能确认一处理由证据闸门仍宽于第 4 轮声明；端口顺延、理由策略、提示词清洗、MMR 排序、报名页/搜索文案和头像数据等修复，缺少对应实现，不能判为已修复，也不能判为通过。

## 审查范围与缺失材料

核对目标是第 2 轮 2a 共 7 条、2b 共 6 条，以及处置表里的第 7–9 条。材料里有处置表、`server/index.js`、`server/llm.js`、`server/upstream.js`、`server/cache.js`、`src/core/llm-client.js`、`src/core/llm-schema.js`、`src/core/progressive.js`、`src/ui/pages/match.js`、`prompts/rerank.md`。

所给文件都低于 500 行（最长是 `match.js` 的 235 行）。长模板行存在，但离 500 行上限远，看不出为卡行数而压行。功能树文本、`lines-round4.json`、测试源码和测试输出都不在材料里，全库「146 文件、最大 381 行」和「72/72」只是 brief 与处置表的转述。

这些文件缺失，使对应条目无法从实现上核对：

- `server/listen.js`：2a-4 的 `error` 监听、`EADDRINUSE` 顺延、`PORT_ATTEMPTS`、实际 URL、`--open`
- `server/reason-policy.js` 与 `src/config/reason-policy.js`：禁用词、逐条回退、策略版本（2a-5、第 7 条）
- `server/prompt-input.js`：从模型输入去掉 `status` / `openToChat`（2a-5）
- 匹配引擎（`matcher` / `mmr`）：2b-5 的入选后稳定降序
- 报名页、全局搜索：2a-1 的引擎文案是否真的展示
- 18 人兴趣、教育背景、头像资源与数据测试：2b-6
- `tests-round4.txt`、`browser-round4.json`、评估报告与截图

所给源码里能看到、但本轮没有执行验证的实现包括：匹配页 `try/catch` 后 `settle`，离线/`enabled === false` 不发精排，`data-phase` 跟随 `phase`；投影白名单与 `visibleFields` 再过滤；取消从页面 `AbortController` 传到客户端、`res` 的 `close` 和服务端共享缓存；非 `completed` 信封会拒绝；缓存键包含招呼/见面、模型和提示词；请求体先按字节拼接再 UTF-8 解码。brief 里的 27.6s、2ms、8788 和截图分数是他人观察，不是本次复核结果。

## 问题列表

1. **中** — `src/core/llm-schema.js` 第 69–75 行。  
   **证据：** `grounded()` 在姓名之外，把 `experience`、`bio`、`interests` 与技能、行业、`intent.offer`、合作条件并列，任一完整子串命中即通过。`prompts/rerank.md` 第 4 行和处置表 2a-5 要求的是姓名，加上完整的技能、行业、资源或合作条件。四字滑窗确实已不在这段代码里。  
   **影响：** 理由只要含姓名，并完整带上一个短兴趣或短简介，就能跳过回退。例如兴趣为「茶道」、理由为「张三对茶道有兴趣，值得见面」，闸门会放行。弱证据理由仍会以大模型结果进入页面。  
   **修复：** 证据只保留行业、技能、可提供资源（`offer`）和合作条件字段；兴趣、简介、经历不要单独放行。补一条只命中兴趣、不命中技能/行业/合作条件的回归测试。

2. **低** — `src/core/llm-schema.js` 第 18–19 行。  
   **证据：** 微信/QQ 规则要求号码紧跟在「微信/QQ/vx」和可选的 `:：=` 之后。中间的「是」不会被吃掉。邮箱规则是独立的。  
   **影响：** `微信是bonjour_01`、`QQ是123456789` 这类明确写出的联系方式会原样进入投影和提示词。冒号形式「微信：bonjour_01」会被换成「[联系方式已省略]」。  
   **修复：** 在号码前允许可选的「是/为/号」一类标记，并加这两组字符串的断言。不要整段删除简介。

3. **低** — `prompts/rerank.md` 全文；brief 第 4 行。  
   **证据：** 提示词没有规定参会者称呼。brief 记录真实精排理由使用「您」。界面其余文案是否用「你」，依赖未提供的 `config.copy`，本次不能核对界面源文案。  
   **影响：** 同一屏推荐语和按钮说明的称呼可能不一致。这是 brief 里的人工观察，加上提示词确实没有这条约束；我没有看到截图。  
   **修复：** 在精排提示词中规定称呼，并与 `reason-policy` 的回退句使用同一套文案。

4. **低** — `server/llm.js` 第 18–24 行、第 76–78 行；`server/index.js` 第 48–50 行。  
   **证据：** `schema.request()` / `schema.text()` 在 `call()` 的 `try` 之外执行。`rerank()` 在打缓存日志之前再校验一次。校验抛错时，`LLM_NOT_CONFIGURED` / `LLM_BUSY` 那条结构化日志不会写。`index.js` 仍把该错误变成带 `correlationId` 的 HTTP JSON，自身也不记日志。  
   **影响：** 非法候选、非法档案返回 502 且响应里有请求号，但服务日志对不上这条拒绝。超时、忙、取消仍会按现有 `try` 记日志。  
   **修复：** 在统一出口记录 `correlationId`、`operation`、`status: error`、`code`、`durationMs`，校验失败也走这条路径。

## 建议的验证步骤

下面前两项是代码已经能确定的失败条件，后几项是材料不足带来的风险，不是已复现故障。

1. 对问题 1：构造一名候选人，公开兴趣为短词，技能和合作条件都不出现在理由里，但理由包含姓名和该兴趣。期望当前 `rerank()` 接受；收紧证据表后应 `REASON_EVIDENCE_FALLBACK` 或整批失败。再测一条只含技能前四个字、不含完整技能的理由，确认仍然拒绝。
2. 对问题 2：把 `微信是bonjour_01` 和 `QQ：123456789` 放进 `bio`，检查投影和上游提示词。只有后者按现有正则会被省略。
3. 打开未提供的 `reason-policy`、`prompt-input`、`listen`、MMR 实现和报名/搜索页后，再逐项对处置表。在此之前，不要把 2a-1 的界面、2a-4、2a-5 的回退词表、2b-5、2b-6 算作已关闭。
4. 推断风险：`server/upstream.js` 第 10、19 行把任意 `signal.aborted` 写成 `LLM_TIMEOUT`。`call()` 里取消 Promise 会先同步拒绝，正常竞态下对外应是 `LLM_ABORTED`。需要一条「客户端中途断开」测试看日志 `code`，确认胜出的不是 `LLM_TIMEOUT`。
5. 推断风险：`projection()` 第 48–49 行仍输出 `status` 与 `openToChat`。是否在进模型前被 `prompt-input.compact` 删除，材料里没有该函数。应用一条带 `checked_in` 和 `openToChat: false` 的请求，捕获真正的上游 body。
6. 推断风险：`server/llm.js` 第 9–11、79–81 行为缓存键静态引入 `src/config` 下的匹配、同义词和理由模块，并把整个导出对象做 `JSON.stringify`。函数属性会被丢掉，循环引用会让精排直接失败。需要看这三个模块的实际导出；若只有纯数据，则这条不成立。
7. brief 中的端口顺延、`/.env.local` 404、真实精排耗时和分数单调，只能在补上 `listen.js`、测试输出和截图后复签。`index.js` 第 71–72 行的 `catch` 丢弃了 `listen()` 的拒绝原因；若 `listen.js` 自己不打印，启动失败只剩退出码 1。
