import { Component, input, output } from '@angular/core';

/** A labelled group of toggle buttons; the pressed one is the current value. */
@Component({
  selector: 'app-segmented',
  host: { class: 'control' },
  template: `
    <span>{{ label() }}</span>
    <div class="segmented" role="group" [attr.aria-label]="label()">
      @for (option of options(); track option.value) {
        <button
          type="button"
          class="segmented__option"
          [attr.aria-pressed]="option.value === value()"
          (click)="valueChange.emit(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class Segmented<V extends string> {
  readonly label = input.required<string>();
  readonly options = input.required<readonly { value: V; label: string }[]>();
  readonly value = input.required<V>();
  readonly valueChange = output<V>();
}
