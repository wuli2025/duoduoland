# 最终复审处置 · 第6轮

审查来源：[final-a](../final-a/review.md)、[final-b](../final-b/review.md)。以下结果在本工作区实际执行，不沿用上一轮的测试数。原有隐私投影、file 入口、window.BJ 和 Bonjour 布局继续保留。

## 问题逐条处置

| 问题 | 严重度 | 采纳或有证据驳回 | 修改 | 复测命令与结果 |
| --- | --- | --- | --- | --- |
| 1 / final-a-1：回退文案预算与40/20字截断冲突 | 中 | 采纳 | `src/config/reason-policy.js` 定义40/20预算、多档理由和问句模板。`server/reason-policy.js` 用40减固定文本与姓名长度选择完整证据，长技能换短模板，绝不截掉证据；破冰句选能容纳完整话题的短问句，仍放不下时使用完整通用问句。本地生成文本也先检查全文长度，不先截断。模型问题保留预算内的完整问句，否则逐条修复。 | `node --test tests/round6.test.js`：通过。覆盖10字姓名、16/17/25字技能、9–16字话题；41字唯一证据无法放入理由时只移除该候选。 |
| 2 / final-a-2：匿名同技能导致整批DUPLICATE_REASON | 中 | 采纳 | 回退允许使用投影内职称、城市区分。已使用理由参与修复；仍重复或无法生成只丢该条，日志为`status:drop`并含`candidateId/code/correlationId`。响应带`dropped` ID，客户端校验结果与丢弃ID恰好覆盖原候选集合后仅融合保留项；全被移除则诚实回到本地。结构错误、非法ID和分值仍拒绝。页面标题跟随实际入选人数。 | 同上：无姓名同技能、可见职称区分、修复后仍重复、部分结果融合、伪造/遗漏ID、全空降级均通过。`py -3 scripts/browser-final.py`：注入2人结果，标题与列表均为2人。 |
| 3 / final-b-1：全职CTO规则硬编码、覆盖已有合作方式、否定误命中 | 中 | 采纳 | 触发规则、目标字段/值、子句分隔与否定词移入`synonyms.js`；`parseIntent`排除否定子句，使用集合合并已有合作值，提供部分仍不进入寻找侧。匹配/词表/理由策略显式版本升到6.1。 | `node --test tests/round6.test.js`：合作方式不被覆盖、不要/不找/无需全职CTO、带转折的正向需求、提供部分不触发、替换配置改变行为均通过。 |
| 4 / final-b-2：AI人物就业状态未进入公开意图 | 中 | 采纳 | 18位人物的本场`intent.employment`使用各自`r[11]`，进入已有反向需求计算；隐藏本场意图时继续不参与。 | 同上：18人各场次与档案一致；固定其他条件，就业冲突后的`needBA`/无就业偏好基线等于配置`conflictingPreference=0.35`；隐藏意图不影响分数。原三组技术切换测试继续通过。 |
| 5 / final-b-3：休闲版简介同质化且与兴趣不符 | 低 | 采纳 | 18份休闲简介独立撰写，分别谈攀岩、室内乐、航模、书法、帆船等本人兴趣；与教育/兴趣一起按人物姓名绑定稳定身份，不靠列表位置对应。 | 同上：18份休闲简介互异，均不同于职业简介；逐人检查与兴趣相符。 |
| 6 / final-b-4：下标决定到场、聊天与资本场成员 | 低 | 采纳 | 周谨`person-68`未签到、韩霁`person-69`不开放聊天按ID配置；资本场工程师为`person-63/68/73`。姓名绑定稳定数字ID，头像、个人背景同样不随行序变化。 | 同上：锁定状态与场次；将整个职业行数组反序后重新加载，逐ID全部档案/版本/场次与原始数据一致。 |
| 7 / final-b-5：页面AbortError误判且无诊断 | 低 | 采纳 | `llm-client.errorCode/diagnostic`统一处理：先认AbortError为LLM_ABORTED，保留安全code（含数字），日志含活动、阶段、固定消息；不输出错误原文、档案、提示词或Key。页面既捕获reject，也记录客户端返回的失败。 | `node --test tests/round6.test.js`与`py -3 scripts/browser-final.py`均通过：浏览器直接抛DOMException和ERR_HTTP2_STREAM_ERROR，记录各自code、活动及pending阶段；failed保留5行，无未处理rejection。 |

