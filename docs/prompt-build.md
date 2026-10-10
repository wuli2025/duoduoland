阅读 docs/brief.md 并完整实现其中除"第 2 节配图生成"以外的全部内容（第 0、1、3、4、5、6、7 节）。

说明：
- 配图正由另一个并行任务生成，文件名固定为 brief 中列出的名字（assets/img/avatars/p01.jpg…p18.jpg、me.jpg；events/e01.jpg…e10.jpg；bg/hero1.jpg…hero3.jpg、paper.jpg；logos/c01.svg…c08.svg）。代码里直接引用这些路径，并为 <img> 做优雅降级：加载失败时显示浅灰底 + 姓名首字母（头像）或浅灰底（封面），不能出现裂图。最终路径如有 .png 版本，统一在 src/config/assets.js 里配置扩展名/路径，方便切换。
- 不要修改 assets/img/ 下的任何文件，也不要写 docs/assets-log.md。
- 先读取两个参考规划 HTML 理解功能，然后按 brief 的 Bonjour 风格 + 活动行式首页 + BOSS 直聘式职位列表实现。严格遵守：无 emoji、无 AI 味图标（全部自绘线性 SVG）、无紫粉渐变霓虹；推荐列表姓名后不显示名片版本标签。
- 文件 ≤500 行、配置化、模块分层、matcher UMD + node 测试、docs/feature-tree.md。
- 完成后实际在浏览器中打开 index.html 逐页检查并修复视觉问题，运行 `node --test tests` 与 `py -3 "C:\Users\mi\Desktop\_skill_extract\项目skill\scripts\check_lines.py" .`，把结果写在最后的回复里。
- 最终回复：完成了什么、文件结构、测试与行数结果、任何未完成或降级的地方（如实说明）。
