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

  // --- NEW: Committees related to this center / its areas ---
  const [committees, setCommittees] = useState([]);
  const [committeesLoading, setCommitteesLoading] = useState(false);
  const [committeesErr, setCommitteesErr] = useState("");

  // Load center
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch(`/api/centers/${id}`, { cache: "no-store" });
        if (!res.ok) {
          let msg = "Failed to load center";
          try {
            const j = await res.json();
            msg = j?.error || msg;
          } catch {}
          throw new Error(msg);
        }
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
        const res = await fetch(
          `/api/centers/${center._id}/areas?page=1&limit=1000&sort=createdAt&dir=desc`,
          { cache: "no-store" },
        );
        const j = await res.json();
        if (!alive) return;
        if (!res.ok || !Array.isArray(j.items)) {
          throw new Error(j?.error || "Failed to load areas");
        }
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

  // --- NEW: Load related committees (by center + its areas) ---
  useEffect(() => {
    if (!center?._id) return;
    console.log("centers", center.wardId);
    // We wait until areas finished loading so we know the full list of areaIds.
    if (areasLoading) return;
    const { wardId } = center;
    let alive = true;
    (async () => {
      try {
        setCommitteesLoading(true);
        setCommitteesErr("");

        const areaIds = (areas || []).map((a) => a?._id).filter(Boolean);

        const params = new URLSearchParams();
        params.set("limit", "200"); // enough for one center's committees
        params.set("centerId", center._id);
        // console.log("ward", wardId);
        // params.set("wardId", wardId);

        // Optional: let API accept a CSV of areaIds (you can implement this server-side)
        if (areaIds.length) {
          params.set("areaIds", areaIds.join(","));
        }

        const res = await fetch(`/api/committees?${params.toString()}`, {
          cache: "no-store",
        });
        const j = await res.json();
        if (!alive) return;
        if (!res.ok || !Array.isArray(j.items)) {
          throw new Error(j?.error || "Failed to load committees");
        }

        setCommittees(j.items);
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
  }, [center?._id, areasLoading]); // areas won't change after first load

  // --- NEW: Agent groups related to this center ---
  const [agentGroups, setAgentGroups] = useState([]);
  const [agentGroupsLoading, setAgentGroupsLoading] = useState(false);
  const [agentGroupsErr, setAgentGroupsErr] = useState("");

  useEffect(() => {
    if (!center?._id) return;
    let alive = true;

    (async () => {
      try {
        setAgentGroupsLoading(true);
        setAgentGroupsErr("");
        setAgentGroups([]);

        // assumes your agent-groups list api supports centerId filter
        const res = await fetch(
          `/api/agent-groups?centerId=${center._id}&limit=500&sort=createdAt&dir=desc`,
          { cache: "no-store" },
        );
        const j = await res.json().catch(() => ({}));
        if (!alive) return;

        if (!res.ok) {
          throw new Error(j?.error || "Failed to load agent groups");
        }

        const items = Array.isArray(j.items)
          ? j.items
          : Array.isArray(j)
            ? j
            : [];
        setAgentGroups(items);
      } catch (e) {
        if (!alive) return;
        setAgentGroups([]);
        setAgentGroupsErr(e.message || "Failed to load agent groups");
      } finally {
        if (alive) setAgentGroupsLoading(false);
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

  // quick lookup map for area names (for committees that are area-scoped)
  const areaNameById = useMemo(() => {
    const map = new Map();
    for (const a of areas || []) {
      if (a?._id) map.set(String(a._id), a.name || "");
    }
    return map;
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
          {center?.cityId != null && (
            <h2 className="text-lg text-gray-700">
              City: {center.cityId.name}{" "}
              <a href={`/geo/${center?.wardId?._id}`} className="text-blue-600">
                {center?.wardId ? `· Ward: ${center.wardId.name}` : ""}
              </a>
            </h2>
          )}
          {center?.upazilaId != null && (
            <h2 className="text-sm text-gray-700">
              Upazila: {center.upazilaId.name}{" "}
              {center?.unionId ? `· Union: ${center.unionId.name}` : ""}
              {center?.wardId ? `· Ward: ${center.wardId.name}` : ""}
            </h2>
          )}
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
                    backgroundColor: "#60a5fa", // blue-400
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
                    backgroundColor: "#f472b6", // pink-400
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

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Center Agents</h2>
              {/* <a
                href={`/agent-groups/new?centerId=${center._id}`}
                className="text-sm text-blue-600 underline"
              >
                + New Agent Group
              </a> */}
            </div>

            {agentGroupsLoading && (
              <div className="rounded border bg-white p-3 text-sm text-gray-600">
                Loading agent groups…
              </div>
            )}

            {!agentGroupsLoading && agentGroupsErr && (
              <div className="rounded border bg-white p-3 text-sm text-red-600">
                {agentGroupsErr}
              </div>
            )}

            {!agentGroupsLoading &&
              !agentGroupsErr &&
              (agentGroups.length === 0 ? (
                <div className="rounded border bg-white p-3 text-sm text-gray-500">
                  No agent groups linked to this center.
                </div>
              ) : (
                <div className="rounded border bg-white overflow-x-auto">
                  <table className="min-w-[700px] w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Details</th>
                        <th className="text-left p-2">Center</th>
                        <th className="text-right p-2">Agents</th>
                        <th className="text-left p-2">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentGroups.map((g) => {
                        const updatedAt = g.updatedAt
                          ? new Date(g.updatedAt).toLocaleString()
                          : "—";

                        const centerObj =
                          g.center && typeof g.center === "object"
                            ? g.center
                            : null;

                        const peopleCount =
                          typeof g.peopleCount === "number"
                            ? g.peopleCount
                            : "—";

                        return (
                          <tr key={g._id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-medium">
                              <a
                                href={`/agent-groups/${g._id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {g.name || "Untitled"}
                              </a>
                            </td>
                            <td className="p-2">
                              {centerObj?.name ? (
                                <a
                                  href={`/centers/${centerObj._id}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {centerObj.name}
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="p-2 text-right">{peopleCount}</td>
                            <td className="p-2 text-xs text-gray-600">
                              {updatedAt}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
          </section>
          {/* NEW: Related Committees */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Related Committees</h2>

            {committeesLoading && (
              <div className="rounded border bg-white p-3 text-sm text-gray-600">
                Loading committees…
              </div>
            )}

            {!committeesLoading && committeesErr && (
              <div className="rounded border bg-white p-3 text-sm text-red-600">
                {committeesErr}
              </div>
            )}

            {!committeesLoading &&
              !committeesErr &&
              (committees.length === 0 ? (
                <div className="rounded border bg-white p-3 text-sm text-gray-500">
                  No committees linked to this center or its areas.
                </div>
              ) : (
                <div className="rounded border bg-white overflow-x-auto">
                  <table className="min-w-[700px] w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Scope</th>
                        <th className="text-left p-2">Area</th>
                        <th className="text-right p-2">People</th>
                        <th className="text-left p-2">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {committees.map((c) => {
                        const updatedAt = c.updatedAt
                          ? new Date(c.updatedAt).toLocaleString()
                          : "—";

                        const isCenterLevel = Array.isArray(c.centers)
                          ? c.centers.some(
                              (cid) =>
                                String(
                                  typeof cid === "object" ? cid._id : cid,
                                ) === String(center._id),
                            )
                          : false;

                        const areaId =
                          typeof c.areaId === "object"
                            ? c.areaId?._id
                            : c.areaId;
                        const areaName =
                          (typeof c.areaId === "object" && c.areaId?.name) ||
                          (areaId && areaNameById.get(String(areaId))) ||
                          "";

                        const scopeBadges = [];
                        if (isCenterLevel) scopeBadges.push("Center");
                        if (areaName) scopeBadges.push("Area");

                        const peopleCount =
                          typeof c.peopleCount === "number"
                            ? c.peopleCount
                            : "—";

                        return (
                          <tr key={c._id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-medium">
                              <a
                                href={`/committees/${c._id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {c.name || "Untitled"}
                              </a>
                            </td>
                            <td className="p-2">
                              <div className="flex flex-wrap gap-1">
                                {scopeBadges.length === 0 && (
                                  <span className="text-xs text-gray-500">
                                    —
                                  </span>
                                )}
                                {scopeBadges.map((label) => (
                                  <span
                                    key={label}
                                    className="text-xs px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-700"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-2">
                              {areaName || (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="p-2 text-right">{peopleCount}</td>
                            <td className="p-2 text-xs text-gray-600">
                              {updatedAt}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
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
