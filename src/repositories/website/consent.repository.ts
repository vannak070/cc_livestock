import type { PoolClient, QueryResultRow } from 'pg';
import type { WebsiteConsent } from '../../lib/types';
import type { ConsentInput } from '../../lib/website';
import { day, iso, run } from './shared';

/** Farmers' agreements to be shown on the website (table website_consents). Never deleted. */
export class WebsiteConsentRepository {
  private map(row: QueryResultRow): WebsiteConsent {
    return {
      id: row.id,
      farmId: row.farm_id,
      givenByName: row.given_by_name,
      givenOn: day(row.given_on)!,
      method: row.method,
      mayShowName: !!row.may_show_name,
      mayShowPhotos: !!row.may_show_photos,
      mayShowExactLocation: !!row.may_show_exact_location,
      recordedBy: row.recorded_by || '',
      recordedAt: iso(row.recorded_at)!,
      ...(row.withdrawn_on ? { withdrawnOn: day(row.withdrawn_on) } : {}),
      ...(row.withdrawn_by ? { withdrawnBy: row.withdrawn_by } : {}),
    };
  }

  async findAll(): Promise<WebsiteConsent[]> {
    const res = await run('SELECT * FROM website_consents ORDER BY given_on DESC, recorded_at DESC', []);
    return res.rows.map(r => this.map(r));
  }

  async findByFarm(farmId: string, client?: PoolClient): Promise<WebsiteConsent[]> {
    const res = await run('SELECT * FROM website_consents WHERE farm_id = $1 ORDER BY given_on DESC, recorded_at DESC', [farmId], client);
    return res.rows.map(r => this.map(r));
  }

  async create(id: string, farmId: string, input: ConsentInput, by: string, client?: PoolClient): Promise<WebsiteConsent> {
    const res = await run(
      `INSERT INTO website_consents (id, farm_id, given_by_name, given_on, method, may_show_name, may_show_photos, may_show_exact_location, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, farmId, input.givenByName.trim(), input.givenOn, input.method, input.mayShowName, input.mayShowPhotos, input.mayShowExactLocation, by],
      client
    );
    return this.map(res.rows[0]);
  }

  /** Withdraws every consent in force for the farm. */
  async withdrawAll(farmId: string, onDay: string, by: string, client?: PoolClient): Promise<number> {
    const res = await run('UPDATE website_consents SET withdrawn_on = $2, withdrawn_by = $3 WHERE farm_id = $1 AND withdrawn_on IS NULL', [farmId, onDay, by], client);
    return res.rowCount ?? 0;
  }
}

export const websiteConsentRepository = new WebsiteConsentRepository();
