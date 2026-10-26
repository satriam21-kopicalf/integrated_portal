"use client";

// Rating & Review (pages rating.google-maps, rating.shopeefood, rating.gofood, rating.grabfood): ratings and reviews of
// the outlets per platform. Empty for now (being built): the menu and the access rules are in place.

import { notFound, useParams } from "next/navigation";
import FeatureSkeleton from "@/components/FeatureSkeleton";
import GrabFood from "./GrabFood";
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
  if (source === "grabfood") return <GrabFood />;
  return (
    <FeatureSkeleton title={tr("Rating & Review · {0}", s.name)} subtitle={tr("Ratings and reviews of the outlets on {0}", s.name)}
      endpoint={`/api/rating/${source}`} logo
      // eslint-disable-next-line @next/next/no-img-element -- brand logo from public/assets
      icon={<img src={s.logo} alt={s.name} className="max-h-5 max-w-[7.5rem] object-contain" />} />
  );
}
