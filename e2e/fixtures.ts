import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { HaSocket, readAuth, targets, type HaEvent, type Target } from './ha';

export interface CoverCall {
  service: string;
  data: Record<string, unknown>;
}

interface Fixtures {
  target: Target & { haVersion: string; legacy: boolean };
  ha: HaSocket;
  /** cover.* service calls seen by HA since the test started. */
  calls: CoverCall[];
  /** Console errors and page errors; checked after each test. */
  consoleErrors: string[];
  /** Open a dashboard view and wait until every card has rendered its columns. */
  openView: (path: string, cards: number) => Promise<Locator>;
}

export const test = base.extend<Fixtures>({
  target: async ({}, use, info) => {
    const t = targets().find((x) => [x.name, `${x.name}-shelly`].includes(info.project.name));
    if (!t) throw new Error(`no HA target for project ${info.project.name}`);
    const { version } = readAuth(t);
    await use({ ...t, haVersion: version, legacy: version.startsWith('2024.') });
  },
  ha: async ({ target }, use) => {
    const ws = await HaSocket.open(target.url, readAuth(target).token);
    await use(ws);
    ws.close();
  },
  calls: async ({ ha }, use) => {
    const calls: CoverCall[] = [];
    await ha.subscribe('call_service', (e: HaEvent) => {
      if (e.data.domain === 'cover') {
        calls.push({
          service: e.data.service as string,
          data: e.data.service_data as Record<string, unknown>,
        });
      }
    });
    await use(calls);
  },
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error' && /curtain|cc-|custom element/i.test(m.text()))
          errors.push(m.text());
      });
      await use(errors);
      expect(errors, 'card errors in the console').toEqual([]);
    },
    { auto: true },
  ],
  openView: async ({ page }, use) => {
    await use(async (path, cards) => openView(page, path, cards));
  },
});

export async function openView(page: Page, path: string, cards: number): Promise<Locator> {
  await page.goto(path);
  const all = page.locator('curtain-control-card');
  await expect(all).toHaveCount(cards, { timeout: 30_000 });
  for (let i = 0; i < cards; i++) {
    await expect(all.nth(i).locator('.column, .hint').first()).toBeVisible();
  }
  // Masonry places cards after they render; wait until nothing moves any more.
  const rects = () =>
    all.evaluateAll((els) =>
      JSON.stringify(
        els.map((el) => el.getBoundingClientRect()).map((r) => [r.x, r.y, r.width, r.height]),
      ),
    );
  let last = '';
  await expect
    .poll(
      async () => {
        const now = await rects();
        const stable = now === last;
        last = now;
        return stable;
      },
      { intervals: [300] },
    )
    .toBe(true);
  return all;
}

/** Point on a track: `fromTop` 0 = top edge, 1 = bottom edge. */
export async function trackPoint(
  track: Locator,
  fromTop: number,
): Promise<{ x: number; y: number }> {
  const box = await track.boundingBox();
  if (!box) throw new Error('track not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height * fromTop };
}

export const position = async (ha: HaSocket, id: string): Promise<unknown> =>
  (await ha.states())[id]?.attributes.current_position;

/** Move a cover and wait until HA reports the new position. */
export async function setPosition(ha: HaSocket, id: string, value: number): Promise<void> {
  await ha.service('cover', 'set_cover_position', { entity_id: id, position: value });
  await expect.poll(() => position(ha, id), { timeout: 30_000 }).toBe(value);
}

export const setCalls = (calls: CoverCall[], id?: string): CoverCall[] =>
  calls.filter(
    (c) => c.service === 'set_cover_position' && (id === undefined || c.data.entity_id === id),
  );

export { expect };
