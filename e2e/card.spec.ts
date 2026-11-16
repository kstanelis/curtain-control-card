import type { Locator, Page } from '@playwright/test';
import { DEMO_MOVING, PILL_4, masonry } from './ha-setup';
import { expect, position, setCalls, setPosition, test, trackPoint } from './fixtures';

const MAIN = '/cc-masonry/main';

const rowsOf = async (card: Locator): Promise<number> =>
  card
    .locator('.column')
    .evaluateAll(
      (cols) => new Set(cols.map((c) => Math.round(c.getBoundingClientRect().top))).size,
    );

test.describe('card on a dashboard', () => {
  test('renders 4, 8 and 1 columns; 8 at Masonry width wrap into 2 rows', async ({ openView }) => {
    const cards = await openView(MAIN, 3);
    await expect(cards.nth(0).locator('.column')).toHaveCount(4);
    await expect(cards.nth(1).locator('.column')).toHaveCount(8);
    await expect(cards.nth(2).locator('.column')).toHaveCount(1);
    expect(await rowsOf(cards.nth(0))).toBe(1);
    expect(await rowsOf(cards.nth(1))).toBe(2);
  });

  test('tap at the middle sends one set_cover_position 50 and the cover gets there', async ({
    page,
    ha,
    calls,
    openView,
  }) => {
    const id = PILL_4[0];
    await setPosition(ha, id, 100);
    const cards = await openView(MAIN, 3);
    calls.length = 0;
    const p = await trackPoint(cards.nth(0).locator('.track').first(), 0.5);
    await page.mouse.click(p.x, p.y);
    await expect
      .poll(async () => (await ha.states())['input_number.cc_living_left_position']?.state)
      .toBe('50.0');
    expect(setCalls(calls, id).map((c) => c.data.position)).toEqual([50]);
  });

  test('drag sends exactly one call, with the value shown at release', async ({
    page,
    ha,
    calls,
    openView,
  }) => {
    const id = PILL_4[1];
    await setPosition(ha, id, 0);
    const cards = await openView(MAIN, 3);
    calls.length = 0;
    const track = cards.nth(0).locator('.track').nth(1);
    const from = await trackPoint(track, 0.9);
    const to = await trackPoint(track, 0.25);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    const shown = Number(
      (await cards.nth(0).locator('.readout').nth(1).innerText()).replace(/\D/g, ''),
    );
    await page.mouse.up();
    await expect.poll(() => position(ha, id)).toBe(shown);
    expect(setCalls(calls, id).map((c) => c.data.position)).toEqual([shown]);
    expect(shown).toBeGreaterThan(65);
  });

  test('open, stop and close call their services', async ({ ha, calls, openView }) => {
    const id = PILL_4[3];
    const cards = await openView(MAIN, 3);
    const column = cards.nth(0).locator('.column').nth(3);
    calls.length = 0;
    try {
      for (const action of ['open', 'stop', 'close']) {
        await column.locator(`button.${action}`).click();
      }
      await expect
        .poll(() => calls.filter((c) => c.data.entity_id === id).map((c) => c.service))
        .toEqual(['open_cover', 'stop_cover', 'close_cover']);
    } finally {
      await setPosition(ha, id, 40);
    }
  });

  test('a cover without position support is read-only: no handle, not focusable', async ({
    openView,
  }) => {
    const cards = await openView('/cc-masonry/edge', 1);
    const column = cards.locator('.column').first();
    await expect(column).toHaveClass(/readonly/);
    await expect(column.locator('.handle, .fabric-edge')).toHaveCount(0);
    await expect(column.locator('.track')).toHaveAttribute('aria-readonly', 'true');
    await expect(column.locator('.track')).not.toHaveAttribute('tabindex', /.*/);
    await expect(column.locator('.readout')).toHaveText('Open');
    await expect(column.locator('button.stop')).toBeEnabled();
  });

  test('an unavailable cover shows a dash and disabled controls', async ({ ha, openView }) => {
    const cards = await openView('/cc-masonry/edge', 1);
    const column = cards.locator('.column').nth(1);
    await ha.service('input_boolean', 'turn_off', {
      entity_id: 'input_boolean.cc_bedroom_available',
    });
    try {
      await expect(column).toHaveClass(/unavailable/);
      await expect(column.locator('.readout')).toHaveText('—');
      for (const b of await column.locator('button:not(.name)').all())
        await expect(b).toBeDisabled();
    } finally {
      await ha.service('input_boolean', 'turn_on', {
        entity_id: 'input_boolean.cc_bedroom_available',
      });
    }
    await expect(column).not.toHaveClass(/unavailable/);
  });

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`a moving cover shows the indicator (${reducedMotion})`, async ({
      page,
      ha,
      openView,
    }) => {
      await page.emulateMedia({ reducedMotion });
      await setPosition(ha, DEMO_MOVING, 0);
      const cards = await openView('/cc-masonry/edge', 1);
      const column = cards.locator('.column').nth(2);
      try {
        await column.locator('button.open').click();
        const indicator = column.locator('svg.moving');
        await expect(indicator).toBeVisible();
        await page.waitForTimeout(400);
        const running = await cards.evaluate(
          (el) =>
            el.shadowRoot?.getAnimations().filter((a) => a.playState === 'running').length ?? -1,
        );
        if (reducedMotion === 'reduce') {
          expect(running).toBe(0);
          await expect(indicator).not.toHaveAttribute('data-pulse');
        } else {
          expect(running).toBeGreaterThan(0);
          await expect(indicator).toHaveAttribute('data-pulse');
        }
      } finally {
        await ha.service('cover', 'stop_cover', { entity_id: DEMO_MOVING });
        await setPosition(ha, DEMO_MOVING, 0);
      }
    });
  }
});

