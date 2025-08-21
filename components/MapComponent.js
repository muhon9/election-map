"use client";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { useEffect, useState } from "react";

export default function MapComponent() {
  const [points, setPoints] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch("/api/points").then(r=>r.json()).then(setPoints);
  }, []);

  return (
    <div>
      <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={{ height: "60vh", width: "100%" }}
          center={{ lat: 23.8103, lng: 90.4125 }} zoom={12}
          options={{
            styles: [
              { featureType: "poi", stylers: [{ visibility: "off" }] },
              { featureType: "transit", stylers: [{ visibility: "off" }] }
            ]
          }}
        >
          {points.map((p) => (
            <Marker key={p._id}
              position={{ lat: p.lat, lng: p.lng }}
              onClick={() => setSelected(p)} />
          ))}
        </GoogleMap>
      </LoadScript>

      <div className="bg-white p-4 border-t">
        {selected ? (
          <>
            <h3 className="font-semibold">{selected.name}</h3>
            <p className="text-sm text-gray-600">{selected.description}</p>
          </>
        ) : (
          <p className="text-sm text-gray-500">Click a marker to see details.</p>
        )}
      </div>
    </div>
  );
}
