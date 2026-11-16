import type { Locator, Page } from '@playwright/test';
import { PILL_4 } from './ha-setup';
import { expect, openView, test } from './fixtures';

type Config = Record<string, unknown> & { entities: unknown[] };

const dialogConfig = (page: Page): Promise<Config> =>
  page
    .locator('hui-dialog-edit-card')
    .evaluate((d) => (d as HTMLElement & { _cardConfig: Config })._cardConfig);

async function openEditor(page: Page): Promise<Locator> {
  await openView(page, '/cc-masonry/main?edit=1', 3);
  await page
    .getByRole('button', { name: /^edit$/i })
    .first()
    .click();
  const editor = page.locator('curtain-control-card-editor');
  await expect(editor.locator('ha-form').first()).toBeVisible();
  return editor;
}

async function pickTheme(page: Page, editor: Locator, legacy: boolean, label: string) {
  if (legacy) {
    await editor.locator('ha-selector-select').nth(1).locator('ha-select').click();
    await page.getByRole('option', { name: label }).click();
  } else {
    await editor.getByText(label, { exact: true }).click();
  }
}

test.describe('visual editor', () => {
  test('both sections render with the HA names as placeholders', async ({ page }) => {
    const editor = await openEditor(page);
    await expect(editor.locator('ha-form-expandable')).toHaveCount(2);
    await expect(editor.getByText('Curtains', { exact: true }).first()).toBeVisible();
    await expect(editor.getByText('Appearance', { exact: true })).toBeVisible();
    const names = editor.locator('ha-form-expandable').first().locator('ha-selector-text');
    await expect(names).toHaveCount(PILL_4.length);
    const placeholder = await names
      .first()
      .locator('input')
      .evaluate((i) => (i as HTMLInputElement).placeholder);
    expect(placeholder).toBe('Living left');
  });

  test('edits reach the config; defaults are not written; YAML-only keys survive', async ({
    page,
    target,
  }) => {
    const editor = await openEditor(page);
    await editor.getByText('Appearance', { exact: true }).click();

    await pickTheme(page, editor, target.legacy, 'Dark');
    await expect.poll(async () => (await dialogConfig(page)).theme).toBe('dark');
    let config = await dialogConfig(page);
    expect(config.yaml_only).toBe('kept');
    expect('style' in config).toBe(false);
    expect('height' in config).toBe(false);

    await pickTheme(page, editor, target.legacy, 'Auto (HA theme)');
    await expect.poll(async () => 'theme' in (await dialogConfig(page))).toBe(false);

    await editor.locator('ha-selector-text').first().locator('input').fill('Left');
    await expect
      .poll(async () => (await dialogConfig(page)).entities[0])
      .toEqual({ entity: PILL_4[0], name: 'Left' });

    config = await dialogConfig(page);
    expect(config).toEqual({
      type: 'custom:curtain-control-card',
      entities: [{ entity: PILL_4[0], name: 'Left' }, ...PILL_4.slice(1)],
      yaml_only: 'kept',
    });
  });

  test('adding a cover through the picker appends it', async ({ page, target }) => {
    const editor = await openEditor(page);
    const picker = editor.locator('ha-entities-picker');
    if (target.legacy) {
      const input = picker.locator('ha-entity-picker').last().locator('input');
      await input.fill('Hall Window');
      await page
        .getByRole('option', { name: /Hall Window/ })
        .first()
        .click();
    } else {
      await picker.getByRole('button', { name: /add entity/i }).click();
      await page.keyboard.type('Hall Window');
      await page
        .getByRole('option', { name: /Hall Window/ })
        .first()
        .click();
    }
    await expect
      .poll(async () => (await dialogConfig(page)).entities)
      .toEqual([...PILL_4, 'cover.hall_window']);
    await expect(
      editor.locator('ha-form-expandable').first().locator('ha-selector-text'),
    ).toHaveCount(PILL_4.length + 1);
  });
});
