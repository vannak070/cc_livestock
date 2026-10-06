/**
 * The next action recorded for an animal that has been on the farm a long time
 * without being sold (see src/lib/long-stay.ts).
 */
export type FollowUpAction = 'sell' | 'keep' | 'treat' | 'weigh' | 'other';

export interface CattleFollowUp {
  id: string;
  cowId: string;
  action: FollowUpAction;
  note: string;
  /** YYYY-MM-DD, when the action should be done by. */
  dueDate?: string;
  createdBy: string;
  createdAt: string;
  /** Set when the action was done, or replaced by a newer one. */
  doneAt?: string;
  doneBy?: string;
}
