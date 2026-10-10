结论：**CHANGES_REQUIRED**

所附匹配器、匹配配置、AI 人物数据和匹配页里，有两处会改变真实排序结果的问题。隐私投影、缺版本失败关闭、MMR 先选集合再按分数排序，与所附测试断言一致。我没有运行测试，材料里的「81/81」不能当作本轮通过。

## 审查范围与缺失材料

本批读过的文件：

| 文件 | 物理行数 |
| --- | --- |
| `src/core/matcher.js` | 381 |
| `src/config/matching.js` | 45 |
| `src/data/ai-people.js` | 98 |
| `src/ui/pages/match.js` | 235 |
| `tests/matcher.test.js` | 254 |
| `tests/data.test.js` | 78 |
| `tests/round4-client.test.js` | 132 |

所附文件都短于 500 行。`matcher.js` 第 38–39 行、`match.js` 第 52 行和第 72–74 行较长，仍是单条语句或模板，不是把超限文件压进 500 行。功能树未附，无法确认它是否覆盖这次修改。

按 brief 列出、但不据此判失败的缺失材料：

- `docs/reviews/round-3/review.md`（要核对的 4 条问题和推断风险不在本批，无法逐条关闭）
- `listen.js`、reason-policy、prompt-input
- `src/config/synonyms.js`、`src/config/reasons.js`、文案配置（测试在引用，正文未附）
- `service.rank` / `service.me` 的实现（页面把 `lambda: 1` 和 `limit` 交给它）
- `src/core/llm-client.js`、`src/core/progressive.js`（仅有测试侧断言）
- `src/data/people.js` 与头像二进制
- `docs/match-eval.md`

本批能核对的行为：缺版本不回退基础档案；1–3 字母别名按词边界匹配；MMR 用多样性决定入选，再按分数和原顺序稳定降序（`matcher.js` 第 323–346 行）；发起方私有意图可参与 `needAB`，对方未公开意图不进入投影。这些与所附测试的写法一致，但是阅读结论，不是执行结果。

## 问题列表

### 1. 中 — 合作方式被硬编码规则覆盖，不走配置

- 位置：`src/core/matcher.js` 第 115–120 行
- 证据：`lex.preferences` 已经按配置写入 `extended` 之后，又执行

```javascript
if (/全职\s*(CTO|技术合伙人)/i.test(seek)) extended.cooperation = ['联合创始人'];
```

赋值是替换，不是合并。`matching.js` 和同义词循环都没有这条规则。`tests/matcher.test.js` 没有覆盖它。

- 影响：查询落在「寻找」半段且匹配该正则时，合作方式被固定成「联合创始人」。词表里已经识别出的「早期员工」等值会被丢掉。没有提供分隔符时，整句都算寻找半段，「我能提供全职CTO」也会触发。否定句「不要全职技术合伙人」同样会写入该合作方式。
- 修复：把触发词和目标值放进 `synonyms` / `matching` 配置；命中后与已解析的 `cooperation` 合并。补一条「已有合作方式不被覆盖」和一条「否定句不命中」的测试。

### 2. 中 — 18 位 AI 人物的就业状态没有进入公开意图

- 位置：`src/data/ai-people.js` 第 64 行、第 74 行、第 82–83 行
- 证据：`preferenceKeys` 含 `employment`，档案写入了 `r[11]`（如「已离职」「在职」「应届待入职」）。`intent` 只拷贝到 `compensation: r[10]`，没有 `employment`。`matcher.js` 第 16 行和第 169–175 行会用意图里的 `employment` 做兼容度乘法；空数组会直接跳过。
- 影响：对方看这些人的档案时，`needAB` 仍能读到就业状态。反过来算 `needBA` 时，这 18 个人都不表达就业偏好。贺新的「应届待入职」、周谨的「在职」不会压低反向分。`product-stories` 使用 `focused` 版本时，可见字段还去掉了 `employment`（第 78 行），正向比较也会变成 `unknownPreference`。所附数据测试只检查人数、版本和头像，锁不住这个字段。
- 修复：`intent` 增加 `employment: r[11]`。加测试：任意 AI 人物在 `ai-agent-night` 的 `session.intent.employment` 与档案一致，且与「全职」意图互评时 `needBA` 使用 `conflictingPreference`。

