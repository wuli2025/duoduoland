(function (root, factory) {
  if (typeof module !== "undefined" && module.exports)
    module.exports = factory();
  else root.BJ.config.reasons = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  return {
    mutual: [
      "{name}公开了{topic}经验，也希望认识{myRole}。",
      "可以找{name}聊{topic}，TA 也希望认识{myRole}。",
      "{name}关注{topic}；你找{role}，TA 也希望认识{myRole}。",
    ],
    need: ["{name}的{topic}经验值得聊聊，符合你找{role}的方向。", "你在找{role}，{name}公开了{topic}这一专长。"],
    common: ["{name}公开的{topic}是一个交流起点。", "从{name}的{topic}聊起，看看彼此的实践。"],
    fallback: ["{name}分享了{topic}，可以从这里认识彼此。", "不妨问问{name}最近在{topic}上的尝试。"],
    icebreaker: "最近在{topic}方向，有什么让你印象深刻的尝试？",
    icebreakerFallback: "最近在做什么有意思的事？",
    person: "同行",
    topic: "共同的方向",
  };
});
