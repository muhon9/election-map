import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import AgentGroup from "@/models/AgentGroup";
import Agent from "@/models/Agent";

// NOTE: Next.js route handlers: file upload needs "nodejs"
export const runtime = "nodejs";

import mongoose from "mongoose";
const { Types } = mongoose;

function oid(v) {
  if (!v) return null;
  const s = String(v);
  return Types.ObjectId.isValid(s) ? new Types.ObjectId(s) : null;
}

function cleanStr(v) {
  if (v === null || typeof v === "undefined") return "";
  return String(v).trim();
}

function cleanMobile(v) {
  const s = cleanStr(v);
  // keep + and digits
  return s.replace(/[^\d+]/g, "");
}

function escapeRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse CSV (simple, safe enough for your use-case)
 * - handles commas, quotes, new lines inside quotes
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => String(x || "").trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  if (row.some((x) => String(x || "").trim() !== "")) rows.push(row);

  return rows;
}

function normalizeHeader(h) {
  return cleanStr(h)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

function mapRowToAgent(rowObj) {
  // Accept multiple aliases
  const name = cleanStr(rowObj.name || rowObj.agentname || rowObj.fullname);
  const areaName = cleanStr(rowObj.area || rowObj.areaname || rowObj.arean);
  const mobile = cleanMobile(
    rowObj.mobile || rowObj.phone || rowObj.phonenumber,
  );
  const nid = cleanStr(rowObj.nid || rowObj.nidnumber || rowObj.nationalid);
  const orderRaw =
    rowObj.order || rowObj.serial || rowObj.sl || rowObj.slnumber || rowObj.no;

  const order = Number.isFinite(Number(orderRaw)) ? Number(orderRaw) : 0;

  // image url aliases
  const imageUrl =
    cleanStr(
      rowObj.imageurl || rowObj.photourl || rowObj.image || rowObj.photo,
    ) || "";

  return {
    name,
    areaName,
    mobile,
    nid,
    order,
    imageUrl,
  };
}

async function readUploadAsRows(file) {
  const filename = cleanStr(file?.name || "");
  const ext = filename.split(".").pop().toLowerCase();

  // CSV
  if (ext === "csv") {
    const buf = Buffer.from(await file.arrayBuffer());
    const text = buf.toString("utf8");
    const rows = parseCSV(text);
    if (!rows.length) return { headers: [], data: [] };

    const headers = rows[0].map((h) => normalizeHeader(h));
    const data = rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = r[i];
      });
      return obj;
    });
    return { headers, data };
  }

  // XLSX / XLS
  const xlsxMod = await import("xlsx");
  const xlsx = xlsxMod.default || xlsxMod; // ✅ important fix

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = xlsx.read(buf, { type: "buffer" });

  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return { headers: [], data: [] };

  const sheet = wb.Sheets[sheetName];
  const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });

  if (!aoa.length) return { headers: [], data: [] };

  const headers = (aoa[0] || []).map((h) => normalizeHeader(h));
  const data = aoa.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = r?.[i];
    });
    return obj;
  });

  return { headers, data };
}

/**
 * POST /api/agent-groups/:id/import-agents?dry=1
 */
export const POST = withPermApi(async (req, { params }) => {
  await dbConnect();

  const groupId = oid(params.id);
  if (!groupId) {
    return Response.json({ error: "Invalid agent group ID" }, { status: 400 });
  }

  const group = await AgentGroup.findById(groupId)
    .select("_id name center")
    .lean();
  if (!group) {
    return Response.json({ error: "Agent group not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dry") === "1";

  const form = await req.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  const { data } = await readUploadAsRows(file);

  // --- Validate + prepare ---
  const errors = [];
  const toInsert = [];
  let skipped = 0;

  for (let i = 0; i < data.length; i++) {
    const rowObj = data[i] || {};
    const mapped = mapRowToAgent(rowObj);

    const rowNo = i + 2; // header is row 1

    if (!mapped.name) {
      skipped++;
      errors.push(`Row ${rowNo}: missing name`);
      continue;
    }

    // Optional: detect duplicates inside file by (name+mobile+nid)
    toInsert.push({
      agentGroupId: groupId,
      name: mapped.name,
      areaName: mapped.areaName,
      mobile: mapped.mobile,
      nid: mapped.nid,
      order: mapped.order,
      // store image in your schema's image field (object). If your schema is string, change here.
      ...(mapped.imageUrl ? { image: { url: mapped.imageUrl } } : {}),
    });
  }

  // If dry-run: just return preview summary
  if (dryRun) {
    return Response.json({
      dryRun: true,
      totalRows: data.length,
      willInsert: toInsert.length,
      skipped,
      errors: errors.slice(0, 200),
      preview: toInsert.slice(0, 25).map((x) => ({
        name: x.name,
        areaName: x.areaName,
        mobile: x.mobile,
        nid: x.nid,
        order: x.order,
        imageUrl: x.image?.url || "",
      })),
    });
  }

  // --- Confirm import: insert ---
  let inserted = 0;

  if (toInsert.length) {
    // Avoid huge inserts
    const chunkSize = 500;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const res = await Agent.insertMany(chunk, { ordered: false }).catch(
        (e) => {
          // insertMany with ordered:false throws on duplicates/validation; still inserts others
          // We'll count inserted from e.result if present, else fallback 0 and collect error
          if (e?.writeErrors?.length) {
            errors.push(
              ...e.writeErrors
                .slice(0, 50)
                .map((we) => `Insert error: ${we.errmsg}`),
            );
          } else if (e?.message) {
            errors.push(`Insert error: ${e.message}`);
          }
          return null;
        },
      );

      if (Array.isArray(res)) inserted += res.length;
    }
  }

  return Response.json({
    dryRun: false,
    inserted,
    skipped,
    errors: errors.slice(0, 200),
    group: { _id: String(groupId), name: group.name },
  });
}, "edit_center");
