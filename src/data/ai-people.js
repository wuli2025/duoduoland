// DEMO DATA — 18 individually authored AI founders/engineers; avatars follow round 3 brief.
(function (BJ) {
  // name, title, company, industry, skills, seekRoles, offer,
  // cooperation, markets, availability, compensation, employment, city, bio
  const rows = [
    ['程砚', '大模型应用创始人', '轻舟应用', 'LLM · 企业服务', ['LLM', '产品验证', '客户访谈'], ['技术合伙人'], ['企业客户渠道', '种子轮融资经验', '项目'],
      ['联合创始人', '早期员工'], ['To B'], ['全职'], ['股权', '薪资'], ['已离职'], '上海', '已有三家付费客户，找全职技术伙伴一起做早期AI项目。'],
    ['乔南', 'AI Agent 创始人', '行简智能', 'Agent · 出海', ['Agent', '工具调用', '海外增长'], ['技术合伙人', '工程师'], ['海外客户渠道', '项目', '产品经验'],
      ['联合创始人', '早期员工'], ['To B', 'To C'], ['全职'], ['股权', '薪资'], ['已离职'], '上海', '为跨境小团队开发工作流智能体，寻找技术合伙人和首批工程师。'],
    ['裴川', '推理加速工程师', '独立技术团队', 'LLM · 制造', ['端侧推理', 'vLLM', '量化', 'TensorRT'], ['创始人'], ['技术', '推理服务部署', 'GPU调优'],
      ['联合创始人'], ['To B'], ['全职'], ['股权'], ['已离职'], '上海', '离职后寻找端侧或制造场景的早期AI项目，愿意全职承担CTO职责。'],
    ['许棠', 'RAG 工程师', '问知实验室', 'LLM · 法律', ['RAG 知识库', '检索增强', '向量数据库', '知识图谱'], ['创始人'], ['技术', '法律文档处理', 'RAG评测'],
      ['联合创始人', '早期员工'], ['To B'], ['全职'], ['股权', '薪资'], ['已离职'], '上海', '希望加入法律或企业知识库的早期AI项目，能从零搭建检索系统。'],
    ['罗川', '具身智能创始人', '步石机器人', 'AI 硬件 · 具身智能', ['机器人控制', '具身智能', '供应链'], ['工程师', '投资人'], ['机器人测试场地', '制造客户渠道', '项目'],
      ['联合创始人', '早期员工'], ['To B'], ['全职'], ['股权', '薪资'], ['已离职'], '深圳', '在工厂验证移动操作机器人，寻找控制工程师、场景方与早期投资。'],
    ['孟舒', 'AI 医疗创始人', '听诊智能', 'LLM · 医疗', ['医疗产品', '临床研究', '多模态'], ['技术合伙人', '数据方'], ['脱敏医疗数据', '医院场景', '项目'],
      ['联合创始人', '早期员工', '项目制'], ['To B'], ['全职', '业余'], ['股权', '薪资', '项目费用'], ['已离职'], '上海', '与两家医院共创临床助手，寻找技术与合规数据合作方。'],
    ['陆望', '多模态算法工程师', '自由研发', 'LLM · 内容', ['多模态视频生成', '视觉编码器', '语音合成', 'Diffusion'], ['创始人'], ['技术', '视频模型微调', '多模态评测'],
      ['联合创始人', '早期员工'], ['To B', 'To C'], ['全职'], ['股权', '薪资'], ['已离职'], '上海', '希望与内容创业者一起做视频生成产品，可以全职加入早期团队。'],
    ['周谨', '大模型预训练研究员 / 算法工程师', '知原研究', 'LLM · 教育', ['基座预训练', '分布式训练', '数据配比', '算力规划'], ['创始人'], ['预训练顾问', '算力规划', '研究经验'],
      ['兼职顾问'], ['To B'], ['业余'], ['顾问费用'], ['在职'], '北京', '仍在研究机构任职，每周可投入两晚，只接受教育项目的兼职顾问。'],
    ['韩霁', 'AI 安全评测工程师', '界内评测', 'LLM · 金融', ['AI 安全', '对齐评测', '红队测试', '隐私评估'], ['创始人', '场景方'], ['安全评测集', '合规经验', '对齐评测'],
      ['兼职顾问', '项目制'], ['To B'], ['业余'], ['项目费用'], ['在职'], '杭州', '支持金融AI项目上线前的安全评测，不承担全职CTO职位。'],
    ['秦朗', 'MLOps 工程师', '训流平台', 'LLM · 制造', ['MLOps', '训练平台', 'Kubernetes', 'GPU调度'], ['创始人'], ['技术', '训练平台', '算力集群运维'],
      ['早期员工'], ['To B'], ['全职'], ['薪资'], ['已离职'], '上海', '想加入有制造客户的AI团队，偏好早期员工岗位与稳定薪资。'],
    ['宋苒', 'AI 教育创始人', '伴学智能', 'LLM · 教育', ['学习产品', '推荐与搜索', '教育评测'], ['工程师', '数据方'], ['教育场景', '课程数据', '项目'],
      ['联合创始人', '早期员工', '兼职顾问'], ['To B', 'To C'], ['全职', '业余'], ['股权', '薪资', '顾问费用'], ['已离职'], '北京', '做面向师生的学习助手，寻找算法伙伴与校方数据合作。'],
    ['江尧', 'Agent 工程师 / AI 产品工程师', '工具桥', 'Agent · 企业服务', ['Agent 编排', '工具调用', 'RAG 知识库', 'TypeScript'], ['创始人'], ['技术', 'Agent产品交付', '检索增强'],
      ['联合创始人', '早期员工'], ['To B'], ['全职'], ['股权', '薪资'], ['已离职'], '上海', '专长是RAG与工具调用，想加入有客户场景的早期Agent项目。'],
    ['顾庭', '端侧 AI 工程师', '小端实验室', 'AI 硬件 · LLM', ['端侧推理', '边缘部署', '量化', '机器人控制'], ['创始人'], ['技术', '端侧性能优化', '嵌入式交付'],
      ['联合创始人', '早期员工'], ['To B', 'To C'], ['全职'], ['股权', '薪资'], ['已离职'], '上海', '离职后寻找端侧AI或机器人创业项目，可全职负责部署与控制。'],
    ['唐可', '数据工程师', '数据田', 'LLM · 医疗', ['数据工程', '标注质检', '视频数据', '数据脱敏'], ['创始人', '场景方'], ['数据处理管线', '标注团队', '数据治理'],
      ['项目制'], ['To B'], ['业余'], ['项目费用'], ['在职'], '杭州', '以项目制参与医疗和视频数据治理，暂不考虑加入全职团队。'],
    ['沈律', 'AI 法律创始人', '律知科技', 'LLM · 法律', ['法律产品', 'RAG 知识库', '客户研究'], ['工程师', '技术合伙人'], ['法律语料', '律所客户渠道', '项目'],
      ['联合创始人', '早期员工'], ['To B'], ['全职'], ['股权', '薪资'], ['已离职'], '上海', '已完成律所场景验证，寻找愿意加入早期项目的RAG与Agent工程师。'],
    ['温澜', '推荐算法负责人 / 算法工程师', '知趣算法', 'LLM · 游戏', ['推荐与搜索', '排序模型', '在线实验', '特征工程'], ['创始人'], ['推荐系统顾问', '增长实验', '算法评审'],
      ['兼职顾问'], ['To C'], ['业余'], ['顾问费用'], ['在职'], '深圳', '偏好游戏与内容创业项目，每周末提供算法顾问，不接受全职邀约。'],
    ['贺新', '多模态算法工程师（应届生）', '海城大学', 'LLM · 内容', ['多模态视频生成', '视频理解', 'PyTorch', '模型微调'], ['创始人', '招聘者'], ['技术', '视频生成原型', '论文复现'],
      ['早期员工'], ['To B', 'To C'], ['全职'], ['薪资'], ['应届待入职'], '上海', '毕业作品是视频生成助手，希望全职加入早期内容AI团队。'],
    ['林昭', 'AI 金融创始人', '简衡智能', 'LLM · 金融', ['金融产品', '风险管理', '企业销售'], ['工程师', '技术合伙人', '投资人'], ['金融行业数据', '客户渠道', '融资经验', '项目'],
      ['联合创始人', '早期员工', '项目制'], ['To B'], ['全职', '业余'], ['股权', '薪资', '项目费用'], ['已离职'], '上海', '开发金融研究助手，寻找工程师、安全评测伙伴和AI方向投资。'],
  ];
  const personal = {
    '程砚': { number: 61, detail: [['城市骑行', '独立杂志'], '同济大学 · 软件工程'], casualBio: '周末骑车探访城市里的小书店，也收集独立杂志。' },
    '乔南': { number: 62, detail: [['攀岩', '旅行写作'], '上海外国语大学 · 国际商务'], casualBio: '喜欢攀岩时专注下一步的感觉，旅行回来会写几页见闻。' },
    '裴川': { number: 63, detail: [['公路骑行', '机械键盘'], '电子科技大学 · 计算机体系结构'], casualBio: '公路骑行是固定的周末安排，最近在组一把机械键盘。' },
    '许棠': { number: 64, detail: [['推理小说', '手冲咖啡'], '南京大学 · 信息管理与信息系统'], casualBio: '习惯用一杯手冲咖啡配推理小说，喜欢讨论伏笔如何埋藏。' },
    '罗川': { number: 65, detail: [['越野跑', '航模制作'], '哈尔滨工业大学 · 控制科学与工程'], casualBio: '越野跑让我认识山路，航模制作让我愿意耐心打磨细节。' },
    '孟舒': { number: 66, detail: [['室内乐', '植物观察'], '复旦大学 · 生物医学工程'], casualBio: '常去听室内乐，也会记下散步时遇到的植物名字。' },
    '陆望': { number: 67, detail: [['短片拍摄', '合成器音乐'], '中国传媒大学 · 智能科学与技术'], casualBio: '喜欢拍短片记录朋友的日常，偶尔用合成器给片子配乐。' },
    '周谨': { number: 68, detail: [['古典文学', '围棋'], '北京大学 · 应用数学博士'], casualBio: '闲下来会读古典文学，也喜欢约朋友下一局围棋。' },
    '韩霁': { number: 69, detail: [['桌游设计', '篆刻'], '浙江大学 · 网络空间安全'], casualBio: '喜欢研究桌游的规则设计，篆刻则让我慢下来。' },
    '秦朗': { number: 70, detail: [['露营', '天文摄影'], '华中科技大学 · 分布式系统'], casualBio: '露营时最期待晴朗的夜空，正在练习拍摄银河。' },
    '宋苒': { number: 71, detail: [['童书阅读', '陶艺'], '北京师范大学 · 教育技术学'], casualBio: '童书和陶艺占据了我的周末，喜欢亲手捏出故事里的角色。' },
    '江尧': { number: 72, detail: [['开源社区', '飞盘'], '华东师范大学 · 数据科学'], casualBio: '喜欢参加开源社区聚会，天气好的傍晚会约朋友打飞盘。' },
    '顾庭': { number: 73, detail: [['无线电', '山地骑行'], '西安电子科技大学 · 嵌入式系统'], casualBio: '玩无线电也骑山地车，享受在户外探索路线和信号。' },
    '唐可': { number: 74, detail: [['速写', '烘焙'], '杭州电子科技大学 · 数据工程'], casualBio: '随身带速写本记录街角，烘焙时喜欢尝试新的口味。' },
    '沈律': { number: 75, detail: [['书法', '历史研究'], '中国政法大学 · 法学与法律科技'], casualBio: '练习书法时会读一点历史，喜欢追问文字背后的时代。' },
    '温澜': { number: 76, detail: [['游戏关卡分析', '冲浪'], '中山大学 · 统计学'], casualBio: '既喜欢拆解游戏关卡，也喜欢在海边学着判断下一道浪。' },
    '贺新': { number: 77, detail: [['定格动画', '羽毛球'], '上海大学 · 数字媒体技术'], casualBio: '课余用定格动画讲小故事，羽毛球是和朋友见面的固定理由。' },
    '林昭': { number: 78, detail: [['爵士乐', '帆船'], '上海财经大学 · 金融工程'], casualBio: '听爵士乐时喜欢即兴的变化，出海练帆船时则专注风向。' },
  };
  const capitalEngineers = ['person-63', 'person-68', 'person-73'];
  const participation = {
    'person-68': { status: 'registered' },
    'person-69': { openToChat: false },
  };
  const primaryEvents = ['ai-agent-night', 'demo-day', 'product-stories'];
  const preferenceKeys = ['cooperation', 'markets', 'availability', 'compensation', 'employment'];
  const people = rows.map(r => {
    const person = personal[r[0]];
    const id = 'person-' + person.number;
    const profile = {
      name: r[0], avatar: 'p' + (person.number - 12), title: r[1], company: r[2], industry: r[3],
      skills: r[4], city: r[12], bio: r[13], experience: r[2] + ' · ' + r[1] + '；' + r[13],
      projects: r[4][0] + '验证项目', education: person.detail[1],
      interests: person.detail[0], goals: r[13],
      contact: id + '@example.com', website: id + '.example.com',
    };
    preferenceKeys.forEach((key, n) => profile[key] = r[7 + n]);
    const visible = Object.keys(profile).filter(key => !['contact', 'website', 'education'].includes(key));
    const versions = [
      { id: 'venture', name: 'AI 创业合作版', theme: 'paper', visibleFields: visible, bio: r[13] },
      { id: 'focused', name: '技术交流版', theme: 'sage', visibleFields: visible.filter(k => !['experience', 'projects', 'compensation', 'employment'].includes(k)), bio: r[13] },
      { id: 'casual', name: '休闲版', theme: 'butter', visibleFields: ['name', 'avatar', 'interests', 'bio'], bio: person.casualBio },
    ];
    const founder = r[1].includes('创始人');
    const intent = { seekRoles: r[5], seekIndustries: r[3].split(' · '), offer: r[6], city: '',
      cooperation: r[7], markets: r[8], availability: r[9], compensation: r[10], employment: r[11] };
    const sessions = {};
    const events = [...primaryEvents, ...(founder || capitalEngineers.includes(id) ? ['deeptech-capital'] : [])];
    events.forEach(eventId => {
      const capital = eventId === 'deeptech-capital';
      sessions[eventId] = {
        versionId: eventId === 'product-stories' ? 'focused' : 'venture',
        intent: { ...intent, seekRoles: capital && founder ? ['投资人', '技术合伙人'] : r[5],
          offer: eventId === 'product-stories' ? [r[6][0], r[4][0]] : r[6] },
        publicIntent: true, openToChat: true, status: 'checked_in', ...participation[id],
      };
    });
    return { id, profile, versions, sessions, interested: false, viewed: false };
  });
  BJ.data.people.push(...people);
})(window.BJ);
