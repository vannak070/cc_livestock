import type { PoolClient } from 'pg';
import { query } from '../config/database';

// A farm is identified by its name everywhere: cattle, batches, feed
// movements and people all store the name. These queries keep every one of
// those places in step when a farm is renamed, and count what still depends
// on a farm before it can be deleted.
export class FarmRepository {
  private async run(sql: string, params: unknown[], client?: PoolClient) {
    return client ? client.query(sql, params) : query(sql, params);
  }

  async countActiveCattle(farm: string, client?: PoolClient): Promise<number> {
    const res = await this.run("SELECT COUNT(*)::int AS n FROM stock WHERE location = $1 AND LOWER(COALESCE(status, 'active')) = 'active'", [farm], client);
    return res.rows[0].n as number;
  }

  async countActiveBatches(farm: string, client?: PoolClient): Promise<number> {
    const res = await this.run("SELECT COUNT(*)::int AS n FROM batches WHERE farm_location = $1 AND status = 'Active'", [farm], client);
    return res.rows[0].n as number;
  }

  /** Everyone assigned to the farm, the owner included. */
  async countPeople(farm: string, client?: PoolClient): Promise<number> {
    const res = await this.run('SELECT COUNT(*)::int AS n FROM users WHERE farm_location = $1', [farm], client);
    return res.rows[0].n as number;
  }

  /** Moves everything that points at a farm to its new name. */
  async renameEverywhere(oldName: string, newName: string, client?: PoolClient): Promise<void> {
    await this.run('UPDATE stock SET location = $1 WHERE location = $2', [newName, oldName], client);
    await this.run('UPDATE batches SET farm_location = $1 WHERE farm_location = $2', [newName, oldName], client);
    await this.run('UPDATE feed_transactions SET source_farm = $1 WHERE source_farm = $2', [newName, oldName], client);
    await this.run('UPDATE feed_transactions SET target_farm = $1 WHERE target_farm = $2', [newName, oldName], client);
    await this.run('UPDATE users SET farm_location = $1 WHERE farm_location = $2', [newName, oldName], client);
    await this.run('UPDATE farm_costs SET farm_location = $1 WHERE farm_location = $2', [newName, oldName], client);
  }
}

export const farmRepository = new FarmRepository();