const THEMES = [
  { name: 'ha-light', selected: { theme: 'default', dark: false }, auto: 'ha' },
  { name: 'ha-dark', selected: { theme: 'default', dark: true }, auto: 'ha' },
  { name: 'nord', selected: { theme: 'Nord', dark: false }, auto: '#2e3440' },
] as const;

const cardToken = (card: Locator, name: string) =>
  card
    .locator('ha-card')
    .evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim().toLowerCase(), name);

async function useTheme(page: Page, selected: object): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('selectedTheme', value);
  }, JSON.stringify(selected));
}

test.describe('themes', () => {
  for (const theme of THEMES) {
    test(`dark, light and auto under ${theme.name}`, async ({ page, openView, target }) => {
      await useTheme(page, theme.selected);
      const cards = await openView('/cc-masonry/themes', 3);
      await page.waitForTimeout(500);
      expect(await cardToken(cards.nth(0), '--cc-card')).toBe('#1c1c1c');
      expect(await cardToken(cards.nth(1), '--cc-card')).toBe('#ffffff');
      const auto = await cardToken(cards.nth(2), '--cc-card');
      const haCard = await cardToken(cards.nth(2), '--card-background-color');
      expect(auto).toBe(theme.auto === 'ha' ? haCard : theme.auto);
      await page.screenshot({
        path: `e2e-screenshots/${target.name}-themes-${theme.name}.png`,
      });
    });
  }

  test('main view screenshots in both styles, light and dark', async ({
    page,
    openView,
    target,
  }) => {
    for (const theme of THEMES.slice(0, 2)) {
      await useTheme(page, theme.selected);
      await openView(MAIN, 3);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `e2e-screenshots/${target.name}-main-${theme.name}.png` });
    }
  });
});

test.describe('Sections dashboard', () => {
  test('cards fill their cell at full and half width; layout is grid', async ({ openView }) => {
    const cards = await openView('/cc-sections/grid', 2);
    const sizes = await cards.evaluateAll((els) =>
      els.map((el) => {
        const host = el.getBoundingClientRect();
        const card = el.shadowRoot?.querySelector('ha-card')?.getBoundingClientRect();
        return {
          layout: (el as HTMLElement & { layout?: string }).layout,
          w: host.width,
          h: host.height,
          cardH: card?.height ?? 0,
        };
      }),
    );
    for (const s of sizes) {
      expect(s.layout).toBe('grid');
      expect(s.h).toBeGreaterThan(300);
      expect(Math.abs(s.cardH - s.h)).toBeLessThan(2);
    }
    const [full, half] = sizes as [(typeof sizes)[0], (typeof sizes)[0]];
    expect(full.w / half.w).toBeGreaterThan(1.8);
    expect(full.w / half.w).toBeLessThan(2.3);
    await expect(cards.nth(1).locator('.column')).toHaveCount(4);
  });
});

