// app/api/mosqs/bulk/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import Mosq from "@/models/Mosq";
import GeoUnit from "@/models/GeoUnit";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

// Helpers
const S = (v) => (v == null ? "" : String(v).trim());
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rxEq = (s) => new RegExp(`^${esc(s.trim())}$`, "i");

/**
 * Find a GeoUnit by type + name (case-insensitive).
 * Optionally constrain by parent (direct) or allow ancestors check if you store it.
 */
async function findUnitByName({ type, name, parentId = null }) {
  if (!name) return null;

  // Try exact case-insensitive match by name (and parent if provided)
  const q = { type, name: rxEq(name) };
  if (parentId) q.parent = parentId;

  let doc = await GeoUnit.findOne(q).lean();
  if (doc) return doc;

  // If not found and parent given, relax: try without parent (if input might be ambiguous)
  if (parentId) {
    doc = await GeoUnit.findOne({ type, name: rxEq(name) }).lean();
    if (doc) return doc;
  }

  // Last resort: starts-with / loose (avoid unless necessary)
  doc = await GeoUnit.findOne({
    type,
    name: new RegExp(esc(name), "i"),
  }).lean();
  return doc || null;
}

/**
 * Resolve chain based on provided names:
 * - City mode: City, Ward (optional)
 * - Upazilla mode: Upazilla (required for this mode), Union (optional), Ward (optional)
 *
 * Returns { cityId, upazillaId, unionId, wardId } (all ObjectIds or null),
 * and an array of human-friendly error messages (if any).
 */
async function resolveGeoFromRow({
  cityName,
  upazillaName,
  unionName,
  wardName,
}) {
  const out = { cityId: null, upazillaId: null, unionId: null, wardId: null };
  const errors = [];

  const hasCityPath = !!S(cityName);
  const hasUpaPath = !!S(upazillaName);

  if (!hasCityPath && !hasUpaPath) {
    // Allow completely unassigned geo (can be changed if you want stricter)
    return { out, errors };
  }

  if (hasCityPath && hasUpaPath) {
    errors.push("Provide either City or Upazilla (not both).");
    return { out, errors };
  }

  // City mode
  if (hasCityPath) {
    const city = await findUnitByName({
      type: "city_corporation",
      name: cityName,
    });
    if (!city) {
      errors.push(`City not found: "${cityName}"`);
      return { out, errors };
    }
    out.cityId = city._id;

    if (S(wardName)) {
      // Prefer ward directly under this city
      let ward = await findUnitByName({
        type: "ward",
        name: wardName,
        parentId: city._id,
      });
      if (!ward) {
        // attempt loose match
        ward = await findUnitByName({ type: "ward", name: wardName });
        if (!ward)
          errors.push(
            `Ward not found under city "${city.name}": "${wardName}"`
          );
      }
      if (ward) out.wardId = ward._id;
    }
    return { out, errors };
  }

  // Upazilla mode
  if (hasUpaPath) {
    const upa = await findUnitByName({ type: "upazilla", name: upazillaName });
    if (!upa) {
      errors.push(`Upazilla not found: "${upazillaName}"`);
      return { out, errors };
    }
    out.upazillaId = upa._id;

    let union = null;
    if (S(unionName)) {
      union = await findUnitByName({
        type: "union",
        name: unionName,
        parentId: upa._id,
      });
      if (!union) {
        // relax
        union = await findUnitByName({ type: "union", name: unionName });
        if (!union)
          errors.push(
            `Union not found under upazilla "${upa.name}": "${unionName}"`
          );
      }
      if (union) out.unionId = union._id;
    }

    if (S(wardName)) {
      // First try ward under union (if provided)
      let ward = null;
      if (union) {
        ward = await findUnitByName({
          type: "ward",
          name: wardName,
          parentId: union._id,
        });
      }
      // Else try ward directly under upazilla (if your data allows it)
      if (!ward) {
        ward = await findUnitByName({
          type: "ward",
          name: wardName,
          parentId: upa._id,
        });
      }
      // else fallback loose
      if (!ward) {
        ward = await findUnitByName({ type: "ward", name: wardName });
        if (!ward) {
          errors.push(
            `Ward not found under ${
              union ? `union "${union.name}"` : `upazilla "${upa.name}"`
            }: "${wardName}"`
          );
        }
      }
      if (ward) out.wardId = ward._id;
    }

    return { out, errors };
  }

  return { out, errors };
}

