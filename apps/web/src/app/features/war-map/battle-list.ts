import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { OpenBattle, SectorId } from '@frontline/core';
import { FactionSwatch } from './faction-swatch';

@Component({
  selector: 'app-battle-list',
  imports: [DatePipe, TranslocoPipe, FactionSwatch],
  template: `
    <h3 class="font-display text-2xl font-bold">{{ 'warMap.battlesTitle' | transloco }}</h3>
    @if (battles().length === 0) {
      <p class="mt-3 text-chalk-muted">{{ 'warMap.noBattles' | transloco }}</p>
    } @else {
      <ul class="mt-4 space-y-5">
        @for (battle of battles(); track battle.id) {
          <li class="border-l-2 border-chalk pl-4">
            <p class="font-display text-xl font-bold">
              {{ sectorNames().get(battle.sectorId) ?? battle.sectorId }}
            </p>
            <table class="mt-2 w-full text-sm">
              <caption class="sr-only">
                {{
                  'warMap.score' | transloco
                }}
              </caption>
              <tbody>
                @for (side of sides(battle); track side.role) {
                  <tr>
                    <th scope="row" class="py-0.5 text-left font-normal">
                      <span class="flex items-center gap-2">
                        <app-faction-swatch [faction]="side.faction" class="size-4" />
                        {{ 'factions.' + side.faction | transloco }}
                        <span class="text-chalk-muted">{{
                          'warMap.' + side.role | transloco
                        }}</span>
                      </span>
                    </th>
                    <td class="py-0.5 text-right font-semibold tabular-nums">{{ side.points }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="mt-1 text-sm text-chalk-muted">
              {{ 'warMap.endsAt' | transloco: { time: (battle.endsAt | date: 'd/M HH:mm') } }}
            </p>
          </li>
        }
      </ul>
    }
  `,
})
export class BattleList {
  readonly battles = input.required<readonly OpenBattle[]>();
  readonly sectorNames = input.required<ReadonlyMap<SectorId, string>>();

  protected sides(battle: OpenBattle) {
    return [
      { role: 'attacker', faction: battle.attacker, points: battle.points.attacker },
      { role: 'defender', faction: battle.defender, points: battle.points.defender },
    ] as const;
  }
}
