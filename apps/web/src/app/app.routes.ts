import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage) },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about.page').then((m) => m.AboutPage),
  },
];
