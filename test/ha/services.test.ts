import { describe, expect, it } from 'vitest';
import { callCover } from '../../src/ha/services';
import { fakeHass } from '../helpers/hass';

describe('callCover (spec §6)', () => {
  it.each([
    ['open', 'open_cover'],
    ['close', 'close_cover'],
    ['stop', 'stop_cover'],
  ] as const)('%s → cover.%s', async (action, service) => {
    const hass = fakeHass({});
    await callCover(hass, action, 'cover.a');
    expect(hass.calls).toEqual([['cover', service, { entity_id: 'cover.a' }]]);
  });

  it('set → set_cover_position with position', async () => {
    const hass = fakeHass({});
    await callCover(hass, 'set', 'cover.a', 40);
    expect(hass.calls).toEqual([
      ['cover', 'set_cover_position', { entity_id: 'cover.a', position: 40 }],
    ]);
  });
});
