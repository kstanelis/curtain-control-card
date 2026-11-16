// Shelly Wall Display X2 emulation: 1440×720, touch, Android WebView user agent.
import type { CDPSession, Locator, Page } from '@playwright/test';
import { PILL_4 } from './ha-setup';
import { expect, openView, position, setCalls, setPosition, test, trackPoint } from './fixtures';

const VIEW = '/cc-masonry/shelly';

interface Point {
  x: number;
  y: number;
}

/** Every scroll offset on the page, shadow roots included. */
const scrollOffsets = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const out: string[] = [`window:${String(window.scrollX)},${String(window.scrollY)}`];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.scrollTop || el.scrollLeft) {
          out.push(`${el.localName}:${String(el.scrollLeft)},${String(el.scrollTop)}`);
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return out.join(' ');
  });

/** A real touch gesture through the DevTools protocol, so the browser can choose to scroll. */
async function touchDrag(cdp: CDPSession, [first, ...rest]: [Point, ...Point[]]): Promise<void> {
  const touch = (p: Point) => [{ x: p.x, y: p.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(first) });
  for (const p of rest) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(p) });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

function line(from: Point, to: Point, steps: number): [Point, ...Point[]] {
  const at = (i: number) => ({
    x: from.x + ((to.x - from.x) * i) / steps,
    y: from.y + ((to.y - from.y) * i) / steps,
  });
  return [from, ...Array.from({ length: steps }, (_, i) => at(i + 1))];
}

async function scrollable(page: Page, cards: Locator): Promise<void> {
  // The page must be able to scroll, or "nothing scrolled" proves nothing.
  const bottom = Math.max(
    ...(await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().bottom))),
  );
  expect(bottom).toBeGreaterThan(page.viewportSize()?.height ?? 720);
}

test.describe('Shelly Wall Display X2 emulation', () => {
  test('touch tap sets the position with one command', async ({ page, ha, calls }) => {
    await setPosition(ha, PILL_4[0], 0);
    const cards = await openView(page, VIEW, 8);
    calls.length = 0;
    const p = await trackPoint(cards.first().locator('.track').first(), 0.5);
    await page.touchscreen.tap(p.x, p.y);
    await expect.poll(() => position(ha, PILL_4[0])).toBe(50);
    expect(setCalls(calls).map((c) => c.data.position)).toEqual([50]);
  });

  const gestures: [string, (from: Point, track: { w: number; h: number }) => Point][] = [
    ['straight up', (f, t) => ({ x: f.x, y: f.y - t.h * 0.5 })],
    ['diagonal', (f, t) => ({ x: f.x + t.w * 1.5, y: f.y - t.h * 0.4 })],
    ['leaving the track', (f, t) => ({ x: f.x - t.w * 2, y: f.y - t.h * 2 })],
  ];

  for (const [name, end] of gestures) {
    test(`touch drag ${name}: value set, one command, nothing scrolls`, async ({
      page,
      ha,
      calls,
    }) => {
      const id = PILL_4[1];
      await setPosition(ha, id, 0);
      const cards = await openView(page, VIEW, 8);
      await scrollable(page, cards);
      const track = cards.first().locator('.track').nth(1);
      const box = await track.boundingBox();
      if (!box) throw new Error('track not visible');
      const from = await trackPoint(track, 0.9);
      const before = await scrollOffsets(page);
      calls.length = 0;
      const cdp = await page.context().newCDPSession(page);
      await touchDrag(cdp, line(from, end(from, { w: box.width, h: box.height }), 20));
      await expect.poll(() => setCalls(calls).length).toBe(1);
      await page.waitForTimeout(500);
      expect(setCalls(calls)).toHaveLength(1);
      const sent = setCalls(calls)[0]?.data.position as number;
      expect(sent).toBeGreaterThan(30);
      await expect.poll(() => position(ha, id)).toBe(sent);
      expect(await scrollOffsets(page)).toBe(before);
    });
  }

  test('control: the same drag outside a slider does scroll the page', async ({ page }) => {
    const cards = await openView(page, VIEW, 8);
    await scrollable(page, cards);
    const vh = page.viewportSize()?.height ?? 720;
    const boxes = await cards
      .locator('button.name')
      .evaluateAll((els) =>
        els
          .map((el) => el.getBoundingClientRect())
          .map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })),
      );
    const from = boxes.find((b) => b.y > vh / 2 && b.y < vh - 20);
    if (!from) throw new Error('no name button in the lower half of the screen');
    const hit = await page.evaluate(({ x, y }) => {
      let el = document.elementFromPoint(x, y);
      while (el?.shadowRoot) {
        const inner = el.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === el) break;
        el = inner;
      }
      return el?.closest('.track') ? 'track' : (el?.localName ?? 'none');
    }, from);
    expect(hit).not.toBe('track');
    const before = await scrollOffsets(page);
    const cdp = await page.context().newCDPSession(page);
    await touchDrag(cdp, line(from, { x: from.x, y: from.y - 300 }, 20));
    await expect.poll(() => scrollOffsets(page)).not.toBe(before);
  });

  test('without color-mix the fallback tokens apply', async ({ page, target }) => {
    await page.addInitScript(() => {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (property: string, value?: string) =>
        `${property} ${value ?? ''}`.includes('color-mix')
          ? false
          : value === undefined
            ? supports(property)
            : supports(property, value);
    });
    const cards = await openView(page, VIEW, 8);
    const tokens = await cards
      .first()
      .locator('ha-card')
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return [
          '--cc-track',
          '--cc-button',
          '--cc-accent-text',
          '--cc-accent-tint',
          '--cc-on-accent',
          '--cc-window',
        ].map((n) => s.getPropertyValue(n).trim());
      });
    for (const t of tokens) {
      expect(t).not.toBe('');
      expect(t).not.toContain('color-mix');
    }
    await page.screenshot({ path: `e2e-screenshots/${target.name}-shelly-no-color-mix.png` });
  });
});
