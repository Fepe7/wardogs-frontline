import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { FrontlineMark } from './frontline-mark';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, TranslocoPipe, FrontlineMark],
  template: `
    <header class="border-b border-grid">
      <div class="mx-auto flex max-w-6xl items-center px-4 py-3 sm:px-6">
        <a
          routerLink="/"
          [attr.aria-label]="'site.home' | transloco"
          class="flex items-center gap-3 font-display text-2xl font-extrabold tracking-wide"
        >
          <app-frontline-mark class="size-8" />
          {{ 'site.name' | transloco }}
        </a>
      </div>
    </header>
  `,
})
export class SiteHeader {}
