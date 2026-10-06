import * as xlsx from 'xlsx';
import type { MonthStatement } from './billing';

/** The statement for CC Livestock: a summary sheet and the list of animals. English headers, like the other Excel files. */
export function exportBillingStatement(statement: MonthStatement) {
  const summary: (string | number)[][] = [
    ['CC Livestock: cattle registration bill', ''],
    ['Month', statement.month],
    ['Price for each animal (៛)', statement.price ?? ''],
    [],
    ['Farm', 'Cattle registered', 'Amount (៛)'],
    ...statement.farms.map(f => [f.farm, f.cattle, f.amount]),
    ['Total', statement.cattle, statement.amount],
    [],
    ['Registered by mistake and removed by an admin (not billed)', statement.removed, ''],
  ];
  const animals: (string | number)[][] = [
    ['Tag', 'Farm', 'Registered on', 'Registered by'],
    ...statement.animals.map(a => [a.cowId, a.farm, a.registeredAt.slice(0, 10), a.registeredBy]),
  ];
  const s1 = xlsx.utils.aoa_to_sheet(summary);
  s1['!cols'] = [{ wch: 56 }, { wch: 20 }, { wch: 16 }];
  const s2 = xlsx.utils.aoa_to_sheet(animals);
  s2['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 26 }];
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, s1, 'Statement');
  xlsx.utils.book_append_sheet(book, s2, 'Animals');
  xlsx.writeFile(book, `CC_Livestock_Cattle_Registration_Bill_${statement.month}.xlsx`);
}