test.describe('open items', () => {
  test('content-sized heights settle: no resize loop', async ({ page, openView }) => {
    const cards = await openView('/cc-masonry/auto-height', 2);
    await page.waitForTimeout(500);
    const samples: string[] = [];
    for (let i = 0; i < 10; i++) {
      samples.push(
        JSON.stringify(
          await cards.evaluateAll((els) =>
            els.map((el) => [
              Math.round(el.getBoundingClientRect().height),
              el.shadowRoot?.querySelector('.column')?.className,
            ]),
          ),
        ),
      );
      await page.waitForTimeout(200);
    }
    expect(new Set(samples).size, samples.join('\n')).toBe(1);
  });

  test('a registry rename reaches the card without a reload', async ({ ha, openView }) => {
    const id = PILL_4[2];
    const cards = await openView(MAIN, 3);
    const name = cards.nth(0).locator('.column').nth(2).locator('button.name');
    await expect(name).toHaveText('Bedroom');
    await ha.call({
      type: 'config/entity_registry/update',
      entity_id: id,
      name: 'Renamed bedroom',
    });
    try {
      await expect(name).toHaveText('Renamed bedroom');
    } finally {
      await ha.call({ type: 'config/entity_registry/update', entity_id: id, name: null });
    }
    await expect(name).toHaveText('Bedroom');
  });

  test('a dashboard saved elsewhere mid-drag: HA swaps the card, nothing is sent', async ({
    page,
    ha,
    calls,
    openView,
  }) => {
    const cards = await openView(MAIN, 3);
    const first = cards.nth(0);
    await first.evaluate((el) => {
      (el as HTMLElement & { ccProbe?: boolean }).ccProbe = true;
    });
    calls.length = 0;
    const from = await trackPoint(first.locator('.track').first(), 0.5);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y - 40, { steps: 4 });
    await expect(first.locator('.column').first()).toHaveClass(/dragging/);
    const config = masonry();
    const main = config.views[0];
    main.cards[0] = { ...main.cards[0], entities: [...PILL_4].reverse() } as (typeof main.cards)[0];
    await ha.call({ type: 'lovelace/config/save', url_path: 'cc-masonry', config });
    try {
      await expect(first.locator('button.name').first()).toHaveText('Kitchen blind');
      // A new element: HA never calls setConfig on a card mid-drag (unit tests cover that path).
      expect(
        await first.evaluate((el) => (el as HTMLElement & { ccProbe?: boolean }).ccProbe),
      ).toBeUndefined();
      await page.mouse.up();
      await page.waitForTimeout(1000);
      expect(setCalls(calls)).toEqual([]);
      await expect(first.locator('.dragging')).toHaveCount(0);
    } finally {
      await ha.call({ type: 'lovelace/config/save', url_path: 'cc-masonry', config: masonry() });
    }
  });
});

test('card picker suggests curtain covers (latest HA)', async ({ page, target }) => {
  test.skip(target.legacy, 'checked on the latest release only');
  await page.goto(`${MAIN}?edit=1`);
  await expect(page.locator('curtain-control-card').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /add card/i }).click();
  await page.getByRole('tab', { name: 'By card' }).click();
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill('Curtain control');
  const preview = page.locator('hui-card-picker curtain-control-card').first();
  await expect(preview.locator('.column').first()).toBeVisible();
  const names = await preview.locator('button.name').allInnerTexts();
  expect(names.length).toBeGreaterThan(0);
  expect(['Living left', 'Living right', 'Bedroom']).toContain(names[0]);
});
