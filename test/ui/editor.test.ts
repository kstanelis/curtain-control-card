import { afterEach, describe, expect, it } from 'vitest';
import '../../src/curtain-control-card';
import type { CurtainControlCardEditor } from '../../src/ui/editor';
import { fakeHass } from '../helpers/hass';

interface HaFormLike extends HTMLElement {
  data: Record<string, unknown>;
  schema: { title: string; schema: { name: string; default?: string }[] }[];
  computeLabel: (s: { name: string }) => string;
}

const hass = fakeHass({
  'cover.a': { attributes: { friendly_name: 'Living left' } },
  'cover.b': {},
});

async function editor(config: Record<string, unknown>) {
  const el = document.createElement('curtain-control-card-editor');
  el.hass = hass;
  el.setConfig({ type: 'custom:curtain-control-card', ...config });
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const form = (el: CurtainControlCardEditor): HaFormLike => {
  const f = el.shadowRoot?.querySelector<HaFormLike>('ha-form');
  if (!f) throw new Error('no ha-form');
  return f;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('curtain-control-card-editor', () => {
  it('the card hands HA this editor', () => {
    const Card = customElements.get('curtain-control-card') as unknown as {
      getConfigElement(): HTMLElement;
    };
    expect(Card.getConfigElement().localName).toBe('curtain-control-card-editor');
  });

  it('feeds ha-form the form data and a schema with HA names as placeholders', async () => {
    const el = await editor({ entities: ['cover.a', 'cover.b'], style: 'fabric' });
    const f = form(el);
    expect(f.data).toMatchObject({ entity_ids: ['cover.a', 'cover.b'], style: 'fabric' });
    expect(f.schema[0]?.title).toBe('Curtains');
    expect(f.schema[0]?.schema.map((s) => s.default)).toEqual([
      undefined,
      'Living left',
      'cover.b',
    ]);
  });

  it('labels fields from translations; name fields say which cover', async () => {
    const f = form(await editor({ entities: ['cover.a'] }));
    expect(f.computeLabel({ name: 'entity_ids' })).toBe('Curtains (up to 8)');
    expect(f.computeLabel({ name: 'style' })).toBe('Style');
    expect(f.computeLabel({ name: 'accent' })).toBe('Accent colour');
    expect(f.computeLabel({ name: 'name:cover.a' })).toBe('Name · cover.a');
    expect(f.computeLabel({ name: 'unknown' })).toBe('unknown');
  });

  it('keeps the same schema object while nothing it shows changed', async () => {
    const el = await editor({ entities: ['cover.a'] });
    const first = form(el).schema;
    el.hass = fakeHass({
      'cover.a': { state: 'opening', attributes: { friendly_name: 'Living left' } },
    });
    await el.updateComplete;
    expect(form(el).schema).toBe(first);
    el.hass = fakeHass({ 'cover.a': { attributes: { friendly_name: 'Renamed' } } });
    await el.updateComplete;
    expect(form(el).schema).not.toBe(first);
    expect(form(el).schema[0]?.schema[1]?.default).toBe('Renamed');
  });

  it('a value the card would reject is still passed on, so HA shows its error', async () => {
    const el = await editor({ entities: ['cover.a'] });
    const seen: unknown[] = [];
    el.addEventListener('config-changed', (e) => {
      seen.push((e as CustomEvent<{ config: unknown }>).detail.config);
    });
    form(el).dispatchEvent(
      new CustomEvent('value-changed', { detail: { value: { entity_ids: ['light.x'] } } }),
    );
    expect(seen).toEqual([{ type: 'custom:curtain-control-card', entities: ['light.x'] }]);
    await el.updateComplete;
    expect(form(el).data.entity_ids).toEqual(['cover.a']);
  });

  it('one entity with two names opens the code editor instead', () => {
    const el = document.createElement('curtain-control-card-editor');
    expect(() => {
      el.setConfig({
        type: 'custom:curtain-control-card',
        entities: [
          { entity: 'cover.a', name: 'One' },
          { entity: 'cover.a', name: 'Two' },
        ],
      });
    }).toThrow(/two different names/);
  });

  it('a form change fires config-changed with defaults left out and unknown keys kept', async () => {
    const el = await editor({ entities: ['cover.a'], foo: 1 });
    const seen: unknown[] = [];
    el.addEventListener('config-changed', (e) => {
      seen.push((e as CustomEvent<{ config: unknown }>).detail.config);
    });
    form(el).dispatchEvent(
      new CustomEvent('value-changed', {
        detail: {
          value: {
            entity_ids: ['cover.b', 'cover.a'],
            'name:cover.a': 'Left',
            style: 'pill',
            theme: 'dark',
          },
        },
        bubbles: true,
        composed: true,
      }),
    );
    expect(seen).toEqual([
      {
        type: 'custom:curtain-control-card',
        entities: ['cover.b', { entity: 'cover.a', name: 'Left' }],
        foo: 1,
        theme: 'dark',
      },
    ]);
    await el.updateComplete;
    expect(form(el).data).toMatchObject({ entity_ids: ['cover.b', 'cover.a'], theme: 'dark' });
  });

  it('an empty list is fine in the editor', async () => {
    const f = form(await editor({ entities: [] }));
    expect(f.data.entity_ids).toEqual([]);
  });

  it('a config the form cannot show throws, so HA falls back to the code editor', () => {
    const el = document.createElement('curtain-control-card-editor');
    expect(() => {
      el.setConfig({ type: 'x', entities: ['light.x'] });
    }).toThrow();
  });

  it('renders nothing until both hass and config are set', async () => {
    const el = document.createElement('curtain-control-card-editor');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('ha-form')).toBeNull();
  });
});
