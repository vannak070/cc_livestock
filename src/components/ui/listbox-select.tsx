'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

/**
 * A choose-one list that always opens below its button and scrolls inside
 * itself. Used instead of a native <select> for lists that can be long (farms):
 * on a Mac the native menu is placed so the chosen item sits over the button,
 * so a long list opens upwards, off the top of the window.
 *
 * Keyboard: arrows, Home/End, Enter or Space to choose, Esc to close, and a
 * letter jumps to the next item starting with it.
 */

export interface ListboxOption { value: string; label: string }

interface ListboxSelectProps {
  options: ListboxOption[];
  value: string;
  onChange: (value: string) => void;
  /** What is being chosen, for screen readers ("Farm", "Working on"). */
  label: string;
  /** Classes for the button; the default content is the chosen label and a chevron. */
  buttonClassName: string;
  /** Replaces the button's content, for example to add an icon. */
  renderButton?: (selected: ListboxOption, open: boolean) => React.ReactNode;
  /** Positioning and width of the list (it is always just below the button). */
  listClassName?: string;
  /** Draws a line under the first option, for an "All ..." choice. */
  separateFirst?: boolean;
  className?: string;
}

export function Chevron({ open }: { open: boolean }) {
  return <ChevronDown className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />;
}

export function ListboxSelect({ options, value, onChange, label, buttonClassName, renderButton, listClassName = 'left-0 right-0', separateFirst, className = '' }: ListboxSelectProps) {
  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));
  const selected = options[selectedIndex] ?? { value: '', label: '' };

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const show = () => { setActive(selectedIndex); setOpen(true); };
  const close = (refocus = true) => { setOpen(false); if (refocus) buttonRef.current?.focus(); };
  const choose = (i: number) => { onChange(options[i].value); close(); };

  // Close on a click or tap anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Keep the highlighted option in view; on opening, focus the list for the keyboard.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(last, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') { setOpen(false); }
    else if (e.key.length === 1) {
      const ch = e.key.toLowerCase();
      for (let step = 1; step <= options.length; step++) {
        const i = (active + step) % options.length;
        if (options[i].label.toLowerCase().startsWith(ch)) { setActive(i); break; }
      }
    }
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${selected.label}`}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(); } }}
        className={buttonClassName}
      >
        {renderButton ? renderButton(selected, open) : (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{selected.label}</span>
            <Chevron open={open} />
          </>
        )}
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          className={`absolute top-full z-30 mt-1 max-h-[min(20rem,60vh)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-lg focus:outline-none ${listClassName}`}
        >
          {options.map((o, i) => {
            const isSelected = i === selectedIndex;
            return (
              <li
                key={o.value || `__${i}`}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-base ${i === active ? 'bg-slate-100' : ''} ${isSelected ? 'font-semibold text-emerald-800' : 'text-ink'} ${separateFirst && i === 0 ? 'border-b border-slate-100' : ''}`}
              >
                <span className="min-w-0 break-words">{o.label}</span>
                {isSelected && <Check className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface FarmSelectProps {
  farms: string[];
  /** The chosen farm; '' is "All farms". */
  value: string;
  onChange: (farm: string) => void;
  allLabel?: string;
  label?: string;
  /** 'field' fills its column (filter panels); 'compact' sits next to tabs or a heading. */
  size?: 'field' | 'compact';
  /** Which edge the list lines up with ('compact' only). */
  align?: 'left' | 'right';
  className?: string;
}

const FIELD = 'flex h-12 w-full items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 text-lg text-ink hover:border-emerald-600 focus-visible:border-emerald-600 focus-visible:outline-none';
const COMPACT = 'flex h-11 w-full min-w-[10rem] max-w-[16rem] items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 text-base text-ink hover:border-emerald-600 focus-visible:border-emerald-600 focus-visible:outline-none';

/** The farm filter used across the pages: "All farms" and then each farm. */
export function FarmSelect({ farms, value, onChange, allLabel, label, size = 'field', align = 'left', className }: FarmSelectProps) {
  const { t } = useLanguage();
  // In the chosen language unless the page passes its own words.
  allLabel = allLabel ?? t('farm.allFarms', 'All farms');
  label = label ?? t('farm.farm', 'Farm');
  const options = [{ value: '', label: allLabel }, ...farms.map(f => ({ value: f, label: f }))];
  const list = size === 'field'
    ? 'left-0 right-0'
    : `${align === 'right' ? 'right-0' : 'left-0'} w-64 max-w-[calc(100vw-2rem)]`;
  return (
    <ListboxSelect
      options={options}
      value={value}
      onChange={onChange}
      label={label}
      buttonClassName={size === 'field' ? FIELD : COMPACT}
      listClassName={list}
      separateFirst
      className={className}
    />
  );
}
