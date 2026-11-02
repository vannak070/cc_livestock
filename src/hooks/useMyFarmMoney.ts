'use client';

import { useQuery } from '@tanstack/react-query';
import { getMyFarmMoneyAction } from '@/app/actions';
import type { FarmProgram } from '@/repositories/ops-program.repository';
import type { Task } from '@/lib/ops-program';

/** A Farm Owner's own farm program and tasks (nothing about other farms), for the money statement in Reports. */
export function useMyFarmMoney(enabled = true) {
  return useQuery<{ programs: FarmProgram[]; tasks: Task[] }>({
    enabled,
    queryKey: ['my-farm-money'],
    queryFn: async () => {
      const res = await getMyFarmMoneyAction();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchOnMount: 'always',
  });
}
