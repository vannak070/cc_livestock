'use client';

import { useQuery } from '@tanstack/react-query';
import { getActionPlansAction } from '@/app/actions';
import type { ActionPlansView } from '@/services/action-plan.service';

/** The month's plans and the contracts (Super Admin, Admin and Management only; the server checks). Shared by Action plans and Reports. */
/** `day` is a day or a month of the period wanted; nothing means the current one. */
export function useActionPlansView(day: string | undefined, enabled = true) {
  return useQuery<ActionPlansView>({
    enabled,
    queryKey: ['action-plans', day ?? 'current'],
    queryFn: async () => {
      const res = await getActionPlansAction(day);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchOnMount: 'always',
  });
}
