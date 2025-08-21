import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Point from "@/models/Point";

export async function GET() {
  await dbConnect();
  const points = await Point.find().lean();
  return NextResponse.json(points);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.permissions?.includes("add_point")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await dbConnect();
  const body = await req.json();
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "Invalid coords" }, { status: 400 });
  }
  const p = await Point.create({
    name: body.name || "Untitled",
    description: body.description || "",
    lat: body.lat, lng: body.lng,
    createdBy: session.user.id
  });
  return NextResponse.json(p);
}
