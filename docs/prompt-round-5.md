# 第 5 轮：Grok 第 3 轮复审修复（docs/reviews/round-3/review.md）
逐条处置写入 docs/reviews/round-3/disposition.md。保持全部既有约束；不要打印 .env.local 的 Key；不要结束占用端口的其他进程。
1. （中）llm-schema grounded()：证据只认 行业 / 技能 / offer / 合作条件 的完整值（姓名可额外要求出现）；兴趣、简介、经历不能单独放行。加回归测试（只命中兴趣 → 回退；只含技能前四字 → 拒绝）。确认真实 LLM 输出不会因此大面积回退：重跑 node scripts/eval-match.js 并更新 docs/match-eval.md，记录回退条数。
2. （低）联系方式脱敏：支持"微信是/为/号""QQ是""vx 为"等形式；加断言；不要整段删除简介。
3. （低）称呼统一：界面统一用"你"。在 prompts/rerank.md 规定用"你"、不用"您"；reason-policy 回退句同样用"你"；服务端后处理把残留"您"替换为"你"并加测试。
4. （低）server 统一出口日志：所有错误（含 schema 校验失败、NOT_CONFIGURED、BUSY）都记录 correlationId/operation/status:error/code/durationMs；listen() 失败原因要打印。
5. 核实推断风险：客户端中途断开时日志 code 应为 LLM_ABORTED 而非 LLM_TIMEOUT（加测试）；捕获真实上游 body 确认不含 status/openToChat 的内部可复述形式；缓存键对 config 模块的 stringify 不会因函数/循环引用失败（加测试或改为显式版本号）。
收尾：node --test tests 全通过；check_lines 通过；更新 feature-tree。最终回复：处置摘要、测试数、行数、评测通过率与回退条数、未完成项（如实）。
