'use client';

// Gives every cell of a table marked m-cards the name of its column (data-label) so the phone layout of globals.css
// can show it above the value. Watches the page (and drawers) for tables rendered or re-rendered later.

import { useEffect } from 'react';

function label(table: HTMLTableElement) {
  const head = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!head) return;
  const names: string[] = [];
  for (const th of Array.from(head.cells)) {
    const text = (th.textContent ?? '').replace(/\s+/g, ' ').trim();
    for (let i = 0; i < (th.colSpan || 1); i++) names.push(text);
  }
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      let col = 0;
      for (const td of Array.from(row.cells)) {
        const name = names[col] ?? '';
        if (name && td.colSpan === 1) {
          if (td.dataset.label !== name) td.dataset.label = name;
        } else if (td.dataset.label) delete td.dataset.label;
        col += td.colSpan || 1;
      }
    }
  }
}

export default function TableCards() {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      frame = 0;
      document.querySelectorAll<HTMLTableElement>('table.m-cards').forEach(label);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(run); };
    run();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return null;
}
