import { ERPLivestockData } from './types';
import { Actor, can, redactSettingsFor } from './authz';
import { scopeDataToFarm } from './farm-view';

/**
 * Trims the full dataset down to what this user is allowed to receive.
 * This runs on the server before anything is sent to the browser: users
 * tied to one farm get only that farm's records, and the account roster
 * goes only to people who manage accounts.
 */
export function scopeDataForActor(data: ERPLivestockData, actor: Actor): ERPLivestockData {
  const settings = redactSettingsFor(actor, data.settings);
  // Running costs only go to people allowed to see them.
  const farmCosts = can(actor, 'costs_view') ? data.farmCosts ?? [] : [];
  if (!actor.farmLocation) return { ...data, settings, farmCosts }; // not tied to a farm: sees every farm

  return { ...scopeDataToFarm({ ...data, farmCosts }, actor.farmLocation), settings };
}