## 审查中的验证建议与推断

| 项目 | 处置与证据 |
| --- | --- |
| final-a：直接验证upstream取消分类，而非只依赖LLM层Promise竞态 | 新增直接调用`upstream.request`测试；中途取消假fetch分别携带LLM_ABORTED和LLM_TIMEOUT，实际进入上游catch的signal.reason分支，结果正确。 |
| final-a：全出口日志去重、状态字段清洗、配置循环引用、监听失败原因需重跑 | 全量90项包含原round5的HTTP跨层单条日志、实际请求体无status/openToChat/publicIntent、配置函数/循环引用、EACCES具名原因，以及本轮直接上游取消测试，全部通过。 |
| final-a：17+、40+技能与匿名重复需实际执行 | 本轮回归覆盖17/25字技能成功引用、41字唯一技能单条移除，以及两名无姓名同技能、修复仍重复的隔离。没有降低证据要求来凑通过。 |
| final-a：真实评测及回退数不能沿用声明 | 重跑`node scripts/eval-match.js`，13项质量评测本地与真实LLM均13/13。每场景数据在`docs/evals/round-6/`，报告在`docs/match-eval.md`。 |
| final-b：service.rank可能忽略lambda/limit | 有证据排除：`src/core/service.js`的rank把`...options`传给engine.rank；排除项另行合并，不覆盖lambda/limit。页面明确请求Top10/lambda=1，再MMR选人。 |
| final-b：失败阶段可能误写已精排 | 有证据排除：`progressive.settle`仅engine==='llm'进入llm相位，失败保留本地行并进入failed；本轮浏览器直接reject也确认失败文案。file页面完全无HTTP请求。 |
| 两份审查提及附件缺失 | 非独立代码缺陷。本轮提供完整处置、测试文本、行数JSON、逐场景评测和定向浏览器证据；此前轮次文档保留。 |

## 实际验收

- `node --test tests`：90/90通过，0失败、0跳过；见`docs/tests-round6.txt`。
- `py -3 "C:\Users\mi\Desktop\_skill_extract\项目skill\scripts\check_lines.py" .`：通过；191个受检文件，无超限或读取错误，最大385行（`src/core/matcher.js`）。见`docs/lines-round6.json`。
- `node scripts/eval-match.js`：10画像+3技术切换，本地13/13、真实LLM13/13（均100%）；三组Top3组合不同且各至少2位方向对口，措辞/隐私/严格证据/称呼检查通过。
- 质量评测130次候选：回退3条（2条证据、1条不完整破冰句），移除0条，禁用措辞回退0条。单条移除路径由确定性测试验证，未冒称真实运行触发。
- 额外延迟对照：12人旧长文本提示词40,087ms，10人优化配置25,199ms；缓存均低于1ms（整数记录为0）。旧长话题对照另有10条不完整问句回退，优化组0条，均未移除；与质量评测分开统计。13项质量评测首次平均26,014ms。
- `py -3 scripts/browser-final.py`：通过，实际HTTP地址`http://127.0.0.1:8787`，本轮该端口可用。脚本仅停止自己创建的进程，未终止任何无关占用者；端口顺延继续由Node回归验证。
- 浏览器证据：`docs/browser-final.json`与`docs/screenshots/final/`。本轮错误/部分响应为显式注入，不作为真实LLM截图；真实LLM结果由上面的服务模块评测提供。file降级真实打开验证。
- 已更新功能树与README。第5轮评测归档为`docs/match-eval-round5.md`。

本轮7项必修均完成，无未完成项。否定识别为配置驱动的子句规则；仍保留本地规则引擎的既有演示边界。
