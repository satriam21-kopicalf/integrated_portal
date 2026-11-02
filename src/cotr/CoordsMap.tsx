'use client';

// A small OpenStreetMap map (Leaflet) to pick a position: a click moves the marker and gives back the coordinates.

import 'leaflet/dist/leaflet.css';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';

const JAKARTA: [number, number] = [-6.1806, 106.8434];

export default function CoordsMap({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<CircleMarker | null>(null);
  const pick = useRef(onPick);
  useEffect(() => { pick.current = onPick; }, [onPick]);

  useEffect(() => {
    let alive = true;
    void import('leaflet').then((L) => {
      if (!alive || !box.current || map.current) return;
      map.current = L.map(box.current).setView(lat !== null && lng !== null ? [lat, lng] : JAKARTA, lat !== null ? 16 : 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
      marker.current = L.circleMarker(lat !== null && lng !== null ? [lat, lng] : JAKARTA, { radius: 9, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: lat !== null ? 1 : 0 }).addTo(map.current);
      map.current.on('click', (e) => pick.current(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))));
    });
    return () => { alive = false; map.current?.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lat === null || lng === null || !marker.current || !map.current) return;
    marker.current.setLatLng([lat, lng]).setStyle({ fillOpacity: 1 });
    map.current.panTo([lat, lng]);
  }, [lat, lng]);

  return <div ref={box} className="h-56 w-full overflow-hidden rounded-xl bg-neutral-100" />;
}
