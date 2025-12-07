"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";
import { GoogleMap, Polygon, useJsApiLoader } from "@react-google-maps/api";

const PAGE_SIZES = [10, 20, 50];

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const MINIMAL_MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export default function AreaDetailsPage() {
  const { id } = useParams(); // /areas/[id]
  const router = useRouter();
  const sp = useSearchParams();

  const { data: session } = useSession();
  const user = session?.user;
  const canEdit = has(user, "edit_center");

  const [area, setArea] = useState(null);
  const [center, setCenter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // 🔹 Related committees state
  const [committees, setCommittees] = useState([]);
  const [committeesLoading, setCommitteesLoading] = useState(false);
  const [committeesErr, setCommitteesErr] = useState("");

  // Google Maps loader (for area boundary map)
  const { isLoaded: mapLoaded } = useJsApiLoader({
    id: "map-page-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });

  // Load area (expects GET /api/areas/:id)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        setLoading(true);
        const res = await fetch(`/api/areas/${id}`, { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(j?.error || "Failed to load area");
        setArea(j);
      } catch (e) {
        if (!alive) return;
        setArea(null);
        setErr(e.message || "Failed to load area");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // Load parent center (if area loaded)
  useEffect(() => {
    if (!area?.center) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/centers/${area.center}`, {
          cache: "no-store",
        });
        const j = await res.json();
        if (!alive) return;
        if (res.ok) setCenter(j);
        else setCenter(null);
      } catch {
        if (!alive) return;
        setCenter(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [area?.center]);

  // 🔹 Load committees related to this area
  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        setCommitteesErr("");
        setCommitteesLoading(true);
        const res = await fetch(
          `/api/committees?areaId=${encodeURIComponent(
            id
          )}&limit=50&sort=name&dir=asc`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(j?.error || "Failed to load committees");
        setCommittees(Array.isArray(j.items) ? j.items : []);
      } catch (e) {
        if (!alive) return;
        setCommittees([]);
        setCommitteesErr(e.message || "Failed to load committees");
      } finally {
        if (alive) setCommitteesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const total = Number(area?.totalVoters ?? 0);
  const male = Number(area?.maleVoters ?? 0);
  const female = Number(area?.femaleVoters ?? 0);

  const malePct = useMemo(() => {
    const denom = male + female;
    return denom > 0 ? Math.round((male / denom) * 100) : 0;
  }, [male, female]);
  const femalePct = useMemo(() => {
    const denom = male + female;
    return denom > 0 ? Math.round((female / denom) * 100) : 0;
  }, [male, female]);

  // Default tab from query (?tab=COMMITTEE|RENOWNED|CONTACT); will also react to changes
  const tabFromUrl = (sp.get("tab") || "").toUpperCase();
  const validTabs = ["COMMITTEE", "RENOWNED", "CONTACT"];
  const initialOpen = validTabs.includes(tabFromUrl) ? tabFromUrl : null;

  // ---------- Area shape → Google Maps paths ----------

  const shapePaths = useMemo(
    () => normalizeShapeToPaths(area?.shape),
    [area?.shape]
  );

  const hasShape = shapePaths.length > 0;

  const mapCenter = useMemo(() => {
    if (!hasShape) {
      // Fallback: Sylhet-ish
      return { lat: 24.8949, lng: 91.8687 };
    }
    const points = shapePaths.flat();
    if (!points.length) return { lat: 24.8949, lng: 91.8687 };
    const lat =
      points.reduce((acc, p) => acc + (p.lat || 0), 0) / points.length;
    const lng =
      points.reduce((acc, p) => acc + (p.lng || 0), 0) / points.length;
    return { lat, lng };
  }, [shapePaths, hasShape]);

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 border rounded hover:bg-gray-50"
            onClick={() => router.back()}
          >
            ← Back
          </button>
          <a className="text-sm text-blue-600 underline" href="/centers">
            All centers
          </a>
        </div>
        {canEdit && area && (
          <a
            className="px-3 py-1.5 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
            href={`/areas/${id}/edit`}
          >
            Edit
          </a>
        )}
      </div>

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            {loading ? "Loading…" : area?.name || "Area"}
          </h1>
          <div className="text-sm text-gray-600">
            In center:{" "}
            {center ? (
              <a
                className="text-blue-600 underline"
                href={`/centers/${center._id}`}
              >
                {center.name}
              </a>
            ) : (
              "—"
            )}
            {area?.code && (
              <span className="ml-2 text-gray-500">• Code: {area.code}</span>
            )}
          </div>
        </div>
      </header>

      {/* Error / Loading */}
      {loading && (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading area details…
        </div>
      )}
      {!loading && err && (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Content */}
      {!loading && !err && area && (
        <>
          {/* 🔺 Area boundary map */}
          <section className="rounded border bg-white p-4 space-y-2">
            <h2 className="text-sm font-semibold">Area boundary</h2>
            {!hasShape ? (
              <div className="text-xs text-gray-500">
                No area boundary specified.
              </div>
            ) : !mapLoaded ? (
              <div className="text-xs text-gray-600">Loading map…</div>
            ) : (
              <div className="mt-2 w-full h-64 rounded border overflow-hidden">
                <GoogleMap
                  mapContainerStyle={MAP_CONTAINER_STYLE}
                  center={mapCenter}
                  zoom={15}
                  options={{
                    styles: MINIMAL_MAP_STYLE,
                    disableDefaultUI: true,
                    zoomControl: true,
                    gestureHandling: "greedy",
                    backgroundColor: "#f7f7f7",
                  }}
                >
                  {shapePaths.map((path, idx) => (
                    <Polygon
                      key={idx}
                      paths={path}
                      options={{
                        strokeColor: "#ef4444", // red-500 line
                        strokeOpacity: 0.9,
                        strokeWeight: 2,
                        fillOpacity: 0, // transparent inside
                        clickable: false,
                      }}
                    />
                  ))}
                </GoogleMap>
              </div>
            )}
          </section>

          {/* Stat cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              title="Total Voters"
              value={total}
              accent="text-green-700"
            />
            <StatCard title="Male" value={male} />
            <StatCard title="Female" value={female} />
            <StatCard title="Notes" value={area.notes ? "Yes" : "—"} />
          </section>

          {/* Stacked bar (Male vs Female) */}
          <section className="rounded border bg-white p-4">
            <h2 className="text-sm font-semibold mb-3">Voters breakdown</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Male</span>
                <span>{malePct}%</span>
              </div>
              <div className="w-full h-3 rounded bg-gray-200 overflow-hidden">
                <div
                  className="h-3"
                  style={{
                    width: `${malePct}%`,
                    backgroundColor: "#60a5fa" /* blue-400 */,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600 pt-2">
                <span>Female</span>
                <span>{femalePct}%</span>
              </div>
              <div className="w-full h-3 rounded bg-gray-200 overflow-hidden">
                <div
                  className="h-3"
                  style={{
                    width: `${femalePct}%`,
                    backgroundColor: "#f472b6" /* pink-400 */,
                  }}
                />
              </div>

              <div className="text-xs text-gray-500 mt-2">
                Total considered: {male + female} (male + female). Overall
                voters: {total}.
              </div>
            </div>
          </section>

          {/* Notes */}
          {area.notes && (
            <section className="rounded border bg-white p-4">
              <h2 className="text-sm font-semibold mb-2">Notes</h2>
              <p className="text-sm">{area.notes}</p>
            </section>
          )}

          {/* 🔹 Related Committees */}
          <section className="rounded border bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Committees in this area</h2>
              <a
                href={`/committees?areaId=${encodeURIComponent(id)}`}
                className="text-xs text-blue-600 underline"
              >
                View all
              </a>
            </div>

            {committeesLoading && (
              <div className="text-xs text-gray-600">Loading committees…</div>
            )}

            {!committeesLoading && committeesErr && (
              <div className="text-xs text-red-600">{committeesErr}</div>
            )}

            {!committeesLoading &&
              !committeesErr &&
              committees.length === 0 && (
                <div className="text-xs text-gray-500">
                  No committees linked to this area yet.
                </div>
              )}

            {!committeesLoading && !committeesErr && committees.length > 0 && (
              <ul className="divide-y text-sm">
                {committees.map((c) => (
                  <li
                    key={c._id}
                    className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                  >
                    <div>
                      <a
                        href={`/committees/${c._id}`}
                        className="font-medium text-blue-700 underline"
                      >
                        {c.name}
                      </a>
                      {Array.isArray(c.centers) && c.centers.length > 0 && (
                        <div className="text-xs text-gray-600">
                          Centers: {c.centers.map((x) => x.name).join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">
                      {typeof c.peopleCount === "number"
                        ? `${c.peopleCount} members`
                        : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* People Accordion */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">People</h2>
            <PeopleAccordion areaId={String(id)} initialOpen={initialOpen} />
          </section>
        </>
      )}
    </div>
  );
}

/* -------- helpers for shapes -------- */

function normalizeShapeToPaths(shape) {
  if (!shape || !shape.type || !shape.coordinates) return [];

  // Polygon: coordinates = [ [ [lng, lat], ... ], [hole], ... ]
  if (shape.type === "Polygon") {
    const outer = Array.isArray(shape.coordinates?.[0])
      ? shape.coordinates[0]
      : [];
    if (!outer.length) return [];
    return [
      outer.map((pt) => {
        const [lng, lat] = pt;
        return { lat: Number(lat), lng: Number(lng) };
      }),
    ];
  }

  // MultiPolygon: coordinates = [ [ [ [lng, lat], ... ], ... ], ... ]
  if (shape.type === "MultiPolygon") {
    const paths = [];
    for (const poly of shape.coordinates || []) {
      const outer = Array.isArray(poly?.[0]) ? poly[0] : [];
      if (!outer.length) continue;
      paths.push(
        outer.map((pt) => {
          const [lng, lat] = pt;
          return { lat: Number(lat), lng: Number(lng) };
        })
      );
    }
    return paths;
  }

  return [];
}

/* -------- People Accordion (reacts to ?tab=) -------- */

function PeopleAccordion({ areaId, initialOpen = null }) {
  const sp = useSearchParams();
  const [openTab, setOpenTab] = useState(initialOpen); // "COMMITTEE" | "RENOWNED" | "CONTACT" | null

  // React to URL changes (so navigating to ?tab=RENOWNED expands it)
  useEffect(() => {
    const t = (sp.get("tab") || "").toUpperCase();
    if (["COMMITTEE", "RENOWNED", "CONTACT"].includes(t)) setOpenTab(t);
  }, [sp]);

  return (
    <div className="rounded border bg-white divide-y">
      {/* <PeopleSection
        title="Committee"
        areaId={areaId}
        category="COMMITTEE"
        open={openTab === "COMMITTEE"}
        onToggle={() =>
          setOpenTab(openTab === "COMMITTEE" ? null : "COMMITTEE")
        }
        defaultSort="order"
        defaultDir="asc"
      /> */}
      <PeopleSection
        title="Important"
        areaId={areaId}
        category="RENOWNED"
        open={openTab === "RENOWNED"}
        onToggle={() => setOpenTab(openTab === "RENOWNED" ? null : "RENOWNED")}
        defaultSort="importance"
        defaultDir="desc"
      />
      <PeopleSection
        title="Contacts"
        areaId={areaId}
        category="CONTACT"
        open={openTab === "CONTACT"}
        onToggle={() => setOpenTab(openTab === "CONTACT" ? null : "CONTACT")}
        defaultSort="name"
        defaultDir="asc"
      />
    </div>
  );
}

function PeopleSection({
  title,
  areaId,
  category,
  open,
  onToggle,
  defaultSort = "name",
  defaultDir = "asc",
}) {
  const { data: session } = useSession();
  const user = session?.user;
  const canEdit = has(user, "edit_center");
  const canDelete = has(user, "delete_center");

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [sort, setSort] = useState(defaultSort);
  const [dir, setDir] = useState(defaultDir);

  const [data, setData] = useState({ items: [], total: 0, pages: 1, page: 1 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // When opening a different tab, reset paging & query but keep default sorts
  useEffect(() => {
    if (!open) return;
    setPage(1);
    setQ("");
    setSort(defaultSort);
    setDir(defaultDir);
  }, [open, defaultSort, defaultDir]);

  // Fetch when open or any control changes
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const url =
          `/api/areas/${areaId}/people?category=${category}` +
          `&q=${encodeURIComponent(q)}` +
          `&page=${page}&limit=${limit}&sort=${sort}&dir=${dir}`;
        const res = await fetch(url, { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(j?.error || "Failed to load people");
        setData(j || { items: [], total: 0, pages: 1, page: 1 });
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Failed to load people");
        setData({ items: [], total: 0, pages: 1, page: 1 });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, q, page, limit, sort, dir, areaId, category]);

  function toggleSort(field) {
    if (category === "COMMITTEE" && field === "order") {
      setSort("order");
      setDir("asc");
      return;
    }
    if (sort === field) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setDir(field === "importance" ? "desc" : "asc");
    }
  }

  async function onDelete(id) {
    if (!canDelete) return;
    if (!confirm("Delete this person?")) return;
    const res = await fetch(`/api/people/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to delete person");
      return;
    }
    // refresh
    setPage((p) => p);
  }

  return (
    <div className="p-0">
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50"
        onClick={onToggle}
      >
        <span className="font-medium">{title}</span>
        <span className="text-sm text-gray-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-gray-600">
              {data.total} {title.toLowerCase()}
            </div>
            <div className="flex items-center gap-2">
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder={`Search ${title.toLowerCase()}…`}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
              <select
                className="border rounded px-2 py-2 text-sm"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}/page
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded border overflow-x-auto bg-white">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {/* Name column now shows designation/position inline for all categories */}
                  <Th
                    field="name"
                    sort={sort}
                    dir={dir}
                    onSort={toggleSort}
                    disabled={category === "COMMITTEE" && sort !== "order"}
                  >
                    Name
                  </Th>

                  {category === "COMMITTEE" && (
                    <>
                      <th className="text-left p-2">Committee / Position</th>
                      <Th
                        field="order"
                        sort={sort}
                        dir={dir}
                        onSort={toggleSort}
                      >
                        Order
                      </Th>
                    </>
                  )}

                  {category === "RENOWNED" && (
                    <Th
                      field="importance"
                      sort={sort}
                      dir={dir}
                      onSort={toggleSort}
                    >
                      Importance
                    </Th>
                  )}

                  <th className="text-left p-2 w-[160px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      className="p-3 text-gray-500"
                      colSpan={
                        category === "COMMITTEE"
                          ? 4
                          : category === "RENOWNED"
                          ? 3
                          : 2
                      }
                    >
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && err && (
                  <tr>
                    <td
                      className="p-3 text-red-600"
                      colSpan={
                        category === "COMMITTEE"
                          ? 4
                          : category === "RENOWNED"
                          ? 3
                          : 2
                      }
                    >
                      {err}
                    </td>
                  </tr>
                )}
                {!loading && !err && data.items.length === 0 && (
                  <tr>
                    <td
                      className="p-3 text-gray-500"
                      colSpan={
                        category === "COMMITTEE"
                          ? 4
                          : category === "RENOWNED"
                          ? 3
                          : 2
                      }
                    >
                      No items.
                    </td>
                  </tr>
                )}
                {!loading &&
                  !err &&
                  data.items.map((p) => (
                    <tr key={p._id} className="border-top align-top">
                      {/* Name + designation/position inline */}
                      <td className="p-2 font-medium">
                        <div className="truncate">
                          <span>{p.name}</span>
                          {/* Committee: show position inline; Important & Contact: show designation inline */}
                          {category === "COMMITTEE" && p.position && (
                            <span className="text-gray-600">
                              {" "}
                              — {p.position}
                            </span>
                          )}
                          {category !== "COMMITTEE" && p.designation && (
                            <span className="text-gray-600">
                              {" "}
                              — {p.designation}
                            </span>
                          )}
                          {/* Phone inline (optional) */}
                          {p.phone && (
                            <span className="ml-2">
                              <a
                                className="text-blue-600 underline"
                                href={`tel:${p.phone}`}
                              >
                                {p.phone}
                              </a>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Committee-specific extra column */}
                      {category === "COMMITTEE" && (
                        <>
                          <td className="p-2">
                            <div>{p.committeeName || "—"}</div>
                          </td>
                          <td className="p-2">
                            {typeof p.order === "number" ? p.order : "—"}
                          </td>
                        </>
                      )}

                      {/* Important (RENOWNED) specific column */}
                      {category === "RENOWNED" && (
                        <td className="p-2">
                          {typeof p.importance === "number" ? p.importance : 0}
                        </td>
                      )}

                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <a
                              className="px-2 py-1 border rounded hover:bg-gray-50"
                              href={`/areas/${areaId}/edit?person=${p._id}`}
                            >
                              Edit
                            </a>
                          )}
                          {canDelete && (
                            <button
                              className="px-2 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50"
                              onClick={() => onDelete(p._id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page <b>{data.page || 1}</b> of <b>{data.pages || 1}</b>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={(data.page || 1) <= 1}
              >
                Prev
              </button>
              {Array.from({ length: data.pages || 1 }, (_, i) => i + 1)
                .slice(Math.max(0, page - 3), page + 2)
                .map((n) => (
                  <button
                    key={n}
                    className={`px-3 py-1.5 border rounded text-sm ${
                      n === (data.page || 1)
                        ? "bg-blue-600 text-white border-blue-600"
                        : ""
                    }`}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
              <button
                className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(data.pages || 1, p + 1))}
                disabled={(data.page || 1) >= (data.pages || 1)}
              >
                Next
              </button>
            </div>
          </div>

          {/* Add new person quick links */}
          {canEdit && (
            <div className="pt-2">
              <a
                className="inline-flex items-center px-3 py-1.5 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                href={`/areas/${areaId}/edit?add=${category}`}
              >
                Add to {title}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------- UI bits -------- */

function StatCard({ title, value, accent = "" }) {
  return (
    <div className="rounded border bg-white p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className={`text-lg font-semibold ${accent}`}>{value ?? 0}</div>
    </div>
  );
}

function Th({ children, field, sort, dir, onSort, disabled }) {
  const active = sort === field;
  return (
    <th className="text-left p-2 select-none">
      <span
        role="button"
        className={`inline-flex items-center gap-1 ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
        onClick={() => !disabled && onSort(field)}
      >
        {children}
        <span className={`text-xs ${active ? "opacity-100" : "opacity-40"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </th>
  );
}
