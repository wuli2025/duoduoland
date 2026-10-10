(function (BJ) {
  BJ.config.fields = [
    { key: "name", label: "姓名", icon: "user" },
    { key: "avatar", label: "头像", icon: "image" },
    { key: "title", label: "职位", icon: "briefcase" },
    { key: "company", label: "公司 / 组织", icon: "building" },
    { key: "industry", label: "行业方向", icon: "compass" },
    { key: "city", label: "所在城市", icon: "pin" },
    { key: "skills", label: "技能标签", icon: "code", array: true },
    { key: "experience", label: "工作经历", icon: "briefcase" },
    { key: "projects", label: "项目作品", icon: "box" },
    { key: "education", label: "教育背景", icon: "book" },
    { key: "interests", label: "兴趣爱好", icon: "coffee", array: true },
    { key: "goals", label: "长期目标", icon: "flag" },
    { key: "bio", label: "一句话简介", icon: "pen" },
    { key: "contact", label: "联系方式", icon: "mail" },
    { key: "website", label: "个人网站", icon: "link" },
    { key: 'cooperation', label: '合作方式', icon: 'users', array: true },
    { key: 'markets', label: '业务偏好', icon: 'building', array: true },
    { key: 'availability', label: '投入时间', icon: 'clock', array: true },
    { key: 'compensation', label: '报酬偏好', icon: 'briefcase', array: true },
    { key: 'employment', label: '当前状态', icon: 'user', array: true },
    { key: 'gender', label: '性别', icon: 'user', dating: true, options: ['男', '女', '不公开'] },
    { key: 'birthYear', label: '出生年份', icon: 'calendar', dating: true },
    { key: 'relationshipStatus', label: '感情状态', icon: 'users', dating: true, options: ['单身', '恋爱中', '已婚', '不公开'] },
    { key: 'datingOpen', label: '愿意认识恋爱对象', icon: 'users', dating: true, options: ['false', 'true'] },
    { key: 'datingPreference', label: '想认识的人', icon: 'compass', dating: true },
    { key: 'datingLifestyle', label: '生活方式', icon: 'coffee', dating: true, array: true },
    { key: 'datingValues', label: '看重的价值观', icon: 'book', dating: true, array: true },
  ];
  BJ.config.templates = [
    ['找对象', '想找个男朋友，年龄相仿，最好也喜欢户外'],
    [
      "找投资",
      "想认识上海做 AI 硬件的早期投资人和供应链专家。我能提供：Agent 产品落地经验。",
    ],
    [
      "找合伙人",
      "想认识 AI 硬件创始人、工程师和独立开发者。我能提供：产品经验和项目。",
    ],
    [
      "找工作机会",
      "想认识上海的招聘者和产品经理，寻找 AI 产品机会。我能提供：Agent 产品经验。",
    ],
    ["招人", "想认识产品经理和工程师。我能提供：岗位和技术场景。"],
    [
      "交朋友",
      "想认识上海的设计师、创始人，一起聊设计、阅读和户外。我能提供：产品经验。",
    ],
  ];
  BJ.config.jobFilters = [
    {
      key: "experience",
      label: "工作经验",
      values: ["1–3 年", "3–5 年", "5–10 年", "10 年以上"],
    },
    { key: "education", label: "学历要求", values: ["本科", "硕士", "不限"] },
    {
      key: "salaryBand",
      label: "薪资范围",
      values: ["20–40K", "40–60K", "60K 以上"],
    },
    {
      key: "size",
      label: "公司规模",
      values: ["20–99 人", "100–499 人", "500–999 人"],
    },
    {
      key: "stage",
      label: "融资阶段",
      values: ["天使轮", "A 轮", "B 轮", "C 轮", "未融资"],
    },
    {
      key: "industry",
      label: "所属行业",
      values: ["人工智能", "智能硬件", "企业服务", "跨境电商", "设计服务"],
    },
  ];
})(window.BJ);
