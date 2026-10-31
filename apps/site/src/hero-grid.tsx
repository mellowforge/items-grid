import type { ItemsGridState } from '@mellowforge/items-grid-core';
import { ItemsGrid } from '@mellowforge/items-grid-react';
import { type CardSize, cardView, createEntities, DENSITY_OPTIONS, type Entity } from 'demo-shared';
import { type PointerEvent, type ReactElement, useRef, useState } from 'react';

const ITEMS = createEntities(240);
/** Frame width, in % of the stage. */
const WIDTH = { min: 40, max: 100, initial: 100 };
/** Frame height, in px. */
const HEIGHT = { min: 200, max: 460, initial: 380 };

const clamp = (value: number, { min, max }: { min: number; max: number }): number =>
  Math.round(Math.min(max, Math.max(min, value)));

/**
 * A sample card: the demos' markup without their controls (the hero is for looking), and with
 * a plain title, so the samples don't add to the page's heading outline.
 */
function HeroCard({ entity, size }: { entity: Entity; size: CardSize }): ReactElement {
  const view = cardView(entity, size);
  return (
    <article className={`card card--${size}`}>
      <header className="card__header">
        <div className="card__titles">
          <p className="card__title">{entity.title}</p>
          {view.showSubtitle ? <p className="card__subtitle">{entity.subtitle}</p> : null}
        </div>
        <span className={`badge badge--${entity.status}`}>
          <span className="badge__dot" />
          <span className={size === 'compact' ? 'visually-hidden' : undefined}>
            {entity.statusLabel}
          </span>
        </span>
      </header>
      {view.showSummary ? <p className="card__summary">{entity.summary}</p> : null}
      {view.details.length > 0 || view.showProgress ? (
        <div className="card__body">
          {view.showProgress ? (
            <div className="progress" aria-hidden="true">
              <div
                className="progress__value"
                style={{ width: `${(entity.progress ?? 0) * 100}%` }}
              />
            </div>
          ) : null}
          <dl className="card__details">
            {view.details.map(([label, value]) => (
              <div key={label} className="card__detail">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </article>
  );
}

/**
 * The landing page's live grid: a frame you resize by its corner (or with the sliders, from
 * the keyboard) while the grid refits — whole rows and columns only — and says how many fit.
 */
export function HeroGrid(): ReactElement {
  const [width, setWidth] = useState(WIDTH.initial);
  const [height, setHeight] = useState(HEIGHT.initial);
  const [density, setDensity] = useState<CardSize>('compact');
  const [state, setState] = useState<ItemsGridState<Entity> | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLSpanElement>): void => {
    const frame = event.currentTarget.parentElement!.getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, width: frame.width, height: frame.height };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<HTMLSpanElement>): void => {
    const start = drag.current;
    const stageWidth = stage.current?.getBoundingClientRect().width;
    if (!start || !stageWidth) return;
    setWidth(clamp(((start.width + event.clientX - start.x) / stageWidth) * 100, WIDTH));
    setHeight(clamp(start.height + event.clientY - start.y, HEIGHT));
  };

  const endDrag = (): void => {
    drag.current = null;
  };

  const geometry = state?.geometry;
  const readout = geometry
    ? `${geometry.cols} × ${geometry.rows} = ${geometry.pageSize} per page`
    : 'Measuring…';

  return (
    <section className="hero-demo" aria-label="Live grid">
      <div className="hero-toolbar">
        <div className="segmented" role="group" aria-label="Card size">
          {DENSITY_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className="segmented__option"
              aria-pressed={density === option.value}
              onClick={() => setDensity(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="hero-readout">{readout}</span>
      </div>
      <div className="hero-stage" ref={stage}>
        <div className="hero-frame" style={{ width: `${width}%`, height: `${height}px` }}>
          <ItemsGrid<Entity>
            className="hero-grid"
            aria-label="Sample entities"
            items={ITEMS}
            getKey={entity => entity.id}
            preset={density}
            arrowKeys
            onStateChange={setState}
            renderItem={entity => <HeroCard entity={entity} size={density} />}
          />
          <span
            className="hero-handle"
            aria-hidden="true"
            title="Drag to resize"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        </div>
      </div>
      <div className="hero-sliders">
        <label>
          <span>Width</span>
          <input
            type="range"
            aria-label="Grid width"
            min={WIDTH.min}
            max={WIDTH.max}
            value={width}
            onChange={event => setWidth(Number(event.target.value))}
          />
        </label>
        <label>
          <span>Height</span>
          <input
            type="range"
            aria-label="Grid height"
            min={HEIGHT.min}
            max={HEIGHT.max}
            value={height}
            onChange={event => setHeight(Number(event.target.value))}
          />
        </label>
      </div>
    </section>
  );
}
