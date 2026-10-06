import { describe, expect, it } from 'vitest';
import { SYSTEM_ROLES, usesStandardDescription } from './user-admin';
import { en, km } from '@/locales/sections/settingsPage';

describe('built-in role descriptions', () => {
  it('have plain English that matches the Settings texts, and Khmer', () => {
    for (const r of SYSTEM_ROLES) {
      expect(en[`desc_${r.name}` as keyof typeof en]).toBe(r.description);
      expect(km[`desc_${r.name}` as keyof typeof en]).toBeTruthy();
      expect(r.description).not.toMatch(/PIN|mobile/i);
    }
  });

  it('use the standard wording when the stored text is empty or an old default, and keep what an admin typed', () => {
    expect(usesStandardDescription({ name: 'Management', description: 'Read-only reporting access — no create, edit, or delete permissions. Intended for PIN sign-in on the mobile app.' })).toBe(true);
    expect(usesStandardDescription({ name: 'Admin', description: '' })).toBe(true);
    expect(usesStandardDescription({ name: 'Company Admin', description: 'Custom ERP User Role' })).toBe(true);
    expect(usesStandardDescription({ name: 'Farm Staff', description: SYSTEM_ROLES[4].description })).toBe(true);
    expect(usesStandardDescription({ name: 'Management', description: 'Board members who read the monthly reports.' })).toBe(false);
  });
});
