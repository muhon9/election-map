// app/api/committee-types/[id]/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import mongoose from "mongoose";
import CommitteeType from "@/models/CommitteeType";
import Committee from "@/models/Committee";

const { Types } = mongoose;

function S(v) {
  return v == null ? "" : String(v).trim();
}
function KEY(v) {
  return S(v).toUpperCase().replace(/\s+/g, "_");
}

export const GET = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = params?.id;
  if (!Types.ObjectId.isValid(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
    });
  }

  const doc = await CommitteeType.findById(id).lean();
  if (!doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }
  return Response.json(doc);
}, "manage_roles");

export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = params?.id;
  if (!Types.ObjectId.isValid(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
    });
  }

  const body = await req.json().catch(() => ({}));

  const set = {};
  const unset = {};

  if ("name" in body) set.name = S(body.name);
  if ("description" in body) set.description = S(body.description);
  if ("color" in body) set.color = S(body.color);
  if ("sort" in body) {
    const n = Number(body.sort);
    set.sort = Number.isFinite(n) ? n : 0;
  }
  if ("active" in body) set.active = !!body.active;

  // Key rename is sensitive because Committees store typeKey string.
  // If you allow it, you should migrate committees too.
  if ("key" in body) {
    const nextKey = KEY(body.key);
    if (!nextKey) {
      return new Response(JSON.stringify({ error: "key cannot be empty" }), {
        status: 400,
      });
    }

    const current = await CommitteeType.findById(id).lean();
    if (!current) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });
    }

    if (nextKey !== current.key) {
      const dupe = await CommitteeType.findOne({ key: nextKey }).lean();
      if (dupe) {
        return new Response(JSON.stringify({ error: "key already exists" }), {
          status: 409,
        });
      }

      // ✅ migrate committees that use old key -> new key
      await Committee.updateMany(
        { typeKey: current.key },
        { $set: { typeKey: nextKey } },
      );

      set.key = nextKey;
    }
  }

  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;

  const doc = await CommitteeType.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).lean();

  if (!doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }

  return Response.json(doc);
}, "manage_roles");

export const DELETE = withPermApi(async (req, { params }) => {
  await dbConnect();

  const id = params?.id;
  if (!Types.ObjectId.isValid(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
    });
  }

  const doc = await CommitteeType.findById(id).lean();
  if (!doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  }

  // ✅ Prevent deleting if any committee is using this typeKey
  const usedCount = await Committee.countDocuments({ typeKey: doc.key });
  if (usedCount > 0) {
    return new Response(
      JSON.stringify({
        error: `Can't delete. ${usedCount} committees are using typeKey "${doc.key}". Disable it instead (active=false) or migrate first.`,
      }),
      { status: 409 },
    );
  }

  await CommitteeType.deleteOne({ _id: doc._id });
  return Response.json({ ok: true });
}, "manage_roles");
