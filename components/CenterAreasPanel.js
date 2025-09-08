"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";

const TOP_N = 3;

export default function CenterAreasPanel({ center }) {
  const centerId = String(center?._id || "");
  const { data: session } = useSession();
  const user = session?.user;
  const canEdit = has(user, "edit_center");

  const [areas, setAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [error, setError] = useState("");

  // expanded area id in this panel
  const [openAreaId, setOpenAreaId] = useState(null);

  useEffect(() => {
    if (!centerId) return;
    setOpenAreaId(null); // reset on center change
    loadAreas(centerId);
  }, [centerId]);

  async function loadAreas(cid) {
    setLoadingAreas(true);
    setError("");
    try {
      // Pull first 200 to keep things simple. Adjust if you expect more.
      const res = await fetch(
        `/api/centers/${cid}/areas?page=1&limit=200&sort=createdAt&dir=desc`,
        { cache: "no-store" }
      );
      const j = await res.json();
      if (!Array.isArray(j.items)) {
        setError(j?.error || "Failed to load areas");
        setAreas([]);
        return;
      }
      setAreas(j.items);
    } catch (e) {
      console.error(e);
      setError("Failed to load areas");
    } finally {
      setLoadingAreas(false);
    }
  }

  return (
    <div className="rounded border overflow-hidden bg-white">
      <table className="min-w-[900px] w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2 w-[42px]"> </th>
            <th className="text-left p-2">Area</th>
            <th className="text-left p-2">Code</th>
            <th className="text-left p-2">Voters</th>
            <th className="text-left p-2 w-[240px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loadingAreas && (
            <tr>
              <td className="p-3 text-gray-500" colSpan={5}>
                Loading areas…
              </td>
            </tr>
          )}
          {!loadingAreas && error && (
            <tr>
              <td className="p-3 text-red-600" colSpan={5}>
                {error}
              </td>
            </tr>
          )}
          {!loadingAreas && !error && areas.length === 0 && (
            <tr>
              <td className="p-3 text-gray-500" colSpan={5}>
                No areas yet.
              </td>
            </tr>
          )}
          {!loadingAreas &&
            !error &&
            areas.map((a) => (
              <AreaRow
                key={a._id}
                area={a}
                isOpen={openAreaId === String(a._id)}
                onToggle={() =>
                  setOpenAreaId((id) =>
                    id === String(a._id) ? null : String(a._id)
                  )
                }
                canEdit={canEdit}
              />
            ))}
        </tbody>
      </table>
    </div>
  );
}

