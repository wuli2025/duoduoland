(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BJ.config.carousel = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  return {
    intervalMs: 5000, transitionMs: 450, swipeThreshold: 45,
    tabs: [{id: 'featured', label: '精选'}, {id: 'week', label: '本周'}, {id: 'ranking', label: '榜单'}],
    label: '值得出门的活动', previous: '上一个活动', next: '下一个活动',
    details: '查看详情', signup: '立即报名', enrolled: '{count} 人已报名',
    slide: '切换到第 {number} 个活动', empty: '本周暂无活动，去精选看看下一次相聚。',
  };
});
