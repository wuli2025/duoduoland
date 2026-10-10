"""Real HTTP/file acceptance; owns and stops only the server process it starts."""
from pathlib import Path
import json
import os
import subprocess
import socket
import time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/screenshots/round-4'
OUT.mkdir(parents=True, exist_ok=True)
LOG = ROOT / 'docs/server-round4.txt'
report = {'checks': [], 'errors': [], 'timings': {}}
env = dict(os.environ)
env['PORT'] = '8787'
env['PORT_ATTEMPTS'] = '10'
logfile = LOG.open('w', encoding='utf-8')
blocker = socket.socket()
try:
    blocker.bind(('127.0.0.1', 8787))
    blocker.listen(1)
    report['port_test'] = '8787原本空闲，由验收脚本临时占用以验证自动顺延'
except OSError:
    blocker.close()
    blocker = None
    report['port_test'] = '8787已被占用，保留原进程'
process = subprocess.Popen(['node', 'server/index.js'], cwd=ROOT, env=env,
                           stdout=logfile, stderr=subprocess.STDOUT,
                           creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
try:
    url = None
    for _ in range(100):
        entries = [json.loads(line) for line in LOG.read_text(encoding='utf-8').splitlines() if line.startswith('{')]
        for entry in entries:
            if entry.get('event') == 'listening':
                url = entry['url'] + '/'
        if url:
            break
        if process.poll() is not None:
            raise RuntimeError('Owned demo server failed to start; see named errors')
        time.sleep(0.1)
    assert url, 'No listening address'
    report['url'] = url
    report['port_events'] = [e for e in entries if e.get('event') in ['listen_error', 'listening']]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        page.add_init_script("window.unhandled=[];addEventListener('unhandledrejection',e=>unhandled.push(String(e.reason)))")

        def phase(value):
            page.wait_for_function('(phase)=>document.querySelector("[data-engine]")?.dataset.phase===phase', arg=value, timeout=68000)

        def shot(name):
            page.wait_for_timeout(1000)
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
            scores = page.locator('.match-score>b').all_text_contents()
            values = [int(s.replace('%', '')) for s in scores]
            assert values == sorted(values, reverse=True), values
            page.screenshot(path=str(OUT / (name + '.png')), full_page=True)

        began = time.perf_counter()
        page.goto(url + '#/events/ai-agent-night/match')
        page.locator('.match-row').first.wait_for()
        report['timings']['local_ms'] = round((time.perf_counter() - began) * 1000)
        phase('pending')
        expect(page.locator('[data-engine]')).to_contain_text('本地初排')
        shot('http-01-local')
        page.keyboard.press('ArrowDown')
        selected = page.locator('.match-row.active').get_attribute('data-person-id')
        page.locator('[data-person-action="favorite"]').click()
        shot('http-02-interactive')
        phase('llm')
        report['timings']['refined_ms'] = round((time.perf_counter() - began) * 1000)
        expect(page.locator('[data-engine]')).to_have_text('已由大模型精排')
        assert page.evaluate('BJ.ctx.store.get().favorites.length') == 1
        if page.locator(f'[data-person-id="{selected}"]').count():
            expect(page.locator(f'[data-person-id="{selected}"]')).to_have_attribute('aria-pressed', 'true')
        shot('http-03-refined')
        report['checks'].append('真实本地初排→大模型精排，等待可交互，显示分数降序，保留收藏与选中')

        page.goto(url + '#/events')
        cached = time.perf_counter()
        page.goto(url + '#/events/ai-agent-night/match')
        phase('llm')
        report['timings']['cache_ms'] = round((time.perf_counter() - cached) * 1000)
        assert report['timings']['cache_ms'] < 5000
        shot('http-04-cache')

        # Exercise page-level catch even if an injected client violates its contract.
        page.goto(url + '#/events')
        page.evaluate("() => {window.originalRerank=BJ.ctx.llm.rerank;BJ.ctx.llm.rerank=async()=>{throw new Error('injected reject')};}")
        page.goto(url + '#/events/ai-agent-night/match')
        phase('failed')
        expect(page.locator('[data-engine]')).to_have_text('本地规则计算（推荐服务未响应）')
        assert page.locator('.match-row').count() == 5
        shot('http-05-reject')
        page.evaluate('() => {BJ.ctx.llm.rerank=window.originalRerank;}')
        report['checks'].append('注入rerank直接reject：页面catch落到failed、保留5行、无unhandled rejection')

        for name, status, body in [('http', 500, '{"error":"LLM_BUSY"}'), ('json', 200, 'not json'), ('timeout', 504, '{"error":"LLM_TIMEOUT"}')]:
            page.goto(url + '#/events')
            page.route('**/api/llm/rerank', lambda route, request, status=status, body=body: route.fulfill(status=status, content_type='application/json', body=body))
            page.goto(url + '#/events/ai-agent-night/match')
            phase('failed')
            assert page.locator('.match-row').count() == 5
            page.unroute('**/api/llm/rerank')
        report['checks'].append('注入HTTP错误、非法JSON、超时响应均failed；真实deadline另有Node测试')

        page.goto(url + '#/events')
        page.evaluate("""() => {window.abortSeen=false;window.callStarted=false;
          BJ.ctx.llm.rerank=(...args)=>new Promise((resolve,reject)=>{
            window.callStarted=true;args[5].signal.addEventListener('abort',()=>{
              window.abortSeen=true;reject(Object.assign(new Error('cancel'),{code:'LLM_ABORTED'}));
            });
          });}""")
        page.goto(url + '#/events/ai-agent-night/match')
        page.wait_for_function('window.callStarted')
        page.goto(url + '#/events')
        page.wait_for_function('window.abortSeen')
        page.evaluate('() => {BJ.ctx.llm.rerank=window.originalRerank;}')
        report['checks'].append('离开页面向rerank传递的signal确实abort；迟到reject未污染新页面')

        page.evaluate('() => {BJ.ctx.config.llm.enabled=false;window.disabledCalls=0;BJ.ctx.llm.rerank=()=>{window.disabledCalls++;throw Error()};}')
        page.goto(url + '#/events/ai-agent-night/match')
        phase('local')
        page.wait_for_timeout(250)
        assert page.evaluate('window.disabledCalls') == 0
        page.evaluate('() => {BJ.ctx.config.llm.enabled=true;BJ.ctx.llm.rerank=window.originalRerank;}')
        report['checks'].append('关闭LLM时页面连rerank函数也不调用')

        # Stop our own process, then use the already loaded application to re-enter.
        page.goto(url + '#/events')
        process.terminate()
        process.wait(timeout=10)
        page.goto(url + '#/events/ai-agent-night/match')
        phase('failed')
        expect(page.locator('[data-engine]')).to_have_text('本地规则计算（推荐服务未响应）')
        shot('http-06-server-stopped')
        page.set_viewport_size({'width': 1024, 'height': 900})
        shot('http-07-1024')
        report['checks'].append('真实停止本脚本启动的server后再进入匹配页，网络失败保留本地结果')

        offline = browser.new_page(viewport={'width': 1440, 'height': 1000})
        offline.on('pageerror', lambda error: report['errors'].append(str(error)))
        requests = []
        offline.on('request', lambda r: requests.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
        offline.goto((ROOT / 'index.html').as_uri() + '#/events/ai-agent-night/match')
        offline.locator('.match-row').first.wait_for()
        expect(offline.locator('[data-engine]')).to_have_text('本地规则计算（未连接推荐服务）')
        offline.wait_for_timeout(400)
        assert not requests
        offline.screenshot(path=str(OUT / 'file-local.png'), full_page=True)
        offline.goto((ROOT / 'index.html').as_uri() + '#/events/ai-agent-night/join')
        offline.locator('[data-next]').click()
        offline.locator('#intent-text').fill('找全职CTO，负责端侧推理。我提供客户渠道')
        expect(offline.locator('[data-intent-engine]')).to_have_text('意图由本地规则解析')
        expect(offline.locator('.join-parsed-tags')).to_contain_text('端侧推理')
        report['checks'].append('file无HTTP请求；意图解析标注本地引擎并保留技术标签')
        assert not page.evaluate('window.unhandled'), page.evaluate('window.unhandled')
        assert not report['errors'], report['errors']
        browser.close()
    (ROOT / 'docs/browser-round4.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
finally:
    if process.poll() is None:
        process.terminate()
        process.wait(timeout=10)
    logfile.close()
    if blocker:
        blocker.close()
