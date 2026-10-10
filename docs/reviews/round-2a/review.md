结论：**CHANGES_REQUIRED**

所提供的代理、校验和降级代码里，有能直接从源码确定的验收缺口。第 1 轮「分数区分度、理由差异化、逐职位匹配」以及界面是否如实展示引擎，材料不够，**不能算通过**。这次只读了下面贴出的源码，没有跑测试，也不能把材料里「57/57」写成已复验。

## 审查范围与缺失材料

审了：`server/index.js`、`config.js`、`llm.js`、`upstream.js`、`cache.js`、`prompt-input.js`，`prompts/rerank.md`、`prompts/intent.md`，`src/core/llm-client.js`、`llm-schema.js`、`progressive.js`，`src/config/llm.js`，`tests/llm.test.js`、`tests/llm-cache.test.js`，`启动演示.bat`。

这些文件都短于 500 行（最长是 `tests/llm.test.js` 的 136 行），没有看到用压行凑限额。简报里的 check_lines（114 个文件、最大 381 行）没有脚本和文件清单，全库行数未核实。也没有功能树，无法核对功能树是否覆盖本轮改动。

材料里能对上的行为：

- 重排提示词在外部 Markdown 里，融合权重来自 `src/config/llm.js` 的 `weights`。
- `rerank` 只有校验通过才返回 `engine: 'llm'`；`file://` 在发请求前就走本地。
- 上游 body 会再滤一遍字段白名单，并脱敏邮箱、URL 和一段数字电话。成功/失败日志结构只有 `correlationId`、`operation`、`status`、`code`、`durationMs`。
- 网络错误只再试一次；HTTP 和 JSON 错误不重试；`incomplete` 不写入缓存。
- 融合之后调用 `engine.mmr`。MMR 会为多样性打乱顺序，名次可以和分数不一致。简报里的「第 2 名 87、第 3 名 92」与这条调用方式相符。界面有没有把这个顺序说成分数排名，没有页面代码，无法判断。

缺失，且下面都不算通过：

- 简报点名的 `docs/reviews/round-1/disposition.md` 未附带。本地 `rank` / `project` / `mmr` / `parseIntent`、职位条件打分、78 人数据也不在材料里。
- `labels`、`debounceMs`、`transitionMs`、`candidateCount`、`versionIcons` 在所附文件中没有读取点。`progressive` 的调用方、页面文案绑定不在材料里。
- `docs/match-eval.md` 只有简报转述，没有原文。
- `.env.local` 按说明排除，Key 是否泄漏只能看日志和响应字段，不能看真实环境。

`server/llm.js`、`server/upstream.js` 直接 `require('../src/core/llm-schema.js')`。校验因此只有一份。服务器依赖前端目录，迁移时要一起搬走。提供的代码没有样式表，也没有跨请求的可变全局；并发计数、缓存和 `negotiatedTimeout` 都在工厂闭包里。

`server/prompt-input.js` 在白名单之后还会丢掉 `company`、`projects`、`education`、`goals`，并且在已有 `skills` 时丢掉 `experience`。`config.js` 没有开关。这仍是白名单的子集。人物字段实际写在哪，材料里没有，不能判断精排是否因此缺了技术经历。

## 问题列表

### 1. 高 — 意图降级没有引擎标识

文件：`src/core/llm-client.js` 69–71 行；测试把该行为写成了期望：`tests/llm.test.js` 88–99 行。

```69:71:src/core/llm-client.js
async function parseIntent(text) {
  try { return schema.intent(await post('intent', { text })); }
  catch (_) { return engine.parseIntent(text); }
}
```

成功和失败都返回裸意图对象。`file://`、超时、非 2xx、schema 失败都会落到 `engine.parseIntent`，错误被吃掉。`rerank` 会返回 `engine: 'llm' | 'local'`，意图这条没有对应字段。

影响：服务失败时确实走了本地规则，但调用方无法标注真实引擎。验收要求的「降级如实」在意图路径上做不到。测试第 98 行只比较解析结果，不断言引擎。

最小修复：成功返回 `{ intent, engine: 'llm' }`，失败返回 `{ intent: engine.parseIntent(text), engine: 'local', error: error.code || 'LLM_FAILED' }`，并改 `tests/llm.test.js` 的意图断言。调用方不在材料里，需要一并改。

### 2. 中 — 具名错误出了服务端就被丢掉，部分失败还不写日志

文件：

- `src/core/llm-client.js` 19–36、43–47、55、65–66 行
- `src/core/progressive.js` 13–18 行
- `server/llm.js` 16–17、39–46 行
- `server/index.js` 41–43 行

客户端超时使用 `new Error('LLM_TIMEOUT')`，没有 `error.code`。`rerank` 的失败结果用 `error.code || 'LLM_FAILED'`，所以这次超时对外是 `LLM_FAILED`。任意非 2xx 都变成 `LLM_UNAVAILABLE`，服务端已经返回的 `LLM_TIMEOUT`、`LLM_BUSY`、`LLM_NOT_CONFIGURED` 被丢掉。

