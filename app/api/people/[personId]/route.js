// app/api/people/[personId]/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import mongoose from "mongoose";
import Person from "@/models/Person";
import { populate } from "dotenv";

const { Types } = mongoose;

function oid(v) {
  return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
}
// GET /api/people/:personId
// Returns one person with populated committee/area/center
export const GET = withPermApi(async (_req, { params }) => {
  await dbConnect();

  const id = oid(params.personId);
  if (!id) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
    });
  }

  const doc = await Person.findById(id)
    .populate({
      path: "committeeId",
      select: "name centers areaId",
      populate: { path: "centers areaId", select: "name" },
    })
    .populate({ path: "area", select: "name code" })
    .populate({ path: "center", select: "name" })
    .lean();

  if (!doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }

  return Response.json(doc);
}, "*");

// PATCH /api/people/:personId
// Update basic fields (name, phone, position, etc.)
export const PATCH = withPermApi(
  async (req, { params }) => {
    await dbConnect();

    const id = oid(params.personId);
    if (!id) {
      return new Response(JSON.stringify({ error: "Invalid id" }), {
        status: 400,
      });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
      });
    }

    const person = await Person.findById(id);
    if (!person) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });
    }

    // Only update allowed fields
    if (body.name !== undefined) person.name = String(body.name).trim();
    if (body.phone !== undefined)
      person.phone = String(body.phone || "").trim();
    if (body.whatsapp !== undefined)
      person.whatsapp = String(body.whatsapp || "").trim();
    if (body.email !== undefined)
      person.email = String(body.email || "").trim();
    if (body.designation !== undefined)
      person.designation = String(body.designation || "").trim();
    if (body.position !== undefined)
      person.position = String(body.position || "").trim();
    if (body.notes !== undefined)
      person.notes = String(body.notes || "").trim();

    if (body.order !== undefined && body.order !== null && body.order !== "") {
      const n = Number(body.order);
      if (!Number.isNaN(n)) person.order = n;
    }

    if (
      body.importance !== undefined &&
      body.importance !== null &&
      body.importance !== ""
    ) {
      const n = Number(body.importance);
      if (!Number.isNaN(n)) person.importance = n;
    }

    if (body.isFavorite !== undefined) {
      person.isFavorite = !!body.isFavorite;
    }

    // Optionally allow reassigning committee / area / center if provided
    if (body.committeeId !== undefined) {
      person.committeeId = oid(body.committeeId) || null;
    }
    if (body.area !== undefined || body.areaId !== undefined) {
      const areaVal = body.areaId ?? body.area;
      person.area = oid(areaVal) || null;
    }
    if (body.center !== undefined || body.centerId !== undefined) {
      const centerVal = body.centerId ?? body.center;
      person.center = oid(centerVal) || null;
    }

    try {
      await person.save();
    } catch (e) {
      console.error(e);
      return new Response(
        JSON.stringify({ error: e.message || "Failed to save person" }),
        { status: 400 }
      );
    }

    const saved = await Person.findById(person._id)
      .populate({ path: "committeeId", select: "name" })
      .populate({ path: "area", select: "name code" })
      .populate({ path: "center", select: "name" })
      .lean();

    return Response.json(saved);
  },
  // adjust if you have a more specific permission like "edit_person"
  "add_center"
);

// DELETE /api/people/:personId
export const DELETE = withPermApi(async (_req, { params }) => {
  await dbConnect();

  const id = oid(params.personId);
  if (!id) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
    });
  }

  const person = await Person.findById(id);
  if (!person) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }

  await person.deleteOne();

  return Response.json({ ok: true });
}, "delete_center");
