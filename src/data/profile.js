// DEMO DATA — fictional profile; all changes stay in this browser.
(function (BJ) {
  const fields = BJ.config.fields.map((field) => field.key);
  BJ.data.me = {
    id: "me",
    profile: {
      name: "林知夏",
      avatar: "me",
      title: "AI 产品经理",
      company: "知序科技",
      industry: "Agent · AI 硬件",
      city: "上海",
      skills: ["Agent", "产品策略", "多模态", "RAG", "产品增长"],
      experience:
        "2023 至今 · 知序科技 / 产品经理；2020–2023 · 远山数字 / 产品经理",
      projects: "企业知识库 Agent · 从 0 到 1 服务 120 家团队",
      education: "同济大学 · 工业设计",
      interests: ["阅读", "城市徒步", "摄影"],
      goals: "让好技术成为人人用得上的产品",
      bio: "把复杂的技术，变成简单好用的产品。也爱咖啡、散步和没有目的的聊天。",
      contact: "linzhixia@example.com",
      website: "linzhixia.example.com",
    },
    versions: [
      {
        id: "tech",
        name: "科技交流版",
        theme: "paper",
        order: fields.slice(),
        visibleFields: [
          "name",
          "avatar",
          "title",
          "company",
          "skills",
          "industry",
          "bio",
        ],
        bio: "专注 Agent 产品落地，让有趣的想法真正走进日常。",
      },
      {
        id: "social",
        name: "休闲社交版",
        theme: "butter",
        order: fields.slice(),
        visibleFields: ["name", "avatar", "city", "interests", "bio"],
        bio: "一个会为了好咖啡，特意绕路的人。周末一起散步吧。",
      },
      {
        id: "founder",
        name: "创业合伙人版",
        theme: "sage",
        order: fields.slice(),
        visibleFields: [
          "name",
          "avatar",
          "title",
          "company",
          "city",
          "industry",
          "skills",
          "goals",
          "bio",
        ],
        bio: "寻找能一起把 Agent 带到真实世界的伙伴，我可以负责产品从 0 到 1。",
      },
      {
        id: "career",
        name: "求职版",
        theme: "stone",
        order: fields.slice(),
        visibleFields: [
          "name",
          "avatar",
          "title",
          "company",
          "city",
          "industry",
          "skills",
          "experience",
          "projects",
          "education",
          "bio",
        ],
        bio: "6 年产品经验，3 个从 0 到 1 的产品。期待让技术与人的需要更近一些。",
      },
    ],
  };
  BJ.data.defaultParticipation = {
    versionId: "tech",
    intentText: '',
    intent: {
      seekRoles: [], seekIndustries: [], offer: [], city: '',
    },
    publicIntent: true,
    openToChat: true,
    status: "checked_in",
  };
})(window.BJ);
