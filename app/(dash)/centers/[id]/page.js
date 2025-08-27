// app/(dash)/centers/[id]/page.js
import dbConnect from "@/lib/db";
import Center from "@/models/Center";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function pct(n, total) {
  if (!total) return 0;
  const v = Math.round((Number(n || 0) / Number(total)) * 100);
  return Number.isFinite(v) ? v : 0;
}

export default async function CenterInfoPage({ params }) {
  await dbConnect();
  const center = await Center.findById(params.id).lean();

  const session = await getServerSession(authOptions);
  const perms = session?.user?.permissions || session?.permissions || [];
  const canEdit = perms.includes?.("edit_center");

  if (!center) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold">Center not found</h1>
        <p className="text-sm text-gray-600 mt-2">
          The requested center does not exist or you don’t have access.
        </p>
        <div className="mt-4">
          <Link href="/centers" className="text-blue-600 underline">
            Back to centers
          </Link>
        </div>
      </div>
    );
  }

  const total = center.totalVoters ?? 0;
  const male = center.maleVoters ?? 0;
  const female = center.femaleVoters ?? 0;
  const malePct = pct(male, total);
  const femalePct = pct(female, total);
  const areas = Array.isArray(center.areas) ? center.areas : [];
  const totalPeople = areas.reduce((s, a) => s + (a.people?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{center.name}</h1>
          <div className="text-sm text-gray-600 mt-1">
            {center.address || "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Lat: {center.lat} • Lng: {center.lng} •{" "}
            <a
              href={`https://www.google.com/maps?q=${center.lat},${center.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              Open in Google Maps
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/centers"
            className="px-3 py-2 border rounded hover:bg-gray-50"
          >
            Back
          </Link>
          {canEdit && (
            <Link
              href={`/centers/${center._id}/edit`}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Demographics */}
      <section className="rounded border bg-white p-4 space-y-4">
        <h2 className="text-lg font-semibold">Demographics</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Stat label="Total voters" value={total} emphasis />
          <Stat label="Male voters" value={male} sub />
          <Stat label="Female voters" value={female} sub />
          <Stat
            label="Areas / People"
            value={`${areas.length} / ${totalPeople}`}
          />
        </div>

        {/* Percent bars */}
        <div className="space-y-2">
          <Bar label={`Male ${malePct}%`} pct={malePct} />
          <Bar label={`Female ${femalePct}%`} pct={femalePct} />
        </div>

        {/* Notes + Contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">Contact</div>
            <div className="rounded border p-3">
              <div className="text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>{" "}
                  {center.contact?.name || "—"}
                </div>
                <div>
                  <span className="text-gray-600">Phone:</span>{" "}
                  {center.contact?.phone ? (
                    <a
                      className="text-blue-600 underline"
                      href={`tel:${center.contact.phone}`}
                    >
                      {center.contact.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Notes</div>
            <div className="rounded border p-3 text-sm text-gray-800 bg-white min-h-[56px]">
              {center.notes || "—"}
            </div>
          </div>
        </div>
      </section>

      {/* Areas & Highlights */}
      <section className="rounded border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Areas</h2>
          <div className="text-sm text-gray-600">
            {areas.length} area{areas.length !== 1 ? "s" : ""} • {totalPeople}{" "}
            people
          </div>
        </div>

        {/* Areas list (compact cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {areas.length === 0 && (
            <div className="text-sm text-gray-500">No areas added yet.</div>
          )}
          {areas.map((a) => {
            const count = a.people?.length || 0;
            return (
              <div key={a._id} className="border rounded p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {a.name}
                      {a.code ? ` (${a.code})` : ""}
                    </div>
                    <div className="text-xs text-gray-500">
                      {count} person{count !== 1 ? "s" : ""} • Total:{" "}
                      {a.totalVoters ?? 0}, M: {a.maleVoters ?? 0}, F:{" "}
                      {a.femaleVoters ?? 0}
                    </div>
                  </div>
                </div>

                {/* A few people preview */}
                {!!count && (
                  <div className="mt-2 text-sm">
                    <ul className="space-y-1">
                      {a.people.slice(0, 3).map((p) => (
                        <li
                          key={p._id}
                          className="flex items-center justify-between"
                        >
                          <span className="truncate">
                            <span className="font-medium">{p.name}</span>
                            {p.designation ? (
                              <span className="text-gray-500">
                                {" "}
                                — {p.designation}
                              </span>
                            ) : null}
                          </span>
                          {p.phone ? (
                            <a
                              className="text-blue-600 underline ml-3"
                              href={`tel:${p.phone}`}
                            >
                              Call
                            </a>
                          ) : null}
                        </li>
                      ))}
                      {count > 3 && (
                        <li className="text-xs text-gray-500">
                          +{count - 3} more…
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, emphasis, sub }) {
  return (
    <div
      className={`rounded border p-3 ${
        emphasis ? "bg-green-50 border-green-200" : "bg-white"
      }`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={`mt-1 ${
          emphasis
            ? "text-2xl font-bold text-green-700"
            : sub
            ? "text-lg font-semibold"
            : "text-base"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Bar({ label, pct }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded">
        <div
          className="h-2 bg-blue-600 rounded"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}
