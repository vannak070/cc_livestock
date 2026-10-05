'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Tag, Check, AlertCircle } from 'lucide-react';
import { updateSettingsAction } from '@/app/actions';
import { MasterSetup } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils';

interface FeedCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: MasterSetup;
  onSettingsUpdated?: () => void;
}

export const FeedCategoryModal: React.FC<FeedCategoryModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsUpdated
}) => {
  const currentFeedTypes = settings?.feedTypes || ['Concentrate Feed', 'Silage', 'Fresh Grass', 'Hay Mix', 'Supplement', 'Medicine'];
  const [categories, setCategories] = useState<string[]>(currentFeedTypes);
  const [newCatName, setNewCatName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCategories(settings?.feedTypes || ['Concentrate Feed', 'Silage', 'Fresh Grass', 'Hay Mix', 'Supplement', 'Medicine']);
      setNewCatName('');
      setErrorMsg('');
    }
  }, [isOpen, settings]);

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`"${trimmed}" category already exists.`);
      return;
    }
    setCategories([...categories, trimmed]);
    setNewCatName('');
    setErrorMsg('');
  };

  const handleRemoveCategory = (catToRemove: string) => {
    if (categories.length <= 1) {
      setErrorMsg('You must have at least one feed product category.');
      return;
    }
    setCategories(categories.filter(c => c !== catToRemove));
    setErrorMsg('');
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    setErrorMsg('');
    try {
      const updatedSettings: MasterSetup = {
        ...settings,
        feedTypes: categories
      };
      const res = await updateSettingsAction(updatedSettings);
      if (res.success) {
        if (onSettingsUpdated) onSettingsUpdated();
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to save categories.');
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Error updating settings.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white p-6 rounded-2xl border border-slate-100 shadow-xl">
        <DialogHeader className="text-left pb-3 border-b border-slate-100">
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            <Tag className="h-4 w-4 text-emerald-600" />
            Manage Feed Product Categories
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Add or remove feed product classifications used across inventory catalog and filters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3 text-left">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-2.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Add New Category Bar */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Add New Category</Label>
            <div className="flex gap-2">
              <Input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                placeholder="e.g. Mineral Block, Protein Feed..."
                className="text-xs font-semibold h-9 rounded-xl border-slate-200"
              />
              <Button
                type="button"
                onClick={handleAddCategory}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 px-3 rounded-xl shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>

          {/* Category List */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Active Categories ({categories.length})</Label>
            <div className="max-h-56 overflow-y-auto space-y-1.5 border border-slate-150 p-2 rounded-xl bg-slate-50/50">
              {categories.map(cat => (
                <div key={cat} className="flex items-center justify-between bg-white border border-slate-200/80 px-3 py-1.5 rounded-lg">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    {cat}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-md cursor-pointer"
                    title="Remove category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="rounded-xl text-xs py-1.5 px-4 font-bold border-slate-200 text-slate-650 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs py-1.5 px-4 font-bold cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Categories'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
