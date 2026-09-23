declare const brand: unique symbol;

/**
 * Nominal type on top of a primitive, so a `SectorId` can never be passed where
 * a `BattleId` is expected even though both are strings at runtime.
 */
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };
