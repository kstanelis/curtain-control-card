// Playwright global setup: onboard each HA instance, register the card, create the test
// dashboards and save a browser login per instance.
import { copyFileSync, existsSync } from 'node:fs';
import { HaSocket, hassTokens, saveAuth, signIn, targets, type Target } from './ha';

export const PILL_4 = [
  'cover.cc_living_left',
  'cover.cc_living_right',
  'cover.cc_bedroom',
  'cover.cc_kitchen_blind',
];
export const DEMO_MOVING = 'cover.living_room_window';
export const ALL_8 = [
  ...PILL_4,
  'cover.cc_hall_readonly',
  DEMO_MOVING,
  'cover.hall_window',
  'cover.kitchen_window',
];
export const EDGE = [
  'cover.cc_hall_readonly',
  'cover.cc_bedroom',
  DEMO_MOVING,
  'cover.cc_kitchen_blind',
];

const card = (extra: Record<string, unknown>) => ({
  type: 'custom:curtain-control-card',
  ...extra,
});

/** Sections sizing: 2024.8 used a 4-column grid with `layout_options`, later 12 with `grid_options`. */
const span = (legacy: boolean, full: boolean) =>
  legacy
    ? { layout_options: { grid_columns: full ? 4 : 2 } }
    : { grid_options: { columns: full ? 12 : 6 } };

export function masonry() {
  return {
    views: [
      {
        title: 'Main',
        path: 'main',
        cards: [
          card({ entities: PILL_4, yaml_only: 'kept' }),
          card({ entities: ALL_8, style: 'fabric', height: '480px' }),
          card({ entities: ['cover.cc_living_right'], style: 'fabric' }),
        ],
      },
      {
        title: 'Themes',
        path: 'themes',
        cards: [
          card({ entities: PILL_4, theme: 'dark' }),
          card({ entities: PILL_4, theme: 'light' }),
          card({ entities: PILL_4, theme: 'auto' }),
        ],
      },
      { title: 'Edge', path: 'edge', cards: [card({ entities: EDGE })] },
      {
        // Taller than the 720 px Shelly screen, so a slider gesture that scrolled would show.
        title: 'Shelly',
        path: 'shelly',
        cards: Array.from({ length: 8 }, (_, i) =>
          card({ entities: i % 2 ? ALL_8 : PILL_4, style: i % 4 < 2 ? 'pill' : 'fabric' }),
        ),
      },
      {
        title: 'Content height',
        path: 'auto-height',
        cards: [
          card({ entities: PILL_4, height: 'auto' }),
          card({ entities: PILL_4, height: 'fit-content' }),
        ],
      },
    ],
  };
}

export function sections(legacy: boolean) {
  return {
    views: [
      {
        title: 'Sections',
        path: 'grid',
        type: 'sections',
        sections: [
          {
            type: 'grid',
            cards: [
              card({ entities: PILL_4, ...span(legacy, true) }),
              card({ entities: PILL_4, ...span(legacy, false) }),
            ],
          },
        ],
      },
    ],
  };
}

async function waitForCovers(ws: HaSocket): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const states = await ws.states();
    if (ALL_8.every((id) => states[id] !== undefined && states[id].state !== 'unavailable')) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('demo covers did not appear');
}

async function prepare(t: Target): Promise<void> {
  // Instances started by ha-up.sh serve .ha-<version>/www; ship the current build there.
  const www = `.ha-${t.version}/www`;
  if (existsSync(www))
    copyFileSync('dist/curtain-control-card.js', `${www}/curtain-control-card.js`);
  const tokens = await signIn(t.url);
  const ws = await HaSocket.open(t.url, tokens.access_token);
  try {
    const token = await ws.call<string>({
      type: 'auth/long_lived_access_token',
      client_name: `e2e ${String(Date.now())}`,
      lifespan: 1,
    });
    const config = await ws.call<{ version: string }>({ type: 'get_config' });
    const legacy = config.version.startsWith('2024.');

    const resources = await ws.call<{ id: string; url: string }[]>({ type: 'lovelace/resources' });
    const url = `/local/curtain-control-card.js?v=${String(Date.now())}`;
    const existing = resources.find((r) => r.url.startsWith('/local/curtain-control-card.js'));
    if (existing) {
      await ws.call({
        type: 'lovelace/resources/update',
        resource_id: existing.id,
        res_type: 'module',
        url,
      });
    } else {
      await ws.call({ type: 'lovelace/resources/create', res_type: 'module', url });
    }

    const dashboards = await ws.call<{ url_path: string }[]>({ type: 'lovelace/dashboards/list' });
    for (const [path, title] of [
      ['cc-masonry', 'CC Masonry'],
      ['cc-sections', 'CC Sections'],
    ] as const) {
      if (!dashboards.some((d) => d.url_path === path)) {
        await ws.call({
          type: 'lovelace/dashboards/create',
          url_path: path,
          title,
          mode: 'storage',
          show_in_sidebar: true,
          require_admin: false,
        });
      }
    }
    await ws.call({ type: 'lovelace/config/save', url_path: 'cc-masonry', config: masonry() });
    await ws.call({
      type: 'lovelace/config/save',
      url_path: 'cc-sections',
      config: sections(legacy),
    });
    await waitForCovers(ws);

    saveAuth(t, { token, version: config.version, browser: hassTokens(t.url, tokens) });
  } finally {
    ws.close();
  }
}

export default async function globalSetup(): Promise<void> {
  await Promise.all(targets().map(prepare));
}
