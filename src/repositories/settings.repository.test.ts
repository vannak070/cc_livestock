import { describe, it, expect } from 'vitest';
import { withBuiltInRoles } from './settings.repository';

describe('withBuiltInRoles', () => {
  it('puts back built-in roles that were deleted, keeping the stored ones as they are', () => {
    const stored = [
      { id: 'ROLE-01', name: 'Super Admin', description: '', permissions: [], isSystem: true },
      { id: 'ROLE-11', name: 'Company Admin', description: 'mine', permissions: ['stock_view' as const], isSystem: false },
      { id: 'ROLE-07', name: 'Management', description: 'kept', permissions: [], isSystem: true },
    ];
    const roles = withBuiltInRoles(stored);
    expect(roles.slice(0, 3)).toEqual(stored);
    expect(roles.map(r => r.name)).toEqual(['Super Admin', 'Company Admin', 'Management', 'Admin', 'Company', 'Farm Owner', 'Farm Staff', 'Veterinarian']);
    expect(new Set(roles.map(r => r.id)).size).toBe(roles.length);
  });
  it('gives a restored role a free id when its own id is used by another role', () => {
    const roles = withBuiltInRoles([{ id: 'ROLE-05', name: 'Helper', description: '', permissions: [], isSystem: false }]);
    expect(roles.find(r => r.name === 'Farm Staff')!.id).toBe('ROLE-05-SYS');
  });
});
