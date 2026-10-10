# 审查 brief — Bonjour AI 网页端 Demo（第 1 轮）

## 目标
纯前端离线 Demo（双击 index.html，file:// 运行，普通 script 挂 window.BJ）。线下活动社交匹配：分层名片（基础档案 / 名片版本 visibleFields / 本场意图），对本场参会者计算匹配分并输出 Top5 + 推荐理由。

## 验收条件
1. 推荐引擎 `src/core/matcher.js`：Score = 100 × Σ w·f × MutualBoost，因子 needAB/needBA/complement/common/reach/quality/fresh，权重来自 `src/config/matching.js`；MMR 多样性重排。
2. 隐私：对方未在本场所选版本 visibleFields 中公开的字段，绝不能参与打分，也不能出现在理由文本中。
3. 分数应有区分度，能在 Top5 中体现差异（不应大量饱和在 100）。
4. 配置化：文案/权重/模板不在页面硬编码；文件 ≤500 行。
5. UI 正确使用 store 状态，localStorage 读写健壮；渲染用户输入时需要转义，防止 XSS。

## 本块范围
matcher、service、store、配置（matching / reasons / synonyms）、数据（people / jobs）、match 与 jobs 页面、测试。

## 已执行验证
- `node --test tests`：15/15 通过。
- check_lines：51 个文件通过，最大 373 行。
- Claude 在 1440 宽度截图人工检查发现：Top5 中 3 人匹配分为 100，因子条多项为 100；推荐理由句式高度重复；职位列表匹配度全部为 88%、标签与福利雷同。请独立核实原因，并寻找其他问题。
