import { Component, computed, input } from '@angular/core';

/** A non-breaking space, so a blank tile keeps its size. */
const BLANK_TILE = '\u00a0';

/**
 * Text on split-flap tiles, like a departure board. A tile flips when its character
 * changes, so a new score or a new owner is seen arriving rather than just replacing
 * the old one. Screen readers get the plain text; the tiles are decorative.
 */
@Component({
  selector: 'app-flap-text',
  host: { class: 'inline-flex' },
  template: `
    <span class="sr-only">{{ label() ?? text() }}</span>
    <span aria-hidden="true" class="inline-flex gap-[0.08em]">
      <!-- Tracked by position and character: a changed character is a new tile that flips in. -->
      @for (char of chars(); track $index + char) {
        <span class="flap" [style.--i]="$index">{{ char }}</span>
      }
    </span>
  `,
  styles: `
    .flap {
      position: relative;
      display: inline-grid;
      place-items: center;
      width: 0.9em;
      height: 1.35em;
      border-radius: 2px;
      /* Two halves: the upper flap catches a little more light than the lower one. */
      background: linear-gradient(#302f29 50%, #292822 50%);
      color: inherit;
      font-family: var(--font-data);
      font-stretch: 75%;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      text-transform: uppercase;
      box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.5);
      animation: flap-in 300ms var(--ease-out) both;
      animation-delay: calc(var(--i) * 28ms);
    }
    /* The hinge gap between the two halves, in the color of the wall behind the board. */
    .flap::after {
      content: '';
      position: absolute;
      inset: calc(50% - 1px) 0 auto;
      height: 2px;
      background: var(--color-table);
    }
    @keyframes flap-in {
      from {
        transform: perspective(12em) rotateX(-75deg);
        opacity: 0.2;
      }
    }
  `,
})
export class FlapText {
  readonly text = input.required<string>();
  /** What screen readers hear, when the tiles alone would be ambiguous (e.g. "02:41"). */
  readonly label = input<string>();

  protected readonly chars = computed(() =>
    Array.from(this.text(), (char) => (char === ' ' ? BLANK_TILE : char)),
  );
}
