import { describe, expect, it } from 'vitest';
import { isSuggestedClass, pickStubEntities, type StubCandidate } from '../../src/model/stub';

const c = (entityId: string, deviceClass?: string, state = 'open'): StubCandidate => ({
  entityId,
  state,
  deviceClass,
});

describe('pickStubEntities', () => {
  it('up to 4: curtain, then shade, blind, any', () => {
    expect(
      pickStubEntities([
        c('cover.a', 'curtain'),
        c('cover.b', 'blind'),
        c('cover.c'),
        c('cover.d', 'shade'),
        c('cover.e', 'curtain'),
        c('cover.f', 'curtain'),
      ]),
    ).toEqual(['cover.a', 'cover.e', 'cover.f', 'cover.d']);
  });

  it('falls through the classes; unknown classes rank as any', () => {
    expect(pickStubEntities([c('cover.c', 'garage'), c('cover.b', 'blind')])).toEqual([
      'cover.b',
      'cover.c',
    ]);
  });

  it('dead covers go after every working one — same rule as the column view', () => {
    expect(
      pickStubEntities([
        c('cover.c1', 'curtain', 'unavailable'),
        c('cover.c2', 'curtain', 'unknown'),
        c('cover.c4', 'curtain', 'stopped'), // not a known cover state → drawn as unavailable
        c('cover.n'),
        c('cover.s', 'shade', 'closing'),
        c('cover.c3', 'curtain', 'closed'),
      ]),
    ).toEqual(['cover.c3', 'cover.s', 'cover.n', 'cover.c1']);
  });

  it('ties by entity id in code-unit order (locale-independent)', () => {
    // '2' (0x32) < '_' (0x5f); localeCompare may order these differently per browser locale
    expect(
      pickStubEntities([
        c('cover.a_2', 'curtain'),
        c('cover.z', 'curtain'),
        c('cover.a2', 'curtain'),
      ]),
    ).toEqual(['cover.a2', 'cover.a_2', 'cover.z']);
  });

  it('keeps a consistent order for duplicate ids', () => {
    expect(pickStubEntities([c('cover.a'), c('cover.a')])).toEqual(['cover.a', 'cover.a']);
  });

  it('empty → empty', () => {
    expect(pickStubEntities([])).toEqual([]);
  });
});

describe('isSuggestedClass', () => {
  it.each([
    ['curtain', true],
    ['shade', true],
    ['blind', true],
    ['garage', false],
    [undefined, false],
    [42, false],
  ])('%j → %s', (dc, want) => {
    expect(isSuggestedClass(dc)).toBe(want);
  });
});
