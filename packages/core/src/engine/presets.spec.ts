import { describe, expect, it } from 'vitest';

import { DEFAULT_PRESETS, resolvePreset } from './presets';

describe('resolvePreset', () => {
  it('returns a built-in preset by name', () => {
    expect(resolvePreset(DEFAULT_PRESETS, 'large')).toEqual({
      minCardWidth: 360,
      gap: 16,
      rowHeight: 240,
    });
  });

  it('throws an error naming the known presets for a typo', () => {
    expect(() => resolvePreset(DEFAULT_PRESETS, 'larg')).toThrow(
      'unknown preset "larg". Known presets: compact, normal, large.'
    );
  });
});
