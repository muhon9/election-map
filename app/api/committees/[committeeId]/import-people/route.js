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
  let s = String(raw).trim();
  s = s.replace(/[\s-]+/g, "");
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
 */
export const POST = withPermApi(async (req, { params }) => {
  await dbConnect();

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

  // ✅ No error if no areaId – committee can be center-specific or higher-level.
  // We'll just always set committeeId, and optionally copy area/center if present.

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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-based header row

    try {
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
      const order = Number(rawOrder || 0);
      const phone = normalizePhone(rawMobile);

      if (!name) {
        skipped++;
        errors.push(`Row ${rowNum}: Missing name`);
        continue;
      }

      // Match within THIS committee.
      // Prefer committeeId + phone; if no phone, use committeeId + name.
      let query = { committeeId };
      if (phone) {
        query.phone = phone;
      } else {
        query.name = name;
      }

      const updateBase = {
        name,
        position,
        order: Number.isFinite(order) ? order : 0,
        category: "COMMITTEE",
        committeeId,
        committeeName: committee.name || "",
        updatedBy: userId,
      };

      // Optional: copy areaId / centers if they exist on Committee (for easier filtering later)
      if (committee.areaId) {
        updateBase.area = committee.areaId;
      }
      if (Array.isArray(committee.centers) && committee.centers.length > 0) {
        // you can choose to keep only first center or later expand to multi-center persons
        updateBase.center = committee.centers[0];
      }
      if (phone) {
        updateBase.phone = phone;
      }

      const existing = await Person.findOne(query);

      if (existing) {
        Object.assign(existing, updateBase);
        await existing.save();
        updated++;
      } else {
        const person = new Person({
          ...updateBase,
          createdBy: userId,
        });
        await person.save();
        inserted++;
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
      inserted,
      updated,
      skipped,
      errors,
    }),
    { status: 200 }
  );
}, "add_center");
