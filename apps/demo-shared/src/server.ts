import type { PageRequest } from '@quietfoundry/items-grid-core';

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
  const value = Number(new URLSearchParams(globalThis.location?.search ?? '').get('fail'));
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
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
