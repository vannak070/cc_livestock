import { describe, expect, it } from 'vitest';
import { hasPermission } from './utils';

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
