阅读 docs/brief.md。你本次只负责第 2 节「配图生成」：

1. 使用你的 image_generation 能力生成全部图片：assets/img/avatars/p01.jpg…p18.jpg + me.jpg、assets/img/events/e01.jpg…e10.jpg、assets/img/bg/hero1.jpg…hero3.jpg + paper.jpg。严格遵守 brief 中的内容、尺寸与风格（真实摄影质感、自然光、微暖低饱和、画面无可读文字、无 3D/插画/科技蓝光）。头像要像真人社交头像，人物各不相同。
2. 生成的图片如落在 ~/.codex/generated_images 或其它目录，复制到项目 assets/img 对应目录并按要求命名；如为 PNG，可用 `py -3` + Pillow（若已安装）转换压缩为 JPG（头像 512px，封面约 1200×675，hero 约 1920×640）；Pillow 不可用就保留 PNG，并在日志中写明真实文件名。
3. 手写 8 个简洁的虚构公司 SVG logo：assets/img/logos/c01.svg…c08.svg（字母组合/几何，单色或双色，不要模仿真实品牌）。
4. 写 docs/assets-log.md：列出每个文件、尺寸和使用的提示词，以及失败项（如实记录，不能假装成功）。

不要修改 src/、assets/css/ 或 index.html。
