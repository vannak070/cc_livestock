import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
vi.mock('../config/database', () => ({ query: (...args: unknown[]) => queryMock(...args) }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: { getActiveUserById: vi.fn() } }));

import { farmGuard } from './farm-guard';
import { AuthzError } from './authz';
import type { UserRoleItem } from './types';

const farmA = { id: 'u1', name: 'A', email: 'a@x.test', role: 'Farm Owner', status: 'Active', farmLocation: 'Farm A' } as UserRoleItem;
const admin = { id: 'u2', name: 'Admin', email: 'b@x.test', role: 'Admin', status: 'Active' } as UserRoleItem;
const rows = (r: Record<string, unknown>[]) => ({ rows: r });

const denied = async (p: Promise<unknown> | (() => void)) => {
  try {
    if (typeof p === 'function') p(); else await p;
  } catch (err) {
    expect(err).toBeInstanceOf(AuthzError);
    expect((err as AuthzError).statusCode).toBe(403);
    return;
  }
  throw new Error('expected a 403');
};

describe('farmGuard', () => {
  beforeEach(() => queryMock.mockReset());

  describe('cows', () => {
    it('lets users not tied to a farm through without a query', async () => {
      await farmGuard.cows(admin, ['C1']);
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('allows cattle on the user\'s own farm (case and spaces ignored)', async () => {
      queryMock.mockResolvedValue(rows([{ id: 'C1', location: ' farm a ' }]));
      await expect(farmGuard.cows(farmA, ['C1'])).resolves.toBeUndefined();
    });

    it('blocks a cow on another farm, even mixed in with own cattle', async () => {
      queryMock.mockResolvedValue(rows([{ id: 'C1', location: 'Farm A' }, { id: 'B1', location: 'Farm B' }]));
      await denied(farmGuard.cows(farmA, ['C1', 'B1']));
    });

    it('blocks a cow with no farm set (farm users cannot see it either)', async () => {
      queryMock.mockResolvedValue(rows([{ id: 'N1', location: null }]));
      await denied(farmGuard.cows(farmA, ['N1']));
    });

    it('passes unknown ids through to the normal not-found handling', async () => {
      queryMock.mockResolvedValue(rows([]));
      await expect(farmGuard.cows(farmA, ['NOPE'])).resolves.toBeUndefined();
    });

    it('skips the query when there is nothing to check', async () => {
      await farmGuard.cows(farmA, [undefined, null, '']);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe('location / requireLocation', () => {
    it('allows the own farm and ignores an unchanged location', () => {
      expect(() => farmGuard.location(farmA, 'Farm A')).not.toThrow();
      expect(() => farmGuard.location(farmA, undefined)).not.toThrow();
    });

    it('blocks moving a record to another farm', async () => {
      await denied(() => farmGuard.location(farmA, 'Farm B'));
    });

    it('requires a farm when a farm user creates something', async () => {
      await denied(() => farmGuard.requireLocation(farmA, undefined));
      await denied(() => farmGuard.requireLocation(farmA, 'Farm B'));
      expect(() => farmGuard.requireLocation(farmA, 'Farm A')).not.toThrow();
      expect(() => farmGuard.requireLocation(admin, undefined)).not.toThrow();
    });
  });

  describe('batch', () => {
    it('allows a batch of the user\'s farm', async () => {
      queryMock.mockResolvedValueOnce(rows([{ farm_location: 'Farm A' }]));
      await expect(farmGuard.batch(farmA, 'BT1')).resolves.toBeUndefined();
    });

    it('blocks a batch of another farm', async () => {
      queryMock.mockResolvedValueOnce(rows([{ farm_location: 'Farm B' }]));
      await denied(farmGuard.batch(farmA, 'BT1'));
    });

    it('for a batch with no farm, blocks it when it holds another farm\'s cattle', async () => {
      queryMock.mockResolvedValueOnce(rows([{ farm_location: null }])).mockResolvedValueOnce(rows([{ location: 'Farm A' }, { location: 'Farm B' }]));
      await denied(farmGuard.batch(farmA, 'BT1'));
    });

    it('for a batch with no farm, allows it when all its cattle are the user\'s', async () => {
      queryMock.mockResolvedValueOnce(rows([{ farm_location: '' }])).mockResolvedValueOnce(rows([{ location: 'Farm A' }]));
      await expect(farmGuard.batch(farmA, 'BT1')).resolves.toBeUndefined();
    });
  });

  describe('healthLog', () => {
    it('checks the farm of the cow the log is about', async () => {
      queryMock.mockResolvedValueOnce(rows([{ cow_id: 'B1' }])).mockResolvedValueOnce(rows([{ id: 'B1', location: 'Farm B' }]));
      await denied(farmGuard.healthLog(farmA, 'HL-1'));
    });
  });

  describe('notFarmBound', () => {
    it('blocks farm users from all-farm changes such as renaming a location', async () => {
      await denied(() => farmGuard.notFarmBound(farmA));
      expect(() => farmGuard.notFarmBound(admin)).not.toThrow();
    });
  });
});
