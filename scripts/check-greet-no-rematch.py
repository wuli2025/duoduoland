"""Real-browser check: greeting / marking met must not trigger a new match.

Usage: py -3 scripts/check-greet-no-rematch.py http://127.0.0.1:8787
Counts POST /api/llm/rerank requests made by the page.
"""
import sys
from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787"
url = base + "/#/events/ai-agent-night/match"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1100})
    calls = []
    page.on("request", lambda r: calls.append(r.url) if "/api/llm/rerank" in r.url else None)
    page.goto(url)
    page.wait_for_selector(".match-layout:not([hidden]) [data-person-id]", timeout=120000)
    print("first result ready, rerank calls:", len(calls))
    before = page.inner_text(".match-list")

    page.click('[data-person-action="greet"]')
    page.wait_for_timeout(1500)
    print("after greet, thinking visible:", page.is_visible(".match-thinking-host:not([hidden])"))
    page.keyboard.press("m")
    page.wait_for_timeout(1500)
    page.click('a[href="#/discover"]')
    page.wait_for_timeout(800)
    page.goto(url)
    page.wait_for_selector(".match-layout:not([hidden]) [data-person-id]", timeout=120000)
    after = page.inner_text(".match-list")
    print("after greet + met + revisit, rerank calls:", len(calls))
    print("list unchanged:", before == after)
    page.screenshot(path="docs/review-shots/greet-no-rematch.png")
    browser.close()
