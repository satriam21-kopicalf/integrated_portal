'use client';
import { createElement } from 'react';
/**
 * Icon for a stat card from its label (2026-11-16, as kopicalf-hrms components/ui/stat-icon.tsx), so cards without an
 * explicit `icon` do not show none. Rules are checked in order (the more specific words first); Indonesian and English
 * labels both match. A card that passes its own icon keeps it.
 */
import {
  Activity, AlarmClock, AlertTriangle, Banknote, BarChart3, CalendarCheck, CheckCircle2, ClipboardCheck, ClipboardList,
  Coins, FileSpreadsheet, Hourglass, Inbox, Link2, MapPin, Package, PlayCircle, Receipt, RefreshCw, Scale, ShoppingCart,
  Star, Store, Target, Timer, Trash2, Truck, Users, XCircle, type LucideIcon,
} from 'lucide-react';

const RULES: [RegExp, LucideIcon][] = [
  [/error|warning|risk|affected|to check|perlu dicek|perhatian|missed|terlewat/, AlertTriangle],
  [/late|terlambat|telat|past target|overdue/, AlarmClock],
  [/not started|belum mulai|none|tidak ada/, XCircle],
  [/in progress|berjalan|sedang/, PlayCircle],
  [/waiting|pending|menunggu|review/, Hourglass],
  [/approv|disetujui|persetujuan/, ClipboardCheck],
  [/completed|complete|selesai|done|good|finished|submitted|terkirim/, CheckCircle2],
  [/progress|completion|coverage|cakupan|share|ratio|rasio|%/, Target],
  [/waste|buang/, Trash2],
  [/transfer|tito|kirim|delivery|on the way/, Truck],
  [/purchase|pembelian|order|po\b|estimate/, ShoppingCart],
  [/receipt|\bgr\b|good receipt|penerimaan/, Receipt],
  [/cogs|hpp|cost|biaya|value|nilai|price|harga/, Coins],
  [/sales|penjualan|omzet|revenue/, Banknote],
  [/item|material|bahan|stock|stok|menu|premix|wip|product|produk/, Package],
  [/count|opname|\bso\b|list|daftar|line|baris/, ClipboardList],
  [/due|scheduled|jadwal|schedule|day|hari|week|minggu|month|bulan/, CalendarCheck],
  [/outlet|branch|cabang|hub|facility|site|lokasi|location/, Store],
  [/radius|map|gps|position/, MapPin],
  [/pic|user|people|member|team|tim|driver|staff|karyawan/, Users],
  [/rating|score|skor|review/, Star],
  [/esb|linked|tertaut|source/, Link2],
  [/sync|sinkron|updated|checked|refresh/, RefreshCw],
  [/time|waktu|hour|jam|duration/, Timer],
  [/file|export|row/, FileSpreadsheet],
  [/request|pengajuan|inbox/, Inbox],
  [/average|rata|avg/, Scale],
  [/total|amount|rp/, BarChart3],
];

export function statIconFor(label: unknown): LucideIcon {
  const s = typeof label === 'string' ? label.toLowerCase() : '';
  for (const [re, Icon] of RULES) if (re.test(s)) return Icon;
  return Activity;
}

/** The icon picked for a label, as an element (one place that renders the picked component). */
export function StatIcon({ label }: { label: unknown }) {
  return createElement(statIconFor(label));
}
