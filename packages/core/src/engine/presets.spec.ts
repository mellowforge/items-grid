import { describe, expect, it } from 'vitest';

import { DEFAULT_PRESETS, resolvePreset } from './presets';
import type { SizePreset } from './types';

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

describe('resolvePreset — validation', () => {
  it.each([
    ['minCardWidth', { minCardWidth: 0, gap: 8, rowHeight: 96 }],
    ['rowHeight', { minCardWidth: 200, gap: 8, rowHeight: Number.NaN }],
    ['gap', { minCardWidth: 200, gap: -1, rowHeight: 96 }],
    ['maxColumns', { minCardWidth: 200, gap: 8, rowHeight: 96, maxColumns: 0.5 }],
    ['maxPageSize', { minCardWidth: 200, gap: 8, rowHeight: 96, maxPageSize: 0 }],
  ])('throws for an invalid %s', (field, preset) => {
    expect(() => resolvePreset({ custom: preset }, 'custom')).toThrow(
      `items-grid: preset "custom" has an invalid ${field}`
    );
  });
});

describe('resolvePreset — malformed input', () => {
  it('names the preset when its value is not an object', () => {
    expect(() => resolvePreset({ broken: null as unknown as SizePreset }, 'broken')).toThrow(
      'items-grid: preset "broken" is not a preset object'
    );
  });

  it('says when no presets are defined', () => {
    expect(() => resolvePreset({}, 'normal')).toThrow('Known presets: (none).');
  });
});
