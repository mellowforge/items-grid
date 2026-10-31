import type { PageRequest } from '@mellowforge/items-grid-core';

import type { Entity } from './entities';

/** A fake API response. */
export interface PageResponse {
  readonly items: Entity[];
  readonly total: number;
}

/**
 * Share of requests the fake API fails, from the page URL's `?fail=` parameter (e.g.
 * `?fail=0.3`), so the demos' error and retry path can be tried by hand. Default 0.
 */
export function demoFailureRate(): number {
  const raw = new URLSearchParams(globalThis.location?.search ?? '').get('fail');
  if (raw === null) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    console.warn(`demo: ?fail=${raw} is not a share between 0 and 1 (e.g. 0.3); ignoring it.`);
    return 0;
  }
  return value;
}

/**
 * Serves one page of `database` after `latencyMs`, like a paged REST endpoint would; fails
 * with the given probability.
 */
export function fetchPage(
  database: readonly Entity[],
  request: PageRequest,
  latencyMs = 450,
  failureRate = demoFailureRate()
): Promise<PageResponse> {
  const start = request.pageIndex * request.pageSize;
  const response: PageResponse = {
    items: database.slice(start, start + request.pageSize),
    total: database.length,
  };
  const fails = Math.random() < failureRate;
  return new Promise((resolve, reject) =>
    setTimeout(
      () =>
        fails
          ? reject(new Error(`Page ${request.pageIndex + 1} failed to load`))
          : resolve(response),
      latencyMs
    )
  );
}
