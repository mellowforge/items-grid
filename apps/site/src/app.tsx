import { DEMO_LINKS } from 'demo-shared';
import type { ReactElement } from 'react';

import { CodeTabs } from './code-tabs';
import { CopyCommand } from './copy-command';
import { HeroGrid } from './hero-grid';
import { ThemeToggle } from './theme-toggle';

const FEATURES: readonly { title: string; body: string }[] = [
  {
    title: 'Exact fit',
    body: 'As many full rows and columns as the container holds — cols × rows, never a partial row and never an inner scrollbar. The rest moves to other pages.',
  },
  {
    title: 'Keeps your place',
    body: 'Resizes, sidebars and preset changes recompute the page around the first card you were looking at, instead of jumping back to page 1.',
  },
  {
    title: 'Client or server paging',
    body: 'Slice an array, or ask your API for { pageIndex, pageSize } — debounced while a window is dragged, deduplicated, with unknown totals supported.',
  },
  {
    title: 'Realtime without the jumps',
    body: 'Live reflow, or a stable page that keeps its cards and counts the “N new items” for your banner. Cards keep their DOM by key, so switches and focus survive.',
  },
  {
    title: 'Accessible',
    body: 'List semantics, a polite live region, a labelled pager, PageUp / PageDown — and opt-in arrow keys that move between cards without stealing keys from their controls.',
  },
  {
    title: 'Headless, zero dependencies',
    body: 'A pure engine with a vanilla mount and thin React and Angular adapters. You render the cards; the library never ships card markup or card styles.',
  },
];

const DEMOS: readonly { href: string; title: string; body: string }[] = [
  {
    href: 'react/',
    title: 'React demo',
    body: 'Presets, client and server paging, live and stable realtime, skeletons and arrow keys — built with @mellowforge/items-grid-react.',
  },
  {
    href: 'angular/',
    title: 'Angular demo',
    body: 'The same console, component for component, built with @mellowforge/items-grid-angular.',
  },
  {
    href: 'vanilla/',
    title: 'Vanilla demo',
    body: 'The same console again with mountItemsGrid from @mellowforge/items-grid-core — no framework at all.',
  },
];

/** The landing page: the pitch beside a live grid, the features, the code and the demos. */
export function App(): ReactElement {
  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="wordmark" href="./">
          <span className="wordmark__mark" aria-hidden="true" />
          items-grid
        </a>
        <nav aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#code">Code</a>
          <a href="#demos">Demos</a>
          <a href={DEMO_LINKS.github}>GitHub</a>
        </nav>
        <ThemeToggle />
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Headless · React · Angular · zero dependencies</p>
            <h1 id="hero-title">
              Card grids that <em>fit the screen</em> exactly.
            </h1>
            <p className="lede">
              items-grid works out how many cards fit the space you give it — full rows and columns
              only — pages the rest, and keeps your place when the window, the sidebar or the data
              changes. You bring the cards.
            </p>
            <CopyCommand command="npm install @mellowforge/items-grid-react" />
            <p className="hint">
              or <code>items-grid-angular</code>, or <code>items-grid-core</code> on its own
            </p>
            <div className="cta">
              <a className="button primary" href="react/">
                Open the React demo
              </a>
              <a className="button" href="angular/">
                Angular demo
              </a>
              <a className="button" href="vanilla/">
                Vanilla demo
              </a>
            </div>
          </div>
          <HeroGrid />
        </section>

        <section id="features" className="features" aria-labelledby="features-title">
          <h2 id="features-title" className="section-title">
            What it does
          </h2>
          <ol className="feature-grid">
            {FEATURES.map((feature, index) => (
              <li key={feature.title} className="feature">
                <span className="feature__index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="code" className="code" aria-labelledby="code-title">
          <div className="section-head">
            <h2 id="code-title" className="section-title">
              Quick start
            </h2>
            <p>
              The same grid three ways. Give it a container with a definite height, your items, a{' '}
              <code>getKey</code> and a card template — it does the rest.
            </p>
          </div>
          <CodeTabs />
        </section>

        <section id="demos" className="demos" aria-labelledby="demos-title">
          <h2 id="demos-title" className="section-title">
            Try the demos
          </h2>
          <ul className="demo-grid">
            {DEMOS.map(demo => (
              <li key={demo.href}>
                <a className="demo-card" href={demo.href}>
                  <span className="demo-card__title">{demo.title}</span>
                  <span className="demo-card__body">{demo.body}</span>
                  <span className="demo-card__arrow" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="site-footer">
        <span>MIT © 2026 Konstantin Penzin</span>
        <span className="spacer" />
        <a href={DEMO_LINKS.github}>GitHub</a>
        <a href={DEMO_LINKS.npm}>npm</a>
      </footer>
    </div>
  );
}
