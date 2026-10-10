结论：**CHANGES_REQUIRED**

所提供代码里，推荐引擎按约定公式做了真实计算，隐私投影也挡住了未公开字段。但 Top5 分数会被加成后的封顶压成 100，互配理由会收成同一句，职位匹配度由两套重复要求算出来。这三项都对得上本轮简报里的人工检查，属于验收失败。

## 审查范围与缺失材料

审阅了 brief、功能树，以及 `matcher.js`、`service.js`、`store.js`、`matching.js`、`reasons.js`、`synonyms.js`、`people.js`、`jobs.js`、`match.js`、`jobs.js`（页面）、`components.js`、`tests/matcher.test.js`、`tests/data.test.js`、`tests/index.js`。未改文件，也未运行测试。简报中的「15/15 通过」和「51 个文件、最大 373 行」只当作材料记载，不当作本审查的复现结果。

本次给出的源码都低于 500 行（最大 `matcher.js` 334 行），没有用压行规避上限。功能树覆盖了本块文件和公开接口。页面文案走 `config.copy`，权重和理由模板走配置文件。`matcher.js` 无 DOM、由调用方注入配置；页面通过 `ctx` 使用引擎，没有跨层深导入。

下列材料未提供，相关验收不能算通过，也不当成失败：

- `src/data/profile.js`、`src/config/app.js`、`src/config/copy.js`、`src/config/fields.js`：默认人物意图、`matchingMs`、`event.count`、职位筛选项文案无法逐字核对。
- `src/ui/person.js` 及报名、名片、发现、搜索、壳层：详情名片是否只渲染 `project()`、全站 XSS、存储失败提示是否读对标志，都无法核实。`match.js` 列表用的是 `row.public.profile`。
- `docs/browser-check.json`、截图、`scripts/browser_check.py` 的输出：简报里的 1440 宽人工检查当作现象记录；本审查没有看图。

## 问题列表

### 1. 高 — Top5 分数被封顶，强匹配无法分开

文件：`src/config/matching.js` 第 7–16 行；`src/core/matcher.js` 第 113–135、166–179、238–269 行；`src/data/people.js` 第 227–237、238–254、289–291 行。

权重之和是 1，`mutualBoost` 是 0.15。原始分是 `100 × Σ(w·f) × (1 + 0.15 × min(needAB, needBA))`，再 `Math.min(100, Math.round(raw))`。职业名片公开 9 个非空字段，`quality = 9/10 = 0.9`。已签到时 `reach` 先加到 1.1 再被 `bounded` 截成 1，`openToChat` 对大多数人没有作用。`fresh` 默认为 1。于是：

`0.3 + 0.2 + 0.15 + 0.1 + 0.072 + 0.05 = 0.872`，再乘 `1.15` 得 `1.0028`。

双向意图且互补为 1 时，即使 `common = 0`，展示分也是 100。`need` 的角色命中是 0/1，`complement` 只有 0、0.5、1。后 22 人用 `5 + ((i - 18) % 13)` 复用前 13 个种子的职位、技能和意图，因子向量会相同。MMR 只能换人，不能把已经相同的 100 拆开。因子条显示 `factor * 100`，二元因子会显示为 100。

可复现影响：Top5 里多个强匹配并列 100，验收条件 3 失败。简报中的「3 人为 100、因子条多项为 100」与该算式一致。具体是哪三个人，还依赖未提供的默认「我」的意图。

最小修复：保留 `Σ w·f × MutualBoost` 的结构，但让理论上限落在 100 以内并留出余量（权重和约 ≤ 0.87，或把加成放进归一化，而不是乘完再截断）。`checked_in` 不要先占满 1。角色/互补改为覆盖比例。演示人物不要克隆同一套意图。补一条测试：默认配置下 Top5 的 `score` 至少有 3 个不同值，且都不因截断贴在 100。

### 2. 高 — 互配理由不包含候选人信息，句式会完全一样

文件：`src/core/matcher.js` 第 181–213 行；`src/config/reasons.js` 第 7–10 行。

`mutual` 模板只有 `{role}` 和 `{myRole}`。`role` 来自发起人的寻找角色，`myRole` 来自发起人自己的公开档案。候选人的行业、技能、可提供项都不进入这句。`needAB` 与 `needBA` 都过 `mutualThreshold` 且命中同一角色时，所有人的 `reason` 是同一字符串。`topic` 只出现在次级模板里，而 Top 结果会优先走 `mutual`。`common` 分支的阈值 `0.15` 写死在引擎里，不在配置中。

