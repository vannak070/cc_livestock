import { query } from '../config/database';
import { generateTempPassword } from '../lib/generate-temp-password';
import { hashPassword, verifyPassword } from '../lib/password';
import { validatePinStrength } from '../lib/pin';
import { MasterSetup, UserRoleItem, CustomRoleDefinition, DEFAULT_ROLE_PERMISSIONS, FarmItem } from '../lib/types';
import { PoolClient } from 'pg';

const DEFAULT_ROLES: CustomRoleDefinition[] = [
  { id: 'ROLE-01', name: 'Super Admin', description: 'Full system management and security authority.', permissions: DEFAULT_ROLE_PERMISSIONS['Super Admin'], isSystem: true },
  { id: 'ROLE-02', name: 'Admin', description: 'Full business operations control and user creation privileges.', permissions: DEFAULT_ROLE_PERMISSIONS['Admin'], isSystem: true },
  { id: 'ROLE-03', name: 'Company', description: 'Manages user accounts, permissions, and multiple farms under them.', permissions: DEFAULT_ROLE_PERMISSIONS['Company'], isSystem: true },
  { id: 'ROLE-04', name: 'Farm Owner', description: 'Full operational control and lifecycle management of their specific farm.', permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner'], isSystem: true },
  { id: 'ROLE-05', name: 'Farm Staff', description: 'Records weights, health logs, and tracks daily checklists based on custom permissions.', permissions: DEFAULT_ROLE_PERMISSIONS['Farm Staff'], isSystem: true },
  { id: 'ROLE-06', name: 'Veterinarian', description: 'Responsible for health tracking, medical records, deworming, and diagnostics.', permissions: DEFAULT_ROLE_PERMISSIONS['Veterinarian'], isSystem: true },
  { id: 'ROLE-07', name: 'Management', description: 'Read-only reporting access — no create, edit, or delete permissions. Intended for PIN sign-in on the mobile app.', permissions: DEFAULT_ROLE_PERMISSIONS['Management'], isSystem: true }
];

// Logged at most once per server process — without this guard the warning
// below would repeat on every single settings read (i.e. every page load).
let warnedNoUsers = false;

// Never send password hashes to API callers — this is applied to every
// settings.users array before it leaves the repository.
function stripUserSecrets(users: UserRoleItem[] | undefined): UserRoleItem[] {
  return (users || []).map(u => {
    const { password, pin, clearPin, ...rest } = u;
    return rest as UserRoleItem;
  });
}

// Farms used to carry a plaintext `ownerPassword` field of their own,
// duplicating (and leaking) the linked owner user's password. The owner's
// real, hashed credential lives solely on their `users` row now — never
// persist or return a plaintext password on the farm record itself.
function stripFarmSecrets(farms: FarmItem[] | undefined): FarmItem[] {
  return (farms || []).map(f => {
    const { ownerPassword, ...rest } = f as FarmItem & { ownerPassword?: string };
    return rest as FarmItem;
  });
}

/** The stored roles plus any built-in role missing by name (given a free id if its own is taken). */
export function withBuiltInRoles(roles: CustomRoleDefinition[]): CustomRoleDefinition[] {
  const out = [...roles];
  for (const role of DEFAULT_ROLES) {
    if (out.some(r => r.name === role.name)) continue;
    const id = out.some(r => r.id === role.id) ? `${role.id}-SYS` : role.id;
    out.push({ ...role, id });
  }
  return out;
}

export class SettingsRepository {
  private async executeQuery(sql: string, params?: unknown[], client?: PoolClient) {
    if (client) {
      return client.query(sql, params);
    }
    return query(sql, params);
  }

  async getSettings(): Promise<MasterSetup> {
    const res = await query("SELECT data FROM master_settings WHERE key = 'master_setup'");
    let settings: MasterSetup;

    if (res.rows.length === 0) {
      settings = {
        breeds: ['គោទន្លេ', 'កាត់ Brahman', 'កាត់ Wagyu'],
        buyTypes: ['Lumsum', 'Weight', 'Born in Farm', 'Transfer', 'Partnership'],
        healthStatuses: ['Good', 'Fair', 'Poor', 'Dead'],
        vaccineTypes: ['Foot and Mouth', 'Brucellosis', 'Anthrax', 'Dewormer A', 'Vitamin Boost'],
        feedTypes: ['Silage', 'Concentrate Feed', 'Fresh Grass', 'Hay Mix'],
        paymentMethods: ['ABA Pay', 'Cash', 'Bank Transfer'],
        sexes: ['Male', 'Female'],
        diseaseTypes: ['Foot and Mouth Disease (FMD)', 'Brucellosis', 'Anthrax', 'Pneumonia', 'Parasite Infection'],
        batchTypes: ['Fattening Program', 'Quanrantin & Vet Card', 'Selling Pool'],
        weightUnits: ['kg', 'lbs'],
        revenueTypes: ['Livestock Sale', 'Manure Sale', 'Milk Sale', 'Partnership Share'],
        purchaseTypes: ['Purchase', 'Born in Farm', 'Transfer', 'Partnership'],
        users: [],
        roles: DEFAULT_ROLES,
        farms: []
      };
    } else {
      settings = res.rows[0].data;
      if (!settings.roles || settings.roles.length === 0) {
        settings.roles = DEFAULT_ROLES;
      }
      if (!settings.farms) {
        settings.farms = [];
      }
    }

    // Self-heal: the app relies on the built-in roles by name (Farm Owner,
    // Farm Staff, Veterinarian, Admin, ...). Older versions let them be
    // deleted, and older installations predate some (Management), so any
    // that are missing are put back, the same way an
    // `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` self-heals schema.
    settings.roles = withBuiltInRoles(settings.roles!);

    const usersRes = await query('SELECT * FROM users ORDER BY created_at ASC');
    if (usersRes.rows.length === 0) {
      // No accounts exist. Report that plainly instead of auto-creating
      // placeholder staff with freshly generated passwords — that old
      // behaviour re-ran on every settings read whenever this table was
      // empty, so the "default" credentials silently changed each time and
      // the only copy of them went to a console line nobody was watching.
      // Every account in this system is now created deliberately and lives
      // in the database: the first one via `npm run create-admin`, the rest
      // through Settings once signed in.
      if (!warnedNoUsers) {
        warnedNoUsers = true;
        console.warn('[Settings] The `users` table is empty — nobody can sign in yet.');
        console.warn('[Settings] Create the first real account with:');
        console.warn('[Settings]   npm run create-admin -- <email> <password> "Full Name"');
        console.warn('[Settings] If you expected existing accounts here, this database is not the one holding your data — check DB_HOST/DB_PORT in .env.');
      }
      settings.users = [];
    } else {
      settings.users = stripUserSecrets(usersRes.rows.map(row => {
        let perms = row.permissions;
        if (typeof perms === 'string') {
          try { perms = JSON.parse(perms); } catch { perms = []; }
        }
        if (!perms || (Array.isArray(perms) && perms.length === 0)) {
          perms = DEFAULT_ROLE_PERMISSIONS[row.role] || [];
        }

        return {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          status: row.status,
          password: row.password,
          permissions: perms,
          farmLocation: row.farm_location || undefined,
          hasPin: !!row.pin_hash
        };
      }));
    }

    settings.farms = stripFarmSecrets(settings.farms);

    return settings;
  }

  // Internal-only lookup used by the auth service to verify a login. Unlike
  // getSettings(), this DOES return the password hash — callers outside the
  // auth service must never forward it anywhere.
  // Users who may sign in with a PIN. A PIN identifies as well as
  // authenticates, so every candidate has to be compared — bcrypt hashes are
  // individually salted and cannot be looked up by value. That is fine at
  // this scale (a handful of management accounts) and it keeps the PIN
  // hashed at rest like any other credential.
  async getPinEnabledUsers(): Promise<(UserRoleItem & { pinHash: string })[]> {
    const res = await query(
      "SELECT * FROM users WHERE pin_hash IS NOT NULL AND pin_hash <> '' AND status = 'Active'"
    );
    return res.rows.map(row => {
      let perms = row.permissions;
      if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch { perms = []; }
      }
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        status: row.status,
        permissions: perms || DEFAULT_ROLE_PERMISSIONS[row.role] || [],
        farmLocation: row.farm_location || undefined,
        pinHash: row.pin_hash as string
      };
    });
  }

  async setUserPinHash(email: string, pinHash: string | null): Promise<boolean> {
    const res = await query('UPDATE users SET pin_hash = $1 WHERE LOWER(email) = LOWER($2)', [pinHash, email]);
    return (res.rowCount ?? 0) > 0;
  }

  // The account behind a session token, re-read on every request so that a
  // deactivated, deleted or re-permissioned user loses access immediately
  // instead of keeping whatever their token said when it was issued.
  async getActiveUserById(id: string): Promise<UserRoleItem | null> {
    const res = await query("SELECT * FROM users WHERE id = $1 AND status = 'Active' LIMIT 1", [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    let perms = row.permissions;
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch { perms = []; }
    }
    if (!perms || (Array.isArray(perms) && perms.length === 0)) {
      perms = DEFAULT_ROLE_PERMISSIONS[row.role] || [];
    }
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      permissions: perms,
      farmLocation: row.farm_location || undefined,
      hasPin: !!row.pin_hash
    };
  }

  async getUserWithPasswordHashByEmail(email: string): Promise<(UserRoleItem & { password: string }) | null> {
    const res = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    let perms = row.permissions;
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch { perms = []; }
    }
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      password: row.password,
      permissions: perms || DEFAULT_ROLE_PERMISSIONS[row.role] || [],
      farmLocation: row.farm_location || undefined
    };
  }

  /**
   * Saves the master lists and roles. People live in the `users` table and
   * farms in their own operations, so they are never written here: a screen
   * that was open before someone else added a person cannot delete them.
   */
  async updateSettings(settings: Partial<MasterSetup>, client?: PoolClient): Promise<MasterSetup> {
    const { users: _users, ...rest } = settings as MasterSetup;
    void _users;
    await this.patchBlob(rest, client);
    return this.getSettings();
  }

  /** Merges some sections into the stored settings document, locking it so two saves cannot overwrite each other. */
  async patchBlob(patch: Partial<MasterSetup>, client?: PoolClient): Promise<void> {
    const res = await this.executeQuery("SELECT data FROM master_settings WHERE key = 'master_setup' FOR UPDATE", [], client);
    // On a brand-new database there is no document yet: start from the built-in defaults.
    const current = (res.rows.length > 0 ? res.rows[0].data : await this.getSettings()) as Partial<MasterSetup>;
    const merged: Partial<MasterSetup> = { ...current, ...patch, users: [] };
    if (merged.farms) merged.farms = stripFarmSecrets(merged.farms);
    await this.executeQuery(
      `INSERT INTO master_settings (key, data, updated_at)
       VALUES ('master_setup', $1, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(merged)],
      client
    );
  }

  // ── People: one row at a time ──────────────────────────────────────────

  private rowToUser(row: Record<string, unknown>): UserRoleItem {
    let perms = row.permissions as unknown;
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch { perms = []; }
    }
    if (!perms || (Array.isArray(perms) && perms.length === 0)) perms = DEFAULT_ROLE_PERMISSIONS[row.role as string] || [];
    return {
      id: row.id as string,
      name: row.name as string,
      email: row.email as string,
      role: row.role as string,
      status: row.status as UserRoleItem['status'],
      permissions: perms as UserRoleItem['permissions'],
      farmLocation: (row.farm_location as string) || undefined,
      hasPin: !!row.pin_hash,
    };
  }

  async findUserById(id: string, client?: PoolClient): Promise<UserRoleItem | null> {
    const res = await this.executeQuery('SELECT * FROM users WHERE id = $1', [id], client);
    return res.rows.length ? this.rowToUser(res.rows[0]) : null;
  }

  private async assertPinFree(pin: string, exceptId: string, client?: PoolClient): Promise<void> {
    const problem = validatePinStrength(pin);
    if (problem) throw new Error(`PIN: ${problem}`);
    // A PIN both identifies and authenticates on the PIN sign-in, so two accounts sharing one would be ambiguous.
    const others = await this.executeQuery("SELECT email, pin_hash FROM users WHERE pin_hash IS NOT NULL AND pin_hash <> '' AND id <> $1", [exceptId], client);
    for (const row of others.rows) {
      if (await verifyPassword(pin, row.pin_hash)) throw new Error(`That PIN is already used by ${row.email}. Every PIN must be unique.`);
    }
  }

  private mapUserWriteError(e: unknown): never {
    if ((e as { code?: string })?.code === '23505') throw new Error('Someone else already uses that email.');
    throw e;
  }

  /** Adds a person. A password is made when none is given; the plaintext is returned once so it can be handed over. */
  async createUser(user: UserRoleItem & { pin?: string }, client?: PoolClient): Promise<{ user: UserRoleItem; tempPassword?: string }> {
    const typed = (user.password || '').trim();
    const tempPassword = typed ? undefined : generateTempPassword();
    const passwordHash = await hashPassword(typed || (tempPassword as string));
    const pin = (user.pin || '').trim();
    let pinHash: string | null = null;
    if (pin) {
      await this.assertPinFree(pin, user.id, client);
      pinHash = await hashPassword(pin);
    }
    const perms = user.permissions && user.permissions.length > 0 ? user.permissions : DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    try {
      await this.executeQuery(
        `INSERT INTO users (id, name, email, role, status, password, permissions, farm_location, pin_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [user.id, user.name, user.email, user.role, user.status || 'Active', passwordHash, JSON.stringify(perms), user.farmLocation || null, pinHash],
        client
      );
    } catch (e) { this.mapUserWriteError(e); }
    return { user: (await this.findUserById(user.id, client))!, tempPassword };
  }

  /** Changes a person. A password or PIN is only touched when one is given (or the PIN is cleared). */
  async updateUser(id: string, fields: { name: string; email: string; role: string; permissions: UserRoleItem['permissions']; farmLocation?: string; password?: string; pin?: string; clearPin?: boolean }, client?: PoolClient): Promise<UserRoleItem> {
    const sets = ['name = $1', 'email = $2', 'role = $3', 'permissions = $4', 'farm_location = $5'];
    const params: unknown[] = [fields.name, fields.email, fields.role, JSON.stringify(fields.permissions || []), fields.farmLocation || null];
    const typedPassword = (fields.password || '').trim();
    if (typedPassword) { params.push(await hashPassword(typedPassword)); sets.push(`password = $${params.length}`); }
    const typedPin = (fields.pin || '').trim();
    if (fields.clearPin) { sets.push('pin_hash = NULL'); }
    else if (typedPin) { await this.assertPinFree(typedPin, id, client); params.push(await hashPassword(typedPin)); sets.push(`pin_hash = $${params.length}`); }
    params.push(id);
    try {
      const res = await this.executeQuery(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params, client);
      if (res.rows.length === 0) throw new Error('That person no longer exists.');
      return this.rowToUser(res.rows[0]);
    } catch (e) { return this.mapUserWriteError(e); }
  }

  async setUserRole(id: string, role: string, permissions: UserRoleItem['permissions'], client?: PoolClient): Promise<void> {
    await this.executeQuery('UPDATE users SET role = $1, permissions = $2 WHERE id = $3', [role, JSON.stringify(permissions || []), id], client);
  }

  async setUserStatus(id: string, status: 'Active' | 'Inactive', client?: PoolClient): Promise<void> {
    await this.executeQuery('UPDATE users SET status = $1 WHERE id = $2', [status, id], client);
  }

  async setUserPassword(id: string, plain: string, client?: PoolClient): Promise<void> {
    await this.executeQuery('UPDATE users SET password = $1 WHERE id = $2', [await hashPassword(plain), id], client);
  }

  async deleteUser(id: string, client?: PoolClient): Promise<boolean> {
    const res = await this.executeQuery('DELETE FROM users WHERE id = $1 RETURNING id', [id], client);
    return res.rows.length > 0;
  }

  async countUsersWithRole(role: string, client?: PoolClient): Promise<number> {
    const res = await this.executeQuery('SELECT COUNT(*)::int AS n FROM users WHERE role = $1', [role], client);
    return res.rows[0].n as number;
  }

  async renameRole(oldName: string, newName: string, client?: PoolClient): Promise<void> {
    await this.executeQuery('UPDATE users SET role = $1 WHERE role = $2', [newName, oldName], client);
  }

  /**
   * Gives a role's new access to its people who had the role's usual (old)
   * access or none stored; people with their own access keep it. Same rule as
   * `followsRole` in lib/user-admin. Returns how many people changed.
   */
  async applyRoleAccess(role: string, before: string[], after: string[], client?: PoolClient): Promise<number> {
    const res = await this.executeQuery(
      `UPDATE users SET permissions = $3::jsonb
       WHERE role = $1
         AND (permissions IS NULL OR permissions = '[]'::jsonb OR (permissions @> $2::jsonb AND permissions <@ $2::jsonb))`,
      [role, JSON.stringify(before), JSON.stringify(after)],
      client
    );
    return res.rowCount ?? 0;
  }
}

export const settingsRepository = new SettingsRepository();
