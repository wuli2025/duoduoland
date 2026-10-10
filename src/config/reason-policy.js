(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BJ.config.reasonPolicy = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  return {
    version: '6.1',
    forbidden: ['未披露', '未签到', '仅登记', '不开放', '暂无证据', '反向需求',
      '未公开', '未提供', '数据缺失', '没有披露', '缺少信息', '签到', '开放聊天',
      '公开意图', '登记状态', '状态未知', '资料不足'],
    fallback: '{name}擅长{topic}，你可以从这个方向聊起。',
    icebreaker: '你最近在{topic}方向有哪些尝试？',
    reasonLimit: 40,
    questionLimit: 20,
    templates: ['{name}擅长{topic}，你可以从这个方向聊起。',
      '{name}的{topic}值得与你交流。', '{name}：{topic}，你想聊聊吗？',
      '{name}：{topic}。'],
    questionTemplates: ['你最近在{topic}方向有哪些尝试？', '你如何实践{topic}？', '{topic}，你怎么看？', '{topic}？'],
    genericQuestion: '你最近最想交流哪个项目？',
  };
});
