(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BJ.config.llm = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  return {
    appVersion: '10.0.0',
    enabled: true,
    endpoint: '/api/llm',
    timeout: 62000,
    candidateCount: 10,
    debounceMs: 120,
    transitionMs: 240,
    clockRefreshMs: 250,
    process: {
      title: '正在为你匹配',
      reading: '读取本场 {n} 位参会者的公开名片',
      recalled: '初步筛出 {k} 位候选',
      comparing: '正在比较这些人',
      connecting: '正在连接推荐服务…',
      pending: '{model} 正在逐一评估你们是否值得见面…',
      unknownModel: '推荐服务',
      elapsed: '已等待 {seconds} 秒',
      done: '由 {model} 精排 · 用时 {seconds} 秒 · {time}',
      cached: '使用 {minutes} 分钟前的大模型结果',
      cachedDetail: '由 {model} 精排 · 原计算用时 {seconds} 秒 · {time}',
      failed: '推荐服务暂未响应，已改用本地规则',
      retry: '重试',
      recalculate: '重新计算',
      empty: '本场暂时没有符合条件的候选人',
    },
    weights: { llm: 0.6, local: 0.4 },
    labels: {
      llm: '已由大模型精排',
      local: '本地规则计算（未连接推荐服务）',
      pending: '本地初排 · 大模型精排中，可继续操作',
      failed: '本地规则计算（推荐服务未响应）',
    },
    intentLabels: { llm: '意图已由大模型解析', local: '意图由本地规则解析' },
    versionIcons: { tech: 'code', social: 'coffee', founder: 'users', career: 'briefcase', dating: 'leaf' },
  };
});
