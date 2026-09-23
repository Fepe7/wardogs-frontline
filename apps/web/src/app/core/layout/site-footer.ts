import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageSwitcher } from '../i18n/language-switcher';

/** The fan-made disclaimer is required on every page (CLAUDE.md, red lines). */
@Component({
  selector: 'app-site-footer',
  imports: [TranslocoPipe, LanguageSwitcher],
  template: `
    <footer class="border-t border-grid">
      <div
        class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-chalk-muted sm:flex-row sm:items-start sm:justify-between sm:px-6"
      >
        <p class="max-w-prose">{{ 'footer.disclaimer' | transloco }}</p>
        <app-language-switcher />
      </div>
    </footer>
  `,
})
export class SiteFooter {}
