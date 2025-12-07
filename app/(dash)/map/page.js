// "use client";

// import { useEffect, useRef, useState } from "react";

// // Simple fetch helper
// async function fetchJSON(url) {
//   const r = await fetch(url, { cache: "no-store" });
//   if (!r.ok) throw new Error(await r.text());
//   return r.json();
// }

// export default function MapPage() {
//   const [mode, setMode] = useState("city"); // "city" | "rural"

//   // geo state (same idea as committee form)
//   const [cityCorps, setCityCorps] = useState([]);
//   const [cityWards, setCityWards] = useState([]);
//   const [upazilas, setUpazilas] = useState([]);
//   const [unions, setUnions] = useState([]);
//   const [ruralWards, setRuralWards] = useState([]);

//   const [cityId, setCityId] = useState("");
//   const [cityWardId, setCityWardId] = useState("");

//   const [upazilaId, setUpazilaId] = useState("");
//   const [unionId, setUnionId] = useState("");
//   const [ruralWardId, setRuralWardId] = useState("");

//   const [centers, setCenters] = useState([]);
//   const [loadingCenters, setLoadingCenters] = useState(false);
//   const [err, setErr] = useState("");

//   // ---------- Load top-level geo ----------
//   useEffect(() => {
//     (async () => {
//       try {
//         const [cc, upa] = await Promise.all([
//           fetchJSON("/api/geo?type=city_corporation&active=1"),
//           fetchJSON("/api/geo?type=upazila&active=1"),
//         ]);
//         setCityCorps(cc.items || []);
//         setUpazilas(upa.items || []);
//       } catch (e) {
//         console.error("Failed loading geo top-level", e);
//       }
//     })();
//   }, []);

//   // City changed -> load wards, clear rural path
//   useEffect(() => {
//     if (!cityId) {
//       setCityWards([]);
//       setCityWardId("");
//       return;
//     }
//     (async () => {
//       try {
//         const j = await fetchJSON(`/api/geo?parentId=${cityId}&active=1`);
//         setCityWards(j.items || []);
//       } catch (e) {
//         console.error(e);
//       }
//     })();
//     // reset rural
//     setUpazilaId("");
//     setUnionId("");
//     setRuralWardId("");
//     setMode("city");
//   }, [cityId]);

//   // Upazila changed -> load unions, clear city path
//   useEffect(() => {
//     if (!upazilaId) {
//       setUnions([]);
//       setUnionId("");
//       setRuralWards([]);
//       setRuralWardId("");
//       return;
//     }
//     (async () => {
//       try {
//         const j = await fetchJSON(`/api/geo?parentId=${upazilaId}&active=1`);
//         setUnions(j.items || []);
//       } catch (e) {
//         console.error(e);
//       }
//     })();
//     // reset city
//     setCityId("");
//     setCityWardId("");
//     setMode("rural");
//   }, [upazilaId]);

//   // Union changed -> load rural wards
//   useEffect(() => {
//     if (!unionId) {
//       setRuralWards([]);
//       setRuralWardId("");
//       return;
//     }
//     (async () => {
//       try {
//         const j = await fetchJSON(`/api/geo?parentId=${unionId}&active=1`);
//         setRuralWards(j.items || []);
//       } catch (e) {
//         console.error(e);
//       }
//     })();
//   }, [unionId]);

//   function chooseMode(next) {
//     setMode(next);
//     if (next === "city") {
//       setUpazilaId("");
//       setUnionId("");
//       setRuralWardId("");
//     } else {
//       setCityId("");
//       setCityWardId("");
//     }
//   }

//   // ---------- Load centers when filters change ----------
//   useEffect(() => {
//     let alive = true;

//     async function loadCenters() {
//       setLoadingCenters(true);
//       setErr("");
//       try {
//         const params = [];

//         if (mode === "city") {
//           if (cityId) params.push(`cityId=${encodeURIComponent(cityId)}`);
//           if (cityWardId)
//             params.push(`wardId=${encodeURIComponent(cityWardId)}`);
//         } else {
//           if (upazilaId)
//             params.push(`upazilaId=${encodeURIComponent(upazilaId)}`);
//           if (unionId) params.push(`unionId=${encodeURIComponent(unionId)}`);
//           if (ruralWardId)
//             params.push(`wardId=${encodeURIComponent(ruralWardId)}`);
//         }

//         // if nothing selected, you can choose to load all or nothing
//         // here: if no filters, load nothing to avoid crazy clutter
//         if (params.length === 0) {
//           if (!alive) return;
//           setCenters([]);
//           setLoadingCenters(false);
//           return;
//         }

//         const qs = params.length
//           ? `?${params.join("&")}&limit=500`
//           : "?limit=500";
//         const j = await fetchJSON(`/api/centers${qs}`);
//         if (!alive) return;
//         setCenters(j.items || []);
//       } catch (e) {
//         if (!alive) return;
//         console.error(e);
//         setErr(e.message || "Failed to load centers");
//         setCenters([]);
//       } finally {
//         if (alive) setLoadingCenters(false);
//       }
//     }

//     loadCenters();
//     return () => {
//       alive = false;
//     };
//   }, [mode, cityId, cityWardId, upazilaId, unionId, ruralWardId]);

