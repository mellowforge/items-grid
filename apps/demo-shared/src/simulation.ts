import { createEntity, createRandom, type Entity, type EntityStatus, withStatus } from './entities';

/** What one simulation tick did, for the demo's activity hint. */
export type SimulationEvent = 'status' | 'progress' | 'insert' | 'remove';

const STATUSES: readonly EntityStatus[] = ['ok', 'warn', 'error', 'idle'];

/**
 * Applies one realtime update to `entities` and returns the new array (never mutates):
 * mostly status flips and job progress, sometimes a new entity at the front or a removal.
 */
export function tick(
  entities: readonly Entity[],
  random: () => number,
  nextSerial: () => number
): { entities: Entity[]; event: SimulationEvent } {
  const next = [...entities];
  const roll = random();
  const index = Math.floor(random() * next.length);
  const target = next[index];
  if (roll < 0.12 || !target) {
    next.unshift(createEntity(nextSerial(), random));
    return { entities: next, event: 'insert' };
  }
  if (roll < 0.2 && next.length > 1) {
    next.splice(index, 1);
    return { entities: next, event: 'remove' };
  }
  if (roll < 0.45 && target.progress !== undefined) {
    const progress = Math.min(1, Math.round((target.progress + 0.07) * 100) / 100);
    next[index] = { ...target, progress, summary: `${Math.round(progress * 100)}% · running` };
    return { entities: next, event: 'progress' };
  }
  const status = STATUSES.filter(candidate => candidate !== target.status)[
    Math.floor(random() * (STATUSES.length - 1))
  ]!;
  next[index] = withStatus(target, status);
  return { entities: next, event: 'status' };
}

/** Options for {@link startSimulation}. */
export interface SimulationOptions {
  /** Reads the current dataset. */
  read(): readonly Entity[];
  /** Receives the updated dataset. */
  write(entities: Entity[], event: SimulationEvent): void;
  /** Milliseconds between updates. Default 1200. */
  intervalMs?: number;
  seed?: number;
}

/** Starts applying realtime updates. Returns the stop function. */
export function startSimulation(options: SimulationOptions): () => void {
  const random = createRandom(options.seed ?? 7);
  let serial = 10_000;
  const timer = setInterval(() => {
    const { entities, event } = tick(options.read(), random, () => serial++);
    options.write(entities, event);
  }, options.intervalMs ?? 1200);
  return () => clearInterval(timer);
}
