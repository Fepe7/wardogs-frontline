import type { ServerRoute } from '@angular/ssr';
import { RenderMode } from '@angular/ssr';
import { initialWarMap } from '@frontline/core';

export const serverRoutes: ServerRoute[] = [
  // Static pages, rendered at build time: fast, and crawlers read their meta tags.
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  // One page per sector of the map, so each shared link has its own preview.
  {
    path: 'sector/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: () => Promise.resolve(initialWarMap().map((sector) => ({ id: sector.id }))),
  },
  // Unknown addresses are rendered on request so the server can answer 404.
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
