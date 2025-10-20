// app/api/backup/route.js
import dbConnect from "@/lib/db";
import { withPermApi } from "@/lib/rbac";
import mongoose from "mongoose";
import { EJSON } from "bson";
import zlib from "zlib";

export const runtime = "nodejs";

/**
 * Utility: return a list of user-facing collections (skip system/internal)
 */
async function listUserCollections() {
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  // Filter out system and internal
  const skipPrefixes = ["system.", "_"];
  return cols
    .map((c) => c.name)
    .filter(
      (name) =>
        !skipPrefixes.some((p) => name.startsWith(p)) &&
        name !== "sessions" &&
        name !== "migrations"
    )
    .sort();
}

/**
 * Utility: dump all docs from provided collections into an object:
 * { meta, collections: { [name]: [EJSON docs] } }
 */
async function dumpCollections(collectionNames) {
  const db = mongoose.connection.db;

  const out = {
    meta: {
      type: "mongo-backup",
      version: 1,
      dbName: db.databaseName,
      createdAt: new Date().toISOString(),
    },
    collections: {},
  };

  for (const name of collectionNames) {
    const col = db.collection(name);
    const docs = await col.find({}).toArray();
    // Use EJSON to preserve ObjectId/Date, etc.
    out.collections[name] = docs;
  }

  return out;
}

/**
 * Utility: restore collections from parsed EJSON.
 * mode: "merge" (default) -> upsert by _id
 *       "wipe" -> delete all docs in that collection first, then insertMany
 * dryRun: validate only (no writes)
 * only: array of collection names to include; if empty -> all in file
 */
async function restoreCollections(
  parsed,
  { mode = "merge", dryRun = false, only = [] }
) {
  if (!parsed || parsed.meta?.type !== "mongo-backup") {
    throw new Error("Invalid backup file: missing or wrong meta.type");
  }
  const data = parsed.collections || {};
  const names = only.length ? only : Object.keys(data);

  const db = mongoose.connection.db;

  const results = [];
  for (const name of names) {
    const docs = data[name];
    if (!Array.isArray(docs)) continue;

    const col = db.collection(name);
    const r = {
      collection: name,
      count: docs.length,
      inserted: 0,
      upserted: 0,
      mode,
      dryRun,
    };

    if (dryRun) {
      results.push(r);
      continue;
    }

    if (mode === "wipe") {
      await col.deleteMany({});
      if (docs.length) {
        // Keep original _id; ignore duplicate errors by using ordered:false
        try {
          const ins = await col.insertMany(docs, { ordered: false });
          r.inserted =
            ins.insertedCount ??
            (ins.insertedIds ? Object.keys(ins.insertedIds).length : 0);
        } catch (e) {
          // Some may fail on unique indexes; continue
          r.error = e.message || "Insert failed";
        }
      }
    } else {
      // merge: upsert one by one on _id
      for (const d of docs) {
        try {
          const _id = d._id;
          const { matchedCount, upsertedCount } = await col.updateOne(
            { _id },
            { $set: d },
            { upsert: true }
          );
          if (upsertedCount) r.upserted += upsertedCount;
          if (!matchedCount && !upsertedCount) {
            // Some drivers don't return counts consistently; ignore
          }
        } catch (e) {
          r.error = (r.error || 0) + 1; // count errors
        }
      }
    }

    results.push(r);
  }

  return results;
}

/**
 * GET /api/backup
 * Query:
 *   ?gzip=1          -> return gzip (application/gzip)
 *   ?collections=a,b -> limit to these comma-separated names (optional)
 */
export const GET = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const gzip = searchParams.get("gzip") === "1";
  const only = (searchParams.get("collections") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const all = await listUserCollections();
  const pick = only.length ? all.filter((n) => only.includes(n)) : all;

  const dump = await dumpCollections(pick);
  // EJSON stringify to preserve types
  const json = EJSON.stringify(dump, { relaxed: false, indent: 0 });

  if (gzip) {
    const gz = zlib.gzipSync(Buffer.from(json, "utf8"));
    return new Response(gz, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${
          dump.meta.dbName
        }-backup-${Date.now()}.json.gz"`,
      },
    });
  }

  return new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${
        dump.meta.dbName
      }-backup-${Date.now()}.json"`,
    },
  });
}, "manage_roles");

/**
 * POST /api/backup
 * Accepts:
 *   - multipart/form-data with a "file" (json or gz)
 *   - OR raw application/json body (already EJSON)
 * Query:
 *   ?mode=wipe|merge (default merge)
 *   ?dry=1           (validate only)
 *   ?collections=a,b (restore only those from file)
 */
export const POST = withPermApi(async (req) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") === "wipe" ? "wipe" : "merge";
  const dryRun = searchParams.get("dry") === "1";
  const only = (searchParams.get("collections") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let parsed;

  // If content-type is multipart -> read file field
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!file) {
      return new Response(JSON.stringify({ error: "Missing file" }), {
        status: 400,
      });
    }
    const ab = await file.arrayBuffer();
    let buf = Buffer.from(ab);

    // Try to detect gzip by magic number 1F 8B
    const isGz = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
    if (isGz) {
      buf = zlib.gunzipSync(buf);
    }

    const txt = buf.toString("utf8");
    parsed = EJSON.parse(txt, { relaxed: false });
  } else {
    // Assume raw JSON body
    const txt = await req.text();
    parsed = EJSON.parse(txt || "{}", { relaxed: false });
  }

  try {
    const results = await restoreCollections(parsed, { mode, dryRun, only });
    return Response.json({
      ok: true,
      mode,
      dryRun,
      restored: results,
      fileMeta: parsed?.meta || null,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message || "Restore failed" }),
      {
        status: 400,
      }
    );
  }
}, "manage_roles");
