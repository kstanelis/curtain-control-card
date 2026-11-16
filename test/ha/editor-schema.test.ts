import { describe, expect, it } from 'vitest';
import { editorSchema, type EditorText } from '../../src/ha/editor-schema';

const t = (key: EditorText): string => `T(${key})`;

describe('editorSchema', () => {
  const schema = editorSchema(['cover.a', 'cover.a', 'cover.b'], { 'cover.a': 'Living left' }, t);
  const [curtains, appearance] = schema;

  it('two expandable, flattened sections; Curtains open', () => {
    expect(schema).toHaveLength(2);
    expect(curtains).toMatchObject({
      type: 'expandable',
      flatten: true,
      expanded: true,
      title: 'T(editor.curtains)',
    });
    expect(appearance).toMatchObject({
      type: 'expandable',
      flatten: true,
      title: 'T(editor.appearance)',
    });
  });

  it('cover picker, then one name field per distinct entity with the HA name as placeholder', () => {
    expect(curtains.schema).toEqual([
      {
        name: 'entity_ids',
        selector: { entity: { multiple: true, filter: { domain: 'cover' } } },
      },
      { name: 'name:cover.a', default: 'Living left', selector: { text: {} } },
      { name: 'name:cover.b', default: 'cover.b', selector: { text: {} } },
    ]);
  });

  it('appearance: style, theme, height, accent with option labels and placeholders', () => {
    expect(appearance.schema.map((f) => f.name)).toEqual(['style', 'theme', 'height', 'accent']);
    expect(appearance.schema[0].selector).toEqual({
      select: {
        mode: 'box',
        options: [
          { value: 'pill', label: 'T(editor.style_pill)' },
          { value: 'fabric', label: 'T(editor.style_fabric)' },
        ],
      },
    });
    expect(appearance.schema[1].selector).toEqual({
      select: {
        mode: 'box',
        options: [
          { value: 'auto', label: 'T(editor.theme_auto)' },
          { value: 'light', label: 'T(editor.theme_light)' },
          { value: 'dark', label: 'T(editor.theme_dark)' },
        ],
      },
    });
    expect(appearance.schema[2]).toEqual({
      name: 'height',
      default: '360px',
      selector: { text: {} },
    });
    expect(appearance.schema[3]).toEqual({
      name: 'accent',
      default: 'T(editor.accent_placeholder)',
      selector: { text: {} },
    });
  });
});
