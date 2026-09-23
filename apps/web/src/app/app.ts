import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { DemoBanner } from './features/demo/demo-banner';
import { SiteFooter } from './core/layout/site-footer';
import { SiteHeader } from './core/layout/site-header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DemoBanner, SiteHeader, SiteFooter],
  host: { class: 'flex min-h-dvh flex-col' },
  template: `
    @if (demoMode) {
      <app-demo-banner />
    }
    <app-site-header />
    <main class="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
      <router-outlet />
    </main>
    <app-site-footer />
  `,
})
export class App {
  protected readonly demoMode = environment.demoMode;
}
