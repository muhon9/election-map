"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateUserForm({ roles }) {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "", roleId: "", email: "", phone: "" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  function u(k, v) { setForm(s => ({ ...s, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setErr(""); setOk("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data?.error || `Failed (${res.status})`); return; }

    setOk("User created");
    setForm({ username: "", password: "", roleId: "", email: "", phone: "" });
    router.refresh(); // <-- re-fetch server data in the parent page
  }

  return (
    <form onSubmit={submit} className="grid gap-2 max-w-lg p-3 border rounded bg-white">
      <h2 className="font-medium">Create User</h2>
      <input className="border px-3 py-2 rounded" placeholder="Username"
             value={form.username} onChange={e=>u("username", e.target.value)} required />
      <input className="border px-3 py-2 rounded" type="password" placeholder="Temp Password (min 8)"
             value={form.password} onChange={e=>u("password", e.target.value)} required />
      <select className="border px-3 py-2 rounded" value={form.roleId}
              onChange={e=>u("roleId", e.target.value)} required>
        <option value="">Select role</option>
        {roles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
      </select>
      <input className="border px-3 py-2 rounded" placeholder="Email (optional)"
             value={form.email} onChange={e=>u("email", e.target.value)} />
      <input className="border px-3 py-2 rounded" placeholder="Phone (optional)"
             value={form.phone} onChange={e=>u("phone", e.target.value)} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      {ok &&  <p className="text-sm text-green-700">{ok}</p>}
      <button className="bg-green-600 text-white px-3 py-2 rounded w-fit">Create</button>
    </form>
  );
}
