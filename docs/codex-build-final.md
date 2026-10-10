已完成指定范围，双击 [index.html](/C:/Users/mi/Desktop/BonjourAI-Web/index.html) 即可离线运行。

- **功能**：活动广场、详情与三步报名、Top 5 推荐、发现、16 个职位、名片版本管理、全局搜索、现场大屏。
- **实现**：Bonjour 暖白黑黄风格、自绘 SVG、图片降级、隐私字段过滤、UMD matcher、localStorage 持久化。
- **结构**：`src/config` 配置、`src/data` 数据、`src/core` 核心、`src/ui` 页面组件、`assets/css` 分层样式、`tests` 测试。
- **文档**：[功能树](/C:/Users/mi/Desktop/BonjourAI-Web/docs/feature-tree.md)、[验证记录](/C:/Users/mi/Desktop/BonjourAI-Web/docs/verification.md)。

验证结果：`node --test tests` **15/15 通过**；指定行数检查 **51 个文件全部通过，源码最大 373 行**。实际通过 Chromium 打开本地页面，在 1440px、1024px 完成 24 个页面/状态检查，无运行错误、横向溢出或裂图。

本次未修改 `assets/img/` 或 `docs/assets-log.md`。演示边界按 brief 保留：语音仅 UI，二维码与分享链接为示意，招呼和投递仅本地记录，未接入真实后端。