可复现影响：推荐理由看起来像固定文案。计算确实执行了，输出却不随候选人变化。简报里的「句式高度重复」由此造成。

最小修复：互配模板至少写入对方公开投影里的行业、技能或 offer。为两个公开档案不同的互配候选人加断言，要求 `reason` 不相同。

### 3. 高 — 职位匹配度由两套要求交替产生，会出现全员 88%

文件：`src/data/jobs.js` 第 55–64 行；`src/core/service.js` 第 58–77 行；`src/ui/pages/jobs.js` 第 107–110、22 行。

16 个职位的 `requirements` 只有偶数、奇数两套，和职位名称无关。福利四项里三项固定，只有「期权激励 / 带薪年假」交替。列表标签是经验、学历和 `requirements.slice(0, 2)`，同样只有两种外形。

`jobFit` 用全量 `me.profile` 的技能/项目/经历/行业做字面匹配，词典却只传入 `synonyms.industries`。分数是 `round(40 + matched / 5 * 60)`，只可能是 40、52、64、76、88、100。简报记录全部为 88%，对应两套模板都是 4/5 命中。匹配度排序在全体同分时不会改变顺序。

可复现影响：嵌入式、设计、投资、品牌等职位显示同一匹配度，要求标签和福利也几乎一样。功能树所称「真实要求匹配」与数据生成方式不符。我没有打开页面；88% 这一现象来自简报，档位公式和两套模板能解释它。

最小修复：按职位写要求，并参与 `roles` / `offers` 匹配。去掉 40 分保底，或改成 `matched / total`。空要求时不要除以 0。加测试断言职位分数的极差大于一个档位，且不同标题的要求数组不相同。

### 4. 中 — 打招呼、标记见过后，当前 Top5 不重算

文件：`src/ui/pages/match.js` 第 61、170–176 行；`src/core/matcher.js` 第 249–253 行。

引擎在 `met` 或 `greeted` 包含对方 id 时把 `fresh` 设为 0.15。键盘 `H` / `M` 调用 `ctx.person.act` 之后只执行 `updateSelection()`。详情区 `person.bind` 的刷新回调也是 `updateSelection`。筛选和换批才会 `recompute()`。

可复现影响：刚打过招呼或标过见面的人，分数和 fresh 条仍是旧值，直到下一次筛选、换批或整页重进。

最小修复：这两条操作成功后对当前活动重新 `service.rank`，再渲染列表和详情。

### 5. 中 — 打分意图和理由意图不是同一个来源

文件：`src/core/matcher.js` 第 185–188 行与第 218–234 行。

`score` 使用 `options.queryIntent`，否则用 `a.session.intent`。`reason` 始终读 `a.session.intent`，并且再次 `project`。搜索词和本场意图不一致时，分数按查询计算，句子仍按本场意图填 `{role}`。

可复现影响：列表理由可以描述一次并没有参与打分的寻找关系。本次未提供 `search.js`，搜索页是否传入 `queryIntent` 未知；引擎接口本身已经分叉。

最小修复：`reason` 接收 `score` 已经算好的 `ownIntent`，不要再读另一份 session。

### 6. 中 — 「同场 / 二度」判断与职位无关

文件：`src/ui/pages/jobs.js` 第 40–43 行；`src/data/people.js` 第 279–282 行；`src/core/store.js` 第 8–10 行。

条件是：用户 `participations` 里任一活动 id，对方也有 `sessions[eventId]`。职位对象没有活动 id。初始状态只有 `defaultEvent`。人物生成时，索引为 0 的活动全员都有 session。功能树把默认报名放在 `defaultEvent` 上。若该 id 就是这场，每个内推人都会走 `c.sameEvent`，`c.secondDegree` 到不了。`app.js` / `events.js` 未提供，id 是否同一字符串还差最后一环；谓词写错这一点是确定的。

最小修复：没有可定义的「这场」时不要显示同场。不要把「参加过用户报名的任意活动」标成同场。

### 7. 中 — 职位匹配用全量档案，投递快照用名片投影

文件：`src/core/service.js` 第 58–67 行；`src/ui/pages/jobs.js` 第 64–73 行。

匹配度读取 `store.get().me.profile`，包含未出现在名片版本里的项目和经历。投递时用 `career` 版本做 `engine.project`，只保存公开字段。

可复现影响：列表上的「已满足」可以来自求职版并未公开的字段，投出去的快照里却没有这些字段。对方隐私规则没有被这条路径破坏，这是用户自己的档案；误导的是匹配度和投递内容不一致。

