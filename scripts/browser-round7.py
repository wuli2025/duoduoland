"""Live round 7 acceptance. Stops only the Node process started by this script."""
from pathlib import Path
import json
import os
import subprocess
import time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/screenshots/round-7'
OUT.mkdir(parents=True, exist_ok=True)
LOG = ROOT / 'docs/server-round7.txt'
report = {'checks': [], 'meta': [], 'pageErrors': []}
with LOG.open('w', encoding='utf-8') as logfile:
    process = subprocess.Popen(['node', 'server/index.js'], cwd=ROOT,
                               env={**os.environ, 'PORT': '8787', 'PORT_ATTEMPTS': '10'},
                               stdout=logfile, stderr=subprocess.STDOUT,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        url = None
        for _ in range(100):
            entries = [json.loads(line) for line in LOG.read_text(encoding='utf-8').splitlines() if line.startswith('{')]
            url = next((e['url'] for e in entries if e.get('event') == 'listening'), None)
            if url:
                break
            assert process.poll() is None
            time.sleep(.1)
        assert url
        report['url'] = url
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1440, 'height': 1000})
            page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
            page.add_init_script("window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)))")
            bypasses = []
            responses = []

            def capture(response):
                if response.url.endswith('/api/llm/rerank') and response.status == 200:
                    responses.append(response)
                    bypasses.append(response.request.post_data_json.get('bypassCache', False))
            page.on('response', capture)

            def phase(name):
                page.wait_for_function('p=>document.querySelector("[data-engine]")?.dataset.phase===p', arg=name, timeout=68000)

            def shot(name):
                page.wait_for_timeout(500)
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
                page.screenshot(path=str(OUT / (name + '.png')), full_page=True)

            page.goto(url + '/#/events/ai-agent-night/match')
            phase('llm-pending')
            assert page.locator('.match-row').count() == 0
            page.wait_for_function('document.querySelector("[data-elapsed]")?.textContent.includes("2 秒")')
            report['pending'] = page.locator('.match-thinking').inner_text()
            assert page.locator('.match-candidate-preview .avatar').count() == 10
            shot('01-thinking')
            phase('done')
            report['meta'].append(responses[-1].json()['meta'])
            expect(page.locator('[data-engine]')).to_contain_text(report['meta'][0]['model'])
            assert page.locator('.match-row').count() == 5
            shot('02-completed')
            report['checks'].append('真实请求计时、等待无最终排名、成功才展示Top5与服务端meta')
            print('Live completion captured', flush=True)

            page.goto(url + '/#/events')
            page.goto(url + '/#/events/ai-agent-night/match')
            phase('cached')
            report['meta'].append(responses[-1].json()['meta'])
            expect(page.locator('[data-engine]')).to_contain_text('分钟前的大模型结果')
            expect(page.locator('[data-recalculate]')).to_have_text('重新计算')
            shot('03-cached')
            page.locator('[data-recalculate]').click()
            phase('llm-pending')
            assert page.locator('.match-row').count() == 0
            phase('done')
            report['meta'].append(responses[-1].json()['meta'])
            assert bypasses == [False, False, True]
            assert [m['cached'] for m in report['meta']] == [False, True, False]
            assert report['meta'][0]['cachedAt'] == report['meta'][1]['cachedAt']
            assert report['meta'][2]['correlationId'] != report['meta'][0]['correlationId']
            shot('04-recalculated')
            report['checks'].append('真实缓存命中；重新计算携带bypassCache并再次调用上游')
            print('Live bypass captured', flush=True)

            page.goto(url + '/#/events/ai-agent-night')
            page.locator('.attendee-wall').scroll_into_view_if_needed()
            assert page.locator('.attendee-avatar').count() == 24
            expected = page.evaluate('BJ.ctx.service.attendance("ai-agent-night").people.slice(0,24).map(p=>p.id)')
            actual = page.locator('.attendee-avatar').evaluate_all('els=>els.map(e=>e.dataset.openPerson)')
            assert actual == expected
            shot('05-attendee-wall')
            page.locator('.attendee-avatar').first.hover()
            expect(page.locator('.attendee-tooltip').first).to_be_visible()
            shot('05b-attendee-hover')
            page.locator('.attendee-avatar').first.click()
            expect(page.locator('.modal .public-fields')).to_contain_text('对方未公开')
            shot('06-public-card')
            page.keyboard.press('Escape')
            # Change only runtime visibility to exercise photo privacy, then re-render.
            page.evaluate("""() => {const p=BJ.ctx.data.people.find(p=>p.id===document.querySelector('.attendee-avatar').dataset.openPerson);
              p.versions.find(v=>v.id===p.sessions['ai-agent-night'].versionId).visibleFields=
                p.versions.find(v=>v.id===p.sessions['ai-agent-night'].versionId).visibleFields.filter(k=>k!=='avatar');} """)
            page.goto(url + '/#/events')
            assert page.locator('.event-card .attendee-stack').first.locator('.avatar').count() == 4
            page.goto(url + '/#/events/ai-agent-night')
            assert page.locator('.attendee-avatar').first.locator('img').count() == 0
            report['checks'].append('头像墙24人、签到优先、公开职位hover、本场隐私浮层、隐藏头像占位、卡片4人叠放')

            page.goto(url + '/#/events')
            page.evaluate("() => {BJ.ctx.llm.rerank=async()=>{throw Error('test failure')};}")
            page.goto(url + '/#/events/ai-agent-night/match')
            phase('failed')
            expect(page.locator('[data-engine]')).to_have_text('推荐服务暂未响应，已改用本地规则')
            expect(page.locator('[data-recalculate]')).to_have_text('重试')
            assert page.locator('.match-row').count() == 5
            assert page.locator('.match-orbit').count() == 0
            shot('07-failed')

            offline = browser.new_page(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
            requests = []
            offline.on('request', lambda r: requests.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
            offline.goto((ROOT / 'index.html').as_uri() + '#/events/ai-agent-night/match')
            expect(offline.locator('[data-engine]')).to_have_text('本地规则计算（未连接推荐服务）')
            assert offline.locator('.match-row').count() == 5
            assert offline.locator('.match-orbit').count() == 0
            assert not requests
            offline.screenshot(path=str(OUT / '08-file-local.png'), full_page=True)
            report['checks'].append('失败停止动效、显示本地Top5与重试；file直接本地且无HTTP请求')
            assert not page.evaluate('rejections') and not report['pageErrors']
            browser.close()
        entries = [json.loads(line) for line in LOG.read_text(encoding='utf-8').splitlines() if line.startswith('{')]
        report['upstreamEvidence'] = [e for e in entries if e.get('operation') == 'rerank' and e.get('status') == 'ok']
        assert len(report['upstreamEvidence']) == 2
        assert {e['correlationId'] for e in report['upstreamEvidence']} == {report['meta'][i]['correlationId'] for i in [0, 2]}
        (ROOT / 'docs/browser-round7.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
