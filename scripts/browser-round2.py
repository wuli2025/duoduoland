"""Real Chromium checks for file and HTTP; no credentials inspected."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/screenshots/round-2'
OUT.mkdir(parents=True, exist_ok=True)
report = {'checks': [], 'engines': {}, 'page_errors': [], 'screenshots': []}


def record(name):
    report['checks'].append(name)
    print('PASS', name, flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for mode, base in [('file', (ROOT / 'index.html').as_uri()), ('http', 'http://127.0.0.1:8787/')]:
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: report['page_errors'].append(str(e)))
        external = []
        page.on('request', lambda r: external.append(r.url) if r.url.startswith('https:') else None)
        page.goto(base + '#/events/ai-agent-night/match')
        page.locator('.match-row').first.wait_for()
        page.wait_for_function("!document.querySelector('[data-engine]').textContent.includes('正在连接')", timeout=125000)
        report['engines'][mode] = page.locator('[data-engine]').inner_text()
        if mode == 'file':
            expect(page.locator('[data-engine]')).to_have_text('本地规则计算（未连接推荐服务）')
        assert not external, external
        names = page.locator('.match-row h3').all_text_contents()
        assert all('版' not in name for name in names)
        page.wait_for_timeout(350)
        photos = page.locator('.match-row .avatars img').evaluate_all('''images => images.map(img => ({
          src: img.getAttribute('src'), loaded: img.naturalWidth > 0,
          opacity: getComputedStyle(img).opacity, parent: img.parentElement.className
        }))''')
        assert all(photo['loaded'] and photo['opacity'] == '1' for photo in photos), photos
        assert len(set(photo['src'] for photo in photos)) == len(photos)
        if '周蔓' in names:
            img = page.locator('.match-row', has=page.get_by_role('heading', name='周蔓', exact=True)).locator('img')
            assert img.evaluate('(img) => img.naturalWidth === 512 && getComputedStyle(img).opacity === "1"')
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        shot = f'match-{mode}-1440.png'
        page.screenshot(path=str(OUT / shot), full_page=True)
        report['screenshots'].append(shot)
        record(mode + ': matching, engine label, unique loaded photos, no version labels')
        # Freeze remote calls during interaction assertions, while preserving initial real HTTP evidence.
        page.evaluate('BJ.config.llm.enabled = false')
        before = page.evaluate('''() => {
          const id = BJ.ctx.service.rank('ai-agent-night')[0].id;
          return {id, score: BJ.ctx.service.rank('ai-agent-night').find(r=>r.id===id).score};
        }''')
        page.keyboard.press('h')
        assert page.evaluate('BJ.ctx.store.get().greeted.length') == 1
        expect(page.locator('.match-detail [data-person-action="greet"]')).to_contain_text('已打招呼')
        page.keyboard.press('m')
        expect(page.locator('.match-detail [data-person-action="met"]')).to_contain_text('已见面')
        assert page.evaluate('''() => {
          const id = BJ.ctx.store.get().greeted[0];
          const row = BJ.ctx.service.rank('ai-agent-night', {limit:60}).find(r=>r.id===id);
          return row.factors.fresh === .15;
        }''')
        record(mode + ': greeting and meeting recompute current list and details')
        page.set_viewport_size({'width': 1024, 'height': 900})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        shot = f'match-{mode}-1024.png'
        page.screenshot(path=str(OUT / shot), full_page=True)
        report['screenshots'].append(shot)
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.goto(base + '#/jobs')
        page.locator('.jobs-row').first.wait_for()
        count = page.locator('.jobs-row').count()
        expect(page.locator('.jobs-total')).to_contain_text(str(count))
        assert count == 10
        page.locator('[name="job-city"]').select_option('')
        expect(page.locator('.jobs-row')).to_have_count(16)
        expect(page.locator('.jobs-total')).to_contain_text('16')
        scores = page.locator('.jobs-fit b').all_text_contents()
        assert len(set(scores)) > 2
        page.wait_for_function("Array.from(document.querySelectorAll('.avatars img')).every(img => img.complete && img.naturalWidth > 0)")
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUT / f'jobs-{mode}.png'), full_page=True)
        report['screenshots'].append(f'jobs-{mode}.png')
        page.locator('[data-job="job-01"]').first.click()
        page.locator('[data-job-apply]').click()
        assert page.evaluate('''JSON.stringify(BJ.ctx.store.get().applications['job-01'].profile) ===
          JSON.stringify(BJ.ctx.service.careerProjection().profile)''')
        page.keyboard.press('Escape')
        record(mode + ': 10 Shanghai / 16 total jobs, differentiated scores, projection snapshot')
        page.goto(base + '#/me')
        page.locator('.cards-version').first.wait_for()
        icons = page.locator('.cards-version[data-version]:not([data-version="base"]) svg').evaluate_all('els=>els.map(el=>el.innerHTML)')
        assert len(set(icons)) == 4
        page.wait_for_function("Array.from(document.querySelectorAll('.avatars img')).every(img => img.complete && img.naturalWidth > 0)")
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUT / f'cards-{mode}.png'), full_page=True)
        report['screenshots'].append(f'cards-{mode}.png')
        page.goto(base + '#/discover')
        page.locator('.discover-person').first.wait_for()
        # XSS must be text, never executable markup, in match/card components.
        escaped = page.evaluate('BJ.ctx.ui.e("<img src=x onerror=alert(1)>")')
        assert escaped.startswith('&lt;img')
        record(mode + ': distinct version icons, discovery renders, text escaping')
        page.keyboard.press('Control+k')
        page.locator('#command-query').fill('帮我找 3 个在上海做跨境电商的创始人')
        expect(page.locator('.command-result[data-type="0"]')).to_have_count(3)
        page.keyboard.press('Enter')
        expect(page.locator('.modal .person-card')).to_be_visible()
        assert page.locator('.modal .person-card-role').inner_text()
        record(mode + ': global search crosses event pools using public projections')
        page.close()
    assert not report['page_errors'], report['page_errors']
    (ROOT / 'docs/browser-round2.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    browser.close()
print(json.dumps(report, ensure_ascii=False, indent=2))
