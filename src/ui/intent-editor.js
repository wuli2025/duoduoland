(function (BJ) {
  BJ.createIntentEditor = function (ctx, root, eventId, draft, changed) {
    const {config,ui,service,engine,store} = ctx, c=config.intent, {e,icon}=ui;
    function parsed() {
      const romantic=draft.intent.mode==='dating';
      const keys=romantic ? ['interests','lifestyle','values'] : ['seekRoles','seekIndustries','seekSkills','offer','city'];
      const groups=keys.flatMap(key => {
        const values=Array.isArray(draft.intent[key]) ? draft.intent[key] : draft.intent[key] ? [draft.intent[key]] : [];
        return values.length ? [`<div class="join-tag-group"><span>${e(c.labels[key])}</span><div class="join-intent-tags">${values.map((v,i)=>`<button class="join-intent-tag" data-remove-key="${key}" data-remove-index="${i}">${e(v)}${icon('close')}</button>`).join('')}</div></div>`] : [];
      });
      if(romantic && draft.intentText) {
        const text=draft.intentText, d=config.dating;
        const gender=draft.intent.targetGender!=='不限' ? `<button class="join-intent-tag" data-intent-constraint="gender">${e(draft.intent.targetGender)}${icon('close')}</button>` : '';
        const age=[...d.similar,...d.older,...d.younger].some(w=>text.includes(w)) || /\d{2}\s*[-–至到]\s*\d{2}/.test(text);
        groups.unshift(`<div class="join-intent-tags">${gender}${age?`<button class="join-intent-tag" data-intent-constraint="age">${e(draft.intent.ageRange.join('–'))}岁${icon('close')}</button>`:''}</div>`);
      }
      return groups.join('') || `<small class="muted">${e(c.empty)}</small>`;
    }
    function refresh() {
      const host=root.querySelector('[data-common-tags]');
      if(!host) return;
      const mode=draft.intent.mode==='dating'?'dating':'professional';
      const tags=service.commonTags(eventId,mode);
      host.innerHTML=`<div class="button-row">${c.modes.map(([id,label])=>`<button class="intent-mode ${mode===id?'active':''}" data-intent-mode="${id}" aria-pressed="${mode===id}">${e(label)}</button>`).join('')}</div><h3>${e(c.common)}</h3><div class="intent-common-tags">${tags.map((tag,i)=>`<button data-common-index="${i}" aria-pressed="${(draft.intent[tag.key]||[]).includes(tag.value)}">${e((tags.filter(t=>t.value===tag.value).length>1?c.typedCount:c.count).replace('{tag}',tag.value).replace('{kind}',c.labels[tag.key]).replace('{n}',tag.count))}</button>`).join('') || e(c.noTags)}</div>`;
      host.querySelectorAll('[data-common-index]').forEach(button=>button.onclick=()=>{
        BJ.intentTools.toggle(draft.intent,tags[Number(button.dataset.commonIndex)]); changed();
      });
      host.querySelectorAll('[data-intent-mode]').forEach(button=>button.onclick=()=>{
        if(button.dataset.intentMode===mode) return;
        draft.intentText='';
        draft.intent=engine.parseIntent('');
        if(button.dataset.intentMode==='dating') Object.assign(draft.intent,BJ.dating.intent({mode:'dating'}));
        root.querySelector('#intent-text').value='';
        changed();
      });
      root.querySelectorAll('[data-intent-constraint]').forEach(button=>button.onclick=()=>{
        const gender=button.dataset.intentConstraint==='gender';
        const words=gender ? config.dating.genders[draft.intent.targetGender] || [] : [...config.dating.similar,...config.dating.older,...config.dating.younger];
        for(const word of words) draft.intentText=draft.intentText.replaceAll(word,'');
        if(gender) draft.intent.targetGender='不限';
        else {draft.intentText=draft.intentText.replace(/\d{2}\s*[-–至到]\s*\d{2}\s*岁?/g,'');draft.intent.ageRange=[config.dating.adultAge,config.dating.maxAge];}
        root.querySelector('#intent-text').value=draft.intentText;
        changed();
      });
    }
    function version() {
      const host=root.querySelector('[data-version-warning]');
      if(host) {host.hidden=!ctx.llm.compatibility().mismatch;host.textContent=c.versionWarning;}
    }
    return {parsed,refresh,version};
  };
})(window.BJ);
