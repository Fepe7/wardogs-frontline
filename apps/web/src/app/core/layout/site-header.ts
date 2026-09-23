import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { FrontlineMark } from './frontline-mark';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, FrontlineMark],
  template: `
    <header class="border-b border-grid">
      <div
        class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6"
      >
        <a
          routerLink="/"
          [attr.aria-label]="'site.home' | transloco"
          class="flex items-center gap-3 font-display text-2xl font-extrabold tracking-wide"
        >
          <app-frontline-mark class="size-8" />
          {{ 'site.name' | transloco }}
        </a>
        <nav [attr.aria-label]="'site.nav' | transloco">
          <ul class="flex gap-5">
            @for (link of links; track link.path) {
              <li>
                <a
                  [routerLink]="link.path"
                  routerLinkActive="text-signal! underline"
                  ariaCurrentWhenActive="page"
                  [routerLinkActiveOptions]="{ exact: true }"
                  class="text-sm font-semibold tracking-[0.15em] text-chalk-muted uppercase underline-offset-8 hover:text-chalk"
                >
                  {{ link.label | transloco }}
                </a>
              </li>
            }
          </ul>
        </nav>
      </div>
    </header>
  `,
})
export class SiteHeader {
  protected readonly links = [
    { path: '/', label: 'site.front' },
    { path: '/about', label: 'site.about' },
  ] as const;
}
