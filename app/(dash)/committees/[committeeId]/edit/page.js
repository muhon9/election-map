import CommitteeForm from "@/components/CommitteeForm";
import { headers, cookies } from "next/headers";

async function fetchCommittee(id) {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const protocol = h.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  // Forward cookies in case your API requires auth
  const cookieHeader = cookies().toString();

  const res = await fetch(`${baseUrl}/api/committees/${id}`, {
    cache: "no-store",
    headers: { cookie: cookieHeader },
  });

  if (!res.ok) {
    // Optional: log status for debugging
    // console.error("Fetch committee failed", res.status, res.statusText);
    return null;
  }
  const data = await res.json();
  return data;
}

export default async function CommitteeEditPage({ params }) {
  const committee = await fetchCommittee(params.committeeId);
  console.log("commitee", committee);
  if (!committee) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        Committee not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit Committee</h1>
        <a href="/committees" className="text-blue-600 underline">
          Back to Committees
        </a>
      </header>
      <CommitteeForm committee={committee} />
    </div>
  );
}
