import { DEFAULTS } from '../config';
import { NAME_FIELD } from '../model/editor-form';

export type EditorText =
  | 'editor.curtains'
  | 'editor.appearance'
  | 'editor.style_pill'
  | 'editor.style_fabric'
  | 'editor.theme_auto'
  | 'editor.theme_light'
  | 'editor.theme_dark'
  | 'editor.accent_placeholder';

export interface FormField {
  name: string;
  /** ha-form shows `default` as the placeholder of an optional field; it is never written. */
  default?: string;
  selector: Record<string, unknown>;
}

export interface FormSection {
  type: 'expandable';
  name: '';
  flatten: true;
  expanded?: boolean;
  title: string;
  schema: FormField[];
}

/** ha-form schema: Curtains (picker + a name per cover) and Appearance. */
export function editorSchema(
  entityIds: readonly string[],
  haNames: Readonly<Record<string, string>>,
  t: (key: EditorText) => string,
): FormSection[] {
  const select = (options: [string, EditorText][]) => ({
    select: { mode: 'box', options: options.map(([value, key]) => ({ value, label: t(key) })) },
  });
  return [
    {
      type: 'expandable',
      name: '',
      flatten: true,
      expanded: true,
      title: t('editor.curtains'),
      schema: [
        {
          name: 'entity_ids',
          selector: { entity: { multiple: true, filter: { domain: 'cover' } } },
        },
        ...[...new Set(entityIds)].map((id) => ({
          name: `${NAME_FIELD}${id}`,
          default: haNames[id] ?? id,
          selector: { text: {} },
        })),
      ],
    },
    {
      type: 'expandable',
      name: '',
      flatten: true,
      title: t('editor.appearance'),
      schema: [
        {
          name: 'style',
          selector: select([
            ['pill', 'editor.style_pill'],
            ['fabric', 'editor.style_fabric'],
          ]),
        },
        {
          name: 'theme',
          selector: select([
            ['auto', 'editor.theme_auto'],
            ['light', 'editor.theme_light'],
            ['dark', 'editor.theme_dark'],
          ]),
        },
        { name: 'height', default: DEFAULTS.height, selector: { text: {} } },
        { name: 'accent', default: t('editor.accent_placeholder'), selector: { text: {} } },
      ],
    },
  ];
}
