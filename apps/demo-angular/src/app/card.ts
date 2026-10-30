import { Component, computed, input, output } from '@angular/core';
import { type CardSize, cardView, type Entity } from 'demo-shared';

/** The Figma sample card — app-side markup, styled by demo-shared/demo.css. */
@Component({
  selector: 'article[appCard]',
  host: {
    '[class]': "'card card--' + size()",
    '[attr.data-id]': 'entity().id',
  },
  template: `
    <header class="card__header">
      <div class="card__titles">
        <h3 class="card__title">{{ entity().title }}</h3>
        @if (view().showSubtitle) {
          <p class="card__subtitle">{{ entity().subtitle }}</p>
        }
      </div>
      <span [class]="'badge badge--' + entity().status">
        <span class="badge__dot"></span>
        <span [class]="size() === 'compact' ? 'badge__label visually-hidden' : 'badge__label'">{{
          entity().statusLabel
        }}</span>
      </span>
    </header>
    <div class="card__body">
      @if (view().showSummary) {
        <p class="card__summary">{{ entity().summary }}</p>
      }
      @if (view().showProgress) {
        <div class="progress" role="progressbar" aria-label="Progress">
          <div class="progress__value" [style.width.%]="progressPercent()"></div>
        </div>
      }
      @if (view().details.length) {
        <dl class="card__details">
          @for (detail of view().details; track detail[0]) {
            <div class="card__detail">
              <dt>{{ detail[0] }}</dt>
              <dd>{{ detail[1] }}</dd>
            </div>
          }
        </dl>
      }
    </div>
    <footer class="card__footer">
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          [checked]="entity().enabled"
          (change)="toggled.emit($any($event.target).checked)"
        />
        <span class="switch__track"></span>
        <span [class]="view().showToggleLabel ? 'switch__label' : 'visually-hidden'">{{
          view().showToggleLabel
            ? entity().toggleLabel
            : entity().toggleLabel + ' for ' + entity().title
        }}</span>
      </label>
      <span class="card__spacer"></span>
      @if (view().showActions) {
        @for (action of entity().actions; track action) {
          <button type="button" class="card__action">{{ action }}</button>
        }
      } @else {
        <button
          type="button"
          class="card__more"
          [attr.aria-label]="'More actions for ' + entity().title"
        >
          ⋮
        </button>
      }
    </footer>
  `,
})
export class Card {
  readonly entity = input.required<Entity>();
  readonly size = input.required<CardSize>();
  readonly toggled = output<boolean>();

  protected readonly view = computed(() => cardView(this.entity(), this.size()));
  protected readonly progressPercent = computed(() =>
    Math.round((this.entity().progress ?? 0) * 100),
  );
}
