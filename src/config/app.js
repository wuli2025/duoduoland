(function (BJ) {
  BJ.config = BJ.config || {};
  BJ.data = BJ.data || {};
  BJ.pages = BJ.pages || {};
  const brand = "多多群岛";
  BJ.config.app = {
    brand,
    title: `${brand} · 让相遇发生`,
    description: `认识有趣的人，遇见值得出门的事。${brand}活动与名片社交。`,
    tagline: "好的人，值得见一面。",
    locale: "zh-CN",
    storageKey: "bonjour-demo-v1",
    defaultCity: "上海",
    defaultEvent: "ai-agent-night",
    cities: ["上海", "北京", "杭州", "深圳", "全部城市"],
    theme: { accent: "#FFD84D", salary: "#FF5A1F", background: "#FAFAF7" },
    cardThemes: [
      { id: "paper", label: "暖白", color: "#fafaf7" },
      { id: "butter", label: "奶油黄", color: "#fff4c7" },
      { id: "sage", label: "鼠尾草", color: "#e8ede5" },
      { id: "stone", label: "石灰", color: "#eeebe5" },
    ],
    nav: [
      { label: "活动", path: "/events" },
      { label: "发现", path: "/discover" },
      { label: "找工作", path: "/jobs" },
      { label: "我的名片", path: "/me" },
    ],
    categories: [
      ["全部", "grid"],
      ["创业", "flag"],
      ["AI", "chip"],
      ["跨境出海", "globe"],
      ["科技", "code"],
      ["投资", "chart"],
      ["产品", "box"],
      ["设计", "pen"],
      ["读书会", "book"],
      ["音乐", "music"],
      ["户外", "mountain"],
    ],
    matchingMs: 950,
    relatedThreshold: 35,
    searchLimit: 5,
    attendeeWallLimit: 24,
    attendeeCardLimit: 4,
    footer: [
      {
        title: "发现可能",
        links: [
          ["活动广场", "/events"],
          ["认识新朋友", "/discover"],
          ["新的工作机会", "/jobs"],
        ],
      },
      {
        title: "关于你",
        links: [
          ["我的名片", "/me"],
          ["本场设置", "/events/ai-agent-night/join"],
          ["现场大屏", "/live/ai-agent-night"],
        ],
      },
      {
        title: `关于 ${brand}`,
        links: [
          ["我们的想法", "about"],
          ["隐私与名片", "privacy"],
          ["使用帮助", "help"],
        ],
      },
    ],
  };
})((window.BJ = window.BJ || {}));
