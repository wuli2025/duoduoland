"""Round 9: uses only its own Node process; never stops a user-owned listener."""
from pathlib import Path
import json
import os
import subprocess
import time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/screenshots/round-9'
OUT.mkdir(parents=True, exist_ok=True)
LOG = ROOT / 'docs/server-round9.txt'
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
            responses = []
            page.on('response', lambda r: responses.append(r) if r.url.endswith('/api/llm/rerank') else None)
            def phase(value):
                page.wait_for_function('v=>document.querySelector("[data-engine]")?.dataset.phase===v', arg=value, timeout=70000)
            def shot(name):
                page.evaluate("""() => Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))""")
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
                page.screenshot(path=str(OUT/(name+'.png')), full_page=True)
            page.goto(url+'/#/events/ai-agent-night/match')
            phase('local')
            expect(page.locator('[data-engine]')).to_contain_text('先写一句期待')
            assert page.locator('.match-row').count()==0 and not responses
            page.goto(url+'/#/events/ai-agent-night/join')
            page.locator('[data-step="1"]').click()
            expect(page.locator('#intent-text')).to_have_value('')
            assert page.locator('[data-remove-key]').count()==0
            assert 12 <= page.locator('[data-common-index]').count() <= 16
            shot('01-empty-common-tags')
            tag=page.locator('[data-common-index]').first
            title=tag.inner_text().split(' · ')[0]
            tag.click()
            expect(page.locator('.join-parsed-tags')).to_contain_text(title)
            expect(page.locator('.join-preview')).to_contain_text(title)
            expect(page.locator('[data-common-index]').first).to_have_attribute('aria-pressed','true')
            shot('02-selected-tag')
            page.locator('[data-remove-key]').click()
            expect(page.locator('[data-common-index]').first).to_have_attribute('aria-pressed','false')
            report['checks'].append('默认空白、空意图不重排、16个公开常见标签、点选/删除与右侧预览同步')

            old_calls=[]
            page.route('**/api/health', lambda route: route.fulfill(json={'ok':True,'timeoutMs':60000,'model':'legacy'}))
            def old_intent(route):
                old_calls.append(route.request.url)
                route.fulfill(json={'seekRoles':['男朋友'],'seekIndustries':['户外'],'offer':[],'city':''})
            page.route('**/api/llm/intent',old_intent)
            page.reload()
            page.locator('[data-step="1"]').click()
            page.locator('#intent-text').fill('想找个男朋友，年龄相仿，最好也喜欢户外')
            page.wait_for_timeout(900)
            assert old_calls
            expect(page.locator('[data-version-warning]')).to_contain_text('推荐服务是旧版本')
            expect(page.locator('.join-parsed-tags')).to_contain_text('男')
            assert page.locator('[data-common-index]').count()>0
            shot('03-legacy-intent-warning')
            page.locator('[data-enable-dating]').click()
            page.locator('[data-next]').click()
            page.locator('[data-next]').click()
            phase('local')
            assert page.locator('.match-row').count()==2 and not responses
            expect(page.locator('[data-version-warning]')).to_be_visible()
            expect(page.locator('[data-engine]')).to_contain_text('版本不一致')
            genders=page.locator('[data-person-id]').evaluate_all("els=>els.map(e=>BJ.ctx.service.publicPerson(e.dataset.personId,'ai-agent-night').profile.gender)")
            assert genders==['男','男']
            shot('04-legacy-male-only-local')
            report['checks'].append('明确注入旧health/无mode意图：设置页与匹配页提示旧版，dating未丢失，仅本地2位男性，无rerank请求')

            page.unroute('**/api/health')
            page.unroute('**/api/llm/intent')
            page.goto(url+'/#/events/city-walk/join')
            page.reload()
            page.locator('[data-step="1"]').click()
            expect(page.locator('#intent-text')).to_have_value('')
            page.locator('#intent-text').fill('想找个男朋友，年龄相仿，最好也喜欢户外')
            page.locator('[data-enable-dating]').click()
            page.locator('[data-next]').click()
            page.locator('[data-next]').click()
            phase('done')
            assert page.locator('.match-row').count()==5
            expect(page.locator('[data-version-warning]')).to_be_hidden()
            assert len(responses)==1 and responses[0].status==200
            report['meta'].append(responses[0].json()['meta'])
            genders=page.locator('[data-person-id]').evaluate_all("els=>els.map(e=>BJ.ctx.service.publicPerson(e.dataset.personId,'city-walk').profile.gender)")
            assert genders==['男']*5
            shot('05-walk-real-llm')
            report['checks'].append('当前9.0.0服务：城市徒步真实LLM精排5位男性、fitReason及真实meta')
            assert not page.evaluate('rejections') and not report['pageErrors']
            browser.close()
        entries=[json.loads(s) for s in LOG.read_text(encoding='utf-8').splitlines() if s.startswith('{')]
        report['upstreamEvidence']=[e for e in entries if e.get('operation')=='rerank' and e.get('status')=='ok']
        assert len(report['upstreamEvidence'])==1
        (ROOT/'docs/browser-round9.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
