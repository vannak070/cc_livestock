'use client';

import { useState, type ReactNode } from 'react';
import { KmWords } from '@/components/shared/KmWords';

export interface JoinRole { key: string; label: string; blurb: string; icon: string; info: ReactNode; formTitle: string; form: ReactNode }

/**
 * "Who are you?": Farmer, Cattle buyer or Investor. Each shows its own
 * information and its own request form. ?role= in the link opens one directly.
 */
export function JoinRoles({ title, roles, initial }: { title: string; roles: JoinRole[]; initial: string }) {
  const [active, setActive] = useState(roles.some(r => r.key === initial) ? initial : roles[0].key);
  const role = roles.find(r => r.key === active) ?? roles[0];
  const pick = (key: string) => {
    setActive(key);
    try { window.history.replaceState(null, '', `?role=${key}#apply`); } catch { /* the page still works without it */ }
  };
  return (
    <div className="stack" style={{ gap: 32 }}>
      <div className="stack" style={{ gap: 14 }}>
        <h2 className="display h3"><KmWords text={title} /></h2>
        <div className="role-cards" role="tablist">
          {roles.map(r => (
            <button key={r.key} type="button" role="tab" id={`role-${r.key}`} aria-controls="role-panel" aria-selected={r.key === role.key} className="role-card" onClick={() => pick(r.key)}>
              <span className="role-icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={r.icon} /></svg>
              </span>
              <b>{r.label}</b>
              <span>{r.blurb}</span>
            </button>
          ))}
        </div>
      </div>
      <div id="role-panel" role="tabpanel" aria-labelledby={`role-${role.key}`} className="split">
        <div key={`${role.key}-info`} className="side stack rise" style={{ gap: 36 }}>{role.info}</div>
        <div className="main" id="apply" style={{ scrollMarginTop: 96 }}>
          <div key={`${role.key}-form`} className="form-card jn-form rise">
            <span className="head-rule" aria-hidden="true" />
            <h2 className="display h3"><KmWords text={role.formTitle} /></h2>
            {role.form}
          </div>
        </div>
      </div>
    </div>
  );
}
