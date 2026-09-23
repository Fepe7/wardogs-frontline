import type { Routes } from '@angular/router';
import type { SeoPage } from './core/seo/seo';

const page = (name: SeoPage) => ({ page: name });

export const routes: Routes = [
  {
    path: '',
    data: page('home'),
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'about',
    data: page('about'),
    loadComponent: () => import('./features/about/about.page').then((m) => m.AboutPage),
  },
  {
    path: 'sector/:id',
    data: page('sector'),
    loadComponent: () => import('./features/sector/sector.page').then((m) => m.SectorPage),
  },
  {
    path: '**',
    data: page('notFound'),
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
