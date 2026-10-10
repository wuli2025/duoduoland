阅读 docs/brief.md 第 2 节和 docs/assets-log.md（上次因没有 image_gen 工具只生成了占位 JPG，assets-log 里有每张图的待用提示词）。

本次会话已登录 ChatGPT，请使用**内置 image_gen 工具**（不是 CLI 脚本）生成真实摄影配图，并替换占位图：
- assets/img/avatars/p01.jpg…p18.jpg、me.jpg（me = 女性 AI 产品经理"林知夏"，约 30 岁，东亚面孔，自然光半身照）
- assets/img/events/e01.jpg…e10.jpg
- assets/img/bg/hero1.jpg…hero3.jpg、paper.jpg

要求：真实摄影质感、自然光、微暖低饱和、统一调色；画面中不要出现可读文字或 logo；不要 3D/插画/科技蓝光/霓虹。头像人物各不相同（男女均衡、东亚面孔为主），像真人社交头像。
生成后从 $CODEX_HOME/generated_images/... 找到输出，复制到上述路径（覆盖占位图，文件名不变）。如为 PNG，用 `py -3` + Pillow 转 JPG（头像 512×512 居中裁切，封面 1200×675，hero 1920×640，paper 1600×1000，质量 85）；没有 Pillow 就先 `py -3 -m pip install pillow`。
完成后更新 docs/assets-log.md：每个文件标注"已生成（真实）"或"失败（原因）"，并写上实际使用的提示词。如实记录，不要把占位图当成生成成功。
不要修改 src/、assets/css/、index.html、logos/。
