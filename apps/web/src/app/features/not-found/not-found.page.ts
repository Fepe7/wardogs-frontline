import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/** Any unknown address. The server answers it with HTTP 404 (app.routes.server.ts). */
@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <section class="max-w-prose py-12 sm:py-20">
      <p
        class="inline-block bg-signal px-2 py-1 text-xs font-bold tracking-[0.2em] text-table uppercase"
      >
        404
      </p>
      <h1 class="mt-5 font-display text-4xl leading-[0.95] font-black text-balance sm:text-6xl">
        {{ 'notFound.title' | transloco }}
      </h1>
      <p class="mt-6 text-lg text-chalk-muted">{{ 'notFound.text' | transloco }}</p>
      <a
        routerLink="/"
        class="mt-8 inline-block bg-signal px-4 py-2 text-sm font-bold tracking-[0.15em] text-table uppercase hover:bg-chalk"
      >
        {{ 'notFound.back' | transloco }}
      </a>
    </section>
  `,
})
export class NotFoundPage {}
