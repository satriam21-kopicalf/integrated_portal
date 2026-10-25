import Image from 'next/image';
import { assetUrl } from '@/lib/assets';

/** The Calf logo as a large white watermark on the blue brand surfaces (login header, Home card); decorative only.
 *  Place it inside a `relative overflow-hidden` box and size / position it with `className`. */
export default function BrandWatermark({ className = '' }: { className?: string }) {
  return (
    <Image src={assetUrl('assets/calf-logo.png')} alt="" aria-hidden width={782} height={414} unoptimized priority
      className={`pointer-events-none absolute h-auto max-w-none select-none brightness-0 invert ${className}`} />
  );
}

/** Generic line under the brand (app bar, sidebar, login). */
export const BRAND_LINE = 'Calf Coffee & Milkbar';
