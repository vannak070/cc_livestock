import { batchRepository } from '../../repositories/batch.repository';
import { feedRepository } from '../../repositories/feed.repository';
import { healthRepository } from '../../repositories/health.repository';
import { settingsRepository } from '../../repositories/settings.repository';
import { stockRepository } from '../../repositories/stock.repository';
import { weightRepository } from '../../repositories/weight.repository';
import {
  websiteBatchListingRepository, websiteConsentRepository, websiteFarmProfileRepository, websiteNewsRepository,
} from '../../repositories/website';
import { farmToday } from '../../lib/daily-feed';
import { saleWindowDays } from '../../lib/sale-review';
import type { SnapshotInput } from '../../lib/website';

/**
 * Loads everything the website rules need, in one place, so the Website page,
 * the Preview and (step 2) the sync job all work from the same records.
 */
export async function loadWebsiteData(now: Date = new Date()): Promise<SnapshotInput> {
  const [settings, profiles, consents, listings, news, stock, weights, batches, feedTransactions, healthLogs] = await Promise.all([
    settingsRepository.getSettings(),
    websiteFarmProfileRepository.findAll(),
    websiteConsentRepository.findAll(),
    websiteBatchListingRepository.findAll(),
    websiteNewsRepository.findAll(),
    stockRepository.findAll(),
    weightRepository.findAll(),
    batchRepository.findAll(),
    feedRepository.getTransactions(),
    healthRepository.findAll(),
  ]);
  return {
    farms: (settings.farms ?? []).map(f => ({ id: f.id, name: f.name })),
    profiles, consents, listings, news, stock, weights, batches, feedTransactions, healthLogs,
    saleWindow: saleWindowDays(settings),
    today: farmToday(now),
    builtAt: now.toISOString(),
  };
}
