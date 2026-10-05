import { runDailyFeedStockOuts } from './daily-feed-cron';
import { pool } from '../config/database';

runDailyFeedStockOuts()
  .then(n => console.log(`Daily feed ration: ${n} new deduction(s) recorded.`))
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => pool.end());
