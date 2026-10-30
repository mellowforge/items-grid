import type { SizePreset } from './types';

/** The built-in preset names. Custom presets may use any other name. */
export type DefaultPresetName = 'compact' | 'normal' | 'large';

/**
 * Built-in presets. Values match the Figma prototypes: each preset's card is exactly
 * `minCardWidth × rowHeight` at its narrowest.
 */
export const DEFAULT_PRESETS: Readonly<Record<DefaultPresetName, SizePreset>> = Object.freeze({
  compact: Object.freeze({ minCardWidth: 200, gap: 8, rowHeight: 96 }),
  normal: Object.freeze({ minCardWidth: 280, gap: 12, rowHeight: 160 }),
  large: Object.freeze({ minCardWidth: 360, gap: 16, rowHeight: 240 }),
});

/** The preset used when none is given. */
export const DEFAULT_PRESET_NAME: DefaultPresetName = 'normal';

/**
 * Looks up a preset by name.
 *
 * @throws Error naming the known presets when `name` is not one of them, so a typo fails
 * loudly instead of silently rendering a different density.
 */
export function resolvePreset(
  presets: Readonly<Record<string, SizePreset>>,
  name: string
): SizePreset {
  const preset = presets[name];
  if (!preset) {
    throw new Error(
      `items-grid: unknown preset "${name}". Known presets: ${Object.keys(presets).join(', ')}.`
    );
  }
  return preset;
}