最小修复：`jobFit` 与投递使用同一版本投影。

### 8. 中 — 测试没有覆盖已经失败的验收项

文件：`tests/index.js` 第 1–3 行；`tests/matcher.test.js` 第 57–68、137–159 行。

材料记载 `node --test tests` 为 15/15。用例覆盖了加成、隐藏字段、缺失版本、MMR、权重切换、同义词和筛选。互配用例只断言 `boost === 1.15` 且分数高于零加成，没有断言分数小于 100，也没有断言 Top5 彼此不同。没有 `service`、`store`、`jobFit`、页面转义或「招呼后分数下降」的测试。`tests/data.test.js` 只检查数量和外键。

可复现影响：现有通过结果与验收 3、职位区分度、store/XSS 不对应。

最小修复：把问题 1–4 的断言加进 `node --test tests` 能加载的文件。

### 9. 低 — `recovered` 在读取失败时为 true，异常被丢掉

文件：`src/core/store.js` 第 19–47、71 行。

JSON 损坏或 schema 不合格时 `failed = true`，返回值却是 `recovered: failed`。`catch` 使用空绑定，没有把错误放进 `bj:storage-error`。配额失败路径会派发事件，解析失败不会。

可复现影响：调用方若按名字把 `recovered` 当成「已恢复旧数据」，会把「已丢弃损坏数据、正在使用初始状态」显示反。`app.js` 是否读取该字段，材料中没有。

最小修复：改成 `loadFailed`（或只在成功采用存档时为 true），并把异常对象放到事件 `detail`。

### 10. 低 — `rank` 结果挂着完整人物

文件：`src/core/matcher.js` 第 264–274 行。

返回值含 `person: b`（完整 `profile`、联系方式、未公开意图）和 `public` 投影。理由字符串本身不读取未公开字段；现有隐私测试与 `project()` 的 fail-closed 是对齐的。`match.js` 列表使用 `row.public.profile`。详情把 `row.person` 交给 `ctx.person`，而 `person.js` 不在材料里。

可复现影响：任一消费者直接渲染 `row.person.profile` 就会露出未公开字段。当前不能证实详情已经泄漏。

最小修复：核对 `person.js` 只展示 `project()` 的结果；引擎结果里把完整档案标成内部输入，避免页面另走一份未投影数据。

未发现的问题：加载过场会先在 `requestAnimationFrame` 里同步 `recompute()`，再用 `config.app.matchingMs` 补足停留时间（`match.js` 第 181–198 行）。停留是固定延时，分数不是写死的。所提供页面把动态文本送进 `ui.e`（`components.js` 第 3–14 行）。未发现为凑行数而压行，也未发现与本块无关的大段抽象。

## 建议的验证步骤

下面的失败是源码能算出来的，不是猜测：

1. 用职业版、已签到、双向需求均为 1、互补为 1、`qualityFields = 10` 且公开字段有 9 个非空值，调用 `score`。期望展示分为 100，且 `common` 从 0 提到 0.3 后仍是 100。
2. 构造两个这样的候选人，行业和技能不同，比较 `reason`。期望在当前模板下两句相同。
3. 对 `data/jobs` 的 16 条调用 `jobFit`（需默认 `me`）。期望要求数组只有两种，分数只有 `40 + k/5*60` 这些档。简报中的全员 88% 应表现为每条 `matched === 4`。
4. 打开匹配页，对第一名按 `H` 或 `M`，不改筛选。期望 fresh 条和总分仍是操作前的值。

推断、尚未在此审查中执行的部分：

- 默认用户「林知夏」的意图会使哪 3 人顶到 100，需要 `profile.js` 才能点名。机制不必等这份文件。
- 内推徽章是否永远是「同场」，需要 `defaultEvent` 与 `events[0].id` 一致。谓词过宽已经能确定。
- `person.js`、名片编辑和报名页的 XSS、隐藏字段展示，需要补源码后再看。本次不能给通过。

建议补测后再跑材料里的命令：`node --test tests`，以及行数检查。需要浏览器确认时，在 1440 与窄屏打开 `#/events/<默认活动>/match` 和 `#/jobs`：Top5 分数应不全是 100，互配理由应能看出对方是谁，职位匹配度应随职位变化，打招呼后当前行的 fresh 应下降。我没有运行这些测试，也不能把简报里的 15/15 写成「区分度和职位匹配已通过」。
