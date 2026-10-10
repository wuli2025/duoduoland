(function (root, factory) {
  if (typeof module !== "undefined" && module.exports)
    module.exports = factory();
  else root.BJ.config.matching = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  return {
    weights: {
      needAB: 0.42,
      needBA: 0.16,
      complement: 0.12,
      common: 0.10,
      reach: 0.08,
      quality: 0.08,
      fresh: 0.05,
    },
    mutualBoost: 0.15,
    boostCeiling: 1.15,
    scoreCeiling: 97,
    scoreCurve: 0.45,
    commonThreshold: 0.15,
    mmrLambda: 0.88,
    topK: 5,
    mutualThreshold: 0.4,
    qualityFields: 10,
    fallbackNeed: 0.18,
    technicalWeight: 0.78,
    unknownPreference: 0.8,
    conflictingPreference: 0.35,
    complementPairs: [
      ["资金", "创始人"],
      ["资金", "投资人"],
      ["供应链", "产品经理"],
      ["供应链", "供应链专家"],
      ["技术", "产品经理"],
      ["技术", "工程师"],
      ["技术", "独立开发者"],
      ["产品经验", "创始人"],
      ["产品经验", "产品经理"],
      ["岗位", "工程师"],
      ["岗位", "产品经理"],
      ["项目", "投资人"],
      ["场景", "工程师"],
    ],
  };
});