`progressive.settle` 在非 llm 时只改 `phase` 和 `pending`，不保存 `result.error`。`file://` 的 `LLM_OFFLINE` 只有 `begin({ offline: true })` 时才会停在 `local`；否则会变成 `failed`（文案是「精排未完成」）。接线不在材料里，两种相位是否用对无法核实。

健康检查失败也会把 `negotiatedTimeout` 缓存成配置值，同一次页面生命周期里不再协商。

`LLM_NOT_CONFIGURED` 和 `LLM_BUSY` 在 `call` 的 `try` 之外抛出。`call` 的日志在 `try` 里，`index.js` 的 `catch` 只回 JSON、不写日志。缺 Key 和并发拒绝在服务端日志里没有记录。

影响：排障只能看到笼统失败。未配置 Key 和上游超时可以显示成同一种「精排未完成」。

最小修复：客户端读响应 JSON 的 `error`，仅当其匹配 `/^[A-Z_]+$/` 时沿用，并给超时错误补上 `code`。`settle` 写入 `error`；`LLM_OFFLINE` 使用 `local`。健康检查失败不要写入已协商缓存。`LLM_BUSY` / `LLM_NOT_CONFIGURED` 在抛出前打与现有成功日志相同形状的一行。

### 3. 中 — 请求体按块拼接字符串，UTF-8 会被截断

文件：`server/index.js` 32–38 行。

`for await` 得到的是 `Buffer`。`body += chunk` 会对每一块单独做 UTF-8 解码。中文这样的多字节字符被切在两块之间时，字符会变成替换字符，随后 `JSON.parse` 失败，接口返回 `INVALID_JSON`。

影响：合法重排请求被拒绝，浏览器再降级到本地。回环上小于可读流高水位（默认 64KiB）的 body 常常一块到达，现有小 payload 测试可以一直是绿的。接口允许到 100000 字节，超过高水位或分块到达时会坏。我没有抓包确认当前 10 名候选人的体积。

最小修复：先 `Buffer.concat` 再 `toString('utf8')`，或先 `req.setEncoding('utf8')` 再拼字符串。长度按字节计，仍保持 100000 上限。

### 4. 中 — 固定端口，listen 失败没有处理

文件：`server/config.js` 22 行（默认 `8787`），`server/index.js` 61–67 行，`启动演示.bat` 第 3 行。

`listen(config.port, '127.0.0.1', callback)` 没有 `server.on('error')`。按 Node `http.Server` 的约定，`EADDRINUSE` 走 `error` 事件；没有监听函数时，未处理异常会让进程退出。回调形式的 `listen` 收不到这个错误，`--open` 也不会执行。bat 没有备用端口。

影响：8787 已被占用时，演示起不来。简报说本机该端口被无关 node 占用；**我没有在本机复现**，代码路径本身会这样结束。

最小修复：监听 `error`，打一行 `{ event: 'listen_error', code: 'PORT_IN_USE' | 'LISTEN_FAILED' }`（只记 `error.code`），并以非 0 退出。需要换端口时继续用已有的 `PORT`。

### 5. 中 — 理由校验和提示词不一致，签到状态会被写成事实

文件：`src/core/llm-schema.js` 44–45、54–84 行；`prompts/rerank.md` 第 4–5 行；`server/llm.js` 37 行（校验失败会让整次 `rerank` 抛错）。

`projection` 把任何非 `checked_in` 的状态都写成 `registered`，缺省也一样；`openToChat` 缺省变成 `false`。这两个字段不在 profile 白名单里，但总会进上游 JSON。提示词没有禁止把签到和内部因子写进 `reason`。

`grounded` 的证据只有行业、技能、`intent.offer`、经历、简介、兴趣。提示词要求引用姓名，并要求按合作方式、业务、时间、报酬、在职状态打分，这些字段不在证据里。长度至少为 4 的证据，任意连续 4 字出现在理由里即通过。不要求理由主体来自证据。`icebreaker` 不查证据。提示词写 icebreaker 最多 20 字，schema 截到 40（`llm-schema.js` 79 行；`tests/llm.test.js` 57 行把 40 锁成了期望）。

任一候选人触发 `UNGROUNDED_REASON`、`DUPLICATE_REASON` 或其他 schema 错误，整批精排丢弃，客户端保留本地结果。

影响：模型若按提示词引用「联合创始人」或报酬条件、又没有带上技能/行业原文，整单降级。相反，理由里只要撞上简介中的 4 个字，就可以同时写「仅登记未签到」「反向需求未披露」。缺省状态还会给模型一个「未签到」的前提。简报转述评测里出现过这类措辞；**评测原文未附，不能把转述当成已复现的日志**，但现有校验挡不住这些句子。

