// app/api/centers/route.js
import dbConnect from "@/lib/db";
import Center from "@/models/Center";
import { withPermApi } from "@/lib/rbac";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

// List centers
export const GET = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  const filter = {};
  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { address: new RegExp(q, "i") },
      { notes: new RegExp(q, "i") },
      { "contact.name": new RegExp(q, "i") },
      { "contact.phone": new RegExp(q, "i") },
    ];
  }

  const centers = await Center.find(filter).sort({ createdAt: -1 }).lean();
  return Response.json(centers);
}, "view_centers");

// Create center
export const POST = withPermApi(async (req) => {
  await dbConnect();
  const body = await req.json();

  const totalVoters  = Number(body.totalVoters  ?? 0);
  const maleVoters   = Number(body.maleVoters   ?? 0);
  const femaleVoters = Number(body.femaleVoters ?? 0);

  if (!body?.name || typeof body.lat !== "number" || typeof body.lng !== "number") {
    return new Response(JSON.stringify({ error: "name, lat, lng are required" }), { status: 400 });
  }
  if ([totalVoters, maleVoters, femaleVoters].some(n => Number.isNaN(n) || n < 0)) {
    return new Response(JSON.stringify({ error: "voter counts must be non-negative numbers" }), { status: 400 });
  }

  const session = await getServerSession(authOptions);

  const center = await Center.create({
    name: body.name,
    address: body.address || "",
    lat: body.lat,
    lng: body.lng,
    contact: { name: body.contactName || "", phone: body.contactPhone || "" },
    notes: body.notes || "",
    totalVoters,
    maleVoters,
    femaleVoters,
    createdBy: session?.user?.id || null,
    updatedBy: session?.user?.id || null,
  });

  return Response.json(center);
}, "add_center");
