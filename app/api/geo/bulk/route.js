// app/api/geo/bulk/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import GeoUnit from "@/models/GeoUnit";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

// GET /api/geo/bulk?template=1 → returns Excel template
export const GET = withPermApi(async (req) => {
  const { searchParams } = new URL(req.url);
  if (!searchParams.get("template")) {
    return new Response(JSON.stringify({ error: "Nothing to do" }), {
      status: 400,
    });
  }

  const rows = [
    ["Type", "Name", "ParentType", "ParentName", "Code", "Sort", "Active"],
    // sample:
    ["city_corporation", "Sylhet City", "", "", "", "0", "1"],
    ["ward", "Ward-01", "city_corporation", "Sylhet City", "", "1", "1"],
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
      "Content-Disposition": 'attachment; filename="geo-bulk-template.xlsx"',
    },
  });
}, "manage_roles");

// POST /api/geo/bulk?dry=1
// multipart/form-data { file: <xlsx> }
// Columns: Type, Name, ParentType, ParentName, Code, Sort, Active
export const POST = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const dry = searchParams.get("dry") === "1";

  const form = await req.formData();
  const file = form.get("file");
  if (!file)
    return new Response(JSON.stringify({ error: "Missing file" }), {
      status: 400,
    });

  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array" });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName)
    return new Response(JSON.stringify({ error: "No sheet found" }), {
      status: 400,
    });
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  // helpers
  const S = (v) => (v == null ? "" : String(v).trim());
  const toBool = (v) => {
    const s = S(v).toLowerCase();
    if (["1", "true", "yes", "y"].includes(s)) return true;
    if (["0", "false", "no", "n"].includes(s)) return false;
    return true; // default
  };
  const toNum = (v, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  // cache: map (type||"__root__", nameLower) -> _id
  const indexKey = (type, name) =>
    `${(type || "__root__").toLowerCase()}::${S(name).toLowerCase()}`;
  const parentIndex = new Map();

  // Prime the cache with existing units to resolve parents quickly
  const existing = await GeoUnit.find({}, { _id: 1, type: 1, name: 1 }).lean();
  for (const g of existing) parentIndex.set(indexKey(g.type, g.name), g._id);

  const errors = [];
  const docs = [];
  console.log("req body", rows);

  // First pass: validate & build docs
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 2; // header is row 1

    const type = S(r.Type);
    const name = S(r.Name);
    const parentType = S(r.ParentType);
    const parentName = S(r.ParentName);
    const code = S(r.Code);
    const sort = toNum(r.Sort, 0);
    const active = toBool(r.Active);

    if (!type || !name) {
      errors.push({ row: rowNo, error: "Type and Name are required" });
      continue;
    }

    // Resolve parent if provided
    let parentId = null;
    if (parentType || parentName) {
      const pKey = indexKey(parentType, parentName);
      parentId = parentIndex.get(pKey) || null;
      if (!parentId) {
        errors.push({
          row: rowNo,
          error: `Parent not found: ${parentType} / ${parentName}`,
        });
        continue;
      }
    }

    const slug = GeoUnit.slugify(name);
    docs.push({ type, name, slug, code, parentId, sort, active, rowNo });
  }

  // If dry run, return just validation result
  if (dry) {
    return Response.json({
      ok: true,
      dryRun: true,
      totalRows: rows.length,
      valid: docs.length,
      invalid: errors.length,
      errors,
      sample: docs.slice(0, 5).map((d) => ({
        type: d.type,
        name: d.name,
        parentId: d.parentId,
        code: d.code,
        sort: d.sort,
        active: d.active,
      })),
    });
  }

  // Second pass: persist in order (parents should already exist)
  let inserted = 0;
  const insertErrors = [];

  for (const d of docs) {
    try {
      const parentDoc = d.parentId
        ? await GeoUnit.findById(d.parentId).lean()
        : null;
      const ancestors = parentDoc
        ? [...(parentDoc.ancestors || []), parentDoc._id]
        : [];
      console.log("parent doc", parentDoc);
      // duplicate check
      const dupe = await GeoUnit.findOne({
        type: d.type,
        parent: parentDoc?._id || null,
        slug: d.slug,
      }).lean();
      if (dupe) {
        insertErrors.push({
          row: d.rowNo,
          error: "Duplicate under same parent/type",
        });
        continue;
      }

      const created = await GeoUnit.create({
        type: d.type,
        name: d.name,
        slug: d.slug,
        code: d.code,
        parent: parentDoc?._id || null,
        ancestors,
        sort: d.sort,
        active: d.active,
        shape: null,
      });

      // add to index (in case subsequent rows use this as parent)
      parentIndex.set(indexKey(d.type, d.name), created._id);

      inserted += 1;
    } catch (e) {
      insertErrors.push({ row: d.rowNo, error: e.message || "Insert failed" });
    }
  }

  return Response.json({
    ok: true,
    dryRun: false,
    totalRows: rows.length,
    valid: docs.length,
    invalid: errors.length,
    errors, // parse/validation errors
    inserted,
    insertErrors, // DB insert errors
  });
}, "manage_roles");
