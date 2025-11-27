// app/(dash)/people/[personId]/edit/page.js
import { headers } from "next/headers";
import PersonEditForm from "@/components/PersonEditForm";

async function fetchPerson(id) {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const protocol = h.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  const res = await fetch(`${baseUrl}/api/people/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function PersonEditPage({ params }) {
  const personId = params.personId;
  const person = await fetchPerson(personId);
  console.log("person", person);
  if (!person) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        Person not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit Person</h1>
      </header>

      <PersonEditForm person={person} />
    </div>
  );
}
