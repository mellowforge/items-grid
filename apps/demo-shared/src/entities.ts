/** Card status, mapped to a badge colour. */
export type EntityStatus = 'ok' | 'warn' | 'error' | 'idle';

/** The sample entity kinds from the Figma prototypes. */
export type EntityKind = 'device' | 'job' | 'service' | 'account';

/** One card's data. Every field the demos render comes from here. */
export interface Entity {
  readonly id: string;
  readonly kind: EntityKind;
  readonly title: string;
  readonly subtitle: string;
  readonly status: EntityStatus;
  readonly statusLabel: string;
  /** One-line summary for compact cards. */
  readonly summary: string;
  readonly details: readonly (readonly [label: string, value: string])[];
  /** 0–1, jobs only. */
  readonly progress?: number;
  readonly toggleLabel: string;
  readonly enabled: boolean;
  readonly actions: readonly [string, string];
}

const KINDS: readonly EntityKind[] = ['device', 'service', 'job', 'account'];
const SITES = ['Warehouse B', 'Plant 3', 'HQ', 'Depot North', 'Lab 7'];
const REGIONS = ['eu-west-1', 'us-east-2', 'ap-south-1'];
const SERVICES = ['payments-api', 'search', 'auth', 'billing-worker', 'notifier', 'ledger'];
const COMPANIES = ['Northwind Ltd.', 'Contoso', 'Fabrikam', 'Tailspin', 'Woodgrove', 'Litware'];

const STATUS_LABELS: Record<EntityKind, Record<EntityStatus, string>> = {
  device: { ok: 'Online', warn: 'Unstable', error: 'Offline', idle: 'Idle' },
  job: { ok: 'Running', warn: 'Retrying', error: 'Failed', idle: 'Queued' },
  service: { ok: 'Healthy', warn: 'Degraded', error: 'Down', idle: 'Paused' },
  account: { ok: 'Active', warn: 'Trial', error: 'Past due', idle: 'Dormant' },
};

/** Small deterministic PRNG, so every demo starts from identical data. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(random: () => number, values: readonly T[]): T =>
  values[Math.floor(random() * values.length)]!;

function pickStatus(random: () => number): EntityStatus {
  const roll = random();
  return roll < 0.62 ? 'ok' : roll < 0.8 ? 'warn' : roll < 0.9 ? 'error' : 'idle';
}

/** Returns `entity` with a new status and the matching label. */
export function withStatus(entity: Entity, status: EntityStatus): Entity {
  return { ...entity, status, statusLabel: STATUS_LABELS[entity.kind][status] };
}

/** Creates entity number `serial`; `random` decides everything but the kind. */
export function createEntity(serial: number, random: () => number): Entity {
  const kind = KINDS[serial % KINDS.length]!;
  const status = pickStatus(random);
  const statusLabel = STATUS_LABELS[kind][status];
  const id = `${kind}-${serial}`;
  switch (kind) {
    case 'device': {
      const ip = `10.4.${Math.floor(random() * 250)}.${Math.floor(random() * 250)}`;
      const seen = `${Math.floor(random() * 59) + 1}s ago`;
      return {
        id,
        kind,
        title: `Gateway-${String(serial).padStart(3, '0')}`,
        subtitle: `${pick(random, SITES)} · Rack ${Math.floor(random() * 9) + 1}`,
        status,
        statusLabel,
        summary: `${ip} · seen ${seen}`,
        details: [
          ['IP address', ip],
          ['Firmware', `3.${Math.floor(random() * 4)}.${Math.floor(random() * 9)}`],
          ['Last seen', seen],
        ],
        toggleLabel: 'Monitoring',
        enabled: random() > 0.3,
        actions: ['Restart', 'Details'],
      };
    }
    case 'job': {
      const progress = Math.round(random() * 100) / 100;
      return {
        id,
        kind,
        title: `Nightly build #${400 + serial}`,
        subtitle: `main · ci-runner-${Math.floor(random() * 8) + 1}`,
        status,
        statusLabel,
        summary: `${Math.round(progress * 100)}% · ETA ${Math.floor(random() * 20) + 1} min`,
        details: [
          [
            'Started',
            `0${Math.floor(random() * 9)}:${String(Math.floor(random() * 60)).padStart(2, '0')}`,
          ],
          ['ETA', `${Math.floor(random() * 20) + 1} min`],
        ],
        progress,
        toggleLabel: 'Notify me',
        enabled: random() > 0.6,
        actions: ['Cancel', 'Logs'],
      };
    }
    case 'service': {
      const latency = Math.floor(random() * 600) + 40;
      const errors = (random() * 4).toFixed(1);
      return {
        id,
        kind,
        title: `${pick(random, SERVICES)}-${serial}`,
        subtitle: `${pick(random, REGIONS)} · v2.${Math.floor(random() * 20)}`,
        status,
        statusLabel,
        summary: `p95 ${latency} ms · ${errors}% err`,
        details: [
          ['p95 latency', `${latency} ms`],
          ['Error rate', `${errors}%`],
          ['Pods ready', `${Math.floor(random() * 3) + 6} / 8`],
        ],
        toggleLabel: 'Alerts',
        enabled: random() > 0.2,
        actions: ['Silence', 'Runbook'],
      };
    }
    case 'account': {
      const mrr = `$${(Math.floor(random() * 90) + 10) * 100}`;
      const company = pick(random, COMPANIES);
      return {
        id,
        kind,
        title: `${company} #${serial}`,
        subtitle: `Enterprise · ${Math.floor(random() * 90) + 10} seats`,
        status,
        statusLabel,
        summary: `Renews Nov ${Math.floor(random() * 28) + 1} · ${mrr}`,
        details: [
          ['Renewal', `Nov ${Math.floor(random() * 28) + 1}`],
          ['MRR', mrr],
          ['Owner', `ops@${company.split(' ')[0]!.toLowerCase()}.test`],
        ],
        toggleLabel: 'Auto-renew',
        enabled: random() > 0.5,
        actions: ['Contact', 'Open'],
      };
    }
  }
}

/** The demo dataset: `count` entities from a fixed seed. */
export function createEntities(count: number, seed = 24): Entity[] {
  const random = createRandom(seed);
  return Array.from({ length: count }, (_, serial) => createEntity(serial, random));
}
