import { DestroyRef, inject, Service } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router, type ActivatedRouteSnapshot } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { combineLatest, filter, map, startWith, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Pages with their own title and description (`meta.<page>` in the translations). */
export type SeoPage = 'home' | 'about' | 'notFound';

interface PageMeta {
  readonly title: string;
  readonly description: string;
}

const OG_IMAGE = 'og-image.png';

/** The page of the deepest active route, from its `data.page`; home by default. */
const pageOf = (route: ActivatedRouteSnapshot): SeoPage => {
  let deepest = route;
  while (deepest.firstChild) deepest = deepest.firstChild;
  return (deepest.data['page'] as SeoPage | undefined) ?? 'home';
};

const absolute = (path: string): string =>
  environment.siteUrl ? new URL(path, environment.siteUrl).toString() : path;

/**
 * Keeps the document title, description and link-preview tags (Open Graph) in step with
 * the current page and language. Pages are prerendered on the server, so crawlers and
 * chat apps read the tags without running any JavaScript.
 */
@Service()
export class Seo {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly destroyRef = inject(DestroyRef);

  start(): void {
    const page$ = this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => pageOf(this.router.routerState.snapshot.root)),
    );
    const subscription = combineLatest([page$, this.transloco.langChanges$])
      .pipe(switchMap(([page]) => this.transloco.selectTranslateObject<PageMeta>(`meta.${page}`)))
      .subscribe((pageMeta) => {
        this.apply(pageMeta);
      });
    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
    });
  }

  private apply({ title, description }: PageMeta): void {
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: absolute(OG_IMAGE) });
    this.meta.updateTag({ property: 'og:url', content: absolute(this.router.url) });
  }
}
