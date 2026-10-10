"""Round 6 page regressions with injected responses; real LLM is evaluated separately."""
from pathlib import Path
import json
import os
import subprocess
import time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/screenshots/final'
OUT.mkdir(parents=True, exist_ok=True)
log_path = ROOT / 'docs/server-final.txt'
report = {'checks': [], 'diagnostics': [], 'page_errors': []}
env = {**os.environ, 'PORT': '8787', 'PORT_ATTEMPTS': '10'}
with log_path.open('w', encoding='utf-8') as logfile:
    process = subprocess.Popen(['node', 'server/index.js'], cwd=ROOT, env=env,
                               stdout=logfile, stderr=subprocess.STDOUT,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        url = None
        for _ in range(100):
            entries = [json.loads(line) for line in log_path.read_text(encoding='utf-8').splitlines() if line.startswith('{')]
            url = next((e['url'] for e in entries if e.get('event') == 'listening'), None)
            if url:
                break
            assert process.poll() is None, 'Owned server failed to start'
            time.sleep(0.1)
        assert url
        report['url'] = url
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1440, 'height': 1000})
            page.on('pageerror', lambda error: report['page_errors'].append(str(error)))
            page.add_init_script("window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)))")
            page.goto(url + '/#/events')
            page.evaluate("window.diagnostics=[];console.warn=e=>diagnostics.push(JSON.parse(e))")

            def phase(value):
                page.wait_for_function('p=>document.querySelector("[data-engine]")?.dataset.phase===p', arg=value)

            for code, expression in [
                ('LLM_ABORTED', "new DOMException('PRIVATE aborted', 'AbortError')"),
                ('ERR_HTTP2_STREAM_ERROR', "Object.assign(Error('PRIVATE payload'),{code:'ERR_HTTP2_STREAM_ERROR'})"),
            ]:
                page.evaluate("() => {BJ.ctx.llm.rerank=async()=>{throw " + expression + "};}")
                page.goto(url + '/#/events/ai-agent-night/match')
                phase('failed')
                expect(page.locator('[data-engine]')).to_have_text('本地规则计算（推荐服务未响应）')
                assert page.locator('.match-row').count() == 5
                entry = page.evaluate('diagnostics.at(-1)')
                assert entry['code'] == code and entry['eventId'] == 'ai-agent-night'
                assert 'PRIVATE' not in json.dumps(entry)
                report['diagnostics'].append(entry)
                page.screenshot(path=str(OUT / (code + '.png')), full_page=True)
                page.goto(url + '/#/events')
            report['checks'].append('页面直接reject：AbortError与普通code区分，failed保留本地5行，诊断无原始消息')

            page.evaluate("() => {BJ.ctx.llm.rerank=async(me,intent,rows)=>({engine:'llm',rows:rows.slice(0,2)});}")
            page.goto(url + '/#/events/ai-agent-night/match')
            phase('llm')
            expect(page.locator('.page-heading h1')).to_have_text('这 2 位，值得见一面。')
            assert page.locator('.match-row').count() == 2
            page.screenshot(path=str(OUT / 'partial-response.png'), full_page=True)
            report['checks'].append('注入仅2人结果：页面人数与标题同步；不把这张截图当作真实模型证据')
            assert not page.evaluate('rejections')

            offline = browser.new_page(viewport={'width': 1440, 'height': 1000})
            requests = []
            offline.on('request', lambda r: requests.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
            offline.goto((ROOT / 'index.html').as_uri() + '#/events/ai-agent-night/match')
            expect(offline.locator('[data-engine]')).to_have_text('本地规则计算（未连接推荐服务）')
            offline.wait_for_timeout(400)
            assert not requests
            offline.screenshot(path=str(OUT / 'file-local.png'), full_page=True)
            report['checks'].append('file本地降级，无HTTP请求')
            assert not report['page_errors']
            browser.close()
        (ROOT / 'docs/browser-final.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False, indent=2))
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
