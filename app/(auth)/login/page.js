"use client";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    const res = await signIn("credentials", { username, password, redirect: false });
    console.log("res", res.error)
    if (res?.error) setErr("Invalid credentials");
    else router.push("/");
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-4">Sign in</h1>
        <input className="border w-full mb-3 px-3 py-2 rounded" placeholder="Username"
               value={username} onChange={e=>setUsername(e.target.value)} />
        <input className="border w-full mb-3 px-3 py-2 rounded" placeholder="Password" type="password"
               value={password} onChange={e=>setPassword(e.target.value)} />
        {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Sign in</button>
      </form>
    </div>
  );
}