//   return (
//     <div className="flex flex-col h-[calc(100vh-4rem)]">
//       {/* Top filter bar */}
//       <div className="border-b bg-white/90 backdrop-blur px-3 py-2 z-10">
//         <div className="flex flex-wrap items-center gap-3">
//           {/* Mode tabs */}
//           <div className="inline-flex rounded border overflow-hidden">
//             <button
//               type="button"
//               className={`px-3 py-1.5 text-sm ${
//                 mode === "city"
//                   ? "bg-blue-600 text-white"
//                   : "bg-white hover:bg-gray-50"
//               }`}
//               onClick={() => chooseMode("city")}
//             >
//               City
//             </button>
//             <button
//               type="button"
//               className={`px-3 py-1.5 text-sm ${
//                 mode === "rural"
//                   ? "bg-blue-600 text-white"
//                   : "bg-white hover:bg-gray-50"
//               }`}
//               onClick={() => chooseMode("rural")}
//             >
//               Upazila
//             </button>
//           </div>

//           {mode === "city" ? (
//             <div className="flex flex-wrap items-center gap-2">
//               <select
//                 className="border rounded px-2 py-1.5 text-sm"
//                 value={cityId}
//                 onChange={(e) => setCityId(e.target.value)}
//               >
//                 <option value="">City Corporation…</option>
//                 {cityCorps.map((c) => (
//                   <option key={c._id} value={c._id}>
//                     {c.name}
//                   </option>
//                 ))}
//               </select>
//               <select
//                 className="border rounded px-2 py-1.5 text-sm"
//                 value={cityWardId}
//                 onChange={(e) => setCityWardId(e.target.value)}
//                 disabled={!cityId}
//               >
//                 <option value="">Ward…</option>
//                 {cityWards.map((w) => (
//                   <option key={w._id} value={w._id}>
//                     {w.name}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           ) : (
//             <div className="flex flex-wrap items-center gap-2">
//               <select
//                 className="border rounded px-2 py-1.5 text-sm"
//                 value={upazilaId}
//                 onChange={(e) => setUpazilaId(e.target.value)}
//               >
//                 <option value="">Upazila…</option>
//                 {upazilas.map((u) => (
//                   <option key={u._id} value={u._id}>
//                     {u.name}
//                   </option>
//                 ))}
//               </select>
//               <select
//                 className="border rounded px-2 py-1.5 text-sm"
//                 value={unionId}
//                 onChange={(e) => setUnionId(e.target.value)}
//                 disabled={!upazilaId}
//               >
//                 <option value="">Union…</option>
//                 {unions.map((u) => (
//                   <option key={u._id} value={u._id}>
//                     {u.name}
//                   </option>
//                 ))}
//               </select>
//               <select
//                 className="border rounded px-2 py-1.5 text-sm"
//                 value={ruralWardId}
//                 onChange={(e) => setRuralWardId(e.target.value)}
//                 disabled={!unionId}
//               >
//                 <option value="">Ward…</option>
//                 {ruralWards.map((w) => (
//                   <option key={w._id} value={w._id}>
//                     {w.name}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           )}

//           <div className="ml-auto text-xs text-gray-600">
//             {loadingCenters
//               ? "Loading centers…"
//               : centers.length
//               ? `${centers.length} centers`
//               : "No centers for this filter"}
//           </div>
//         </div>

//         {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
//       </div>

//       {/* Map canvas fills rest of the page */}
//       <div className="flex-1 relative">
//         <MapCanvas centers={centers} />
//       </div>
//     </div>
//   );
// }

// /**
//  * MapCanvas:
//  * Renders a Google Map and shows markers for centers.
//  * Expects each center to have { _id, name, location: { lat, lng } } or similar.
//  */
// function MapCanvas({ centers }) {
//   const mapRef = useRef(null);
//   const mapInstanceRef = useRef(null);
//   const markersRef = useRef([]);

//   // Initialize map once
//   useEffect(() => {
//     if (!mapRef.current) return;
//     if (mapInstanceRef.current) return;
//     if (typeof window === "undefined" || !window.google || !window.google.maps)
//       return;

//     mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
//       center: { lat: 24.8949, lng: 91.8687 }, // Sylhet default
//       zoom: 12,
//       mapTypeId: "roadmap",
//     });
//   }, []);

//   // Update markers when centers change
//   useEffect(() => {
//     const map = mapInstanceRef.current;
//     if (!map || !window.google || !window.google.maps) return;

//     // Clear existing markers
//     markersRef.current.forEach((m) => m.setMap(null));
//     markersRef.current = [];

//     if (!centers || centers.length === 0) return;

//     const bounds = new window.google.maps.LatLngBounds();

//     centers.forEach((c) => {
//       const lat = c.location?.lat ?? c.lat;
//       const lng = c.location?.lng ?? c.lng;
//       if (typeof lat !== "number" || typeof lng !== "number") return;

//       const marker = new window.google.maps.Marker({
//         position: { lat, lng },
//         map,
//         title: c.name || "",
//       });

//       markersRef.current.push(marker);
//       bounds.extend(marker.getPosition());
//     });

//     if (!bounds.isEmpty()) {
//       map.fitBounds(bounds);
//     }
//   }, [centers]);

//   return <div ref={mapRef} className="w-full h-full" />;
// }
