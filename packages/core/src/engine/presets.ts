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

const isCap = (value: number | undefined): boolean =>
  value === undefined || (Number.isInteger(value) && value >= 1);

/**
 * Looks up a preset by name and checks its values.
 *
 * @throws Error naming the known presets when `name` is not one of them (inherited object
 * keys such as `toString` included), and naming the field when a value is invalid — so a
 * typo fails loudly instead of rendering an empty or different grid.
 */
export function resolvePreset(
  presets: Readonly<Record<string, SizePreset>>,
  name: string
): SizePreset {
  if (!Object.prototype.hasOwnProperty.call(presets, name)) {
    throw new Error(
      `items-grid: unknown preset "${name}". Known presets: ${Object.keys(presets).join(', ')}.`
    );
  }
  const preset = presets[name]!;
  const invalid = (field: keyof SizePreset): never => {
    throw new Error(
      `items-grid: preset "${name}" has an invalid ${field} (${String(preset[field])}).`
    );
  };
  if (!(Number.isFinite(preset.minCardWidth) && preset.minCardWidth > 0)) invalid('minCardWidth');
  if (!(Number.isFinite(preset.rowHeight) && preset.rowHeight > 0)) invalid('rowHeight');
  if (!(Number.isFinite(preset.gap) && preset.gap >= 0)) invalid('gap');
  if (!isCap(preset.maxColumns)) invalid('maxColumns');
  if (!isCap(preset.maxPageSize)) invalid('maxPageSize');
  return preset;
}
