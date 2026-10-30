import type { PageRequest } from '@quietfoundry/items-grid-core';

import type { Entity } from './entities';

/** A fake API response. */
export interface PageResponse {
  readonly items: Entity[];
  readonly total: number;
}

/** Serves one page of `database` after `latencyMs`, like a paged REST endpoint would. */
export function fetchPage(
  database: readonly Entity[],
  request: PageRequest,
  latencyMs = 450
): Promise<PageResponse> {
  const start = request.pageIndex * request.pageSize;
  const response: PageResponse = {
    items: database.slice(start, start + request.pageSize),
    total: database.length,
  };
  return new Promise(resolve => setTimeout(() => resolve(response), latencyMs));
}
