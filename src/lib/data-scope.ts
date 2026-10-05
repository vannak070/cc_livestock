import { ERPLivestockData } from './types';
import { Actor, can, redactSettingsFor } from './authz';
import { scopeDataToFarm } from './farm-view';
import { canUsePlanning } from './utils';

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
  // Plans only go to the Planning roles (Super Admin, Admin, Management).
  const proposalPlans = canUsePlanning(actor) ? data.proposalPlans ?? [] : [];
  const farmLoans = canUsePlanning(actor) ? data.farmLoans ?? [] : [];
  if (!actor.farmLocation) return { ...data, settings, farmCosts, proposalPlans, farmLoans }; // not tied to a farm: sees every farm

  return { ...scopeDataToFarm({ ...data, farmCosts }, actor.farmLocation), settings, proposalPlans, farmLoans };
}
