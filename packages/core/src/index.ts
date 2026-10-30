/*
 * Public API Surface of @quietfoundry/items-grid-core
 */

export {
  DEFAULT_MESSAGES,
  ItemsGridController,
  type GridAlign,
  type ItemsGridHandle,
  type ItemsGridMessages,
  type ItemsGridOptions,
  type ItemsGridState,
  type PageMessageInfo,
  type PageRequest,
  type PagingMode,
  type ReflowMode,
} from './controller';
export { computeGeometry, type GeometryOverrides } from './engine/layout';
export {
  clampPageIndex,
  getPageCount,
  getPageRange,
  getPagerItems,
  getSkeletonCount,
  reanchor,
  type PagerItem,
} from './engine/paging';
export {
  DEFAULT_PRESET_NAME,
  DEFAULT_PRESETS,
  resolvePreset,
  type DefaultPresetName,
} from './engine/presets';
export type { GridGeometry, ItemKey, ItemRange, SizePreset, ViewportSize } from './engine/types';
export { DEFAULT_PAGER_LABELS, type PagerLabels, resolvePagerLabels } from './pager';
export { isEditableTarget } from './dom/keyboard';
export { observeSize, type ObserveSizeOptions } from './dom/observe';
export {
  getCellStyle,
  getEmptyStyle,
  getHostStyle,
  getProbeStyle,
  getViewportStyle,
  getVisuallyHiddenStyle,
  ITEMS_GRID_CLASSES,
  type StyleDeclarations,
} from './dom/styles';
export { mountItemsGrid, type ItemsGridMount, type MountItemsGridOptions } from './dom/vanilla';
