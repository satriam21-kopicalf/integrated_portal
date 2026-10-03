'use client';

import { useCallback, useRef, useState } from 'react';
import { Check, Layers } from 'lucide-react';
import { SeriesKey } from '@/components/charts/common';
import { formatNumber } from '@/lib/format';
import { channelColor, channelOrder } from '@/lib/overview';
import { useClickOutside } from '@/lib/useClickOutside';

interface ChannelFilterProps {
  channels: { channel: string; bills: number }[];
  value: string[]; // [] = all channels
  onChange: (channels: string[]) => void;
}

/** Icon button + multi-select popover (same pattern as BranchFilter). */
export default function ChannelFilter({ channels, value, onChange }: ChannelFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(ref, close, isOpen);

  const options = [...channels].sort((a, b) => channelOrder(a.channel) - channelOrder(b.channel) || b.bills - a.bills);
  const label = value.length ? `Channel: ${value.join(', ')}` : 'Channel: all channels';
  const toggle = (name: string) => {
    const next = value.includes(name) ? value.filter(v => v !== name) : [...value, name];
    onChange(next.length === options.length ? [] : next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
          value.length || isOpen
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
        }`}
        title={label}
        aria-label={label}
        aria-expanded={isOpen}
      >
        <Layers size={18} strokeWidth={1.75} />
        {value.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
            {value.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Channels</p>
              <p className="text-xs text-slate-500">{value.length ? `${value.length} selected` : 'All channels'}</p>
            </div>
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                Clear
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto p-1.5" role="listbox" aria-multiselectable>
            {options.map(o => {
              const checked = value.includes(o.channel);
              return (
                <li key={o.channel}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(o.channel)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${checked ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}>
                      {checked && <Check size={12} strokeWidth={3} />}
                    </span>
                    <SeriesKey color={channelColor(o.channel)} />
                    <span className="min-w-0 flex-1 truncate">{o.channel}</span>
                    <span className="text-xs tabular-nums text-slate-400">{formatNumber(o.bills)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
