"use client";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
// Avoid requiring @types/geojson in this small project – use any for GeoJSON props
type FeatureCollection = any;
type Feature = any;

function colorForCount(c: number) {
  // Çok basit renk skalası
  if (c >= 50) return "#800026";
  if (c >= 20) return "#BD0026";
  if (c >= 10) return "#E31A1C";
  if (c >= 5)  return "#FC4E2A";
  if (c >= 2)  return "#FD8D3C";
  return "#FEB24C";
}

export default function DistributionMap({ fc }: { fc?: FeatureCollection }) {
  if (!fc || !fc.features?.length) return null;

  // Orta noktayı bul (basit)
  const first = fc.features[0] as Feature;
  const anyPoly = (first.geometry.type === "Polygon" && (first.geometry.coordinates as any[])[0]) || null;
  const center = anyPoly ? [anyPoly[0][1], anyPoly[0][0]] : [20, 0]; // [lat, lng]

  return (
    <div className="w-full h-80 rounded overflow-hidden border">
      <MapContainer {...({ center: center as any, zoom: 2, scrollWheelZoom: false, style: { width: "100%", height: "100%" } } as any)}>
        <TileLayer {...({ attribution: '&copy; OpenStreetMap', url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" } as any)} />
        <GeoJSON {...({ data: fc as any, style: (feature: any) => {
            const c = feature?.properties?.count ?? 1;
            return {
              color: "#00000000",
              weight: 0,
              fillColor: colorForCount(c),
              fillOpacity: 0.45
            };
          } } as any)} />
      </MapContainer>
    </div>
  );
}
