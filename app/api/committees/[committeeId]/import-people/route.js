// app/api/committees/[committeeId]/import-people/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Committee from "@/models/Committee";
import Person from "@/models/Person";
import mongoose from "mongoose";
import * as XLSX from "xlsx";

const { Types } = mongoose;

function oid(v) {
  return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
}

function normalizePhone(raw) {
  if (!raw) return "";

  // 1) To string & trim
  let s = String(raw).trim();

  // 2) Remove everything except digits
  //    (so "+88017-123 45678" -> "8801712345678")
  s = s.replace(/\D+/g, "");

  if (!s) return "";

  // 3) Handle common Bangladesh patterns
  //    Canonical form we want to store: 01XXXXXXXXX (11 digits)

  // 0088017XXXXXXXX -> strip leading 0088 -> 01XXXXXXXXX
  if (s.startsWith("008801") && s.length >= 14) {
    s = s.slice(4); // remove "0088"
  }

  // 88017XXXXXXXX -> strip leading 88 -> 01XXXXXXXXX
  if (s.startsWith("8801") && s.length >= 13) {
    s = s.slice(2); // remove "88"
  }

  // If missing leading 0 and looks like mobile (10 digits starting with 1)
  // 1712345678 -> 01712345678
  if (s.length === 10 && s[0] === "1") {
    s = "0" + s;
  }

  // Now if it's already 11 digits starting with 01, we accept as-is
  if (s.length === 11 && s.startsWith("01")) {
    return s;
  }

  // For any other weird format, just return cleaned digits
  // (optional: you can return "" instead to force only valid BD mobile)
  return s;
}

function getCell(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
      return obj[k];
    }
  }
  return "";
}

/**
 * POST /api/committees/:committeeId/import-people
 * Body: multipart/form-data with field "file"
 * Excel/CSV with columns: name, position, order, mobile
 *
 * Optional: ?dry=1 or ?dry=true for dry-run (no DB writes)
 */
export const POST = withPermApi(async (req, { params }) => {
  await dbConnect();

  const url = new URL(req.url);
  const dryParam = (url.searchParams.get("dry") || "").toLowerCase();
  const isDry = dryParam === "1" || dryParam === "true" || dryParam === "yes";

  const committeeId = oid(params.committeeId);
  if (!committeeId) {
    return new Response(JSON.stringify({ error: "Invalid committeeId" }), {
      status: 400,
    });
  }

  const committee = await Committee.findById(committeeId).lean();
  if (!committee) {
    return new Response(JSON.stringify({ error: "Committee not found" }), {
      status: 404,
    });
  }

  // ✅ This importer is for COMMITTEE category.
  // We will *not* keep area/center on Person; those will be resolved from the Committee.

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ? new Types.ObjectId(session.user.id) : null;

  // ---- Read formData & file ----
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return new Response(JSON.stringify({ error: "file is required" }), {
      status: 400,
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let rows = [];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return new Response(
        JSON.stringify({ error: "No sheet found in the uploaded file" }),
        { status: 400 }
      );
    }
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } catch (e) {
    console.error("XLSX parse error:", e);
    return new Response(
      JSON.stringify({ error: "Unable to parse Excel/CSV file" }),
      { status: 400 }
    );
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return new Response(
      JSON.stringify({ error: "No data rows found in the file" }),
      { status: 400 }
    );
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  const MAX_ROWS = 5000;
  if (rows.length > MAX_ROWS) {
    return new Response(
      JSON.stringify({
        error: `Too many rows (${rows.length}). Please split the file into smaller chunks (max ${MAX_ROWS} rows).`,
      }),
      { status: 400 }
    );
  }

  // ---- First pass: parse rows & detect if any non-zero order exists ----
  const parsedRows = [];
  let hasNonZeroOrder = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // header is row 1

    const rawName = getCell(row, ["name", "Name", "NAME"]);
    const rawPosition = getCell(row, ["position", "Position", "POSITION"]);
    const rawOrder = getCell(row, ["order", "Order", "ORDER"]);
    const rawMobile = getCell(row, [
      "mobile",
      "Mobile",
      "MOBILE",
      "phone",
      "Phone",
    ]);

    const name = String(rawName || "").trim();
    const position = String(rawPosition || "").trim();
    const phone = normalizePhone(rawMobile);
    const parsedOrder = Number(rawOrder || 0);
    const order = Number.isFinite(parsedOrder) ? parsedOrder : 0;

    if (!name) {
      skipped++;
      errors.push(`Row ${rowNum}: Missing name`);
      continue;
    }

    if (order > 0) {
      hasNonZeroOrder = true;
    }

    parsedRows.push({
      rowNum,
      name,
      position,
      phone,
      order, // raw numeric order (may be 0)
    });
  }

  // ---- Second pass: apply effective order and upsert persons ----
  for (let idx = 0; idx < parsedRows.length; idx++) {
    const { rowNum, name, position, phone, order } = parsedRows[idx];

    try {
      // 2️⃣ If *all* orders are 0/empty, assign serial numbers as order.
      const effectiveOrder = hasNonZeroOrder ? order : idx + 1;

      // 1️⃣ Only update if a person matched with phone number in that committee
      let existing = null;
      // if (phone) {
      //   existing = await Person.findOne({ committeeId, phone }).lean(
      //     isDry ? true : false
      //   );
      //   // note: .lean(true) ignored by mongoose; but .lean() only matters if not dry.
      //   // We'll just do .findOne normally above and conditionally use .lean() if you prefer.
      // }

      const updateBase = {
        name,
        position,
        order: effectiveOrder,
        category: "COMMITTEE",
        committeeId,
        updatedBy: userId,
      };

      if (phone) {
        updateBase.phone = phone;
      }

      if (existing) {
        // Would update
        updated++;

        if (!isDry) {
          const doc = await Person.findById(existing._id);
          if (doc) {
            Object.assign(doc, updateBase);
            // ❌ Ensure area/center are NOT kept for committee category
            doc.area = undefined;
            doc.center = undefined;
            await doc.save();
          }
        }
      } else {
        // Would insert
        inserted++;

        if (!isDry) {
          const person = new Person({
            ...updateBase,
            // area and center intentionally NOT set here
            createdBy: userId,
          });
          await person.save();
        }
      }
    } catch (e) {
      console.error(`Row ${rowNum} import error:`, e);
      skipped++;
      errors.push(
        `Row ${rowNum}: ${e.message || "Unknown error while importing row"}`
      );
    }
  }

  return new Response(
    JSON.stringify({
      dryRun: isDry,
      inserted,
      updated,
      skipped,
      errors,
    }),
    { status: 200 }
  );
}, "add_center");
