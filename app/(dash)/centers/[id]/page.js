"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";
import CenterAreasPanel from "@/components/CenterAreasPanel";
import { useParams, useRouter } from "next/navigation";

export default function CenterDetailsPage() {
  const { id } = useParams(); // /centers/[id]
  const router = useRouter();

  const { data: session } = useSession();
  const user = session?.user;
  const canEdit = has(user, "edit_center");

  const [center, setCenter] = useState(null);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [areasLoading, setAreasLoading] = useState(true);
  const [err, setErr] = useState("");
  const [areasErr, setAreasErr] = useState("");

  // Load center
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch(`/api/centers/${id}`, { cache: "no-store" });
        if (!res.ok)
          throw new Error(
            (await res.json().catch(() => ({})))?.error ||
              "Failed to load center"
          );
        const j = await res.json();
        if (!alive) return;
        setCenter(j || null);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Failed to load center");
        setCenter(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // Load areas (for stats and the panel)
  useEffect(() => {
    if (!center?._id) return;
    let alive = true;
    (async () => {
      try {
        setAreasLoading(true);
        setAreasErr("");
        // Pull a generous number. If you expect more, add UI pagination & totals later.
        const res = await fetch(
          `/api/centers/${center._id}/areas?page=1&limit=1000&sort=createdAt&dir=desc`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!alive) return;
        if (!res.ok || !Array.isArray(j.items))
          throw new Error(j?.error || "Failed to load areas");
        setAreas(j.items);
      } catch (e) {
        if (!alive) return;
        setAreas([]);
        setAreasErr(e.message || "Failed to load areas");
      } finally {
        if (alive) setAreasLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [center?._id]);

  // Derived stats
  const total = Number(center?.totalVoters ?? 0);
  const male = Number(center?.maleVoters ?? 0);
  const female = Number(center?.femaleVoters ?? 0);
  const areasCount = areas.length;

  // Percentages for the stacked bar
  const malePct = useMemo(() => {
    const denom = male + female;
    return denom > 0 ? Math.round((male / denom) * 100) : 0;
  }, [male, female]);
  const femalePct = useMemo(() => {
    const denom = male + female;
    return denom > 0 ? Math.round((female / denom) * 100) : 0;
  }, [male, female]);

  // Area with most voters
  const areaWithMostVoters = useMemo(() => {
    if (!areas.length) return null;
    return areas.reduce((acc, a) => {
      const tv = Number(a.totalVoters ?? 0);
      if (!acc) return a;
      return tv > Number(acc.totalVoters ?? 0) ? a : acc;
    }, null);
  }, [areas]);

  // little helper: tel link for contact
  const contactDisplay = useMemo(() => {
    if (!center?.contact) return "—";
    const { name, phone } = center.contact;
    if (!name && !phone) return "—";
    if (name && phone)
      return (
        <a className="text-blue-600 underline" href={`tel:${phone}`}>
          {name} ({phone})
        </a>
      );
    if (name) return name;
    return (
      <a className="text-blue-600 underline" href={`tel:${phone}`}>
        {phone}
      </a>
    );
  }, [center]);

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
        {canEdit && center && (
          <a
            className="px-3 py-1.5 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
            href={`/centers/${center._id}/edit`}
          >
            Edit
          </a>
        )}
      </div>

      {/* Heading */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            {loading ? "Loading…" : center?.name || "Center"}
          </h1>
          {center?.address ? (
            <p className="text-sm text-gray-600">{center.address}</p>
          ) : null}
        </div>
        {center?.lat != null && center?.lng != null && (
          <div className="text-xs text-gray-500">
            Lat: {center.lat} · Lng: {center.lng}
          </div>
        )}
      </header>

      {/* Error / Loading */}
      {loading && (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading center details…
        </div>
      )}
      {!loading && err && (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Content */}
      {!loading && !err && center && (
        <>
          {/* Stat cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              title="Total Voters"
              value={total}
              accent="text-green-700"
            />
            <StatCard title="Male" value={male} />
            <StatCard title="Female" value={female} />
            <StatCard title="Areas" value={areasCount} />
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

          {/* Quick facts */}
          <section className="rounded border bg-white p-4">
            <h2 className="text-sm font-semibold mb-3">Quick facts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Contact</div>
                <div>{contactDisplay}</div>
              </div>

              <div>
                <div className="text-gray-500">Area with most voters</div>
                <div>
                  {areasLoading ? (
                    "Loading…"
                  ) : areasErr ? (
                    <span className="text-red-600">{areasErr}</span>
                  ) : areaWithMostVoters ? (
                    <span className="font-medium">
                      {areaWithMostVoters.name}
                    </span>
                  ) : (
                    "—"
                  )}
                  {!areasLoading && !areasErr && areaWithMostVoters && (
                    <span className="text-gray-600">
                      {" "}
                      — {areaWithMostVoters.totalVoters ?? 0} voters
                    </span>
                  )}
                </div>
              </div>

              {center.notes ? (
                <div className="md:col-span-2">
                  <div className="text-gray-500">Notes</div>
                  <div>{center.notes}</div>
                </div>
              ) : null}
            </div>
          </section>

          {/* Areas & People */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Areas & People</h2>
            <div className="overflow-x-auto rounded border bg-white">
              <div className="min-w-[900px]">
                <CenterAreasPanel center={center} />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* --- Small presentational card --- */
function StatCard({ title, value, accent = "" }) {
  return (
    <div className="rounded border bg-white p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className={`text-lg font-semibold ${accent}`}>{value ?? 0}</div>
    </div>
  );
}