function AreaRow({ area, isOpen, onToggle, canEdit }) {
  const [loading, setLoading] = useState(false);
  const [committee, setCommittee] = useState({
    items: [],
    total: 0,
    loaded: false,
  });
  const [renowned, setRenowned] = useState({
    items: [],
    total: 0,
    loaded: false,
  });
  const [contacts, setContacts] = useState({
    items: [],
    total: 0,
    loaded: false,
  });
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (committee.loaded && renowned.loaded && contacts.loaded) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // Fetch top N for each category along with totals (your API returns {items,total,...})
        const [c, r, k] = await Promise.all([
          fetch(
            `/api/areas/${area._id}/people?category=COMMITTEE&limit=${TOP_N}&sort=order&dir=asc`,
            { cache: "no-store" }
          ).then((r) => r.json()),
          fetch(
            `/api/areas/${area._id}/people?category=RENOWNED&limit=${TOP_N}&sort=importance&dir=desc`,
            { cache: "no-store" }
          ).then((r) => r.json()),
          fetch(
            `/api/areas/${area._id}/people?category=CONTACT&limit=${TOP_N}&sort=name&dir=asc`,
            { cache: "no-store" }
          ).then((r) => r.json()),
        ]);
        setCommittee({
          items: c.items || [],
          total: c.total || 0,
          loaded: true,
        });
        setRenowned({
          items: r.items || [],
          total: r.total || 0,
          loaded: true,
        });
        setContacts({
          items: k.items || [],
          total: k.total || 0,
          loaded: true,
        });
      } catch (e) {
        console.error(e);
        setErr("Failed to load people for this area.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, area._id, committee.loaded, renowned.loaded, contacts.loaded]);

  return (
    <>
      <tr className="border-t hover:bg-gray-50">
        <td className="p-2">
          <button
            className="w-7 h-7 grid place-items-center border rounded hover:bg-gray-50"
            onClick={onToggle}
            title={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? "−" : "+"}
          </button>
        </td>
        <td className="p-2 font-medium">{area.name}</td>
        <td className="p-2">{area.code || "—"}</td>
        <td className="p-2">
          <span className="font-semibold">{area.totalVoters ?? 0}</span>
          <span className="text-gray-500 ml-2">M:</span> {area.maleVoters ?? 0}
          <span className="text-gray-500 ml-2">F:</span>{" "}
          {area.femaleVoters ?? 0}
        </td>
        <td className="p-2">
          <div className="flex items-center gap-2">
            <a
              className="px-2 py-1 border rounded hover:bg-gray-50"
              href={`/areas/${area._id}`}
            >
              Open
            </a>
            {canEdit && (
              <a
                className="px-2 py-1 border rounded hover:bg-gray-50"
                href={`/areas/${area._id}?tab=COMMITTEE`}
              >
                Add People
              </a>
            )}
          </div>
        </td>
      </tr>

      {isOpen && (
        <tr>
          <td colSpan={5} className="p-0">
            <div className="border-t bg-gray-50 p-4">
              {loading && (
                <div className="text-sm text-gray-600">Loading people…</div>
              )}
              {err && <div className="text-sm text-red-600">{err}</div>}

              {/* Committee */}
              <PeopleMiniSection
                title="Committee"
                areaId={area._id}
                data={committee}
                canEdit={canEdit}
                emptyHint="No committee members yet."
                viewAllHref={`/areas/${area._id}?tab=COMMITTEE`}
              >
                {committee.items.map((p) => (
                  <li
                    key={p._id}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="truncate">
                      <span className="font-medium">{p.name}</span>
                      {p.position && (
                        <span className="text-gray-600"> — {p.position}</span>
                      )}
                      {typeof p.order === "number" && (
                        <span className="text-gray-500"> (#{p.order})</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {p.phone ? (
                        <a
                          className="text-blue-600 underline"
                          href={`tel:${p.phone}`}
                        >
                          {p.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </li>
                ))}
              </PeopleMiniSection>

              {/* Important (RENOWNED) */}
              <PeopleMiniSection
                title="Important"
                areaId={area._id}
                data={renowned}
                canEdit={canEdit}
                emptyHint="No important people yet."
                viewAllHref={`/areas/${area._id}?tab=RENOWNED`}
              >
                {renowned.items.map((p) => (
                  <li
                    key={p._id}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="truncate">
                      <span className="font-medium">{p.name}</span>
                      {p.designation && (
                        <span className="text-gray-600">
                          {" "}
                          — {p.designation}
                        </span>
                      )}
                      {typeof p.importance === "number" && (
                        <span className="text-gray-500">
                          {" "}
                          (★ {p.importance})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {p.phone ? (
                        <a
                          className="text-blue-600 underline"
                          href={`tel:${p.phone}`}
                        >
                          {p.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </li>
                ))}
              </PeopleMiniSection>

              {/* Contacts */}
              <PeopleMiniSection
                title="Contacts"
                areaId={area._id}
                data={contacts}
                canEdit={canEdit}
                emptyHint="No contacts yet."
                viewAllHref={`/areas/${area._id}?tab=CONTACT`}
              >
                {contacts.items.map((p) => (
                  <li
                    key={p._id}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="truncate">
                      <span className="font-medium">{p.name}</span>
                      {p.designation && (
                        <span className="text-gray-600">
                          {" "}
                          — {p.designation}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {p.phone ? (
                        <a
                          className="text-blue-600 underline"
                          href={`tel:${p.phone}`}
                        >
                          {p.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400">no phone</span>
                      )}
                    </div>
                  </li>
                ))}
              </PeopleMiniSection>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PeopleMiniSection({
  title,
  areaId,
  data,
  canEdit,
  viewAllHref,
  emptyHint,
  children,
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="font-medium">
          {title}{" "}
          <span className="text-gray-500 font-normal">· {data.total || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <a className="text-blue-700 underline" href={viewAllHref}>
            View all
          </a>
          {canEdit && (
            <a
              className="px-2 py-1 border rounded hover:bg-gray-50"
              href={`${viewAllHref}`}
            >
              Add
            </a>
          )}
        </div>
      </div>
      <ul className="divide-y">
        {(data.items || []).length === 0 ? (
          <li className="py-2 text-gray-500">{emptyHint}</li>
        ) : (
          children
        )}
      </ul>
      {(data.items || []).length > 0 &&
        (data.total || 0) > (data.items || []).length && (
          <div className="mt-1">
            <a className="text-blue-700 underline text-sm" href={viewAllHref}>
              Show more…
            </a>
          </div>
        )}
    </div>
  );
}
