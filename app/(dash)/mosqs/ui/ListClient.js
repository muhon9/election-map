// app/(dash)/mosqs/ui/ListClient.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

function usePerms() {
  const { data } = useSession();
  const perms = data?.user?.permissions || data?.permissions || []; // adjust if your session shape differs
  const has = (p) => perms?.includes?.(p);
  return { perms, has };
}

export default function ListClient() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const { has } = usePerms();

  // table data
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const limit = 20;

  // search
  const [q, setQ] = useState("");

  // -------- GEO FILTERS --------
  // mode: "city" | "upazila"
  const [geoMode, setGeoMode] = useState("upazila");

  // ids
  const [cityId, setCityId] = useState("");
  const [upazilaId, setupazilaId] = useState("");
  const [unionId, setUnionId] = useState("");
  const [wardId, setWardId] = useState("");

  // option lists
  const [cities, setCities] = useState([]);
  const [upazilas, setupazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [wards, setWards] = useState([]);

  // ========== API helpers ==========
  async function fetchGeoByType(type) {
    const res = await fetch(
      `/api/geo?type=${encodeURIComponent(type)}&active=1`,
      { cache: "no-store" }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || `Failed to load ${type}`);
    return (j.items || []).sort(geoSorter);
  }
  async function fetchGeoChildren(parentId) {
    const res = await fetch(
      `/api/geo?parentId=${encodeURIComponent(parentId)}&active=1`,
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

  async function fetchMosqs({ page = 1 }) {
    const sp = new URLSearchParams();
    sp.set("limit", String(limit));
    sp.set("page", String(page));
    if (q) sp.set("q", q);

    // apply geo filters depending on mode
    if (geoMode === "city") {
      if (cityId) sp.set("cityId", cityId);
      if (wardId) sp.set("wardId", wardId);
    } else {
      if (upazilaId) sp.set("upazilaId", upazilaId);
      if (unionId) sp.set("unionId", unionId);
      if (wardId) sp.set("wardId", wardId);
    }

    const res = await fetch(`/api/mosqs?${sp.toString()}`, {
      cache: "no-store",
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Failed to load mosqs");
    setRows(j.items || []);
    setTotal(j.total || 0);
    setPage(j.page || 1);
    setPages(j.pages || 1);
  }

  // ========== init ==========
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // preload top-levels for both modes
        const [upas, cits] = await Promise.all([
          fetchGeoByType("upazila").catch(() => []),
          fetchGeoByType("city_corporation").catch(() => []),
        ]);
        setupazilas(upas);
        setCities(cits);

        await fetchMosqs({ page: 1 });
      } catch (e) {
        setErr(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dependent loads for mode = upazila
  useEffect(() => {
    let alive = true;
    (async () => {
      if (geoMode !== "upazila" || !upazilaId) {
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
  }, [geoMode, upazilaId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (geoMode !== "upazila" || !unionId) {
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
  }, [geoMode, unionId]);

  // dependent loads for mode = city
  useEffect(() => {
    let alive = true;
    (async () => {
      if (geoMode !== "city" || !cityId) {
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
  }, [geoMode, cityId]);

  // ========== actions ==========
  async function applyFilters() {
    await fetchMosqs({ page: 1 });
  }
  async function resetFilters() {
    setQ("");
    setGeoMode("upazila");
    setCityId("");
    setupazilaId("");
    setUnionId("");
    setWardId("");
    setUnions([]);
    setWards([]);
    await fetchMosqs({ page: 1 });
  }
  async function go(p) {
    await fetchMosqs({ page: p });
  }
  async function onDelete(id) {
    if (!confirm("Delete this mosq? This cannot be undone.")) return;
    const res = await fetch(`/api/mosqs/${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Failed to delete");
      return;
    }
    if (rows.length === 1 && page > 1) {
      await go(page - 1);
    } else {
      await go(page);
    }
  }

  // map link helper
  function mapLink(loc) {
    const lat = Number(loc?.lat || 0);
    const lng = Number(loc?.lng || 0);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat === 0 && lng === 0) return null;
    const href = `https://maps.google.com/?q=${lat},${lng}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-2 py-1 border rounded hover:bg-gray-50"
        title={`${lat}, ${lng}`}
      >
        View
      </a>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mosqs</h1>
        {has("add_center") && (
          <Link
            href="/mosqs/new"
            className="bg-blue-600 text-white px-3 py-2 rounded"
          >
            + Add Mosq
          </Link>
        )}
      </div>

      {/* Filters */}
      <section className="rounded border bg-white p-4">
        <div className="grid md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              className="border rounded w-full px-3 py-2"
              placeholder="Search by name, address or contact"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Mode
            </label>
            <select
              className="border rounded w-full px-3 py-2"
              value={geoMode}
              onChange={(e) => {
                const v = e.target.value;
                setGeoMode(v);
                // clear both paths on switch
                setCityId("");
                setupazilaId("");
                setUnionId("");
                setWardId("");
                setUnions([]);
                setWards([]);
              }}
            >
              <option value="upazila">upazila → Union → Ward</option>
              <option value="city">City → Ward</option>
            </select>
          </div>

          <div>{/* spacer for grid balance */}</div>

          {/* CITY FILTERS */}
          {geoMode === "city" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  City
                </label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                >
                  <option value="">All cities</option>
                  {cities.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Ward
                </label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={wardId}
                  onChange={(e) => setWardId(e.target.value)}
                  disabled={!cityId}
                >
                  <option value="">
                    {cityId ? "All wards" : "Select a city first"}
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

          {/* upazila FILTERS */}
          {geoMode === "upazila" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  upazila
                </label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={upazilaId}
                  onChange={(e) => setupazilaId(e.target.value)}
                >
                  <option value="">All upazilas</option>
                  {upazilas.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Union
                </label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={unionId}
                  onChange={(e) => setUnionId(e.target.value)}
                  disabled={!upazilaId}
                >
                  <option value="">
                    {upazilaId ? "All unions" : "Select an upazila first"}
                  </option>
                  {unions.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Ward
                </label>
                <select
                  className="border rounded w-full px-3 py-2"
                  value={wardId}
                  onChange={(e) => setWardId(e.target.value)}
                  disabled={
                    !upazilaId /* optionally also !unionId if ward always under union */
                  }
                >
                  <option value="">
                    {upazilaId
                      ? unionId
                        ? "All wards"
                        : "All wards (by upazila or union)"
                      : "Select an upazila first"}
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
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={applyFilters}
          >
            Apply
          </button>
          <button className="px-4 py-2 rounded border" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </section>

      {/* Table */}
      {loading ? (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading…
        </div>
      ) : err ? (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      ) : (
        <div className="rounded border overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>Name</Th>
                <Th>Address</Th>
                <Th>upazila/City</Th>
                <Th>Union</Th>
                <Th>Ward</Th>
                <Th>Contact</Th>
                <Th>Map</Th>
                {has("add_center") && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    No mosqs found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  // Be defensive: API may return populated objects or raw ids/strings
                  const cityName =
                    r.cityId?.name || r.city?.name || r.city || "";
                  const upazilaName =
                    r.upazilaId?.name || r.upazila?.name || r.upazila || "";
                  const unionName =
                    r.unionId?.name || r.union?.name || r.union || "";
                  const wardName =
                    r.wardId?.name || r.ward?.name || r.ward || "";

                  return (
                    <tr key={r._id} className="border-t">
                      <Td className="font-medium">{r.name}</Td>
                      <Td>{r.address || "-"}</Td>
                      <Td>{upazilaName || cityName || "-"}</Td>
                      <Td>{unionName || "-"}</Td>
                      <Td>{wardName || "-"}</Td>
                      <Td>{r.contact || "-"}</Td>
                      <Td>
                        {mapLink(r.location) || (
                          <span className="text-gray-400">—</span>
                        )}
                      </Td>
                      <Td right>
                        {has("add_center") && (
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/mosqs/${r._id}`}
                              className="text-blue-600 underline"
                            >
                              Edit
                            </Link>
                            <button
                              className="text-red-600 underline"
                              onClick={() => onDelete(r._id)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between p-3">
            <div className="text-sm text-gray-600">
              {rows.length
                ? `Showing ${(page - 1) * limit + 1}-${
                    (page - 1) * limit + rows.length
                  } of ${total}`
                : `0 of ${total}`}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 border rounded disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => go(page - 1)}
              >
                Prev
              </button>
              <div className="text-sm text-gray-600">
                Page {page} / {pages}
              </div>
              <button
                className="px-3 py-1.5 border rounded disabled:opacity-50"
                disabled={page >= pages}
                onClick={() => go(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`text-left p-2 ${className}`}>{children}</th>;
}
function Td({ children, right, className = "" }) {
  return (
    <td className={`p-2 ${right ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}
