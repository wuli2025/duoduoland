"""Round 10: uses only its own Node process; never stops a user-owned listener."""
from pathlib import Path
import json
import os
import subprocess
import time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/screenshots/round-10'
OUT.mkdir(parents=True, exist_ok=True)
LOG = ROOT / 'docs/server-round10.txt'
report = {'checks': [], 'meta': [], 'pageErrors': []}
with LOG.open('w', encoding='utf-8') as logfile:
    process = subprocess.Popen(['node', 'server/index.js'], cwd=ROOT,
        env={**os.environ, 'PORT': '8787', 'PORT_ATTEMPTS': '10'}, stdout=logfile, stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        url = None
        for _ in range(100):
            entries = [json.loads(s) for s in LOG.read_text(encoding='utf-8').splitlines() if s.startswith('{')]
            url = next((e['url'] for e in entries if e.get('event') == 'listening'), None)
            if url:
                break
            assert process.poll() is None
            time.sleep(.1)
        assert url
        report['url'] = url
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1440, 'height': 1080})
            page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
            page.add_init_script("window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)))")
            def shot(name):
                page.evaluate("""()=>Promise.all([...document.images].map(img=>{img.loading='eager';return img.decode().catch(()=>{});} ))""")
                page.evaluate("""() => Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))""")
                page.screenshot(path=str(OUT/(name+'.png')), full_page=True)
                audit=page.evaluate("""() => ({overflow:document.documentElement.scrollWidth>innerWidth,
                  tiny:[...document.querySelectorAll('body *')].filter(el=>el.getClientRects().length && !el.classList.contains('sr-only') &&
                    [...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize)<13)
                    .map(el=>({selector:el.className,text:el.textContent.slice(0,60),size:getComputedStyle(el).fontSize})),
                  clipped:[...document.querySelectorAll('main *')].filter(el=>el.getClientRects().length && !el.classList.contains('sr-only') &&
                    [...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim()) &&
                    (el.scrollWidth>el.clientWidth+3 || el.scrollHeight>el.clientHeight+3) &&
                    !['inline','contents'].includes(getComputedStyle(el).display))
                    .map(el=>({selector:el.className,text:el.textContent.slice(0,60),width:[el.clientWidth,el.scrollWidth],height:[el.clientHeight,el.scrollHeight]}))})""")
                report['checks'].append({'shot':name,**audit})
                assert not audit['overflow'] and not audit['tiny'] and not audit['clipped'], (name,audit)
            def navigate(path):
                page.goto(url+'/#'+path)
                page.wait_for_timeout(650)
            page.emulate_media(reduced_motion='reduce')
            for width in [1440,1024]:
                page.set_viewport_size({'width':width,'height':1080})
                navigate('/events')
                for tab in ['featured','week','ranking']:
                    page.locator('[data-carousel-tab="'+tab+'"]').click()
                    shot(str(width)+'-home-'+tab)
                navigate('/events/ai-agent-night')
                shot(str(width)+'-detail')
                navigate('/events/ai-agent-night/join')
                page.locator('[data-step="1"]').click()
                shot(str(width)+'-join')
                # Layout acceptance explicitly uses the real local engine, not fabricated LLM rows.
                page.evaluate("""()=>{BJ.ctx.config.llm.enabled=false;BJ.ctx.store.update(s=>{
                  s.participations['ai-agent-night']={versionId:'tech',intentText:'寻找投资人与Agent工程师',publicIntent:true,openToChat:true,status:'checked_in',
                  intent:{seekRoles:['投资人','工程师'],seekIndustries:['Agent'],offer:['产品经验','项目'],city:'上海'}};});}""")
                navigate('/events/ai-agent-night/match')
                page.wait_for_function('document.querySelectorAll(".match-row").length===5')
                shot(str(width)+'-match')
                for label,path in [('jobs','/jobs'),('cards','/me'),('discover','/discover'),('live','/live/ai-agent-night')]:
                    navigate(path)
                    shot(str(width)+'-'+label)
                navigate('/events')
                page.keyboard.press('Control+k')
                page.wait_for_timeout(400)
                shot(str(width)+'-search')
                page.keyboard.press('Escape')
            # Exercise the actual component controls and motion preference.
            page.set_viewport_size({'width':1440,'height':1080})
            navigate('/events')
            carousel=page.locator('[data-event-carousel]')
            carousel.locator('[data-carousel-move="-1"]').click()
            expect(carousel).to_have_attribute('data-index','2')
            page.locator('#carousel-panel').focus()
            page.keyboard.press('ArrowRight')
            expect(carousel).to_have_attribute('data-index','0')
            page.locator('.carousel-slide[data-position="next"]').click(position={'x':450,'y':80})
            expect(carousel).to_have_attribute('data-index','1')
            page.mouse.move(800,610);page.mouse.down();page.mouse.move(500,610,steps=12);page.mouse.up()
            expect(carousel).to_have_attribute('data-index','2')
            carousel.locator('[data-carousel-dot="0"]').click()
            expect(carousel).to_have_attribute('data-index','0')
            carousel.locator('[data-carousel-dot="2"]').click()
            expect(carousel).to_have_attribute('data-index','2')
            page.locator('.brand').first.focus();page.mouse.move(5,5)
            page.wait_for_timeout(5300)
            expect(carousel).to_have_attribute('data-index','2')
            page.emulate_media(reduced_motion='no-preference')
            page.wait_for_timeout(5300)
            expect(carousel).to_have_attribute('data-index','0')
            page.mouse.move(700,500)
            page.wait_for_timeout(5300)
            expect(carousel).to_have_attribute('data-index','0')
            touch=browser.new_page(viewport={'width':1024,'height':1080},has_touch=True,reduced_motion='reduce')
            touch.goto(url+'/#/events')
            touch.locator('.carousel-stage').wait_for()
            box=touch.locator('.carousel-stage').bounding_box()
            session=touch.context.new_cdp_session(touch)
            x=box['x']+box['width']*.65;y=box['y']+box['height']*.5
            session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-120,'y':y}]})
            session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            expect(touch.locator('[data-event-carousel]')).to_have_attribute('data-index','1')
            touch.close()
            report['interaction']='循环箭头、键盘、侧卡、鼠标拖拽、真实touch事件、reduced-motion、5秒自动轮播与hover暂停通过' 
            # file:// remains self contained.
            page.goto((ROOT/'index.html').as_uri()+'#/events')
            expect(page.locator('.brand').first).to_have_text('多多群岛')
            expect(page.locator('.carousel-slide[data-position="current"] h2')).to_contain_text('AI Agent')
            report['file']='file://品牌、轮播与本地资源加载通过'
            assert not page.evaluate('rejections') and not report['pageErrors']
            browser.close()
        (ROOT/'docs/browser-round10.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)

