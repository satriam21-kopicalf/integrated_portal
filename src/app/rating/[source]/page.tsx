"use client";

// Aggregator (pages rating.google-maps, rating.shopeefood, rating.gofood, rating.grabfood): ratings and reviews of
// the outlets per platform. ShopeeFood and GoFood are being built (the menu and the access rules are in place).

import { notFound, useParams } from "next/navigation";
import FeatureSkeleton from "@/components/FeatureSkeleton";
import { tr } from "@/lib/i18n";

const SOURCES: Record<string, { name: string; logo: string }> = {
  "google-maps": { name: "Google Maps", logo: "/assets/googlemaps.png" },
  shopeefood: { name: "ShopeeFood", logo: "/assets/shopeefood.png" },
  gofood: { name: "GoFood", logo: "/assets/gofood.png" },
  grabfood: { name: "GrabFood", logo: "/assets/grabfood.svg" },
};

export default function RatingPage() {
  const { source } = useParams<{ source: string }>();
  const s = SOURCES[source];
  if (!s) notFound();
  // 2026-11-24: GrabFood stopped on 11 Nov (its merchant cookie can no longer be renewed); the screen
  // (src/so/features/grabfood/GrabFood.tsx) is kept for when a valid source returns.
  return (
    <FeatureSkeleton eyebrow={tr("Aggregator")} subtitle={tr("Ratings and reviews of the outlets on {0}", s.name)}
      // the logo as the title, like Google Maps and GrabFood (its name is the alt text)
      // eslint-disable-next-line @next/next/no-img-element -- brand logo from public/assets
      title={<img src={s.logo} alt={s.name} className="h-6 w-auto sm:h-7" />}
      endpoint={`/api/rating/${source}`} logo
      soon={source === "google-maps" ? undefined : tr("Coming soon: there is no valid data source for {0} yet. Meanwhile check the merchant account.", s.name)}
      // eslint-disable-next-line @next/next/no-img-element -- brand logo from public/assets
      icon={<img src={s.logo} alt={s.name} className="max-h-5 max-w-[7.5rem] object-contain" />} />
  );
}