### 3. 低 — 休闲版简介是同一句静态文案

- 位置：`src/data/ai-people.js` 第 79 行
- 证据：18 人的 `casual.bio` 都是「工作以外喜欢阅读与散步。」兴趣数组各自不同（攀岩、室内乐、航模等）。当前场次只用 `venture` 或 `focused`（第 89 行），默认匹配不会选中休闲版。
- 影响：一旦展示休闲版，兴趣和简介互相矛盾，等于用静态句子代替人物原文。
- 修复：休闲版使用该人自己的兴趣句，或不要把与兴趣冲突的固定句写进 `bio`。

### 4. 低 — 到场状态和开放聊天用数组下标写死

- 位置：`src/data/ai-people.js` 第 85–92 行
- 证据：`[2, 7, 12].includes(i)` 决定是否参加 `deeptech-capital`；`i === 7` 决定 `registered`；`i !== 8` 决定 `openToChat`。插入或调换一行后，周谨、韩霁和资本场场次会错位。所附测试没有锁定这三人的场次状态。
- 影响：现在的行序下，周谨始终未签到、韩霁始终不可聊天；调整数据顺序会静默改变可匹配集合和 `reach`。
- 修复：按 `id` 或行内字段标记，并在 `tests/data.test.js` 里断言这三人的 `status` 和 `openToChat`。

### 5. 低 — 匹配页失败被收成笼统错误码且不留日志

- 位置：`src/ui/pages/match.js` 第 31–39 行
- 证据：`rerank` 抛错时只保留 `/^[A-Z_]+$/` 的 `error.code`，否则写成 `LLM_FAILED`。没有记录 `message` 或 `name`。取消、超时若由客户端正常返回 `{ error: 'LLM_ABORTED' | 'LLM_TIMEOUT' }`，这条路径不会走到；一旦抛出 `AbortError`（通常没有该格式的 `code`），页面会记成 `LLM_FAILED`。
- 影响：现场无法区分取消、网络错误和编程错误。
- 修复：取消信号单独映射为 `LLM_ABORTED`；其余错误保留原始 `code` 并写一条带 `eventId`、阶段和消息的诊断日志。业务文案仍只用白名单错误码。

未把下列情况列成缺陷：空意图返回 `fallbackNeed`（0.18）被测试写成预期；分数曲线会抬高中低分，但是配置行为；`cleanIntent` 复用输入数组，所附调用方没有就地修改，影响未发生。

## 建议的验证步骤

材料已写明、但我没有执行，因此不能声称通过：

- `node --test tests` 81/81
- `check_lines` 167 个文件、最大 381 行
- `docs/match-eval.md` 中 0 处「您」
- 真实 LLM 评测 13/13、理由回退 0/130
- 8787 占用后改听 8788、`/.env.local` 404、路径穿越被拒

建议补跑或补看的检查：

1. 对「全职技术合伙人，也可以早期员工加入」和「不要全职CTO」调用 `parseIntent`，确认 `cooperation` 不再被第 119 行覆盖。
2. 加载 `ai-people.js` 后断言 18 人的 `sessions['ai-agent-night'].intent.employment` 等于档案；用「全职」意图对贺新、周谨打分，确认反向就业因子不是跳过。
3. 抽查休闲版 `bio` 与 `interests` 不再互相矛盾。
4. 在匹配页把偏好滑杆、只看签到、双向、换一批各做一次：本地列表应立即变化；关闭 LLM 或 `file:` 时不应发请求；超时后阶段应为失败并保留本地行，而不是成功。
5. 对照 `round-3/review.md` 的 4 条原文再勾一次。本批只能确认投影、词边界和 MMR 分数序在当前源码里存在。

推断、尚未被所附源码证实的风险：`service.rank` 若忽略 `lambda` 和 `limit`，页面的「先召回再 MMR」不会按 `match.js` 第 19–22 行工作；`progress` 的失败文案若写成已完成，会把本地回退显示成模型成功。这两项需要对应源码才能定论。
