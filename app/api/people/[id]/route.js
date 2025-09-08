import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Person, { PERSON_CATEGORIES } from "@/models/Person";

export const PATCH = withPermApi(async (req, { params }) => {
  await dbConnect();
  const u = await req.json();

  // sanitize
  if ("category" in u) {
    u.category = String(u.category || "").toUpperCase();
    if (!PERSON_CATEGORIES.includes(u.category)) {
      return new Response(
        JSON.stringify({
          error: `category must be one of ${PERSON_CATEGORIES.join(", ")}`,
        }),
        { status: 400 }
      );
    }
  }

  for (const k of ["importance", "order"]) {
    if (k in u) {
      u[k] = Number(u[k]);
      if (Number.isNaN(u[k]) || u[k] < 0) {
        return new Response(
          JSON.stringify({ error: `${k} must be a non-negative number` }),
          { status: 400 }
        );
      }
    }
  }

  for (const k of [
    "name",
    "phone",
    "whatsapp",
    "email",
    "designation",
    "committeeName",
    "position",
    "notes",
  ]) {
    if (k in u) u[k] = String(u[k] || "").trim();
  }

  if ("tags" in u) {
    u.tags = Array.isArray(u.tags) ? u.tags.map(String) : [];
  }

  const doc = await Person.findByIdAndUpdate(params.id, u, {
    new: true,
  }).lean();
  if (!doc)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  return Response.json(doc);
}, "edit_center");

export const DELETE = withPermApi(async (_req, { params }) => {
  await dbConnect();
  const r = await Person.findByIdAndDelete(params.id);
  if (!r)
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  return Response.json({ ok: true });
}, "delete_center");
