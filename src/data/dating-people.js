// DEMO DATA — fictional ages/genders transcribed from docs/assets-log.md, not inferred from images.
(function (BJ) {
  const cfg = BJ.config.dating;
  const portraits = {
    "p01": ["男", 1984],
    "p02": ["女", 1987],
    "p03": ["男", 1994],
    "p04": ["男", 1998],
    "p05": ["女", 1991],
    "p06": ["女", 1997],
    "p07": ["男", 1996],
    "p08": ["女", 1985],
    "p09": ["男", 1982],
    "p10": ["女", 1999],
    "p11": ["女", 1993],
    "p12": ["男", 2000],
    "p13": ["女", 1988],
    "p14": ["男", 1991],
    "p15": ["女", 1996],
    "p16": ["男", 1990],
    "p17": ["女", 1992],
    "p18": ["男", 1986],
    "p19": ["女", 2000],
    "p20": ["男", 1988],
    "p21": ["女", 1992],
    "p22": ["男", 2002],
    "p23": ["女", 1985],
    "p24": ["男", 1996],
    "p25": ["女", 1997],
    "p26": ["男", 1981],
    "p27": ["女", 1990],
    "p28": ["男", 1993],
    "p29": ["女", 1999],
    "p30": ["男", 1974],
    "p31": ["女", 1995],
    "p32": ["男", 1998],
    "p33": ["女", 1987],
    "p34": ["男", 1991],
    "p35": ["女", 2001],
    "p36": ["男", 1984],
    "p37": ["女", 1996],
    "p38": ["男", 1999],
    "p39": ["女", 1982],
    "p40": ["男", 1995],
    "p41": ["女", 1998],
    "p42": ["男", 1989],
    "p43": ["女", 1993],
    "p44": ["男", 2000],
    "p45": ["女", 1991],
    "p46": ["男", 1986],
    "p47": ["女", 2002],
    "p48": ["男", 1997],
    "p49": ["男", 1992],
    "p50": ["女", 1995],
    "p51": ["男", 1997],
    "p52": ["女", 1999],
    "p53": ["男", 1988],
    "p54": ["女", 1993],
    "p55": ["男", 2001],
    "p56": ["男", 1985],
    "p57": ["女", 1997],
    "p58": ["男", 1994],
    "p59": ["女", 1990],
    "p60": ["男", 1999],
    "p61": ["男", 1996],
    "p62": ["女", 2000],
    "p63": ["男", 1982],
    "p64": ["女", 1992],
    "p65": ["男", 2003],
    "p66": ["女", 1987],
  };
  // No-photo fictional biographies: explicitly authored; no avatar age source exists.
  const placeholders = {49:['男',1981],50:['女',1994],51:['男',1991],52:['女',1997],53:['男',1989],54:['女',1996],55:['女',1988],56:['男',1985],57:['女',1990],58:['男',1993],59:['女',1987],60:['男',1995]};
  // id, interests, lifestyle, values; 12 men and 12 women, all adult and explicitly opted in.
  const open = [
    [4, ['户外','阅读','音乐'], ['周末徒步','早睡'], ['真诚','尊重边界']],
    [7, ['户外','摄影','看展'], ['城市漫步','规律运动'], ['好奇心','平等']],
    [12, ['阅读','咖啡','看展'], ['逛书店','慢节奏'], ['真诚','耐心']],
    [14, ['户外','烘焙','摄影'], ['周末徒步','自己做饭'], ['尊重边界','分享']],
    [22, ['阅读','音乐','看展'], ['校园跑步','早睡'], ['好奇心','平等']],
    [24, ['户外','咖啡','摄影'], ['周末徒步','喜欢旅行'], ['真诚','尊重边界']],
    [28, ['阅读','音乐','看展'], ['听现场演出','夜间创作'], ['独立','耐心']],
    [32, ['户外','烘焙','音乐'], ['自己做饭','周末露营'], ['幽默','分享']],
    [34, ['阅读','音乐','户外'], ['晨跑','早睡'], ['真诚','平等']],
    [38, ['户外','烘焙','摄影'], ['周末徒步','养植物'], ['尊重边界','耐心']],
    [40, ['阅读','音乐','看展'], ['逛博物馆','规律运动'], ['好奇心','独立']],
    [48, ['户外','咖啡','阅读'], ['周末徒步','早睡'], ['真诚','尊重边界']],
    [6, ['咖啡','阅读','看展'], ['自己做饭','逛书店'], ['真诚','独立']],
    [10, ['阅读','音乐','看展'], ['听现场演出','散步'], ['平等','幽默']],
    [11, ['户外','摄影','看展'], ['周末露营','规律运动'], ['真诚','尊重边界']],
    [15, ['户外','阅读','摄影'], ['周末徒步','早睡'], ['分享','耐心']],
    [19, ['看展','阅读','摄影'], ['逛美术馆','城市漫步'], ['好奇心','独立']],
    [21, ['音乐','骑行','看展'], ['晨间骑行','自己做饭'], ['平等','尊重边界']],
    [25, ['阅读','摄影','看展'], ['旅行写作','慢节奏'], ['真诚','分享']],
    [29, ['户外','摄影','看展'], ['周末徒步','早睡'], ['尊重边界','好奇心']],
    [31, ['阅读','摄影','咖啡'], ['自己做饭','养植物'], ['真诚','耐心']],
    [35, ['户外','摄影','看展'], ['规律运动','城市漫步'], ['平等','独立']],
    [37, ['阅读','摄影','看展'], ['逛博物馆','早睡'], ['真诚','尊重边界']],
    [41, ['户外','摄影','看展'], ['周末徒步','逛美术馆'], ['好奇心','分享']],
  ];
  const byId = new Map(open.map(row => ['person-' + String(row[0]).padStart(2, '0'), row]));
  BJ.data.people.forEach(person => {
    const n = Number(person.id.split('-')[1]);
    const [gender,birthYear] = portraits[person.profile.avatar] || placeholders[n];
    const row = byId.get(person.id);
    Object.assign(person.profile, { gender, birthYear, relationshipStatus: row ? '单身' : n % 3 === 0 ? '已婚' : n % 3 === 1 ? '恋爱中' : '不公开',
      datingOpen: !!row, datingPreference: { genders: [gender === '男' ? '女' : '男'], ageRange: [24,36], priorities: row ? row[3] : [] },
      datingLifestyle: row ? row[2] : [], datingValues: row ? row[3] : [] });
    person.versions.forEach(v => v.visibleFields = v.visibleFields.filter(k => !cfg.fields.includes(k)));
    const version = { id:'dating', name:cfg.copy.version, theme:'sage', visibleFields:cfg.publicFields.filter(k => row || k !== 'bio'),
      bio: row ? '喜欢' + row[1].join('、') + '，希望慢慢认识愿意分享日常的人。' : '愿意先从生活里的小事聊起。',
      datingProfile: row ? { interests: row[1] } : {} };
    person.versions.push(version);
    if (!row) return;
    // Fixture consent is deliberate: only this optional version opens these fields.
    version.visibleFields.push(...cfg.fields);
    const events = ['city-walk', ...(row[1].includes('阅读') ? ['slow-reading'] : []),
      ...(row[1].includes('音乐') ? ['indie-live'] : []), ...(row[1].includes('看展') ? ['design-workshop'] : []),
      ...([7,12,24,31,37,48].includes(n) ? ['founders-brunch'] : []), ...([24,35,48].includes(n) ? ['ai-agent-night'] : [])];
    events.forEach(id => person.sessions[id] = { ...(person.sessions[id] || {}), versionId:'dating', datingOpen:true,
      status: person.sessions[id]?.status || 'checked_in', openToChat:true, publicIntent:true,
      intent:{ seekRoles:[], seekIndustries:[], offer:[], city:'上海', mode:'dating', targetGender:gender === '男' ? '女' : '男', ageRange:[24,36], interests:row[1] } });
  });
  Object.assign(BJ.data.me.profile, {gender:'女',birthYear:1996,relationshipStatus:'单身',datingOpen:false,
    datingPreference:{genders:['男'],ageRange:[25,35],priorities:['真诚','尊重边界']},datingLifestyle:['周末徒步','早睡'],datingValues:['真诚','尊重边界']});
  BJ.data.me.versions.forEach(v => v.visibleFields = v.visibleFields.filter(k => !cfg.fields.includes(k)));
  BJ.data.me.versions.push({id:'dating',name:cfg.copy.version,theme:'sage',visibleFields:cfg.publicFields.slice(),
    bio:'喜欢户外、阅读和看展，希望认识愿意分享日常、尊重彼此边界的人。',datingProfile:{interests:['户外','阅读','看展','摄影']}});
})(window.BJ);
