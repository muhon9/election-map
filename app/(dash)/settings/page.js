// app/(dash)/settings/page.js
"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";

export default function SettingsPage() {
  const { data, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [profile, setProfile] = useState(null); // { id, username, email, phone, role? }
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (status === "loading") return;
      if (status !== "authenticated") {
        setLoading(false);
        setErr("You must be signed in to view settings.");
        return;
      }
      try {
        setLoading(true);
        setErr("");
        const res = await fetch("/api/me", { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) throw new Error(j?.error || "Failed to load profile");
        setProfile(j);
        setEmail(j.email || "");
        setPhone(j.phone || "");
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
  }, [status]);

  async function saveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), phone: phone.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Failed to save");
        return;
      }
      setProfile((p) => ({ ...p, email: j.email, phone: j.phone }));
      alert("Profile updated.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) {
      alert("New password must be at least 8 characters.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Failed to change password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      alert("Password changed. Please sign in again.");
      // Signing out is recommended after password change
      await signOut({ callbackUrl: "/login" });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

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

      {!loading && !err && profile && (
        <div className="space-y-6">
          {/* Basic info (read-only username / role) */}
          <div className="rounded border bg-white p-4 grid gap-2 text-sm text-gray-700">
            <div>
              <span className="font-medium">Username:</span> {profile.username}
            </div>
            {profile.role?.name && (
              <div>
                <span className="font-medium">Role:</span> {profile.role.name}{" "}
                <span className="text-gray-400">
                  (level {profile.role.level})
                </span>
              </div>
            )}
          </div>

          {/* Update email/phone */}
          <form
            onSubmit={saveProfile}
            className="rounded border bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="border rounded w-full px-3 py-2"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                className="border rounded w-full px-3 py-2"
                placeholder="+8801XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={savingProfile}
              >
                {savingProfile ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>

          {/* Change password */}
          <form
            onSubmit={changePassword}
            className="rounded border bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl"
          >
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Current password
              </label>
              <input
                type="password"
                className="border rounded w-full px-3 py-2"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                New password
              </label>
              <input
                type="password"
                className="border rounded w-full px-3 py-2"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="md:col-span-2">
              <button
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                disabled={savingPassword}
              >
                {savingPassword ? "Saving…" : "Change password"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
