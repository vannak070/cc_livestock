'use client';

import { useQuery } from '@tanstack/react-query';
import { getCamcowStockAction } from '@/app/actions';
import type { Holding } from '@/lib/camcow-stock';
import type { StockCost } from '@/lib/camcow-costs';
import type { Buyer } from '@/lib/camcow-buyers';

/** The cattle CC Livestock holds after collecting them from farms (Super Admin, Admin and Management; the server checks). */
export function useCamcowStock(enabled = true) {
  return useQuery<{ holdings: Holding[]; buyers: Buyer[]; costs: StockCost[] }>({
    enabled,
    queryKey: ['camcow-stock'],
    queryFn: async () => {
      const res = await getCamcowStockAction();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchOnMount: 'always',
  });
}
