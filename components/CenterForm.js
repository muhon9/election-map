"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CenterForm({ center }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    contactName: "",
    contactPhone: "",
    notes: "",
    // NEW fields
    totalVoters: "",
    maleVoters: "",
    femaleVoters: "",
  });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (center) {
      setForm({
        name: center.name || "",
        address: center.address || "",
        lat: center.lat ?? "",
        lng: center.lng ?? "",
        contactName: center.contact?.name || "",
        contactPhone: center.contact?.phone || "",
        notes: center.notes || "",
        totalVoters: center.totalVoters ?? "",
        maleVoters: center.maleVoters ?? "",
        femaleVoters: center.femaleVoters ?? "",
      });
    }
  }, [center]);

  function u(k, v) { setForm(s => ({ ...s, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setErr(""); setOk("");

    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      lat: Number(form.lat),
      lng: Number(form.lng),
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      notes: form.notes.trim(),
      totalVoters: Number(form.totalVoters || 0),
      maleVoters: Number(form.maleVoters || 0),
      femaleVoters: Number(form.femaleVoters || 0),
    };

    const url = center ? `/api/centers/${center._id}` : `/api/centers`;
    const method = center ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(()=> ({}));

    if (!res.ok) { setErr(data?.error || `Failed (${res.status})`); return; }

    setOk(center ? "Center updated" : "Center created");
    setTimeout(() => router.push("/centers"), 400);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-2 max-w-xl p-4 border rounded bg-white">
      <h2 className="text-lg font-medium">{center ? "Edit Center" : "Create Center"}</h2>

      <input className="border px-3 py-2 rounded" placeholder="Center Name"
             value={form.name} onChange={e=>u("name", e.target.value)} required />

      <input className="border px-3 py-2 rounded" placeholder="Address"
             value={form.address} onChange={e=>u("address", e.target.value)} />

      <div className="grid grid-cols-2 gap-2">
        <input className="border px-3 py-2 rounded" placeholder="Latitude"
               value={form.lat} onChange={e=>u("lat", e.target.value)} required />
        <input className="border px-3 py-2 rounded" placeholder="Longitude"
               value={form.lng} onChange={e=>u("lng", e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input className="border px-3 py-2 rounded" placeholder="Contact Person"
               value={form.contactName} onChange={e=>u("contactName", e.target.value)} />
        <input className="border px-3 py-2 rounded" placeholder="Contact Phone"
               value={form.contactPhone} onChange={e=>u("contactPhone", e.target.value)} />
      </div>

      {/* NEW voter fields */}
      <div className="grid grid-cols-3 gap-2">
        <input className="border px-3 py-2 rounded" placeholder="Total Voters"
               value={form.totalVoters} onChange={e=>u("totalVoters", e.target.value)} />
        <input className="border px-3 py-2 rounded" placeholder="Male Voters"
               value={form.maleVoters} onChange={e=>u("maleVoters", e.target.value)} />
        <input className="border px-3 py-2 rounded" placeholder="Female Voters"
               value={form.femaleVoters} onChange={e=>u("femaleVoters", e.target.value)} />
      </div>

      <textarea className="border px-3 py-2 rounded" placeholder="Additional notes"
                value={form.notes} onChange={e=>u("notes", e.target.value)} />

      {err && <p className="text-sm text-red-600">{err}</p>}
      {ok &&  <p className="text-sm text-green-700">{ok}</p>}

      <div className="flex gap-2">
        <button className="bg-green-600 text-white px-3 py-2 rounded">
          {center ? "Save changes" : "Create Center"}
        </button>
        <button type="button" onClick={() => window.history.back()} className="px-3 py-2 border rounded">
          Cancel
        </button>
      </div>
    </form>
  );
}
