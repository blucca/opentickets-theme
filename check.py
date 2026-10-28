"""Small browser acceptance check. Run with Python + Playwright + Chromium.

    python check.py --screenshots /path/to/temp/screenshots

No payment is initiated: booking is checked by its destination only.
"""
import argparse
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
from threading import Thread

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


async def check(origin, screenshots):
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=shutil.which('chromium'),
                                          args=['--disable-dev-shm-usage'])
        try:
            page = await browser.new_page(viewport={'width': 1440, 'height': 1000})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))

            async def open_page(filename, label):
                await page.goto(f'{origin}/{filename}', wait_until='load')
                await page.evaluate('document.fonts.ready')
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), filename
                # Full-page captures include offscreen cards and inactive slides.
                await page.locator('img').evaluate_all('async xs => { for (const x of xs) x.loading = "eager"; await Promise.all(xs.map(x => x.decode())); }')
                assert await page.locator('img').evaluate_all('(xs) => xs.every(x => x.complete && x.naturalWidth > 0)'), filename
                if screenshots:
                    await page.screenshot(path=str(screenshots / f'{label}.png'), full_page=True)

            count = "Isotope.data(document.getElementById('events-grid')).filteredItems.length"
            await open_page('index.html', 'home-desktop')
            assert await page.evaluate(count) == 11
            for query, expected in [('APPEL', 1), ('boardwalk', 1), ('fixture-no-event', 0), ('ab', 11), ('', 11)]:
                await page.evaluate('(q) => window.dispatchEvent(new CustomEvent("filter-grid", {detail: q}))', query)
                assert await page.evaluate(count) == expected, query
            await page.get_by_role('button', name='Next featured event', exact=True).click()
            assert await page.locator('[data-featured-name]').inner_text() == 'Going Back West'
            await page.get_by_role('button', name='Previous featured event', exact=True).click()
            await page.locator('#nav-search-input').fill('Appel')
            await page.locator('#nav-search-input').press('Enter')
            await page.wait_for_url('**/search.html?q=Appel')
            assert await page.evaluate(count) == 1
            await open_page('search.html?q=Appel', 'search-desktop')
            await open_page('event.html', 'event-desktop')
            assert await page.locator('.ticket-price').all_text_contents() == ['R 250.00', 'R 250.00']
            assert await page.get_by_role('link', name='Book now').get_attribute('href') == 'https://opentickets.co.za/event/01ktvcz2dxv10rs7cvq0q9tc0v'
            await open_page('faqs.html', 'faqs-desktop')
            assert await page.locator('.faq-item').count() == 19
            await page.locator('.faq-category[data-category="football"]').click()
            assert await page.locator('.faq-group:not([hidden]) .faq-item').count() == 4

            await page.set_viewport_size({'width': 390, 'height': 844})
            await open_page('index.html', 'home-mobile')
            await page.get_by_role('button', name='Toggle navigation').click()
            assert await page.locator('.main-nav').is_visible()
            await page.get_by_role('button', name='Toggle navigation').click()
            await open_page('event.html', 'event-mobile')
            assert not errors, errors
            print('PASS: 4 pages, original Isotope contract, 19 FAQs, original prices/booking link, desktop + mobile.')
        finally:
            await browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshots', type=Path)
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        asyncio.run(check(f'http://127.0.0.1:{server.server_port}', args.screenshots))
    finally:
        server.shutdown()
        server.server_close()
