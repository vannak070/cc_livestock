import { preconnect } from 'react-dom';

/** The map tile servers (OpenStreetMap, used by MembersMap). */
export const TILE_HOSTS = ['https://a.tile.openstreetmap.org', 'https://b.tile.openstreetmap.org', 'https://c.tile.openstreetmap.org'];

/** Call in a page with a map: the browser opens the connections early, so the map shows sooner. */
export function preconnectMapTiles(): void {
  for (const host of TILE_HOSTS) preconnect(host);
}
