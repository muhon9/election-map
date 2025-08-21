import dbConnect from "@/lib/db";
import Center from "@/models/Center";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CentersPage() {
  // When ACL is ON, require view permission
  const session = await getServerSession(authOptions);
  const aclOn = process.env.ENABLE_ACL === "1";
  if (aclOn && !session?.user?.permissions?.includes("view_centers")) redirect("/");

  await dbConnect();
  const centers = await Center.find({}).sort({ createdAt: -1 }).lean();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Centers</h1>
        <a className="px-3 py-2 rounded bg-blue-600 text-white" href="/centers/new">New Center</a>
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Address</th>
              <th className="text-left p-2">Total</th>
              <th className="text-left p-2">Male</th>
              <th className="text-left p-2">Female</th>
              <th className="text-left p-2">Lat</th>
              <th className="text-left p-2">Lng</th>
              <th className="text-left p-2">Contact</th>
              <th className="text-left p-2">Actions</th>

            </tr>
          </thead>
          <tbody>
            {centers.map(c => (
              <tr key={c._id} className="border-t">
                <td className="p-2">{c.name}</td>
                <td className="p-2">{c.address || "-"}</td>
                <td className="p-2">{c.totalVoters ?? 0}</td>
                <td className="p-2">{c.maleVoters ?? 0}</td>
                <td className="p-2">{c.femaleVoters ?? 0}</td>
                <td className="p-2">{c.lat}</td>
                <td className="p-2">{c.lng}</td>
                <td className="p-2">
                  {c.contact?.name || "-"}
                  {c.contact?.phone ? ` (${c.contact.phone})` : ""}
                </td>
                <td className="p-2">
                  <a className="text-blue-600 underline mr-2" href={`/centers/${c._id}`}>Edit</a>
                  <DeleteCenterButton id={c._id} />
                </td>
              </tr>
            ))}
            {!centers.length && (
              <tr><td className="p-4 text-gray-500" colSpan={6}>No centers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Small client component for delete
function DeleteCenterButton({ id }) {
  return (
    <form action={async () => {
      "use server";
      await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/centers/${id}`, { method: "DELETE" });
    }}>
      <button className="text-red-600 underline" type="submit">Delete</button>
    </form>
  );
}
