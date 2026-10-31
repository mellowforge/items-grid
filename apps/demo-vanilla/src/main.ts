import '@mellowforge/items-grid-core/styles.css';
import 'demo-shared/demo.css';

import {
  type GridAlign,
  type ItemsGridState,
  mountItemsGrid,
  type PageRequest,
  type PagingMode,
  type ReflowMode,
} from '@mellowforge/items-grid-core';
import {
  ALIGN_OPTIONS,
  type CardSize,
  cardView,
  createEntities,
  DEMO_ITEM_COUNT,
  DENSITY_OPTIONS,
  type Entity,
  fetchPage,
  MAX_PAGE_OPTIONS,
  type MaxPageChoice,
  maxPageSizeOf,
  MODE_OPTIONS,
  REFLOW_OPTIONS,
  startSimulation,
} from 'demo-shared';

// MARK: - App state

let database: Entity[] = createEntities(DEMO_ITEM_COUNT);
let density: CardSize = 'normal';
let mode: PagingMode = 'client';
let reflow: ReflowMode = 'live';
let align: GridAlign = 'start';
let maxPage: MaxPageChoice = 'fit';
let serverIds: string[] = [];
let serverTotal: number | undefined;
let loading = false;
let requestSeq = 0;
let quietRefresh = false;
let stopSimulation: (() => void) | null = null;

// MARK: - DOM helpers

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function segmented<V extends string>(
  label: string,
  options: readonly { value: V; label: string }[],
  current: () => V,
  onChange: (value: V) => void
): HTMLElement {
  const wrapper = element('span', 'control');
  wrapper.append(element('span', undefined, label));
  const group = element('div', 'segmented');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', label);
  const buttons = options.map(option => {
    const button = element('button', 'segmented__option', option.label);
    button.type = 'button';
    button.addEventListener('click', () => {
      onChange(option.value);
      buttons.forEach((candidate, index) =>
        candidate.setAttribute('aria-pressed', String(options[index]!.value === current()))
      );
    });
    button.setAttribute('aria-pressed', String(option.value === current()));
    return button;
  });
  group.append(...buttons);
  wrapper.append(group);
  return wrapper;
}

// MARK: - Cards (app-side templates, as in the Figma sample cards)

