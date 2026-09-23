import { DOCUMENT, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LANGUAGES, type Language } from './i18n';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslocoPipe],
  template: `
    <div role="group" [attr.aria-label]="'footer.language' | transloco" class="flex gap-3">
      @for (language of languages; track language) {
        <button
          type="button"
          [attr.lang]="language"
          [attr.aria-pressed]="active() === language"
          (click)="use(language)"
          class="underline-offset-4 hover:underline aria-pressed:font-semibold aria-pressed:text-chalk"
        >
          {{ 'languages.' + language | transloco }}
        </button>
      }
    </div>
  `,
})
export class LanguageSwitcher {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  protected readonly languages = LANGUAGES;
  protected readonly active = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected use(language: Language): void {
    this.transloco.setActiveLang(language);
    // Screen readers pick the pronunciation from the page language.
    this.document.documentElement.lang = language;
  }
}
