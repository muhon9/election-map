// app/dash/users/[id]/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { has } from "@/lib/perm";

export default function UserEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data } = useSession();
  const userSession = data?.user;
  const canManage = has(userSession, "manage_users");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [doc, setDoc] = useState(null); // loaded user
  const [roles, setRoles] = useState([]); // assignable roles (server filtered)

  // editable fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [password, setPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // derived
  const isSelf = useMemo(
    () => (doc?._id && userSession?.id ? doc._id === userSession.id : false),
    [doc, userSession]
  );
  const currentRoleLevel = useMemo(
    () => (typeof doc?.role?.level === "number" ? doc.role.level : 100),
    [doc]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!canManage) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErr("");

        // Load target user and assignable roles (both endpoints enforce hierarchy)
        const [uRes, rRes] = await Promise.all([
          fetch(`/api/users/${id}`, { cache: "no-store" }),
          fetch(`/api/roles`, { cache: "no-store" }),
        ]);

        const [uJson, rJson] = await Promise.all([
          uRes.json().catch(() => ({})),
          rRes.json().catch(() => ({})),
        ]);

        if (!alive) return;

        if (!uRes.ok) throw new Error(uJson?.error || "Failed to load user");
        if (!rRes.ok) throw new Error(rJson?.error || "Failed to load roles");

        setDoc(uJson);
        setUsername(uJson.username || "");
        setEmail(uJson.email || "");
        setPhone(uJson.phone || "");
        setRoleId(
          typeof uJson.role === "string"
            ? uJson.role
            : uJson.role?._id?.toString() || ""
        );

        // roles endpoint returns paginated or items? (we made it list `items` in one variant)
        const roleItems = Array.isArray(rJson.items)
          ? rJson.items
          : Array.isArray(rJson)
          ? rJson
          : [];
        setRoles(roleItems);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, canManage]);

  async function saveProfile(e) {
    e.preventDefault();
    if (!canManage) return;

    setSavingProfile(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Failed to save");
        return;
      }
      setDoc(j);
      alert("Profile updated.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveRole(e) {
    e.preventDefault();
    if (!canManage) return;
    if (isSelf) {
      alert("You cannot change your own role.");
      return;
    }
    setSavingRole(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Failed to update role");
        return;
      }
      setDoc(j);
      alert("Role updated.");
    } finally {
      setSavingRole(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (!canManage) return;
    if (password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Failed to set password");
        return;
      }
      setPassword("");
      alert("Temporary password set.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function onDelete() {
    if (!canManage) return;
    if (isSelf) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!confirm("Delete this user? This cannot be undone.")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Failed to delete user");
      return;
    }
    router.push("/users");
  }

  if (!canManage) {
    return (
      <div className="p-4 text-sm text-gray-600">
        You don’t have permission to manage users.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          className="px-3 py-1.5 border rounded hover:bg-gray-50"
          onClick={() => router.back()}
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50"
            onClick={onDelete}
            disabled={isSelf || loading}
            title={isSelf ? "You cannot delete your own account" : ""}
          >
            Delete
          </button>
        </div>
      </div>

      <h1 className="text-xl font-semibold">
        {doc ? `Edit User: ${doc.username}` : "Edit User"}
      </h1>

      {loading && (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Loading…
        </div>
      )}
      {!loading && err && (
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {!loading && !err && doc && (
        <div className="space-y-6">
          {/* Basic profile (username/email/phone) */}
          <form
            onSubmit={saveProfile}
            className="rounded border bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                className="border rounded w-full px-3 py-2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                className="border rounded w-full px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                className="border rounded w-full px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+8801XXXXXXXXX"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={savingProfile}
              >
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>

          {/* Change role */}
          <form
            onSubmit={saveRole}
            className="p-4 border rounded bg-white grid gap-2"
          >
            <h2 className="font-medium">Change Role</h2>
            <div className="text-xs text-gray-600 mb-1">
              Current:{" "}
              <span className="font-medium">{doc.role?.name || "-"}</span>{" "}
              <span className="text-gray-400">(level {currentRoleLevel})</span>
            </div>
            <select
              className="border px-3 py-2 rounded max-w-md"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={isSelf}
            >
              <option value="" disabled>
                Select role…
              </option>
              {roles.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name} (lvl {typeof r.level === "number" ? r.level : 100})
                </option>
              ))}
            </select>
            <button
              className={`px-3 py-2 rounded w-fit ${
                isSelf
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-blue-600 text-white"
              }`}
              disabled={isSelf || savingRole}
            >
              {isSelf
                ? "You can't change your own role"
                : savingRole
                ? "Saving…"
                : "Update Role"}
            </button>
          </form>

          {/* Set temporary password */}
          <form
            onSubmit={savePassword}
            className="p-4 border rounded bg-white grid gap-2 max-w-md"
          >
            <h2 className="font-medium">Set Temporary Password</h2>
            <input
              className="border px-3 py-2 rounded"
              placeholder="New temp password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-gray-500">
              User should change password after login.
            </p>
            <button
              className="bg-green-600 text-white px-3 py-2 rounded w-fit disabled:opacity-50"
              disabled={savingPassword}
            >
              {savingPassword ? "Saving…" : "Set Password"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
