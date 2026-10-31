import '@mellowforge/items-grid-core/styles.css'; // optional pager theme

import { ItemsGrid } from '@mellowforge/items-grid-react';

interface Device {
  id: string;
  name: string;
  status: string;
}

export function Devices({ devices }: { devices: Device[] }) {
  return (
    <ItemsGrid
      // The grid fills the height your layout gives it: here, what a flex column leaves.
      style={{ flex: 1, minHeight: 0 }}
      aria-label="Devices"
      items={devices}
      getKey={device => device.id}
      preset="compact"
      arrowKeys
      renderItem={device => (
        <article className="device-card">
          <h3>{device.name}</h3>
          <p>{device.status}</p>
        </article>
      )}
    />
  );
}
