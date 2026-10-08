'use client';

import { FormEvent, useState } from 'react';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { buttonPrimary, buttonSecondary, Field, inputClass } from '@/components/ui/Dialog';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import { Bands, CostSettings, STATUS } from '@/lib/costControl';
import { tr, serverMsg } from '@/lib/i18n';

const BAND_FIELDS: { key: keyof Omit<CostSettings, 'forecast'>; title: string; description: string; unit: string }[] = [
  { key: 'cogs_bands', get title() { return tr('COGS ratio'); }, get description() { return tr('Actual / theoretical COGS as % of sales. Coffee chains usually target 30–35%.'); }, unit: '%' },
  { key: 'usage_bands', get title() { return tr('Usage ratio'); }, get description() { return tr('Distance from 100% (actual usage vs recipes): within ±2% is excellent, ±5% acceptable.'); }, unit: '± %' },
  { key: 'variance_bands', get title() { return tr('Gap actual vs theoretical'); }, get description() { return tr('Actual minus theoretical COGS, in percentage points of sales.'); }, get unit() { return tr('pp'); } },
  { key: 'waste_bands', get title() { return tr('Other usage (waste)'); }, get description() { return tr('Item journal usage (waste, R&D, marketing) as % of sales.'); }, unit: '%' },
];

/** Thresholds of the status markers + forecast parameters (superadmin). */
export default function SettingsDrawer({ settings, onClose, onSaved }: {
  settings: CostSettings;
  onClose: () => void;
  onSaved: (s: CostSettings) => void;
}) {
  const [form, setForm] = useState<CostSettings>(() => JSON.parse(JSON.stringify(settings)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setBand = (key: keyof Omit<CostSettings, 'forecast'>, level: keyof Bands, value: string) =>
    setForm(f => ({ ...f, [key]: { ...f[key], [level]: Number(value) } }));
  const setForecast = (key: keyof CostSettings['forecast'], value: string) =>
    setForm(f => ({ ...f, forecast: { ...f.forecast, [key]: Number(value) } }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/cost-control/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(serverMsg(body.error) || `HTTP ${res.status}`);
      onSaved(body.settings);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open onClose={onClose} size="md" icon={<SlidersHorizontal size={18} />} title={tr('Cost control settings')}
      description={tr('Thresholds of the status markers and the purchase forecast.')}
      footer={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>{tr('Cancel')}</button>
          <button type="submit" form="cost-settings" className={buttonPrimary} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />} {tr('Save settings')}
          </button>
        </>
      }>
      <form id="cost-settings" onSubmit={submit}>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        {BAND_FIELDS.map(b => (
          <DrawerSection key={b.key} title={b.title} description={b.description}>
            <div className="grid grid-cols-3 gap-3">
              {(['good', 'warning', 'serious'] as const).map(level => (
                <Field key={level} label={tr('{0} up to ({1})', STATUS[level].label, b.unit)} htmlFor={`${b.key}-${level}`}>
                  <input id={`${b.key}-${level}`} type="number" step="0.5" min={0} max={100} className={inputClass}
                    value={form[b.key][level]} onChange={e => setBand(b.key, level, e.target.value)} />
                </Field>
              ))}
            </div>
            <p className="text-xs text-slate-400">{tr('Above “')}{STATUS.serious.label}{tr('” is')} {STATUS.critical.label}.</p>
          </DrawerSection>
        ))}
        <DrawerSection title={tr('Purchase forecast')} description={tr('How the 1 / 2 / 4 week purchase estimate is calculated.')}>
          <div className="grid grid-cols-3 gap-3">
            <Field label={tr('Look-back (days)')} htmlFor="fc-lookback">
              <input id="fc-lookback" type="number" min={7} max={120} className={inputClass} value={form.forecast.lookback_days} onChange={e => setForecast('lookback_days', e.target.value)} />
            </Field>
            <Field label={tr('Safety stock (days)')} htmlFor="fc-safety">
              <input id="fc-safety" type="number" step="0.5" min={0} max={14} className={inputClass} value={form.forecast.safety_days} onChange={e => setForecast('safety_days', e.target.value)} />
            </Field>
            <Field label={tr('Trend cap (±%)')} htmlFor="fc-trend">
              <input id="fc-trend" type="number" min={0} max={100} className={inputClass} value={form.forecast.trend_cap_pct} onChange={e => setForecast('trend_cap_pct', e.target.value)} />
            </Field>
          </div>
        </DrawerSection>
      </form>
    </Drawer>
  );
}
