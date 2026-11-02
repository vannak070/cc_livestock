/**
 * Checks the settings of this server against what a live site needs (secrets, HTTPS address, CORS, cookie).
 * Prints findings only; never a secret's value. Exits with 1 when something must be fixed.
 *
 * Run on the server, with its real settings:  NODE_ENV=production npm run prod:check
 */
import path from 'path';
import dotenv from 'dotenv';
import { hasErrors, productionFindings } from '../lib/production-check';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const findings = productionFindings(process.env);
const icon = { error: 'FIX   ', warning: 'CHECK ', info: 'note  ' } as const;
for (const f of findings) console.log(`${icon[f.level]} ${f.message}`);
if (findings.length === 0) console.log('All production settings look right.');
console.log(hasErrors(findings) ? '\nNot ready: fix the lines marked FIX.' : '\nNo blocking problems found.');
process.exit(hasErrors(findings) ? 1 : 0);
