'use client';

import React from 'react';
import { Crown, ExternalLink, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { FarmItem, MasterSetup } from '@/lib/types';
import { farmOwners, farmPeople } from '@/lib/farm-settings';

interface FarmPeopleDialogProps {
  farm: FarmItem;
  settings: MasterSetup;
  onClose: () => void;
  onAddOwner: () => void;
  onAddStaff: () => void;
  onMakeOwner: (userId: string, name: string) => void;
  /** Present when the signed-in person may open Settings, to see these people there. */
  onOpenPeople?: () => void;
}

/** Everyone on one farm, with the shortcuts to add to it or change its owner. */
export default function FarmPeopleDialog({ farm, settings, onClose, onAddOwner, onAddStaff, onMakeOwner, onOpenPeople }: FarmPeopleDialogProps) {
  const people = farmPeople(settings, farm.name);
  const owners = farmOwners(settings, farm.name);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-semibold text-ink">People on {farm.name}</DialogTitle>
          <DialogDescription className="text-base text-ink-muted">{people.length === 0 ? 'No one is assigned to this farm yet.' : `${people.length} ${people.length === 1 ? 'person' : 'people'}. A farm has one owner.`}</DialogDescription>
        </DialogHeader>

        {owners.length > 1 && (
          <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">This farm has {owners.length} owners. Tap &quot;Make owner&quot; on the right person to leave just one.</p>
        )}

        {people.length > 0 && (
          <ul className="max-h-[45vh] space-y-2 overflow-y-auto">
            {people.map(u => (
              <li key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-lg font-semibold text-ink">{u.role === 'Farm Owner' && <Crown className="h-4 w-4 shrink-0 text-amber-600" aria-label="Owner" />}<span className="break-words">{u.name}</span></p>
                  <p className="break-all text-base text-ink-muted">{u.email}</p>
                  <p className="text-base text-ink-muted">{u.role}{u.status !== 'Active' ? ' · turned off' : ''}</p>
                </div>
                {(u.role !== 'Farm Owner' || owners.length > 1) && ['Farm Staff', 'Veterinarian', 'Farm Owner'].includes(u.role) && (
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => onMakeOwner(u.id, u.name)}>Make owner</Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          {owners.length === 0 && <Button onClick={onAddOwner}><UserPlus /> Add the owner</Button>}
          <Button variant="outline" onClick={onAddStaff}><UserPlus /> Add staff or a vet</Button>
          {onOpenPeople && <Button variant="ghost" onClick={onOpenPeople}><ExternalLink /> Open in Settings</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
