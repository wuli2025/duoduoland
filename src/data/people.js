// DEMO DATA — 60 independent profiles; event membership follows topic affinity.
(function (BJ) {
  const professional = ['name', 'avatar', 'title', 'company', 'industry', 'city', 'skills', 'bio', 'experience'];
  const casual = ['name', 'avatar', 'city', 'interests', 'bio'];
  const interests = [
    ['阅读', '摄影'], ['徒步', '烘焙'], ['音乐', '骑行'],
    ['阅读', '音乐'], ['徒步', '摄影'], ['咖啡', '阅读'],
  ];
  function attends(row, event, hobbies) {
    const role = row[5];
    const text = row.slice(1, 6).flat().join(' ');
    switch (event.category) {
      case 'AI': return /Agent|AI|工程师|招聘者|独立开发者|供应链/.test(text);
      case '投资': return /投资人|创始人|供应链专家/.test(role);
      case '创业': return /创始人|投资人|律师|财务顾问|供应链专家|BD|销售|工程师|招聘者/.test(role);
      case '设计': return /设计|产品|摄影|建筑|独立开发/.test(text);
      case '产品': return /产品|设计|工程师|运营|市场|招聘者|独立开发/.test(text);
      case '读书会': return hobbies.includes('阅读');
      case '音乐': return hobbies.includes('音乐');
      case '户外': return hobbies.includes('徒步') || hobbies.includes('摄影');
      default: return /跨境|新消费|供应链|BD|销售|法律|财务/.test(text);
    }
  }
  BJ.data.people = BJ.data.peopleCatalog.map((row, i) => {
    const id = 'person-' + String(i + 1).padStart(2, '0');
    const hobbies = [...new Set([...interests[i % interests.length], ...row[4].filter(x => ['阅读', '摄影', '音乐', '户外'].includes(x))])];
    const profile = {
      name: row[0], avatar: i < 48 ? 'p' + String(i + 1).padStart(2, '0') : '',
      title: row[1], company: row[2], industry: row[3], city: '上海',
      skills: row[4].slice(), experience: row[2] + ' · ' + row[1] + '；' + row[8],
      projects: row[4][0] + '实践 · ' + row[2],
      education: ['同济大学', '复旦大学', '浙江大学', '上海大学'][i % 4] + ' · ' + row[3],
      interests: hobbies, goals: '期待认识' + row[7] + '，交流' + row[4][0],
      bio: row[8], contact: id + '@example.com', website: id + '.example.com',
    };
    const visible = professional.filter(key => !(i % 7 === 6 && ['company', 'experience', 'city'].includes(key)));
    if (i % 5 === 0) visible.push('projects', 'education', 'interests');
    const versions = [
      { id: 'professional', name: '职业交流版', visibleFields: visible, bio: row[8], theme: 'paper' },
      { id: 'casual', name: '休闲社交版', visibleFields: casual.slice(), bio: row[0] + '喜欢' + hobbies.join('、') + '，欢迎聊聊生活里的小事。', theme: 'butter' },
    ];
    if (i % 3 !== 0) versions.push({
      id: 'focused', name: '项目交流版', theme: 'sage',
      visibleFields: ['name', 'avatar', 'title', 'industry', 'skills', 'projects', 'bio'], bio: row[8],
    });
    const sessions = {};
    BJ.data.events.forEach((event, n) => {
      if (!attends(row, event, hobbies)) return;
      const leisure = ['读书会', '音乐', '户外'].includes(event.category);
      const investment = event.category === '投资';
      const offer = leisure ? hobbies.slice(0, n === 4 ? 1 : 2) : [row[6], row[4][n % row[4].length]];
      let seekRoles = leisure ? [] : [row[7]];
      if (investment && row[5] === '创始人') seekRoles = ['投资人'];
      if (investment && row[5] === '投资人') seekRoles = ['创始人', '工程师'];
      const empty = [21, 32, 47].includes(i) && n % 2 === 1;
      sessions[event.id] = {
        versionId: leisure ? 'casual' : (n === 7 && versions.length === 3 ? 'focused' : 'professional'),
        intent: empty ? { seekRoles: [], seekIndustries: [], offer: [], city: '' } : {
          seekRoles, seekIndustries: leisure ? [event.tags[0]] : [row[3]], offer, city: '上海',
        },
        publicIntent: i % 11 !== 9, openToChat: i % 9 !== 7,
        status: i % 5 === 3 ? 'registered' : 'checked_in',
      };
    });
    return { id, profile, versions, sessions, interested: i < 3, viewed: i < 12 };
  });
})(window.BJ);
