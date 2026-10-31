import { Component, input } from '@angular/core';
import { MfItemsGrid, MfItemsGridItem } from '@mellowforge/items-grid-angular';

interface Device {
  id: string;
  name: string;
  status: string;
}

@Component({
  selector: 'app-devices',
  imports: [MfItemsGrid, MfItemsGridItem],
  template: `
    <mf-items-grid
      class="devices-grid"
      ariaLabel="Devices"
      [items]="devices()"
      [getKey]="byId"
      preset="compact"
      [arrowKeys]="true"
    >
      <ng-template mfItemsGridItem [mfItemsGridItemOf]="devices()" let-device>
        <article class="device-card">
          <h3>{{ device.name }}</h3>
          <p>{{ device.status }}</p>
        </article>
      </ng-template>
    </mf-items-grid>
  `,
  // The grid fills the height your layout gives it: here, what a flex column leaves.
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .devices-grid {
      flex: 1;
      min-height: 0;
    }
  `,
})
export class Devices {
  readonly devices = input.required<Device[]>();
  readonly byId = (device: Device) => device.id;
}
