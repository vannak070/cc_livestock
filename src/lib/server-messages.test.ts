import { describe, expect, it } from 'vitest';
import { localizeServerMessage } from './server-messages';

describe('server messages in the chosen language', () => {
  const farm = 'You can only work with records from your own farm.';
  it('answers in Khmer by default and when Khmer is chosen', () => {
    expect(localizeServerMessage(farm, 'km')).toMatch(/កសិដ្ឋាន/);
    expect(localizeServerMessage(farm, undefined)).toMatch(/កសិដ្ឋាន/);
  });
  it('keeps English when English is chosen, and leaves unknown messages alone', () => {
    expect(localizeServerMessage(farm, 'en')).toBe(farm);
    expect(localizeServerMessage('Something else broke', 'km')).toBe('Something else broke');
  });
});
