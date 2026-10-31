import { type CardSize, cardView, type Entity } from 'demo-shared';
import type { ReactElement } from 'react';

/** The Figma sample card — app-side markup, styled by demo-shared/demo.css. */
export function Card({
  entity,
  size,
  onToggle,
}: {
  entity: Entity;
  size: CardSize;
  onToggle: (id: string, enabled: boolean) => void;
}): ReactElement {
  const view = cardView(entity, size);
  return (
    <article className={`card card--${size}`} data-id={entity.id}>
      <header className="card__header">
        <div className="card__titles">
          <h2 className="card__title">{entity.title}</h2>
          {view.showSubtitle ? <p className="card__subtitle">{entity.subtitle}</p> : null}
        </div>
        <span className={`badge badge--${entity.status}`}>
          <span className="badge__dot" />
          <span className={size === 'compact' ? 'badge__label visually-hidden' : 'badge__label'}>
            {entity.statusLabel}
          </span>
        </span>
      </header>
      <div className="card__body">
        {view.showSummary ? <p className="card__summary">{entity.summary}</p> : null}
        {view.showProgress ? (
          <div className="progress" role="progressbar" aria-label="Progress">
            <div
              className="progress__value"
              style={{ width: `${Math.round((entity.progress ?? 0) * 100)}%` }}
            />
          </div>
        ) : null}
        {view.details.length ? (
          <dl className="card__details">
            {view.details.map(([term, description]) => (
              <div className="card__detail" key={term}>
                <dt>{term}</dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <footer className="card__footer">
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={entity.enabled}
            onChange={event => onToggle(entity.id, event.target.checked)}
          />
          <span className="switch__track" />
          <span className={view.showToggleLabel ? 'switch__label' : 'visually-hidden'}>
            {view.showToggleLabel
              ? entity.toggleLabel
              : `${entity.toggleLabel} for ${entity.title}`}
          </span>
        </label>
        <span className="card__spacer" />
        {view.showActions ? (
          entity.actions.map(action => (
            <button type="button" className="card__action" key={action}>
              {action}
            </button>
          ))
        ) : (
          <button
            type="button"
            className="card__more"
            aria-label={`More actions for ${entity.title}`}
          >
            ⋮
          </button>
        )}
      </footer>
    </article>
  );
}

/** Loading placeholder, rendered once per slot by the grid. */
export function SkeletonCard(): ReactElement {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card__group">
        <div className="skeleton-card__bar" style={{ width: '55%' }} />
        <div className="skeleton-card__bar" style={{ width: '35%' }} />
      </div>
      <div className="skeleton-card__group">
        <div className="skeleton-card__bar" style={{ width: '100%' }} />
        <div className="skeleton-card__bar" style={{ width: '70%' }} />
      </div>
    </div>
  );
}

/** Empty state, rendered over the whole viewport by the grid. */
export function EmptyState(): ReactElement {
  return (
    <div className="empty-state">
      <p className="empty-state__title">No entities yet</p>
      <p className="empty-state__hint">They will appear here as soon as they report in.</p>
    </div>
  );
}
