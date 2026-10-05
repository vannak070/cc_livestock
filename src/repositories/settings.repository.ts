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
        locations: ['រទាំង', 'ព្រៃវែង', 'បន្ទាយមានជ័យ', 'ក្រោល A', 'ក្រោល B'],
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

    // Self-heal: an installation whose `roles` were persisted before the
    // Management role existed won't otherwise ever see it added, the same
    // way an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` self-heals schema.
    if (!settings.roles!.some(r => r.name === 'Management')) {
      settings.roles = [...settings.roles!, DEFAULT_ROLES[DEFAULT_ROLES.length - 1]];
    }

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

  async updateSettings(settings: MasterSetup, client?: PoolClient): Promise<MasterSetup> {

    // Never persist plaintext/hash secrets inside the master_settings JSON
    // blob — the `users` table (password column) and per-user hashing below
    // are the single source of truth for credentials.
    const sanitizedForBlob: MasterSetup = {
      ...settings,
      users: stripUserSecrets(settings.users),
      farms: stripFarmSecrets(settings.farms)
    };

    const sql = `
      INSERT INTO master_settings (key, data, updated_at)
      VALUES ('master_setup', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = CURRENT_TIMESTAMP
    `;
    await this.executeQuery(sql, [JSON.stringify(sanitizedForBlob)], client);

    if (settings.users) {
      if (settings.users.length > 0) {
        const userIds = settings.users.map(u => u.id);
        await this.executeQuery(
          `DELETE FROM users WHERE id NOT IN (${userIds.map((_, idx) => `$${idx + 1}`).join(', ')})`,
          userIds,
          client
        );
      } else {
        await this.executeQuery(`DELETE FROM users`, [], client);
      }

      for (const u of settings.users) {
        const permsToSave = u.permissions || DEFAULT_ROLE_PERMISSIONS[u.role] || [];

        // Password resolution rules:
        //  - admin typed a new password (u.password non-empty) -> hash & store it
        //  - editing an existing user, nothing typed -> KEEP their current hash
        //    (never silently reset a password just because the client didn't
        //    have it to send back — GET /settings no longer returns it)
        //  - brand-new user, nothing typed -> generate + hash a temp password
        let passwordToStore: string;
        const typed = (u.password || '').trim();
        if (typed) {
          passwordToStore = await hashPassword(typed);
        } else {
          const existing = await this.executeQuery('SELECT password FROM users WHERE id = $1', [u.id], client);
          if (existing.rows.length > 0 && existing.rows[0].password) {
            passwordToStore = existing.rows[0].password;
          } else {
            const temp = generateTempPassword();
            passwordToStore = await hashPassword(temp);
            console.log(`[Settings] New user ${u.email} (${u.role}) assigned temporary password: ${temp}`);
            console.log('[Settings] Share this with the user — it will not be shown again.');
          }
        }

        // PIN resolution rules mirror the password rules just above, with
        // one addition: an admin can tick "Remove PIN sign-in" to clear an
        // existing PIN outright (there's no way to type your way to "empty"
        // when blank already means "leave unchanged").
        //  - clearPin -> NULL, regardless of anything typed in `pin`
        //  - u.pin typed -> validate strength + uniqueness, then hash & store
        //  - nothing typed, not clearing -> KEEP the existing hash
        let pinHashToStore: string | null;
        const typedPin = (u.pin || '').trim();
        if (u.clearPin) {
          pinHashToStore = null;
        } else if (typedPin) {
          const problem = validatePinStrength(typedPin);
          if (problem) throw new Error(`PIN for ${u.email}: ${problem}`);

          // A PIN both identifies and authenticates on the mobile app's
          // PIN sign-in, so two accounts sharing one would be ambiguous at
          // login — refuse it the same way the CLI's set-pin script does.
          const others = await this.executeQuery(
            "SELECT id, email, pin_hash FROM users WHERE pin_hash IS NOT NULL AND pin_hash <> '' AND id <> $1",
            [u.id],
            client
          );
          for (const row of others.rows) {
            if (await verifyPassword(typedPin, row.pin_hash)) {
              throw new Error(`That PIN is already used by ${row.email}. Every PIN must be unique.`);
            }
          }

          pinHashToStore = await hashPassword(typedPin);
        } else {
          const existingPin = await this.executeQuery('SELECT pin_hash FROM users WHERE id = $1', [u.id], client);
          pinHashToStore = existingPin.rows.length > 0 ? existingPin.rows[0].pin_hash : null;
        }

        await this.executeQuery(
          `INSERT INTO users (id, name, email, role, status, password, permissions, farm_location, pin_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET name=$2, email=$3, role=$4, status=$5, password=$6, permissions=$7, farm_location=$8, pin_hash=$9`,
          [u.id, u.name, u.email, u.role, u.status || 'Active', passwordToStore, JSON.stringify(permsToSave), u.farmLocation || null, pinHashToStore],
          client
        );
      }
    }

    return this.getSettings();
  }
}

export const settingsRepository = new SettingsRepository();
