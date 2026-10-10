"""Round 8: uses only its own Node process; never stops a user-owned listener."""
from pathlib import Path
import json
import os
import subprocess
import time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/screenshots/round-8'
OUT.mkdir(parents=True, exist_ok=True)
LOG = ROOT / 'docs/server-round8.txt'
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
            requests = []
            def capture(response):
                if response.url.endswith('/api/llm/rerank'):
                    requests.append(response)
            page.on('response', capture)
            def shot(name):
                page.evaluate('''() => Promise.all(document.getAnimations()
                    .filter(a=>a.effect?.getTiming().iterations !== Infinity)
                    .map(a=>a.finished.catch(()=>{})))''')
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
                page.screenshot(path=str(OUT / (name + '.png')), full_page=True)
            def phase(value):
                page.wait_for_function('v=>document.querySelector("[data-engine]")?.dataset.phase===v', arg=value, timeout=70000)
            def consent(event_id):
                page.goto(url + '/#/events/' + event_id + '/join')
                page.locator('[data-step="1"]').click()
                page.locator('#intent-text').fill('想找个男朋友，年龄相仿，最好也喜欢户外')
                expect(page.locator('[data-dating-consent]')).to_contain_text('找对象需要你也公开交友信息')
                expect(page.locator('.join-parsed-tags')).to_contain_text('25–35岁')
            consent('ai-agent-night')
            shot('01-consent-prompt')
            page.locator('[data-decline-dating]').click()
            page.locator('[data-next]').click()
            page.locator('[data-next]').click()
            phase('local')
            assert page.locator('.match-row').count() == 0
            expect(page.locator('[data-engine]')).to_contain_text('因此不进行恋爱匹配')
            assert not requests
            shot('02-declined')
            report['checks'].append('解析男朋友/相仿年龄/户外；拒绝授权后不展示结果、不请求重排')

            consent('ai-agent-night')
            page.locator('[data-enable-dating]').click()
            expect(page.locator('[data-dating-consent]')).to_contain_text('已开启本场交友')
            shot('03-consented')
            page.locator('[data-next]').click()
            page.locator('[data-next]').click()
            phase('llm-pending')
            shot('04-thinking')
            phase('done')
            assert page.locator('.match-row').count() == 2
            expect(page.locator('.match-toolbar')).to_be_hidden()
            expect(page.locator('[data-dating-summary]')).to_contain_text('有 2 位')
            expect(page.locator('.dating-alternatives')).to_contain_text('秋日漫游')
            expect(page.locator('.match-detail .dating-fit')).to_contain_text('为什么他可能适合当你男朋友')
            assert page.locator('.match-row .dating-fit').count() == 2
            assert page.locator('.match-detail .public-fields').inner_text().find('单身') >= 0
            report['meta'].append(requests[-1].json()['meta'])
            shot('05-ai-night-shortlist')
            report['checks'].append('AI之夜真实模型返回2位男性；每卡与详情展示fitReason；不足5人的真实人数及活动建议')
            print('AI dating result captured', flush=True)

            consent('city-walk')
            # Global preference is retained, but a new event requires its own opt-in.
            page.locator('[data-enable-dating]').click()
            page.locator('[data-next]').click()
            page.locator('[data-next]').click()
            phase('done')
            assert page.locator('.match-row').count() == 5
            assert page.locator('.match-row .dating-fit').count() == 5
            report['meta'].append(requests[-1].json()['meta'])
            shot('06-walk-results')
            report['checks'].append('城市徒步真实精排5位，兴趣与交友信息公开；跨场次单独授权')

            page.goto(url + '/#/me/base')
            expect(page.locator('[data-profile-field="gender"]')).to_have_value('女')
            expect(page.locator('[data-profile-field="birthYear"]')).to_have_value('1996')
            expect(page.locator('.cards-base-fields')).to_contain_text('仅在你选择交友版且开启后可见')
            page.goto(url + '/#/me/tech')
            expect(page.locator('[data-visible="gender"]')).to_be_disabled()
            report['checks'].append('名片编辑敏感字段提示、结构化输入；职业名片不能公开恋爱字段')

            offline = browser.new_page(viewport={'width': 1440, 'height': 1080})
            offline_requests = []
            offline.on('request', lambda r: offline_requests.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
            offline.goto((ROOT / 'index.html').as_uri() + '#/events/ai-agent-night/join')
            offline.locator('[data-step="1"]').click()
            offline.locator('#intent-text').fill('想找个男朋友，年龄相仿，最好也喜欢户外')
            offline.locator('[data-enable-dating]').click()
            offline.locator('[data-next]').click()
            offline.locator('[data-next]').click()
            expect(offline.locator('[data-engine]')).to_have_text('本地规则计算（未连接推荐服务）')
            assert offline.locator('.match-row .dating-fit').count() == 2
            assert not offline_requests
            offline.screenshot(path=str(OUT / '07-file-local.png'), full_page=True)
            report['checks'].append('file直接本地计算，2位合格候选与共同兴趣fitReason，无HTTP请求')
            assert not page.evaluate('rejections') and not report['pageErrors']
            browser.close()
        entries = [json.loads(s) for s in LOG.read_text(encoding='utf-8').splitlines() if s.startswith('{')]
        report['upstreamEvidence'] = [e for e in entries if e.get('operation') == 'rerank' and e.get('status') == 'ok']
        assert len(report['upstreamEvidence']) == 2
        assert not any(e.get('code') == 'LLM_BUSY' for e in entries)
        report['checks'].append('离开设置页取消意图请求，精排不被旧解析占满并发槽')
        (ROOT / 'docs/browser-round8.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
