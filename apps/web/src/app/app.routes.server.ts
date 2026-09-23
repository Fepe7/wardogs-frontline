import type { ServerRoute } from '@angular/ssr';
import { RenderMode } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Static pages, rendered at build time: fast, and crawlers read their meta tags.
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  // Unknown addresses are rendered on request so the server can answer 404.
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
