'use client';

import Image from 'next/image';
import { channelLabel } from '@/lib/overview';

/**
 * Channel logos (public/assets). Platform wordmarks replace the name; the
 * generic Dine In / Takeaway icons are shown with the name next to them.
 */
interface Logo {
  src: string;
  /** width / height of the artwork */
  ratio: number;
  /** a pictogram rather than a wordmark: keep the name beside it */
  icon?: boolean;
}

const LOGOS: Record<string, Logo> = {
  'Dine In': { src: '/assets/dinein.png', ratio: 1, icon: true },
  Takeaway: { src: '/assets/takeaway.png', ratio: 1, icon: true },
  GoFood: { src: '/assets/gofood.png', ratio: 224 / 60 },
  GrabFood: { src: '/assets/grabfood.svg', ratio: 2285.14 / 800 },
  ShopeeFood: { src: '/assets/shopeefood.png', ratio: 350 / 68 },
};

export function channelLogo(name: string): Logo | null {
  return LOGOS[name] ?? null;
}

export default function ChannelLogo({
  channel, height = 16, className = '', labelClassName = 'text-slate-700',
}: {
  channel: string;
  height?: number;
  className?: string;
  labelClassName?: string;
}) {
  const logo = channelLogo(channel);
  const label = channelLabel(channel);
  if (!logo) return <span className={`whitespace-nowrap ${labelClassName} ${className}`}>{label}</span>;
  // wordmarks carry less ink per pixel than pictograms: give them more height
  const h = logo.icon ? height : Math.round(height * 1.25);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`} title={label}>
      {/* eager: logos are tiny and sit in moving / scrolled containers where lazy loading never fires */}
      <Image src={logo.src} alt={label} width={Math.round(h * logo.ratio)} height={h} loading="eager"
        className="flex-shrink-0 object-contain" style={{ height: h, width: 'auto' }} unoptimized />
      {logo.icon && <span className={labelClassName}>{label}</span>}
    </span>
  );
}

/**
 * ECharts rich-text label for a channel (canvas charts cannot render JSX):
 * returns the label string and the `rich` styles it needs.
 */
export function channelRichLabel(channel: string, height = 16): { text: string; rich: Record<string, unknown> } {
  const logo = channelLogo(channel);
  if (!logo) return { text: channelLabel(channel), rich: {} };
  const key = `logo${channel.replace(/[^A-Za-z]/g, '')}`;
  const h = logo.icon ? height : Math.round(height * 1.25);
  return {
    text: logo.icon ? `{${key}|} ${channelLabel(channel)}` : `{${key}|}`,
    rich: { [key]: { height: h, width: Math.round(h * logo.ratio), backgroundColor: { image: logo.src } } },
  };
}
