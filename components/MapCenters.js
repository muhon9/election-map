"use client";

import { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

const containerStyle = { width: "100%", height: "420px" };

// Minimal style (no shops/POIs/etc)
const MINIMAL_MAP_STYLE = [
  { elementType: "labels", stylers: [{ visibility: "off" }] }, // hide ALL labels
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.man_made", stylers: [{ visibility: "off" }] },
];

// Simple SVG pin as data URL; colorizable
function pinDataUrl(color = "#2563eb") {
  // classic pin with a white dot, scaled to 40x40
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">
        <path fill="${color}" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7"/>
        <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
      </svg>
    `)
  );
}

export default function MapCenters() {
  const [centers, setCenters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/centers");
      const data = await res.json();
      if (!alive) return;
      setCenters(Array.isArray(data) ? data : []);
    })();
    return () => { alive = false; };
  }, []);

  const selected = useMemo(
    () => centers.find(c => c._id === selectedId) || null,
    [centers, selectedId]
  );

  const initialCenter = useMemo(() => {
    if (!centers.length) return { lat: 23.7806, lng: 90.4070 }; // Dhaka fallback
    const lat = centers.reduce((a, c) => a + (c.lat || 0), 0) / centers.length;
    const lng = centers.reduce((a, c) => a + (c.lng || 0), 0) / centers.length;
    return { lat, lng };
  }, [centers]);

  const onMapLoad = (map) => {
    if (centers.length) {
      const bounds = new window.google.maps.LatLngBounds();
      centers.forEach(c => bounds.extend({ lat: c.lat, lng: c.lng }));
      if (!bounds.isEmpty()) map.fitBounds(bounds);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded border overflow-hidden">
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={initialCenter}
            zoom={12}
            onLoad={onMapLoad}
            onClick={() => setSelectedId(null)} // click blank map to clear
            options={{
              styles: MINIMAL_MAP_STYLE,
              disableDefaultUI: true,
              zoomControl: true,
              gestureHandling: "greedy",
              backgroundColor: "#f7f7f7",
            }}
          >
          {centers.map((c) => {
  const isSelected = c._id === selectedId;
  const short = c?.name ? (c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name) : "Center";

  return (
    <Marker
      key={c._id}
      position={{ lat: c.lat, lng: c.lng }}
      onClick={() => setSelectedId(c._id)}
      icon={{
        url: isSelected ? pinDataUrl("#16a34a") : pinDataUrl("#2563eb"),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 32),
        // (optional) nudge label position a bit
        labelOrigin: new google.maps.Point(16, -2),
      }}
      label={{
        text: short,
        className: `marker-badge ${isSelected ? "marker-badge--selected" : ""}`,
      }}
      zIndex={isSelected ? 999 : 1}
    />
  );
})}

          </GoogleMap>
        )}
      </div>

      {/* Details panel under the map */}
      <div className="rounded border bg-white p-4">
        {!selected ? (
          <div className="text-sm text-gray-600">{centers.length} centers found. Tap a marker to see center details.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-y-1 gap-x-6 text-sm">
  {/* Center Name bigger */}
  <div className="md:col-span-2 text-lg font-semibold text-gray-800">
    {selected.name}
  </div>

  <div><span className="text-gray-500">Address:</span> {selected.address || "-"}</div>
  <div><span className="text-gray-500">Contact:</span> {selected.contact?.name || "-"}</div>
  <div><span className="text-gray-500">Phone:</span> {selected.contact?.phone || "-"}</div>

  {/* Highlight Total Voters */}
  <div className="md:col-span-2 mt-2">
    <span className="text-gray-500">Total voters:</span>{" "}
    <span className="text-xl font-bold text-green-700">
      {selected.totalVoters ?? 0}
    </span>
    <div className="ml-4 mt-1 text-sm text-gray-700">
      <div>Male voters: {selected.maleVoters ?? 0}</div>
      <div>Female voters: {selected.femaleVoters ?? 0}</div>
    </div>
  </div>

  <div className="md:col-span-2">
    <span className="text-gray-500">Notes:</span> {selected.notes || "-"}
  </div>

  <div className="md:col-span-2 mt-2">
    <a className="text-blue-600 underline mr-3" href={`/centers/${selected._id}`}>Edit</a>
    <a className="text-gray-600 underline" href={`/centers`}>All centers</a>
  </div>
</div>
        )}
      </div>
    </div>
  );
}
