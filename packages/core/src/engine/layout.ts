import type { GridGeometry, SizePreset, ViewportSize } from './types';

/** Per-grid overrides applied on top of the preset. */
export interface GeometryOverrides {
  /** Row height to use instead of the preset's, e.g. a measured one. */
  readonly rowHeight?: number;
  /** Overrides the preset's `maxColumns`. */
  readonly maxColumns?: number;
  /** Overrides the preset's `maxPageSize`. */
  readonly maxPageSize?: number;
}

const isPositive = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * Computes how many cards fit the viewport.
 *
 * Columns: as many `minCardWidth` tracks as fit with gaps between them. Rows: as many
 * full rows as fit. Both are at least 1, so one (clipped) row shows even in a viewport
 * shorter than a row.
 *
 * @returns `null` while the viewport has not been measured (zero, negative or non-finite
 * size), so callers can tell "not laid out yet" apart from a real page size.
 */
export function computeGeometry(
  size: ViewportSize,
  preset: SizePreset,
  overrides: GeometryOverrides = {}
): GridGeometry | null {
  const { width, height } = size;
  if (!isPositive(width) || !isPositive(height)) {
    return null;
  }
  const gap = preset.gap;
  const rowHeight = overrides.rowHeight ?? preset.rowHeight;
  const maxColumns = overrides.maxColumns ?? preset.maxColumns;
  const maxPageSize = overrides.maxPageSize ?? preset.maxPageSize;

  let cols = Math.max(1, Math.floor((width + gap) / (preset.minCardWidth + gap)));
  if (maxColumns !== undefined && maxColumns >= 1) {
    cols = Math.min(cols, Math.floor(maxColumns));
  }
  let rows = Math.max(1, Math.floor((height + gap) / (rowHeight + gap)));

  if (maxPageSize !== undefined && maxPageSize >= 1 && cols * rows > maxPageSize) {
    const limit = Math.floor(maxPageSize);
    rows = Math.max(1, Math.floor(limit / cols));
    if (cols * rows > limit) {
      cols = limit;
    }
  }

  return {
    cols,
    rows,
    pageSize: cols * rows,
    rowHeight,
    gap,
  };
}