// ========== GET: Download template ==========
export const GET = withPermApi(async (req) => {
  const { searchParams } = new URL(req.url);
  const template = searchParams.get("template");

  if (!template) {
    return new Response(JSON.stringify({ error: "Nothing to do" }), {
      status: 400,
    });
  }

  // Template with both city and upazilla paths supported.
  // Only fill ONE path per row (either City or Upazilla+Union).
  const rows = [
    [
      "City",
      "Upazilla",
      "Union",
      "Ward",
      "Mosqname",
      "Address",
      "Contact",
      "Lat",
      "Lng",
    ],
    ["", "", "", "", "", "", "", "", ""],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Template");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mosq-upload-template.xlsx"`,
    },
  });
}, "manage_roles");

// ========== POST: Upload sheet ==========
export const POST = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const isDryRun = searchParams.get("dry") === "1";

  const form = await req.formData();
  const file = form.get("file");
  if (!file) {
    return new Response(JSON.stringify({ error: "Missing file" }), {
      status: 400,
    });
  }

  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array" });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) {
    return new Response(JSON.stringify({ error: "No sheet found" }), {
      status: 400,
    });
  }
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }); // [{ header:value }...]

  // case-insensitive getter
  function getByKeys(obj, keys) {
    const map = {};
    for (const k of Object.keys(obj)) map[k.toLowerCase()] = obj[k];
    for (const want of keys) {
      const v = map[want.toLowerCase()];
      if (v != null) return v;
    }
    return "";
  }

  const parseRow = (r) => {
    const cityName = S(getByKeys(r, ["City"]));
    const upazillaName = S(getByKeys(r, ["Upazilla"]));
    const unionName = S(getByKeys(r, ["Union"]));
    const wardName = S(getByKeys(r, ["Ward"]));
    const mosqname = S(getByKeys(r, ["Mosqname", "Mosq name", "Name"]));
    const address = S(getByKeys(r, ["Address"]));
    const contact = S(getByKeys(r, ["Contact", "Phone", "Mobile"]));
    const latStr = S(getByKeys(r, ["Lat", "Latitude"]));
    const lngStr = S(getByKeys(r, ["Lng", "Longitude", "Long"]));

    const lat = latStr ? Number.parseFloat(latStr) : 0;
    const lng = lngStr ? Number.parseFloat(lngStr) : 0;

    return {
      cityName,
      upazillaName,
      unionName,
      wardName,
      mosqname,
      address,
      contact,
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
    };
  };

  const errors = [];
  const docs = [];

  // Resolve each row into a Mosq payload
  for (let i = 0; i < rows.length; i++) {
    const idx = i + 2; // headers on row 1
    const row = parseRow(rows[i]);

    // Basic validation
    if (!row.mosqname) {
      errors.push({ row: idx, error: "Mosqname is required" });
      continue;
    }

    // Resolve geo
    const { out: geo, errors: geoErrs } = await resolveGeoFromRow({
      cityName: row.cityName,
      upazillaName: row.upazillaName,
      unionName: row.unionName,
      wardName: row.wardName,
    });
    if (geoErrs.length) {
      errors.push({ row: idx, error: geoErrs.join("; ") });
      continue;
    }

    // Build document
    const doc = {
      name: row.mosqname,
      address: row.address,
      contact: row.contact,
      cityId: geo.cityId,
      upazillaId: geo.upazillaId,
      unionId: geo.unionId,
      wardId: geo.wardId,
      location: { lat: row.lat || 0, lng: row.lng || 0 },
    };
    docs.push(doc);
  }

  if (isDryRun) {
    return Response.json({
      ok: true,
      dryRun: true,
      totalRows: rows.length,
      valid: docs.length,
      invalid: errors.length,
      errors,
      sample: docs.slice(0, 5),
    });
  }

  // Insert valid docs (continue on error)
  let inserted = 0;
  let insertErrs = [];
  if (docs.length) {
    try {
      const res = await Mosq.insertMany(docs, { ordered: false });
      inserted = res.length;
    } catch (e) {
      if (Array.isArray(e?.writeErrors)) {
        insertErrs = e.writeErrors.map((we) => ({
          index: we.index,
          code: we.code,
          errmsg: we.errmsg,
        }));
      } else {
        insertErrs = [
          { code: e.code || "", errmsg: e.message || "Insert failed" },
        ];
      }
    }
  }

  return Response.json({
    ok: true,
    dryRun: false,
    totalRows: rows.length,
    valid: docs.length,
    invalid: errors.length,
    errors, // parsing/resolve issues
    inserted,
    insertErrors: insertErrs, // DB-level issues
  });
}, "view_centers");
