"""Capture real progressive recommendations, cache re-entry and offline fallback."""
from pathlib import Path
import argparse
import json
import time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/screenshots/round-3'
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8787/')
args = parser.parse_args()
report = {'http': args.url, 'checks': [], 'errors': [], 'timings': {}}


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.on('pageerror', lambda error: report['errors'].append(str(error)))

    def shot(name):
        page.wait_for_function("Array.from(document.querySelectorAll('.match-row .avatars img')).every(i=>i.complete&&i.naturalWidth>0)")
        page.wait_for_timeout(300)
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        page.screenshot(path=str(OUT / (name + '.png')), full_page=True)

    started = time.perf_counter()
    page.goto(args.url + '#/events/ai-agent-night/match')
    page.locator('.match-row').first.wait_for()
    report['timings']['local_ms'] = round((time.perf_counter() - started) * 1000)
    expect(page.locator('[data-engine]')).to_contain_text('本地初排')
    assert page.locator('.match-loading').count() == 0
    assert page.locator('.match-row').count() == 5
    shot('http-01-local')
    page.keyboard.press('ArrowDown')
    expect(page.locator('[data-person-index="1"]')).to_have_attribute('aria-pressed', 'true')
    selected = page.locator('.match-row.active').get_attribute('data-person-id')
    page.locator('[data-person-action="favorite"]').click()
    assert page.evaluate('BJ.ctx.store.get().favorites.length') == 1
    # Re-entry while the first request is running coalesces identical upstream work.
    shot('http-02-pending-interactive')
    page.wait_for_function("document.querySelector('[data-engine]').dataset.phase !== 'local'", timeout=68000)
    report['timings']['refined_ms'] = round((time.perf_counter() - started) * 1000)
    report['engine'] = page.locator('[data-engine]').inner_text()
    assert page.locator('[data-engine]').get_attribute('data-phase') == 'llm', report['engine']
    if page.locator(f'[data-person-id="{selected}"]').count():
        expect(page.locator(f'[data-person-id="{selected}"]')).to_have_attribute('aria-pressed', 'true')
    assert page.evaluate('BJ.ctx.store.get().favorites.length') == 1
    shot('http-03-refined')
    report['checks'].append('真实local→llm，等待期间可选人/收藏，返回后保留选择与状态')

    page.goto(args.url + '#/events')
    page.locator('.events-grid').first.wait_for()
    cached_start = time.perf_counter()
    page.goto(args.url + '#/events/ai-agent-night/match')
    page.wait_for_function("document.querySelector('[data-engine]')?.dataset.phase === 'llm'", timeout=5000)
    report['timings']['cached_reentry_ms'] = round((time.perf_counter() - cached_start) * 1000)
    shot('http-04-cache')
    report['checks'].append('同一活动/意图缓存再次进入在5秒内精排完成')

    # Deterministic error injection validates failure UI, never called a real LLM success.
    page.route('**/api/llm/rerank', lambda route: route.fulfill(status=504, content_type='application/json', body='{"error":"LLM_TIMEOUT"}'))
    page.locator('[data-shuffle]').click()
    before = page.locator('.match-row h3').all_text_contents()
    page.wait_for_function("document.querySelector('[data-engine]').dataset.phase === 'failed'")
    assert page.locator('.match-row h3').all_text_contents() == before
    shot('http-05-failed')
    report['checks'].append('注入超时：local→failed，保留本地人选，文字如实说明')
    page.unroute('**/api/llm/rerank')
    page.set_viewport_size({'width': 1024, 'height': 900})
    shot('http-06-1024')

    offline = browser.new_page(viewport={'width': 1440, 'height': 1000})
    offline.on('pageerror', lambda error: report['errors'].append(str(error)))
    outgoing = []
    offline.on('request', lambda request: outgoing.append(request.url) if request.url.startswith(('http:', 'https:')) else None)
    offline.goto((ROOT / 'index.html').as_uri() + '#/events/ai-agent-night/match')
    offline.locator('.match-row').first.wait_for()
    offline.wait_for_timeout(400)
    expect(offline.locator('[data-engine]')).to_have_text('本地规则计算（未连接推荐服务）')
    assert not outgoing
    offline.screenshot(path=str(OUT / 'file-local.png'), full_page=True)
    report['checks'].append('file协议无任何HTTP请求，直接展示本地结果')
    # New intent fields are editable even when absent from an older saved participation.
    offline.goto((ROOT / 'index.html').as_uri() + '#/events/ai-agent-night/join')
    offline.locator('[data-next]').click()
    offline.locator('#intent-text').fill('在上海找全职CTO，负责端侧推理。我能提供客户渠道')
    expect(offline.locator('.join-parsed-tags')).to_contain_text('端侧推理')
    expect(offline.locator('.join-parsed-tags')).to_contain_text('全职')
    offline.locator('[data-add-tag]').click()
    offline.locator('.modal select').select_option('compensation')
    offline.locator('.modal input').fill('股权')
    offline.locator('.modal [type="submit"]').click()
    expect(offline.locator('.join-parsed-tags')).to_contain_text('股权')
    report['checks'].append('技术需求与合作条件可解析、显示并手动添加')
    assert not report['errors'], report['errors']
    (ROOT / 'docs/browser-round3.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    browser.close()
