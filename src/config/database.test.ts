import { describe, it, expect } from 'vitest';
import { isConnectFailure } from './database';

describe('isConnectFailure', () => {
  it('is true only when no connection could be made, so a retry cannot repeat a write', () => {
    expect(isConnectFailure(new Error('timeout exceeded when trying to connect'))).toBe(true);
    expect(isConnectFailure(new Error('Connection terminated due to connection timeout'))).toBe(true);
    expect(isConnectFailure(new Error('Connection terminated unexpectedly'))).toBe(false);
    expect(isConnectFailure(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5433'), { code: 'ECONNREFUSED' }))).toBe(true);
    expect(isConnectFailure(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))).toBe(false);
    expect(isConnectFailure(new Error('duplicate key value violates unique constraint'))).toBe(false);
    expect(isConnectFailure(null)).toBe(false);
  });
});
