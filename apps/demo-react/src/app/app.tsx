import type {
  GridAlign,
  ItemsGridHandle,
  PageRequest,
  PagingMode,
  ReflowMode,
} from '@quietfoundry/items-grid-core';
import { ItemsGrid } from '@quietfoundry/items-grid-react';
import {
  ALIGN_OPTIONS,
  type CardSize,
  createEntities,
  DEMO_ITEM_COUNT,
  DENSITY_OPTIONS,
  type Entity,
  fetchPage,
  MODE_OPTIONS,
  type PageResponse,
  REFLOW_OPTIONS,
  startSimulation,
} from 'demo-shared';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';

import { Card, EmptyState, SkeletonCard } from './card';
import { Segmented } from './segmented';

interface ServerPage {
  readonly ids: readonly string[];
  readonly total: number | undefined;
  readonly loading: boolean;
}

const NO_PAGE: ServerPage = { ids: [], total: undefined, loading: true };

export function App(): ReactElement {
  const [database, setDatabase] = useState(() => createEntities(DEMO_ITEM_COUNT));
  const [density, setDensity] = useState<CardSize>('normal');
  const [mode, setMode] = useState<PagingMode>('client');
  const [reflow, setReflow] = useState<ReflowMode>('live');
  const [align, setAlign] = useState<GridAlign>('start');
  const [realtime, setRealtime] = useState(false);
  const [server, setServer] = useState<ServerPage>(NO_PAGE);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const grid = useRef<ItemsGridHandle<Entity>>(null);

  // Latest values for the simulation and the fake API, which run outside React.
  const latest = useRef({ database, mode, reflow });
  useEffect(() => {
    latest.current = { database, mode, reflow };
  });
  const requestSeq = useRef(0);
  const quietRefresh = useRef(false);

  const onPageRequest = (request: PageRequest): void => {
    const seq = ++requestSeq.current;
    if (!quietRefresh.current) setServer(page => ({ ...page, loading: true }));
    quietRefresh.current = false;
    setLoadError(false);
    const load = async (): Promise<void> => {
      let response: PageResponse;
      try {
        response = await fetchPage(latest.current.database, request);
      } catch (error) {
        if (seq !== requestSeq.current || latest.current.mode !== 'server') return;
        console.error(error);
        // Clear the stale cards so the old page never shows under the new page's numbers;
        // refresh() asks for this page again.
        setServer(page => ({ ...page, ids: [], loading: false }));
        setLoadError(true);
        return;
      }
      if (seq !== requestSeq.current || latest.current.mode !== 'server') return;
      setServer({
        ids: response.items.map(entity => entity.id),
        total: response.total,
        loading: false,
      });
    };
    void load();
  };

  useEffect(() => {
    if (!realtime) return undefined;
    return startSimulation({
      read: () => latest.current.database,
      write: entities => {
        latest.current = { ...latest.current, database: entities };
        setDatabase(entities);
        if (latest.current.mode === 'server') {
          setServer(page => ({ ...page, total: entities.length }));
          // Live server mode re-fetches the page in the background so inserts shift in.
          if (latest.current.reflow === 'live') {
            quietRefresh.current = true;
            grid.current?.refresh();
            // No request goes out while the grid is hidden; don't let the flag leak.
            quietRefresh.current = false;
          }
        }
      },
    });
  }, [realtime]);

  const items = useMemo(() => {
    if (mode === 'client') return database;
    const byId = new Map(database.map(entity => [entity.id, entity]));
    return server.ids.flatMap(id => byId.get(id) ?? []);
  }, [mode, database, server.ids]);

  const toggle = (id: string, enabled: boolean): void =>
    setDatabase(entities =>
      entities.map(entity => (entity.id === id ? { ...entity, enabled } : entity))
    );

  const changeMode = (next: PagingMode): void => {
    setMode(next);
    setServer(NO_PAGE);
    setLoadError(false);
  };

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__brand">Fleet Console</span>
        <span className="app__flavor">items-grid · React</span>
      </header>
      <main className="app__main">
        <div className="toolbar">
          <h1 className="toolbar__title">Entities</h1>
          <span className="toolbar__count">{database.length} items</span>
          {pendingCount > 0 ? (
            <span className="banner">
              <span>
                {pendingCount} new {pendingCount === 1 ? 'item' : 'items'}
              </span>
              <button
                type="button"
                className="banner__show"
                onClick={() => grid.current?.refresh()}
              >
                Show
              </button>
            </span>
          ) : null}
          {loadError ? (
            <span className="banner banner--error" role="alert">
              <span>Could not load this page</span>
              <button
                type="button"
                className="banner__show"
                onClick={() => grid.current?.refresh()}
              >
                Retry
              </button>
            </span>
          ) : null}
          <span className="toolbar__spacer" />
          <Segmented
            label="Density"
            options={DENSITY_OPTIONS}
            value={density}
            onChange={setDensity}
          />
          <Segmented label="Data" options={MODE_OPTIONS} value={mode} onChange={changeMode} />
          <Segmented label="Updates" options={REFLOW_OPTIONS} value={reflow} onChange={setReflow} />
          <Segmented label="Align" options={ALIGN_OPTIONS} value={align} onChange={setAlign} />
          <label className="toggle">
            <input
              type="checkbox"
              checked={realtime}
              onChange={event => setRealtime(event.target.checked)}
            />
            Realtime
          </label>
        </div>
        <ItemsGrid<Entity>
          ref={grid}
          className="app__grid"
          aria-label="Entities"
          items={items}
          getKey={entity => entity.id}
          mode={mode}
          total={mode === 'server' ? server.total : undefined}
          loading={mode === 'server' && server.loading}
          preset={density}
          reflow={reflow}
          align={align}
          onPageRequest={onPageRequest}
          onStateChange={state => setPendingCount(state.pendingCount)}
          renderItem={entity => <Card entity={entity} size={density} onToggle={toggle} />}
          renderSkeleton={() => <SkeletonCard />}
          renderEmpty={() => <EmptyState />}
        />
      </main>
    </div>
  );
}
