import { describe, expect, it } from 'vitest';
import { canOpenReports, canUsePlanning, hasPermission } from './utils';

describe('hasPermission', () => {
  it('denies everything without a user', () => {
    expect(hasPermission(null, 'stock_view')).toBe(false);
    expect(hasPermission(undefined, 'stock_view')).toBe(false);
  });

  it('lets Admin and Super Admin do anything', () => {
    expect(hasPermission({ role: 'Admin' }, 'settings_manage')).toBe(true);
    expect(hasPermission({ role: 'Super Admin' }, 'stock_delete')).toBe(true);
  });

  it('uses the explicit permission list when the user has one', () => {
    const user = { role: 'Farm Staff', permissions: ['stock_view'] };
    expect(hasPermission(user, 'stock_view')).toBe(true);
    expect(hasPermission(user, 'stock_delete')).toBe(false);
  });

  it('treats an explicit empty list as "no permissions", not "use the role default"', () => {
    expect(hasPermission({ role: 'Management', permissions: [] }, 'dashboard_view')).toBe(false);
  });

  it('falls back to the role defaults when there is no explicit list', () => {
    expect(hasPermission({ role: 'Management' }, 'dashboard_view')).toBe(true);
    expect(hasPermission({ role: 'Management' }, 'stock_delete')).toBe(false);
    expect(hasPermission({ role: 'No Such Role' }, 'dashboard_view')).toBe(false);
  });
});

describe('canUsePlanning', () => {
  it('allows only Super Admin, Admin and Management, whatever their access list says', () => {
    expect(canUsePlanning({ role: 'Super Admin' })).toBe(true);
    expect(canUsePlanning({ role: 'Admin' })).toBe(true);
    expect(canUsePlanning({ role: 'Management' })).toBe(true);
    for (const role of ['Company', 'Company Admin', 'Farm Owner', 'Farm Staff', 'Veterinarian', '']) {
      expect(canUsePlanning({ role })).toBe(false);
    }
    expect(canUsePlanning(null)).toBe(false);
  });
});

describe('canOpenReports', () => {
  it.each([
    ['Super Admin', true], ['Admin', true], ['Management', true], ['Company', true], ['Farm Owner', true],
    ['Farm Staff', false], ['Veterinarian', false],
  ])('%s: %s', (role, expected) => {
    expect(canOpenReports({ role })).toBe(expected);
  });

  it('opens for the old Summary audience (dashboard + sales) even without the analytics view', () => {
    expect(canOpenReports({ role: 'Custom', permissions: ['dashboard_view', 'sales_view'] })).toBe(true);
    expect(canOpenReports({ role: 'Custom', permissions: ['sales_view'] })).toBe(false);
    expect(canOpenReports({ role: 'Custom', permissions: ['dashboard_view'] })).toBe(false);
    expect(canOpenReports({ role: 'Custom', permissions: ['analytics_view'] })).toBe(true);
  });

  it('is closed to nobody-in-particular', () => {
    expect(canOpenReports(null)).toBe(false);
    expect(canOpenReports(undefined)).toBe(false);
  });
});

describe('farm accounts only view cattle registration and sales (user rule 2026-11-04)', () => {
  const office = ['stock_create', 'sales_record', 'sales_delete'] as const;
  it('refuses them for farm roles, even with stored custom access', () => {
    for (const role of ['Farm Owner', 'Farm Staff', 'Veterinarian']) {
      for (const key of office) expect(hasPermission({ role, permissions: [...office] }, key)).toBe(false);
    }
    for (const key of office) expect(hasPermission({ role: 'Farm Owner' }, key)).toBe(false);
  });
  it('keeps viewing for the Farm Owner', () => {
    expect(hasPermission({ role: 'Farm Owner' }, 'stock_view')).toBe(true);
    expect(hasPermission({ role: 'Farm Owner' }, 'sales_view')).toBe(true);
  });
  it('leaves the office alone', () => {
    expect(hasPermission({ role: 'Admin' }, 'sales_record')).toBe(true);
    expect(hasPermission({ role: 'Company', permissions: ['stock_create'] }, 'stock_create')).toBe(true);
  });
});
