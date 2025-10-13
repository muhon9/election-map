// lib/audit.js
import AuditLog from "@/models/AuditLog";

/** Mask sensitive string values */
function mask(val) {
  if (val == null) return val;
  if (typeof val !== "string") return "***";
  if (val.length <= 4) return "***";
  return val.slice(0, 2) + "***" + val.slice(-2);
}

const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordHash",
  "passwordChangedAt",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
]);

function redactedPick(obj = {}, keys = []) {
  const out = {};
  for (const k of keys) {
    const v = obj?.[k];
    out[k] = SENSITIVE_FIELDS.has(k) ? mask(String(v ?? "")) : v;
  }
  return out;
}

function computeDiff(before = {}, after = {}) {
  const keys = Array.from(
    new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  );
  const changed = [];
  for (const k of keys) {
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(k);
  }
  return {
    fields: changed,
    before: redactedPick(before, changed),
    after: redactedPick(after, changed),
  };
}

/**
 * Write an audit log.
 * @param {Request} req - Next.js Request (for headers)
 * @param {object} session - next-auth session
 * @param {object} payload - { action, entityType, entityId, summary, before?, after? }
 */
export async function logAudit(req, session, payload) {
  try {
    if (!payload?.action || !payload?.entityType) return;

    const headers = req?.headers || new Headers();
    const ip = headers.get("x-forwarded-for") || headers.get("x-real-ip") || "";
    const userAgent = headers.get("user-agent") || "";

    const actorId = session?.user?.id || null;
    const actorUsername = session?.user?.username || "";
    const actorRoleName = session?.user?.roleName || "";

    const doc = {
      actorId,
      actorUsername,
      actorRoleName,
      action: payload.action,
      entityType: payload.entityType,
      entityId: String(payload.entityId || ""),
      summary: payload.summary || "",
      ip,
      userAgent,
    };

    // Attach diff if provided
    if (payload.before || payload.after) {
      doc.diff = computeDiff(payload.before || {}, payload.after || {});
    }

    // If you enabled TTL:
    // doc.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180);

    await AuditLog.create(doc);
  } catch (e) {
    // Never throw from logging
    console.error("audit log error:", e);
  }
}
