// app/(dash)/mosqs/ui/MosqForm.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MosqForm({ mode = "create", id }) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(isEdit);
  const [err, setErr] = useState("");

  // core fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");

  // ---------- NEW GEO STATE (IDs) ----------
  // mode: "city" | "upazila"
  const [geoMode, setGeoMode] = useState("upazila");

  const [cityId, setCityId] = useState("");
  const [upazilaId, setupazilaId] = useState("");
  const [unionId, setUnionId] = useState("");
  const [wardId, setWardId] = useState("");

  const [cities, setCities] = useState([]);
  const [upazilas, setupazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [wards, setWards] = useState([]);

  // ---------- Legacy refs (optional) ----------
  const [centerId, setCenterId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [centers, setCenters] = useState([]);
  const [areas, setAreas] = useState([]);

  // location
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  // ===== Helpers (APIs) =====
  async function fetchCenters() {
    const res = await fetch(`/api/centers?limit=500`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Failed to load centers");
    return Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
  }
  async function fetchAreasByCenter(id) {
    if (!id) return [];
    const res = await fetch(`/api/centers/${encodeURIComponent(id)}/areas`, {
      cache: "no-store",
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Failed to load areas");
    return Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
  }

  async function fetchGeoByType(type) {
    const res = await fetch(
      `/api/geo?type=${encodeURIComponent(type)}&active=1`,
      { cache: "no-store" }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || `Failed to load ${type}`);
    return (j.items || []).sort(geoSorter);
  }
  async function fetchGeoChildren(parent) {
    const res = await fetch(
      `/api/geo?parentId=${encodeURIComponent(parent)}&active=1`,
      { cache: "no-store" }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Failed to load children");
    return (j.items || []).sort(geoSorter);
  }
  function geoSorter(a, b) {
    const sa = Number.isFinite(Number(a.sort)) ? Number(a.sort) : 0;
    const sb = Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0;
    return sa - sb || String(a.name).localeCompare(String(b.name));
  }

  // ===== Initial load (lists + edit prefill) =====
  useEffect(() => {
    (async () => {
      try {
        setErr("");

        // Load static lists we always want available
        const [cs, upas, cts] = await Promise.all([
          fetchCenters().catch(() => []),
          fetchGeoByType("upazila").catch(() => []),
          fetchGeoByType("city_corporation").catch(() => []),
        ]);
        setCenters(cs);
        setupazilas(upas);
        setCities(cts);

        if (isEdit) {
          setLoading(true);
          const res = await fetch(`/api/mosqs/${id}`, { cache: "no-store" });
          const j = await res.json();
          if (!res.ok) throw new Error(j?.error || "Failed to load mosq");

          setName(j.name || "");
          setAddress(j.address || "");
          setContact(j.contact || "");

          // location snapshot
          setLat(
            typeof j.location?.lat === "number" ? String(j.location.lat) : ""
          );
          setLng(
            typeof j.location?.lng === "number" ? String(j.location.lng) : ""
          );

          // legacy refs
          const cId = j.center?._id || j.center || "";
          const aId = j.area?._id || j.area || "";
          setCenterId(cId ? String(cId) : "");
          setAreaId(aId ? String(aId) : "");
          if (cId) {
            const as = await fetchAreasByCenter(String(cId));
            setAreas(as);
          }

          // --- NEW GEO PREFILL ---
          const jCity = j.cityId?._id || j.cityId || "";
          const jUpa = j.upazilaId?._id || j.upazilaId || "";
          const jUni = j.unionId?._id || j.unionId || "";
          const jWar = j.wardId?._id || j.wardId || "";

          if (jCity) {
            setGeoMode("city");
            setCityId(String(jCity));
            // prefetch wards under this city
            const ws = await fetchGeoChildren(String(jCity));
            setWards(ws);
            if (jWar && ws.find((w) => w._id === String(jWar))) {
              setWardId(String(jWar));
            }
            // clear upazila/union
            setupazilaId("");
            setUnionId("");
          } else if (jUpa) {
            setGeoMode("upazila");
            setupazilaId(String(jUpa));
            // unions under upazila
            const us = await fetchGeoChildren(String(jUpa));
            setUnions(us);
            if (jUni && us.find((u) => u._id === String(jUni))) {
              setUnionId(String(jUni));
              // wards under union
              const ws = await fetchGeoChildren(String(jUni));
              setWards(ws);
              if (jWar && ws.find((w) => w._id === String(jWar))) {
                setWardId(String(jWar));
              }
            } else {
              // if no union stored but ward is directly under upazila (allowed by your validator),
              // load wards from upazila:
              if (jWar) {
                const ws = await fetchGeoChildren(String(jUpa));
                setWards(ws);
                if (ws.find((w) => w._id === String(jWar))) {
                  setWardId(String(jWar));
                }
              }
            }
            // clear city
            setCityId("");
          }
        }
      } catch (e) {
        setErr(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // ===== Center → Areas (legacy) =====
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!centerId) {
          setAreas([]);
          setAreaId("");
          return;
        }
        const as = await fetchAreasByCenter(centerId);
        if (!alive) return;
        setAreas(as);
        if (!as.find((a) => a._id === areaId)) setAreaId("");
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load areas");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);

  // ===== GEO dependent loads =====
  // Mode switch clears incompatible selections
  useEffect(() => {
    if (geoMode === "city") {
      // clear upazila path
      setupazilaId("");
      setUnionId("");
      setWards([]);
      setWardId("");
    } else {
      // clear city path
      setCityId("");
      setWards([]);
      setWardId("");
    }
  }, [geoMode]);

  // On city change → load wards under city
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!cityId || geoMode !== "city") {
        setWards([]);
        setWardId("");
        return;
      }
      try {
        const ws = await fetchGeoChildren(cityId);
        if (!alive) return;
        setWards(ws);
        if (!ws.find((w) => w._id === wardId)) setWardId("");
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load wards");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, geoMode]);

  // On upazila change → load unions (and reset ward)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!upazilaId || geoMode !== "upazila") {
        setUnions([]);
        setUnionId("");
        setWards([]);
        setWardId("");
        return;
      }
      try {
        const us = await fetchGeoChildren(upazilaId);
        if (!alive) return;
        setUnions(us);
        if (!us.find((u) => u._id === unionId)) setUnionId("");
        setWards([]);
        setWardId("");
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load unions");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upazilaId, geoMode]);

  // On union change → load wards under union
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!unionId || geoMode !== "upazila") {
        setWards([]);
        setWardId("");
        return;
      }
      try {
        const ws = await fetchGeoChildren(unionId);
        if (!alive) return;
        setWards(ws);
        if (!ws.find((w) => w._id === wardId)) setWardId("");
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load wards");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unionId, geoMode]);

  // ===== Submit =====
  async function onSubmit(e) {
    e.preventDefault();
    if (!name) {
      alert("Name is required");
      return;
    }
    const latNum = lat === "" ? 0 : Number.parseFloat(lat);
    const lngNum = lng === "" ? 0 : Number.parseFloat(lng);
    const safeLat = Number.isFinite(latNum) ? latNum : 0;
    const safeLng = Number.isFinite(lngNum) ? lngNum : 0;

    // Build geo payload based on mode (all optional)
    const geoPayload =
      geoMode === "city"
        ? {
            cityId: cityId || null,
            // Ward under city (optional)
            wardId: wardId || null,
            upazilaId: null,
            unionId: null,
          }
        : {
            upazilaId: upazilaId || null,
            unionId: unionId || null,
            wardId: wardId || null, // can be under union or (rarely) upazila depending on your data
            cityId: null,
          };

    const payload = {
      name,
      address,
      contact,
      ...(centerId ? { centerId } : {}),
      ...(areaId ? { areaId } : {}),
      ...geoPayload,
      location: { lat: safeLat, lng: safeLng },
    };

    const url = isEdit ? `/api/mosqs/${id}` : `/api/mosqs`;
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || (isEdit ? "Failed to update" : "Failed to create"));
      return;
    }
    router.push("/mosqs");
  }

  // ===== UI =====
  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <button
          className="px-3 py-1.5 border rounded hover:bg-gray-50"
          onClick={() => router.back()}
        >
          ← Back
        </button>
      </div>

      <h1 className="text-xl font-semibold">
        {isEdit ? "Edit Mosq" : "Add Mosq"}
      </h1>

      {loading ? (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading…
        </div>
      ) : err ? (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="rounded border bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Basic */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {/* Contact */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Contact (optional)
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Name / phone / email"
            />
          </div>

          {/* GEO MODE */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Location Mode
            </label>
            <select
              className="border rounded w-full px-3 py-2"
              value={geoMode}
              onChange={(e) => setGeoMode(e.target.value)}
            >
              <option value="upazila">upazila → Union → Ward</option>
              <option value="city">City → Ward</option>
            </select>
          </div>
          <div />

          {/* CITY MODE */}
          {geoMode === "city" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  City (optional)
                </label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {cities.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Ward (optional)
                </label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={wardId}
                  onChange={(e) => setWardId(e.target.value)}
                  disabled={!cityId}
                  title={!cityId ? "Select a city first" : ""}
                >
                  <option value="">
                    {cityId ? "— None —" : "Select a city first"}
                  </option>
                  {wards.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* upazila MODE */}
          {geoMode === "upazila" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  upazila (optional)
                </label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={upazilaId}
                  onChange={(e) => setupazilaId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {upazilas.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Union (optional)
                </label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={unionId}
                  onChange={(e) => setUnionId(e.target.value)}
                  disabled={!upazilaId}
                  title={!upazilaId ? "Select an upazila first" : ""}
                >
                  <option value="">
                    {upazilaId ? "— None —" : "Select an upazila first"}
                  </option>
                  {unions.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Ward (optional)
                </label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={wardId}
                  onChange={(e) => setWardId(e.target.value)}
                  disabled={!upazilaId /* and optionally !unionId */}
                  title={
                    !upazilaId
                      ? "Select an upazila first"
                      : unionId
                      ? ""
                      : "Select a union (if required)"
                  }
                >
                  <option value="">
                    {!upazilaId
                      ? "Select an upazila first"
                      : unionId
                      ? "— None —"
                      : "— None —"}
                  </option>
                  {wards.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Note: Wards are loaded from the selected Union. If your data
                  model places wards directly under an upazila, select the
                  upazila and leave Union empty—then pick from the loaded wards.
                </p>
              </div>
            </>
          )}

          {/* Legacy Center/Area refs (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Center (optional)
            </label>
            <select
              className="border rounded w-full px-3 py-2"
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
            >
              <option value="">— None —</option>
              {centers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Area (optional)
            </label>
            <select
              className="border rounded w-full px-3 py-2"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              disabled={!centerId}
            >
              <option value="">
                {centerId ? "— None —" : "Select a center first"}
              </option>
              {areas.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Latitude (optional)
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              inputMode="decimal"
              placeholder="e.g., 23.7773"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Longitude (optional)
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              inputMode="decimal"
              placeholder="e.g., 90.3995"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <button className="bg-blue-600 text-white px-4 py-2 rounded">
              {isEdit ? "Save changes" : "Create Mosq"}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded border"
              onClick={() => router.push("/mosqs")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
