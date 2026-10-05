import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../config/database';
import { resetDatabase } from './migrate';
import { settingsRepository } from '../repositories/settings.repository';
import { settingsService } from '../services/settings.service';
import { userAdminService } from '../services/user-admin.service';
import { farmService } from '../services/farm.service';
import { verifyPassword } from '../lib/password';
import { DEFAULT_ROLE_PERMISSIONS, type UserRoleItem } from '../lib/types';
import type { PersonInput } from '../lib/user-admin';
import type { FarmInput } from '../lib/farm-settings';

// Integration test: needs RUN_DB_TESTS=1 and a database whose name ends in `_test` (it drops every table).
const enabled = process.env.RUN_DB_TESTS === '1' && /_test$/.test(process.env.DB_NAME || '');

const superAdmin = { id: 'sa', name: 'Super', email: 'sa@x.com', role: 'Super Admin', status: 'Active' } as UserRoleItem;
const admin = { id: 'ad', name: 'Admin', email: 'ad@x.com', role: 'Admin', status: 'Active' } as UserRoleItem;
const owner = { id: 'own', name: 'Owner', email: 'own@x.com', role: 'Farm Owner', status: 'Active', farmLocation: 'Farm A', permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner'] } as UserRoleItem;

const person = (over: Partial<PersonInput> = {}): PersonInput => ({ name: 'Dara', email: 'dara@x.com', role: 'Farm Staff', farmLocation: 'Farm A', password: '', pin: '', clearPin: false, permissions: DEFAULT_ROLE_PERMISSIONS['Farm Staff'], ...over });
const farm = (over: Partial<FarmInput> = {}): FarmInput => ({ name: 'Farm A', address: 'Prey Veng', capacity: 50, notes: '', ...over });

const userRow = async (email: string) => (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];

describe.skipIf(!enabled)('people and farms are changed one at a time', () => {
  beforeAll(async () => { await resetDatabase(); });
  afterAll(() => pool.end());
  beforeEach(async () => {
    for (const t of ['feed_transactions', 'batch_cows', 'batches', 'stock', 'users']) await pool.query(`DELETE FROM ${t}`);
    await pool.query("DELETE FROM master_settings");
    await settingsRepository.patchBlob({ farms: [], locations: [] });
    await pool.query("INSERT INTO users (id, name, email, role, status, password) VALUES ('sa','Super','sa@x.com','Super Admin','Active','x'), ('ad','Admin','ad@x.com','Admin','Active','x'), ('own','Owner','own@x.com','Farm Owner','Active','x')");
    await pool.query("UPDATE users SET farm_location = 'Farm A' WHERE id = 'own'");
  });

  describe('a settings save can no longer delete or add people, or change farms', () => {
    it('ignores users, farms and locations, but still saves the lists', async () => {
      await userAdminService.createUser(superAdmin, person());
      await settingsService.updateSettings({ users: [], farms: [{ id: 'F', name: 'Ghost' }], locations: ['Ghost'], breeds: ['New breed'] } as never, superAdmin);
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n).toBe(4);
      const s = await settingsRepository.getSettings();
      expect(s.breeds).toEqual(['New breed']);
      expect(s.farms).toEqual([]);
      expect(s.locations).toEqual([]);
    });
  });

  describe('people', () => {
    it('adds a person with a made password that works, and returns it once', async () => {
      const { user, tempPassword } = await userAdminService.createUser(superAdmin, person());
      expect(tempPassword).toMatch(/^[a-f0-9]{12}$/);
      expect(user).toMatchObject({ name: 'Dara', role: 'Farm Staff', status: 'Active', farmLocation: 'Farm A' });
      expect(await verifyPassword(tempPassword!, (await userRow('dara@x.com')).password)).toBe(true);
    });
    it('refuses a repeated email, a weak PIN and a repeated PIN', async () => {
      await userAdminService.createUser(superAdmin, person({ pin: '482913' }));
      await expect(userAdminService.createUser(superAdmin, person({ name: 'Other' }))).rejects.toThrow(/already uses that email/);
      await expect(userAdminService.createUser(superAdmin, person({ email: 'b@x.com', pin: '123456' }))).rejects.toThrow(/too easy|PIN/);
      await expect(userAdminService.createUser(superAdmin, person({ email: 'c@x.com', pin: '482913' }))).rejects.toThrow(/already used/);
    });
    it('edits without touching the password or PIN, and changes them only when asked', async () => {
      const { user, tempPassword } = await userAdminService.createUser(superAdmin, person({ pin: '482913' }));
      await userAdminService.updateUser(superAdmin, user.id, person({ name: 'Renamed', email: 'dara@x.com' }));
      const row = await userRow('dara@x.com');
      expect(row.name).toBe('Renamed');
      expect(await verifyPassword(tempPassword!, row.password)).toBe(true);
      expect(row.pin_hash).toBeTruthy();
      await userAdminService.updateUser(superAdmin, user.id, person({ password: 'brandnewpass', clearPin: true }));
      const after = await userRow('dara@x.com');
      expect(await verifyPassword('brandnewpass', after.password)).toBe(true);
      expect(after.pin_hash).toBeNull();
    });
    it('turns people off and on, resets a password, and removes someone', async () => {
      const { user } = await userAdminService.createUser(superAdmin, person());
      await userAdminService.setStatus(superAdmin, user.id, 'Inactive');
      expect((await userRow('dara@x.com')).status).toBe('Inactive');
      const { password } = await userAdminService.resetPassword(superAdmin, user.id);
      expect(await verifyPassword(password, (await userRow('dara@x.com')).password)).toBe(true);
      await userAdminService.deleteUser(superAdmin, user.id);
      expect(await userRow('dara@x.com')).toBeUndefined();
    });
    it('protects yourself and the Super Admin', async () => {
      await expect(userAdminService.setStatus(admin, 'ad', 'Inactive')).rejects.toThrow(/your own/);
      await expect(userAdminService.deleteUser(admin, 'ad')).rejects.toThrow(/your own/);
      await expect(userAdminService.setStatus(superAdmin, 'sa', 'Inactive')).rejects.toThrow(/protected|your own/);
      await expect(userAdminService.deleteUser(admin, 'sa')).rejects.toThrow(/Super Admin/);
    });
    it('keeps the role limits: only Admins touch Admins, nobody hands out access they lack', async () => {
      const company = { id: 'co', name: 'Co', email: 'co@x.com', role: 'Company', status: 'Active' } as UserRoleItem;
      await expect(userAdminService.createUser(company, person({ role: 'Admin', farmLocation: '', permissions: DEFAULT_ROLE_PERMISSIONS['Admin'] }))).rejects.toThrow();
      await expect(userAdminService.createUser(admin, person({ role: 'Super Admin', farmLocation: '', email: 's2@x.com', permissions: DEFAULT_ROLE_PERMISSIONS['Super Admin'] }))).rejects.toThrow(/Super Admin/);
      await expect(userAdminService.createUser(owner, person({ email: 'x@x.com', permissions: [...DEFAULT_ROLE_PERMISSIONS['Farm Staff'], 'settings_manage'] }))).rejects.toThrow(/cannot give/);
    });
    it('lets a Farm Owner manage only the staff and vets of their own farm', async () => {
      const ok = await userAdminService.createUser(owner, person({ email: 'staff@x.com' }));
      expect(ok.user.farmLocation).toBe('Farm A');
      await expect(userAdminService.createUser(owner, person({ email: 'v@x.com', role: 'Veterinarian', farmLocation: 'Farm B' }))).rejects.toThrow(/own farm/);
      await expect(userAdminService.createUser(owner, person({ email: 'v@x.com', role: 'Veterinarian' }))).resolves.toMatchObject({ user: { role: 'Veterinarian', farmLocation: 'Farm A' } });
      await expect(userAdminService.createUser(owner, person({ email: 'o2@x.com', role: 'Farm Owner' }))).rejects.toThrow(/Farm Staff or Veterinarian/);
      await expect(userAdminService.updateUser(owner, 'ad', person({ email: 'ad@x.com' }))).rejects.toThrow(/staff and vets/);
      await expect(userAdminService.deleteUser(owner, 'own')).rejects.toThrow();
    });
  });

  describe('farms', () => {
    it('adds a farm without touching any account', async () => {
      const before = (await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n;
      const saved = await farmService.saveFarm(superAdmin, farm({ name: 'Farm B' }), null);
      expect(saved.name).toBe('Farm B');
      const s = await settingsRepository.getSettings();
      expect(s.farms!.map(f => f.name)).toEqual(['Farm B']);
      expect(s.locations).toEqual(['Farm B']);
      expect((await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n).toBe(before);
    });
    it('refuses a repeated farm name', async () => {
      await farmService.saveFarm(superAdmin, farm({ name: 'Farm B' }), null);
      await expect(farmService.saveFarm(superAdmin, farm({ name: 'farm b' }), null)).rejects.toThrow(/already a farm/);
    });
    it('renames a farm everywhere in one go: cattle, batches, feed movements and people', async () => {
      const f = await farmService.saveFarm(superAdmin, farm({ name: 'Farm B' }), null);
      await userAdminService.createUser(superAdmin, person({ email: 'staff@x.com', farmLocation: 'Farm B' }));
      await pool.query("INSERT INTO stock (id, no, location, status) VALUES ('S1','S1','Farm B','Active'), ('S2','S2','Other','Active')");
      await pool.query("INSERT INTO batches (id, name, type, farm_location) VALUES ('B1','b','F','Farm B'), ('B2','c','F','Other')");
      await pool.query("INSERT INTO feed_transactions (id, date, product_id, product_name, type, source_farm, target_farm) VALUES ('T1', now(), 'p', 'p', 'STOCK_IN', 'Supplier', 'Farm B'), ('T2', now(), 'p', 'p', 'STOCK_OUT', 'Farm B', 'Daily Feeding Ration'), ('T3', now(), 'p', 'p', 'STOCK_IN', 'Supplier', 'Other')");
      await farmService.saveFarm(superAdmin, farm({ name: 'Farm B2' }), f.id);
      expect((await pool.query('SELECT id, location FROM stock ORDER BY id')).rows).toEqual([{ id: 'S1', location: 'Farm B2' }, { id: 'S2', location: 'Other' }]);
      expect((await pool.query('SELECT id, farm_location FROM batches ORDER BY id')).rows).toEqual([{ id: 'B1', farm_location: 'Farm B2' }, { id: 'B2', farm_location: 'Other' }]);
      expect((await pool.query('SELECT id, source_farm, target_farm FROM feed_transactions ORDER BY id')).rows).toEqual([
        { id: 'T1', source_farm: 'Supplier', target_farm: 'Farm B2' },
        { id: 'T2', source_farm: 'Farm B2', target_farm: 'Daily Feeding Ration' },
        { id: 'T3', source_farm: 'Supplier', target_farm: 'Other' },
      ]);
      expect((await userRow('staff@x.com')).farm_location).toBe('Farm B2');
      const s = await settingsRepository.getSettings();
      expect(s.farms!.map(x => x.name)).toEqual(['Farm B2']);
      expect(s.locations).toEqual(['Farm B2']);
    });
    it('refuses to delete a farm that still has cattle, an active batch or any person, then deletes an empty one', async () => {
      const f = await farmService.saveFarm(superAdmin, farm({ name: 'Farm B' }), null);
      await pool.query("INSERT INTO stock (id, no, location, status) VALUES ('S1','S1','Farm B','Active'), ('S2','S2','Farm B','Sold')");
      await pool.query("INSERT INTO batches (id, name, type, farm_location, status) VALUES ('B1','b','F','Farm B','Active')");
      const { user } = await userAdminService.createUser(superAdmin, person({ email: 'staff@x.com', farmLocation: 'Farm B' }));
      await expect(farmService.deleteFarm(superAdmin, f.id)).rejects.toThrow(/1 active animal, 1 active batch, 1 person/);
      await pool.query("UPDATE stock SET status = 'Sold' WHERE id = 'S1'");
      await pool.query("UPDATE batches SET status = 'Closed' WHERE id = 'B1'");
      await expect(farmService.deleteFarm(superAdmin, f.id)).rejects.toThrow(/1 person/);
      await userAdminService.deleteUser(superAdmin, user.id);
      await farmService.deleteFarm(superAdmin, f.id);
      const s = await settingsRepository.getSettings();
      expect(s.farms).toEqual([]);
      expect(s.locations).toEqual([]);
    });
    it('needs permission', async () => {
      const staff = { id: 'st', name: 'St', email: 'st@x.com', role: 'Farm Staff', status: 'Active', farmLocation: 'Farm A' } as UserRoleItem;
      await expect(farmService.saveFarm(staff, farm(), null)).rejects.toThrow();
    });
  });

  describe('one owner per farm', () => {
    const ownerInput = (over: Partial<PersonInput> = {}) => person({ role: 'Farm Owner', farmLocation: 'Farm A', permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner'], ...over });
    it('refuses a second owner on the same farm, and moving an owner onto a farm that has one', async () => {
      // 'own' is already the owner of Farm A.
      await expect(userAdminService.createUser(superAdmin, ownerInput({ email: 'second@x.com' }))).rejects.toThrow(/already has an owner/);
      const second = await userAdminService.createUser(superAdmin, ownerInput({ email: 'b-owner@x.com', farmLocation: 'Farm B' }));
      await expect(userAdminService.updateUser(superAdmin, second.user.id, ownerInput({ email: 'b-owner@x.com', farmLocation: 'Farm A' }))).rejects.toThrow(/already has an owner/);
    });
    it('makes someone else the owner, and the old owner becomes staff of the same farm', async () => {
      const f = await farmService.saveFarm(superAdmin, farm({ name: 'Farm A' }), null);
      const { user } = await userAdminService.createUser(superAdmin, person({ email: 'new-owner@x.com', farmLocation: 'Farm A' }));
      await farmService.setOwner(superAdmin, f.id, user.id);
      expect(await userRow('new-owner@x.com')).toMatchObject({ role: 'Farm Owner', farm_location: 'Farm A' });
      expect(await userRow('own@x.com')).toMatchObject({ role: 'Farm Staff', farm_location: 'Farm A' });
      const owners = (await pool.query("SELECT id FROM users WHERE role = 'Farm Owner' AND farm_location = 'Farm A'")).rows;
      expect(owners).toHaveLength(1);
    });
    it('only picks someone who works on that farm and is a staff, vet or owner', async () => {
      const f = await farmService.saveFarm(superAdmin, farm({ name: 'Farm A' }), null);
      await expect(farmService.setOwner(superAdmin, f.id, 'ad')).rejects.toThrow(/works on this farm/);
      const mgmt = await userAdminService.createUser(superAdmin, person({ email: 'm@x.com', role: 'Management', farmLocation: '', permissions: DEFAULT_ROLE_PERMISSIONS['Management'] }));
      await pool.query("UPDATE users SET farm_location = 'Farm A' WHERE id = $1", [mgmt.user.id]);
      await expect(farmService.setOwner(superAdmin, f.id, mgmt.user.id)).rejects.toThrow(/cannot be made the owner/);
    });
  });

  describe('roles', () => {
    const custom = { id: 'ROLE-X', name: 'Accountant', description: '', permissions: ['sales_view'], isSystem: false };
    it('renames a custom role on its people, and refuses to delete a role people still hold', async () => {
      const base = (await settingsRepository.getSettings()).roles!;
      await settingsService.updateSettings({ roles: [...base, custom] } as never, superAdmin);
      await userAdminService.createUser(superAdmin, person({ email: 'acc@x.com', role: 'Accountant', farmLocation: '', permissions: ['sales_view'] }));
      await settingsService.updateSettings({ roles: [...base, { ...custom, name: 'Finance' }] } as never, superAdmin);
      expect((await userRow('acc@x.com')).role).toBe('Finance');
      await expect(settingsService.updateSettings({ roles: base } as never, superAdmin)).rejects.toThrow(/1 person has/);
      await expect(settingsService.updateSettings({ roles: base.map(r => (r.name === 'Farm Staff' ? { ...r, name: 'Staffer' } : r)) } as never, superAdmin)).rejects.toThrow(/keeps its name/);
    });
  });
});
