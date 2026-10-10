const test=require('node:test'), assert=require('node:assert/strict');
const demo=require('../scripts/load-demo')(), {engine,data,config}=demo;
const tools=require('../src/core/intent-tools'), dating=require('../src/core/dating');
const client=require('../src/core/llm-client');
const scenario=require('../scripts/eval-dating-scenarios').scenarios(demo)[1];
const members=data.people.filter(p=>p.sessions[scenario.eventId]).map(p=>({...p,session:p.sessions[scenario.eventId]}));
test('默认已报名场次和新场次的意图为空；空意图不会发送模型请求',async()=>{
  assert.equal(data.defaultParticipation.intentText,''); assert.ok(tools.empty(data.defaultParticipation.intent));
  const service=demo.createService(config,data,{get:()=>({me:data.me,participations:{}}),clone:structuredClone},engine);
  assert.ok(tools.empty(service.currentSession('city-walk').intent));
  let calls=0;const api=client.create(config.llm,engine,{fetchImpl:async()=>{calls++;throw Error('unexpected');}});
  const result=await api.rerank({...data.me,session:data.defaultParticipation},data.defaultParticipation.intent,[]);
  assert.equal(calls,0);assert.equal(result.error,'EMPTY_INTENT');
});
test('旧服务缺mode或性别冲突时，本地关键词锁定dating与男性',async()=>{
  for(const legacy of [{seekRoles:['男朋友'],seekIndustries:['户外'],offer:[],city:''},
    {seekRoles:[],seekIndustries:[],offer:[],city:'',mode:'dating',targetGender:'女',ageRange:[18,99],interests:[]}]){
    const api=client.create(config.llm,engine,{fetchImpl:async url=>({ok:true,json:async()=>url.endsWith('health')?
      {ok:true,timeoutMs:50,appVersion:config.llm.appVersion}:legacy})});
    const out=await api.parseIntent(scenario.me.session.intentText,{ownProfile:scenario.me.profile});
    assert.equal(out.intent.mode,'dating');assert.equal(out.intent.targetGender,'男');assert.deepEqual(out.intent.ageRange,[25,35]);
    const rows=engine.rank({...scenario.me,session:{...scenario.me.session,intent:out.intent}},members);
    assert.equal(rows.length,5);assert.ok(rows.every(r=>r.public.profile.gender==='男'));
  }
});
test('rank不信任过期mode或query覆盖，直接用原文作第二道性别过滤',()=>{
  const old={...scenario.me,session:{...scenario.me.session,intent:{seekRoles:['男朋友'],seekIndustries:[],offer:[],city:''}}};
  const result=engine.rank(old,members,{queryIntent:{mode:'dating',targetGender:'女',ageRange:[18,99],interests:[]}});
  assert.equal(result.length,5);assert.ok(result.every(r=>r.public.profile.gender==='男'));
});
test('旧版本/缺版本健康响应可识别，dating禁止向旧服务发送rerank',async()=>{
  for(const version of [undefined,'8.0.0']){
    const urls=[];const api=client.create(config.llm,engine,{fetchImpl:async url=>{urls.push(url);return {ok:true,json:async()=>({ok:true,timeoutMs:60,appVersion:version})};}});
    assert.equal((await api.checkVersion()).mismatch,true);
    const result=await api.rerank(scenario.me,scenario.me.session.intent,engine.rank(scenario.me,members));
    assert.equal(result.engine,'local');assert.equal(result.error,'APP_VERSION_MISMATCH');
    assert.ok(urls.every(url=>url.endsWith('health')));assert.ok(result.rows.every(r=>r.public.profile.gender==='男'));
  }
});
test('客户端降级前也过滤错误性别行，损坏召回不会在失败后展示女性',async()=>{
  const man=engine.rank(scenario.me,members)[0];
  const woman=structuredClone(man);woman.id='fake-woman';woman.public.id=woman.id;woman.public.profile.gender='女';
  const api=client.create(config.llm,engine,{protocol:'file:'});
  const result=await api.rerank(scenario.me,scenario.me.session.intent,[man,woman]);
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].public.profile.gender,'男');
});
test('真实HTTP health返回与前端一致的启动版本',async()=>{
  const server=require('../server/index').createServer({config:{root:require('../server/config').root,timeout:60000},logger:()=>{},llm:{}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/health');
    assert.equal((await response.json()).appVersion,config.llm.appVersion);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('常见标签按公开字段和人数统计，一人重复标签只计一次，隐藏字段不泄露',()=>{
  const p={profile:{title:'工程师',industry:'人工智能',skills:['Agent','Agent','秘密']},visibleFields:['title','skills']};
  const tags=tools.tags([p,{...p,profile:{...p.profile,skills:['Agent']}}]);
  assert.equal(tags.find(t=>t.value==='Agent').count,2);
  assert.ok(tags.every((r,i)=>!i||tags[i-1].count>=r.count));assert.ok(!tags.some(t=>t.value==='人工智能'));
  const hidden={...p,visibleFields:['title']};assert.ok(!tools.tags([hidden]).some(t=>t.value==='秘密'));
  const intent=engine.parseIntent('');
  for(const key of ['seekRoles','seekIndustries','seekSkills','interests','lifestyle','values']){
    tools.toggle(intent,{key,value:'所选'});assert.deepEqual(intent[key],['所选']);
    tools.toggle(intent,{key,value:'所选'});assert.deepEqual(intent[key],[]);
  }
});
test('交友常见标签只统计本场开启且公开的人；职业标签不混入',()=>{
  const p=engine.project(members.find(p=>p.id==='person-24'));
  const closed=structuredClone(p);closed.profile.datingOpen=false;closed.profile.interests=['隐藏兴趣'];
  const hidden=structuredClone(p);hidden.visibleFields=hidden.visibleFields.filter(k=>k!=='interests');hidden.profile.interests=['保密兴趣'];
  const tags=tools.tags([p,closed,hidden],'dating');
  assert.ok(tags.length>0 && tags.length<=16);
  assert.ok(!tags.some(t=>['隐藏兴趣','保密兴趣'].includes(t.value)));
  assert.ok(tags.every(t=>['interests','lifestyle','values'].includes(t.key)));
});
test('本地fitReason用8套模板组合公开证据，Top5结构不同、长度与证据合格',()=>{
  const rows=engine.rank(scenario.me,members), me=engine.project(scenario.me);
  assert.equal(dating.cfg.fitTemplates.length,8);
  assert.equal(new Set(rows.map(r=>r.fitReason)).size,5);
  for(const r of rows) assert.ok([...r.fitReason].length<=60 && dating.safe(r.fitReason) && dating.grounded(r.fitReason,me,r.public));
  assert.ok(rows.some(r=>r.fitReason.startsWith('值得和')));
  assert.ok(rows.some(r=>r.fitReason.startsWith('从共同点')));
});
