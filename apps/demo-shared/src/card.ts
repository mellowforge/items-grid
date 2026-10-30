import type { Entity } from './entities';

/** The card sizes; they match the library's default preset names. */
export type CardSize = 'compact' | 'normal' | 'large';

/** What a card shows at a given size. All three demos render exactly this. */
export interface CardView {
  readonly showSubtitle: boolean;
  readonly showProgress: boolean;
  readonly showSummary: boolean;
  readonly details: readonly (readonly [string, string])[];
  readonly showToggleLabel: boolean;
  /** Large cards show two action buttons; smaller ones an overflow menu button. */
  readonly showActions: boolean;
}

/** Decides the card's content for a size, as in the Figma sample cards. */
export function cardView(entity: Entity, size: CardSize): CardView {
  if (size === 'compact') {
    return {
      showSubtitle: false,
      showProgress: false,
      showSummary: true,
      details: [],
      showToggleLabel: false,
      showActions: false,
    };
  }
  const hasProgress = entity.progress !== undefined;
  const rows = size === 'normal' ? 2 : 3;
  return {
    showSubtitle: true,
    showProgress: hasProgress,
    showSummary: false,
    details: entity.details.slice(0, hasProgress ? rows - 1 : rows),
    showToggleLabel: true,
    showActions: size === 'large',
  };
}

/** Options for the demo toolbar, in display order. */
export const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
] as const;

export const MODE_OPTIONS = [
  { value: 'client', label: 'Client' },
  { value: 'server', label: 'Server' },
] as const;

export const REFLOW_OPTIONS = [
  { value: 'live', label: 'Live' },
  { value: 'stable', label: 'Stable' },
] as const;

export const ALIGN_OPTIONS = [
  { value: 'start', label: 'Top' },
  { value: 'center', label: 'Center' },
] as const;

/** Size of the demo dataset. */
export const DEMO_ITEM_COUNT = 120;
