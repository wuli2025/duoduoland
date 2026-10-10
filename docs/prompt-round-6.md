# 第 6 轮（收尾）：最终复审修复
阅读 docs/reviews/final-a/review.md 与 docs/reviews/final-b/review.md，逐条处置写入 docs/reviews/final/disposition.md。保持既有约束；不要打印 .env.local 的 Key；不要结束占用端口的其他进程。
final-a：
1. 回退句按字数预算选证据（40 − 固定字数 − 姓名字数），放不下换短模板或只让该候选人回退；破冰句同预算生成，截断后仍是完整问句。回归：10 字姓名、16 字技能、17+ 字唯一技能、9–16 字话题。
2. 回退句可用职称/城市等可见字段区分；仍重复或无法生成时只丢该条（记录 candidateId），不能让 DUPLICATE_REASON 让整批失败。回归：两名无姓名、同一技能。
final-b：
3. matcher 第 115–120 行"全职 CTO/技术合伙人"规则移入配置，命中后与已解析 cooperation 合并，识别否定句；测试。
4. ai-people 的 intent 增加 employment；测试反向就业因子生效。
5. 休闲版 bio 按每人兴趣各自撰写。
6. 到场状态/openToChat 改为按 id 或行内字段标记；测试锁定。
7. match 页错误：AbortError 映射为 LLM_ABORTED，其余保留 code 并写诊断日志（不含敏感内容）。
收尾：node --test tests 全通过；check_lines 通过；重跑 node scripts/eval-match.js 更新 docs/match-eval.md（含回退条数）；更新 feature-tree。最终回复：处置摘要、测试数、行数、评测通过率、未完成项（如实）。
