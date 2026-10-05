import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog';
import { Button } from './button';
import { ShieldAlert, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'success' | 'info';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning'
}: ConfirmModalProps) {
  const colorMap = {
    danger: {
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      text: 'text-rose-600',
      icon: ShieldAlert,
      button: 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/10'
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      text: 'text-amber-600',
      icon: AlertTriangle,
      button: 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/10'
    },
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      text: 'text-emerald-600',
      icon: CheckCircle2,
      button: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/10'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      text: 'text-blue-600',
      icon: Info,
      button: 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/10'
    }
  };

  const style = colorMap[type] || colorMap.warning;
  const Icon = style.icon;

  const handlePrimaryClick = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm p-6 rounded-2xl bg-white border border-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <DialogHeader className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center border ${style.bg} ${style.border}`}>
            <Icon className={`h-6 w-6 ${style.text}`} />
          </div>
          <DialogTitle className="text-base font-bold text-slate-800 tracking-tight text-center">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 font-medium leading-relaxed px-2 text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex sm:justify-center gap-2 mt-4">
          {type !== 'success' && type !== 'info' && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl font-bold text-xs py-2 px-4 flex-1 border-slate-200"
            >
              {cancelText}
            </Button>
          )}
          <Button
            type="button"
            onClick={handlePrimaryClick}
            className={`rounded-xl font-bold text-xs py-2 px-4 flex-1 text-white shadow ${style.button}`}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