function createCard(entity: Entity, size: CardSize): HTMLElement {
  const view = cardView(entity, size);
  const card = element('article', `card card--${size}`);
  card.dataset['id'] = entity.id;

  const header = element('header', 'card__header');
  const titles = element('div', 'card__titles');
  titles.append(element('h2', 'card__title', entity.title));
  if (view.showSubtitle) titles.append(element('p', 'card__subtitle', entity.subtitle));
  const badge = element('span', `badge badge--${entity.status}`);
  badge.dataset['field'] = 'badge';
  const label = element(
    'span',
    size === 'compact' ? 'badge__label visually-hidden' : 'badge__label',
    entity.statusLabel
  );
  badge.append(element('span', 'badge__dot'), label);
  header.append(titles, badge);

  const body = element('div', 'card__body');
  if (view.showSummary) {
    const summary = element('p', 'card__summary', entity.summary);
    summary.dataset['field'] = 'summary';
    body.append(summary);
  }
  if (view.showProgress) {
    const progress = element('div', 'progress');
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', 'Progress');
    const value = element('div', 'progress__value');
    value.dataset['field'] = 'progress';
    progress.append(value);
    body.append(progress);
  }
  if (view.details.length) {
    const list = element('dl', 'card__details');
    view.details.forEach(([term, description], index) => {
      const row = element('div', 'card__detail');
      const value = element('dd', undefined, description);
      value.dataset['field'] = `detail-${index}`;
      row.append(element('dt', undefined, term), value);
      list.append(row);
    });
    body.append(list);
  }

  const footer = element('footer', 'card__footer');
  const toggle = element('label', 'switch');
  const input = element('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.dataset['field'] = 'enabled';
  toggle.append(
    input,
    element('span', 'switch__track'),
    element(
      'span',
      view.showToggleLabel ? 'switch__label' : 'visually-hidden',
      `${entity.toggleLabel}${view.showToggleLabel ? '' : ` for ${entity.title}`}`
    )
  );
  footer.append(toggle, element('span', 'card__spacer'));
  if (view.showActions) {
    for (const action of entity.actions) {
      const button = element('button', 'card__action', action);
      button.type = 'button';
      footer.append(button);
    }
  } else {
    const more = element('button', 'card__more', '⋮');
    more.type = 'button';
    more.setAttribute('aria-label', `More actions for ${entity.title}`);
    footer.append(more);
  }
  card.append(header, body, footer);
  updateCard(card, entity);
  return card;
}

/** Patches the fields realtime updates touch; the card element (and focus) stays put. */
function updateCard(card: HTMLElement, entity: Entity): void {
  const field = <T extends HTMLElement>(name: string): T | null =>
    card.querySelector<T>(`[data-field="${name}"]`);
  const badge = field('badge');
  if (badge) {
    badge.className = `badge badge--${entity.status}`;
    badge.querySelector('.badge__label')!.textContent = entity.statusLabel;
  }
  const summary = field('summary');
  if (summary) summary.textContent = entity.summary;
  const progress = field('progress');
  if (progress) progress.style.width = `${Math.round((entity.progress ?? 0) * 100)}%`;
  entity.details.forEach(([, value], index) => {
    const detail = field(`detail-${index}`);
    if (detail) detail.textContent = value;
  });
  field<HTMLInputElement>('enabled')!.checked = entity.enabled;
}

function createSkeleton(): HTMLElement {
  const card = element('div', 'skeleton-card');
  const bar = (width: string): HTMLElement => {
    const node = element('div', 'skeleton-card__bar');
    node.style.width = width;
    return node;
  };
  const top = element('div', 'skeleton-card__group');
  top.append(bar('55%'), bar('35%'));
  const bottom = element('div', 'skeleton-card__group');
  bottom.append(bar('100%'), bar('70%'));
  card.append(top, bottom);
  return card;
}

function createEmpty(): HTMLElement {
  const empty = element('div', 'empty-state');
  empty.append(
    element('p', 'empty-state__title', 'No entities yet'),
    element('p', 'empty-state__hint', 'They will appear here as soon as they report in.')
  );
  return empty;
}

// MARK: - Shell

const app = document.querySelector<HTMLElement>('#app')!;
app.className = 'app';
const header = element('header', 'app__header');
header.append(element('span', 'app__brand', 'Fleet Console'));
header.append(element('span', 'app__flavor', 'items-grid · vanilla'));
const main = element('main', 'app__main');
const toolbar = element('div', 'toolbar');
const count = element('span', 'toolbar__count');
const errorBanner = element('span', 'banner banner--error');
errorBanner.setAttribute('role', 'alert');
errorBanner.hidden = true;
const retryButton = element('button', 'banner__show', 'Retry');
retryButton.type = 'button';
errorBanner.append(element('span', undefined, 'Could not load this page'), retryButton);
const banner = element('span', 'banner');
banner.hidden = true;
const bannerText = element('span');
const showButton = element('button', 'banner__show', 'Show');
showButton.type = 'button';
banner.append(bannerText, showButton);

const realtimeLabel = element('label', 'toggle');
const realtimeInput = element('input');
realtimeInput.type = 'checkbox';
realtimeLabel.append(realtimeInput, document.createTextNode('Realtime'));

const arrowKeysLabel = element('label', 'toggle');
const arrowKeysInput = element('input');
arrowKeysInput.type = 'checkbox';
arrowKeysInput.checked = true;
arrowKeysLabel.append(arrowKeysInput, document.createTextNode('Arrow keys'));

toolbar.append(
  element('h1', 'toolbar__title', 'Entities'),
  count,
  banner,
  errorBanner,
  element('span', 'toolbar__spacer'),
  segmented('Density', DENSITY_OPTIONS, () => density, setDensity),
  segmented('Data', MODE_OPTIONS, () => mode, setMode),
  segmented('Updates', REFLOW_OPTIONS, () => reflow, setReflow),
  segmented('Align', ALIGN_OPTIONS, () => align, setAlign),
  segmented('Max', MAX_PAGE_OPTIONS, () => maxPage, setMaxPage),
  realtimeLabel,
  arrowKeysLabel
);
const gridHost = element('section', 'app__grid');
main.append(toolbar, gridHost);
app.append(header, main);

// MARK: - Grid

const renderers = new Map<CardSize, (entity: Entity) => HTMLElement>();
const rendererFor = (size: CardSize): ((entity: Entity) => HTMLElement) => {
  let renderer = renderers.get(size);
  if (!renderer) {
    renderer = entity => createCard(entity, size);
    renderers.set(size, renderer);
  }
  return renderer;
};

const grid = mountItemsGrid<Entity>(gridHost, {
  arrowKeys: arrowKeysInput.checked,
  getKey: entity => entity.id,
  items: database,
  preset: density,
  ariaLabel: 'Entities',
  renderItem: rendererFor(density),
  updateItem: updateCard,
  renderSkeleton: createSkeleton,
  renderEmpty: createEmpty,
  onPageRequest: request => {
    loadPage(request).catch(error => console.error(error));
  },
  onStateChange: renderChrome,
});

function serverItems(): Entity[] {
  const byId = new Map(database.map(entity => [entity.id, entity]));
  return serverIds.flatMap(id => byId.get(id) ?? []);
}

function syncData(): void {
  count.textContent = `${database.length} items`;
  grid.update(
    mode === 'client'
      ? { mode, items: database, total: undefined, loading: false }
      : { mode, items: serverItems(), total: serverTotal, loading }
  );
}

async function loadPage(request: PageRequest): Promise<void> {
  const seq = ++requestSeq;
  if (!quietRefresh) {
    loading = true;
    syncData();
  }
  quietRefresh = false;
  errorBanner.hidden = true;
  let response;
  try {
    response = await fetchPage(database, request);
  } catch (error) {
    if (seq !== requestSeq || mode !== 'server') return;
    console.error(error);
    // Clear the stale cards so the old page never shows under the new page's numbers;
    // refresh() asks for this page again.
    serverIds = [];
    loading = false;
    errorBanner.hidden = false;
    syncData();
    return;
  }
  if (seq !== requestSeq || mode !== 'server') return;
  serverIds = response.items.map(entity => entity.id);
  serverTotal = response.total;
  loading = false;
  syncData();
}

function renderChrome(state: ItemsGridState<Entity>): void {
  banner.hidden = state.pendingCount === 0;
  bannerText.textContent = `${state.pendingCount} new ${state.pendingCount === 1 ? 'item' : 'items'}`;
}

showButton.addEventListener('click', () => grid.controller.refresh());
retryButton.addEventListener('click', () => grid.controller.refresh());

// The switches are app state: flip `enabled` on the entity, the grid patches the card.
gridHost.addEventListener('change', event => {
  const input = event.target as HTMLInputElement;
  const id = input.closest<HTMLElement>('.card')?.dataset['id'];
  if (input.dataset['field'] !== 'enabled' || !id) return;
  database = database.map(entity =>
    entity.id === id ? { ...entity, enabled: input.checked } : entity
  );
  syncData();
});

function setDensity(value: CardSize): void {
  density = value;
  grid.update({ preset: value, renderItem: rendererFor(value) });
}

function setMode(value: PagingMode): void {
  mode = value;
  errorBanner.hidden = true;
  serverIds = [];
  serverTotal = undefined;
  loading = value === 'server';
  syncData();
}

function setReflow(value: ReflowMode): void {
  reflow = value;
  grid.update({ reflow: value });
}

function setAlign(value: GridAlign): void {
  align = value;
  grid.update({ align: value });
}

function setMaxPage(value: MaxPageChoice): void {
  maxPage = value;
  grid.update({ maxPageSize: maxPageSizeOf(value) });
}

arrowKeysInput.addEventListener('change', () => {
  grid.update({ arrowKeys: arrowKeysInput.checked });
});

realtimeInput.addEventListener('change', () => {
  stopSimulation?.();
  stopSimulation = realtimeInput.checked
    ? startSimulation({
        read: () => database,
        write: entities => {
          database = entities;
          if (mode === 'server') {
            serverTotal = database.length;
            // Live server mode re-fetches the page in the background so inserts shift in.
            if (reflow === 'live') {
              quietRefresh = true;
              grid.controller.refresh();
              // No request goes out while the grid is hidden; don't let the flag leak.
              quietRefresh = false;
            }
          }
          syncData();
        },
      })
    : null;
});

syncData();
