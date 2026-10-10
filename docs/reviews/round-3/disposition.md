# Grok第3轮复审处置 · 第5轮

日期：2026-10-08。依据：[review.md](review.md)。本表区分源码中确认的问题与材料缺失引起的推断；复测使用实际文件和当前实现，不沿用旧轮次数字。

命令与产物：

- T：`node --test tests` → [tests-round5.txt](../../tests-round5.txt)。
- E：`node scripts/eval-match.js` → [match-eval.md](../../match-eval.md)、`docs/evals/round-5/`；真实接口，保留10画像及3项技术切换原阈值。
- L：`py -3 "C:\Users\mi\Desktop\_skill_extract\项目skill\scripts\check_lines.py" .` → [lines-round5.json](../../lines-round5.json)。

| 问题 | 严重度 | 处置 | 修改 | 复测命令与结果 |
| --- | --- | --- | --- | --- |
| 1：兴趣、简介、经历也能单独通过grounded | 中 | 采纳 | grounded仅允许完整行业/技能/offer/合作条件，姓名仍须出现；本地回退选材同步移除兴趣；没有任何允许证据时返回NO_SAFE_REASON，绝不凭空补字段 | T：兴趣/简介/经历单独命中均拒绝；仅兴趣的模型理由触发REASON_EVIDENCE_FALLBACK并被完整技能理由替换；只含技能前四字拒绝。E：新增严格证据检查并逐项统计回退数量 |
| 2：微信是、QQ是等形式未脱敏 | 低 | 采纳 | 联系方式标记后允许号、是、为、空白与冒号/等号；保留其他简介正文 | T：微信是/为/号/号是/号为、QQ是/号是、vx为/是均脱敏；“做RAG知识库”等正文不变；实际上游body中的示例账号也被删除 |
| 3：模型称呼与界面不一致 | 低 | 采纳 | 提示词明确用“你”、不用“您”；reason-policy兜底句和破冰句使用“你”；服务端共用schema对原始输出及回退后的两种文本都替换残留“您” | T：真实服务模块的假上游返回“您”，最终reason/icebreaker只有“你”；回退路径也覆盖；扫描src/ui与src/config没有遗留界面“您”文案。E：新增称呼检查 |
| 4：前置schema错误没有日志 | 低 | 采纳 | 新error-log统一记录；rerank/intent最外层包住校验、缓存、未配置、并发和上游错误；HTTP所有错误响应与连接异常也使用同一出口；同请求跨层去重 | T：INVALID_CANDIDATES/INVALID_TEXT/LLM_NOT_CONFIGURED/LLM_BUSY/取消均有且仅有一条关联错误；HTTP schema错误、非法JSON、类型错误、404均关联响应请求号；日志不含测试Key/提示词/错误原文 |
| 推断：中途断开可能记成LLM_TIMEOUT | 待验证 | 用测试核实并消除对竞态的依赖 | 超时与主动取消分别把具名原因传给AbortController；upstream根据signal.reason区分，默认取消为LLM_ABORTED | T：使用真实HTTP连接和真实服务链，等待上游fetch开始后中途断开；日志唯一错误为LLM_ABORTED，未出现LLM_TIMEOUT；原超时测试仍记录LLM_TIMEOUT |
| 推断：状态标记可能仍传给模型 | 待验证 | 有证据驳回当前传输风险，补实际body测试 | projection保留状态供本地评分/缓存；prompt-input在最终上游前删除标记，延续第4轮实现 | T：候选输入明确含checked_in与openToChat:false；捕获实际fetch的Responses body并解析input JSON，不含status/openToChat/publicIntent/checked_in/registered，公开专业信息仍保留 |
| 推断：配置模块stringify遇函数/循环 | 待验证 | 原模块为纯数据；仍采纳稳健化修改 | 缓存键改用cache-versions的三个显式字符串与policy.version；不序列化整个匹配、同义词、理由或策略导出；规则变更需提升对应版本 | T：四个配置导出上临时加入函数及自引用循环，精排仍成功且第二次命中缓存；测试结束还原；原模型/意图/状态/动作失效测试继续通过 |
| 推断：listen拒绝原因可能不打印 | 待验证 | 原listen已打印具名错误；补强底层原因与统一字段 | listen错误也走error-log，记录安全causeCode如EACCES/EADDRINUSE；CLI兜底不吞掉未记录错误，已记录错误不重复打印 | T：模拟EACCES，打印LISTEN_FAILED及causeCode，包含完整关联字段且无原始message；原实际占用顺延、范围耗尽与实际URL测试继续通过 |

统一错误结构：`correlationId / operation / status:error / code / durationMs`；仅在适用时附数字`httpStatus`或安全枚举`causeCode`。缺少安全错误码时使用REQUEST_FAILED，不把任意error.message拼入日志。

证据边界：兴趣若同时作为对方本场公开offer出现，可以引用该完整offer；这并非允许兴趣字段独立放行。隐藏意图和隐藏资料仍不能作为证据。本地规则推荐与大模型证据门槛分别保留，不修改测试数据、公开范围或期望阈值来凑通过。

本轮修改集中在校验、提示词、日志和缓存身份；没有新做浏览器截图，之前的布局、端口和渐进体验证据仍按原轮次保留。所有监听测试只启动并关闭自己创建的服务，没有结束已有占用端口进程。

## 收尾结果

- T：81/81通过，0失败、0跳过。
- E：本地13/13、真实大模型13/13（均100%）；严格证据与称呼检查13/13，技术切换3/3，隐私及分数降序检查通过。
- 13次真实评测共130位次候选，理由回退0条，未观察到收紧证据后大面积回退。人工构造的仅兴趣/违规措辞场景有独立回归测试，确认回退分支确实可触发。
- L：167个文件通过，0违规、0读取错误，最大381行。
- 功能树与README已同步；旧评估归档为match-eval-round4.md，新证据位于evals/round-5/。
- 未完成项：无。真实模型结果是本次运行的观察，不承诺后续所有调用均零回退；无允许的公开证据时仍安全降级。
