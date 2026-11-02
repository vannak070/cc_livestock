'use client';

import { useQuery } from '@tanstack/react-query';
import { getOpsProgramsAction } from '@/app/actions';
import type { OpsProgramsView } from '@/services/ops-program.service';

/** Farm programs, their tasks and each task's history (Super Admin, Admin and Management only; the server checks). */
export function useOpsPrograms(enabled = true) {
  return useQuery<OpsProgramsView>({
    enabled,
    queryKey: ['ops-programs'],
    queryFn: async () => {
      const res = await getOpsProgramsAction();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchOnMount: 'always',
  });
}
