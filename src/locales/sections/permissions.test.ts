import { describe, expect, it } from 'vitest';
import { PERMISSION_MODULES } from '@/types/settings.types';
import { en, km } from './permissions';

const clean = (label: string) => label.replace(/^[^\p{L}\p{N}]+/u, '');

describe('permission names', () => {
  it('English mirrors PERMISSION_MODULES, and every name has Khmer', () => {
    for (const m of PERMISSION_MODULES) {
      expect(en[`mod_${m.id}` as keyof typeof en]).toBe(clean(m.label));
      expect(km[`mod_${m.id}` as keyof typeof en]).toBeTruthy();
      for (const item of m.items) {
        expect(en[`perm_${item.key}` as keyof typeof en]).toBe(item.label);
        expect(en[`desc_${item.key}` as keyof typeof en]).toBe(item.description);
        expect(km[`perm_${item.key}` as keyof typeof en]).toBeTruthy();
        expect(km[`desc_${item.key}` as keyof typeof en]).toBeTruthy();
      }
    }
  });
});
