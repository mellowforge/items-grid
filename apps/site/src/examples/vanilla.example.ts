import '@mellowforge/items-grid-core/styles.css'; // optional pager and focus-ring theme

import { mountItemsGrid } from '@mellowforge/items-grid-core';

interface Device {
  id: string;
  name: string;
  status: string;
}

function renderDevice(device: Device): HTMLElement {
  const card = document.createElement('article');
  card.className = 'device-card';
  const name = document.createElement('h3');
  name.textContent = device.name;
  const status = document.createElement('p');
  status.textContent = device.status;
  card.append(name, status);
  return card;
}

// The container needs a definite height from your layout (e.g. flex: 1; min-height: 0).
export function showDevices(container: HTMLElement, devices: Device[]) {
  const grid = mountItemsGrid(container, {
    ariaLabel: 'Devices',
    items: devices,
    getKey: device => device.id,
    preset: 'compact',
    arrowKeys: true,
    renderItem: renderDevice,
  });
  // Realtime updates: pass a new array. Unchanged items keep their card; pass updateItem to
  // patch a changed card in place.
  return (next: Device[]) => grid.update({ items: next });
}
