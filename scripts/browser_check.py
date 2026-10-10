"""Open the file:// demo in Chromium, capture pages and exercise core journeys."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'screenshots'
OUT.mkdir(parents=True, exist_ok=True)
URL = (ROOT / 'index.html').as_uri()
report = {'pages': [], 'checks': [], 'page_errors': [], 'network_requests': []}


def record(name):
    report['checks'].append(name)
    print('PASS', name, flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    page = context.new_page()
    page.on('pageerror', lambda error: report['page_errors'].append(str(error)))
    page.on('request', lambda request: report['network_requests'].append(request.url)
            if request.url.startswith(('https:', 'http:')) else None)

    def go(route, selector=None):
        page.goto(URL + '#' + route)
        page.locator(selector or '#main h1, #main h2').first.wait_for()
        page.wait_for_timeout(200)

    def shot(name, width=1440):
        page.wait_for_timeout(250)
        overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
        assert not overflow, f'{name}: horizontal overflow at {width}'
        broken = page.locator('.media img').evaluate_all('''images => images.filter(img =>
          img.complete && !img.naturalWidth && getComputedStyle(img).opacity !== '0').length''')
        assert broken == 0, f'{name}: exposed broken image'
        page.screenshot(path=str(OUT / f'{name}-{width}.png'), full_page=page.locator('.modal').count() == 0)
        report['pages'].append({'page': name, 'width': width, 'overflow': overflow, 'broken_images': broken})

    go('/events')
    page.evaluate('localStorage.clear()')
    page.reload()
    page.locator('.events-grid').first.wait_for()
    shot('events')
    page.locator('[data-slide="1"]').click()
    expect(page.locator('.events-hero-copy h2')).to_contain_text('下一位伙伴')
    page.locator('[data-category="读书会"]').click()
    expect(page.locator('.events-section').first.locator('.event-card')).to_have_count(1)
    record('carousel and event category filtering')

    go('/events/founders-brunch')
    shot('event-detail')
    page.locator('.event-reservation a').first.click()
    page.locator('.join-layout').wait_for()
    shot('join-card')
    page.locator('[data-version="social"]').click()
    expect(page.locator('.join-preview .person-card-role')).to_have_text('上海')
    page.locator('[data-version="tech"]').click()
    page.locator('[data-next]').click()
    page.locator('#intent-text').fill('找上海的投资人、供应链专家。我能提供：产品经验')
    expect(page.locator('.join-parsed-tags')).to_contain_text('投资人')
    page.locator('[data-mic]').click()
    expect(page.locator('.join-wave')).to_be_visible()
    page.locator('[data-add-tag]').click()
    page.locator('.modal [name="tag"]').fill('工程师')
    page.locator('.modal form button[type="submit"]').click()
    expect(page.locator('.join-parsed-tags')).to_contain_text('工程师')
    page.locator('[data-remove-key="seekRoles"]').last.click()
    shot('join-intent')
    page.locator('[data-next]').click()
    page.locator('[name="publicIntent"]').uncheck()
    expect(page.locator('.join-preview')).to_contain_text('本场意图仅自己可见')
    shot('join-privacy')
    page.locator('[data-next]').click()
    page.locator('.match-row').first.wait_for()
    assert page.evaluate("BJ.ctx.store.get().participations['founders-brunch'].publicIntent") is False
    page.reload()
    page.locator('.match-row').first.wait_for()
    assert page.evaluate("BJ.ctx.store.get().participations['founders-brunch'].versionId") == 'tech'
    record('three-step join, editable parsed tags, microphone demo, privacy and persisted participation')

    go('/events/ai-agent-night/match', '.match-row')
    shot('match')
    initial = page.locator('.match-row h3').all_text_contents()
    assert all('版' not in name for name in initial)
    print('TOP5', initial, flush=True)
    page.keyboard.press('ArrowDown')
    expect(page.locator('[data-person-index="1"]')).to_have_class('match-row active')
    page.keyboard.press('h')
    expect(page.locator('.match-detail [data-person-action="greet"]')).to_contain_text('已打招呼')
    page.keyboard.press('m')
    expect(page.locator('.match-detail [data-person-action="met"]')).to_contain_text('已见面')
    page.locator('.match-detail [data-person-action="favorite"]').click()
    expect(page.locator('.match-detail [data-person-action="favorite"]')).to_have_attribute('aria-pressed', 'true')
    page.locator('[data-feedback="up"]').click()
    page.locator('[data-shuffle]').click()
    second = page.locator('.match-row h3').all_text_contents()
    assert not set(initial) & set(second)
    page.locator('[name="checkedOnly"]').check()
    page.locator('[name="mutualOnly"]').check()
    page.locator('#match-preference').fill('90')
    page.locator('[data-feedback="down"]').click()
    page.locator('[data-reason="0"]').click()
    assert page.evaluate("Object.values(BJ.ctx.store.get().feedback).some(x => x.type === 'down')")
    record('Top 5, keyboard actions, favorites, feedback, exclusion and live filters')

    go('/discover')
    shot('discover')
    page.locator('[data-discover-tab="2"]').click()
    expect(page.locator('.discover-person')).to_have_count(3)
    page.locator('[data-topic="设计"]').click()
    expect(page.locator('.empty-state')).to_be_visible()
    page.locator('[data-discover-reset]').click()
    record('discovery tabs, topic filtering and empty-state reset')

    go('/jobs')
    shot('jobs')
    page.locator('[name="job-city"]').select_option('')
    expect(page.locator('.jobs-row')).to_have_count(16)
    page.locator('#jobs-query').fill('高级 AI 产品经理')
    expect(page.locator('.jobs-row')).to_have_count(1)
    page.locator('.jobs-row-open').click()
    expect(page.locator('.jobs-detail-section')).to_have_count(3)
    shot('job-detail')
    page.locator('[data-job-apply]').click()
    expect(page.locator('[data-job-apply]')).to_be_disabled()
    assert page.evaluate("BJ.ctx.store.get().applications['job-01'].profile.contact === undefined")
    page.keyboard.press('Escape')
    page.locator('#jobs-query').fill('不存在的工作')
    expect(page.locator('.empty-state')).to_be_visible()
    page.locator('[data-reset-jobs]').click()
    record('16 job rows, search, detail, private-safe application and empty-state reset')

    go('/me')
    shot('cards')
    page.locator('[data-visible="company"]').uncheck()
    expect(page.locator('.cards-preview .person-card-role')).not_to_contain_text('知序科技')
    page.locator('#version-bio').fill('让好产品走进日常。')
    expect(page.locator('.person-card-bio')).to_contain_text('让好产品走进日常。')
    page.locator('[data-theme="sage"]').click()
    page.set_viewport_size({'width': 1440, 'height': 1400})
    page.evaluate('window.scrollTo(0, 0)')
    page.locator('[data-field="contact"]').drag_to(page.locator('[data-field="industry"]'))
    order_before = page.locator('[data-field]').evaluate_all('elements => elements.map(x => x.dataset.field)')
    assert order_before.index('contact') < order_before.index('industry')
    page.locator('[data-save-card]').click()
    page.reload()
    page.locator('.cards-fields').wait_for()
    order_after = page.locator('[data-field]').evaluate_all('elements => elements.map(x => x.dataset.field)')
    assert order_before == order_after
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.locator('[data-version="base"]').click()
    page.locator('[data-profile-field="city"]').fill('杭州')
    page.locator('[data-save-card]').click()
    assert page.evaluate("BJ.ctx.store.get().me.profile.city") == '杭州'
    shot('base-profile')
    page.locator('[data-new-card]').click()
    page.locator('.prompt-form input').fill('测试名片')
    page.locator('.prompt-form [type="submit"]').click()
    page.locator('[data-rename-card]').click()
    page.locator('.prompt-form input').fill('周末名片')
    page.locator('.prompt-form [type="submit"]').click()
    expect(page.locator('.cards-editor h2')).to_have_text('周末名片')
    page.locator('[data-share-card]').click()
    expect(page.locator('.demo-qr')).to_be_visible()
    shot('share')
    page.keyboard.press('Escape')
    page.locator('[data-delete-card]').click()
    page.locator('[data-confirm-delete]').click()
    page.locator('[data-save-card]').click()
    assert page.evaluate('BJ.ctx.store.get().me.versions.length') == 4
    record('card privacy, live preview, native drag/drop, base editing, save/reload, add/rename/delete/share')

    page.keyboard.press('Control+k')
    page.locator('#command-query').fill('帮我找 3 个在上海做跨境电商的创始人')
    expect(page.locator('.command-result[data-type="0"]')).to_have_count(3)
    shot('search')
    page.keyboard.press('Enter')
    expect(page.locator('.modal .person-card')).to_be_visible()
    page.keyboard.press('Escape')
    record('global Ctrl+K semantic search, Enter opens result, Escape closes')

    go('/live/ai-agent-night')
    shot('live')
    before = page.locator('.live-feed-items').inner_text()
    page.wait_for_timeout(4600)
    assert page.locator('.live-feed-items').inner_text() != before
    record('live display and anonymous feed animation')

    for route, name, selector in [
        ('/events', 'events', None),
        ('/events/ai-agent-night', 'event-detail', None),
        ('/events/ai-agent-night/join', 'join-card', None),
        ('/events/ai-agent-night/match', 'match', '.match-row'),
        ('/discover', 'discover', None),
        ('/jobs', 'jobs', None),
        ('/me', 'cards', None),
        ('/live/ai-agent-night', 'live', None),
    ]:
        page.set_viewport_size({'width': 1024, 'height': 900})
        go(route, selector)
        shot(name, 1024)
    record('all primary pages checked at 1024px without horizontal overflow')

    # Simulate missing files without touching the image task's files.
    page.set_viewport_size({'width': 1440, 'height': 1000})
    go('/discover')
    page.evaluate("""() => {
      BJ.config.assets.overrides['avatars/p01'] = 'assets/img/does-not-exist.jpg';
      BJ.ctx.router.refresh();
    }""")
    page.locator('.avatars.failed').first.wait_for()
    assert page.locator('.avatars.failed').evaluate_all('''elements => elements.every(el =>
      el.querySelector('.media-fallback').textContent === Array.from(el.getAttribute('aria-label'))[0])''')
    shot('missing-avatar')
    go('/events')
    page.evaluate("""() => {
      BJ.config.assets.overrides['events/e01'] = 'assets/img/does-not-exist.jpg';
      BJ.ctx.router.refresh();
    }""")
    page.locator('.event-card-cover.failed').first.wait_for()
    shot('missing-cover')
    record('forced missing avatar/cover fallbacks show initials or gray, no broken-image icon')

    go('/unknown', '.empty-state')
    expect(page.locator('.empty-state')).to_be_visible()
    assert not report['page_errors'], report['page_errors']
    assert not report['network_requests'], report['network_requests']
    record('zero JavaScript errors and zero network dependencies under file://')
    (ROOT / 'docs' / 'browser-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    browser.close()
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
