/**
 * A grid size preset (density). Every card in a grid uses the same preset; switching
 * presets recomputes columns, rows and page size together.
 */
export interface SizePreset {
  /** Smallest width a card may have, in CSS px. Columns are added while they fit at this width. */
  readonly minCardWidth: number;
  /** Horizontal and vertical gap between cards, in CSS px. */
  readonly gap: number;
  /** Fixed row height, in CSS px. Cards must fit inside it. */
  readonly rowHeight: number;
  /** Upper bound on the column count, e.g. to keep cards from getting too wide. */
  readonly maxColumns?: number;
  /** Upper bound on cards per page; rows are reduced first, then columns. */
  readonly maxPageSize?: number;
}

/** The measured content box of the grid viewport, in CSS px. */
export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/** The layout of one page, derived from the viewport and the preset. */
export interface GridGeometry {
  /** Number of column tracks. Always at least 1. */
  readonly cols: number;
  /** Number of row tracks that fit fully. Always at least 1. */
  readonly rows: number;
  /** `cols × rows`, after `maxPageSize` is applied. */
  readonly pageSize: number;
  /** Row track height in CSS px (the preset's, or the measured one). */
  readonly rowHeight: number;
  /** Gap between tracks in CSS px. */
  readonly gap: number;
}

/** A half-open range of item indexes: `start` is included, `end` is not. */
export interface ItemRange {
  readonly start: number;
  readonly end: number;
}

/** A stable identity for an item, used to keep card DOM and state across updates. */
export type ItemKey = string | number;
