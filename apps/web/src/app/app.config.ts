import type { ApplicationConfig } from '@angular/core';
import { inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideI18n } from './core/i18n/i18n';
import { Seo } from './core/seo/seo';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Route parameters arrive as component inputs (e.g. the sector id).
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(),
    provideI18n(),
    provideAppInitializer(() => {
      inject(Seo).start();
    }),
  ],
};