最小修复：状态只在原值就是 `checked_in` 或 `registered` 时保留，否则省略。证据改为姓名（有姓名则理由必须包含）以及完整的技能、行业、资源或合作条件，去掉 4 字滑窗。拒绝理由中的「未签到」「未披露」「反向需求」。一条不合格时丢掉该条或整批，要定一条并写成测试；现在是整批失败。

### 6. 中 — 过期精排不会取消，并发槽仍被占用

文件：`src/core/progressive.js` 9–20 行；`src/core/llm-client.js` 41–47、73 行；`server/llm.js` 17–18 行。

`revision` / `dispose` 只会让过期的 `settle` 返回 false。`AbortController` 封在 `post` 里面，`create()` 不接收外部 `signal`，也没有取消方法。服务端并发默认 2，槽在请求结束或超时（默认 60 秒）前不会释放。

影响：连续改意图时，旧的上游调用继续占槽。新的调用拿到 `LLM_BUSY` 后，再被问题 2 收成笼统的本地失败。用户看到的是新一次「精排未完成」，旧请求仍在跑。材料没有防抖调用方，`debounceMs: 120` 是否接上无法核实。

最小修复：`post` / `rerank` 接受 `AbortSignal`，新一轮 `begin` 时 abort 上一轮。服务端保持现在的快速 `LLM_BUSY` 即可。

### 7. 低 — 上游失败状态和联系方式脱敏不完整

文件：`server/upstream.js` 23–44 行；`src/core/llm-schema.js` 16–20 行。

只对 `envelope.status === 'incomplete'` 判失败。状态为 `failed` 或 `cancelled` 时，如果 body 里仍有可解析的 `output_text`，会按成功进入 schema。常见失败体没有这段文本，会落到 `LLM_INVALID_JSON`。非 2xx 一律记 `LLM_UPSTREAM_HTTP`，日志没有 HTTP 状态码，401、429、500 分不开。这是在不记录上游原文的前提下可以补上的数字。

`text()` 只处理邮箱、`http(s)`/`www` 链接，以及「数字加分隔符、长度足够」的号码。微信号、QQ 号会随公开简介进入上游。

最小修复：出现 `status` 且不是 `completed` 时，用单独具名错误拒绝。日志增加 `httpStatus` 数字，不写 `error.message`。联系方式若要继续脱敏，补上微信/QQ 的明确规则并加测试；不要把整段简介删掉。

## 建议的验证步骤

下面前半是源码已经能确定的失败条件，后半是还没被材料证明的风险。我没有执行其中任何一条。

源码已经对上的失败条件：

1. 意图：`file://` 或让 `/api/llm/intent` 返回 502，断言响应里有 `engine: 'local'`。按现在的 `llm-client.js` 69–71 行，返回值没有 `engine`。现有测试 98 行仍会通过。
2. 客户端超时：`fetch` 挂起直到本地 deadline，断言错误码是 `LLM_TIMEOUT`。现在会变成 `LLM_FAILED`（43–47 行和 66 行）。服务端返回 429 时，断言客户端保留 `LLM_BUSY`。现在会变成 `LLM_UNAVAILABLE`。
3. 用两块 Buffer 把一个汉字拆开再 POST `/api/llm/rerank`，断言现在会 `INVALID_JSON`，拼成 Buffer 之后应能进到 schema 或上游错误，而不是解析失败。
4. 起两个不设 `PORT` 的 `node server/index.js`，第二个应打印具名端口错误并退出。现在是未处理的 `EADDRINUSE`。
5. 理由只引用「联合创始人」、不引用技能/行业，断言当前整批 `UNGROUNDED_REASON`。另一条理由同时包含「仅登记未签到」和该候选人技能全文，断言当前会通过。这是校验缺口，不是评测原文。
6. 并发设为 1，发起一次长请求后立刻 `dispose` 再发下一次，断言第二次在第一次结束前就会 `LLM_BUSY`。这是取消没有接到传输层的结果。

材料记载、但我没有复跑，也不能当成通过：`node --test tests` 57/57，check_lines，`docs/match-eval.md` 的 13/13 和 47.17s → 28.08s。现有超时测试使用 `() => new Promise(() => {})`（`tests/llm.test.js` 67、91 行），mock 不按 abort 拒绝，也不断言意图引擎、客户端错误码、分块 UTF-8 和端口占用。

尚未证明、需要补材料后再审：

- 本地打分是否还有第 1 轮的分数挤在一起、理由雷同、职位条件不按职位计算。提示词第 5 行只约束大模型，不能证明本地引擎已改。
- 页面是否用 `phase` 显示 `src/config/llm.js` 的 `labels`，以及 `debounceMs` 是否真的包住 `rerank`。
- 评测报告里的内部措辞是否就是那次第 13 个画像的原文。
- `visibleFields` 由请求方声明。服务端没有人物主数据，只能执行「声明过的白名单字段」。这不能单独证明与本场隐私设置一致；`engine.project` 不在材料里。
