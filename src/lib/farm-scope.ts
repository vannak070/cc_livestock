/**
 * How a user tied to one farm is matched against records. The same rule exists
 * twice, on purpose: `farmMatcher` for data already in memory and
 * `farmMatchSql` for filtering inside PostgreSQL. farm-scope.test.ts checks
 * (against a real database in `npm run test:db`) that they select the same rows.
 *
 * Names compare case- and whitespace-insensitively, and the Rotang farm is
 * known by two spellings, the Khmer name and any "...snr..." name, which count
 * as the same farm.
 */
export interface FarmScope {
  farmLocation: string;
}

const ROTANG_KM = 'រទាំង';

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function isRotang(normalised: string): boolean {
  return normalised === ROTANG_KM || normalised.includes('snr');
}

export function farmMatcher(farmLocation: string) {
  const f = normalise(farmLocation);
  return (loc?: string | null) => {
    if (!loc) return false;
    const l = normalise(loc);
    if (l === f) return true;
    return isRotang(f) && isRotang(l);
  };
}

/** Narrows an actor to a scope, or undefined when they are not tied to a farm (sees everything). */
export function scopeFor(actor: { farmLocation?: string | null }): FarmScope | undefined {
  return actor.farmLocation ? { farmLocation: actor.farmLocation } : undefined;
}

/**
 * SQL predicate that is true for rows whose `column` matches the farm.
 * `column` must be a trusted identifier from our own code, never user input;
 * the farm name itself is always passed as a bind parameter. The parameter is
 * numbered `$<nextParam>` and returned in `params`.
 */
export function farmMatchSql(column: string, farmLocation: string, nextParam: number): { sql: string; params: unknown[] } {
  const f = normalise(farmLocation);
  const lowered = `LOWER(BTRIM(${column}, E' \\t\\r\\n'))`;
  const rotang = isRotang(f) ? ` OR ${lowered} = '${ROTANG_KM}' OR ${lowered} LIKE '%snr%'` : '';
  return {
    sql: `(COALESCE(${column}, '') <> '' AND (${lowered} = $${nextParam}${rotang}))`,
    params: [f]
  };
}
