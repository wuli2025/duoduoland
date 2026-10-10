// DEMO DATA — fictional openings and requirements, no external applications.
(function (BJ) {
  const titles = BJ.data.jobDetails.map(row => row[0]);
  BJ.data.jobs = titles.map((title, i) => {
    const company = BJ.data.companies[i % 8];
    const salaryLow = [
      40, 50, 35, 30, 45, 25, 35, 40, 60, 35, 30, 40, 35, 25, 30, 45,
    ][i];
    const recruiterNumber = [6, 46, 6, 7, 14, 10, 13, 16, 6, 38, 39, 45, 28, 19, 40, 24][i];
    const recruiterId = 'person-' + String(recruiterNumber).padStart(2, '0');
    const recruiter = BJ.data.people.find(p => p.id === recruiterId);
    return {
      id: "job-" + String(i + 1).padStart(2, "0"),
      title,
      companyId: company.id,
      city: i < 8 ? "上海" : ["上海", "深圳", "北京", "杭州"][i % 4],
      district: ["徐汇", "浦东", "静安", "长宁"][i % 4],
      salary:
        salaryLow +
        "–" +
        (salaryLow + 20) +
        "K·" +
        (i % 3 ? "14" : "15") +
        "薪",
      salaryLow,
      salaryBand:
        salaryLow >= 60 ? "60K 以上" : salaryLow >= 40 ? "40–60K" : "20–40K",
      experience: i % 3 === 0 ? "5–10 年" : "3–5 年",
      education: i === 4 ? "硕士" : "本科",
      industry: company.industry,
      stage: company.stage,
      size: company.size,
      recruiterId,
      recruiterTitle: recruiter.profile.title,
      referralIds:
        i % 3 === 0
          ? [recruiterId]
          : i % 3 === 1
            ? [recruiterId]
            : [],
      benefits: BJ.data.jobDetails[i][2],
      requirements: BJ.data.jobDetails[i][1],
      tags: BJ.data.jobDetails[i][1].slice(0, 2),
      eventId: BJ.data.jobDetails[i][3],
      description: [
        "负责" + title + "方向的项目，重点开展" + BJ.data.jobDetails[i][1][0] + "相关工作。",
        "结合" + BJ.data.jobDetails[i][1].slice(1).join('、') + "经验，与团队协作完成交付。",
        "定期复盘项目效果，分享可供团队复用的实践。",
      ],
      published: 100 - i,
      online: i % 3 !== 2,
    };
  });
})(window.BJ);
